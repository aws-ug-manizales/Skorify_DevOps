/**
 * Matriz de roles IAM federados a GitHub OIDC, alineada con
 * ADR-INFRA-0005 y ADR-CICD-0003.
 *
 * Estructura: una función por contexto. El helper de stacks elige cuál
 * aplicar según la cuenta activa.
 *
 * Naming: `skorify-{dominio}-deploy` en cuentas Skorify;
 * `awsug-pagina-web-deploy` en master.
 *
 * `sub` patterns por ambiente (ADR-CICD-0003), en formato del `sub`
 * claim de GitHub (prefijo `ref:` para push/tag):
 * - dev: `ref:refs/heads/develop`
 * - stg: `ref:refs/heads/release/*`
 * - prd: `ref:refs/heads/main`, `ref:refs/heads/hotfix/*`
 * - master (Pagina_Web): `ref:refs/heads/main`
 * - ops-readonly: `ref:refs/heads/*` (workflows de SRE solo lectura)
 *
 * Excepción: los roles `-infra` (cdk/terraform apply de infra) se asumen
 * desde jobs que declaran un GitHub Environment, así que GitHub emite el
 * `sub` como `repo:ORG/REPO:environment:NAME` (no `ref:...`). Su trust
 * usa ese patrón; la restricción de rama y los required reviewers los
 * impone el Environment vía `deployment_branch_policy` y `required_reviewers`.
 * Ver https://docs.github.com/en/actions/reference/security/oidc#example-subject-claims
 */

import type { DeployRoleDefinition, GitHubSubPattern } from '../modules/iam/oidc-and-roles/main';
import {
  paginaWebDeployStatements,
  skorifyBackendDeployStatements,
  skorifyDataDeployStatements,
  skorifyDataInfraStatements,
  skorifyFrontendDeployStatements,
  skorifyFrontendInfraStatements,
  skorifyInfraDeployStatements,
  skorifyOpsReadonlyStatements,
  paginaWebInfraStatements,
} from '../modules/iam/oidc-and-roles/permissions';
import { MANAGEMENT_ACCOUNT_ID } from './organizations-config';

/** Org GitHub donde viven los repos. */
export const GITHUB_ORG = 'aws-ug-manizales';

/** Repos consumidores por dominio. */
export const REPOS = {
  paginaWeb: 'Pagina_Web',
  backend: 'Skorify_Backend',
  frontend: 'Skorify_Frontend',
  data: 'Skorify_Data',
  devops: 'Skorify_DevOps',
} as const;

/** Ambientes Skorify y su mapeo a cuenta. */
export type SkorifyAccountEnv = 'dev' | 'stg' | 'prd';

/** `sub` patterns aceptados por cada ambiente. */
const SUB_PATTERNS_BY_ENV: Record<SkorifyAccountEnv, GitHubSubPattern[]> = {
  dev: ['ref:refs/heads/develop'],
  stg: ['ref:refs/heads/release/*'],
  prd: ['ref:refs/heads/main', 'ref:refs/heads/hotfix/*'],
};

// ============================================================
// Roles en la cuenta master / AWS UG Manizales
// ============================================================

export function rolesForMaster(): DeployRoleDefinition[] {
  return [
    {
      logicalName: 'AwsUgPaginaWebDeploy',
      roleName: 'awsug-pagina-web-deploy',
      repoName: REPOS.paginaWeb,
      subPatterns: ['ref:refs/heads/main'],
      description: 'Deploy de assets del sitio AWS UG Manizales (S3 sync + CloudFront invalidate) desde Pagina_Web.',
      statements: paginaWebDeployStatements(),
    },
    {
      logicalName: 'AwsUgPaginaWebInfra',
      roleName: 'awsug-pagina-web-infra',
      repoName: REPOS.paginaWeb,
      // El job `terraform-apply` declara `environment: production`, así que
      // GitHub emite el sub como `...:environment:production`. El Environment
      // ya tiene required reviewers y branch policy de `main`; la trust solo
      // ata el rol a ese Environment.
      subPatterns: ['environment:production'],
      description: 'terraform apply de la infra de Pagina_Web (CloudFront, config del bucket, OAC, response headers policy), detrás del Environment production.',
      statements: paginaWebInfraStatements(),
    },
  ];
}

// ============================================================
// Roles en cuentas Skorify (DEV, STG, PROD)
// ============================================================

/**
 * Set de 6 roles para una cuenta workload Skorify: backend, frontend
 * (deploy de assets), frontend-infra (cdk deploy de la infra del
 * frontend), data, infra, ops-readonly. Los roles de deploy usan los
 * branch patterns del ambiente; `frontend-infra` usa `environment:${env}`
 * (el job lo declara) y `ops-readonly` acepta cualquier rama.
 */
