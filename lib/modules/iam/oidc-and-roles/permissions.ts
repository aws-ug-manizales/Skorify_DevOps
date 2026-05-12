import * as iam from 'aws-cdk-lib/aws-iam';

// ============================================================
// Permisos por dominio (least-privilege, alineados con ADR-INFRA-0005)
// ============================================================
//
// Cada función devuelve los statements de un rol. Reciben el accountId
// donde el rol vive para acotar ARNs al ámbito de su cuenta.
//
// Principio: el aislamiento fuerte viene de la frontera de cuenta
// (ADR-INFRA-0002 §6). Estos statements limitan dentro de la cuenta a
// recursos del dominio, usando prefix `skorify-{dominio}-*` donde el
// servicio soporta resource-level permissions.
//
// Validación: estos sets reflejan lo que realmente existe hoy en los
// repos de cada dominio (ver `git log` de aws-ug-manizales/Skorify_*).
// Servicios aspiracionales (SQS/SNS/EventBridge/DynamoDB/etc.) NO se
// incluyen hasta que aparezcan en el código del workload.

// ============================================================
// Pagina_Web (master)
// ============================================================

/**
 * `awsug-pagina-web-deploy`. Único caso con infra real en master:
 * S3 `web-aws-group-manizales` y CloudFront `E3OT8P8FKMB7Q7`.
 */
export function paginaWebDeployStatements(): iam.PolicyStatement[] {
  return [
    new iam.PolicyStatement({
      sid: 'ListPaginaWebBucket',
      actions: ['s3:ListBucket'],
      resources: ['arn:aws:s3:::web-aws-group-manizales'],
    }),
    new iam.PolicyStatement({
      sid: 'WritePaginaWebBucketObjects',
      actions: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
      resources: ['arn:aws:s3:::web-aws-group-manizales/*'],
    }),
    new iam.PolicyStatement({
      sid: 'InvalidatePaginaWebDistribution',
      actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
      resources: ['arn:aws:cloudfront::746669207643:distribution/E3OT8P8FKMB7Q7'],
    }),
  ];
}

// ============================================================
// Backend Skorify (SAM serverless)
// ============================================================

/**
 * `skorify-backend-deploy`. Stack actual confirmado en el repo
 * `aws-ug-manizales/Skorify_Backend`:
 * - SAM templates con `AWS::Serverless::Function` (nodejs22.x) +
 *   `AWS::Serverless::Api`.
 * - Comunicación inter-lambda vía `LambdaClient.InvokeCommand`.
 * - Sin SQS/SNS/EventBridge/DynamoDB todavía. Cuando aparezcan en el
 *   código, refinar este set en un PR aparte.
 */
