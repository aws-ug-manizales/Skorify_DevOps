/**
 * Topología de la AWS Organization de Skorify. Fuente de verdad: cualquier
 * cambio pasa por PR + revisión de los 3 líderes (CODEOWNERS). No vive en
 * SSM porque eso saltaría el code review (ver ADR-INFRA-0011).
 *
 * Cubre solo cuentas workload bajo la OU `Skorify`. La master no se incluye
 * (no se modela como CfnAccount). `Skorify-staggin` tampoco (suspendida,
 * deuda técnica de cierre).
 */

import type {
  OrganizationAccountDefinition,
  OrganizationalUnitDefinition,
} from '../modules/organizations/main';

// ============================================================
// Identificadores de la Organization (referencia, no se gestionan)
// ============================================================

export const ORGANIZATION_ID = 'o-y5zmep6ibt';
export const ROOT_ID = 'r-i8pg';
export const OU_SKORIFY_ID = 'ou-i8pg-d23ee4e4';

/** Master / cuenta de gestión. No se modela como CfnAccount. */
export const MANAGEMENT_ACCOUNT_ID = '746669207643';

// ============================================================
// OU Skorify
// ============================================================

/** OU contenedora de los workloads. Ya existe; el operador la importa con `cdk import`. */
export const SKORIFY_OU: OrganizationalUnitDefinition = {
  logicalName: 'SkorifyOu',
  name: 'Skorify',
  parentId: ROOT_ID,
};

// ============================================================
// Cuentas workload bajo la OU Skorify
// ============================================================

/**
 * DEV y PROD ya existen y entran con `cdk import`. STG es nueva, la crea
 * `cdk deploy`. El email de STG usa `+skorify-stg@` porque `+skorify-staging@`
 * lo tiene la cuenta suspendida y AWS no lo libera hasta 90 días después del
 * cierre.
 */
export const SKORIFY_ACCOUNTS: OrganizationAccountDefinition[] = [
  {
    logicalName: 'SkorifyDevelopment',
    accountName: 'Skorify-development',
    email: 'awsugmanizales+skorify-dev@gmail.com',
    environment: 'dev',
    owner: '@Mateo454',
    existing: true,
  },
  {
    // ID real: 553284493694. Originalmente STG no existía y este config
    // pedía crearla con cdk deploy. Un deploy fallido (RoleName inmutable
    // en cuentas existentes) hizo rollback en CFN, pero AWS Organizations
    // ya había creado la cuenta async. Quedó huérfana y se incorpora con
    // cdk import como las demás.
    logicalName: 'SkorifyStaging',
    accountName: 'Skorify-staging',
    email: 'awsugmanizales+skorify-stg@gmail.com',
    environment: 'stg',
    owner: '@Mateo454',
    existing: true,
  },
  {
    logicalName: 'SkorifyProduction',
    accountName: 'Skorify-production',
    email: 'awsugmanizales+skorify-prod@gmail.com',
    environment: 'prd',
    owner: '@Mateo454',
    existing: true,
  },
];
