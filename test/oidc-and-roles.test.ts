import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as iam from 'aws-cdk-lib/aws-iam';
import {
  DeployRoleDefinition,
  OidcAndRolesModule,
} from '../lib/modules/iam/oidc-and-roles/main';
import { maybeCreateSkorifyBootstrapStack } from '../lib/modules/iam/oidc-and-roles/stack';
import {
  GITHUB_ORG,
  REPOS,
  rolesForMaster,
  rolesForSkorifyAccount,
  SKORIFY_ACCOUNT_TO_ENV,
} from '../lib/config/iam-roles-config';
import { MANAGEMENT_ACCOUNT_ID } from '../lib/config/organizations-config';

// ============================================================
// Fixtures y helpers
// ============================================================

const paginaWebRole: DeployRoleDefinition = {
  logicalName: 'PaginaWebDeploy',
  roleName: 'awsug-pagina-web-deploy',
  repoName: 'Pagina_Web',
  subPatterns: ['ref:refs/heads/main'],
  statements: [
    new iam.PolicyStatement({
      actions: ['s3:ListBucket'],
      resources: ['arn:aws:s3:::web-aws-group-manizales'],
    }),
  ],
};

function makeStack(id: string): cdk.Stack {
  const app = new cdk.App();
  return new cdk.Stack(app, id);
}

interface RoleResource {
  Type: string;
  Properties: {
    RoleName?: string;
    AssumeRolePolicyDocument: {
      Statement: Array<{
        Action: string;
        Condition: {
          StringEquals: Record<string, string>;
          StringLike: Record<string, string[]>;
        };
      }>;
    };
  };
}

/** Roles IAM del template, excluyendo el rol auto-generado del custom resource del OIDC provider. */
function deployRoleNames(template: Template, prefix: string): string[] {
  const all = template.findResources('AWS::IAM::Role') as Record<string, RoleResource>;
  return Object.values(all)
    .map((r) => r.Properties.RoleName)
    .filter((name): name is string => typeof name === 'string' && name.startsWith(prefix))
    .sort();
}

/** Primer rol con `RoleName` definido (los de deploy lo tienen; el del custom resource no). */
function firstNamedRole(template: Template): RoleResource {
  const all = template.findResources('AWS::IAM::Role') as Record<string, RoleResource>;
  const named = Object.values(all).find((r) => typeof r.Properties.RoleName === 'string');
  if (!named) throw new Error('No se encontró ningún rol con RoleName en el template');
  return named;
}

// ============================================================
// Construct: OidcAndRolesModule
// ============================================================

