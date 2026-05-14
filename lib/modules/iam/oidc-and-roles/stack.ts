import * as cdk from 'aws-cdk-lib';
import {
  GITHUB_ORG,
  rolesForAccount,
  SKORIFY_ACCOUNT_TO_ENV,
} from '../../../config/iam-roles-config';
import { MANAGEMENT_ACCOUNT_ID } from '../../../config/organizations-config';
import { OidcAndRolesModule } from './main';

/** Opciones para materializar `SkorifyBootstrapStack`. */
export interface SkorifyBootstrapStackOptions {
  /** Cuenta activa según `process.env.CDK_DEFAULT_ACCOUNT`. */
  readonly currentAccount: string | undefined;
}

/**
 * Crea `SkorifyBootstrapStack` con el OIDC provider de GitHub y los
 * roles aplicables a la cuenta activa. La cuenta master recibe los
 * roles `awsug-pagina-web-deploy` y `awsug-pagina-web-infra`; cada
 * cuenta workload (DEV/STG/PROD) recibe los 6 roles Skorify.
 *
 * Devuelve `undefined` si la cuenta activa no está modelada en
 * `SKORIFY_ACCOUNT_TO_ENV` ni es la master, para no contaminar
 * `cdk list`/`cdk deploy --all` desde sesiones que no son de la org.
 *
 * El stack está fijado a la cuenta activa con `env.account`. Si alguien
 * lo despliega contra otra cuenta (cambio de credenciales), CDK falla
 * por cuenta no coincidente.
 */
export function maybeCreateSkorifyBootstrapStack(
  app: cdk.App,
  opts: SkorifyBootstrapStackOptions,
): cdk.Stack | undefined {
  const account = opts.currentAccount;
  if (!account) {
    return undefined;
  }

  const roles = rolesForAccount(account);
  if (!roles) {
    return undefined;
  }

  const env = account === MANAGEMENT_ACCOUNT_ID ? 'master' : SKORIFY_ACCOUNT_TO_ENV[account];

  const stack = new cdk.Stack(app, 'SkorifyBootstrapStack', {
    stackName: 'skorify-bootstrap',
    description: `OIDC provider GitHub + roles federados para ${env} (ADR-INFRA-0005).`,
    env: {
      account,
      region: 'us-east-1',
    },
    tags: {
      Project: 'Skorify_Infraestructura',
      ManagedBy: 'AWS CDK',
      Stack: 'bootstrap',
      Environment: env,
    },
  });

  new OidcAndRolesModule(stack, 'GitHubFederation', {
    githubOrg: GITHUB_ORG,
    roles,
  });

  return stack;
}
