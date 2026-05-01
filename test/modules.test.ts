import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { S3Module, S3BucketDefinition } from '../lib/modules/s3/main';

// ============================================================
// Fixtures reutilizables
// ============================================================

const accessLogsDef: S3BucketDefinition = {
  logicalName: 'AccessLogs',
  bucketName: 'dev-access-logs',
  versioned: true,
  encryptionType: 'S3_MANAGED',
  isLogsBucket: true,
  expirationDays: 180,
  removalPolicy: 'RETAIN',
};

const assetsDef: S3BucketDefinition = {
  logicalName: 'Assets',
  bucketName: 'dev-assets',
  versioned: true,
  encryptionType: 'S3_MANAGED',
  serverAccessLogsTargetName: 'AccessLogs',
  serverAccessLogsPrefix: 'assets/',
  abortMultipartUploadDays: 7,
  lifecycleTransitionDays: 30,
  removalPolicy: 'DESTROY',
  eventBridgeEnabled: true,
};

function makeStack(name: string) {
  const app = new cdk.App();
  return new cdk.Stack(app, name);
}

// ============================================================
// Tests
// ============================================================

describe('S3Module', () => {
  describe('creación de buckets', () => {
    test('crea exactamente N buckets cuando se pasan N definiciones', () => {
      const stack = makeStack('NBucketsTest');
      new S3Module(stack, 'S3Storage', {
        buckets: [accessLogsDef, assetsDef],
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::S3::Bucket', 2);
    });

    test('crea un solo bucket cuando se pasa una sola definición', () => {
      const stack = makeStack('SingleBucketTest');
      new S3Module(stack, 'S3Storage', {
        buckets: [accessLogsDef],
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::S3::Bucket', 1);
    });

    test('crea tres buckets cuando se pasan tres definiciones', () => {
      const stack = makeStack('ThreeBucketsTest');
      const backupDef: S3BucketDefinition = {
        logicalName: 'Backup',
        bucketName: 'dev-backup',
        versioned: false,
        encryptionType: 'KMS_MANAGED',
        lifecycleTransitionDays: 60,
        removalPolicy: 'RETAIN',
      };

      new S3Module(stack, 'S3Storage', {
        buckets: [accessLogsDef, assetsDef, backupDef],
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::S3::Bucket', 3);
    });

    test('los nombres físicos de los buckets coinciden con bucketName', () => {
      const stack = makeStack('BucketNamesTest');
      new S3Module(stack, 'S3Storage', {
        buckets: [accessLogsDef, assetsDef],
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', { BucketName: 'dev-access-logs' });
      template.hasResourceProperties('AWS::S3::Bucket', { BucketName: 'dev-assets' });
    });
  });

  describe('cifrado', () => {
    test('crea una clave KMS cuando encryptionType = CUSTOMER_MANAGED', () => {
      const stack = makeStack('KmsTest');
      new S3Module(stack, 'S3Storage', {
        buckets: [
          {
            logicalName: 'SecureBucket',
            bucketName: 'prod-secure',
            versioned: true,
            encryptionType: 'CUSTOMER_MANAGED',
            kmsAlias: 'alias/skorify/prod/secure',
            removalPolicy: 'RETAIN',
          },
        ],
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::KMS::Key', 1);
    });

    test('no crea claves KMS cuando encryptionType = KMS_MANAGED', () => {
      const stack = makeStack('KmsManagedTest');
      new S3Module(stack, 'S3Storage', {
        buckets: [
          {
            logicalName: 'ManagedBucket',
            bucketName: 'staging-managed',
            versioned: true,
            encryptionType: 'KMS_MANAGED',
            removalPolicy: 'DESTROY',
          },
        ],
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::KMS::Key', 0);
    });
  });

  describe('seguridad', () => {
    test('todos los buckets tienen block public access habilitado', () => {
      const stack = makeStack('SecurityTest');
      new S3Module(stack, 'S3Storage', {
        buckets: [accessLogsDef, assetsDef],
      });

      const template = Template.fromStack(stack);

      // Verificar en ambos buckets (resourceCountIs valida que existen 2 con este config)
      template.allResourcesProperties('AWS::S3::Bucket', {
        PublicAccessBlockConfiguration: Match.objectLike({
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        }),
      });
    });

    test('el bucket de assets tiene EventBridge habilitado cuando se configura', () => {
      const stack = makeStack('EventBridgeTest');
      new S3Module(stack, 'S3Storage', {
        buckets: [accessLogsDef, assetsDef],
      });

      const template = Template.fromStack(stack);

      // CDK configura EventBridge via un Custom Resource (Lambda handler).
      // Verificamos que existe el recurso de notificación con EventBridgeConfiguration vacío
      // (CDK lo deja vacío cuando solo se habilita EventBridge sin listeners adicionales).
      template.hasResourceProperties('Custom::S3BucketNotifications', {
        NotificationConfiguration: Match.objectLike({
          EventBridgeConfiguration: {},
        }),
      });
    });

    test('el bucket de logs solo permite PutObject desde el bucket origen (least privilege)', () => {
      const stack = makeStack('LogsPolicyLeastPrivilegeTest');
      new S3Module(stack, 'S3Storage', {
        buckets: [accessLogsDef, assetsDef],
      });

      const template = Template.fromStack(stack);

      const policies = template.findResources('AWS::S3::BucketPolicy');
      const policyDocs = Object.values(policies).map((r: any) => r.Properties?.PolicyDocument);

      const allStatements = policyDocs
        .flatMap((doc: any) => (doc?.Statement ? doc.Statement : []))
        .filter(Boolean);

      const stmt = allStatements.find(
        (s: any) =>
          s?.Effect === 'Allow' &&
          s?.Action === 's3:PutObject' &&
          s?.Principal?.Service === 'logging.s3.amazonaws.com' &&
          typeof s?.Sid === 'string' &&
          s.Sid.includes('AllowS3ServerAccessLogsFromAssets'),
      );

      expect(stmt).toBeTruthy();
      expect(stmt.Condition?.ArnLike?.['aws:SourceArn']).toBeTruthy();
      expect(stmt.Condition?.StringEquals?.['aws:SourceAccount']).toEqual({ Ref: 'AWS::AccountId' });

      // Validar que el resource esté restringido a la ruta esperada (tokenizado por CDK)
      expect(JSON.stringify(stmt.Resource)).toContain('assets/dev-assets/*');
    });
  });

  describe('validaciones', () => {
    test('lanza error si hay logicalName duplicados', () => {
      const stack = makeStack('DuplicateNameTest');
      expect(() => {
        new S3Module(stack, 'S3Storage', {
          buckets: [accessLogsDef, { ...accessLogsDef, bucketName: 'dev-access-logs-2' }],
        });
      }).toThrow('[S3Module] Todos los logicalName deben ser únicos');
    });

    test('lanza error si CUSTOMER_MANAGED no tiene kmsAlias', () => {
      const stack = makeStack('MissingKmsAliasTest');
      expect(() => {
        new S3Module(stack, 'S3Storage', {
          buckets: [
            {
              logicalName: 'NoBucket',
              bucketName: 'dev-no-key',
              versioned: false,
              encryptionType: 'CUSTOMER_MANAGED',
              removalPolicy: 'DESTROY',
            },
          ],
        });
      }).toThrow('no tiene kmsAlias definido');
    });

    test('lanza error si serverAccessLogsTargetName no existe en la lista', () => {
      const stack = makeStack('MissingTargetTest');
      expect(() => {
        new S3Module(stack, 'S3Storage', {
          buckets: [
            {
              ...assetsDef,
              serverAccessLogsTargetName: 'NonExistentBucket',
            },
          ],
        });
      }).toThrow('que no existe en la lista de buckets');
    });

    test('lanza error si el bucket destino de logs no tiene isLogsBucket=true', () => {
      const stack = makeStack('NotALogsBucketTest');
      const nonLogsBucket: S3BucketDefinition = {
        logicalName: 'NotLogs',
        bucketName: 'dev-not-logs',
        versioned: false,
        encryptionType: 'S3_MANAGED',
        removalPolicy: 'DESTROY',
        // isLogsBucket no está definido (undefined = false)
      };

      expect(() => {
        new S3Module(stack, 'S3Storage', {
          buckets: [
            nonLogsBucket,
            { ...assetsDef, serverAccessLogsTargetName: 'NotLogs' },
          ],
        });
      }).toThrow('debe tener isLogsBucket=true');
    });

    test('no lanza error con array vacío (primer synth de CDK)', () => {
      const stack = makeStack('EmptyBucketsTest');
      expect(() => {
        new S3Module(stack, 'S3Storage', {
          buckets: [],
        });
      }).not.toThrow();
    });
  });
});
