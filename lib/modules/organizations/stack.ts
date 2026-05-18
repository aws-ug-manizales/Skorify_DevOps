import * as cdk from 'aws-cdk-lib';
import { MANAGEMENT_ACCOUNT_ID, SKORIFY_ACCOUNTS, SKORIFY_OU } from '../../config/organizations-config';
import { OrganizationsModule } from './main';

/** Opciones para materializar el stack de Organization. */
export interface SkorifyOrganizationStackOptions {
  /** Cuenta activa según `process.env.CDK_DEFAULT_ACCOUNT`. */
  readonly currentAccount: string | undefined;

  /**
   * Si está activa la fase de import (cuentas que ya existen).
   * Lee `process.env.SKORIFY_ORG_IMPORT_PHASE === 'true'`.
   */
  readonly importPhase: boolean;
}

/**
 * Crea `SkorifyOrganizationStack` solo si la cuenta activa es la master.
 * Devuelve `undefined` desde DEV/STG/PROD para no contaminar
 * `cdk list`/`cdk diff --all`/`cdk deploy --all`.
 *
 * En fase import:
 * - Filtra el array a las cuentas marcadas `existing: true` (DEV, PROD).
 * - Pasa `forImport: true` al módulo (omite Tags y RoleName).
 * - Omite los stack-level tags (CFN los rechaza con
 *   "cannot modify or add [RoleArn, Tags]" durante el import).
 *
 * En fase normal (deploy):
 * - Incluye las 3 cuentas (DEV, STG, PROD).
 * - Aplica los tags al stack y a cada cuenta.
 */
export function maybeCreateSkorifyOrganizationStack(
  app: cdk.App,
  opts: SkorifyOrganizationStackOptions,
): cdk.Stack | undefined {
  if (opts.currentAccount !== MANAGEMENT_ACCOUNT_ID) {
    return undefined;
  }

  const stack = new cdk.Stack(app, 'SkorifyOrganizationStack', {
    stackName: 'skorify-organization',
    description: 'Organization, OU Skorify y cuentas miembro (ADR-INFRA-0011).',
    env: {
      account: MANAGEMENT_ACCOUNT_ID,
      region: 'us-east-1',
    },
    tags: opts.importPhase
      ? undefined
      : {
          Project: 'Skorify_Infraestructura',
          ManagedBy: 'AWS CDK',
          Stack: 'organization',
        },
  });

  const accounts = opts.importPhase
    ? SKORIFY_ACCOUNTS.filter((a) => a.existing)
    : SKORIFY_ACCOUNTS;

  new OrganizationsModule(stack, 'SkorifyAccounts', {
    ou: SKORIFY_OU,
    accounts,
    forImport: opts.importPhase,
  });

  return stack;
}
