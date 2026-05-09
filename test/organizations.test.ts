import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {
  OrganizationsModule,
  OrganizationAccountDefinition,
} from '../lib/modules/organizations/main';
import { OU_SKORIFY_ID, SKORIFY_ACCOUNTS } from '../lib/config/organizations-config';

// ============================================================
// Fixtures reutilizables
// ============================================================

const validDev: OrganizationAccountDefinition = {
  logicalName: 'SkorifyDevelopment',
  accountName: 'Skorify-development',
  email: 'awsugmanizales+skorify-dev@gmail.com',
  environment: 'dev',
  owner: '@Mateo454',
};

const validStg: OrganizationAccountDefinition = {
  logicalName: 'SkorifyStaging',
  accountName: 'Skorify-staging',
  email: 'awsugmanizales+skorify-stg@gmail.com',
  environment: 'stg',
  owner: '@Mateo454',
};

const validPrd: OrganizationAccountDefinition = {
  logicalName: 'SkorifyProduction',
  accountName: 'Skorify-production',
  email: 'awsugmanizales+skorify-prod@gmail.com',
  environment: 'prd',
  owner: '@Mateo454',
};

function makeStack(name: string): cdk.Stack {
  const app = new cdk.App();
  return new cdk.Stack(app, name);
}

// ============================================================
// Tests: materialización
// ============================================================

