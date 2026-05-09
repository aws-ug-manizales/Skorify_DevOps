import * as organizations from 'aws-cdk-lib/aws-organizations';
import { Construct } from 'constructs';

// ============================================================
// Tipos compartidos
// ============================================================

/**
 * Ambientes Skorify reconocidos por el módulo.
 *
 * - `dev`, `stg`, `prd`: cuentas workload bajo la OU `Skorify`.
 *
 * La cuenta de gestión (master) **no** aparece aquí: este módulo no la
 * modela como `CfnAccount` porque `AWS::Organizations::Account` es el
 * recurso que representa cuentas miembro creadas o importadas bajo la
 * organización, y la master es la cuenta que la posee. Sus tags se
 * aplican fuera del stack (`aws organizations tag-resource` desde el
 * runbook). Ver ADR-INFRA-0011.
 */
export type SkorifyEnvironment = 'dev' | 'stg' | 'prd';

/**
 * Definición de una cuenta workload bajo la OU `Skorify`.
 *
 * Cada instancia de esta interfaz genera exactamente una cuenta
 * (`AWS::Organizations::Account`) en AWS. El módulo no decide cuáles
 * existen — solo materializa lo que esta definición declara.
 *
 * Las cuentas que ya existen (DEV, PROD) se incorporan al stack vía
 * `cdk import`; las nuevas (STG, en este momento) se crean al hacer
 * `cdk deploy`. La distinción "importada" vs "nueva" es operativa
 * (procedimiento descrito en `docs/runbooks/oidc-bootstrap.md`); el
 * código no la conoce.
 */
export interface OrganizationAccountDefinition {
  /**
   * ID lógico único dentro del módulo. Usado como CDK construct ID y
   * como clave en el mapa de outputs `accounts`. No puede repetirse.
   */
  readonly logicalName: string;

  /**
   * Nombre de la cuenta en AWS Organizations (`AccountName`).
   * Convención: `Skorify-{environment}` en kebab-case
   * (`Skorify-development`, `Skorify-staging`, `Skorify-production`).
   */
  readonly accountName: string;

  /**
   * Email único asociado a la cuenta. AWS exige unicidad global.
   * Convención: `awsugmanizales+skorify-{alias}@gmail.com`.
   * Cuando un alias está tomado se usa la forma corta acotada (caso
   * `staging` → `stg`).
   */
  readonly email: string;

  /** Ambiente Skorify al que pertenece la cuenta. */
  readonly environment: SkorifyEnvironment;

  /**
   * Handle GitHub del responsable principal. Se materializa como tag
   * `Owner` a nivel de cuenta.
   */
  readonly owner: string;

  /**
   * Valor del tag `Project`. Por defecto `Skorify`. Permite distinguir
   * en el rollup de costos cuando una cuenta tenga workloads de varios
   * proyectos (caso poco frecuente).
   */
  readonly project?: string;

  /**
   * Nombre del rol IAM que Organizations crea automáticamente en la
   * cuenta nueva y al cual la master puede asumir. Por defecto
   * `OrganizationAccountAccessRole`.
   *
   * No aplica a cuentas existentes importadas: el rol ya está creado.
   */
  readonly roleName?: string;
}

// ============================================================
// Props del módulo
// ============================================================

export interface OrganizationsModuleProps {
  /**
   * Lista de cuentas workload a gestionar.
   *
   * - Cada elemento genera (o importa) exactamente una cuenta.
   * - Todos los `logicalName`, `accountName` y `email` deben ser únicos.
   * - La cuenta de gestión (master) **no** se incluye aquí.
   * - La cuenta `Skorify-staggin` (suspendida, deuda técnica) **no** se
   *   incluye aquí; queda fuera del template hasta que se cierre vía
   *   `aws organizations close-account` (ver ADR-INFRA-0011).
   */
  readonly accounts: OrganizationAccountDefinition[];

  /**
   * ID de la OU bajo la cual se ubican todas las cuentas declaradas
   * (`ou-XXXX-YYYYYYYY`). En Skorify hoy es `ou-i8pg-d23ee4e4` (OU
   * `Skorify`).
   *
   * El recurso de la OU se asume **importado por el operador** previo a
   * `cdk deploy` con `cdk import`; este módulo solo lo referencia.
   */
  readonly ouId: string;
}

// ============================================================
// OrganizationsModule
// ============================================================

