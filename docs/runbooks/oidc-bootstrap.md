# Runbook: Bootstrap OIDC GitHub a AWS

> **Estado**: stub. Este documento es el esqueleto del procedimiento de bootstrap. El contenido completo se desarrolla en #45.
>
> Mientras tanto, los ADRs que lo referencian (ADR-INFRA-0002, ADR-INFRA-0005, ADR-INFRA-0011) lo asumen como punto único de verdad para el procedimiento operativo. No ejecutar pasos por consola sin que esta página esté completa y revisada.

## Propósito

Documentar paso a paso cómo dejar operativos los OIDC providers y los roles IAM por dominio, en cada cuenta de la organización, partiendo de cero. Cubre tanto la creación de la cuenta nueva (`Skorify-staging`) como la importación al CDK de las cuentas existentes (`Skorify-development`, `Skorify-production`) y la OU `Skorify`.

## Audiencia

Coordinador general (@edisoncast) y líder de Infra (@Mateo454). Pasos sensibles requieren un humano en la sala con sesión SSO Admin en la cuenta master y MFA activo.

## Secciones planeadas

- **Pre-requisitos**: SSO Admin en master, AWS CLI v2, Node 24, CDK CLI, permisos `iam:CreateRole` / `iam:CreateOpenIDConnectProvider` / `organizations:CreateAccount` / `organizations:CreateOrganizationalUnit` (o equivalentes vía rol asumido).
- **Aplicar `SkorifyOrganizationStack` desde master**:
  - `cdk diff` y revisión.
  - `cdk import` para `OU Skorify`, `CfnAccount` DEV (`968306633562`) y `CfnAccount` PROD (`151646410766`).
  - `cdk deploy` que materializa la cuenta nueva `Skorify-staging` (email `awsugmanizales+skorify-stg@gmail.com`).
  - Validar con `aws organizations list-accounts` y `aws organizations list-accounts-for-parent --parent-id ou-i8pg-d23ee4e4`: la cuenta de gestión `746669207643` (AWS UG Manizales) permanece a nivel del root, las 3 cuentas workload (DEV `968306633562`, STG nueva, PROD `151646410766`) viven en la OU `Skorify`, y `Skorify-staggin` `779599553264` sigue fuera del template (suspendida). Validar también que cada cuenta tiene los tags obligatorios.
- **`cdk bootstrap` por cuenta de workload**:
  - DEV (`968306633562`): ya hecho con `cdk-hnb659fds-deploy-role-...`.
  - STG (cuenta nueva): pendiente al crearse.
  - PROD (`151646410766`): pendiente.
  - Master (`746669207643`): no aplica para esta capa, solo necesita IAM directo.
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
- **Recovery**: qué hacer si una trust policy queda mal y bloquea el deploy, cómo desasociar un OIDC provider sin romper otras cuentas, cómo revertir un `CfnAccount` mal importado.
- **Cierre de la cuenta `Skorify-staggin` (deuda técnica)**: procedimiento con `aws organizations close-account`, AWS Support solo como fallback. Esta cuenta nunca se importa al template.

## Referencias

- Épico: aws-ug-manizales/Skorify_DevOps#40
- Issue de implementación de este runbook: aws-ug-manizales/Skorify_DevOps#45
- ADR-INFRA-0002: aislamiento por cuenta.
- ADR-INFRA-0005: OIDC GitHub a AWS.
- ADR-INFRA-0011: Organizations en IaC.
- ADR-CICD-0003: mapeo rama a ambiente.
