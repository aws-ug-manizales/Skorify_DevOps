#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { loadConfigFromSSM } from './config/ssm-reader';
import { getVpcModulePropsFromEnv } from './config/networking-env';
import { S3Module } from './modules/s3/main';
import { VpcModule } from './modules/vpc/main';
import { maybeCreateSkorifyOrganizationStack } from './modules/organizations/stack';
import { maybeCreateSkorifyBootstrapStack } from './modules/iam/oidc-and-roles/stack';

const app = new cdk.App();
const environmentName = process.env.SKORIFY_ENVIRONMENT ?? 'produccion';
const enableNetworking = (process.env.SKORIFY_ENABLE_NETWORKING ?? 'true').toLowerCase() === 'true';

// ==========================================
// Skorify CDK App: configuración desde Parameter Store
// ==========================================
// Este código lee la configuración desde Parameter Store de la cuenta
// donde se ejecuta. Cada cuenta (dev, staging, prod) tiene sus propios
// valores bajo el prefijo /skorify/.
//
// Parámetros requeridos en Parameter Store:
//   /skorify/s3/buckets        → JSON array de S3BucketDefinition[]
// ==========================================

const lookupStack = new cdk.Stack(app, 'SkorifyConfigLookup', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

const config = loadConfigFromSSM(lookupStack);

// ==========================================
// Stack principal
// ==========================================
const envStack = new cdk.Stack(app, 'SkorifyInfra', {
  stackName: 'skorify-infra',

  // El entorno (account/region) se toma del CLI/rol activo.
  // No se hardcodean cuentas aquí.

  description: `Infraestructura base para el ambiente: ${environmentName}`,

  tags: {
    Environment: environmentName,
    Project: 'Skorify_Infraestructura',
    ManagedBy: 'AWS CDK',
  },
});

// ==========================================
// Módulo de Almacenamiento (S3)
//
// Guard: durante el primer cdk synth, SSM retorna un placeholder y
// s3Buckets estará vacío. El módulo lo maneja internamente con un
// early return. CDK resolverá los valores reales en el segundo synth.
// ==========================================
if (config.s3Buckets.length > 0) {
  new S3Module(envStack, 'S3Storage', {
    buckets: config.s3Buckets,
  });
}
/**
 * Módulo de VPC: parámetros de red para la VPC privada.
 * 
 * Inicializa la red privada base (VPC, subnets y rutas) para que otros módulos desplieguen recursos internos.
 * 
 */
if (enableNetworking) {
  new VpcModule(envStack, 'Network', getVpcModulePropsFromEnv());
}

// ==========================================
// Stack de Organization (solo aparece y se despliega desde master)
// ==========================================
// Lectura de env y delegación al helper. El helper aplica:
//   - Materialización condicional: solo si la cuenta activa es la master.
//   - Filtrado por fase: si SKORIFY_ORG_IMPORT_PHASE está activo, solo
//     las cuentas marcadas `existing: true`.
// Detalle del flujo en docs/runbooks/oidc-bootstrap.md y en
// lib/modules/organizations/stack.ts.
// ==========================================
maybeCreateSkorifyOrganizationStack(app, {
  currentAccount: process.env.CDK_DEFAULT_ACCOUNT,
  importPhase: process.env.SKORIFY_ORG_IMPORT_PHASE === 'true',
});

// ==========================================
// Stack de Bootstrap OIDC (se materializa según la cuenta activa)
// ==========================================
// Master: roles awsug-pagina-web-deploy y awsug-pagina-web-infra.
// DEV/STG/PROD: 6 roles Skorify (backend, frontend, frontend-infra, data,
// infra, ops-readonly).
// Cuentas no modeladas: undefined, el stack no aparece en cdk list.
// Detalle en docs/runbooks/oidc-bootstrap.md y en
// lib/modules/iam/oidc-and-roles/stack.ts.
// ==========================================
maybeCreateSkorifyBootstrapStack(app, {
  currentAccount: process.env.CDK_DEFAULT_ACCOUNT,
});