export function rolesForSkorifyAccount(
  accountId: string,
  env: SkorifyAccountEnv,
): DeployRoleDefinition[] {
  const subPatterns = SUB_PATTERNS_BY_ENV[env];

  return [
    {
      logicalName: 'SkorifyBackendDeploy',
      roleName: 'skorify-backend-deploy',
      repoName: REPOS.backend,
      subPatterns,
      description: `Deploy de Skorify backend (SAM: Lambda + API Gateway) en cuenta ${env}.`,
      statements: skorifyBackendDeployStatements(accountId),
    },
    {
      logicalName: 'SkorifyFrontendDeploy',
      roleName: 'skorify-frontend-deploy',
      repoName: REPOS.frontend,
      subPatterns,
      description: `Sync de assets del frontend Skorify (next export a S3 + CloudFront invalidate) en cuenta ${env}.`,
      statements: skorifyFrontendDeployStatements(accountId),
    },
    {
      logicalName: 'SkorifyFrontendInfra',
      roleName: 'skorify-frontend-infra',
      repoName: REPOS.frontend,
      // El job `cdk-deploy-infra` declara `environment: ${env}`, así que el
      // sub que emite GitHub es `...:environment:${env}` (no `ref:...`). El
      // Environment impone los required reviewers y la branch policy.
      subPatterns: [`environment:${env}`],
      description: `cdk deploy de la infra del frontend Skorify (S3+CloudFront+OAC, ADR-INFRA-0003), detrás del Environment ${env}.`,
      statements: skorifyFrontendInfraStatements(accountId),
    },
    {
      logicalName: 'SkorifyDataDeploy',
      roleName: 'skorify-data-deploy',
      repoName: REPOS.data,
      subPatterns,
      description: `Deploy de Skorify data (migrations contra RDS) en cuenta ${env}.`,
      statements: skorifyDataDeployStatements(accountId),
    },
    {
      logicalName: 'SkorifyDataInfra',
      roleName: 'skorify-data-infra',
      repoName: REPOS.data,
      // El job `cdk-deploy-infra` declara `environment: ${env}`, así que el
      // sub que emite GitHub es `...:environment:${env}` (no `ref:...`). El
      // Environment impone los required reviewers y la branch policy.
      subPatterns: [`environment:${env}`],
      description: `cdk deploy de la infra del dominio data Skorify (RDS, VPC, KMS, Secrets) en cuenta ${env}, detrás del Environment ${env}.`,
      statements: skorifyDataInfraStatements(accountId),
    },
    {
      logicalName: 'SkorifyInfraDeploy',
      roleName: 'skorify-infra-deploy',
      repoName: REPOS.devops,
      subPatterns,
      description: `Deploy de Skorify infra (CDK general) en cuenta ${env}.`,
      statements: skorifyInfraDeployStatements(accountId),
    },
    {
      logicalName: 'SkorifyOpsReadonly',
      roleName: 'skorify-ops-readonly',
      repoName: REPOS.devops,
      // Ops lee desde cualquier rama del repo de DevOps (incluyendo
      // ramas de feature) porque son workflows de auditoría/consulta
      // que no escriben.
      subPatterns: ['ref:refs/heads/*'],
      description: `Lectura de CloudWatch/Logs/X-Ray para workflows de SRE en cuenta ${env}.`,
      statements: skorifyOpsReadonlyStatements(),
    },
  ];
}

// ============================================================
// Resolución de roles según la cuenta activa
// ============================================================

/**
 * Map de cuenta AWS → ambiente Skorify. La master no aparece aquí; tiene
 * su propio set de roles vía `rolesForMaster()`.
 */
export const SKORIFY_ACCOUNT_TO_ENV: Record<string, SkorifyAccountEnv> = {
  '968306633562': 'dev',
  '553284493694': 'stg',
  '151646410766': 'prd',
};

/**
 * Devuelve el set de roles aplicable a la cuenta activa, o `undefined`
 * si la cuenta no está en el modelo Skorify. La master usa su propio
 * set de Pagina_Web; las cuentas workload usan los 6 roles Skorify.
 */
export function rolesForAccount(accountId: string): DeployRoleDefinition[] | undefined {
  if (accountId === MANAGEMENT_ACCOUNT_ID) {
    return rolesForMaster();
  }
  const env = SKORIFY_ACCOUNT_TO_ENV[accountId];
  if (!env) {
    return undefined;
  }
  return rolesForSkorifyAccount(accountId, env);
}
