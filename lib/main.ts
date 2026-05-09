#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { loadConfigFromSSM } from './config/ssm-reader';
import { S3Module } from './modules/s3/main';
import { maybeCreateSkorifyOrganizationStack } from './modules/organizations/stack';

const app = new cdk.App();
const environmentName = process.env.SKORIFY_ENVIRONMENT ?? 'dev';

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
