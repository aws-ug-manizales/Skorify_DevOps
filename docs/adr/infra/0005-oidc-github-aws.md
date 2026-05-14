# ADR-INFRA-0005: Autenticación GitHub Actions a AWS vía OIDC

- **Estado**: Aceptado
- **Fecha**: 2026-05-09
- **Área**: Infra
- **Autores**: @edisoncast, @Mateo454
- **Aprobadores**: @steevensmelo (CI/CD), @Mateo454 (Infra), @lmichaelrc (SRE). Requiere los tres líderes por tratarse de un ADR sensible que toca IAM.

## Contexto

Todo workflow de GitHub Actions que despliegue a AWS necesita credenciales. La pregunta no es "si" autenticar, sino "cómo": las dos opciones razonables son llaves IAM de larga duración almacenadas como secret del repositorio, o tokens temporales obtenidos vía OIDC.

Hoy ningún repositorio de la organización tiene credenciales configuradas. El run `25125198766` del workflow de `aws-ug-manizales/Pagina_Web` falló en el step `aws-actions/configure-aws-credentials@v6` con `Could not load credentials from any providers` precisamente porque ni el secret ni el rol existen. Ese es el caso piloto que destrabamos con la decisión de este ADR.

La elección entre llaves estáticas y OIDC tiene implicaciones de seguridad muy distintas:

- **Llaves IAM estáticas en secrets**: simples de configurar, peligrosas a mediano plazo. No expiran, no tienen scope por rama, su rotación depende de disciplina humana, y un secret filtrado vale para siempre. AWS y GitHub lo desaconsejan explícitamente para CI/CD desde 2022.
- **OIDC**: GitHub emite un JWT por job (vive ~5 min); AWS lo intercambia por credenciales temporales asumiendo un IAM role con trust policy condicionada al `sub` del token (`repo:org/repo:ref:refs/heads/<branch>`). Sin secrets de larga duración. Scope fino por repo y rama. Auditable por session name.

OIDC es la decisión obvia. Lo no obvio es la **topología**: dado que `ADR-INFRA-0002` formaliza una cuenta AWS por ambiente, hay dos formas razonables de armar OIDC sobre 4 cuentas.

| Opción | Cómo | Ventajas | Desventajas |
|---|---|---|---|
| **A. Centralizada en master/UG** | Un OIDC provider en master. Workflows asumen un rol "tooling" allí; ese rol hace `assume-role` cross account a DEV/STG/PROD. Patrón estilo AWS Control Tower. | Auditoría central. Un solo provider que rotar/mantener. | Más código (cadena de assume-role). Master se vuelve dependencia crítica. Trust policies más complejas. |
| **B. Descentralizada, OIDC por cuenta** | Un OIDC provider en cada cuenta de workload (master, DEV, STG, PROD). Workflows hacen OIDC directo a la cuenta destino. Sin cross account. | Trust policy simple. Sin SPOF central. Aislamiento alineado con `ADR-INFRA-0002`. | Hay que mantener 4 providers (rotación de thumbprint cuádruple). Auditoría descentralizada (CloudTrail por cuenta). |

## Decisión

Adoptamos **OIDC con topología descentralizada (opción B)**.

1. **OIDC providers**: cada cuenta de la organización (master `746669207643`, DEV `968306633562`, STG `553284493694`, PROD `151646410766`) tiene su propio OIDC provider para `token.actions.githubusercontent.com`. El client-id (`sts.amazonaws.com`) es idéntico en las 4. Gestionados desde `lib/modules/iam/oidc-and-roles/` del CDK de `Skorify_DevOps` (el L2 `OpenIdConnectProvider` de CDK lo crea como custom resource, no como `AWS::IAM::OIDCProvider` nativo).

