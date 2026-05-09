# Módulo Organizations

`OrganizationsModule` es el construct que materializa las cuentas workload de Skorify (DEV, STG, PROD) bajo la OU `Skorify`, como recursos `AWS::Organizations::Account`.

El módulo está pensado para invocarse desde un stack único (`SkorifyOrganizationStack`) que **solo se aplica desde la cuenta de gestión** (`746669207643`, AWS UG Manizales). No es parte del flujo CI/CD habitual: requiere humano en la sala con sesión SSO Admin en master.

Antes de aplicarlo por primera vez, hay que ejecutar `cdk import` para incorporar al stack la OU `Skorify` y las cuentas workload existentes (DEV, PROD). El procedimiento exacto está en `docs/runbooks/oidc-bootstrap.md`.

---

## Uso

```ts
new OrganizationsModule(envStack, 'SkorifyAccounts', {
  ou: SKORIFY_OU,           // ver lib/config/organizations-config.ts
  accounts: SKORIFY_ACCOUNTS,
});
```

`lib/main.ts` no lo invoca directamente. Lo hace `lib/modules/organizations/stack.ts` mediante `maybeCreateSkorifyOrganizationStack(app, opts)`, que también aplica:

1. **Materialización condicional**: el stack solo aparece cuando `CDK_DEFAULT_ACCOUNT` es la cuenta master. Desde DEV/STG/PROD `cdk list` no lo muestra y `cdk deploy --all` no lo toca.
2. **Filtrado por fase de import**: si `SKORIFY_ORG_IMPORT_PHASE=true`, el stack incluye solo las cuentas marcadas `existing: true` (DEV y PROD). En fase normal incluye las tres (DEV, STG, PROD).

Las definiciones viven en `lib/config/organizations-config.ts` como constantes TypeScript (no en SSM). Cualquier cambio a la topología pasa por PR con aprobación de los tres líderes según `CODEOWNERS`. SSM saltaría ese control.

---

## Contrato

### `OrganizationalUnitDefinition`

La OU bajo la cual viven las cuentas. El módulo la materializa como `CfnOrganizationalUnit` para que sea importable, taggeable y auditable.

Campos:

- `logicalName`: ID lógico (CDK construct ID y clave en el output `ou`).
- `name`: nombre en Organizations. En Skorify: `Skorify`.
- `parentId`: padre directo. Root `r-XXXX` u OU anidada `ou-XXXX-YYYYYYYY`.

### `OrganizationAccountDefinition`

Cada elemento del array genera (o importa) exactamente una cuenta.

Campos:

- `logicalName`: identificador único dentro del módulo (CDK construct ID).
- `accountName`: nombre de la cuenta en Organizations (`AccountName`). Convención `Skorify-{environment}`.
- `email`: email único asociado. Convención `awsugmanizales+skorify-{alias}@gmail.com`.
- `environment`: `dev` | `stg` | `prd`.
- `owner`: handle GitHub del responsable principal (tag `Owner`).
- `project`: opcional, default `Skorify`. Útil cuando una cuenta hostea workloads de varios proyectos.
- `roleName`: opcional, default `OrganizationAccountAccessRole`. **Solo se emite cuando `existing: false`.** En cuentas existentes el módulo lo omite siempre (RoleName es create-only en AWS Organizations).
- `existing`: opcional. `true` para las cuentas que ya existen en AWS. Tiene dos efectos:
  - El helper `maybeCreateSkorifyOrganizationStack` lo usa con `SKORIFY_ORG_IMPORT_PHASE=true` para filtrar el array a las cuentas a importar.
  - El módulo omite `RoleName` para esas cuentas en cualquier fase. AWS Organizations marca `RoleName` como inmutable; declararlo en una cuenta importada hace fallar el update con `"You cannot update IAM role name."`.

### `OrganizationsModuleProps`

```ts
export interface OrganizationsModuleProps {
  readonly ou: OrganizationalUnitDefinition;
  readonly accounts: OrganizationAccountDefinition[];
  /**
   * Si true, omite Tags y RoleName en el template para que CFN acepte el
   * cdk import (rechaza ambos con "cannot modify or add [RoleArn, Tags]"
   * durante import).
   */
  readonly forImport?: boolean;
}
```

---

## Qué aplica por defecto

Tanto la OU como cada cuenta gestionada salen con:

- `DeletionPolicy: Retain` declarado en el template. AWS resource import lo exige; sin él, `cdk import` falla. Quitar un recurso del template no cierra ni la OU ni la cuenta, solo la desasocia del stack.