describe('OidcAndRolesModule', () => {
  test('crea el OIDC provider y un rol por cada definición', () => {
    const stack = makeStack('TestConstruct');
    new OidcAndRolesModule(stack, 'GitHubFederation', {
      githubOrg: 'aws-ug-manizales',
      roles: [paginaWebRole],
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs('Custom::AWSCDKOpenIdConnectProvider', 1);
    expect(deployRoleNames(template, 'awsug-')).toEqual(['awsug-pagina-web-deploy']);
  });

  test('trust policy condiciona aud y sub al repo + pattern', () => {
    const stack = makeStack('TestTrust');
    new OidcAndRolesModule(stack, 'GitHubFederation', {
      githubOrg: 'aws-ug-manizales',
      roles: [paginaWebRole],
    });

    const statement = firstNamedRole(Template.fromStack(stack)).Properties
      .AssumeRolePolicyDocument.Statement[0];

    expect(statement.Action).toBe('sts:AssumeRoleWithWebIdentity');
    expect(statement.Condition.StringEquals).toEqual({
      'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
    });
    expect(statement.Condition.StringLike).toEqual({
      'token.actions.githubusercontent.com:sub': [
        'repo:aws-ug-manizales/Pagina_Web:ref:refs/heads/main',
      ],
    });
  });

  test('soporta múltiples sub patterns', () => {
    const stack = makeStack('TestMultiSub');
    new OidcAndRolesModule(stack, 'GitHubFederation', {
      githubOrg: 'aws-ug-manizales',
      roles: [
        {
          ...paginaWebRole,
          repoName: 'Skorify_Backend',
          subPatterns: ['ref:refs/heads/main', 'ref:refs/heads/hotfix/*'],
        },
      ],
    });

    const statement = firstNamedRole(Template.fromStack(stack)).Properties
      .AssumeRolePolicyDocument.Statement[0];

    expect(statement.Condition.StringLike['token.actions.githubusercontent.com:sub']).toEqual([
      'repo:aws-ug-manizales/Skorify_Backend:ref:refs/heads/main',
      'repo:aws-ug-manizales/Skorify_Backend:ref:refs/heads/hotfix/*',
    ]);
  });

  test('soporta sub pattern de environment y de pull_request', () => {
    const stack = makeStack('TestEnvPr');
    new OidcAndRolesModule(stack, 'GitHubFederation', {
      githubOrg: 'aws-ug-manizales',
      roles: [
        {
          ...paginaWebRole,
          repoName: 'Skorify_Backend',
          subPatterns: ['environment:production', 'pull_request'],
        },
      ],
    });

    const subs = firstNamedRole(Template.fromStack(stack)).Properties.AssumeRolePolicyDocument
      .Statement[0].Condition.StringLike['token.actions.githubusercontent.com:sub'];
    expect(subs).toEqual([
      'repo:aws-ug-manizales/Skorify_Backend:environment:production',
      'repo:aws-ug-manizales/Skorify_Backend:pull_request',
    ]);
  });

  test('inline policy contiene los statements declarados', () => {
    const stack = makeStack('TestPolicy');
    new OidcAndRolesModule(stack, 'GitHubFederation', {
      githubOrg: 'aws-ug-manizales',
      roles: [paginaWebRole],
    });

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {
      Policies: Match.arrayWith([
        Match.objectLike({
          PolicyName: 'deploy',
          PolicyDocument: Match.objectLike({
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: 's3:ListBucket',
                Resource: 'arn:aws:s3:::web-aws-group-manizales',
              }),
            ]),
          }),
        }),
      ]),
    });
  });

  test('expone provider y roles como propiedades públicas', () => {
    const stack = makeStack('TestOutputs');
    const module = new OidcAndRolesModule(stack, 'GitHubFederation', {
      githubOrg: 'aws-ug-manizales',
      roles: [paginaWebRole],
    });

    expect(module.provider).toBeDefined();
    expect(Object.keys(module.roles)).toEqual(['PaginaWebDeploy']);
  });
});

// ============================================================
// Validaciones
// ============================================================

describe('OidcAndRolesModule: validaciones', () => {
  test('rechaza githubOrg vacío', () => {
    const stack = makeStack('TestEmptyOrg');
    expect(
      () =>
        new OidcAndRolesModule(stack, 'GitHubFederation', {
          githubOrg: '   ',
          roles: [paginaWebRole],
        }),
    ).toThrow(/githubOrg no puede estar vacío/);
  });

  test('rechaza logicalName duplicados', () => {
    const stack = makeStack('TestDupLogical');
    expect(
      () =>
        new OidcAndRolesModule(stack, 'GitHubFederation', {
          githubOrg: 'aws-ug-manizales',
          roles: [paginaWebRole, { ...paginaWebRole, roleName: 'otro' }],
        }),
    ).toThrow(/logicalName deben ser únicos/);
  });

  test('rechaza roleName duplicados', () => {
    const stack = makeStack('TestDupRoleName');
    expect(
      () =>
        new OidcAndRolesModule(stack, 'GitHubFederation', {
          githubOrg: 'aws-ug-manizales',
          roles: [paginaWebRole, { ...paginaWebRole, logicalName: 'Otro' }],
        }),
    ).toThrow(/roleName deben ser únicos/);
  });

  test('rechaza rol sin subPatterns', () => {
    const stack = makeStack('TestNoSubs');
    expect(
      () =>
        new OidcAndRolesModule(stack, 'GitHubFederation', {
          githubOrg: 'aws-ug-manizales',
          roles: [{ ...paginaWebRole, subPatterns: [] }],
        }),
    ).toThrow(/no declara subPatterns/);
  });

  test('rechaza rol sin statements', () => {
    const stack = makeStack('TestNoStatements');
    expect(
      () =>
        new OidcAndRolesModule(stack, 'GitHubFederation', {
          githubOrg: 'aws-ug-manizales',
          roles: [{ ...paginaWebRole, statements: [] }],
        }),
    ).toThrow(/no declara statements/);
  });

  test('rechaza repoName que incluye la org', () => {
    const stack = makeStack('TestRepoWithOrg');
    expect(
      () =>
        new OidcAndRolesModule(stack, 'GitHubFederation', {
          githubOrg: 'aws-ug-manizales',
          roles: [{ ...paginaWebRole, repoName: 'aws-ug-manizales/Pagina_Web' }],
        }),
    ).toThrow(/no debe incluir la org/);
  });
});

