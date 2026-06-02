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

// Constantes de la infra de Pagina_Web en la cuenta master.
const PAGINA_WEB_ACCOUNT = '746669207643';
const PAGINA_WEB_BUCKET = 'web-aws-group-manizales';
const PAGINA_WEB_DISTRIBUTION = 'E3OT8P8FKMB7Q7';
const PAGINA_WEB_TF_STATE_BUCKET = 'aws-ug-manizales-tf-state-746669207643';

/**
 * `awsug-pagina-web-deploy`. Rol del workflow para sincronizar los
 * assets estáticos: S3 sync sobre `web-aws-group-manizales` y CloudFront
 * invalidate sobre `E3OT8P8FKMB7Q7`. Bajo privilegio, uso frecuente.
 */
export function paginaWebDeployStatements(): iam.PolicyStatement[] {
  return [
    new iam.PolicyStatement({
      sid: 'ListPaginaWebBucket',
      actions: ['s3:ListBucket'],
      resources: [`arn:aws:s3:::${PAGINA_WEB_BUCKET}`],
    }),
    new iam.PolicyStatement({
      sid: 'WritePaginaWebBucketObjects',
      actions: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
      resources: [`arn:aws:s3:::${PAGINA_WEB_BUCKET}/*`],
    }),
    new iam.PolicyStatement({
      sid: 'InvalidatePaginaWebDistribution',
      actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
      resources: [`arn:aws:cloudfront::${PAGINA_WEB_ACCOUNT}:distribution/${PAGINA_WEB_DISTRIBUTION}`],
    }),
  ];
}

/**
 * `awsug-pagina-web-infra`. Rol del workflow para `terraform apply` de
 * la infra de Pagina_Web (CloudFront, config del bucket S3, response
 * headers policy, OAC). Alto privilegio, uso raro: solo en merge a
 * `main`, detrás del GitHub Environment `production` con required
 * reviewers. No gestiona los objetos S3 (esos los sincroniza
 * `awsug-pagina-web-deploy`); el `removed` block del Terraform los dejó
 * fuera del state.
 *
 * Incluye acceso de lectura/escritura al bucket de state remoto
 * `aws-ug-manizales-tf-state-746669207643` (Terraform lo necesita para
 * el state y el lock nativo de S3).
 */
