import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {
  OrganizationsModule,
  OrganizationAccountDefinition,
  OrganizationalUnitDefinition,
} from '../lib/modules/organizations/main';
import { maybeCreateSkorifyOrganizationStack } from '../lib/modules/organizations/stack';
import {
  MANAGEMENT_ACCOUNT_ID,
  ROOT_ID,
  SKORIFY_ACCOUNTS,
  SKORIFY_OU,
} from '../lib/config/organizations-config';

// ============================================================
// Fixtures
// ============================================================

const validOu: OrganizationalUnitDefinition = {
  logicalName: 'SkorifyOu',
  name: 'Skorify',
  parentId: ROOT_ID,
};

const devAccount: OrganizationAccountDefinition = {
  logicalName: 'SkorifyDevelopment',
  accountName: 'Skorify-development',
  email: 'awsugmanizales+skorify-dev@gmail.com',
  environment: 'dev',
  owner: '@Mateo454',
};

const stgAccount: OrganizationAccountDefinition = {
  logicalName: 'SkorifyStaging',
  accountName: 'Skorify-staging',
  email: 'awsugmanizales+skorify-stg@gmail.com',
  environment: 'stg',
  owner: '@Mateo454',
};

const prdAccount: OrganizationAccountDefinition = {
  logicalName: 'SkorifyProduction',
  accountName: 'Skorify-production',
  email: 'awsugmanizales+skorify-prod@gmail.com',
  environment: 'prd',
  owner: '@Mateo454',
};

function makeStack(id: string): cdk.Stack {
  const app = new cdk.App();
  return new cdk.Stack(app, id);
}

// ============================================================
// Construct: OrganizationsModule
// ============================================================

describe('OrganizationsModule', () => {
  test('crea la OU y un CfnAccount por cada cuenta declarada', () => {
    const stack = makeStack('TestConstruct');
    new OrganizationsModule(stack, 'SkorifyAccounts', {
      ou: validOu,
      accounts: [devAccount, stgAccount, prdAccount],
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Organizations::OrganizationalUnit', 1);
    template.resourceCountIs('AWS::Organizations::Account', 3);

    template.hasResourceProperties('AWS::Organizations::OrganizationalUnit', {
      Name: 'Skorify',
      ParentId: ROOT_ID,
    });
  });

  test('cada cuenta apunta su parentIds al ref de la OU (no a un string)', () => {
    const stack = makeStack('TestOuRef');
    new OrganizationsModule(stack, 'SkorifyAccounts', {
      ou: validOu,
      accounts: [devAccount],
    });

    const accounts = Template.fromStack(stack).findResources('AWS::Organizations::Account');
    const account = Object.values(accounts)[0];
    expect(account.Properties.ParentIds[0]).toEqual({
      Ref: expect.stringContaining('SkorifyOu'),
    });
  });

  test('aplica los tres tags obligatorios sin importar el orden de síntesis', () => {
    const stack = makeStack('TestTags');
    new OrganizationsModule(stack, 'SkorifyAccounts', {
      ou: validOu,
      accounts: [devAccount],
    });

    Template.fromStack(stack).hasResourceProperties('AWS::Organizations::Account', {
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'Environment', Value: 'dev' }),
        Match.objectLike({ Key: 'Owner', Value: '@Mateo454' }),
        Match.objectLike({ Key: 'Project', Value: 'Skorify' }),
      ]),
    });
  });

  test('permite personalizar project y roleName por cuenta', () => {
    const stack = makeStack('TestOverrides');
    new OrganizationsModule(stack, 'SkorifyAccounts', {
      ou: validOu,
      accounts: [{ ...devAccount, project: 'AWS-UG-Manizales', roleName: 'CustomRole' }],
    });

    Template.fromStack(stack).hasResourceProperties('AWS::Organizations::Account', {
      RoleName: 'CustomRole',
      Tags: Match.arrayWith([Match.objectLike({ Key: 'Project', Value: 'AWS-UG-Manizales' })]),
    });
  });

  test('expone la OU y las cuentas como propiedades públicas', () => {
    const stack = makeStack('TestOutputs');
    const module = new OrganizationsModule(stack, 'SkorifyAccounts', {
      ou: validOu,
      accounts: [devAccount, stgAccount],
    });

    expect(module.ou).toBeDefined();
    expect(Object.keys(module.accounts).sort()).toEqual([
      'SkorifyDevelopment',
      'SkorifyStaging',
    ]);
  });

  test('lista de cuentas vacía sigue creando la OU', () => {
    const stack = makeStack('TestNoAccounts');
    new OrganizationsModule(stack, 'SkorifyAccounts', {
      ou: validOu,
      accounts: [],
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Organizations::OrganizationalUnit', 1);
    template.resourceCountIs('AWS::Organizations::Account', 0);
  });

  test('todos los recursos importables tienen DeletionPolicy: Retain', () => {
    // AWS resource import exige DeletionPolicy declarado en el template
    // para cada recurso a importar. Aplica a la OU y a las 3 cuentas.
    const stack = makeStack('TestRetain');
    new OrganizationsModule(stack, 'SkorifyAccounts', {
      ou: validOu,
      accounts: [devAccount, stgAccount, prdAccount],
    });

    const synth = Template.fromStack(stack).toJSON();
    const importableTypes = [
      'AWS::Organizations::OrganizationalUnit',
      'AWS::Organizations::Account',
    ];
    const importable = (Object.values(synth.Resources) as Array<{
      Type: string;
      DeletionPolicy?: string;
    }>).filter((r) => importableTypes.includes(r.Type));

    expect(importable).toHaveLength(4);
    for (const resource of importable) {
      expect(resource.DeletionPolicy).toBe('Retain');
    }
  });
});

