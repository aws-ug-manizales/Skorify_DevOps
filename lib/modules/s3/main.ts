import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';

// ============================================================
// Tipos compartidos
// ============================================================

export type EncryptionType = 'S3_MANAGED' | 'KMS_MANAGED' | 'CUSTOMER_MANAGED';
export type RemovalPolicyType = 'RETAIN' | 'DESTROY';

/**
 * Definición de un bucket S3 individual.
 *
 * Cada instancia de esta interfaz genera exactamente un bucket en AWS.
 * El módulo no tiene conocimiento del negocio — solo materializa lo que
 * esta definición declara. Agregar un nuevo bucket = agregar un elemento
 * al array en SSM Parameter Store, sin tocar código.
 */
export interface S3BucketDefinition {
  /**
   * ID lógico único dentro del módulo.
   * Usado como CDK Construct ID y como clave en el mapa de outputs.
   * No puede repetirse dentro de una misma instancia de S3Module.
   */
  readonly logicalName: string;

  /** Nombre físico del bucket en AWS. */
  readonly bucketName: string;

  /** Habilitar versionado de objetos. */
  readonly versioned: boolean;

  /** Tipo de cifrado del bucket. */
  readonly encryptionType: EncryptionType;

  /**
   * Alias de la clave KMS.
   * Requerido cuando encryptionType = 'CUSTOMER_MANAGED'.
   */
  readonly kmsAlias?: string;

  /**
   * logicalName de otro bucket en ESTE módulo que recibirá los access logs.
   * Ese bucket debe tener isLogsBucket = true.
   * Si se omite, no se configura server access logging.
   */
  readonly serverAccessLogsTargetName?: string;

  /** Prefijo de logs dentro del bucket destino. */
  readonly serverAccessLogsPrefix?: string;

  /**
   * Días para transición a S3 Intelligent Tiering.
   * Si se omite, la regla de lifecycle no se crea.
   */
  readonly lifecycleTransitionDays?: number;

  /**
   * Días para abortar uploads multipart incompletos.
   * Si se omite, la regla de lifecycle no se crea.
   */
  readonly abortMultipartUploadDays?: number;

  /**
   * Días de expiración de objetos.
   * Si se omite, la regla de lifecycle no se crea.
   */
  readonly expirationDays?: number;

  /** Política de retención al destruir el stack. */
  readonly removalPolicy: RemovalPolicyType;

  /**
   * Marca este bucket como receptor de access logs de S3.
   * - Configura ObjectOwnership = OBJECT_WRITER
   * - Configura AccessControl = LOG_DELIVERY_WRITE
   * - Agrega la resource policy necesaria para que el servicio S3 escriba logs
   */
  readonly isLogsBucket?: boolean;

  /** Habilitar notificaciones EventBridge para eventos del bucket. */
  readonly eventBridgeEnabled?: boolean;
}

// ============================================================
// Props del módulo
// ============================================================

export interface S3ModuleProps {
  /**
   * Lista de buckets a crear.
   * - Cada elemento genera exactamente un bucket.
   * - Todos los logicalName deben ser únicos.
   * - Los buckets referenciados en serverAccessLogsTargetName
   *   deben existir en esta misma lista con isLogsBucket = true.
   */
  readonly buckets: S3BucketDefinition[];
}

// ============================================================
// S3Module
// ============================================================

/**
 * Módulo de Almacenamiento seguro — Skorify Infraestructura.
 *
 * Crea N buckets S3 a partir de un array de definiciones (S3BucketDefinition[]).
 * Cada bucket es completamente autosuficiente; no hay lógica de negocio hardcodeada.
 *
 * Principios aplicados:
 * - Secure by Default: SSL obligatorio, block public access y cifrado en todos los buckets.
 * - Open/Closed: agregar un bucket = agregar un elemento al array en SSM, sin cambiar código.
 * - Desacoplamiento total: las cross-references entre buckets (ej. logs) se declaran
 *   por logicalName, no por referencia directa.
 * - Fail Fast: validaciones explícitas en el constructor antes de crear cualquier recurso.
 */
export class S3Module extends Construct {
  /** Mapa de todos los buckets creados, indexado por logicalName. */
  public readonly buckets: Record<string, s3.Bucket> = {};

  /** Mapa de claves KMS creadas (solo CUSTOMER_MANAGED), indexado por logicalName. */
  public readonly encryptionKeys: Record<string, kms.Key> = {};

  constructor(scope: Construct, id: string, props: S3ModuleProps) {
    super(scope, id);

    // Guard: durante el primer cdk synth, SSM puede retornar un array vacío
    // (placeholder). CDK hará un segundo synth con los valores reales.
    if (props.buckets.length === 0) {
      return;
    }

    this.validateProps(props);

    // Ordenar las definiciones respetando dependencias de access logging.
    // Un bucket que recibe logs de otro debe existir antes que ese otro.
    const ordered = this.topologicalSort(props.buckets);

    for (const definition of ordered) {
      this.createBucket(definition);
    }
  }

