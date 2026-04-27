/**
 * Servicio de configuración basado en AWS Parameter Store
 *
 * Lee la configuración del ambiente desde Parameter Store de la cuenta
 * donde se ejecuta el CDK. Cada cuenta (dev, staging, prod) tiene sus
 * propios valores bajo el prefijo /skorify/.
 *
 * Beneficios:
 * - Un solo código para todos los ambientes
 * - Configuración segura fuera del repositorio
 * - Cada pipeline despliega solo a su cuenta
 *
 * Parámetros requeridos:
 * - /skorify/s3/buckets         → JSON string (S3BucketDefinition[])
 */

import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { S3BucketDefinition } from '../modules/s3/main';

/** Configuración leída desde Parameter Store. */
export interface S3ConfigFromSSM {
  /**
   * Lista de buckets S3 a crear.
   * Parseada desde el parámetro /skorify/s3/buckets (JSON string).
   * Vacía durante el primer cdk synth — CDK resuelve en el segundo pase.
   */
  readonly s3Buckets: S3BucketDefinition[];
}

// ============================================================
// Helpers internos
// ============================================================

/**
 * Lee un parámetro String desde Parameter Store y lo parsea como JSON.
 *
 * Durante el primer `cdk synth`, CDK aún no tiene el valor en cdk.context.json
 * y retorna un placeholder como "dummy-value-for-/skorify/s3/buckets".
 * JSON.parse fallará en ese caso — se retorna `fallback` silenciosamente.
 * CDK hará un segundo synth con el valor real cacheado en cdk.context.json.
 */
function getJsonParameter<T>(scope: Construct, name: string, fallback: T): T {
  const raw = ssm.StringParameter.valueFromLookup(scope, `/skorify/${name}`);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ============================================================
// Función principal de carga
// ============================================================

/**
 * Lee la configuración completa del ambiente desde Parameter Store.
 *
 * Parámetros esperados en la cuenta:
 *   /skorify/s3/buckets        → JSON array de S3BucketDefinition[]
 */
export function loadConfigFromSSM(scope: Construct): S3ConfigFromSSM {
  return {
    s3Buckets: getJsonParameter<S3BucketDefinition[]>(scope, 's3/buckets', []),
  };
}