// ============================================================
// Construct: validaciones
// ============================================================

describe('OrganizationsModule: validaciones', () => {
  test('rechaza parentId sin prefijo r- ni ou-', () => {
    const stack = makeStack('TestBadParent');
    expect(
      () =>
        new OrganizationsModule(stack, 'SkorifyAccounts', {
          ou: { ...validOu, parentId: 'identificador-invalido' },
          accounts: [devAccount],
        }),
    ).toThrow(/parentId debe iniciar con "r-"/);
  });

  test('acepta OU anidada (parentId con prefijo ou-)', () => {
    const stack = makeStack('TestNestedOu');
    expect(
      () =>
        new OrganizationsModule(stack, 'SkorifyAccounts', {
          ou: { ...validOu, parentId: 'ou-i8pg-d23ee4e4' },
          accounts: [devAccount],
        }),
    ).not.toThrow();
  });

  test('rechaza ou.name vacío', () => {
    const stack = makeStack('TestEmptyName');
    expect(
      () =>
        new OrganizationsModule(stack, 'SkorifyAccounts', {
          ou: { ...validOu, name: '   ' },
          accounts: [devAccount],
        }),
    ).toThrow(/ou.name no puede estar vacío/);
  });

  test('rechaza logicalName duplicados (incluyendo el de la OU)', () => {
    const stack = makeStack('TestDupLogical');
    expect(
      () =>
        new OrganizationsModule(stack, 'SkorifyAccounts', {
          ou: validOu,
          accounts: [devAccount, { ...stgAccount, logicalName: 'SkorifyOu' }],
        }),
    ).toThrow(/logicalName deben ser únicos/);
  });

  test('rechaza accountName duplicados', () => {
    const stack = makeStack('TestDupName');
    expect(
      () =>
        new OrganizationsModule(stack, 'SkorifyAccounts', {
          ou: validOu,
          accounts: [devAccount, { ...stgAccount, accountName: 'Skorify-development' }],
        }),
    ).toThrow(/accountName deben ser únicos/);
  });

  test('rechaza email duplicados sin importar mayúsculas', () => {
    const stack = makeStack('TestDupEmail');
    expect(
      () =>
        new OrganizationsModule(stack, 'SkorifyAccounts', {
          ou: validOu,
          accounts: [devAccount, { ...stgAccount, email: 'AWSUGMANIZALES+skorify-dev@gmail.com' }],
        }),
    ).toThrow(/email deben ser únicos/);
  });

  test('rechaza email mal formado', () => {
    const stack = makeStack('TestBadEmail');
    expect(
      () =>
        new OrganizationsModule(stack, 'SkorifyAccounts', {
          ou: validOu,
          accounts: [{ ...devAccount, email: 'no-es-email' }],
        }),
    ).toThrow(/Email inválido/);
  });

  test('rechaza cuenta sin owner (rompe tag obligatorio)', () => {
    const stack = makeStack('TestNoOwner');
    expect(
      () =>
        new OrganizationsModule(stack, 'SkorifyAccounts', {
          ou: validOu,
          accounts: [{ ...devAccount, owner: '   ' }],
        }),
    ).toThrow(/no tiene owner/);
  });
});

