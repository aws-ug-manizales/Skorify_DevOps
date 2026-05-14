# ADR-INFRA-0012: IAM Identity Center — grupos, permission sets y assignments

- **Estado**: Aceptado
- **Fecha**: 2026-05-14
- **Área**: Infra
- **Autores**: @edisoncast
- **Aprobadores**: @steevensmelo (CI/CD), @Mateo454 (Infra), @lmichaelrc (SRE). Requiere los tres líderes por tratarse de un ADR que toca IAM y el acceso humano a todas las cuentas.

## Contexto

Hoy el acceso humano a las 4 cuentas de Skorify (master `746669207643`, DEV `968306633562`, STG `553284493694`, PRD `151646410766`) pasa por IAM Identity Center, pero **no está modelado en código**: los pocos permission sets que existen (`AdministratorAccess`) se crearon manualmente en algún momento y todos los usuarios que entran al portal asumen ese rol con privilegios completos en cualquier cuenta a la que tengan asignación.

`ADR-INFRA-0005` §7 anticipó que "el acceso humano (no CI/CD) sigue por IAM Identity Center / SSO, que es independiente de este ADR" — dejando explícitamente la pieza fuera de alcance del bootstrap OIDC. Este ADR cierra esa pieza.

El estado actual tiene tres problemas:

1. **Sin least privilege**: cualquier humano con acceso a una cuenta workload tiene admin. No hay diferencia entre alguien que necesita leer logs (PM, observador) y alguien que necesita modificar la infra. Cualquier error es destructivo en PRD.
2. **Sin distinción dev vs stg/prd a nivel humano**: el CI/CD ya separa por OIDC (los roles `skorify-*-deploy` están scoped por cuenta y por dominio), pero un humano que entra al portal puede tocar PRD igual que DEV. Eso contradice [[adr-infra-0002]] (aislamiento por cuenta) en su dimensión humana.
3. **Sin onboarding/offboarding documentado**: agregar un dev al proyecto requiere conocimiento tácito de quién crea el usuario, en qué directorio y qué grupos tocar. Sale más caro de lo que debería y se hace inconsistente.

Adicionalmente, AWS recomienda explícitamente para 2026 dejar de crear usuarios IAM para acceso humano y federar todo por Identity Center. Manejar los permission sets y assignments por consola contradice el principio "todo en IaC" que [[adr-infra-0011]] formalizó.

## Decisión

1. **Fuente de identidad**: Identity Center directory (built-in). No SCIM ni IdP externo en esta iteración. Cuando el equipo crezca o haya requisito corporativo, se migra a SCIM sin cambiar la matriz de grupos/permission sets/assignments (eso es lo que la federación SCIM preserva).

2. **6 grupos** modelados como `aws_identitystore.CfnGroup`. Naming `skorify-<rol>[-<dominio>]`, kebab-case:

   | Grupo | Quién entra ahí |
   |---|---|
   | `skorify-admins` | Edison y los líderes de área. Acceso completo a master y break-glass en workload. |
   | `skorify-platform-devops` | Equipo DevOps día a día. No entra a master por SSO; si necesita Org/SSO, también está en `skorify-admins`. |
   | `skorify-developers-backend` | Devs del repo `Skorify_Backend`. |
   | `skorify-developers-frontend` | Devs del repo `Skorify_Frontend`. |
   | `skorify-developers-data` | Devs del repo `Skorify_Data`. |
   | `skorify-observers` | PMs, business, mentees, comunidad. Solo lectura. |