describe('OrganizationsModule', () => {
  test('crea un CfnAccount por cada definición con la OU como parent', () => {
    const stack = makeStack('TestOrgStack');
    new OrganizationsModule(stack, 'SkorifyAccounts', {
      ouId: OU_SKORIFY_ID,
      accounts: [validDev, validStg, validPrd],
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Organizations::Account', 3);

    template.hasResourceProperties('AWS::Organizations::Account', {
      AccountName: 'Skorify-development',
      Email: 'awsugmanizales+skorify-dev@gmail.com',
      ParentIds: [OU_SKORIFY_ID],
      RoleName: 'OrganizationAccountAccessRole',
    });

    template.hasResourceProperties('AWS::Organizations::Account', {
      AccountName: 'Skorify-staging',
      Email: 'awsugmanizales+skorify-stg@gmail.com',
    });

    template.hasResourceProperties('AWS::Organizations::Account', {
      AccountName: 'Skorify-production',
      Email: 'awsugmanizales+skorify-prod@gmail.com',
    });
  });

  test('aplica los tags obligatorios Environment, Project, Owner', () => {
    const stack = makeStack('TestOrgTags');
    new OrganizationsModule(stack, 'SkorifyAccounts', {
      ouId: OU_SKORIFY_ID,
      accounts: [validDev],
    });

    const template = Template.fromStack(stack);
    // CDK ordena los tags alfabéticamente por Key al sintetizar.
    template.hasResourceProperties('AWS::Organizations::Account', {
      Tags: [
        { Key: 'Environment', Value: 'dev' },
        { Key: 'Owner', Value: '@Mateo454' },
        { Key: 'Project', Value: 'Skorify' },
      ],
    });
  });

  test('respeta override de project cuando se provee', () => {
    const stack = makeStack('TestOrgProject');
    new OrganizationsModule(stack, 'SkorifyAccounts', {
      ouId: OU_SKORIFY_ID,
      accounts: [{ ...validDev, project: 'AWS-UG-Manizales' }],
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Organizations::Account', {
      Tags: Match.arrayWith([{ Key: 'Project', Value: 'AWS-UG-Manizales' }]),
    });
  });

  test('respeta override de roleName cuando se provee', () => {
    const stack = makeStack('TestOrgRole');
    new OrganizationsModule(stack, 'SkorifyAccounts', {
      ouId: OU_SKORIFY_ID,
      accounts: [{ ...validDev, roleName: 'CustomBootstrapRole' }],
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Organizations::Account', {
      RoleName: 'CustomBootstrapRole',
    });
  });

  test('expone las cuentas creadas en el mapa accounts', () => {
    const stack = makeStack('TestOrgOutputs');
    const module = new OrganizationsModule(stack, 'SkorifyAccounts', {
      ouId: OU_SKORIFY_ID,
      accounts: [validDev, validStg],
    });

    expect(Object.keys(module.accounts).sort()).toEqual([
      'SkorifyDevelopment',
      'SkorifyStaging',
    ]);
  });

  test('lista vacía no crea recursos (early return)', () => {
    const stack = makeStack('TestOrgEmpty');
    new OrganizationsModule(stack, 'SkorifyAccounts', {
      ouId: OU_SKORIFY_ID,
      accounts: [],
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Organizations::Account', 0);
  });
});

// ============================================================
// Tests: validaciones (Fail Fast)
// ============================================================

describe('OrganizationsModule — validateProps', () => {
  test('rechaza ouId sin prefijo "ou-"', () => {
    const stack = makeStack('TestOrgInvalidOuId');
    expect(
      () =>
        new OrganizationsModule(stack, 'SkorifyAccounts', {
          ouId: 'r-i8pg',
          accounts: [validDev],
        }),
    ).toThrow(/ouId debe iniciar con "ou-"/);
  });

  test('rechaza logicalName duplicados', () => {
    const stack = makeStack('TestOrgDupLogical');
    expect(
      () =>
        new OrganizationsModule(stack, 'SkorifyAccounts', {
          ouId: OU_SKORIFY_ID,
          accounts: [validDev, { ...validStg, logicalName: 'SkorifyDevelopment' }],
        }),
    ).toThrow(/logicalName deben ser únicos/);
  });

  test('rechaza accountName duplicados', () => {
    const stack = makeStack('TestOrgDupName');
    expect(
      () =>
        new OrganizationsModule(stack, 'SkorifyAccounts', {
          ouId: OU_SKORIFY_ID,
          accounts: [validDev, { ...validStg, accountName: 'Skorify-development' }],
        }),
    ).toThrow(/accountName deben ser únicos/);
  });

  test('rechaza email duplicados (case-insensitive)', () => {
    const stack = makeStack('TestOrgDupEmail');
    expect(
      () =>
        new OrganizationsModule(stack, 'SkorifyAccounts', {
          ouId: OU_SKORIFY_ID,
          accounts: [
            validDev,
            { ...validStg, email: 'AWSUGMANIZALES+skorify-dev@gmail.com' },
          ],
        }),
    ).toThrow(/email deben ser únicos/);
  });

  test('rechaza email con formato inválido', () => {
    const stack = makeStack('TestOrgBadEmail');
    expect(
      () =>
        new OrganizationsModule(stack, 'SkorifyAccounts', {
          ouId: OU_SKORIFY_ID,
          accounts: [{ ...validDev, email: 'not-an-email' }],
        }),
    ).toThrow(/Email inválido/);
  });

  test('rechaza owner vacío', () => {
    const stack = makeStack('TestOrgNoOwner');
    expect(
      () =>
        new OrganizationsModule(stack, 'SkorifyAccounts', {
          ouId: OU_SKORIFY_ID,
          accounts: [{ ...validDev, owner: '   ' }],
        }),
    ).toThrow(/no tiene owner/);
  });
});

// ============================================================
// Tests: contrato con la configuración real (smoke)
// ============================================================

describe('SKORIFY_ACCOUNTS (configuración real)', () => {
  test('contiene exactamente DEV, STG y PROD bajo la OU Skorify', () => {
    const stack = makeStack('TestRealConfig');
    new OrganizationsModule(stack, 'SkorifyAccounts', {
      ouId: OU_SKORIFY_ID,
      accounts: SKORIFY_ACCOUNTS,
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Organizations::Account', 3);

    const environments = SKORIFY_ACCOUNTS.map((a) => a.environment).sort();
    expect(environments).toEqual(['dev', 'prd', 'stg']);
  });

  test('no incluye la cuenta de gestión ni la suspendida Skorify-staggin', () => {
    const accountIds = SKORIFY_ACCOUNTS.map((a) => a.email);
    expect(accountIds).not.toContain('awsugmanizales+skorify-staging@gmail.com');
    expect(SKORIFY_ACCOUNTS.find((a) => a.accountName === 'AWS UG Manizales')).toBeUndefined();
    expect(SKORIFY_ACCOUNTS.find((a) => a.accountName === 'Skorify-staggin')).toBeUndefined();
  });
});