// ============================================================
// Configuración: SKORIFY_ACCOUNTS
// ============================================================

describe('SKORIFY_ACCOUNTS: configuración real', () => {
  test('las tres cuentas (DEV, STG, PROD) están marcadas como existing: true', () => {
    // STG entró como existing tras el incidente del 2026-05-09: el primer
    // cdk deploy fallido por RoleName inmutable disparó rollback, pero
    // CreateAccount en Organizations es asíncrono y la cuenta se creó
    // igual. Quedó huérfana y se incorporó con cdk import. Ver
    // ADR-INFRA-0011 §"A monitorear" y el runbook §Recovery.
    for (const env of ['dev', 'stg', 'prd'] as const) {
      const account = SKORIFY_ACCOUNTS.find((a) => a.environment === env);
      expect(account?.existing).toBe(true);
    }
  });

  test('no incluye la cuenta de gestión ni la suspendida Skorify-staggin', () => {
    expect(SKORIFY_ACCOUNTS.find((a) => a.accountName === 'AWS UG Manizales')).toBeUndefined();
    expect(SKORIFY_ACCOUNTS.find((a) => a.accountName === 'Skorify-staggin')).toBeUndefined();
    expect(
      SKORIFY_ACCOUNTS.find((a) => a.email === 'awsugmanizales+skorify-staging@gmail.com'),
    ).toBeUndefined();
  });
});

// ============================================================
// Wiring: SkorifyOrganizationStack (lib/main.ts)
// ============================================================