3. **9 permission sets** modelados como `aws_sso.CfnPermissionSet`. Naming `Skorify<Rol><Scope>` PascalCase. AWS prefija el rol IAM resultante como `AWSReservedSSO_<PermissionSet>_<sufijo>`.

   | Permission Set | Política base | Session | Propósito |
   |---|---|---|---|
   | `SkorifyAdmin` | `AdministratorAccess` (managed) | 1h | Full admin. Master y break-glass workload. |
   | `SkorifyPlatformDevOps` | `PowerUserAccess` (managed) + inline scoped a `skorify-*` (CFN, IAM `role/skorify-*`) + boundary `PowerUserAccess` | 4h | DevOps en workload accounts. |
   | `SkorifyDeveloperFull` | `PowerUserAccess` (managed) | 4h | Engineers en DEV. Acceso amplio sin gestionar IAM. |
   | `SkorifyDeveloperReadOnly` | `ReadOnlyAccess` (managed) | 8h | Engineers en STG/PRD para debug. |
   | `SkorifyDataEngineerFull` | `PowerUserAccess` (managed) + inline (RDS write `skorify-data-*`, Secrets `skorify/data/*` read/write) | 4h | Data en DEV. |
   | `SkorifyDataEngineerReadOnly` | `ReadOnlyAccess` (managed) + inline (Secrets `DescribeSecret` sin `GetSecretValue`, RDS Describe) | 8h | Data en STG/PRD. |
   | `SkorifyObserver` | `ReadOnlyAccess` (managed) | 8h | Lectura general en workload. |
   | `SkorifyBilling` | `job-function/Billing` + `AWSBudgetsReadOnlyAccess` (managed) | 8h | Solo master, visibilidad de costos. |
   | `SkorifyBreakGlass` | `AdministratorAccess` (managed) + tag `BreakGlass=true` | 1h | Emergencias en STG/PRD. La tag habilita una EventBridge rule (futura) que alerta cualquier `AssumeRole` contra este permission set. |

   Los `session` duration siguen la guía de AWS (default 1h, máximo 12h) y mapean al riesgo: cuanto más poder, menos tiempo de sesión.

4. **Matriz de assignments** modelados como `aws_sso.CfnAssignment`:

   | Grupo | master | DEV | STG | PRD |
   |---|---|---|---|---|
   | `skorify-admins` | `SkorifyAdmin` | `SkorifyAdmin` | `SkorifyDeveloperReadOnly` + `SkorifyBreakGlass` | `SkorifyDeveloperReadOnly` + `SkorifyBreakGlass` |
   | `skorify-platform-devops` | — | `SkorifyPlatformDevOps` | `SkorifyPlatformDevOps` | `SkorifyDeveloperReadOnly` |
   | `skorify-developers-backend` | — | `SkorifyDeveloperFull` | `SkorifyDeveloperReadOnly` | `SkorifyDeveloperReadOnly` |
   | `skorify-developers-frontend` | — | `SkorifyDeveloperFull` | `SkorifyDeveloperReadOnly` | `SkorifyDeveloperReadOnly` |
   | `skorify-developers-data` | — | `SkorifyDataEngineerFull` | `SkorifyDataEngineerReadOnly` | `SkorifyDataEngineerReadOnly` |
   | `skorify-observers` | `SkorifyBilling` | `SkorifyObserver` | `SkorifyObserver` | `SkorifyObserver` |

   Lecturas clave:

   - En STG/PRD, **nadie escribe desde SSO** (excepto break-glass explícito). Los cambios reales en esos ambientes pasan por CI/CD vía los roles OIDC `skorify-*-deploy`.
   - `skorify-admins` en STG/PRD tiene los dos permission sets (`ReadOnly` + `BreakGlass`); el portal IC permite elegir cuál asumir al login y el default debería ser `ReadOnly`.
   - `skorify-platform-devops` no entra a master. Para tocar Org/SSO/OIDC hay que estar también en `skorify-admins`. Esa separación fuerza intención cuando se necesita poder global.
   - `skorify-observers` accede a master solo para `Billing` + `Budgets` (visibilidad de costos), no a recursos.

5. **MFA obligatorio** para todos los usuarios del directorio (config global de Identity Center). Session del portal: 8h (default AWS).

6. **Stack CDK separado**, `SkorifyIdentityCenterStack`, materializado **solo cuando el CDK corre contra master** vía un helper `maybeCreateSkorifyIdentityCenterStack(app, { currentAccount })` siguiendo el mismo pattern de `lib/modules/iam/oidc-and-roles/stack.ts` y `lib/modules/organizations/stack.ts`. El stack vive en `lib/modules/iam/identity-center/`.

7. **InstanceArn e IdentityStoreId** se leen de SSM Parameter Store en master: `/skorify/identity-center/instance-arn` y `/skorify/identity-center/identity-store-id`. Son one-time bootstrap (un humano los setea con la CLI la primera vez). No se hardcodean en el código y no se versionan: el ARN identifica a la instancia única del IC en la org.