  // ============================================================
  // Validaciones
  // ============================================================

  /**
   * Valida la coherencia de las props antes de crear cualquier recurso en AWS.
   *
   * Se ejecuta como primera acción del constructor (Fail Fast) para detectar
   * errores de configuración en tiempo de síntesis CDK, antes de que CloudFormation
   * intente desplegar algo. Esto evita despliegues parciales y rollbacks costosos.
   *
   * Reglas validadas:
   * 1. Unicidad de `logicalName` — dos buckets no pueden tener el mismo ID lógico
   *    dentro de la misma instancia del módulo.
   * 2. `kmsAlias` obligatorio cuando `encryptionType = 'CUSTOMER_MANAGED'` — CDK
   *    necesita el alias para crear la llave KMS; sin él, el stack falla en deploy.
   * 3. `serverAccessLogsTargetName` debe referenciar un `logicalName` existente
   *    en la misma lista — evita referencias huérfanas que rompen la configuración
   *    de logging en tiempo de síntesis.
   * 4. El bucket destino de logs debe tener `isLogsBucket = true` — S3 solo acepta
   *    escribir server access logs en buckets configurados explícitamente para ello.
   *
   * @param props - Props completas del módulo, incluyendo el array de definiciones.
   * @throws {Error} Si alguna de las reglas anteriores no se cumple.
   */
  private validateProps(props: S3ModuleProps): void {
    // logicalName únicos
    const names = props.buckets.map((b) => b.logicalName);
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      throw new Error('[S3Module] Todos los logicalName deben ser únicos dentro del módulo.');
    }