describe('SkorifyOrganizationStack: materialización condicional y fases', () => {
  test('no se materializa cuando la cuenta activa NO es la master', () => {
    const app = new cdk.App();
    const stack = maybeCreateSkorifyOrganizationStack(app, {
      currentAccount: '968306633562', // DEV
      importPhase: false,
    });

    expect(stack).toBeUndefined();
  });

  test('no se materializa cuando la cuenta activa es undefined', () => {
    const app = new cdk.App();
    const stack = maybeCreateSkorifyOrganizationStack(app, {
      currentAccount: undefined,
      importPhase: false,
    });

    expect(stack).toBeUndefined();
  });

  test('se materializa cuando la cuenta activa es la master, fijado a su account/region', () => {
    const app = new cdk.App();
    const stack = maybeCreateSkorifyOrganizationStack(app, {
      currentAccount: MANAGEMENT_ACCOUNT_ID,
      importPhase: false,
    });

    expect(stack).toBeDefined();
    expect(stack!.account).toBe(MANAGEMENT_ACCOUNT_ID);
    expect(stack!.region).toBe('us-east-1');
  });

  test('fase normal incluye las 3 cuentas Skorify (DEV, STG, PROD)', () => {
    const app = new cdk.App();
    const stack = maybeCreateSkorifyOrganizationStack(app, {
      currentAccount: MANAGEMENT_ACCOUNT_ID,
      importPhase: false,
    })!;

    Template.fromStack(stack).resourceCountIs('AWS::Organizations::Account', 3);
  });

  test('fase import incluye todas las cuentas existing: true', () => {
    // En Skorify hoy DEV, STG y PROD son existing (ver SKORIFY_ACCOUNTS).
    // El filtro existing es general: si una cuenta nueva se agrega más
    // adelante sin existing, NO debería aparecer en este conteo.
    const app = new cdk.App();
    const stack = maybeCreateSkorifyOrganizationStack(app, {
      currentAccount: MANAGEMENT_ACCOUNT_ID,
      importPhase: true,
    })!;

    const expected = SKORIFY_ACCOUNTS.filter((a) => a.existing).length;
    Template.fromStack(stack).resourceCountIs('AWS::Organizations::Account', expected);
  });

  test('fase import emite template mínimo: sin Tags ni RoleName en CfnAccount', () => {
    // CFN rechaza el cdk import si Tags o RoleName están declarados.
    // Ver ADR-INFRA-0011 y AWS resource-import-supported-resources.html.
    const app = new cdk.App();
    const stack = maybeCreateSkorifyOrganizationStack(app, {
      currentAccount: MANAGEMENT_ACCOUNT_ID,
      importPhase: true,
    })!;

    const accounts = Template.fromStack(stack).findResources('AWS::Organizations::Account');
    for (const [, resource] of Object.entries(accounts)) {
      expect(resource.Properties).not.toHaveProperty('Tags');
      expect(resource.Properties).not.toHaveProperty('RoleName');
    }
  });

  test('fase import omite los stack-level tags (CFN los rechaza durante import)', () => {
    const app = new cdk.App();
    const stack = maybeCreateSkorifyOrganizationStack(app, {
      currentAccount: MANAGEMENT_ACCOUNT_ID,
      importPhase: true,
    })!;

    // Los stack-level tags se materializan como Tags en cada CfnResource
    // que los soporta. En fase import deben estar ausentes.
    const ous = Template.fromStack(stack).findResources('AWS::Organizations::OrganizationalUnit');
    for (const [, resource] of Object.entries(ous)) {
      expect(resource.Properties ?? {}).not.toHaveProperty('Tags');
    }
  });

  test('fase normal declara Tags en cada CfnAccount', () => {
    const app = new cdk.App();
    const stack = maybeCreateSkorifyOrganizationStack(app, {
      currentAccount: MANAGEMENT_ACCOUNT_ID,
      importPhase: false,
    })!;

    Template.fromStack(stack).hasResourceProperties('AWS::Organizations::Account', {
      Tags: Match.arrayWith([Match.objectLike({ Key: 'Environment' })]),
    });
  });

  test('fase normal NO declara RoleName en cuentas existing: true', () => {
    // RoleName es inmutable en AWS::Organizations::Account. Declararlo
    // en cuentas importadas hace fallar el update con "You cannot update
    // IAM role name", aunque el valor sea idéntico al actual.
    const app = new cdk.App();
    const stack = maybeCreateSkorifyOrganizationStack(app, {
      currentAccount: MANAGEMENT_ACCOUNT_ID,
      importPhase: false,
    })!;

    const accounts = Template.fromStack(stack).findResources('AWS::Organizations::Account');
    for (const [, resource] of Object.entries(accounts)) {
      const accountName = (resource.Properties as { AccountName: string }).AccountName;
      const cfg = SKORIFY_ACCOUNTS.find((a) => a.accountName === accountName);
      if (cfg?.existing) {
        expect(resource.Properties).not.toHaveProperty('RoleName');
      }
    }
  });

  test('módulo SÍ declara RoleName en cuentas no existing (fixture sintético)', () => {
    // Cobertura del path "cuenta nueva". Hoy SKORIFY_ACCOUNTS no tiene
    // ninguna sin existing; este test usa un fixture aislado para
    // validar el comportamiento del módulo.
    const stack = makeStack('TestNewAccount');
    new OrganizationsModule(stack, 'SkorifyAccounts', {
      ou: validOu,
      accounts: [{ ...stgAccount, existing: false }],
    });

    Template.fromStack(stack).hasResourceProperties('AWS::Organizations::Account', {
      RoleName: 'OrganizationAccountAccessRole',
    });
  });
});
