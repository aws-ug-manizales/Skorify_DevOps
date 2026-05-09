# ADR-INFRA-0011: AWS Organization, cuentas y OUs gestionadas como IaC

- **Estado**: Aceptado
- **Fecha**: 2026-05-09
- **Área**: Infra
- **Autores**: @edisoncast, @Mateo454
- **Aprobadores**: @steevensmelo (CI/CD), @Mateo454 (Infra), @lmichaelrc (SRE). Requiere los tres líderes por tratarse de un ADR fundacional que toca la base de la plataforma.

## Contexto

El principio operativo del equipo es **"todo en IaC, no ClickOps"**. Sin embargo, el activo más fundacional de la plataforma (la `Organization o-y5zmep6ibt`, su única OU `Skorify` y las 4 cuentas que la integran: 1 de gestión y 3 workload) **no está en código**. Una búsqueda en los repos `Skorify_DevOps`, `Skorify_Backend`, `Skorify_Frontend`, `Skorify_Data` y `Pagina_Web` no encuentra ningún `AWS::Organizations::Account`, `AWS::Organizations::OrganizationalUnit`, `CfnAccount`, `CfnOrganizationalUnit` ni equivalente. Las únicas referencias a IDs de cuenta aparecen en `cdk.context.json` (cache autogenerado por CDK) y `.devcontainer/README.md` (texto onboarding).

Una auditoría con CloudTrail (`lookup-events` en `us-east-1`, donde se loguean los eventos globales de Organizations) confirma cómo se llegó al estado actual:

```
2026-04-26 16:06   CreateOrganization                userIdentity.type=Root
2026-04-26 16:11   CreateOrganizationalUnit          userIdentity.type=Root
2026-04-26 16:14   CreateOrganizationalUnit          userIdentity.type=Root
2026-04-26 16:16   DeleteOrganizationalUnit          userIdentity.type=Root
2026-04-26 16:49   CreateAccount  → Skorify-development
2026-04-26 16:50   CreateAccount  → Skorify-staggin (typo)
2026-04-26 16:51   MoveAccount × 2
2026-04-26 16:52   CloseAccount + RemoveAccountFromOrganization × 2
2026-04-26 16:53   CreateAccount  → cuenta no presente hoy
2026-04-26 16:54   CreateAccount  → Skorify-production
2026-04-26 16:55   MoveAccount
2026-04-26 17:19   CreateAccount  → cuenta no presente hoy
```

Todos los eventos: `userAgent: Mozilla/Chrome`, `sourceIPAddress: 152.201.41.77`, `userType: Root`, `tags: []`. ClickOps puro, con identidad `root`, sin tagging, con varios retrabajos (cuentas creadas, cerradas y vueltas a crear el mismo día). Es el escenario textual que el principio "todo en IaC" busca prevenir.

Mantener la organización fuera del código tiene tres problemas concretos:

1. **No hay revisión por pares** para cambios estructurales: cualquiera con root crea o cierra cuentas sin que quede traza más allá de CloudTrail.
2. **Drift invisible**: si alguien renombra una cuenta o mueve una OU desde la consola, no hay forma sistemática de detectarlo.
3. **No hay tagging garantizado**: las 4 cuentas (la de gestión y las 3 workload) hoy carecen de los tags `Environment`, `Project` y `Owner` exigidos por `ADR-INFRA-0002`.

Adicionalmente, `ADR-INFRA-0002` decidió crear una cuenta STG nueva (`Skorify-staging`, email `awsugmanizales+skorify-stg@gmail.com`) para reemplazar a `Skorify-staggin` (suspendida, con typo). Esa creación tiene que ser desde IaC: si se hace por consola, se reincide en el ClickOps que justamente este ADR quiere extinguir.

## Decisión

Mover la `Organization`, sus OUs y sus cuentas a IaC en `Skorify_DevOps`, con CDK TypeScript.

