/**
 * Configuración de la AWS Organization de Skorify.
 *
 * **Esta es la fuente de verdad de la topología de la organización.** Cualquier
 * cambio (agregar cuenta, mover de OU, renombrar) pasa por PR a este archivo
 * con aprobación de los tres líderes según `CODEOWNERS`. Por eso vive como
 * constante TypeScript versionada, no en SSM Parameter Store: SSM permitiría
 * mutar la estructura sin code review, lo que rompe el modelo de gobernanza
 * decidido en `ADR-INFRA-0011`.
 *
 * Ámbito:
 * - Solo cuentas workload bajo la OU `Skorify` (DEV, STG, PROD).
 * - **No incluye la cuenta de gestión** (`746669207643`, AWS UG Manizales): ese
 *   activo no se modela como `CfnAccount` (ver `OrganizationsModule`).
 * - **No incluye `Skorify-staggin`** (`779599553264`, suspendida): deuda técnica
 *   de cierre, queda fuera del template hasta `aws organizations close-account`.
 */

import type { OrganizationAccountDefinition } from '../modules/organizations/main';

// ============================================================
// Identificadores de la Organization (no se gestionan desde código)
// ============================================================

/** ID de la `AWS::Organizations::Organization`. */
export const ORGANIZATION_ID = 'o-y5zmep6ibt';

/** ID del root de la organización. */
export const ROOT_ID = 'r-i8pg';

/** ID de la OU `Skorify` que agrupa las cuentas workload. */
export const OU_SKORIFY_ID = 'ou-i8pg-d23ee4e4';

/**
 * ID de la cuenta de gestión. Se documenta para referencia operativa
 * (runbooks, scripts), pero **no se usa como `CfnAccount`** en ningún stack.
 */
export const MANAGEMENT_ACCOUNT_ID = '746669207643';

// ============================================================
// Cuentas workload bajo la OU Skorify
// ============================================================

/**
 * Cuentas que el módulo `OrganizationsModule` administra.
 *
 * Estado al 2026-05-09:
 * - `SkorifyDevelopment` y `SkorifyProduction` ya existen en AWS y se
 *   incorporan al stack vía `cdk import` (ver runbook).
 * - `SkorifyStaging` es nueva: CDK la crea con `CreateAccount` en el primer
 *   `cdk deploy` posterior al import. El email usa el alias `+skorify-stg@`
 *   porque `+skorify-staging@` está tomado por la cuenta suspendida y AWS no
 *   lo libera hasta 90 días después del cierre definitivo.
 */
export const SKORIFY_ACCOUNTS: OrganizationAccountDefinition[] = [
  {
    logicalName: 'SkorifyDevelopment',
    accountName: 'Skorify-development',
    email: 'awsugmanizales+skorify-dev@gmail.com',
    environment: 'dev',
    owner: '@Mateo454',
  },
  {
    logicalName: 'SkorifyStaging',
    accountName: 'Skorify-staging',
    email: 'awsugmanizales+skorify-stg@gmail.com',
    environment: 'stg',
    owner: '@Mateo454',
  },
  {
    logicalName: 'SkorifyProduction',
    accountName: 'Skorify-production',
    email: 'awsugmanizales+skorify-prod@gmail.com',
    environment: 'prd',
    owner: '@Mateo454',
  },
];