8. **Construct level**: L1 (`Cfn*`). CDK no tiene L2 para IAM Identity Center todavía (mayo 2026). El módulo encapsula las complejidades del L1 detrás de una API tipada.

9. **Membresía a grupos**: los grupos se crean por código; agregar usuarios concretos al grupo se hace **por consola o CLI** y queda fuera del código fuente. No queremos commitear nombres y emails reales del equipo en un repo público.

## Consecuencias

### Positivas

- **Cero ClickOps en permission sets**: cualquier cambio de la matriz pasa por PR y se revisa.
- **Least privilege real**: STG y PRD son lectura por default para humanos. Solo CI/CD escribe ahí.
- **Onboarding repetible**: agregar un dev nuevo es "crear user + agregar al grupo correspondiente". Documentado en `docs/runbooks/identity-center-onboarding.md`.
- **Break-glass auditado**: el permission set `SkorifyBreakGlass` está taggeado para que una EventBridge rule futura alerte cualquier uso.
- **Migración a IdP externo (SCIM)**: cuando llegue, la matriz no cambia. SCIM solo provisiona usuarios/grupos en el directorio; los `CfnPermissionSet` y `CfnAssignment` siguen vigentes.

### Trade-offs

- **Inversión inicial**: ~9 permission sets + 6 grupos + 24 assignments. Implementación más grande que "todos admin". A cambio, separación operativa robusta.
- **Multi permission set en una misma cuenta**: para `skorify-admins` en STG/PRD se asignan dos permission sets (`ReadOnly` + `BreakGlass`). Los usuarios pueden confundirse y elegir el más poderoso por default. Mitigación: el runbook ordena qué elegir y el tag `BreakGlass=true` deja traza para auditoría posterior.
- **Identity Center directory (no SCIM)**: limita a usuarios creados a mano en el portal. Aceptable hasta ~10-15 usuarios; pasar de eso obliga a SCIM.
- **Permisos custom (data, devops) son inline**: harder de auditar que managed policies. A los 30-60 días se revisan con IAM Access Analyzer y se ajustan.

### A monitorear

- **Uso real de `SkorifyBreakGlass`**: debería ser cero o cercano a cero en operación normal. Si se asume seguido, hay un problema de diseño (acceso normal insuficiente) o de proceso.
- **Sesiones largas en `SkorifyDeveloperReadOnly`**: 8h es generoso. Si CloudTrail muestra muchas sesiones inactivas, bajar a 4h.
- **Permission sets de `Data` con inline policies**: el inline puede crecer por inercia. Cada PR que toque `permissions.ts` requiere revisión cuidadosa de scopes.
- **Account drift**: si alguien crea un permission set por consola, este stack no lo gestiona. Periódicamente comparar `aws sso-admin list-permission-sets` con el output del synth.

## Notas adicionales

- **ADRs correlacionados**:
  - [[adr-infra-0002]]: aislamiento por cuenta. Este ADR es su contraparte humana.
  - [[adr-infra-0005]]: OIDC GitHub a AWS. CI/CD y humanos son rutas separadas e intencionales; no se mezclan.
  - [[adr-infra-0011]]: Organization en IaC. Mismo pattern arquitectónico (stack que solo materializa en master).
- **Trabajo de seguimiento, fuera del alcance**:
  - `ADR-INFRA-0013` (futuro): SCPs a nivel OU (deny `iam:CreateUser`, deny `cloudtrail:Delete*`, deny acciones fuera de `us-east-1`, etc.).
  - Módulo `lib/modules/security/breakglass-alert/`: EventBridge rule + SNS topic que alerta `AssumeRoleWithSAML` contra `SkorifyBreakGlass`.
  - Refinamiento de permission sets `SkorifyDataEngineer*` y `SkorifyPlatformDevOps` con IAM Access Analyzer tras 30-60 días de uso.
  - Migración a SCIM (Workspace o Entra) cuando el equipo crezca.
- **Decisiones explícitamente diferidas**:
  - ABAC con session tags (`PrincipalTag/Project`, etc.). Útil cuando hay >1 proyecto; hoy con account-per-env es overkill.
  - Service Quotas alerts y Cost Anomaly Detection (van con FinOps, alineado con [[feedback_minimal_early_stage]]).