export function paginaWebInfraStatements(): iam.PolicyStatement[] {
  return [
    new iam.PolicyStatement({
      sid: 'TerraformStateBucket',
      actions: ['s3:ListBucket', 's3:GetBucketVersioning'],
      resources: [`arn:aws:s3:::${PAGINA_WEB_TF_STATE_BUCKET}`],
    }),
    new iam.PolicyStatement({
      sid: 'TerraformStateObjects',
      // El state y el lockfile nativo (use_lockfile) viven bajo la key
      // pagina-web/terraform.tfstate (y .tflock).
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: [`arn:aws:s3:::${PAGINA_WEB_TF_STATE_BUCKET}/pagina-web/*`],
    }),
    new iam.PolicyStatement({
      sid: 'PaginaWebBucketConfig',
      // Gestionar el bucket y su configuración (versioning, encryption,
      // policy, public access block, ownership). NO objetos.
      actions: [
        's3:GetBucket*',
        's3:PutBucket*',
        's3:GetEncryptionConfiguration',
        's3:PutEncryptionConfiguration',
        's3:GetBucketPolicy',
        's3:PutBucketPolicy',
        's3:DeleteBucketPolicy',
        's3:GetAccelerateConfiguration',
        's3:CreateBucket',
        's3:ListBucket',
      ],
      resources: [`arn:aws:s3:::${PAGINA_WEB_BUCKET}`],
    }),
    new iam.PolicyStatement({
      sid: 'CloudFrontInfraGlobal',
      // Estas acciones no tienen resource type en la CloudFront Service
      // Authorization Reference: solo se autorizan con Resource "*". Crear
      // distros/OAC/response-headers-policy y listar (el ID no existe hasta
      // crearlo, así que no hay ARN que poner). Para crear con tags se usa
      // cloudfront:CreateDistribution + cloudfront:TagResource (este último
      // está en CloudFrontInfraResources).
      actions: [
        'cloudfront:CreateDistribution',
        'cloudfront:CreateOriginAccessControl',
        'cloudfront:CreateResponseHeadersPolicy',
        'cloudfront:ListDistributions',
        'cloudfront:ListOriginAccessControls',
        'cloudfront:ListResponseHeadersPolicies',
      ],
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      sid: 'CloudFrontInfraResources',
      // CloudFront es global; los ARNs llevan el accountId. Gestionar la
      // distro, los OAC y las response headers policies ya creados.
      actions: [
        'cloudfront:GetDistribution',
        'cloudfront:GetDistributionConfig',
        'cloudfront:UpdateDistribution',
        'cloudfront:TagResource',
        'cloudfront:UntagResource',
        'cloudfront:ListTagsForResource',
        'cloudfront:GetOriginAccessControl',
        'cloudfront:GetOriginAccessControlConfig',
        'cloudfront:UpdateOriginAccessControl',
        'cloudfront:GetResponseHeadersPolicy',
        'cloudfront:GetResponseHeadersPolicyConfig',
        'cloudfront:UpdateResponseHeadersPolicy',
      ],
      resources: [
        `arn:aws:cloudfront::${PAGINA_WEB_ACCOUNT}:distribution/*`,
        `arn:aws:cloudfront::${PAGINA_WEB_ACCOUNT}:origin-access-control/*`,
        `arn:aws:cloudfront::${PAGINA_WEB_ACCOUNT}:response-headers-policy/*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'AcmRead',
      // Terraform lee el certificado ACM referenciado por la distro.
      actions: ['acm:DescribeCertificate', 'acm:ListCertificates', 'acm:ListTagsForCertificate'],
      resources: ['*'],
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
    new iam.PolicyStatement({
      sid: 'CognitoBackendUserPool',
      // El template SAM crea el UserPool + Client + triggers (PreSignUp/
      // PostConfirmation) y su dominio. CreateUserPool no admite scoping
      // por ARN/nombre, así que el recurso es '*'.
      actions: [
        'cognito-idp:CreateUserPool',
        'cognito-idp:DeleteUserPool',
        'cognito-idp:UpdateUserPool',
        'cognito-idp:DescribeUserPool',
        'cognito-idp:GetUserPoolMfaConfig',
        'cognito-idp:SetUserPoolMfaConfig',
        'cognito-idp:CreateUserPoolClient',
        'cognito-idp:UpdateUserPoolClient',
        'cognito-idp:DeleteUserPoolClient',
        'cognito-idp:DescribeUserPoolClient',
        'cognito-idp:CreateUserPoolDomain',
        'cognito-idp:DeleteUserPoolDomain',
        'cognito-idp:DescribeUserPoolDomain',
        'cognito-idp:TagResource',
        'cognito-idp:UntagResource',
      ],
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      sid: 'Ec2SecurityGroupBackend',
      // LambdaSecurityGroup + Lambdas en VPC. Los describe/create de EC2 no
      // soportan scoping por nombre, así que el recurso es '*'.
      actions: [
        'ec2:CreateSecurityGroup',
        'ec2:DeleteSecurityGroup',
        'ec2:DescribeSecurityGroups',
        'ec2:DescribeSecurityGroupRules',
        'ec2:AuthorizeSecurityGroupIngress',
        'ec2:AuthorizeSecurityGroupEgress',
        'ec2:RevokeSecurityGroupIngress',
        'ec2:RevokeSecurityGroupEgress',
        'ec2:CreateTags',
        'ec2:DeleteTags',
        'ec2:DescribeVpcs',
        'ec2:DescribeSubnets',
        'ec2:DescribeNetworkInterfaces',
      ],
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      sid: 'BackendManagedPolicy',
      // LambdaSharedPolicy (managed policy `skorify-dev-lambda-policy`).
      actions: [
        'iam:CreatePolicy',
        'iam:DeletePolicy',
        'iam:CreatePolicyVersion',
        'iam:DeletePolicyVersion',
        'iam:GetPolicy',
        'iam:GetPolicyVersion',
        'iam:ListPolicyVersions',
        'iam:ListEntitiesForPolicy',
        'iam:TagPolicy',
        'iam:UntagPolicy',
      ],
      resources: [`arn:aws:iam::${accountId}:policy/skorify-dev-*`],
    }),
    new iam.PolicyStatement({
      sid: 'SsmPlatformParamsRead',
      // Parámetros de plataforma que el template resuelve al desplegar
      // (db-secret-arn, data-bus-name, storage/buckets).
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [
        `arn:aws:ssm:*:${accountId}:parameter/skorify/dev/*`,
        `arn:aws:ssm:*:${accountId}:parameter/skorify/s3/*`,
      ],
    }),
  ];
}

// ============================================================
// Frontend Skorify (Next.js SSG en S3+CloudFront, ADR-INFRA-0003)
// ============================================================

/**
 * `skorify-frontend-deploy`. Rol del workflow para sincronizar los
 * artefactos del export estático: `next build && next export` y luego
 * `aws s3 sync out/ s3://skorify-frontend-{env}` + `cloudfront
 * create-invalidation`. Bajo privilegio, uso frecuente. NO gestiona
 * infra (eso es de `skorify-frontend-infra`).
 */
export function skorifyFrontendDeployStatements(accountId: string): iam.PolicyStatement[] {
  return [
    new iam.PolicyStatement({
      sid: 'ListFrontendBucket',
      actions: ['s3:ListBucket'],
      resources: [`arn:aws:s3:::skorify-frontend-*`],
    }),
    new iam.PolicyStatement({
      sid: 'WriteFrontendBucketObjects',
      actions: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
      resources: [`arn:aws:s3:::skorify-frontend-*/*`],
    }),
    new iam.PolicyStatement({
      sid: 'InvalidateFrontendDistribution',
      actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
      resources: [`arn:aws:cloudfront::${accountId}:distribution/*`],
    }),
  ];
}

/**
 * `skorify-frontend-infra`. Rol del workflow para `cdk deploy` de la
 * infra del frontend (stack `skorify-frontend-{env}`: bucket privado,
 * CloudFront con OAC, response headers policy, error pages, y Route53/
 * ACM cuando haya dominio). Alto privilegio, uso raro: el workflow del
 * frontend lo pone detrás de un GitHub Environment con required
 * reviewers. No gestiona los objetos del bucket (esos los sincroniza
 * `skorify-frontend-deploy`). Ver ADR-INFRA-0003.
 */
export function skorifyFrontendInfraStatements(accountId: string): iam.PolicyStatement[] {
  return [
    new iam.PolicyStatement({
      sid: 'AssumeCdkBootstrapRoles',
      actions: ['sts:AssumeRole'],
      resources: [`arn:aws:iam::${accountId}:role/cdk-hnb659fds-*-${accountId}-*`],
    }),
    new iam.PolicyStatement({
      sid: 'CloudFormationFrontendStacks',
      actions: ['cloudformation:*'],
      resources: [
        `arn:aws:cloudformation:*:${accountId}:stack/skorify-frontend/*`,
        `arn:aws:cloudformation:*:${accountId}:stack/skorify-frontend-*/*`,
        `arn:aws:cloudformation:*:${accountId}:stack/CDKToolkit/*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'FrontendBucketConfig',
      // Gestionar el bucket y su configuración; no objetos.
      actions: [
        's3:CreateBucket',
        's3:DeleteBucket',
        's3:GetBucket*',
        's3:PutBucket*',
        's3:GetEncryptionConfiguration',
        's3:PutEncryptionConfiguration',
        's3:GetBucketPolicy',
        's3:PutBucketPolicy',
        's3:DeleteBucketPolicy',
        's3:ListBucket',
      ],
      resources: [`arn:aws:s3:::skorify-frontend-*`],
    }),
    new iam.PolicyStatement({
      sid: 'CloudFrontFrontendGlobal',
      // Sin resource type en la CloudFront Service Authorization Reference:
      // solo se autorizan con Resource "*" (crear/listar; el ID del recurso
      // no existe antes de crearlo). Para crear con tags se usa
      // cloudfront:CreateDistribution + cloudfront:TagResource (este último
      // está en CloudFrontFrontendResources).
      actions: [
        'cloudfront:CreateDistribution',
        'cloudfront:CreateOriginAccessControl',
        'cloudfront:CreateResponseHeadersPolicy',
        'cloudfront:ListDistributions',
        'cloudfront:ListOriginAccessControls',
        'cloudfront:ListResponseHeadersPolicies',
      ],
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      sid: 'CloudFrontFrontendResources',
      actions: [
        'cloudfront:GetDistribution',
        'cloudfront:GetDistributionConfig',
        'cloudfront:UpdateDistribution',
        'cloudfront:DeleteDistribution',
        'cloudfront:TagResource',
        'cloudfront:UntagResource',
        'cloudfront:ListTagsForResource',
        'cloudfront:GetOriginAccessControl',
        'cloudfront:GetOriginAccessControlConfig',
        'cloudfront:UpdateOriginAccessControl',
        'cloudfront:DeleteOriginAccessControl',
        'cloudfront:GetResponseHeadersPolicy',
        'cloudfront:GetResponseHeadersPolicyConfig',
        'cloudfront:UpdateResponseHeadersPolicy',
        'cloudfront:DeleteResponseHeadersPolicy',
      ],
      resources: [
        `arn:aws:cloudfront::${accountId}:distribution/*`,
        `arn:aws:cloudfront::${accountId}:origin-access-control/*`,
        `arn:aws:cloudfront::${accountId}:response-headers-policy/*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'Route53Frontend',
      // Route53 no soporta resource-level granular para la mayoría de
      // estas acciones; se acota por la trust policy OIDC.
      actions: [
        'route53:GetHostedZone',
        'route53:ListHostedZones',
        'route53:ListHostedZonesByName',
        'route53:CreateHostedZone',
        'route53:ChangeResourceRecordSets',
        'route53:ListResourceRecordSets',
        'route53:GetChange',
        'route53:ChangeTagsForResource',
        'route53:ListTagsForResource',
      ],
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      sid: 'AcmFrontend',
      actions: [
        'acm:DescribeCertificate',
        'acm:ListCertificates',
        'acm:ListTagsForCertificate',
        'acm:RequestCertificate',
        'acm:AddTagsToCertificate',
        'acm:DeleteCertificate',
      ],
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      sid: 'CdkAssetsFrontendInfra',
      actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
      resources: [
        `arn:aws:s3:::cdk-hnb659fds-assets-${accountId}-*`,
        `arn:aws:s3:::cdk-hnb659fds-assets-${accountId}-*/*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'SsmBootstrapRead',
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:*:${accountId}:parameter/cdk-bootstrap/*`],
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