1. **Módulo CDK `lib/modules/organizations/`** que expone:
   - El `Organization` (`o-y5zmep6ibt`, `FeatureSet=ALL`) **referenciado**, no creado: `AWS::Organizations::Organization` ya existe y la cuenta master no es un recurso administrable como tal por CloudFormation.
   - La OU `Skorify` (`ou-i8pg-d23ee4e4`) **importada** como `AWS::Organizations::OrganizationalUnit` con su `ParentId=r-i8pg`.
   - Las cuentas miembro como `AWS::Organizations::Account`:
     - **Importadas** (existen, mismas IDs): `968306633562` Skorify-development, `151646410766` Skorify-production.
     - **Creada por el módulo** (nueva): `Skorify-staging`, email `awsugmanizales+skorify-stg@gmail.com`, ubicada en la OU `Skorify`.
   - **Master `746669207643` queda fuera del template como `CfnAccount`**. `AWS::Organizations::Account` modela cuentas miembro creadas o importadas bajo la organización; la master es la cuenta de gestión que **posee** la Org. Hacerla `CfnAccount` no aplica semánticamente y CloudFormation tampoco la deja administrar de esa forma. El módulo la trata como contexto de despliegue (la cuenta donde se aplica el stack); sus tags se aplican con `aws organizations tag-resource` desde el runbook. Si más adelante se requiere automatizar, evaluar un custom resource o un pre-deploy hook (no un `CfnAccount`).
   - **Cuenta `Skorify-staggin` `779599553264` (suspendida) queda fuera del template**. No se importa.
   - Tags obligatorios en cada `CfnAccount` administrado: `Environment`, `Project=Skorify`, `Owner` (handle GitHub). El set obligatorio se mantiene mínimo a propósito (ver ADR-INFRA-0002 §6); etiquetas de FinOps como `CostCenter` se difieren hasta que el proyecto las requiera.
   - `OrganizationAccountAccessRole` como rol por defecto en cada cuenta nueva (mantiene compatibilidad con la sesión actual).

2. **Stack dedicado `SkorifyOrganizationStack`**, definido en `lib/main.ts`, que solo se aplica desde la cuenta master con credenciales del coordinador o del líder de Infra. No es parte del flujo CI/CD habitual: se aplica con un humano en la sala.

3. **Importación de las cuentas existentes** vía `cdk import`. Las 2 cuentas miembro ya creadas (DEV `968306633562`, PROD `151646410766`) entran al template con sus IDs y propiedades reales como `AWS::Organizations::Account`. La OU `Skorify` también se importa. El procedimiento exacto está en `docs/runbooks/oidc-bootstrap.md`. Se valida con `cdk diff` que no haya cambios destructivos antes de cualquier deploy.

4. **Cuenta `Skorify-staggin` (suspendida) queda fuera del template**. No se importa ni se reactiva. Se documenta como deuda técnica con dos compromisos:
   - Cerrar la cuenta con `aws organizations close-account --account-id 779599553264` (o desde la consola de Organizations) cuando haya capacidad. La cuenta queda en estado `SUSPENDED` por 90 días antes del cierre definitivo. AWS Support solo es necesario si el cierre programático falla por alguna restricción (recursos críticos remanentes, billing pendiente).
   - **No reusar** el email `awsugmanizales+skorify-staging@gmail.com` aunque AWS lo libere a los 90 días: el alias correcto pasa a ser `+skorify-stg@`, y el otro queda quemado.

5. **Política sobre el ciclo de vida de cuentas**: distinguir explícitamente entre "remover del stack" (operación de CloudFormation) y "cerrar cuenta" (operación de Organizations). Son dos cosas distintas.
   - **Crear cuenta**: PR al módulo `organizations/`, aprobación de los tres líderes, `cdk deploy` desde master.
   - **Renombrar cuenta o mover de OU**: PR al módulo, deploy.
   - **Cerrar cuenta**: `aws organizations close-account` o consola de Organizations. Esto cambia su estado a `SUSPENDED` 90 días antes del cierre definitivo. **Es una operación de Organizations, no de CloudFormation**.
   - **Remover del stack** (sin cerrar): `AWS::Organizations::Account` tiene `DeletionPolicy: Retain` por defecto, así que retirar el recurso del template solo lo desasocia del stack. La cuenta sigue viva en la organización. PR al módulo removiendo el `CfnAccount`, deploy.
   - **Flujo recomendado para descomisionar una cuenta**: primero cerrar con `close-account` y validar el `SUSPENDED`; después PR removiendo el recurso del template. El orden inverso también funciona pero deja un período donde la cuenta existe sin gestión IaC.
   - **Prohibido**: cambios manuales por consola sobre Org/OUs/cuentas (excepto cierre, donde la consola es alternativa válida a la API). Si se detecta drift, se reconcilia con un PR.

