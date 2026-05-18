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
/**
 * Lee la configuración completa del ambiente desde Parameter Store.
 *
 * Parámetros esperados en la cuenta:
 *   /skorify/s3/buckets        → JSON array de S3BucketDefinition[]
 */
export declare function loadConfigFromSSM(scope: Construct): S3ConfigFromSSM;