// ============================================================
// Config: matriz de roles
// ============================================================

describe('iam-roles-config: matriz de roles', () => {
  test('rolesForMaster contiene awsug-pagina-web-deploy (rama) y awsug-pagina-web-infra (environment)', () => {
    const roles = rolesForMaster();
    const names = roles.map((r) => r.roleName).sort();
    expect(names).toEqual(['awsug-pagina-web-deploy', 'awsug-pagina-web-infra']);
    for (const role of roles) {
      expect(role.repoName).toBe(REPOS.paginaWeb);
    }
    // assets-only: trust por rama (main).
    const deploy = roles.find((r) => r.roleName === 'awsug-pagina-web-deploy')!;
    expect(deploy.subPatterns).toEqual(['ref:refs/heads/main']);
    // infra: trust por GitHub Environment, el job declara `environment: production`.
    const infra = roles.find((r) => r.roleName === 'awsug-pagina-web-infra')!;
    expect(infra.subPatterns).toEqual(['environment:production']);
  });

  test('awsug-pagina-web-infra tiene acceso al bucket de state y a CloudFront, sin tocar objetos S3', () => {
    const infra = rolesForMaster().find((r) => r.roleName === 'awsug-pagina-web-infra')!;
    const json = infra.statements.map((s) => s.toStatementJson() as { Sid?: string; Action: string | string[]; Resource: string | string[] });
    const sids = json.map((s) => s.Sid);

    expect(sids).toEqual(
      expect.arrayContaining([
        'TerraformStateBucket',
        'TerraformStateObjects',
        'PaginaWebBucketConfig',
        'CloudFrontInfraGlobal',
        'CloudFrontInfraResources',
        'AcmRead',
      ]),
    );

    // El statement del bucket de Pagina_Web es sobre el bucket, no sobre objetos.
    const bucketCfg = json.find((s) => s.Sid === 'PaginaWebBucketConfig')!;
    const bucketResources = Array.isArray(bucketCfg.Resource) ? bucketCfg.Resource : [bucketCfg.Resource];
    expect(bucketResources).toContain('arn:aws:s3:::web-aws-group-manizales');
    expect(bucketResources.every((r: string) => !r.endsWith('/*'))).toBe(true);

    // Las acciones cloudfront:Create*/List* sin resource type van con Resource "*".
    const cfGlobal = json.find((s) => s.Sid === 'CloudFrontInfraGlobal')!;
    const cfActions = Array.isArray(cfGlobal.Action) ? cfGlobal.Action : [cfGlobal.Action];
    expect(cfActions).toEqual(expect.arrayContaining(['cloudfront:CreateDistribution', 'cloudfront:ListDistributions']));
    expect(cfGlobal.Resource).toBe('*');
    // El resto de cloudfront sí va con ARNs específicos.
    const cfRes = json.find((s) => s.Sid === 'CloudFrontInfraResources')!;
    const cfResArns = Array.isArray(cfRes.Resource) ? cfRes.Resource : [cfRes.Resource];
    expect(cfResArns.every((r: string) => r.startsWith('arn:aws:cloudfront::'))).toBe(true);
  });

  test('rolesForSkorifyAccount produce los 7 roles del dominio', () => {
    const roles = rolesForSkorifyAccount('968306633562', 'dev');
    const names = roles.map((r) => r.roleName).sort();
    expect(names).toEqual([
      'skorify-backend-deploy',
      'skorify-data-deploy',
      'skorify-data-infra',
      'skorify-frontend-deploy',
      'skorify-frontend-infra',
      'skorify-infra-deploy',
      'skorify-ops-readonly',
    ]);
  });

  const backendResourcesFor = (accountId: string, env: 'dev' | 'stg' | 'prd') => {
    const roles = rolesForSkorifyAccount(accountId, env);
    const backend = roles.find((r) => r.roleName === 'skorify-backend-deploy')!;
    const json = backend.statements.map((s) => s.toStatementJson() as { Sid?: string; Resource: string | string[] });
    return (sid: string) => {
      const statement = json.find((s) => s.Sid === sid)!;
      return Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource];
    };
  };

  test('skorify-backend-deploy cubre ambas convenciones de nombre (skorify-backend-* y Skorify-Backend-*)', () => {
    const resourcesFor = backendResourcesFor('968306633562', 'dev');
    expect(resourcesFor('CloudFormationBackendStacks')).toContain(
      'arn:aws:cloudformation:*:968306633562:stack/Skorify-Backend-*/*',
    );
    expect(resourcesFor('LambdaBackendFunctions')).toContain(
      'arn:aws:lambda:*:968306633562:function:Skorify-Backend-*',
    );
    expect(resourcesFor('BackendLogs')).toContain(
      'arn:aws:logs:*:968306633562:log-group:/aws/lambda/Skorify-Backend-*',
    );
    expect(resourcesFor('BackendIamRoles')).toContain(
      'arn:aws:iam::968306633562:role/Skorify-Backend-*',
    );
  });

  test('skorify-backend-deploy acota SSM/Secrets/policy al entorno (dev) y mapea prd->prod', () => {
    const dev = backendResourcesFor('968306633562', 'dev');
    expect(dev('SsmPlatformParamsRead')).toContain('arn:aws:ssm:*:968306633562:parameter/skorify/dev/*');
    expect(dev('SecretsManagerPlatformRead')).toContain('arn:aws:secretsmanager:*:968306633562:secret:skorify/dev/*');
    expect(dev('BackendManagedPolicy')).toContain('arn:aws:iam::968306633562:policy/skorify-dev-*');

    const prd = backendResourcesFor('151646410766', 'prd');
    expect(prd('SsmPlatformParamsRead')).toContain('arn:aws:ssm:*:151646410766:parameter/skorify/prod/*');
    expect(prd('SecretsManagerPlatformRead')).toContain('arn:aws:secretsmanager:*:151646410766:secret:skorify/prod/*');
    expect(prd('BackendManagedPolicy')).toContain('arn:aws:iam::151646410766:policy/skorify-prod-*');
  });

  test('skorify-frontend-deploy es assets-only; skorify-frontend-infra gestiona la infra', () => {
    const roles = rolesForSkorifyAccount('968306633562', 'dev');
    const deploy = roles.find((r) => r.roleName === 'skorify-frontend-deploy')!;
    const infra = roles.find((r) => r.roleName === 'skorify-frontend-infra')!;

    const deploySids = deploy.statements.map((s) => (s.toStatementJson() as { Sid?: string }).Sid);
    // deploy: solo S3 sobre el bucket + CloudFront invalidate. Nada de cloudformation ni crear infra.
    expect(deploySids.sort()).toEqual([
      'InvalidateFrontendDistribution',
      'ListFrontendBucket',
      'WriteFrontendBucketObjects',
    ]);

    const infraJson = infra.statements.map((s) => s.toStatementJson() as { Sid?: string; Action: string | string[]; Resource: string | string[] });
    const infraSids = infraJson.map((s) => s.Sid);
    expect(infraSids).toEqual(
      expect.arrayContaining([
        'AssumeCdkBootstrapRoles',
        'CloudFormationFrontendStacks',
        'FrontendBucketConfig',
        'CloudFrontFrontendGlobal',
        'CloudFrontFrontendResources',
        'Route53Frontend',
        'AcmFrontend',
        'CdkAssetsFrontendInfra',
      ]),
    );
    // El statement del bucket del infra-deploy es sobre el bucket, no sobre objetos.
    const bucketCfg = infraJson.find((s) => s.Sid === 'FrontendBucketConfig')!;
    const resources = Array.isArray(bucketCfg.Resource) ? bucketCfg.Resource : [bucketCfg.Resource];
    expect(resources.every((r: string) => !r.endsWith('/*'))).toBe(true);
    // cloudfront:Create*/List* (sin resource type) van con Resource "*"; el resto con ARN.
    const cfGlobal = infraJson.find((s) => s.Sid === 'CloudFrontFrontendGlobal')!;
    expect(cfGlobal.Resource).toBe('*');
    const cfRes = infraJson.find((s) => s.Sid === 'CloudFrontFrontendResources')!;
    const cfResArns = Array.isArray(cfRes.Resource) ? cfRes.Resource : [cfRes.Resource];
    expect(cfResArns.every((r: string) => r.startsWith('arn:aws:cloudfront::'))).toBe(true);
  });

  test('sub pattern es ref:refs/heads/develop en dev', () => {
    const roles = rolesForSkorifyAccount('968306633562', 'dev');
    const backend = roles.find((r) => r.roleName === 'skorify-backend-deploy')!;
    expect(backend.subPatterns).toEqual(['ref:refs/heads/develop']);
  });

  test('sub pattern es ref:refs/heads/release/* en stg', () => {
    const roles = rolesForSkorifyAccount('553284493694', 'stg');
    const backend = roles.find((r) => r.roleName === 'skorify-backend-deploy')!;
    expect(backend.subPatterns).toEqual(['ref:refs/heads/release/*']);
  });

  test('sub pattern es main + hotfix/* en prd', () => {
    const roles = rolesForSkorifyAccount('151646410766', 'prd');
    const backend = roles.find((r) => r.roleName === 'skorify-backend-deploy')!;
    expect(backend.subPatterns).toEqual([
      'ref:refs/heads/main',
      'ref:refs/heads/hotfix/*',
    ]);
  });

  test('ops-readonly acepta cualquier rama (workflows de SRE)', () => {
    const roles = rolesForSkorifyAccount('968306633562', 'dev');
    const ops = roles.find((r) => r.roleName === 'skorify-ops-readonly')!;
    expect(ops.subPatterns).toEqual(['ref:refs/heads/*']);
  });

  test('skorify-data-infra usa sub por environment y tiene AssumeCdkBootstrapRoles', () => {
    for (const [account, env] of Object.entries(SKORIFY_ACCOUNT_TO_ENV)) {
      const roles = rolesForSkorifyAccount(account, env);
      const infra = roles.find((r) => r.roleName === 'skorify-data-infra')!;
      expect(infra.subPatterns).toEqual([`environment:${env}`]);
      expect(infra.repoName).toBe(REPOS.data);

      const json = infra.statements.map((s) => s.toStatementJson() as { Sid?: string; Action: string | string[]; Resource: string | string[] });
      const sids = json.map((s) => s.Sid);
      expect(sids).toEqual(
        expect.arrayContaining([
          'AssumeCdkBootstrapRoles',
          'CloudFormationDataInfraStacks',
          'CdkAssetsDataInfra',
          'IamDataInfraRoles',
          'RdsDataInfraManage',
          'SecretsManagerDataInfra',
          'LambdaDataInfra',
          'EventBridgeDataInfra',
          'SqsDataInfra',
          'StepFunctionsDataInfra',
          'DynamoDbDataInfra',
        ]),
      );

      // Asegura que asume los roles bootstrap de la cuenta correcta.
      const assume = json.find((s) => s.Sid === 'AssumeCdkBootstrapRoles')!;
      const resources = Array.isArray(assume.Resource) ? assume.Resource : [assume.Resource];
      expect(resources).toEqual([`arn:aws:iam::${account}:role/cdk-hnb659fds-*-${account}-*`]);
    }
  });

  test('skorify-frontend-infra usa sub por environment, no por rama', () => {
    for (const [account, env] of Object.entries(SKORIFY_ACCOUNT_TO_ENV)) {
      const roles = rolesForSkorifyAccount(account, env);
      const infra = roles.find((r) => r.roleName === 'skorify-frontend-infra')!;
      expect(infra.subPatterns).toEqual([`environment:${env}`]);
      // El de assets sí va por rama.
      const deploy = roles.find((r) => r.roleName === 'skorify-frontend-deploy')!;
      expect(deploy.subPatterns.every((p) => p.startsWith('ref:refs/heads/'))).toBe(true);
    }
  });

  test('todas las cuentas Skorify están en el map de cuenta a env', () => {
    expect(SKORIFY_ACCOUNT_TO_ENV).toEqual({
      '968306633562': 'dev',
      '553284493694': 'stg',
      '151646410766': 'prd',
    });
  });

  test('GITHUB_ORG es aws-ug-manizales', () => {
    expect(GITHUB_ORG).toBe('aws-ug-manizales');
  });

  test('los repoName de la matriz no incluyen la org', () => {
    const allRoles = [
      ...rolesForMaster(),
      ...rolesForSkorifyAccount('968306633562', 'dev'),
    ];
    for (const role of allRoles) {
      expect(role.repoName).not.toContain('/');
    }
  });

  test('skorify-infra-deploy puede asumir los roles bootstrap cdk-hnb659fds-* y cubre el stack skorify-infra', () => {
    const roles = rolesForSkorifyAccount('968306633562', 'dev');
    const infra = roles.find((r) => r.roleName === 'skorify-infra-deploy')!;
    const json = infra.statements.map((s) => s.toStatementJson());

    // sts:AssumeRole hacia los roles bootstrap.
    const assume = json.find((s: { Sid?: string }) => s.Sid === 'AssumeCdkBootstrapRoles');
    expect(assume).toBeDefined();
    expect(assume!.Action).toBe('sts:AssumeRole');
    expect(assume!.Resource).toContain('arn:aws:iam::968306633562:role/cdk-hnb659fds-*-968306633562-*');

    // cloudformation:* cubre tanto skorify-infra como skorify-infra-*.
    const cfn = json.find((s: { Sid?: string }) => s.Sid === 'CloudFormationSkorifyInfraStacks');
    expect(cfn!.Resource).toEqual(
      expect.arrayContaining([
        'arn:aws:cloudformation:*:968306633562:stack/skorify-infra/*',
        'arn:aws:cloudformation:*:968306633562:stack/skorify-infra-*/*',
      ]),
    );
  });
});

