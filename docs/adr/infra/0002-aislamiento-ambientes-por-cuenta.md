# ADR-INFRA-0002: Aislamiento de ambientes por cuenta AWS

- **Estado**: Aceptado
- **Fecha**: 2026-05-09
- **Área**: Infra
- **Autores**: @edisoncast, @Mateo454
- **Aprobadores**: @steevensmelo (CI/CD), @Mateo454 (Infra), @lmichaelrc (SRE)
- **Reemplaza a**: borrador previo "Una cuenta AWS con aislamiento por prefijos + IAM + tags"

## Contexto

El borrador inicial de este ADR asumía **una sola cuenta AWS** para los tres ambientes (DEV, STG, PROD), como restricción presupuestaria del proyecto comunitario. Esa premisa quedó invalidada al revisar el estado real de la organización.

Una auditoría con `aws organizations list-accounts` y CloudTrail confirmó la siguiente secuencia el 2026-04-26, toda desde la consola con identidad `root`: la cuenta `746669207643` (AWS UG Manizales) ya existía y desde ella se ejecutó `CreateOrganization` — pasó a ser la cuenta de gestión por el solo hecho de crear la `Organization o-y5zmep6ibt`; a continuación, varias llamadas a `CreateAccount` agregaron las cuentas workload. Estado resultante:

| Cuenta | ID | Estado |
|---|---|---|
| AWS UG Manizales (master) | `746669207643` | ACTIVE |
| Skorify-development | `968306633562` | ACTIVE |
| Skorify-staggin (typo, suspendida) | `779599553264` | SUSPENDED |
| Skorify-production | `151646410766` | ACTIVE |

La realidad operativa, entonces, **ya es multi cuenta**, aunque sin formalizar y sin gestión IaC. Continuar bajo el supuesto de cuenta única no solo es incorrecto: ignora un activo arquitectónico ya presente y arrastra todos los riesgos del borrador original (blast radius, IAM laxo, tagging frágil, billing entrelazado).

Existen dos opciones para alinear el ADR con la realidad:

1. **Consolidar a una sola cuenta** cerrando las hijas. Devuelve a Skorify a la situación del borrador original. Costoso (cerrar cuentas requiere `aws organizations close-account` por cuenta y un período de 90 días en estado `SUSPENDED` antes del cierre definitivo) y descarta una frontera de seguridad fuerte ya creada.
2. **Adoptar formalmente el modelo cuenta por ambiente**, gestionando Org, OUs y cuentas como IaC, con un OIDC provider y una matriz de roles por cuenta. Mantiene el aislamiento, formaliza el modelo, y permite seguir el principio "todo en IaC".

Se elige la opción 2.

## Decisión

Adoptamos **una cuenta AWS por ambiente Skorify** bajo la `Organization o-y5zmep6ibt`. Las cuentas workload (DEV, STG, PROD) viven agrupadas en la OU `Skorify` (`ou-i8pg-d23ee4e4`); la cuenta de gestión (`AWS UG Manizales`) permanece a nivel de root y aloja además los workloads de la comunidad UG (sitio web AWS UG Manizales).

1. **Topología de cuentas**:
   - `AWS UG Manizales` (`746669207643`) — cuenta master/management. Hostea la Organization, los workloads de la comunidad (sitio web AWS UG en S3+CloudFront) y un OIDC provider propio.
   - `Skorify-development` (`968306633562`) — DEV.
   - `Skorify-staging` (cuenta nueva por crear desde IaC, email `awsugmanizales+skorify-stg@gmail.com`) — STG. Reemplaza a la cuenta `Skorify-staggin` (`779599553264`) que queda suspendida y se documenta como deuda técnica de cierre. Ver ADR-INFRA-0011.
   - `Skorify-production` (`151646410766`) — PROD.

2. **Frontera de aislamiento**: la frontera de cuenta es la frontera de ambiente. Un push a `develop` solo asume rol en la cuenta DEV, físicamente no puede tocar PROD. No se delega esa garantía a condiciones de tag, prefijos de ARN ni IAM-conditions sobre nombres de recursos.

3. **OIDC y autenticación**: cada cuenta tiene su propio OIDC provider para `token.actions.githubusercontent.com` y su propio set de roles IAM. Sin cross account assume role. Detalle en ADR-INFRA-0005.

4. **Mapeo rama a cuenta**: deriva de ADR-CICD-0003.
   - `develop` → DEV
   - `release/*` → STG
   - `main` y `hotfix/*` → PROD

5. **Naming de cuentas**: `Skorify-{env}` en kebab-case (`Skorify-development`, `Skorify-staging`, `Skorify-production`). Master mantiene `AWS UG Manizales` por ser anterior al proyecto Skorify. Email pattern `awsugmanizales+skorify-{env}@gmail.com`; cuando un alias esté tomado (caso `staging`) se usa el alias acortado coherente (`stg`).