Cada cuenta además sale con:

- Tags obligatorios: `Environment`, `Project=Skorify` (o el override), `Owner`. Se omiten en modo `forImport`.
- `roleName: OrganizationAccountAccessRole` **solo si `existing: false`**. En cuentas importadas se omite siempre. AWS Organizations marca `RoleName` como create-only.
- `parentIds: [ou.ref]` apuntando al recurso CDK de la OU (no a un string), para que el grafo CloudFormation quede consistente.

---

## Lo que el módulo no hace

- **No modela la cuenta de gestión** (`746669207643`, AWS UG Manizales). Sus tags se aplican fuera del stack vía `aws organizations tag-resource` desde el runbook (ver `ADR-INFRA-0011`).
- **No crea ni importa la `Organization` ni la OU `Skorify`**. La Organization preexiste; la OU se importa con `cdk import` por el operador antes del primer `cdk deploy`.
- **No define SCPs**. Las políticas viven (en el futuro) bajo `lib/modules/organizations/scps/`, gestionadas por un PR aparte. La estructura del directorio queda preparada como placeholder.
- **No incluye la cuenta `Skorify-staggin`** suspendida. Esa cuenta es deuda técnica de cierre; queda fuera del template hasta que se cierre con `aws organizations close-account` (ver `ADR-INFRA-0011`).

---

## Validaciones

El constructor falla rápido si detecta:

- `ou.parentId` que no inicia con `r-` (root) ni `ou-` (OU anidada).
- `ou.name` vacío.
- `logicalName` repetidos (incluyendo el de la OU).
- `accountName` repetidos.
- `email` repetidos (AWS exige unicidad global).
- `email` con formato obviamente inválido (no es validación RFC, descarta typos).
- `owner` vacío (rompe el tag obligatorio del `ADR-INFRA-0002`).

---

## Outputs

El construct expone:

- `accounts`: mapa `logicalName -> organizations.CfnAccount`.
  - El `ref` de cada `CfnAccount` resuelve al ID de la cuenta (12 dígitos) una vez que CloudFormation termine.

---

## Importación

Dos fases. CloudFormation no permite mezclar import y create en la misma operación, así que las cuentas nuevas (sin `existing: true`) quedan fuera del template durante el import y se crean en un `cdk deploy` posterior.

### Fase 1: importar las cuentas existentes

Con sesión SSO Admin en la master:

```bash
SKORIFY_ORG_IMPORT_PHASE=true npx cdk import SkorifyOrganizationStack
```

El env var hace que `lib/main.ts` filtre `SKORIFY_ACCOUNTS` a las cuentas con `existing: true` y pase `forImport: true` al módulo. El template emitido contiene **solo** la OU y las cuentas marcadas `existing`, sin Tags ni RoleName, que es lo que `cdk import` exige.

CDK CLI pide el ID físico de cada recurso. Estado actual en Skorify (todas existing tras el incidente del 2026-05-09 documentado en ADR-INFRA-0011):

| Recurso del template | Tipo | Physical ID |
|---|---|---|
| `SkorifyAccountsSkorifyOu*` | `AWS::Organizations::OrganizationalUnit` | `ou-i8pg-d23ee4e4` |
| `SkorifyAccountsSkorifyDevelopment*` | `AWS::Organizations::Account` | `968306633562` |
| `SkorifyAccountsSkorifyStaging*` | `AWS::Organizations::Account` | `553284493694` |
| `SkorifyAccountsSkorifyProduction*` | `AWS::Organizations::Account` | `151646410766` |

Antes de aceptar el import, validar con `cdk diff` que no haya cambios destructivos.

### Fase 2: crear cuentas nuevas y aplicar Tags

Sin el env var. CFN detecta:
- Tags pendientes en las cuentas importadas: los agrega como UPDATE.
- Cuentas con `existing: false`: las crea con `CreateAccount` (asíncrono, 1 a 15 min). En Skorify hoy todas las cuentas son `existing: true`, así que esta sub-fase queda como no-op para cuentas; solo aplica los Tags.

```bash
npx cdk diff SkorifyOrganizationStack
npx cdk deploy SkorifyOrganizationStack
```

El módulo NO emite `RoleName` en cuentas existentes para evitar el error `"You cannot update IAM role name."` (RoleName es create-only en Organizations).

---

## Referencias

- `ADR-INFRA-0002`: aislamiento por cuenta.
- `ADR-INFRA-0011`: Organizations en IaC.
- `docs/runbooks/oidc-bootstrap.md`: procedimiento de bootstrap completo.
