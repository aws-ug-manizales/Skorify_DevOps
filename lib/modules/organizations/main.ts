import * as organizations from 'aws-cdk-lib/aws-organizations';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

// ============================================================
// Tipos compartidos
// ============================================================

/** Ambientes Skorify. La master no aparece: no se modela como CfnAccount (ver ADR-INFRA-0011). */
export type SkorifyEnvironment = 'dev' | 'stg' | 'prd';

/**
 * Cuenta workload bajo la OU Skorify. DEV y PROD ya existen y entran con
 * `cdk import`; STG la crea CDK. La distinción es operativa, el código no
 * la conoce.
 */
export interface OrganizationAccountDefinition {
  /** ID lógico (CDK construct ID y clave en `accounts`). Único. */
  readonly logicalName: string;

  /** AccountName en Organizations. Convención: `Skorify-{environment}`. */
  readonly accountName: string;

  /** Email único globalmente. Convención: `awsugmanizales+skorify-{alias}@gmail.com`. */
  readonly email: string;

  readonly environment: SkorifyEnvironment;

  /** Handle de GitHub del responsable. Va como tag `Owner`. */
  readonly owner: string;

  /** Override del tag `Project` (default: `Skorify`). */
  readonly project?: string;

  /**
   * Rol que Organizations crea en cuentas nuevas. Default:
   * `OrganizationAccountAccessRole`. **Solo aplica a cuentas con
   * `existing: false`**: AWS lo marca como inmutable, intentar
   * declararlo en cuentas existentes hace que CFN falle el update con
   * "You cannot update IAM role name."
   */
  readonly roleName?: string;

  /**
   * Marca si la cuenta ya existe en AWS. Las que tienen `existing: true`
   * (DEV, PROD) son las que entran con `cdk import` en la Fase 1. Las
   * que no (STG) solo se materializan en la Fase 2 (`cdk deploy`). El
   * filtrado lo hace `lib/main.ts` según la env var
   * `SKORIFY_ORG_IMPORT_PHASE`. El módulo solo recibe el array ya
   * filtrado y no toma decisiones operativas.
   */
  readonly existing?: boolean;
}

// ============================================================
// Props del módulo
// ============================================================

/**
 * OU bajo la cual viven las cuentas workload. Se modela como
 * `CfnOrganizationalUnit` para que sea importable, taggeable y auditable.
 * En Skorify ya existe (`ou-i8pg-d23ee4e4`) y entra con `cdk import`.
 */
export interface OrganizationalUnitDefinition {
  /** ID lógico (CDK construct ID y clave en el output `ou`). */
  readonly logicalName: string;

  /** Name de la OU en Organizations. En Skorify: `Skorify`. */
  readonly name: string;

  /** Padre directo. Root → `r-XXXX`; OU anidada → `ou-XXXX-YYYYYYYY`. */
  readonly parentId: string;
}

export interface OrganizationsModuleProps {
  /**
   * OU contenedora. Las cuentas referencian su `ref`, no un string,
   * para que el grafo CloudFormation quede consistente.
   */
  readonly ou: OrganizationalUnitDefinition;

  /**
   * Cuentas workload. La master no va aquí (no se modela como CfnAccount).
   * `Skorify-staggin` tampoco: queda fuera del template hasta que se
   * cierre con `aws organizations close-account` (ver ADR-INFRA-0011).
   */
  readonly accounts: OrganizationAccountDefinition[];

  /**
   * Si `true`, emite el template mínimo para `cdk import`: omite `Tags`
   * y `RoleName` en cada `CfnAccount`. CloudFormation rechaza el import
   * con `"As part of the import operation, you cannot modify or add
   * [RoleArn, Tags]"` si esos campos están declarados.
   *
   * Después del import, correr `cdk deploy` sin esta flag aplica los
   * tags y deja el `RoleName` igual. Default: `false`.
   */
  readonly forImport?: boolean;
}

// ============================================================
// OrganizationsModule
// ============================================================

/**
 * Módulo Organizations de Skorify.
 *
 * Crea o importa la OU `Skorify` y las cuentas workload bajo ella.
 * No modela la master, no crea la Organization, no define SCPs.
 * Los tags obligatorios (`Environment`, `Project`, `Owner`) salen del
 * `ADR-INFRA-0002`. `DeletionPolicy: Retain` por default: quitar una
 * cuenta del template no la cierra, solo la desasocia.
 *
 * Flujo operativo (dos fases, CloudFormation no permite mezclar):
 * 1. `cdk import`: la OU, DEV y PROD entran al stack con sus IDs físicos.
 * 2. `cdk deploy`: crea STG. Ver `docs/runbooks/oidc-bootstrap.md`.
 */
export class OrganizationsModule extends Construct {
  /** OU contenedora. `ref` resuelve al `ou-XXXX-YYYYYYYY`. */
  public readonly ou: organizations.CfnOrganizationalUnit;

