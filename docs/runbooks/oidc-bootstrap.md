# Runbook: Bootstrap OIDC GitHub a AWS

> **Estado**: stub. Este documento es el esqueleto del procedimiento de bootstrap. El contenido completo se desarrolla en #45.
>
> Mientras tanto, los ADRs que lo referencian (ADR-INFRA-0002, ADR-INFRA-0005, ADR-INFRA-0011) lo asumen como punto único de verdad para el procedimiento operativo. No ejecutar pasos por consola sin que esta página esté completa y revisada.

## Propósito

Documentar paso a paso cómo dejar operativos los OIDC providers y los roles IAM por dominio, en cada cuenta de la organización, partiendo de cero. Cubre tanto la creación de la cuenta nueva (`Skorify-staging`) como la importación al CDK de las cuentas existentes (`Skorify-development`, `Skorify-production`) y la OU `Skorify`.

## Audiencia

Coordinador general (@edisoncast) y líder de Infra (@Mateo454). Pasos sensibles requieren un humano en la sala con sesión SSO Admin en la cuenta master y MFA activo.

## Secciones planeadas

- **Pre-requisitos**:
  - SSO Admin en master, AWS CLI v2, Node 24, CDK CLI.
  - Permisos `iam:CreateRole` / `iam:CreateOpenIDConnectProvider` / `organizations:CreateAccount` / `organizations:CreateOrganizationalUnit` (o equivalentes vía rol asumido).
  - `cdk bootstrap aws://746669207643/us-east-1` corrido **una vez**. Cualquier stack con `DefaultStackSynthesizer` referencia el SSM parameter `/cdk-bootstrap/hnb659fds/version`. Crea el stack `CDKToolkit` con ~12 recursos (roles, bucket de assets, ECR, SSM). No destructivo. Ver ADR-INFRA-0011.
- **Aplicar `SkorifyOrganizationStack` desde master** (dos fases, CloudFormation no permite mezclar import y create):

  **Fase 1: importar OU + DEV + PROD.** El env var hace dos cosas:
  - Filtra `SKORIFY_ACCOUNTS` a las cuentas con `existing: true`.
  - Setea `forImport: true` en el módulo: omite `Tags` y `RoleName` en el template (CFN rechaza el import con `"As part of the import operation, you cannot modify or add [RoleArn, Tags]"` si están declarados).

  ```bash
  SKORIFY_ORG_IMPORT_PHASE=true npx cdk diff SkorifyOrganizationStack
  SKORIFY_ORG_IMPORT_PHASE=true npx cdk import SkorifyOrganizationStack
  ```

  CDK CLI solicita los IDs físicos: OU `ou-i8pg-d23ee4e4`, DEV `968306633562`, PROD `151646410766`.

  **Fase 2: aplicar Tags y crear STG.** Sin el env var. CFN detecta:
  - Tags pendientes en DEV y PROD: los agrega como UPDATE.
  - STG como recurso nuevo (no `existing`): la crea con `CreateAccount` (asíncrono, 1 a 15 min).

  El módulo NO emite `RoleName` en cuentas existentes (solo en STG). AWS Organizations marca `RoleName` como create-only; declararlo en una cuenta importada hace fallar el update con `"You cannot update IAM role name."`.

  ```bash
  npx cdk diff SkorifyOrganizationStack
  npx cdk deploy SkorifyOrganizationStack
  ```

  **Validar el resultado:**

  ```bash
  aws organizations list-accounts-for-parent --parent-id ou-i8pg-d23ee4e4
  for acct in <DEV> <STG> <PROD>; do
    aws organizations list-tags-for-resource --resource-id "$acct"
  done
  ```

  La cuenta de gestión `746669207643` (AWS UG Manizales) permanece a nivel del root; las 3 cuentas workload (DEV `968306633562`, STG, PROD `151646410766`) viven en la OU `Skorify` con tags `Environment`, `Project`, `Owner`; `Skorify-staggin` `779599553264` sigue fuera del template (suspendida).
- **`cdk bootstrap` por cuenta**:
  - Master (`746669207643`): hecho como pre-requisito (ver arriba).
  - DEV (`968306633562`): ya hecho con `cdk-hnb659fds-deploy-role-...`.
  - STG (cuenta nueva): pendiente, correr después de la fase 2.
  - PROD (`151646410766`): pendiente.