    for (const bucket of props.buckets) {
      // KMS alias requerido para CUSTOMER_MANAGED
      if (bucket.encryptionType === 'CUSTOMER_MANAGED' && !bucket.kmsAlias) {
        throw new Error(
          `[S3Module] El bucket "${bucket.logicalName}" usa CUSTOMER_MANAGED ` +
            `pero no tiene kmsAlias definido.`,
        );
      }

      // serverAccessLogsTargetName debe referenciar un bucket existente con isLogsBucket=true
      if (bucket.serverAccessLogsTargetName) {
        const target = props.buckets.find(
          (b) => b.logicalName === bucket.serverAccessLogsTargetName,
        );

        if (!target) {
          throw new Error(
            `[S3Module] El bucket "${bucket.logicalName}" referencia ` +
              `serverAccessLogsTargetName="${bucket.serverAccessLogsTargetName}" ` +
              `que no existe en la lista de buckets.`,
          );
        }

        if (!target.isLogsBucket) {
          throw new Error(
            `[S3Module] El bucket "${target.logicalName}" debe tener isLogsBucket=true ` +
              `para recibir logs de "${bucket.logicalName}".`,
          );
        }
      }
    }
  }

  // ============================================================
  // Ordenamiento topológico
  // ============================================================

  /**
   * Ordena las definiciones de buckets respetando dependencias de server access logging.
   *
   * El problema: cuando el bucket B recibe los access logs del bucket A, B debe
   * existir como recurso CDK antes de que A sea creado (ya que A necesita pasar
   * la referencia a B en su constructor). El orden del array original no garantiza
   * esto, por lo que se aplica un ordenamiento topológico.
   *
   * Algoritmo: DFS (Depth-First Search) con detección de ciclos.
   * - Se recorre cada nodo (bucket) recursivamente.
   * - Antes de agregar un nodo al resultado, se visita primero su dependencia
   *   (`serverAccessLogsTargetName`), garantizando que el destino siempre
   *   aparezca antes que el origen en el array resultante.
   * - Se usa un set `visiting` para detectar si un nodo ya está en el stack
   *   de llamadas recursivas actuales (= referencia circular).
   *
   * Ejemplo:
   *   Input:  [Assets → AccessLogs, AccessLogs]
   *   Output: [AccessLogs, Assets]  ← AccessLogs se crea primero
   *
   * @param definitions - Lista de definiciones en cualquier orden.
   * @returns Lista ordenada donde los buckets destino de logs preceden a los origen.
   * @throws {Error} Si se detecta una referencia circular entre buckets.
   */
  private topologicalSort(definitions: S3BucketDefinition[]): S3BucketDefinition[] {
    const byName = new Map(definitions.map((d) => [d.logicalName, d]));
    const sorted: S3BucketDefinition[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string): void => {
      if (visited.has(name)) return;

      if (visiting.has(name)) {
        throw new Error(
          `[S3Module] Referencia circular detectada en serverAccessLogsTargetName: "${name}".`,
        );
      }

      visiting.add(name);
      const def = byName.get(name)!;

      // Visitar primero el bucket destino (debe existir antes)
      if (def.serverAccessLogsTargetName) {
        visit(def.serverAccessLogsTargetName);
      }

      visiting.delete(name);
      visited.add(name);
      sorted.push(def);
    };

    for (const def of definitions) {
      visit(def.logicalName);
    }

    return sorted;
  }

  // ============================================================
  // Helpers de construcción
  // ============================================================

  /**
   * Traduce el `encryptionType` de la definición a los valores concretos que
   * espera el constructor de `s3.Bucket`.
   *
   * Para `CUSTOMER_MANAGED`, crea la clave KMS como un recurso CDK separado
   * y la registra en `this.encryptionKeys` para que otros constructs del stack
   * puedan referenciarla (ej. para otorgar permisos `kms:Decrypt`).
   *
   * La clave KMS siempre se crea con:
   * - Rotación automática habilitada (best practice de seguridad).
   * - `RemovalPolicy.RETAIN` para evitar pérdida de datos cifrados si el stack
   *   se destruye accidentalmente.
   *
   * @param definition - Definición del bucket con el tipo de cifrado declarado.
   * @returns Objeto con los valores listos para pasarle al constructor de `s3.Bucket`.
   */
  private resolveEncryption(definition: S3BucketDefinition): {
    encryption: s3.BucketEncryption;
    encryptionKey?: kms.Key;
    bucketKeyEnabled: boolean;
  } {
    switch (definition.encryptionType) {
      case 'CUSTOMER_MANAGED': {
        const key = new kms.Key(this, `${definition.logicalName}KmsKey`, {
          alias: definition.kmsAlias!,
          description: `KMS Key para el bucket ${definition.bucketName}`,
          enableKeyRotation: true,
          removalPolicy: RemovalPolicy.RETAIN,
        });
        this.encryptionKeys[definition.logicalName] = key;
        return { encryption: s3.BucketEncryption.KMS, encryptionKey: key, bucketKeyEnabled: true };
      }
      case 'KMS_MANAGED':
        return { encryption: s3.BucketEncryption.KMS_MANAGED, bucketKeyEnabled: true };
      case 'S3_MANAGED':
      default:
        return { encryption: s3.BucketEncryption.S3_MANAGED, bucketKeyEnabled: false };
    }
  }

  /**
   * Construye las reglas de lifecycle de S3 a partir de las configuraciones
   * opcionales de la definición.
   *
   * Cada regla se genera solo si el campo correspondiente está definido,
   * manteniendo el principio de que una definición mínima produce un bucket
   * mínimo sin reglas innecesarias.
   *
   * Reglas generadas (en orden):
   * 1. `AbortIncompleteMultipartUploads` — Limpia uploads multipart que quedaron
   *    en estado incompleto (ej. cliente desconectado). Previene acumulación de
   *    datos huérfanos que generan costos sin valor. Solo si `abortMultipartUploadDays`
   *    está definido.
   *
   * 2. `TransitionToIntelligentTiering` — Mueve objetos al storage class
   *    Intelligent-Tiering después de N días para optimización de costos automática.
   *    Si el bucket tiene versionado habilitado, también aplica la transición a
   *    versiones no actuales (`noncurrentVersionTransitions`). Solo si
   *    `lifecycleTransitionDays` está definido.
   *
   * 3. `ObjectExpiration` — Elimina objetos después de N días. Útil para buckets
   *    de logs donde la retención tiene un tope máximo. Solo si `expirationDays`
   *    está definido.
   *
   * @param definition - Definición del bucket con los campos de lifecycle opcionales.
   * @returns Array de reglas de lifecycle listo para pasarle al constructor de `s3.Bucket`.
   *          Retorna un array vacío si ningún campo de lifecycle está definido.
   */
  private buildLifecycleRules(definition: S3BucketDefinition): s3.LifecycleRule[] {
    const rules: s3.LifecycleRule[] = [];

    if (definition.abortMultipartUploadDays) {
      rules.push({
        id: 'AbortIncompleteMultipartUploads',
        abortIncompleteMultipartUploadAfter: Duration.days(definition.abortMultipartUploadDays),
      });
    }

    if (definition.lifecycleTransitionDays) {
      rules.push({
        id: 'TransitionToIntelligentTiering',
        transitions: [
          {
            storageClass: s3.StorageClass.INTELLIGENT_TIERING,
            transitionAfter: Duration.days(definition.lifecycleTransitionDays),
          },
        ],
        ...(definition.versioned && {
          noncurrentVersionTransitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: Duration.days(definition.lifecycleTransitionDays),
            },
          ],
        }),
      });
    }

    if (definition.expirationDays) {
      rules.push({
        id: 'ObjectExpiration',
        expiration: Duration.days(definition.expirationDays),
      });
    }

    return rules;
  }

  /**
   * Materializa una `S3BucketDefinition` en un recurso `s3.Bucket` de CDK.
   *
   * Este método es el núcleo del módulo. Orquesta los helpers de cifrado y
   * lifecycle, resuelve la referencia al bucket de logs (que ya existe en
   * `this.buckets` gracias al ordenamiento topológico previo), y construye
   * el bucket con todas las propiedades de seguridad aplicadas de forma
   * invariable:
   *   - `enforceSSL: true`          → Rechaza cualquier request sin TLS.
   *   - `blockPublicAccess: BLOCK_ALL` → Ningún objeto del bucket es público.
   *   - Cifrado siempre activo       → Determinado por `encryptionType`.
   *
   * Para buckets de logs (`isLogsBucket = true`), además:
   *   - Configura `ObjectOwnership = OBJECT_WRITER` y `AccessControl =
   *     LOG_DELIVERY_WRITE`, que es el requisito de ACL que el servicio
   *     de S3 necesita para poder escribir los archivos de log.
   *   - Agrega una `ResourcePolicy` que permite `s3:PutObject` al principal
   *     `s3.amazonaws.com` con la condición de ACL `bucket-owner-full-control`,
   *     garantizando que el dueño del bucket retiene control total sobre los logs.
   *
   * Al finalizar, registra el bucket creado en `this.buckets[logicalName]`
   * para que esté disponible tanto para los buckets que lo referencian como
   * destino de logs, como para los consumidores externos del módulo.
   *
   * @param definition - Definición del bucket a crear. Debe haber pasado `validateProps`.
   */
  private createBucket(definition: S3BucketDefinition): void {
    const { encryption, encryptionKey, bucketKeyEnabled } = this.resolveEncryption(definition);
    const lifecycleRules = this.buildLifecycleRules(definition);
    const removalPolicy =
      definition.removalPolicy === 'RETAIN' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // Resolver referencia al bucket de logs (ya fue creado gracias al sort)
    const serverAccessLogsBucket = definition.serverAccessLogsTargetName
      ? this.buckets[definition.serverAccessLogsTargetName]
      : undefined;

    const bucket = new s3.Bucket(this, definition.logicalName, {
      bucketName: definition.bucketName,
      removalPolicy,
      autoDeleteObjects: definition.removalPolicy === 'DESTROY',
      encryption,
      encryptionKey,
      bucketKeyEnabled,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: definition.versioned,
      eventBridgeEnabled: definition.eventBridgeEnabled ?? false,
      objectOwnership: definition.isLogsBucket
        ? s3.ObjectOwnership.OBJECT_WRITER
        : s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      ...(definition.isLogsBucket && {
        accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      }),
      ...(serverAccessLogsBucket && {
        serverAccessLogsBucket,
        serverAccessLogsPrefix: definition.serverAccessLogsPrefix,
      }),
      ...(lifecycleRules.length > 0 && { lifecycleRules }),
    });

    // Policy least-privilege para permitir entrega de logs S3 en el bucket destino.
    // Se agrega SOLO cuando un bucket declara server access logging hacia otro.
    if (serverAccessLogsBucket) {
      this.allowServerAccessLogsDelivery({
        targetLogsBucket: serverAccessLogsBucket,
        sourceBucket: bucket,
        sourceBucketName: definition.bucketName,
        targetPrefix: definition.serverAccessLogsPrefix,
      });
    }

    this.buckets[definition.logicalName] = bucket;
  }

  private allowServerAccessLogsDelivery(params: {
    targetLogsBucket: s3.Bucket;
    sourceBucket: s3.Bucket;
    sourceBucketName: string;
    targetPrefix?: string;
  }): void {
    const prefix = (params.targetPrefix ?? '').trim();
    const normalizedPrefix = prefix.length === 0 ? '' : prefix.endsWith('/') ? prefix : `${prefix}/`;

    // El formato típico de server access logs agrega el nombre del bucket origen como subfolder.
    // Ej: <targetPrefix><sourceBucketName>/YYYY-mm-dd-...
    const resource = params.targetLogsBucket.arnForObjects(
      `${normalizedPrefix}${params.sourceBucketName}/*`,
    );

    params.targetLogsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: `AllowS3ServerAccessLogsFrom${params.sourceBucket.node.id}`,
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('logging.s3.amazonaws.com')],
        actions: ['s3:PutObject'],
        resources: [resource],
        // Protege contra confused deputy y limita el origen de los logs.
        conditions: {
          ArnLike: { 'aws:SourceArn': params.sourceBucket.bucketArn },
          StringEquals: { 'aws:SourceAccount': params.sourceBucket.stack.account },
        },
      }),
    );
  }
}