6. **SCPs base**: el módulo `organizations/scps/` (estructura preparada, contenido a definir en sub-ADR o PR siguiente) versiona las Service Control Policies aplicadas a la OU `Skorify`. Mínimo decidido en `ADR-INFRA-0002`: denegar regiones fuera de las permitidas, restringir `root`, proteger los OIDC providers gestionados. Detalle exacto se decide cuando se escriba el primer SCP.

7. **Detección de drift**: agregar al runbook un comando `aws organizations describe-organization` y `aws organizations list-accounts` que compare contra el output del `cdk synth`. Sin automatización de detección por ahora: el equipo lo corre periódicamente.

8. **CDK app refactor**: el `lib/main.ts` actual ya soporta múltiples ambientes vía `SKORIFY_ENVIRONMENT`. Este ADR agrega `SkorifyOrganizationStack` como un stack independiente que solo se materializa cuando `CDK_DEFAULT_ACCOUNT === '746669207643'` (master).

9. **Restricciones de AWS Organizations aplicadas al template**:
   - **`RoleName` es inmutable** en `AWS::Organizations::Account`. AWS lo trata como create-only: declararlo en una cuenta existente hace fallar el update con `"You cannot update IAM role name."` aunque el valor sea idéntico al actual. El módulo solo emite `roleName` para cuentas con `existing: false`. En cuentas importadas, se omite siempre, en cualquier fase.
   - **`Tags` y `RoleArn` no se aceptan durante `cdk import`**. CFN rechaza el changeset con `"As part of the import operation, you cannot modify or add [RoleArn, Tags]"`. Para esto el módulo expone la prop `forImport: boolean`, que el helper `maybeCreateSkorifyOrganizationStack` setea a `true` cuando `SKORIFY_ORG_IMPORT_PHASE=true`. En esa fase también se omiten los stack-level tags.
   - **Master sí necesita `cdk bootstrap`**, contrario a una afirmación previa de este ADR. Cualquier stack con `DefaultStackSynthesizer` (default en CDK v2) referencia el SSM parameter `/cdk-bootstrap/hnb659fds/version` aunque no haya assets. El runbook documenta que `cdk bootstrap aws://746669207643/us-east-1` se corre una vez antes de la fase 1.

## Consecuencias

### Positivas

- **Trazabilidad total** de cambios en Organizations: todo PR queda con autor, fecha, motivación y aprobaciones.
- **Imposibilidad de reincidencia en ClickOps**: cerrar el camino de la consola elimina la posibilidad de que el patrón de creación-con-root-sin-tags se repita.
- **Tagging garantizado**: el `cdk synth` falla si una cuenta no tiene los tags obligatorios. No es disciplina humana.
- **SCPs versionadas**: cualquier cambio a las políticas de cuenta queda en código y bajo review.
- **Onboarding más simple**: un nuevo miembro lee `docs/adr/infra/` y entiende cómo está armada la organización, sin necesidad de consultar la consola.
- **Drift detectable**: el `cdk diff` periódico revela cualquier cambio manual.

## Trade-offs y riesgos

### Negativos

