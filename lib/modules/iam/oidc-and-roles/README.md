# Módulo iam/oidc-and-roles

`OidcAndRolesModule` materializa el contrato del `ADR-INFRA-0005`: un OIDC provider `token.actions.githubusercontent.com` por cuenta, más roles federados con trust policy condicionada al `sub` del JWT (repo + ref pattern). Cada rol declara sus permisos inline.

El módulo es genérico; los roles concretos de Skorify viven en `lib/config/iam-roles-config.ts` y los statements por dominio en `lib/modules/iam/oidc-and-roles/permissions.ts`.

---

## Uso

```ts
import { OidcAndRolesModule } from './main';
import { rolesForAccount, GITHUB_ORG } from '../../../config/iam-roles-config';

new OidcAndRolesModule(stack, 'GitHubFederation', {
  githubOrg: GITHUB_ORG,
  roles: rolesForAccount(account)!,
});
```

`lib/main.ts` no lo invoca directamente: lo hace `lib/modules/iam/oidc-and-roles/stack.ts` mediante `maybeCreateSkorifyBootstrapStack(app, opts)`. El helper:

1. Devuelve `undefined` si la cuenta activa no está modelada (`SKORIFY_ACCOUNT_TO_ENV` o `MANAGEMENT_ACCOUNT_ID`).
2. Selecciona el set de roles aplicable (master vs workload Skorify).
3. Crea el stack `SkorifyBootstrapStack` fijado a la cuenta activa con `env.account`.

---

## Contrato

### `GitHubSubPattern`

```ts
type GitHubSubPattern =
  | `ref:refs/heads/${string}`     // push a branch
  | `ref:refs/tags/${string}`      // push de tag
  | 'pull_request'                 // todos los PRs del repo (literal, sin *)
  | `environment:${string}`;       // workflows que apuntan a un GitHub Environment
```