export function skorifyBackendDeployStatements(accountId: string): iam.PolicyStatement[] {
  return [
    new iam.PolicyStatement({
      sid: 'CloudFormationBackendStacks',
      actions: ['cloudformation:*'],
      resources: [
        `arn:aws:cloudformation:*:${accountId}:stack/skorify-backend/*`,
        `arn:aws:cloudformation:*:${accountId}:stack/skorify-backend-*/*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'LambdaBackendFunctions',
      actions: ['lambda:*'],
      resources: [
        `arn:aws:lambda:*:${accountId}:function:skorify-backend-*`,
        `arn:aws:lambda:*:${accountId}:layer:skorify-backend-*`,
        `arn:aws:lambda:*:${accountId}:layer:skorify-backend-*:*`,
        `arn:aws:lambda:*:${accountId}:event-source-mapping:*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'LambdaList',
      actions: ['lambda:ListFunctions', 'lambda:ListLayers', 'lambda:GetAccountSettings'],
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      sid: 'ApiGatewayBackend',
      actions: ['apigateway:*'],
      resources: [
        'arn:aws:apigateway:*::/restapis',
        'arn:aws:apigateway:*::/restapis/*',
        'arn:aws:apigateway:*::/apis',
        'arn:aws:apigateway:*::/apis/*',
        'arn:aws:apigateway:*::/account',
      ],
    }),
    new iam.PolicyStatement({
      sid: 'BackendLogs',
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:DescribeLogGroups',
        'logs:DescribeLogStreams',
        'logs:DeleteLogGroup',
        'logs:PutRetentionPolicy',
        'logs:TagResource',
      ],
      resources: [
        `arn:aws:logs:*:${accountId}:log-group:/aws/lambda/skorify-backend-*`,
        `arn:aws:logs:*:${accountId}:log-group:/aws/lambda/skorify-backend-*:*`,
        `arn:aws:logs:*:${accountId}:log-group:/aws/apigateway/skorify-backend-*`,
        `arn:aws:logs:*:${accountId}:log-group:/aws/apigateway/skorify-backend-*:*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'CloudWatchMetricsBackend',
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: {
        StringEquals: { 'cloudwatch:namespace': ['Skorify/Backend'] },
      },
    }),
    new iam.PolicyStatement({
      sid: 'XRayBackend',
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
        'xray:GetSamplingRules',
        'xray:GetSamplingTargets',
      ],
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      sid: 'CdkSamAssetsBackend',
      // SAM y CDK usan el bucket `cdk-hnb659fds-assets-*` para packaging.
      actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
      resources: [
        `arn:aws:s3:::cdk-hnb659fds-assets-${accountId}-*`,
        `arn:aws:s3:::cdk-hnb659fds-assets-${accountId}-*/*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'BackendIamRoles',
      // Gestionar roles de ejecución de las lambdas del backend.
      actions: [
        'iam:CreateRole',
        'iam:DeleteRole',
        'iam:UpdateRole',
        'iam:AttachRolePolicy',
        'iam:DetachRolePolicy',
        'iam:PutRolePolicy',
        'iam:DeleteRolePolicy',
        'iam:GetRole',
        'iam:GetRolePolicy',
        'iam:ListRolePolicies',
        'iam:ListAttachedRolePolicies',
        'iam:TagRole',
        'iam:UntagRole',
        'iam:PassRole',
      ],
      resources: [`arn:aws:iam::${accountId}:role/skorify-backend-*`],
    }),
    new iam.PolicyStatement({
      sid: 'SsmBackendParameters',
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath',
        'ssm:PutParameter',
        'ssm:DeleteParameter',
      ],
      resources: [`arn:aws:ssm:*:${accountId}:parameter/skorify/backend/*`],
    }),
    new iam.PolicyStatement({
      sid: 'SsmBootstrapRead',
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:*:${accountId}:parameter/cdk-bootstrap/*`],
    }),
  ];
}

// ============================================================
// Frontend Skorify (Next.js, hosting por confirmar)
// ============================================================

/**
 * `skorify-frontend-deploy`. Repo `aws-ug-manizales/Skorify_Frontend`
 * es Next.js 14/15 (con `next-intl`, MUI). El hosting AWS aún no está
 * decidido en código: las opciones razonables son S3+CloudFront (SSG)
 * o AWS Amplify (SSR/ISR). Este set asume SSG+S3+CF; si se elige
 * Amplify, agregar el permiso `amplify:*` sobre apps con prefix
 * `skorify-frontend-*` en un PR de seguimiento.
 */
export function skorifyFrontendDeployStatements(accountId: string): iam.PolicyStatement[] {
  return [
    new iam.PolicyStatement({
      sid: 'CloudFormationFrontendStacks',
      actions: ['cloudformation:*'],
      resources: [
        `arn:aws:cloudformation:*:${accountId}:stack/skorify-frontend/*`,
        `arn:aws:cloudformation:*:${accountId}:stack/skorify-frontend-*/*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'FrontendBuckets',
      actions: ['s3:*'],
      resources: [`arn:aws:s3:::skorify-frontend-*`, `arn:aws:s3:::skorify-frontend-*/*`],
    }),
    new iam.PolicyStatement({
      sid: 'CloudFrontInvalidate',
      actions: [
        'cloudfront:CreateInvalidation',
        'cloudfront:GetInvalidation',
        'cloudfront:ListInvalidations',
      ],
      resources: [`arn:aws:cloudfront::${accountId}:distribution/*`],
    }),
    new iam.PolicyStatement({
      sid: 'CdkAssetsFrontend',
      actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
      resources: [
        `arn:aws:s3:::cdk-hnb659fds-assets-${accountId}-*`,
        `arn:aws:s3:::cdk-hnb659fds-assets-${accountId}-*/*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'PassFrontendRoles',
      actions: ['iam:PassRole'],
      resources: [`arn:aws:iam::${accountId}:role/skorify-frontend-*`],
    }),
  ];
}

// ============================================================
// Data Skorify (migrations runner contra RDS)
// ============================================================

/**
 * `skorify-data-deploy`. Repo `aws-ug-manizales/Skorify_Data` es una
 * librería de migrations (Knex + TypeORM, postgres). El "deploy" es
 * correr migrations contra el RDS de la cuenta.
 *
 * Stack confirmado:
 * - Acceso a Secrets Manager para credenciales del DB
 *   (`skorify/data/*`).
 * - Describe de RDS para resolver endpoints.
 * - VPC describe (cuando el RDS quede en VPC privada, runner necesita
 *   resolver subnets/SGs para conectarse).
 * - CloudFormation `skorify-data-*` para el caso de que el módulo
 *   infra (CDK) gestione el RDS y este rol orqueste el deploy del
 *   stack.
 *
 * No incluye Lambda/SQS/etc: hoy data no es serverless workload, es un
 * tool de migrations.
 */
export function skorifyDataDeployStatements(accountId: string): iam.PolicyStatement[] {
  return [
    new iam.PolicyStatement({
      sid: 'CloudFormationDataStacks',
      actions: ['cloudformation:*'],
      resources: [
        `arn:aws:cloudformation:*:${accountId}:stack/skorify-data/*`,
        `arn:aws:cloudformation:*:${accountId}:stack/skorify-data-*/*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'RdsDataDescribe',
      actions: ['rds:Describe*', 'rds:ListTagsForResource'],
      resources: [
        `arn:aws:rds:*:${accountId}:db:skorify-data-*`,
        `arn:aws:rds:*:${accountId}:cluster:skorify-data-*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'RdsDescribeAll',
      // Estas Describe no aceptan ARN específico.
      actions: [
        'rds:DescribeDBEngineVersions',
        'rds:DescribeOrderableDBInstanceOptions',
        'rds:DescribeDBSubnetGroups',
      ],
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      sid: 'SecretsManagerData',
      // Read creds para conectar al DB; write para que las migrations
      // puedan crear/rotar el secret en el primer deploy.
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
        'secretsmanager:CreateSecret',
        'secretsmanager:UpdateSecret',
        'secretsmanager:TagResource',
      ],
      resources: [`arn:aws:secretsmanager:*:${accountId}:secret:skorify/data/*`],
    }),
    new iam.PolicyStatement({
      sid: 'VpcDataDescribe',
      // Read-only sobre VPC para que el runner resuelva la red del RDS.
      actions: [
        'ec2:DescribeVpcs',
        'ec2:DescribeSubnets',
        'ec2:DescribeSecurityGroups',
        'ec2:DescribeRouteTables',
        'ec2:DescribeAvailabilityZones',
      ],
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      sid: 'KmsDataKeys',
      actions: ['kms:Decrypt', 'kms:DescribeKey'],
      resources: [`arn:aws:kms:*:${accountId}:key/*`],
      conditions: {
        'ForAnyValue:StringLike': {
          'kms:ResourceAliases': ['alias/skorify-data-*'],
        },
      },
    }),
    new iam.PolicyStatement({
      sid: 'DataLogs',
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:DescribeLogGroups',
      ],
      resources: [
        `arn:aws:logs:*:${accountId}:log-group:/aws/rds/instance/skorify-data-*`,
        `arn:aws:logs:*:${accountId}:log-group:/aws/rds/instance/skorify-data-*:*`,
        `arn:aws:logs:*:${accountId}:log-group:/skorify/data/*`,
        `arn:aws:logs:*:${accountId}:log-group:/skorify/data/*:*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'CdkAssetsData',
      actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
      resources: [
        `arn:aws:s3:::cdk-hnb659fds-assets-${accountId}-*`,
        `arn:aws:s3:::cdk-hnb659fds-assets-${accountId}-*/*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'PassDataRoles',
      actions: ['iam:PassRole'],
      resources: [`arn:aws:iam::${accountId}:role/skorify-data-*`],
    }),
    new iam.PolicyStatement({
      sid: 'SsmBootstrapRead',
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:*:${accountId}:parameter/cdk-bootstrap/*`],
    }),
  ];
}

// ============================================================
// Infra Skorify (CDK general del proyecto)
// ============================================================

/**
 * `skorify-infra-deploy`. Despliega el CDK del repo `Skorify_DevOps`:
 * el stack base `skorify-infra` y los `skorify-infra-*` que generen los
 * módulos compartidos (s3, monitoring, etc.).
 *
 * Modelo de confianza CDK: este rol no crea recursos directamente. Con
 * `DefaultStackSynthesizer`, `cdk deploy` asume los roles bootstrap
 * `cdk-hnb659fds-{deploy,lookup,file-publishing,image-publishing}-role`
 * y el changeset lo ejecuta el `cdk-hnb659fds-cfn-exec-role` (que por
 * defecto del bootstrap tiene `AdministratorAccess`). El least-privilege
 * real está en la trust policy OIDC: solo workflows del repo
 * `Skorify_DevOps` en las ramas del ambiente pueden asumir este rol.
 * Acotar el cfn-exec-role requiere rehacer el bootstrap con
 * `--cloudformation-execution-policies` (decisión diferida).
 *
 * **No** puede gestionar los roles del `SkorifyBootstrapStack`
 * (`skorify-backend-deploy`, etc.) ni los OIDC providers: ese stack se
 * aplica desde fuera del CI (humano con SSO Admin). Separación de
 * responsabilidades: el rol que define quién puede deployar no se
 * modifica a sí mismo desde un workflow.
 */
export function skorifyInfraDeployStatements(accountId: string): iam.PolicyStatement[] {
  return [
    new iam.PolicyStatement({
      sid: 'AssumeCdkBootstrapRoles',
      // cdk deploy con DefaultStackSynthesizer asume estos roles para
      // lookups, publicación de assets y creación del changeset.
      actions: ['sts:AssumeRole'],
      resources: [`arn:aws:iam::${accountId}:role/cdk-hnb659fds-*-${accountId}-*`],
    }),
    new iam.PolicyStatement({
      sid: 'CloudFormationSkorifyInfraStacks',
      actions: ['cloudformation:*'],
      resources: [
        `arn:aws:cloudformation:*:${accountId}:stack/skorify-infra/*`,
        `arn:aws:cloudformation:*:${accountId}:stack/skorify-infra-*/*`,
        `arn:aws:cloudformation:*:${accountId}:stack/CDKToolkit/*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'IamSkorifyInfraRoles',
      actions: [
        'iam:CreateRole',
        'iam:DeleteRole',
        'iam:UpdateRole',
        'iam:AttachRolePolicy',
        'iam:DetachRolePolicy',
        'iam:PutRolePolicy',
        'iam:DeleteRolePolicy',
        'iam:GetRole',
        'iam:GetRolePolicy',
        'iam:ListRolePolicies',
        'iam:ListAttachedRolePolicies',
        'iam:TagRole',
        'iam:UntagRole',
        'iam:PassRole',
      ],
      resources: [`arn:aws:iam::${accountId}:role/skorify-infra-*`],
    }),
    new iam.PolicyStatement({
      sid: 'CdkAssetsInfra',
      actions: ['s3:*'],
      resources: [
        `arn:aws:s3:::cdk-hnb659fds-assets-${accountId}-*`,
        `arn:aws:s3:::cdk-hnb659fds-assets-${accountId}-*/*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'SsmSkorifyParameters',
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath',
        'ssm:PutParameter',
      ],
      resources: [`arn:aws:ssm:*:${accountId}:parameter/skorify/*`],
    }),
    new iam.PolicyStatement({
      sid: 'SsmBootstrapRead',
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:*:${accountId}:parameter/cdk-bootstrap/*`],
    }),
  ];
}

// ============================================================
// Ops readonly
// ============================================================

/**
 * `skorify-ops-readonly`. Lectura de CloudWatch, Logs y X-Ray. Sin
 * write a recursos.
 */
export function skorifyOpsReadonlyStatements(): iam.PolicyStatement[] {
  return [
    new iam.PolicyStatement({
      sid: 'CloudWatchRead',
      actions: ['cloudwatch:Get*', 'cloudwatch:Describe*', 'cloudwatch:List*'],
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      sid: 'LogsRead',
      actions: [
        'logs:Get*',
        'logs:Describe*',
        'logs:FilterLogEvents',
        'logs:StartQuery',
        'logs:StopQuery',
        'logs:TestMetricFilter',
      ],
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      sid: 'XRayRead',
      actions: ['xray:Get*', 'xray:BatchGet*', 'xray:List*'],
      resources: ['*'],
    }),
  ];
}