/**
 * Módulo de Organizations — Skorify Plataforma.
 *
 * Materializa las cuentas workload bajo la OU `Skorify` como recursos
 * `AWS::Organizations::Account`. Cubre tanto las cuentas existentes
 * (que entran al stack vía `cdk import`) como las nuevas (que CDK crea
 * con `CreateAccount` al hacer `cdk deploy`).
 *
 * Lo que **sí** hace:
 * - Crea o importa cuentas miembro con el `parentIds` de la OU `Skorify`.
 * - Aplica los tags obligatorios (`Environment`, `Project`, `Owner`)
 *   declarados en `ADR-INFRA-0002`.
 * - Mantiene `OrganizationAccountAccessRole` como rol de acceso por
 *   defecto.
 *
 * Lo que **no** hace, por decisión:
 * - No modela la cuenta de gestión como `CfnAccount`. Sus tags se
 *   aplican fuera del stack desde el runbook con
 *   `aws organizations tag-resource`. Ver ADR-INFRA-0011.
 * - No crea ni importa la `Organization` ni la OU. La Organization se
 *   asume preexistente; la OU se importa con `cdk import` por el
 *   operador antes de aplicar el stack.
 * - No define SCPs. Las políticas viven (en el futuro) bajo
 *   `lib/modules/organizations/scps/`, gestionadas por un PR aparte.
 *
 * Principios aplicados:
 * - Fail Fast: `validateProps` corre como primera acción; cualquier
 *   inconsistencia (logicalName/accountName/email duplicados, formato de
 *   email inválido, owner vacío) aborta antes de tocar AWS.
 * - Determinismo: agregar una cuenta es agregar un elemento al array
 *   `accounts` y abrir un PR. No hay caminos implícitos.
 * - DeletionPolicy: Retain por defecto en `AWS::Organizations::Account`
 *   (comportamiento de CloudFormation): remover una cuenta del template
 *   solo la desasocia del stack, no la cierra. Ver ADR-INFRA-0011 para
 *   el flujo de descomisión.
 */
export class OrganizationsModule extends Construct {
  /**
   * Mapa de cuentas creadas o importadas, indexado por `logicalName`.
   * El `ref` de cada `CfnAccount` retorna el ID de la cuenta una vez
   * resuelto por CloudFormation.
   */
  public readonly accounts: Record<string, organizations.CfnAccount> = {};

  constructor(scope: Construct, id: string, props: OrganizationsModuleProps) {
    super(scope, id);

    if (props.accounts.length === 0) {
      return;
    }

    this.validateProps(props);

    for (const definition of props.accounts) {
      this.accounts[definition.logicalName] = this.createAccount(definition, props.ouId);
    }
  }

  // ============================================================
  // Validaciones
  // ============================================================

  /**
   * Valida la coherencia de las props antes de tocar AWS.
   *
   * Reglas:
   * 1. `logicalName` únicos dentro del módulo.
   * 2. `accountName` únicos. AWS no exige unicidad de `AccountName` a
   *    nivel de Organization, pero es un olor a error tener dos.
   * 3. `email` únicos. AWS **sí** exige unicidad global de email; esta
   *    validación falla rápido para no descubrirlo en deploy.
   * 4. `email` con forma básica `local@dominio`. No es validación RFC,
   *    solo descarta typos obvios.
   * 5. `owner` no vacío. Sin owner no hay tag `Owner` y violamos
   *    `ADR-INFRA-0002`.
   * 6. `ouId` con prefijo `ou-`. Descarta confundir el ID de la OU con
   *    un account ID o un root ID.
   *
   * @throws {Error} Si alguna regla no se cumple.
   */
  private validateProps(props: OrganizationsModuleProps): void {
    if (!props.ouId.startsWith('ou-')) {
      throw new Error(
        `[OrganizationsModule] ouId debe iniciar con "ou-" (recibido: "${props.ouId}").`,
      );
    }

    const logicalNames = props.accounts.map((a) => a.logicalName);
    if (new Set(logicalNames).size !== logicalNames.length) {
      throw new Error('[OrganizationsModule] Todos los logicalName deben ser únicos.');
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

  /**
   * Construye un `CfnAccount` a partir de una definición.
   *
   * El recurso queda con `DeletionPolicy: Retain` (default de
   * `AWS::Organizations::Account`); removerlo del template no cierra la
   * cuenta. Ver ADR-INFRA-0011 §5 (ciclo de vida).
   *
   * Para cuentas existentes, el operador ejecuta `cdk import` y le
   * pasa el `accountId` real cuando CDK lo solicita interactivamente;
   * el output `Ref` resuelve a ese mismo ID después.
   */
  private createAccount(
    definition: OrganizationAccountDefinition,
    ouId: string,
  ): organizations.CfnAccount {
    return new organizations.CfnAccount(this, definition.logicalName, {
      accountName: definition.accountName,
      email: definition.email,
      parentIds: [ouId],
      roleName: definition.roleName ?? 'OrganizationAccountAccessRole',
      tags: [
        { key: 'Environment', value: definition.environment },
        { key: 'Project', value: definition.project ?? 'Skorify' },
        { key: 'Owner', value: definition.owner },
      ],
    });
  }
}
