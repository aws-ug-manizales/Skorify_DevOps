"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const cdk = __importStar(require("aws-cdk-lib"));
const assertions_1 = require("aws-cdk-lib/assertions");
const main_1 = require("../lib/modules/s3/main");
// ============================================================
// Fixtures reutilizables
// ============================================================
const accessLogsDef = {
    logicalName: 'AccessLogs',
    bucketName: 'dev-access-logs',
    versioned: true,
    encryptionType: 'S3_MANAGED',
    isLogsBucket: true,
    expirationDays: 180,
    removalPolicy: 'RETAIN',
};
const assetsDef = {
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
function makeStack(name) {
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
            new main_1.S3Module(stack, 'S3Storage', {
                buckets: [accessLogsDef, assetsDef],
            });
            const template = assertions_1.Template.fromStack(stack);
            template.resourceCountIs('AWS::S3::Bucket', 2);
        });
        test('crea un solo bucket cuando se pasa una sola definición', () => {
            const stack = makeStack('SingleBucketTest');
            new main_1.S3Module(stack, 'S3Storage', {
                buckets: [accessLogsDef],
            });
            const template = assertions_1.Template.fromStack(stack);
            template.resourceCountIs('AWS::S3::Bucket', 1);
        });
        test('crea tres buckets cuando se pasan tres definiciones', () => {
            const stack = makeStack('ThreeBucketsTest');
            const backupDef = {
                logicalName: 'Backup',
                bucketName: 'dev-backup',
                versioned: false,
                encryptionType: 'KMS_MANAGED',
                lifecycleTransitionDays: 60,
                removalPolicy: 'RETAIN',
            };
            new main_1.S3Module(stack, 'S3Storage', {
                buckets: [accessLogsDef, assetsDef, backupDef],
            });
            const template = assertions_1.Template.fromStack(stack);
            template.resourceCountIs('AWS::S3::Bucket', 3);
        });
        test('los nombres físicos de los buckets coinciden con bucketName', () => {
            const stack = makeStack('BucketNamesTest');
            new main_1.S3Module(stack, 'S3Storage', {
                buckets: [accessLogsDef, assetsDef],
            });
            const template = assertions_1.Template.fromStack(stack);
            template.hasResourceProperties('AWS::S3::Bucket', { BucketName: 'dev-access-logs' });
            template.hasResourceProperties('AWS::S3::Bucket', { BucketName: 'dev-assets' });
        });
    });
    describe('cifrado', () => {
        test('crea una clave KMS cuando encryptionType = CUSTOMER_MANAGED', () => {
            const stack = makeStack('KmsTest');
            new main_1.S3Module(stack, 'S3Storage', {
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
            const template = assertions_1.Template.fromStack(stack);
            template.resourceCountIs('AWS::KMS::Key', 1);
        });
        test('no crea claves KMS cuando encryptionType = KMS_MANAGED', () => {
            const stack = makeStack('KmsManagedTest');
            new main_1.S3Module(stack, 'S3Storage', {
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
            const template = assertions_1.Template.fromStack(stack);
            template.resourceCountIs('AWS::KMS::Key', 0);
        });
    });
    describe('seguridad', () => {
        test('todos los buckets tienen block public access habilitado', () => {
            const stack = makeStack('SecurityTest');
            new main_1.S3Module(stack, 'S3Storage', {
                buckets: [accessLogsDef, assetsDef],
            });
            const template = assertions_1.Template.fromStack(stack);
            // Verificar en ambos buckets (resourceCountIs valida que existen 2 con este config)
            template.allResourcesProperties('AWS::S3::Bucket', {
                PublicAccessBlockConfiguration: assertions_1.Match.objectLike({
                    BlockPublicAcls: true,
                    BlockPublicPolicy: true,
                    IgnorePublicAcls: true,
                    RestrictPublicBuckets: true,
                }),
            });
        });
        test('el bucket de assets tiene EventBridge habilitado cuando se configura', () => {
            const stack = makeStack('EventBridgeTest');
            new main_1.S3Module(stack, 'S3Storage', {
                buckets: [accessLogsDef, assetsDef],
            });
            const template = assertions_1.Template.fromStack(stack);
            // CDK configura EventBridge via un Custom Resource (Lambda handler).
            // Verificamos que existe el recurso de notificación con EventBridgeConfiguration vacío
            // (CDK lo deja vacío cuando solo se habilita EventBridge sin listeners adicionales).
            template.hasResourceProperties('Custom::S3BucketNotifications', {
                NotificationConfiguration: assertions_1.Match.objectLike({
                    EventBridgeConfiguration: {},
                }),
            });
        });
        test('el bucket de logs solo permite PutObject desde el bucket origen (least privilege)', () => {
            const stack = makeStack('LogsPolicyLeastPrivilegeTest');
            new main_1.S3Module(stack, 'S3Storage', {
                buckets: [accessLogsDef, assetsDef],
            });
            const template = assertions_1.Template.fromStack(stack);
            const policies = template.findResources('AWS::S3::BucketPolicy');
            const policyDocs = Object.values(policies).map((r) => r.Properties?.PolicyDocument);
            const allStatements = policyDocs
                .flatMap((doc) => (doc?.Statement ? doc.Statement : []))
                .filter(Boolean);
            const stmt = allStatements.find((s) => s?.Effect === 'Allow' &&
                s?.Action === 's3:PutObject' &&
                s?.Principal?.Service === 'logging.s3.amazonaws.com' &&
                typeof s?.Sid === 'string' &&
                s.Sid.includes('AllowS3ServerAccessLogsFromAssets'));
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
                new main_1.S3Module(stack, 'S3Storage', {
                    buckets: [accessLogsDef, { ...accessLogsDef, bucketName: 'dev-access-logs-2' }],
                });
            }).toThrow('[S3Module] Todos los logicalName deben ser únicos');
        });
        test('lanza error si CUSTOMER_MANAGED no tiene kmsAlias', () => {
            const stack = makeStack('MissingKmsAliasTest');
            expect(() => {
                new main_1.S3Module(stack, 'S3Storage', {
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
                new main_1.S3Module(stack, 'S3Storage', {
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
            const nonLogsBucket = {
                logicalName: 'NotLogs',
                bucketName: 'dev-not-logs',
                versioned: false,
                encryptionType: 'S3_MANAGED',
                removalPolicy: 'DESTROY',
                // isLogsBucket no está definido (undefined = false)
            };
            expect(() => {
                new main_1.S3Module(stack, 'S3Storage', {
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
                new main_1.S3Module(stack, 'S3Storage', {
                    buckets: [],
                });
            }).not.toThrow();
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kdWxlcy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vdGVzdC9tb2R1bGVzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdURBQXlEO0FBQ3pELGlEQUFzRTtBQUV0RSwrREFBK0Q7QUFDL0QseUJBQXlCO0FBQ3pCLCtEQUErRDtBQUUvRCxNQUFNLGFBQWEsR0FBdUI7SUFDeEMsV0FBVyxFQUFFLFlBQVk7SUFDekIsVUFBVSxFQUFFLGlCQUFpQjtJQUM3QixTQUFTLEVBQUUsSUFBSTtJQUNmLGNBQWMsRUFBRSxZQUFZO0lBQzVCLFlBQVksRUFBRSxJQUFJO0lBQ2xCLGNBQWMsRUFBRSxHQUFHO0lBQ25CLGFBQWEsRUFBRSxRQUFRO0NBQ3hCLENBQUM7QUFFRixNQUFNLFNBQVMsR0FBdUI7SUFDcEMsV0FBVyxFQUFFLFFBQVE7SUFDckIsVUFBVSxFQUFFLFlBQVk7SUFDeEIsU0FBUyxFQUFFLElBQUk7SUFDZixjQUFjLEVBQUUsWUFBWTtJQUM1QiwwQkFBMEIsRUFBRSxZQUFZO0lBQ3hDLHNCQUFzQixFQUFFLFNBQVM7SUFDakMsd0JBQXdCLEVBQUUsQ0FBQztJQUMzQix1QkFBdUIsRUFBRSxFQUFFO0lBQzNCLGFBQWEsRUFBRSxTQUFTO0lBQ3hCLGtCQUFrQixFQUFFLElBQUk7Q0FDekIsQ0FBQztBQUVGLFNBQVMsU0FBUyxDQUFDLElBQVk7SUFDN0IsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDMUIsT0FBTyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ2xDLENBQUM7QUFFRCwrREFBK0Q7QUFDL0QsUUFBUTtBQUNSLCtEQUErRDtBQUUvRCxRQUFRLENBQUMsVUFBVSxFQUFFLEdBQUcsRUFBRTtJQUN4QixRQUFRLENBQUMscUJB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LEVBQUU7Z0JBQ1YsSUFBSSxlQUFRLENBQUMsS0FBSyxFQUFFLFdBQVcsRUFBRTtvQkFDL0IsT0FBTyxFQUFFLEVBQUU7aUJBQ1osQ0FBQyxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ25CLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBNYXRjaCwgVGVtcGxhdGUgfSBmcm9tICdhd3MtY2RrLWxpYi9hc3NlcnRpb25zJztcbmltcG9ydCB7IFMzTW9kdWxlLCBTM0J1Y2tldERlZmluaXRpb24gfSBmcm9tICcuLi9saWIvbW9kdWxlcy9zMy9tYWluJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBGaXh0dXJlcyByZXV0aWxpemFibGVzXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuY29uc3QgYWNjZXNzTG9nc0RlZjogUzNCdWNrZXREZWZpbml0aW9uID0ge1xuICBsb2dpY2FsTmFtZTogJ0FjY2Vzc0xvZ3MnLFxuICBidWNrZXROYW1lOiAnZGV2LWFjY2Vzcy1sb2dzJyxcbiAgdmVyc2lvbmVkOiB0cnVlLFxuICBlbmNyeXB0aW9uVHlwZTogJ1MzX01BTkFHRUQnLFxuICBpc0xvZ3NCdWNrZXQ6IHRydWUsXG4gIGV4cGlyYXRpb25EYXlzOiAxODAsXG4gIHJlbW92YWxQb2xpY3k6ICdSRVRBSU4nLFxufTtcblxuY29uc3QgYXNzZXRzRGVmOiBTM0J1Y2tldERlZmluaXRpb24gPSB7XG4gIGxvZ2ljYWxOYW1lOiAnQXNzZXRzJyxcbiAgYnVja2V0TmFtZTogJ2Rldi1hc3NldHMnLFxuICB2ZXJzaW9uZWQ6IHRydWUsXG4gIGVuY3J5cHRpb25UeXBlOiAnUzNfTUFOQUdFRCcsXG4gIHNlcnZlckFjY2Vzc0xvZ3NUYXJnZXROYW1lOiAnQWNjZXNzTG9ncycsXG4gIHNlcnZlckFjY2Vzc0xvZ3NQcmVmaXg6ICdhc3NldHMvJyxcbiAgYWJvcnRNdWx0aXBhcnRVcGxvYWREYXlzOiA3LFxuICBsaWZlY3ljbGVUcmFuc2l0aW9uRGF5czogMzAsXG4gIHJlbW92YWxQb2xpY3k6ICdERVNUUk9ZJyxcbiAgZXZlbnRCcmlkZ2VFbmFibGVkOiB0cnVlLFxufTtcblxuZnVuY3Rpb24gbWFrZVN0YWNrKG5hbWU6IHN0cmluZykge1xuICBjb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuICByZXR1cm4gbmV3IGNkay5TdGFjayhhcHAsIG5hbWUpO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFRlc3RzXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZGVzY3JpYmUoJ1MzTW9kdWxlJywgKCkgPT4ge1xuICBkZXNjcmliZSgnY3JlYWNpw7NuIGRlIGJ1Y2tldHMnLCAoKSA9PiB7XG4gICAgdGVzdCgnY3JlYSBleGFjdGFtZW50ZSBOIGJ1Y2tldHMgY3VhbmRvIHNlIHBhc2FuIE4gZGVmaW5pY2lvbmVzJywgKCkgPT4ge1xuICAgICAgY29uc3Qgc3RhY2sgPSBtYWtlU3RhY2soJ05CdWNrZXRzVGVzdCcpO1xuICAgICAgbmV3IFMzTW9kdWxlKHN0YWNrLCAnUzNTdG9yYWdlJywge1xuICAgICAgICBidWNrZXRzOiBbYWNjZXNzTG9nc0RlZiwgYXNzZXRzRGVmXSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB0ZW1wbGF0ZSA9IFRlbXBsYXRlLmZyb21TdGFjayhzdGFjayk7XG4gICAgICB0ZW1wbGF0ZS5yZXNvdXJjZUNvdW50SXMoJ0FXUzo6UzM6OkJ1Y2tldCcsIDIpO1xuICAgIH0pO1xuXG4gICAgdGVzdCgnY3JlYSB1biBzb2xvIGJ1Y2tldCBjdWFuZG8gc2UgcGFzYSB1bmEgc29sYSBkZWZpbmljacOzbicsICgpID0+IHtcbiAgICAgIGNvbnN0IHN0YWNrID0gbWFrZVN0YWNrKCdTaW5nbGVCdWNrZXRUZXN0Jyk7XG4gICAgICBuZXcgUzNNb2R1bGUoc3RhY2ssICdTM1N0b3JhZ2UnLCB7XG4gICAgICAgIGJ1Y2tldHM6IFthY2Nlc3NMb2dzRGVmXSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB0ZW1wbGF0ZSA9IFRlbXBsYXRlLmZyb21TdGFjayhzdGFjayk7XG4gICAgICB0ZW1wbGF0ZS5yZXNvdXJjZUNvdW50SXMoJ0FXUzo6UzM6OkJ1Y2tldCcsIDEpO1xuICAgIH0pO1xuXG4gICAgdGVzdCgnY3JlYSB0cmVzIGJ1Y2tldHMgY3VhbmRvIHNlIHBhc2FuIHRyZXMgZGVmaW5pY2lvbmVzJywgKCkgPT4ge1xuICAgICAgY29uc3Qgc3RhY2sgPSBtYWtlU3RhY2soJ1RocmVlQnVja2V0c1Rlc3QnKTtcbiAgICAgIGNvbnN0IGJhY2t1cERlZjogUzNCdWNrZXREZWZpbml0aW9uID0ge1xuICAgICAgICBsb2dpY2FsTmFtZTogJ0JhY2t1cCcsXG4gICAgICAgIGJ1Y2tldE5hbWU6ICdkZXYtYmFja3VwJyxcbiAgICAgICAgdmVyc2lvbmVkOiBmYWxzZSxcbiAgICAgICAgZW5jcnlwdGlvblR5cGU6ICdLTVNfTUFOQUdFRCcsXG4gICAgICAgIGxpZmVjeWNsZVRyYW5zaXRpb25EYXlzOiA2MCxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogJ1JFVEFJTicsXG4gICAgICB9O1xuXG4gICAgICBuZXcgUzNNb2R1bGUoc3RhY2ssICdTM1N0b3JhZ2UnLCB7XG4gICAgICAgIGJ1Y2tldHM6IFthY2Nlc3NMb2dzRGVmLCBhc3NldHNEZWYsIGJhY2t1cERlZl0sXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgdGVtcGxhdGUgPSBUZW1wbGF0ZS5mcm9tU3RhY2soc3RhY2spO1xuICAgICAgdGVtcGxhdGUucmVzb3VyY2VDb3VudElzKCdBV1M6OlMzOjpCdWNrZXQnLCAzKTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ2xvcyBub21icmVzIGbDrXNpY29zIGRlIGxvcyBidWNrZXRzIGNvaW5jaWRlbiBjb24gYnVja2V0TmFtZScsICgpID0+IHtcbiAgICAgIGNvbnN0IHN0YWNrID0gbWFrZVN0YWNrKCdCdWNrZXROYW1lc1Rlc3QnKTtcbiAgICAgIG5ldyBTM01vZHVsZShzdGFjaywgJ1MzU3RvcmFnZScsIHtcbiAgICAgICAgYnVja2V0czogW2FjY2Vzc0xvZ3NEZWYsIGFzc2V0c0RlZl0sXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgdGVtcGxhdGUgPSBUZW1wbGF0ZS5mcm9tU3RhY2soc3RhY2spO1xuICAgICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OlMzOjpCdWNrZXQnLCB7IEJ1Y2tldE5hbWU6ICdkZXYtYWNjZXNzLWxvZ3MnIH0pO1xuICAgICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OlMzOjpCdWNrZXQnLCB7IEJ1Y2tldE5hbWU6ICdkZXYtYXNzZXRzJyB9KTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ2NpZnJhZG8nLCAoKSA9PiB7XG4gICAgdGVzdCgnY3JlYSB1bmEgY2xhdmUgS01TIGN1YW5kbyBlbmNyeXB0aW9uVHlwZSA9IENVU1RPTUVSX01BTkFHRUQnLCAoKSA9PiB7XG4gICAgICBjb25zdCBzdGFjayA9IG1ha2VTdGFjaygnS21zVGVzdCcpO1xuICAgICAgbmV3IFMzTW9kdWxlKHN0YWNrLCAnUzNTdG9yYWdlJywge1xuICAgICAgICBidWNrZXRzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgbG9naWNhbE5hbWU6ICdTZWN1cmVCdWNrZXQnLFxuICAgICAgICAgICAgYnVja2V0TmFtZTogJ3Byb2Qtc2VjdXJlJyxcbiAgICAgICAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICAgICAgICAgIGVuY3J5cHRpb25UeXBlOiAnQ1VTVE9NRVJfTUFOQUdFRCcsXG4gICAgICAgICAgICBrbXNBbGlhczogJ2FsaWFzL3Nrb3JpZnkvcHJvZC9zZWN1cmUnLFxuICAgICAgICAgICAgcmVtb3ZhbFBvbGljeTogJ1JFVEFJTicsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB0ZW1wbGF0ZSA9IFRlbXBsYXRlLmZyb21TdGFjayhzdGFjayk7XG4gICAgICB0ZW1wbGF0ZS5yZXNvdXJjZUNvdW50SXMoJ0FXUzo6S01TOjpLZXknLCAxKTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ25vIGNyZWEgY2xhdmVzIEtNUyBjdWFuZG8gZW5jcnlwdGlvblR5cGUgPSBLTVNfTUFOQUdFRCcsICgpID0+IHtcbiAgICAgIGNvbnN0IHN0YWNrID0gbWFrZVN0YWNrKCdLbXNNYW5hZ2VkVGVzdCcpO1xuICAgICAgbmV3IFMzTW9kdWxlKHN0YWNrLCAnUzNTdG9yYWdlJywge1xuICAgICAgICBidWNrZXRzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgbG9naWNhbE5hbWU6ICdNYW5hZ2VkQnVja2V0JyxcbiAgICAgICAgICAgIGJ1Y2tldE5hbWU6ICdzdGFnaW5nLW1hbmFnZWQnLFxuICAgICAgICAgICAgdmVyc2lvbmVkOiB0cnVlLFxuICAgICAgICAgICAgZW5jcnlwdGlvblR5cGU6ICdLTVNfTUFOQUdFRCcsXG4gICAgICAgICAgICByZW1vdmFsUG9saWN5OiAnREVTVFJPWScsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB0ZW1wbGF0ZSA9IFRlbXBsYXRlLmZyb21TdGFjayhzdGFjayk7XG4gICAgICB0ZW1wbGF0ZS5yZXNvdXJjZUNvdW50SXMoJ0FXUzo6S01TOjpLZXknLCAwKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ3NlZ3VyaWRhZCcsICgpID0+IHtcbiAgICB0ZXN0KCd0b2RvcyBsb3MgYnVja2V0cyB0aWVuZW4gYmxvY2sgcHVibGljIGFjY2VzcyBoYWJpbGl0YWRvJywgKCkgPT4ge1xuICAgICAgY29uc3Qgc3RhY2sgPSBtYWtlU3RhY2soJ1NlY3VyaXR5VGVzdCcpO1xuICAgICAgbmV3IFMzTW9kdWxlKHN0YWNrLCAnUzNTdG9yYWdlJywge1xuICAgICAgICBidWNrZXRzOiBbYWNjZXNzTG9nc0RlZiwgYXNzZXRzRGVmXSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB0ZW1wbGF0ZSA9IFRlbXBsYXRlLmZyb21TdGFjayhzdGFjayk7XG5cbiAgICAgIC8vIFZlcmlmaWNhciBlbiBhbWJvcyBidWNrZXRzIChyZXNvdXJjZUNvdW50SXMgdmFsaWRhIHF1ZSBleGlzdGVuIDIgY29uIGVzdGUgY29uZmlnKVxuICAgICAgdGVtcGxhdGUuYWxsUmVzb3VyY2VzUHJvcGVydGllcygnQVdTOjpTMzo6QnVja2V0Jywge1xuICAgICAgICBQdWJsaWNBY2Nlc3NCbG9ja0NvbmZpZ3VyYXRpb246IE1hdGNoLm9iamVjdExpa2Uoe1xuICAgICAgICAgIEJsb2NrUHVibGljQWNsczogdHJ1ZSxcbiAgICAgICAgICBCbG9ja1B1YmxpY1BvbGljeTogdHJ1ZSxcbiAgICAgICAgICBJZ25vcmVQdWJsaWNBY2xzOiB0cnVlLFxuICAgICAgICAgIFJlc3RyaWN0UHVibGljQnVja2V0czogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ2VsIGJ1Y2tldCBkZSBhc3NldHMgdGllbmUgRXZlbnRCcmlkZ2UgaGFiaWxpdGFkbyBjdWFuZG8gc2UgY29uZmlndXJhJywgKCkgPT4ge1xuICAgICAgY29uc3Qgc3RhY2sgPSBtYWtlU3RhY2soJ0V2ZW50QnJpZGdlVGVzdCcpO1xuICAgICAgbmV3IFMzTW9kdWxlKHN0YWNrLCAnUzNTdG9yYWdlJywge1xuICAgICAgICBidWNrZXRzOiBbYWNjZXNzTG9nc0RlZiwgYXNzZXRzRGVmXSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB0ZW1wbGF0ZSA9IFRlbXBsYXRlLmZyb21TdGFjayhzdGFjayk7XG5cbiAgICAgIC8vIENESyBjb25maWd1cmEgRXZlbnRCcmlkZ2UgdmlhIHVuIEN1c3RvbSBSZXNvdXJjZSAoTGFtYmRhIGhhbmRsZXIpLlxuICAgICAgLy8gVmVyaWZpY2Ftb3MgcXVlIGV4aXN0ZSBlbCByZWN1cnNvIGRlIG5vdGlmaWNhY2nDs24gY29uIEV2ZW50QnJpZGdlQ29uZmlndXJhdGlvbiB2YWPDrW9cbiAgICAgIC8vIChDREsgbG8gZGVqYSB2YWPDrW8gY3VhbmRvIHNvbG8gc2UgaGFiaWxpdGEgRXZlbnRCcmlkZ2Ugc2luIGxpc3RlbmVycyBhZGljaW9uYWxlcykuXG4gICAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0N1c3RvbTo6UzNCdWNrZXROb3RpZmljYXRpb25zJywge1xuICAgICAgICBOb3RpZmljYXRpb25Db25maWd1cmF0aW9uOiBNYXRjaC5vYmplY3RMaWtlKHtcbiAgICAgICAgICBFdmVudEJyaWRnZUNvbmZpZ3VyYXRpb246IHt9LFxuICAgICAgICB9KSxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGVzdCgnZWwgYnVja2V0IGRlIGxvZ3Mgc29sbyBwZXJtaXRlIFB1dE9iamVjdCBkZXNkZSBlbCBidWNrZXQgb3JpZ2VuIChsZWFzdCBwcml2aWxlZ2UpJywgKCkgPT4ge1xuICAgICAgY29uc3Qgc3RhY2sgPSBtYWtlU3RhY2soJ0xvZ3NQb2xpY3lMZWFzdFByaXZpbGVnZVRlc3QnKTtcbiAgICAgIG5ldyBTM01vZHVsZShzdGFjaywgJ1MzU3RvcmFnZScsIHtcbiAgICAgICAgYnVja2V0czogW2FjY2Vzc0xvZ3NEZWYsIGFzc2V0c0RlZl0sXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgdGVtcGxhdGUgPSBUZW1wbGF0ZS5mcm9tU3RhY2soc3RhY2spO1xuXG4gICAgICBjb25zdCBwb2xpY2llcyA9IHRlbXBsYXRlLmZpbmRSZXNvdXJjZXMoJ0FXUzo6UzM6OkJ1Y2tldFBvbGljeScpO1xuICAgICAgY29uc3QgcG9saWN5RG9jcyA9IE9iamVjdC52YWx1ZXMocG9saWNpZXMpLm1hcCgocjogYW55KSA9PiByLlByb3BlcnRpZXM/LlBvbGljeURvY3VtZW50KTtcblxuICAgICAgY29uc3QgYWxsU3RhdGVtZW50cyA9IHBvbGljeURvY3NcbiAgICAgICAgLmZsYXRNYXAoKGRvYzogYW55KSA9PiAoZG9jPy5TdGF0ZW1lbnQgPyBkb2MuU3RhdGVtZW50IDogW10pKVxuICAgICAgICAuZmlsdGVyKEJvb2xlYW4pO1xuXG4gICAgICBjb25zdCBzdG10ID0gYWxsU3RhdGVtZW50cy5maW5kKFxuICAgICAgICAoczogYW55KSA9PlxuICAgICAgICAgIHM/LkVmZmVjdCA9PT0gJ0FsbG93JyAmJlxuICAgICAgICAgIHM/LkFjdGlvbiA9PT0gJ3MzOlB1dE9iamVjdCcgJiZcbiAgICAgICAgICBzPy5QcmluY2lwYWw/LlNlcnZpY2UgPT09ICdsb2dnaW5nLnMzLmFtYXpvbmF3cy5jb20nICYmXG4gICAgICAgICAgdHlwZW9mIHM/LlNpZCA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgICBzLlNpZC5pbmNsdWRlcygnQWxsb3dTM1NlcnZlckFjY2Vzc0xvZ3NGcm9tQXNzZXRzJyksXG4gICAgICApO1xuXG4gICAgICBleHBlY3Qoc3RtdCkudG9CZVRydXRoeSgpO1xuICAgICAgZXhwZWN0KHN0bXQuQ29uZGl0aW9uPy5Bcm5MaWtlPy5bJ2F3czpTb3VyY2VBcm4nXSkudG9CZVRydXRoeSgpO1xuICAgICAgZXhwZWN0KHN0bXQuQ29uZGl0aW9uPy5TdHJpbmdFcXVhbHM/LlsnYXdzOlNvdXJjZUFjY291bnQnXSkudG9FcXVhbCh7IFJlZjogJ0FXUzo6QWNjb3VudElkJyB9KTtcblxuICAgICAgLy8gVmFsaWRhciBxdWUgZWwgcmVzb3VyY2UgZXN0w6kgcmVzdHJpbmdpZG8gYSBsYSBydXRhIGVzcGVyYWRhICh0b2tlbml6YWRvIHBvciBDREspXG4gICAgICBleHBlY3QoSlNPTi5zdHJpbmdpZnkoc3RtdC5SZXNvdXJjZSkpLnRvQ29udGFpbignYXNzZXRzL2Rldi1hc3NldHMvKicpO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZSgndmFsaWRhY2lvbmVzJywgKCkgPT4ge1xuICAgIHRlc3QoJ2xhbnphIGVycm9yIHNpIGhheSBsb2dpY2FsTmFtZSBkdXBsaWNhZG9zJywgKCkgPT4ge1xuICAgICAgY29uc3Qgc3RhY2sgPSBtYWtlU3RhY2soJ0R1cGxpY2F0ZU5hbWVUZXN0Jyk7XG4gICAgICBleHBlY3QoKCkgPT4ge1xuICAgICAgICBuZXcgUzNNb2R1bGUoc3RhY2ssICdTM1N0b3JhZ2UnLCB7XG4gICAgICAgICAgYnVja2V0czogW2FjY2Vzc0xvZ3NEZWYsIHsgLi4uYWNjZXNzTG9nc0RlZiwgYnVja2V0TmFtZTogJ2Rldi1hY2Nlc3MtbG9ncy0yJyB9XSxcbiAgICAgICAgfSk7XG4gICAgICB9KS50b1Rocm93KCdbUzNNb2R1bGVdIFRvZG9zIGxvcyBsb2dpY2FsTmFtZSBkZWJlbiBzZXIgw7puaWNvcycpO1xuICAgIH0pO1xuXG4gICAgdGVzdCgnbGFuemEgZXJyb3Igc2kgQ1VTVE9NRVJfTUFOQUdFRCBubyB0aWVuZSBrbXNBbGlhcycsICgpID0+IHtcbiAgICAgIGNvbnN0IHN0YWNrID0gbWFrZVN0YWNrKCdNaXNzaW5nS21zQWxpYXNUZXN0Jyk7XG4gICAgICBleHBlY3QoKCkgPT4ge1xuICAgICAgICBuZXcgUzNNb2R1bGUoc3RhY2ssICdTM1N0b3JhZ2UnLCB7XG4gICAgICAgICAgYnVja2V0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBsb2dpY2FsTmFtZTogJ05vQnVja2V0JyxcbiAgICAgICAgICAgICAgYnVja2V0TmFtZTogJ2Rldi1uby1rZXknLFxuICAgICAgICAgICAgICB2ZXJzaW9uZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICBlbmNyeXB0aW9uVHlwZTogJ0NVU1RPTUVSX01BTkFHRUQnLFxuICAgICAgICAgICAgICByZW1vdmFsUG9saWN5OiAnREVTVFJPWScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuICAgICAgfSkudG9UaHJvdygnbm8gdGllbmUga21zQWxpYXMgZGVmaW5pZG8nKTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ2xhbnphIGVycm9yIHNpIHNlcnZlckFjY2Vzc0xvZ3NUYXJnZXROYW1lIG5vIGV4aXN0ZSBlbiBsYSBsaXN0YScsICgpID0+IHtcbiAgICAgIGNvbnN0IHN0YWNrID0gbWFrZVN0YWNrKCdNaXNzaW5nVGFyZ2V0VGVzdCcpO1xuICAgICAgZXhwZWN0KCgpID0+IHtcbiAgICAgICAgbmV3IFMzTW9kdWxlKHN0YWNrLCAnUzNTdG9yYWdlJywge1xuICAgICAgICAgIGJ1Y2tldHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgLi4uYXNzZXRzRGVmLFxuICAgICAgICAgICAgICBzZXJ2ZXJBY2Nlc3NMb2dzVGFyZ2V0TmFtZTogJ05vbkV4aXN0ZW50QnVja2V0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSk7XG4gICAgICB9KS50b1Rocm93KCdxdWUgbm8gZXhpc3RlIGVuIGxhIGxpc3RhIGRlIGJ1Y2tldHMnKTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ2xhbnphIGVycm9yIHNpIGVsIGJ1Y2tldCBkZXN0aW5vIGRlIGxvZ3Mgbm8gdGllbmUgaXNMb2dzQnVja2V0PXRydWUnLCAoKSA9PiB7XG4gICAgICBjb25zdCBzdGFjayA9IG1ha2VTdGFjaygnTm90QUxvZ3NCdWNrZXRUZXN0Jyk7XG4gICAgICBjb25zdCBub25Mb2dzQnVja2V0OiBTM0J1Y2tldERlZmluaXRpb24gPSB7XG4gICAgICAgIGxvZ2ljYWxOYW1lOiAnTm90TG9ncycsXG4gICAgICAgIGJ1Y2tldE5hbWU6ICdkZXYtbm90LWxvZ3MnLFxuICAgICAgICB2ZXJzaW9uZWQ6IGZhbHNlLFxuICAgICAgICBlbmNyeXB0aW9uVHlwZTogJ1MzX01BTkFHRUQnLFxuICAgICAgICByZW1vdmFsUG9saWN5OiAnREVTVFJPWScsXG4gICAgICAgIC8vIGlzTG9nc0J1Y2tldCBubyBlc3TDoSBkZWZpbmlkbyAodW5kZWZpbmVkID0gZmFsc2UpXG4gICAgICB9O1xuXG4gICAgICBleHBlY3QoKCkgPT4ge1xuICAgICAgICBuZXcgUzNNb2R1bGUoc3RhY2ssICdTM1N0b3JhZ2UnLCB7XG4gICAgICAgICAgYnVja2V0czogW1xuICAgICAgICAgICAgbm9uTG9nc0J1Y2tldCxcbiAgICAgICAgICAgIHsgLi4uYXNzZXRzRGVmLCBzZXJ2ZXJBY2Nlc3NMb2dzVGFyZ2V0TmFtZTogJ05vdExvZ3MnIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSk7XG4gICAgICB9KS50b1Rocm93KCdkZWJlIHRlbmVyIGlzTG9nc0J1Y2tldD10cnVlJyk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCdubyBsYW56YSBlcnJvciBjb24gYXJyYXkgdmFjw61vIChwcmltZXIgc3ludGggZGUgQ0RLKScsICgpID0+IHtcbiAgICAgIGNvbnN0IHN0YWNrID0gbWFrZVN0YWNrKCdFbXB0eUJ1Y2tldHNUZXN0Jyk7XG4gICAgICBleHBlY3QoKCkgPT4ge1xuICAgICAgICBuZXcgUzNNb2R1bGUoc3RhY2ssICdTM1N0b3JhZ2UnLCB7XG4gICAgICAgICAgYnVja2V0czogW10sXG4gICAgICAgIH0pO1xuICAgICAgfSkubm90LnRvVGhyb3coKTtcbiAgICB9KTtcbiAgfSk7XG59KTtcbiJdfQ==