- **CloudFormation no cierra cuentas**: `AWS::Organizations::Account` tiene `DeletionPolicy: Retain` por defecto, así que remover el recurso del template solo lo desasocia del stack y no toca la cuenta real. Cerrar la cuenta es una operación aparte de Organizations (`aws organizations close-account` o consola). Es una característica intencional, no una limitación, pero hay que tenerla presente para no confundir "limpieza de stack" con "cierre de cuenta".
- **`cdk import` es manual y delicado**: hay que importar cada `CfnAccount` y la `CfnOrganizationalUnit` con sus IDs reales, en el orden correcto, validando con `cdk diff` antes de `cdk deploy`. Un error puede dejar el stack en estado inconsistente.
- **La cuenta master no se modela como `CfnAccount`** (ver Decisión, punto 1). Si por error se agrega como recurso del template, el `CfnAccount` queda apuntando a la cuenta de gestión y la `DeletionPolicy: Retain` evita el daño en remoción, pero el stack queda inconsistente con la realidad de Organizations. La protección es no agregarla en primer lugar.
- **Más overhead administrativo para cambios pequeños**: agregar una cuenta deja de ser un click, pasa a ser un PR.

### A monitorear

- **Cambios manuales en consola**: el principio es prohibirlos, pero hay que detectarlos. Hasta que haya automatización, depende de revisión humana periódica.
- **Email único por cuenta**: AWS exige email único; si se cierra una cuenta y se quiere reusar el email, hay que esperar 90 días tras el cierre. Se documenta para no caer en errores de planning.
- **Cuenta de gestión**: la cuenta de gestión ya existía antes de la Organization y fue la que ejecutó `CreateOrganization`; al hacerlo pasa a ser la cuenta master por construcción ([doc `CreateOrganization`](https://docs.aws.amazon.com/organizations/latest/APIReference/API_CreateOrganization.html)). CDK la representa como contexto del Organization, no como `CfnAccount`. Cuidado en el módulo: la cuenta de gestión no se importa como `CfnAccount` para no romper el binding del Organization.
- **Latencia de Organizations**: las APIs de Organizations son lentas (un `CreateAccount` puede tardar minutos). Esperarlo en `cdk deploy` es normal; documentarlo en el runbook.
- **Riesgo de cuenta huérfana**: `CreateAccount` es asíncrono al backend de Organizations. Si CFN inicia rollback antes de recibir confirmación (por ejemplo, otro recurso del changeset falla), Organizations puede terminar de crear la cuenta de todos modos. La cuenta queda activa pero fuera del stack, y el siguiente `cdk deploy` falla con `Account with email [...] already exists`. Recovery: importarla en un siguiente `cdk import` y marcarla `existing: true` en `lib/config/organizations-config.ts`. Procedimiento detallado en el runbook.
- **Riesgo de SCPs amplias**: una SCP mal escrita puede dejar bloqueada la cuenta master o todos los workloads. `aws organizations attach-policy` no tiene `--dry-run`, así que la validación es por aislamiento, no por simulación: probar primero adjuntando la policy a una OU sandbox (o a una cuenta no crítica fuera de la OU `Skorify`), validar el efecto desde una identidad IAM dentro de esa cuenta, y solo después adjuntar a `Skorify`.

## Notas adicionales

- ADRs correlacionados:
  - ADR-INFRA-0002: define la topología (cuáles cuentas, cómo se llaman, qué tags llevan).
  - ADR-INFRA-0005: consume las cuentas para crear OIDC providers y roles.
  - ADR-INFRA-0006: complementa con tagging/naming general AWS (no solo cuentas).
- Issues que materializan este ADR: #41 (este documento), #42 (módulo CDK organizations), #45 (runbook con el procedimiento de bootstrap e import).
- Trabajo de seguimiento, fuera del alcance de la primera implementación:
  - Definir SCPs base concretas (PR independiente, sub-ADR si aplica).
  - Cerrar `Skorify-staggin` con `aws organizations close-account` o consola de Organizations; AWS Support solo si el cierre programático falla. La cuenta queda fuera del template desde el inicio, no requiere remoción posterior. (No urgente.)
  - Evaluar automatización de detección de drift (cron en GitHub Actions que corra `cdk diff`).
- Decisiones explícitamente diferidas:
  - Estructura de OUs adicionales (sandbox, security tooling, log archive) si la organización crece.
  - Centralización de logs en una cuenta dedicada vía Organizations CloudTrail.