  /** Cuentas indexadas por `logicalName`. `ref` resuelve al account ID. */
  public readonly accounts: Record<string, organizations.CfnAccount> = {};

  private readonly forImport: boolean;

  constructor(scope: Construct, id: string, props: OrganizationsModuleProps) {
    super(scope, id);

    this.validateProps(props);
    this.forImport = props.forImport ?? false;

    this.ou = this.createOu(props.ou);

    for (const definition of props.accounts) {
      this.accounts[definition.logicalName] = this.createAccount(definition, this.ou);
    }
  }

  // ============================================================
  // Validaciones
  // ============================================================

  /** Fail fast antes de tocar AWS. Reglas: parentId válido, name no vacío,
   *  logicalName/accountName/email únicos, email con forma `a@b.c`, owner no vacío. */
  private validateProps(props: OrganizationsModuleProps): void {
    if (!props.ou.parentId.startsWith('r-') && !props.ou.parentId.startsWith('ou-')) {
      throw new Error(
        `[OrganizationsModule] ou.parentId debe iniciar con "r-" (root) u "ou-" ` +
          `(OU anidada). Recibido: "${props.ou.parentId}".`,
      );
    }

    if (!props.ou.name.trim()) {
      throw new Error('[OrganizationsModule] ou.name no puede estar vacío.');
    }

    const logicalNames = [props.ou.logicalName, ...props.accounts.map((a) => a.logicalName)];
    if (new Set(logicalNames).size !== logicalNames.length) {
      throw new Error(
        '[OrganizationsModule] Todos los logicalName deben ser únicos (incluyendo el de la OU).',
      );
    }

    const accountNames = props.accounts.map((a) => a.accountName);
    if (new Set(accountNames).size !== accountNames.length) {
      throw new Error('[OrganizationsModule] Todos los accountName deben ser únicos.');
    }

    const emails = props.accounts.map((a) => a.email.toLowerCase());
    if (new Set(emails).size !== emails.length) {
      throw new Error(
        '[OrganizationsModule] Todos los email deben ser únicos (AWS exige unicidad global).',
      );
    }

    for (const account of props.accounts) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(account.email)) {
        throw new Error(
          `[OrganizationsModule] Email inválido en "${account.logicalName}": "${account.email}".`,
        );
      }

      if (!account.owner.trim()) {
        throw new Error(
          `[OrganizationsModule] La cuenta "${account.logicalName}" no tiene owner ` +
            `(tag obligatorio según ADR-INFRA-0002).`,
        );
      }
    }
  }

  // ============================================================
  // Helpers de construcción
  // ============================================================

  /** Crea el `CfnOrganizationalUnit` con `DeletionPolicy: Retain` declarado
   *  en el template (AWS resource import lo exige). La OU ya existe; el
   *  operador la incorpora con `cdk import`. El `ref` queda como
   *  `parentIds` de cada cuenta. */
  private createOu(definition: OrganizationalUnitDefinition): organizations.CfnOrganizationalUnit {
    const ou = new organizations.CfnOrganizationalUnit(this, definition.logicalName, {
      name: definition.name,
      parentId: definition.parentId,
    });
    ou.applyRemovalPolicy(RemovalPolicy.RETAIN);
    return ou;
  }

  /** Crea el `CfnAccount` con `DeletionPolicy: Retain` declarado. AWS
   *  resource import exige el atributo en el template; no basta con que
   *  CFN lo aplique en runtime. Quitar el recurso no cierra la cuenta
   *  (ver ADR-INFRA-0011). DEV/PROD entran con `cdk import`, STG la crea
   *  CDK con `cdk deploy`.
   *
   *  Tags: en modo `forImport` se omiten (CFN rechaza el import si están
   *  declarados con "cannot modify or add [RoleArn, Tags]"). En modo
   *  normal sí se aplican; CFN acepta agregar Tags como UPDATE.
   *
   *  RoleName: solo se declara si la cuenta NO existía (no `existing`).
   *  Para cuentas importadas, AWS Organizations marca `RoleName` como
   *  inmutable: el update falla con "You cannot update IAM role name."
   *  aunque el valor sea el mismo. En cuentas nuevas (STG), CDK lo deja
   *  fijo al crear, sin updates posteriores. */
  private createAccount(
    definition: OrganizationAccountDefinition,
    ou: organizations.CfnOrganizationalUnit,
  ): organizations.CfnAccount {
    const account = new organizations.CfnAccount(this, definition.logicalName, {
      accountName: definition.accountName,
      email: definition.email,
      parentIds: [ou.ref],
      ...(definition.existing
        ? {}
        : { roleName: definition.roleName ?? 'OrganizationAccountAccessRole' }),
      ...(this.forImport
        ? {}
        : {
            tags: [
              { key: 'Environment', value: definition.environment },
              { key: 'Project', value: definition.project ?? 'Skorify' },
              { key: 'Owner', value: definition.owner },
            ],
          }),
    });
    account.applyRemovalPolicy(RemovalPolicy.RETAIN);
    return account;
  }
}