Cada patrón se concatena como `repo:{org}/{repoName}:{pattern}` y se evalúa con `StringLike`. Soporta `*` solo en la parte final dinámica (ej. `ref:refs/heads/release/*`). Los formatos siguen la [referencia de OIDC de GitHub](https://docs.github.com/en/actions/reference/security/oidc).

### `DeployRoleDefinition`

Cada elemento del array `roles` genera un `AWS::IAM::Role` con trust policy federada.

Campos:

- `logicalName`: CDK construct ID y clave en el output `roles`.
- `roleName`: nombre físico. Convención `{org}-{dominio}-deploy`.
- `repoName`: nombre del repositorio **sin la org** (la org la pasa el caller en `OidcAndRolesModuleProps.githubOrg`). Ejemplo: `'Skorify_Backend'`, no `'aws-ug-manizales/Skorify_Backend'`. El constructor valida que no contenga `/`.
- `subPatterns`: array de `GitHubSubPattern`. Al menos uno; sin patrón el rol podría asumirse desde cualquier contexto del repo, lo cual rompe el aislamiento.
- `statements`: array de `iam.PolicyStatement`. Al menos uno; un rol sin permisos no tiene sentido y no se permite.
- `description`: opcional, para el `Description` del rol.

### `OidcAndRolesModuleProps`

```ts
interface OidcAndRolesModuleProps {
  readonly githubOrg: string;
  readonly roles: DeployRoleDefinition[];
  readonly audience?: string; // default 'sts.amazonaws.com'
}
```

---

## Qué aplica por defecto

- OIDC provider único: `https://token.actions.githubusercontent.com` con `clientIds: ['sts.amazonaws.com']`. CDK lo materializa como custom resource (no como `AWS::IAM::OIDCProvider` nativo; el `OpenIdConnectProvider` del L2 de CDK usa custom resource).
- Trust policy de cada rol:
  - `Action: sts:AssumeRoleWithWebIdentity`.
  - `Condition.StringEquals` sobre `aud = sts.amazonaws.com`.
  - `Condition.StringLike` sobre `sub` con uno o más patrones `repo:{org}/{repoName}:{pattern}`.
- Inline policy con nombre `deploy` que contiene los `statements` declarados.

---

## Validaciones

El constructor falla rápido si detecta:

- `githubOrg` vacío.
- `logicalName` repetidos.
- `roleName` repetidos.
- Rol sin `subPatterns` (riesgo de sub claim demasiado permisivo).
- Rol sin `statements`.
- `repoName` que incluye la org (debe ser solo el nombre del repo).

---

## Outputs

- `provider`: el `iam.OpenIdConnectProvider` creado. Útil si otro construct del mismo stack quiere referenciarlo.
- `roles`: mapa `logicalName -> iam.Role`. El `roleArn` resuelve al ARN del rol una vez desplegado.

---

## Matriz de roles aplicada en Skorify

Definida en `lib/config/iam-roles-config.ts`. Una función por contexto:

| Cuenta | Función | Roles |
|---|---|---|
| Master (`746669207643`) | `rolesForMaster()` | `awsug-pagina-web-deploy`, `awsug-pagina-web-infra` |
| DEV (`968306633562`) | `rolesForSkorifyAccount(id, 'dev')` | `skorify-backend-deploy`, `skorify-frontend-deploy`, `skorify-frontend-infra`, `skorify-data-deploy`, `skorify-infra-deploy`, `skorify-ops-readonly` |
| STG (`553284493694`) | `rolesForSkorifyAccount(id, 'stg')` | mismos 6 |
| PROD (`151646410766`) | `rolesForSkorifyAccount(id, 'prd')` | mismos 6 |

Branch patterns por ambiente (ADR-CICD-0003):

| Ambiente | `subPatterns` |
|---|---|
| dev | `ref:refs/heads/develop` |
| stg | `ref:refs/heads/release/*` |
| prd | `ref:refs/heads/main`, `ref:refs/heads/hotfix/*` |
| master (`awsug-pagina-web-deploy`) | `ref:refs/heads/main` |

Excepciones a los branch patterns:

- `skorify-ops-readonly`: acepta `ref:refs/heads/*` (workflows de SRE solo lectura, corren desde cualquier rama).
- Roles `-infra` (`skorify-frontend-infra`, `awsug-pagina-web-infra`): su job declara `environment:`, así que GitHub emite el `sub` como `repo:ORG/REPO:environment:NAME` y la trust usa ese patrón (`environment:dev|stg|prd` para el frontend, `environment:production` para Pagina_Web). La rama y los required reviewers los impone el GitHub Environment, no la trust policy. Ver [referencia OIDC de GitHub](https://docs.github.com/en/actions/reference/security/oidc#example-subject-claims).

---

## Permisos por dominio (estado actual)

Validados contra el código real de cada repo (sesión 2026-05-10):

- **`awsug-pagina-web-deploy`** (master): S3 sync sobre `web-aws-group-manizales`, CloudFront invalidate sobre `E3OT8P8FKMB7Q7`. **Realidad confirmada**.
- **`awsug-pagina-web-infra`** (master): `terraform apply` de la infra de Pagina_Web. Bucket config, CloudFront, ACM read, read/write sobre el bucket de state `aws-ug-manizales-tf-state-746669207643`. Alto privilegio; trust `sub = repo:aws-ug-manizales/Pagina_Web:environment:production`, así que solo se asume desde el job que declara `environment: production` (required reviewers + branch policy de `main` los pone el Environment).
- **`skorify-backend-deploy`**: SAM serverless. Lambda + API Gateway + CloudWatch Logs + CW Metrics + CW Alarms (acotadas a `Skorify-Backend-*`/`skorify-backend-*`) + X-Ray + IAM PassRole + SSM. **Acotado a lo que existe**: SAM templates en `Skorify_Backend/builders/.../sam.template.yaml`. SQS/SNS/EventBridge/DynamoDB **no incluidos** todavía; agregar cuando aparezcan en el código.
- **`skorify-frontend-deploy`**: assets-only (SSG en S3, ADR-INFRA-0003). `s3:Put/Get/DeleteObject/ListBucket` sobre `skorify-frontend-*` + `cloudfront:CreateInvalidation/GetInvalidation`. NO gestiona infra.
- **`skorify-frontend-infra`**: `cdk deploy` de la infra del frontend (stack `skorify-frontend-{env}`: bucket privado + CloudFront OAC + response headers + error pages, y Route53/ACM cuando haya dominio). `sts:AssumeRole` sobre `cdk-hnb659fds-*`, CloudFormation sobre `skorify-frontend-*` + `CDKToolkit`, config del bucket `skorify-frontend-*` (no objetos), CloudFront, Route53, ACM, CDK assets bucket. Alto privilegio; trust `sub = repo:aws-ug-manizales/Skorify_Frontend:environment:{dev|stg|prd}` — el job `cdk-deploy-infra` declara `environment:` y el GitHub Environment impone reviewers + branch policy.
- **`skorify-data-deploy`**: librería de migrations contra Postgres. Secrets Manager (creds), RDS Describe, VPC describe, CloudFormation `skorify-data-*`. **Sin Lambda/SQS** todavía (el módulo es migrations runner, no servicio).
- **`skorify-infra-deploy`**: CDK del repo `Skorify_DevOps` (stack base `skorify-infra` + `skorify-infra-*` de módulos compartidos). `sts:AssumeRole` sobre los roles bootstrap `cdk-hnb659fds-*` (CDK con `DefaultStackSynthesizer` los asume para lookups, publicación de assets y el changeset), CloudFormation sobre `skorify-infra/*`, `skorify-infra-*/*` y `CDKToolkit/*`, IAM sobre roles `skorify-infra-*`, CDK assets bucket, SSM `/skorify/`. **No** puede gestionar los roles del bootstrap ni los OIDC providers: ese stack se aplica desde fuera del CI (humano con SSO Admin). Separación de responsabilidades. Nota: el `cdk-hnb659fds-cfn-exec-role` que ejecuta el changeset tiene `AdministratorAccess` por default del bootstrap; acotarlo requiere rehacer el bootstrap con `--cloudformation-execution-policies`.
- **`skorify-ops-readonly`**: lectura CloudWatch/Logs/X-Ray sobre `*`.

Cada función en `permissions.ts` documenta los servicios cubiertos y los aspiracionales pendientes.

---

## Referencias

- ADR-INFRA-0005: OIDC GitHub a AWS.
- ADR-CICD-0003: mapeo rama a ambiente.
- ADR-INFRA-0002: aislamiento por cuenta.
- `docs/runbooks/oidc-bootstrap.md`: procedimiento operativo.