// ============================================================
// Wiring: SkorifyBootstrapStack
// ============================================================

describe('SkorifyBootstrapStack: materialización por cuenta activa', () => {
  test('no se materializa cuando la cuenta es undefined', () => {
    const app = new cdk.App();
    expect(maybeCreateSkorifyBootstrapStack(app, { currentAccount: undefined })).toBeUndefined();
  });

  test('no se materializa cuando la cuenta no está modelada', () => {
    const app = new cdk.App();
    expect(
      maybeCreateSkorifyBootstrapStack(app, { currentAccount: '000000000000' }),
    ).toBeUndefined();
  });

  test('en master crea los roles awsug-* (deploy + infra), ninguno skorify-*', () => {
    const app = new cdk.App();
    const stack = maybeCreateSkorifyBootstrapStack(app, {
      currentAccount: MANAGEMENT_ACCOUNT_ID,
    })!;

    expect(stack).toBeDefined();
    expect(stack.account).toBe(MANAGEMENT_ACCOUNT_ID);

    const template = Template.fromStack(stack);
    expect(deployRoleNames(template, 'awsug-')).toEqual([
      'awsug-pagina-web-deploy',
      'awsug-pagina-web-infra',
    ]);
    expect(deployRoleNames(template, 'skorify-')).toEqual([]);
  });

  test('en cada cuenta Skorify crea los 7 roles del dominio (sin pagina-web)', () => {
    for (const [account, env] of Object.entries(SKORIFY_ACCOUNT_TO_ENV)) {
      const app = new cdk.App();
      const stack = maybeCreateSkorifyBootstrapStack(app, { currentAccount: account })!;
      const template = Template.fromStack(stack);

      expect(deployRoleNames(template, 'skorify-')).toEqual([
        'skorify-backend-deploy',
        'skorify-data-deploy',
        'skorify-data-infra',
        'skorify-frontend-deploy',
        'skorify-frontend-infra',
        'skorify-infra-deploy',
        'skorify-ops-readonly',
      ]);
      expect(deployRoleNames(template, 'awsug-')).toEqual([]);
      expect(stack.tags.tagValues().Environment).toBe(env);
    }
  });

  test('crea exactamente 1 OIDC provider por stack', () => {
    const app = new cdk.App();
    const stack = maybeCreateSkorifyBootstrapStack(app, {
      currentAccount: '968306633562',
    })!;

    Template.fromStack(stack).resourceCountIs('Custom::AWSCDKOpenIdConnectProvider', 1);
  });
});