2. **Roles por dominio y cuenta**: un rol por dominio funcional, en cada cuenta donde tenga sentido aplicar. Naming `skorify-{dominio}-deploy` en cuentas de workload Skorify; `awsug-pagina-web-deploy` en la cuenta master/UG. Algunos dominios tienen además un rol `-infra` de alto privilegio (`cdk`/`terraform apply` de su infra), separado del de deploy de assets.

   | Cuenta | Roles |
   |---|---|
   | Master/UG | `awsug-pagina-web-deploy`, `awsug-pagina-web-infra` |
   | DEV | `skorify-backend-deploy`, `skorify-frontend-deploy`, `skorify-frontend-infra`, `skorify-data-deploy`, `skorify-infra-deploy`, `skorify-ops-readonly` |
   | STG | mismos que DEV |
   | PROD | mismos que DEV |

   (`skorify-frontend-infra` y el rol de Pagina_Web `awsug-pagina-web-infra` se detallan en ADR-INFRA-0003 y en la CI de Pagina_Web respectivamente.)

3. **Trust policy de cada rol**: condicionada al `sub` del JWT de GitHub. La condición sigue el mapeo rama a ambiente del `ADR-CICD-0003`:

   | Cuenta | Patrón `sub` (StringLike) |
   |---|---|
   | DEV | `repo:aws-ug-manizales/<repo-del-dominio>:ref:refs/heads/develop` |
   | STG | `repo:aws-ug-manizales/<repo-del-dominio>:ref:refs/heads/release/*` |
   | PROD (main) | `repo:aws-ug-manizales/<repo-del-dominio>:ref:refs/heads/main` |
   | PROD (hotfix) | `repo:aws-ug-manizales/<repo-del-dominio>:ref:refs/heads/hotfix/*` |
   | Master (`awsug-pagina-web-deploy`) | `repo:aws-ug-manizales/Pagina_Web:ref:refs/heads/main` |

   **Excepción para los roles `-infra`**: su workflow declara un GitHub Environment (required reviewers + branch policy), y al hacerlo GitHub emite el `sub` como `repo:ORG/REPO:environment:NAME`, no `ref:refs/heads/...` ([referencia OIDC de GitHub](https://docs.github.com/en/actions/reference/security/oidc#example-subject-claims)). Su trust usa ese patrón: `repo:aws-ug-manizales/Skorify_Frontend:environment:{dev|stg|prd}` y `repo:aws-ug-manizales/Pagina_Web:environment:production`. El control de rama y la aprobación humana los hace el Environment; la trust solo ata el rol a él.

   `skorify-ops-readonly` es la otra excepción: `ref:refs/heads/*` (workflows de SRE solo lectura).

   Adicionalmente: `Condition StringEquals` para `token.actions.githubusercontent.com:aud = sts.amazonaws.com`. Sin condiciones por tag o ARN hasta que haya razón concreta.

4. **Permisos por rol**: política IAM **inline** (no managed) por rol, escrita explícitamente en el módulo CDK. Cero `*:*` y cero `iam:*`. Borrador de permisos por dominio:

   - `awsug-pagina-web-deploy`: `s3:ListBucket/PutObject/DeleteObject/GetObject` sobre `web-aws-group-manizales`, `cloudfront:CreateInvalidation` sobre la distribución del sitio.
   - `awsug-pagina-web-infra`: `terraform apply` de la infra de Pagina_Web. Config del bucket (no objetos), CloudFront, ACM read, read/write sobre el bucket de state de Terraform.
   - `skorify-backend-deploy`: SAM/CloudFormation, Lambda, API Gateway, CloudWatch Logs, IAM `PassRole` acotado a roles de Lambda del proyecto (`role/skorify-lambda-*`).
   - `skorify-frontend-deploy`: S3 sync sobre el bucket de frontend del ambiente, CloudFront invalidation. Assets-only, sin tocar infra.
   - `skorify-frontend-infra`: `cdk deploy` de la infra del frontend (S3 + CloudFront + OAC + Route53/ACM). `sts:AssumeRole` sobre los roles bootstrap `cdk-hnb659fds-*`, CloudFormation sobre `skorify-frontend-*`. Ver ADR-INFRA-0003.
   - `skorify-data-deploy`: RDS describe, Secrets Manager read, S3 sobre el bucket de datos del ambiente.
   - `skorify-infra-deploy`: CloudFormation, IAM con condiciones de path, S3 sobre el bucket `cdk-assets`.
   - `skorify-ops-readonly`: `cloudwatch:Get*/Describe*/List*`, `logs:Get*/Describe*/Filter*`, `xray:Get*/BatchGet*`. Sin write a recursos.

   Cada lista anterior es un punto de partida; los permisos finales se revisan en el PR del módulo de roles (#43).

5. **Session name**: `gh-${{ github.repository_id }}-${{ github.run_id }}`. Permite trazar cada llamada a CloudTrail hasta el run específico.

6. **Composite action centralizado**: `actions/setup-aws-credentials` en `Skorify_DevOps` resuelve el ARN del rol a partir de `environment` y `domain`, y llama a `aws-actions/configure-aws-credentials@v6`. Cualquier repo de la organización lo consume con `uses: aws-ug-manizales/Skorify_DevOps/actions/setup-aws-credentials@<sha>`. Ver issue #44.

7. **Sin fallback a llaves estáticas**: ningún workflow de la organización debe usar `aws_access_key_id`/`aws_secret_access_key` en secrets. El acceso humano (no CI/CD) sigue por IAM Identity Center / SSO, que es independiente de este ADR.

8. **Bootstrap**: orden y procedimiento documentados en `docs/runbooks/oidc-bootstrap.md` (#45).

## Consecuencias

### Positivas

- **Cero credenciales de larga duración** en GitHub. La filtración de un secret deja de ser un riesgo de plataforma.
- **Scope por repo y rama** ejecutable por la trust policy: un push a `develop` físicamente no puede asumir el rol de PROD, sin depender de IAM-conditions sobre tags.
- **Auditoría granular**: el `session name` identifica el run de Actions exacto que invocó cada API. Combinado con el aislamiento de cuentas, las respuestas a "quién hizo qué" son triviales en CloudTrail.
- **Sin SPOF central**: si un OIDC provider falla, solo afecta a su cuenta; el resto sigue desplegando.
- **Patrón reutilizable**: el composite action centralizado evita que cada repo reinvente el wiring.

## Trade-offs y riesgos

### Negativos

- **4 OIDC providers que mantener**: GitHub puede rotar el certificado raíz que respalda el JWT y el thumbprint en AWS debe actualizarse. Hay que monitorear y automatizar la renovación.
- **Más permisos administrativos para crear el bootstrap**: el primer despliegue del módulo de roles requiere alguien con acceso `iam:CreateRole/CreateOpenIDConnectProvider` en cada cuenta. Eso queda restringido al líder de Infra y al coordinador.
- **Setup más complejo que llaves**: el día uno tiene más fricción que copiar un access key; el ahorro aparece en el día N.

### A monitorear

- **Thumbprint de GitHub**: GitHub publica el certificado de su OIDC issuer. Cuando lo rotan (no es frecuente, pero pasa), AWS deja de aceptar tokens hasta que el thumbprint se actualice. Tarea recurrente del equipo Infra: validar trimestralmente.
- **Trust policies mal escritas**: una condición `StringLike` con un wildcard demasiado amplio (`refs/heads/*` cuando debió ser `refs/heads/main`) rompe el aislamiento. El review del PR del módulo de roles tiene que mirar específicamente esto.
- **Permisos amplios por inercia**: la tentación de copiar una managed policy ancha es real. La revisión por los tres líderes en cada cambio al módulo de IAM es obligatoria.
- **Session-name controlado por el repo**: cualquier workflow puede pedir un session name arbitrario. No usar el session name como base de decisión de seguridad; sí para auditoría.

## Notas adicionales

- ADRs correlacionados:
  - ADR-INFRA-0002 (cuentas por ambiente, define la frontera que este ADR consume).
  - ADR-INFRA-0011 (Organizations en IaC, garantiza que las cuentas que este ADR referencia están bajo control de código).
  - ADR-CICD-0003 (mapeo rama a ambiente, define los `branch` de la trust policy).
  - ADR-INFRA-0006 (tagging y naming, complementa el naming de roles aquí decidido).
- Issues que materializan este ADR: #41 (este documento), #43 (módulo CDK), #44 (composite action), #45 (runbook).
- Decisiones diferidas:
  - Política de rotación automática del thumbprint de GitHub OIDC.
  - Cómo segregar permisos cuando aparezcan workflows de mantenimiento (backups, dry-runs, snapshots) que no encajan en los dominios actuales.
