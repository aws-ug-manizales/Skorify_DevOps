# Módulo Organizations

`OrganizationsModule` es el construct que materializa las cuentas workload de Skorify (DEV, STG, PROD) bajo la OU `Skorify`, como recursos `AWS::Organizations::Account`.

El módulo está pensado para invocarse desde un stack único (`SkorifyOrganizationStack`) que **solo se aplica desde la cuenta de gestión** (`746669207643`, AWS UG Manizales). No es parte del flujo CI/CD habitual: requiere humano en la sala con sesión SSO Admin en master.

Antes de aplicarlo por primera vez, hay que ejecutar `cdk import` para incorporar al stack la OU `Skorify` y las cuentas workload existentes (DEV, PROD). El procedimiento exacto está en `docs/runbooks/oidc-bootstrap.md`.

---

## Uso

```ts
new OrganizationsModule(envStack, 'SkorifyAccounts', {
  ouId: 'ou-i8pg-d23ee4e4',
  accounts: SKORIFY_ACCOUNTS, // ver lib/config/organizations-config.ts
});
```

Las definiciones viven en `lib/config/organizations-config.ts` como una constante TypeScript (no en SSM). Esa elección es deliberada: cualquier cambio a la topología de la organización pasa por PR + revisión de los tres líderes según `CODEOWNERS`. SSM permitiría cambiar la estructura sin code review, lo que rompe el modelo de gobernanza.

---

## Contrato

### `OrganizationAccountDefinition`

Cada elemento del array genera (o importa) exactamente una cuenta.

Campos:

- `logicalName`: identificador único dentro del módulo (CDK construct ID).
- `accountName`: nombre de la cuenta en Organizations (`AccountName`). Convención `Skorify-{environment}`.
- `email`: email único asociado. Convención `awsugmanizales+skorify-{alias}@gmail.com`.
- `environment`: `dev` | `stg` | `prd`.
- `owner`: handle GitHub del responsable principal (tag `Owner`).
- `project`: opcional, default `Skorify`. Útil cuando una cuenta hostea workloads de varios proyectos.
- `roleName`: opcional, default `OrganizationAccountAccessRole`. Solo aplica al crear cuentas nuevas.

### `OrganizationsModuleProps`

```ts
export interface OrganizationsModuleProps {
  readonly accounts: OrganizationAccountDefinition[];
  readonly ouId: string;
}
```

---

## Qué aplica por defecto

Cada cuenta gestionada por el módulo sale con:

- Tags obligatorios: `Environment`, `Project=Skorify` (o el override), `Owner`.
- `roleName: OrganizationAccountAccessRole` (compatibilidad con la sesión actual de la master).
- `DeletionPolicy: Retain` (default de CloudFormation para `AWS::Organizations::Account`): remover el recurso del template solo lo desasocia del stack, no cierra la cuenta.

---

## Lo que el módulo no hace

- **No modela la cuenta de gestión** (`746669207643`, AWS UG Manizales). Sus tags se aplican fuera del stack vía `aws organizations tag-resource` desde el runbook (ver `ADR-INFRA-0011`).
- **No crea ni importa la `Organization` ni la OU `Skorify`**. La Organization preexiste; la OU se importa con `cdk import` por el operador antes del primer `cdk deploy`.
- **No define SCPs**. Las políticas viven (en el futuro) bajo `lib/modules/organizations/scps/`, gestionadas por un PR aparte. La estructura del directorio queda preparada como placeholder.
- **No incluye la cuenta `Skorify-staggin`** suspendida. Esa cuenta es deuda técnica de cierre; queda fuera del template hasta que se cierre con `aws organizations close-account` (ver `ADR-INFRA-0011`).

---

## Validaciones

El constructor falla rápido si detecta:

- `ouId` que no inicia con `ou-`.
- `logicalName` repetidos.
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

Para incorporar las cuentas existentes al stack, el operador ejecuta:

```bash
cdk import SkorifyOrganizationStack
```

CDK CLI pide el ID físico de cada `CfnAccount` y de la OU; el operador los introduce manualmente:

| LogicalName | Tipo | Physical ID |
|---|---|---|
| (OU declarada en el stack) | `AWS::Organizations::OrganizationalUnit` | `ou-i8pg-d23ee4e4` |
| `SkorifyDevelopment` | `AWS::Organizations::Account` | `968306633562` |
| `SkorifyProduction` | `AWS::Organizations::Account` | `151646410766` |

`SkorifyStaging` (cuenta nueva) **no** se importa: CDK la crea con el primer `cdk deploy` posterior a los `cdk import`.

Antes de aceptar cualquier import, validar con `cdk diff` que no haya cambios destructivos.

---

## Referencias

- `ADR-INFRA-0002` — aislamiento por cuenta.
- `ADR-INFRA-0011` — Organizations en IaC.
- `docs/runbooks/oidc-bootstrap.md` — procedimiento de bootstrap completo.
