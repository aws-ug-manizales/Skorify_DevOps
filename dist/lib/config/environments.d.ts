/**
 * Configuración global de la infraestructura de Skorify
 *
 * Sigue el principio "Separation of Concerns". Todos los valores de
 * configuración para cada entorno de AWS viven aquí de forma agnóstica a los módulos.
 */
export interface S3Config {
    /** Bucket dedicado para access logs del grupo de buckets gestionados por esta invocación. */
    readonly accessLogsBucket?: S3AccessLogsBucketConfig;
    /** Buckets a crear para el entorno. Permite componer almacenamiento por lotes desde configuración. */
    readonly buckets: readonly S3BucketConfig[];
}
export type S3BucketEncryptionType = 'S3_MANAGED' | 'KMS_MANAGED' | 'CUSTOMER_MANAGED';
export type S3RemovalPolicyName = 'DESTROY' | 'RETAIN';
export type S3StorageClassName = 'INTELLIGENT_TIERING' | 'STANDARD_IA' | 'ONE_ZONE_IA' | 'GLACIER_IR' | 'GLACIER' | 'DEEP_ARCHIVE';
export interface S3AccessLogsBucketConfig {
    /** Identificador lógico del bucket de logs. */
    readonly id: string;
    /** Nombre físico opcional del bucket de logs. */
    readonly bucketName?: string;
    /** Días tras los cuales expiran los logs. */
    readonly expirationDays?: number;
    /** Días para abortar uploads multipart incompletos. */
    readonly abortIncompleteMultipartUploadAfterDays?: number;
}
export interface S3BucketConfig {
    /** Identificador lógico del bucket dentro del módulo. Debe ser único por invocación. */
    readonly id: string;
    /** Nombre físico opcional del bucket. Úsalo solo si una integración lo exige. */
    readonly bucketName?: string;
    /** Política de cifrado del bucket. */
    readonly encryption?: S3BucketEncryptionConfig;
    /** Política de retención del recurso. */
    readonly removalPolicy?: S3RemovalPolicyName;
    /** Permite borrar objetos automáticamente cuando el bucket se destruye. */
    readonly autoDeleteObjects?: boolean;
    /** Habilita versionado del bucket. */
    readonly versioned?: boolean;
    /** Publica eventos del bucket en EventBridge. */
    readonly eventBridgeEnabled?: boolean;
    /** Activa server access logging para este bucket. */
    readonly logging?: S3BucketLoggingConfig;
    /** Reglas de lifecycle para datos y versiones. */
    readonly lifecycleRules?: readonly S3LifecycleRuleConfig[];
}
export interface S3BucketEncryptionConfig {
    /** Tipo de cifrado en reposo. */
    readonly type: S3BucketEncryptionType;
    /** Alias KMS solo cuando se usa CUSTOMER_MANAGED. */
    readonly kmsAlias?: string;
    /** Rotación de la llave KMS administrada por el cliente. */
    readonly enableKeyRotation?: boolean;
}
export interface S3BucketLoggingConfig {
    /** Permite desactivar logging por bucket; por defecto está activo. */
    readonly enabled?: boolean;
    /** Prefijo usado dentro del bucket de logs. */
    readonly prefix?: string;
}
export interface S3TransitionConfig {
    /** Storage class de destino. */
    readonly storageClass: S3StorageClassName;
    /** Días antes de mover la data. */
    readonly transitionAfterDays: number;
}
export interface S3LifecycleRuleConfig {
    /** Identificador de la regla. */
    readonly id?: string;
    /** Prefijo opcional para filtrar objetos. */
    readonly prefix?: string;
    /** Habilita o deshabilita la regla. */
    readonly enabled?: boolean;
    /** Días para expirar versiones actuales. */
    readonly expirationDays?: number;
    /** Días para expirar versiones no actuales. */
    readonly noncurrentVersionExpirationDays?: number;
    /** Días para abortar uploads multipart incompletos. */
    readonly abortIncompleteMultipartUploadAfterDays?: number;
    /** Transiciones de storage class. */
    readonly transitions?: readonly S3TransitionConfig[];
}
export interface EnvironmentConfig {
    /** Nombre semántico del entorno (ej. Dev, Staging, Prod) */
    readonly name: string;
    /** Cuenta de AWS destino (ID de 12 dígitos) */
    readonly account?: string;
    /** Región de AWS destino (ej. us-east-1) */
    readonly region?: string;
    /** Configuración inyectada al módulo de Almacenamiento S3 */
    readonly s3: S3Config;
}
/**
 * Matriz global de entornos. Array que será iterado por el Root de CDK.
 */
export declare const environments: EnvironmentConfig[];