6. **Tagging obligatorio a nivel de cuenta**: `Environment`, `Project=Skorify` (o `Project=AWS-UG-Manizales` para master) y `Owner` (handle GitHub del líder). Etiquetas de FinOps adicionales (`CostCenter`, `BusinessUnit`, etc.) se difieren: hoy el proyecto está en fase inicial y la atribución de costo natural por cuenta + el tag `Project` cubren la necesidad real. Se revisará cuando aparezcan sub-equipos o áreas con presupuestos separados. En cuentas miembro gestionadas por IaC los tags se declaran en la propiedad `Tags` del recurso `AWS::Organizations::Account` (CDK los expone como propiedad de `CfnAccount`). La cuenta de gestión no se modela como `CfnAccount` (ver ADR-INFRA-0011), sus tags se aplican con `aws organizations tag-resource` desde el runbook (o un custom resource si más adelante se necesita automatizar).

7. **SCPs base**: aplicar Service Control Policies a la OU `Skorify` que denieguen como mínimo:
   - Uso de regiones distintas a `us-east-1` y `us-east-2` (única región hoy).
   - Acciones administrativas con identidad `root` (excepto las requeridas por AWS).
   - Modificación de los OIDC providers gestionados por IaC.
   - Detalle de las políticas en un sub-ADR o en el módulo CDK `lib/modules/organizations/`.

8. **VPCs y red**: decisión diferida. Cada cuenta administra su propia red por ahora; la decisión de VPC compartida vs. independiente vive en otro ADR cuando exista necesidad.

9. **Budgets y límites**: cada cuenta tiene su propio budget mensual (a definir por SRE en un ADR aparte). El aislamiento por cuenta hace que las cuotas de servicio (Lambda concurrency, API Gateway throttling, etc.) sean independientes por defecto, sin trabajo extra.

## Consecuencias

### Positivas

- **Aislamiento físico fuerte**: un error de IAM en DEV no puede tocar PROD; lo garantiza la frontera de cuenta, no una condición frágil de IAM.
- **Cuotas de servicio independientes**: cada ambiente arranca con sus propios límites; no hay riesgo de que una prueba de carga en DEV agote la capacidad de PROD.
- **Billing por ambiente trivial**: el rollup por cuenta en Cost Explorer ya separa el gasto por entorno sin depender de tags consistentes.
- **Trust policies simples**: cada rol en cada cuenta tiene una `Condition StringLike` sobre `token.actions.githubusercontent.com:sub` apuntando a un repo y patrón de rama. Sin compuestos `tag` + `arn` + `path`.
- **Compatible con la decisión de OIDC descentralizado** del ADR-INFRA-0005 sin acomodos.
- **Auditoría segregada**: los CloudTrail trails y eventos de Organizations quedan en master; los de workloads en cada cuenta hija.

## Trade-offs y riesgos

### Negativos

- **Más superficie operativa**: 4 OIDC providers que mantener (uno por cuenta), 4 `cdk bootstrap` (uno por cuenta de workload, master no necesita), 4 sets de roles. Manejable pero hay que disciplinarlo en código.
- **Cross-account observability requiere herramientas extra**: roll-up de logs y métricas no es automático. Deberá tratarse en un ADR de SRE.
- **No hay playground compartido**: cada experimento corre en DEV; si DEV se contamina, hay que limpiarla, no se puede simplemente cambiar de cuenta.
- **Costo fijo por cuenta**: cuatro veces el mínimo (negligible para los workloads de Skorify hoy, monitoreable con budgets).
- **Bootstrap inicial complejo**: requiere el orden documentado en `docs/runbooks/oidc-bootstrap.md`.

### A monitorear

- **Cambios en Organizations son lentos e irreversibles**: cerrar una cuenta se hace con `aws organizations close-account` o desde la consola (AWS Support solo si el cierre programático falla). La cuenta queda en `SUSPENDED` durante 90 días antes del cierre definitivo, y AWS solo libera el email entonces. Mover una cuenta entre OUs es trivial pero requiere `MoveAccount`.
- **Las cuentas existentes nacieron en ClickOps con identidad `root`**, sin tags, con varios retrabajos (`CreateAccount`, `CloseAccount`, `MoveAccount` ese mismo día según CloudTrail). Hay que importarlas a IaC sin recrearlas, ver ADR-INFRA-0011.
- **La cuenta `Skorify-staggin` suspendida queda como deuda técnica**: documentar plan de cierre en ADR-INFRA-0011, no reusarla, no reactivarla.
- **SCPs aún no están definidas**: hasta que se apliquen, las cuentas hijas tienen permisos amplios. Es un riesgo conocido a cerrar en el corto plazo.

## Notas adicionales

- ADRs correlacionados:
  - ADR-INFRA-0005: autenticación GitHub Actions a AWS vía OIDC (consume las cuentas definidas aquí).
  - ADR-INFRA-0011: Organizations, cuentas y OUs gestionadas como IaC (formaliza la operación).
  - ADR-CICD-0003: mapeo rama a ambiente (los nombres de ambiente que usa coinciden con los nombres de cuenta de este ADR).
- Trabajo de seguimiento, no bloquea la aprobación de este ADR:
  - Definir SCPs base concretas en `lib/modules/organizations/scps/`.
  - Cerrar la cuenta `Skorify-staggin` con `aws organizations close-account` o consola de Organizations (AWS Support solo como fallback). Como nunca se importa al template, no hay paso posterior de remoción.
  - Definir budgets por cuenta en un ADR de SRE.