- **Aplicar `SkorifyBootstrapStack` por cuenta**:
  - Variables de entorno: `SKORIFY_ENVIRONMENT={dev,stg,prd,master}` para resolver el set de roles.
  - Credenciales asumidas en cada cuenta destino.
  - Validar con `aws iam list-open-id-connect-providers` y `aws iam list-roles`.
- **Cargar variables y secrets en los repos**:
  - `gh secret set AWS_DEPLOY_ROLE_ARN` por repo y por ambiente, o
  - `gh variable set AWS_ACCOUNT_ID_{DEV,STG,PRD}` si el composite resuelve el ARN dinámicamente (decisión final en #44).
- **Validación end to end**:
  - `aws sts get-caller-identity` desde un job dispatched manualmente.
  - Smoke test del workflow de `aws-ug-manizales/Pagina_Web` apuntando al rol `awsug-pagina-web-deploy`.
- **Recovery**:

  **Stack en `REVIEW_IN_PROGRESS` con 0 recursos.** Pasa cuando el changeset de import se valida y CFN lo rechaza (caso típico: declaraste Tags o RoleName en fase import). Limpiar y reintentar:

  ```bash
  aws cloudformation delete-stack --stack-name skorify-organization
  aws cloudformation wait stack-delete-complete --stack-name skorify-organization
  ```

  Sin recursos importados, el delete es inmediato.

  **Stack en `UPDATE_ROLLBACK_FAILED`.** Pasa cuando el rollback en sí falla (caso típico: rollback intenta deshacer un cambio en `RoleName`, que también es inmutable). Recuperar skipando los recursos atascados:

  ```bash
  aws cloudformation continue-update-rollback \
    --stack-name skorify-organization \
    --resources-to-skip <LogicalId1> <LogicalId2>
  aws cloudformation wait stack-rollback-complete --stack-name skorify-organization
  ```

  Los recursos skipped se consideran "ya están como deberían"; el stack vuelve a `UPDATE_ROLLBACK_COMPLETE` y acepta cambios.

  **Cuenta huérfana (CreateAccount completó después del rollback).** `CreateAccount` es asíncrono al backend de Organizations: si CFN inicia rollback antes de recibir confirmación, AWS puede terminar de crear la cuenta de todos modos. El siguiente `cdk deploy` falla con `Account with email [...] already exists`. Recovery:

  1. Encontrar la cuenta huérfana:
     ```bash
     aws organizations list-accounts --query 'Accounts[?Email==`<email-de-la-cuenta>`]'
     ```
  2. Marcarla como `existing: true` en `lib/config/organizations-config.ts` con un comentario explicando el incidente.
  3. Re-correr `cdk import` con un `--resource-mapping` que solo incluya esa cuenta (las demás ya están en el stack):
     ```bash
     SKORIFY_ORG_IMPORT_PHASE=true npx cdk import \
       --resource-mapping <mapping-solo-de-la-cuenta-huerfana>.json \
       --force \
       SkorifyOrganizationStack
     ```
  4. `cdk deploy` para aplicar Tags.

  **Trust policy mal escrita en un rol.** El rol queda creado pero ningún workflow puede asumirlo. Como las trust policies de los roles están en `lib/modules/iam/oidc-and-roles/`, corregir en código y `cdk deploy` (idempotente). Si el rol queda totalmente inservible, `aws iam delete-role` y dejar que CDK lo recree.

  **OIDC provider mal configurado.** No desasociar manualmente: editar el módulo y dejar que CDK haga el cambio. Eliminar un OIDC provider rompe TODOS los workflows de la cuenta donde estaba.
- **Cierre de la cuenta `Skorify-staggin` (deuda técnica)**: procedimiento con `aws organizations close-account`, AWS Support solo como fallback. Esta cuenta nunca se importa al template.

## Referencias

- Épico: aws-ug-manizales/Skorify_DevOps#40
- Issue de implementación de este runbook: aws-ug-manizales/Skorify_DevOps#45
- ADR-INFRA-0002: aislamiento por cuenta.
- ADR-INFRA-0005: OIDC GitHub a AWS.
- ADR-INFRA-0011: Organizations en IaC.
- ADR-CICD-0003: mapeo rama a ambiente.
