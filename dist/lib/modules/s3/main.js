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
exports.S3Module = void 0;
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const constructs_1 = require("constructs");
const aws_cdk_lib_1 = require("aws-cdk-lib");
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
class S3Module extends constructs_1.Construct {
    /** Mapa de todos los buckets creados, indexado por logicalName. */
    buckets = {};
    /** Mapa de claves KMS creadas (solo CUSTOMER_MANAGED), indexado por logicalName. */
    encryptionKeys = {};
    constructor(scope, id, props) {
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
    validateProps(props) {
        // logicalName únicos
        const names = props.buckets.map((b) => b.logicalName);
        const uniqueNames = new Set(names);
        if (uniqueNames.size !== names.length) {
            throw new Error('[S3Module] Todos los logicalName deben ser únicos dentro del módulo.');
        }
        for (const bucket of props.buckets) {
            // KMS alias requerido para CUSTOMER_MANAGED
            if (bucket.encryptionType === 'CUSTOMER_MANAGED' && !bucket.kmsAlias) {
                throw new Error(`[S3Module] El bucket "${bucket.logicalName}" usa CUSTOMER_MANAGED ` +
                    `pero no tiene kmsAlias definido.`);
            }
            // serverAccessLogsTargetName debe referenciar un bucket existente con isLogsBucket=true
            if (bucket.serverAccessLogsTargetName) {
                const target = props.buckets.find((b) => b.logicalName === bucket.serverAccessLogsTargetName);
                if (!target) {
                    throw new Error(`[S3Module] El bucket "${bucket.logicalName}" referencia ` +
                        `serverAccessLogsTargetName="${bucket.serverAccessLogsTargetName}" ` +
                        `que no existe en la lista de buckets.`);
                }
                if (!target.isLogsBucket) {
                    throw new Error(`[S3Module] El bucket "${target.logicalName}" debe tener isLogsBucket=true ` +
                        `para recibir logs de "${bucket.logicalName}".`);
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
    topologicalSort(definitions) {
        const byName = new Map(definitions.map((d) => [d.logicalName, d]));
        const sorted = [];
        const visited = new Set();
        const visiting = new Set();
        const visit = (name) => {
            if (visited.has(name))
                return;
            if (visiting.has(name)) {
                throw new Error(`[S3Module] Referencia circular detectada en serverAccessLogsTargetName: "${name}".`);
            }
            visiting.add(name);
            const def = byName.get(name);
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
    resolveEncryption(definition) {
        switch (definition.encryptionType) {
            case 'CUSTOMER_MANAGED': {
                const key = new kms.Key(this, `${definition.logicalName}KmsKey`, {
                    alias: definition.kmsAlias,
                    description: `KMS Key para el bucket ${definition.bucketName}`,
                    enableKeyRotation: true,
                    removalPolicy: aws_cdk_lib_1.RemovalPolicy.RETAIN,
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
    buildLifecycleRules(definition) {
        const rules = [];
        if (definition.abortMultipartUploadDays) {
            rules.push({
                id: 'AbortIncompleteMultipartUploads',
                abortIncompleteMultipartUploadAfter: aws_cdk_lib_1.Duration.days(definition.abortMultipartUploadDays),
            });
        }
        if (definition.lifecycleTransitionDays) {
            rules.push({
                id: 'TransitionToIntelligentTiering',
                transitions: [
                    {
                        storageClass: s3.StorageClass.INTELLIGENT_TIERING,
                        transitionAfter: aws_cdk_lib_1.Duration.days(definition.lifecycleTransitionDays),
                    },
                ],
                ...(definition.versioned && {
                    noncurrentVersionTransitions: [
                        {
                            storageClass: s3.StorageClass.INTELLIGENT_TIERING,
                            transitionAfter: aws_cdk_lib_1.Duration.days(definition.lifecycleTransitionDays),
                        },
                    ],
                }),
            });
        }
        if (definition.expirationDays) {
            rules.push({
                id: 'ObjectExpiration',
                expiration: aws_cdk_lib_1.Duration.days(definition.expirationDays),
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
    createBucket(definition) {
        const { encryption, encryptionKey, bucketKeyEnabled } = this.resolveEncryption(definition);
        const lifecycleRules = this.buildLifecycleRules(definition);
        const removalPolicy = definition.removalPolicy === 'RETAIN' ? aws_cdk_lib_1.RemovalPolicy.RETAIN : aws_cdk_lib_1.RemovalPolicy.DESTROY;
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
    allowServerAccessLogsDelivery(params) {
        const prefix = (params.targetPrefix ?? '').trim();
        const normalizedPrefix = prefix.length === 0 ? '' : prefix.endsWith('/') ? prefix : `${prefix}/`;
        // El formato típico de server access logs agrega el nombre del bucket origen como subfolder.
        // Ej: <targetPrefix><sourceBucketName>/YYYY-mm-dd-...
        const resource = params.targetLogsBucket.arnForObjects(`${normalizedPrefix}${params.sourceBucketName}/*`);
        params.targetLogsBucket.addToResourcePolicy(new iam.PolicyStatement({
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
        }));
    }
}
exports.S3Module = S3Module;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2xpYi9tb2R1bGVzL3MzL21haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsdURBQXlDO0FBQ3pDLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsMkNBQXVDO0FBQ3ZDLDZDQUFzRDtBQWtHdEQsK0RBQStEO0FBQy9ELFdBQVc7QUFDWCwrREFBK0Q7QUFFL0Q7Ozs7Ozs7Ozs7OztHQVlHO0FBQ0gsTUFBYSxRQUFTLFNBQVEsc0JBQVM7SUFDckMsbUVBQW1FO0lBQ25ELE9BQU8sR0FBOEIsRUFBRSxDQUFDO0lBRXhELG9GQUFvRjtJQUNwRSxjQUFjLEdBQTRCLEVBQUUsQ0FBQztJQUU3RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQW9CO1FBQzVELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsd0VBQXdFO1FBQ3hFLG1FQUFtRTtRQUNuRSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQy9CLE9BQU87UUFDVCxDQUFDO1FBRUQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUUxQixzRUFBc0U7UUFDdEUscUVBQXFFO1FBQ3JFLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRXBELEtBQUssTUFBTSxVQUFVLElBQUksT0FBTyxFQUFFLENBQUM7WUFDakMsSUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoQyxDQUFDO0lBQ0gsQ0FBQztJQUVELCtEQUErRDtJQUMvRCxlQUFlO0lBQ2YsK0RBQStEO0lBRS9EOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztPQW9CRztJQUNLLGFBQWEsQ0FBQyxLQUFvQjtRQUN4QyxxQkFBcUI7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Q0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxNQUFNLEdBQUcsQ0FBQztRQUVqRyw2RkFBNkY7UUFDN0Ysc0RBQXNEO1FBQ3RELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLENBQ3BELEdBQUcsZ0JBQWdCLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixJQUFJLENBQ2xELENBQUM7UUFFRixNQUFNLENBQUMsZ0JBQWdCLENBQUMsbUJBQW1CLENBQ3pDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixHQUFHLEVBQUUsOEJBQThCLE1BQU0sQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRTtZQUNoRSxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLFVBQVUsRUFBRSxDQUFDLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLDBCQUEwQixDQUFDLENBQUM7WUFDbEUsT0FBTyxFQUFFLENBQUMsY0FBYyxDQUFDO1lBQ3pCLFNBQVMsRUFBRSxDQUFDLFFBQVEsQ0FBQztZQUNyQixpRUFBaUU7WUFDakUsVUFBVSxFQUFFO2dCQUNWLE9BQU8sRUFBRSxFQUFFLGVBQWUsRUFBRSxNQUFNLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRTtnQkFDM0QsWUFBWSxFQUFFLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFO2FBQ3pFO1NBQ0YsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFyWEQsNEJBcVhDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGttcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mta21zJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgRHVyYXRpb24sIFJlbW92YWxQb2xpY3kgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gVGlwb3MgY29tcGFydGlkb3Ncbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgdHlwZSBFbmNyeXB0aW9uVHlwZSA9ICdTM19NQU5BR0VEJyB8ICdLTVNfTUFOQUdFRCcgfCAnQ1VTVE9NRVJfTUFOQUdFRCc7XG5leHBvcnQgdHlwZSBSZW1vdmFsUG9saWN5VHlwZSA9ICdSRVRBSU4nIHwgJ0RFU1RST1knO1xuXG4vKipcbiAqIERlZmluaWNpw7NuIGRlIHVuIGJ1Y2tldCBTMyBpbmRpdmlkdWFsLlxuICpcbiAqIENhZGEgaW5zdGFuY2lhIGRlIGVzdGEgaW50ZXJmYXogZ2VuZXJhIGV4YWN0YW1lbnRlIHVuIGJ1Y2tldCBlbiBBV1MuXG4gKiBFbCBtw7NkdWxvIG5vIHRpZW5lIGNvbm9jaW1pZW50byBkZWwgbmVnb2NpbyDigJQgc29sbyBtYXRlcmlhbGl6YSBsbyBxdWVcbiAqIGVzdGEgZGVmaW5pY2nDs24gZGVjbGFyYS4gQWdyZWdhciB1biBudWV2byBidWNrZXQgPSBhZ3JlZ2FyIHVuIGVsZW1lbnRvXG4gKiBhbCBhcnJheSBlbiBTU00gUGFyYW1ldGVyIFN0b3JlLCBzaW4gdG9jYXIgY8OzZGlnby5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTM0J1Y2tldERlZmluaXRpb24ge1xuICAvKipcbiAgICogSUQgbMOzZ2ljbyDDum5pY28gZGVudHJvIGRlbCBtw7NkdWxvLlxuICAgKiBVc2FkbyBjb21vIENESyBDb25zdHJ1Y3QgSUQgeSBjb21vIGNsYXZlIGVuIGVsIG1hcGEgZGUgb3V0cHV0cy5cbiAgICogTm8gcHVlZGUgcmVwZXRpcnNlIGRlbnRybyBkZSB1bmEgbWlzbWEgaW5zdGFuY2lhIGRlIFMzTW9kdWxlLlxuICAgKi9cbiAgcmVhZG9ubHkgbG9naWNhbE5hbWU6IHN0cmluZztcblxuICAvKiogTm9tYnJlIGbDrXNpY28gZGVsIGJ1Y2tldCBlbiBBV1MuICovXG4gIHJlYWRvbmx5IGJ1Y2tldE5hbWU6IHN0cmluZztcblxuICAvKiogSGFiaWxpdGFyIHZlcnNpb25hZG8gZGUgb2JqZXRvcy4gKi9cbiAgcmVhZG9ubHkgdmVyc2lvbmVkOiBib29sZWFuO1xuXG4gIC8qKiBUaXBvIGRlIGNpZnJhZG8gZGVsIGJ1Y2tldC4gKi9cbiAgcmVhZG9ubHkgZW5jcnlwdGlvblR5cGU6IEVuY3J5cHRpb25UeXBlO1xuXG4gIC8qKlxuICAgKiBBbGlhcyBkZSBsYSBjbGF2ZSBLTVMuXG4gICAqIFJlcXVlcmlkbyBjdWFuZG8gZW5jcnlwdGlvblR5cGUgPSAnQ1VTVE9NRVJfTUFOQUdFRCcuXG4gICAqL1xuICByZWFkb25seSBrbXNBbGlhcz86IHN0cmluZztcblxuICAvKipcbiAgICogbG9naWNhbE5hbWUgZGUgb3RybyBidWNrZXQgZW4gRVNURSBtw7NkdWxvIHF1ZSByZWNpYmlyw6EgbG9zIGFjY2VzcyBsb2dzLlxuICAgKiBFc2UgYnVja2V0IGRlYmUgdGVuZXIgaXNMb2dzQnVja2V0ID0gdHJ1ZS5cbiAgICogU2kgc2Ugb21pdGUsIG5vIHNlIGNvbmZpZ3VyYSBzZXJ2ZXIgYWNjZXNzIGxvZ2dpbmcuXG4gICAqL1xuICByZWFkb25seSBzZXJ2ZXJBY2Nlc3NMb2dzVGFyZ2V0TmFtZT86IHN0cmluZztcblxuICAvKiogUHJlZmlqbyBkZSBsb2dzIGRlbnRybyBkZWwgYnVja2V0IGRlc3Rpbm8uICovXG4gIHJlYWRvbmx5IHNlcnZlckFjY2Vzc0xvZ3NQcmVmaXg/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIETDrWFzIHBhcmEgdHJhbnNpY2nDs24gYSBTMyBJbnRlbGxpZ2VudCBUaWVyaW5nLlxuICAgKiBTaSBzZSBvbWl0ZSwgbGEgcmVnbGEgZGUgbGlmZWN5Y2xlIG5vIHNlIGNyZWEuXG4gICAqL1xuICByZWFkb25seSBsaWZlY3ljbGVUcmFuc2l0aW9uRGF5cz86IG51bWJlcjtcblxuICAvKipcbiAgICogRMOtYXMgcGFyYSBhYm9ydGFyIHVwbG9hZHMgbXVsdGlwYXJ0IGluY29tcGxldG9zLlxuICAgKiBTaSBzZSBvbWl0ZSwgbGEgcmVnbGEgZGUgbGlmZWN5Y2xlIG5vIHNlIGNyZWEuXG4gICAqL1xuICByZWFkb25seSBhYm9ydE11bHRpcGFydFVwbG9hZERheXM/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIETDrWFzIGRlIGV4cGlyYWNpw7NuIGRlIG9iamV0b3MuXG4gICAqIFNpIHNlIG9taXRlLCBsYSByZWdsYSBkZSBsaWZlY3ljbGUgbm8gc2UgY3JlYS5cbiAgICovXG4gIHJlYWRvbmx5IGV4cGlyYXRpb25EYXlzPzogbnVtYmVyO1xuXG4gIC8qKiBQb2zDrXRpY2EgZGUgcmV0ZW5jacOzbiBhbCBkZXN0cnVpciBlbCBzdGFjay4gKi9cbiAgcmVhZG9ubHkgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeVR5cGU7XG5cbiAgLyoqXG4gICAqIE1hcmNhIGVzdGUgYnVja2V0IGNvbW8gcmVjZXB0b3IgZGUgYWNjZXNzIGxvZ3MgZGUgUzMuXG4gICAqIC0gQ29uZmlndXJhIE9iamVjdE93bmVyc2hpcCA9IE9CSkVDVF9XUklURVJcbiAgICogLSBDb25maWd1cmEgQWNjZXNzQ29udHJvbCA9IExPR19ERUxJVkVSWV9XUklURVxuICAgKiAtIEFncmVnYSBsYSByZXNvdXJjZSBwb2xpY3kgbmVjZXNhcmlhIHBhcmEgcXVlIGVsIHNlcnZpY2lvIFMzIGVzY3JpYmEgbG9nc1xuICAgKi9cbiAgcmVhZG9ubHkgaXNMb2dzQnVja2V0PzogYm9vbGVhbjtcblxuICAvKiogSGFiaWxpdGFyIG5vdGlmaWNhY2lvbmVzIEV2ZW50QnJpZGdlIHBhcmEgZXZlbnRvcyBkZWwgYnVja2V0LiAqL1xuICByZWFkb25seSBldmVudEJyaWRnZUVuYWJsZWQ/OiBib29sZWFuO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFByb3BzIGRlbCBtw7NkdWxvXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGludGVyZmFjZSBTM01vZHVsZVByb3BzIHtcbiAgLyoqXG4gICAqIExpc3RhIGRlIGJ1Y2tldHMgYSBjcmVhci5cbiAgICogLSBDYWRhIGVsZW1lbnRvIGdlbmVyYSBleGFjdGFtZW50ZSB1biBidWNrZXQuXG4gICAqIC0gVG9kb3MgbG9zIGxvZ2ljYWxOYW1lIGRlYmVuIHNlciDDum5pY29zLlxuICAgKiAtIExvcyBidWNrZXRzIHJlZmVyZW5jaWFkb3MgZW4gc2VydmVyQWNjZXNzTG9nc1RhcmdldE5hbWVcbiAgICogICBkZWJlbiBleGlzdGlyIGVuIGVzdGEgbWlzbWEgbGlzdGEgY29uIGlzTG9nc0J1Y2tldCA9IHRydWUuXG4gICAqL1xuICByZWFkb25seSBidWNrZXRzOiBTM0J1Y2tldERlZmluaXRpb25bXTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTM01vZHVsZVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogTcOzZHVsbyBkZSBBbG1hY2VuYW1pZW50byBzZWd1cm8g4oCUIFNrb3JpZnkgSW5mcmFlc3RydWN0dXJhLlxuICpcbiAqIENyZWEgTiBidWNrZXRzIFMzIGEgcGFydGlyIGRlIHVuIGFycmF5IGRlIGRlZmluaWNpb25lcyAoUzNCdWNrZXREZWZpbml0aW9uW10pLlxuICogQ2FkYSBidWNrZXQgZXMgY29tcGxldGFtZW50ZSBhdXRvc3VmaWNpZW50ZTsgbm8gaGF5IGzDs2dpY2EgZGUgbmVnb2NpbyBoYXJkY29kZWFkYS5cbiAqXG4gKiBQcmluY2lwaW9zIGFwbGljYWRvczpcbiAqIC0gU2VjdXJlIGJ5IERlZmF1bHQ6IFNTTCBvYmxpZ2F0b3JpbywgYmxvY2sgcHVibGljIGFjY2VzcyB5IGNpZnJhZG8gZW4gdG9kb3MgbG9zIGJ1Y2tldHMuXG4gKiAtIE9wZW4vQ2xvc2VkOiBhZ3JlZ2FyIHVuIGJ1Y2tldCA9IGFncmVnYXIgdW4gZWxlbWVudG8gYWwgYXJyYXkgZW4gU1NNLCBzaW4gY2FtYmlhciBjw7NkaWdvLlxuICogLSBEZXNhY29wbGFtaWVudG8gdG90YWw6IGxhcyBjcm9zcy1yZWZlcmVuY2VzIGVudHJlIGJ1Y2tldHMgKGVqLiBsb2dzKSBzZSBkZWNsYXJhblxuICogICBwb3IgbG9naWNhbE5hbWUsIG5vIHBvciByZWZlcmVuY2lhIGRpcmVjdGEuXG4gKiAtIEZhaWwgRmFzdDogdmFsaWRhY2lvbmVzIGV4cGzDrWNpdGFzIGVuIGVsIGNvbnN0cnVjdG9yIGFudGVzIGRlIGNyZWFyIGN1YWxxdWllciByZWN1cnNvLlxuICovXG5leHBvcnQgY2xhc3MgUzNNb2R1bGUgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICAvKiogTWFwYSBkZSB0b2RvcyBsb3MgYnVja2V0cyBjcmVhZG9zLCBpbmRleGFkbyBwb3IgbG9naWNhbE5hbWUuICovXG4gIHB1YmxpYyByZWFkb25seSBidWNrZXRzOiBSZWNvcmQ8c3RyaW5nLCBzMy5CdWNrZXQ+ID0ge307XG5cbiAgLyoqIE1hcGEgZGUgY2xhdmVzIEtNUyBjcmVhZGFzIChzb2xvIENVU1RPTUVSX01BTkFHRUQpLCBpbmRleGFkbyBwb3IgbG9naWNhbE5hbWUuICovXG4gIHB1YmxpYyByZWFkb25seSBlbmNyeXB0aW9uS2V5czogUmVjb3JkPHN0cmluZywga21zLktleT4gPSB7fTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogUzNNb2R1bGVQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBHdWFyZDogZHVyYW50ZSBlbCBwcmltZXIgY2RrIHN5bnRoLCBTU00gcHVlZGUgcmV0b3JuYXIgdW4gYXJyYXkgdmFjw61vXG4gICAgLy8gKHBsYWNlaG9sZGVyKS4gQ0RLIGhhcsOhIHVuIHNlZ3VuZG8gc3ludGggY29uIGxvcyB2YWxvcmVzIHJlYWxlcy5cbiAgICBpZiAocHJvcHMuYnVja2V0cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnZhbGlkYXRlUHJvcHMocHJvcHMpO1xuXG4gICAgLy8gT3JkZW5hciBsYXMgZGVmaW5pY2lvbmVzIHJlc3BldGFuZG8gZGVwZW5kZW5jaWFzIGRlIGFjY2VzcyBsb2dnaW5nLlxuICAgIC8vIFVuIGJ1Y2tldCBxdWUgcmVjaWJlIGxvZ3MgZGUgb3RybyBkZWJlIGV4aXN0aXIgYW50ZXMgcXVlIGVzZSBvdHJvLlxuICAgIGNvbnN0IG9yZGVyZWQgPSB0aGlzLnRvcG9sb2dpY2FsU29ydChwcm9wcy5idWNrZXRzKTtcblxuICAgIGZvciAoY29uc3QgZGVmaW5pdGlvbiBvZiBvcmRlcmVkKSB7XG4gICAgICB0aGlzLmNyZWF0ZUJ1Y2tldChkZWZpbml0aW9uKTtcbiAgICB9XG4gIH1cblxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8gVmFsaWRhY2lvbmVzXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gIC8qKlxuICAgKiBWYWxpZGEgbGEgY29oZXJlbmNpYSBkZSBsYXMgcHJvcHMgYW50ZXMgZGUgY3JlYXIgY3VhbHF1aWVyIHJlY3Vyc28gZW4gQVdTLlxuICAgKlxuICAgKiBTZSBlamVjdXRhIGNvbW8gcHJpbWVyYSBhY2Npw7NuIGRlbCBjb25zdHJ1Y3RvciAoRmFpbCBGYXN0KSBwYXJhIGRldGVjdGFyXG4gICAqIGVycm9yZXMgZGUgY29uZmlndXJhY2nDs24gZW4gdGllbXBvIGRlIHPDrW50ZXNpcyBDREssIGFudGVzIGRlIHF1ZSBDbG91ZEZvcm1hdGlvblxuICAgKiBpbnRlbnRlIGRlc3BsZWdhciBhbGdvLiBFc3RvIGV2aXRhIGRlc3BsaWVndWVzIHBhcmNpYWxlcyB5IHJvbGxiYWNrcyBjb3N0b3Nvcy5cbiAgICpcbiAgICogUmVnbGFzIHZhbGlkYWRhczpcbiAgICogMS4gVW5pY2lkYWQgZGUgYGxvZ2ljYWxOYW1lYCDigJQgZG9zIGJ1Y2tldHMgbm8gcHVlZGVuIHRlbmVyIGVsIG1pc21vIElEIGzDs2dpY29cbiAgICogICAgZGVudHJvIGRlIGxhIG1pc21hIGluc3RhbmNpYSBkZWwgbcOzZHVsby5cbiAgICogMi4gYGttc0FsaWFzYCBvYmxpZ2F0b3JpbyBjdWFuZG8gYGVuY3J5cHRpb25UeXBlID0gJ0NVU1RPTUVSX01BTkFHRUQnYCDigJQgQ0RLXG4gICAqICAgIG5lY2VzaXRhIGVsIGFsaWFzIHBhcmEgY3JlYXIgbGEgbGxhdmUgS01TOyBzaW4gw6lsLCBlbCBzdGFjayBmYWxsYSBlbiBkZXBsb3kuXG4gICAqIDMuIGBzZXJ2ZXJBY2Nlc3NMb2dzVGFyZ2V0TmFtZWAgZGViZSByZWZlcmVuY2lhciB1biBgbG9naWNhbE5hbWVgIGV4aXN0ZW50ZVxuICAgKiAgICBlbiBsYSBtaXNtYSBsaXN0YSDigJQgZXZpdGEgcmVmZXJlbmNpYXMgaHXDqXJmYW5hcyBxdWUgcm9tcGVuIGxhIGNvbmZpZ3VyYWNpw7NuXG4gICAqICAgIGRlIGxvZ2dpbmcgZW4gdGllbXBvIGRlIHPDrW50ZXNpcy5cbiAgICogNC4gRWwgYnVja2V0IGRlc3Rpbm8gZGUgbG9ncyBkZWJlIHRlbmVyIGBpc0xvZ3NCdWNrZXQgPSB0cnVlYCDigJQgUzMgc29sbyBhY2VwdGFcbiAgICogICAgZXNjcmliaXIgc2VydmVyIGFjY2VzcyBsb2dzIGVuIGJ1Y2tldHMgY29uZmlndXJhZG9zIGV4cGzDrWNpdGFtZW50ZSBwYXJhIGVsbG8uXG4gICAqXG4gICAqIEBwYXJhbSBwcm9wcyAtIFByb3BzIGNvbXBsZXRhcyBkZWwgbcOzZHVsbywgaW5jbHV5ZW5kbyBlbCBhcnJheSBkZSBkZWZpbmljaW9uZXMuXG4gICAqIEB0aHJvd3Mge0Vycm9yfSBTaSBhbGd1bmEgZGUgbGFzIHJlZ2xhcyBhbnRlcmlvcmVzIG5vIHNlIGN1bXBsZS5cbiAgICovXG4gIHByaXZhdGUgdmFsaWRhdGVQcm9wcyhwcm9wczogUzNNb2R1bGVQcm9wcyk6IHZvaWQge1xuICAgIC8vIGxvZ2ljYWxOYW1lIMO6bmljb3NcbiAgICBjb25zdCBuYW1lcyA9IHByb3BzLmJ1Y2tldHMubWFwKChiKSA9PiBiLmxvZ2ljYWxOYW1lKTtcbiAgICBjb25zdCB1bmlxdWVOYW1lcyA9IG5ldyBTZXQobmFtZXMpO1xuICAgIGlmICh1bmlxdWVOYW1lcy5zaXplICE9PSBuYW1lcy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignW1MzTW9kdWxlXSBUb2RvcyBsb3MgbG9naWNhbE5hbWUgZGViZW4gc2VyIMO6bmljb3MgZGVudHJvIGRlbCBtw7NkdWxvLicpO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgYnVja2V0IG9mIHByb3BzLmJ1Y2tldHMpIHtcbiAgICAgIC8vIEtNUyBhbGlhcyByZXF1ZXJpZG8gcGFyYSBDVVNUT01FUl9NQU5BR0VEXG4gICAgICBpZiAoYnVja2V0LmVuY3J5cHRpb25UeXBlID09PSAnQ1VTVE9NRVJfTUFOQUdFRCcgJiYgIWJ1Y2tldC5rbXNBbGlhcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYFtTM01vZHVsZV0gRWwgYnVja2V0IFwiJHtidWNrZXQubG9naWNhbE5hbWV9XCIgdXNhIENVU1RPTUVSX01BTkFHRUQgYCArXG4gICAgICAgICAgICBgcGVybyBubyB0aWVuZSBrbXNBbGlhcyBkZWZpbmlkby5gLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICAvLyBzZXJ2ZXJBY2Nlc3NMb2dzVGFyZ2V0TmFtZSBkZWJlIHJlZmVyZW5jaWFyIHVuIGJ1Y2tldCBleGlzdGVudGUgY29uIGlzTG9nc0J1Y2tldD10cnVlXG4gICAgICBpZiAoYnVja2V0LnNlcnZlckFjY2Vzc0xvZ3NUYXJnZXROYW1lKSB7XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHByb3BzLmJ1Y2tldHMuZmluZChcbiAgICAgICAgICAoYikgPT4gYi5sb2dpY2FsTmFtZSA9PT0gYnVja2V0LnNlcnZlckFjY2Vzc0xvZ3NUYXJnZXROYW1lLFxuICAgICAgICApO1xuXG4gICAgICAgIGlmICghdGFyZ2V0KSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYFtTM01vZHVsZV0gRWwgYnVja2V0IFwiJHtidWNrZXQubG9naWNhbE5hbWV9XCIgcmVmZXJlbmNpYSBgICtcbiAgICAgICAgICAgICAgYHNlcnZlckFjY2Vzc0xvZ3NUYXJnZXROYW1lPVwiJHtidWNrZXQuc2VydmVyQWNjZXNzTG9nc1RhcmdldE5hbWV9XCIgYCArXG4gICAgICAgICAgICAgIGBxdWUgbm8gZXhpc3RlIGVuIGxhIGxpc3RhIGRlIGJ1Y2tldHMuYCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0YXJnZXQuaXNMb2dzQnVja2V0KSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYFtTM01vZHVsZV0gRWwgYnVja2V0IFwiJHt0YXJnZXQubG9naWNhbE5hbWV9XCIgZGViZSB0ZW5lciBpc0xvZ3NCdWNrZXQ9dHJ1ZSBgICtcbiAgICAgICAgICAgICAgYHBhcmEgcmVjaWJpciBsb2dzIGRlIFwiJHtidWNrZXQubG9naWNhbE5hbWV9XCIuYCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIE9yZGVuYW1pZW50byB0b3BvbMOzZ2ljb1xuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAvKipcbiAgICogT3JkZW5hIGxhcyBkZWZpbmljaW9uZXMgZGUgYnVja2V0cyByZXNwZXRhbmRvIGRlcGVuZGVuY2lhcyBkZSBzZXJ2ZXIgYWNjZXNzIGxvZ2dpbmcuXG4gICAqXG4gICAqIEVsIHByb2JsZW1hOiBjdWFuZG8gZWwgYnVja2V0IEIgcmVjaWJlIGxvcyBhY2Nlc3MgbG9ncyBkZWwgYnVja2V0IEEsIEIgZGViZVxuICAgKiBleGlzdGlyIGNvbW8gcmVjdXJzbyBDREsgYW50ZXMgZGUgcXVlIEEgc2VhIGNyZWFkbyAoeWEgcXVlIEEgbmVjZXNpdGEgcGFzYXJcbiAgICogbGEgcmVmZXJlbmNpYSBhIEIgZW4gc3UgY29uc3RydWN0b3IpLiBFbCBvcmRlbiBkZWwgYXJyYXkgb3JpZ2luYWwgbm8gZ2FyYW50aXphXG4gICAqIGVzdG8sIHBvciBsbyBxdWUgc2UgYXBsaWNhIHVuIG9yZGVuYW1pZW50byB0b3BvbMOzZ2ljby5cbiAgICpcbiAgICogQWxnb3JpdG1vOiBERlMgKERlcHRoLUZpcnN0IFNlYXJjaCkgY29uIGRldGVjY2nDs24gZGUgY2ljbG9zLlxuICAgKiAtIFNlIHJlY29ycmUgY2FkYSBub2RvIChidWNrZXQpIHJlY3Vyc2l2YW1lbnRlLlxuICAgKiAtIEFudGVzIGRlIGFncmVnYXIgdW4gbm9kbyBhbCByZXN1bHRhZG8sIHNlIHZpc2l0YSBwcmltZXJvIHN1IGRlcGVuZGVuY2lhXG4gICAqICAgKGBzZXJ2ZXJBY2Nlc3NMb2dzVGFyZ2V0TmFtZWApLCBnYXJhbnRpemFuZG8gcXVlIGVsIGRlc3Rpbm8gc2llbXByZVxuICAgKiAgIGFwYXJlemNhIGFudGVzIHF1ZSBlbCBvcmlnZW4gZW4gZWwgYXJyYXkgcmVzdWx0YW50ZS5cbiAgICogLSBTZSB1c2EgdW4gc2V0IGB2aXNpdGluZ2AgcGFyYSBkZXRlY3RhciBzaSB1biBub2RvIHlhIGVzdMOhIGVuIGVsIHN0YWNrXG4gICAqICAgZGUgbGxhbWFkYXMgcmVjdXJzaXZhcyBhY3R1YWxlcyAoPSByZWZlcmVuY2lhIGNpcmN1bGFyKS5cbiAgICpcbiAgICogRWplbXBsbzpcbiAgICogICBJbnB1dDogIFtBc3NldHMg4oaSIEFjY2Vzc0xvZ3MsIEFjY2Vzc0xvZ3NdXG4gICAqICAgT3V0cHV0OiBbQWNjZXNzTG9ncywgQXNzZXRzXSAg4oaQIEFjY2Vzc0xvZ3Mgc2UgY3JlYSBwcmltZXJvXG4gICAqXG4gICAqIEBwYXJhbSBkZWZpbml0aW9ucyAtIExpc3RhIGRlIGRlZmluaWNpb25lcyBlbiBjdWFscXVpZXIgb3JkZW4uXG4gICAqIEByZXR1cm5zIExpc3RhIG9yZGVuYWRhIGRvbmRlIGxvcyBidWNrZXRzIGRlc3Rpbm8gZGUgbG9ncyBwcmVjZWRlbiBhIGxvcyBvcmlnZW4uXG4gICAqIEB0aHJvd3Mge0Vycm9yfSBTaSBzZSBkZXRlY3RhIHVuYSByZWZlcmVuY2lhIGNpcmN1bGFyIGVudHJlIGJ1Y2tldHMuXG4gICAqL1xuICBwcml2YXRlIHRvcG9sb2dpY2FsU29ydChkZWZpbml0aW9uczogUzNCdWNrZXREZWZpbml0aW9uW10pOiBTM0J1Y2tldERlZmluaXRpb25bXSB7XG4gICAgY29uc3QgYnlOYW1lID0gbmV3IE1hcChkZWZpbml0aW9ucy5tYXAoKGQpID0+IFtkLmxvZ2ljYWxOYW1lLCBkXSkpO1xuICAgIGNvbnN0IHNvcnRlZDogUzNCdWNrZXREZWZpbml0aW9uW10gPSBbXTtcbiAgICBjb25zdCB2aXNpdGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgdmlzaXRpbmcgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAgIGNvbnN0IHZpc2l0ID0gKG5hbWU6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgaWYgKHZpc2l0ZWQuaGFzKG5hbWUpKSByZXR1cm47XG5cbiAgICAgIGlmICh2aXNpdGluZy5oYXMobmFtZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBbUzNNb2R1bGVdIFJlZmVyZW5jaWEgY2lyY3VsYXIgZGV0ZWN0YWRhIGVuIHNlcnZlckFjY2Vzc0xvZ3NUYXJnZXROYW1lOiBcIiR7bmFtZX1cIi5gLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICB2aXNpdGluZy5hZGQobmFtZSk7XG4gICAgICBjb25zdCBkZWYgPSBieU5hbWUuZ2V0KG5hbWUpITtcblxuICAgICAgLy8gVmlzaXRhciBwcmltZXJvIGVsIGJ1Y2tldCBkZXN0aW5vIChkZWJlIGV4aXN0aXIgYW50ZXMpXG4gICAgICBpZiAoZGVmLnNlcnZlckFjY2Vzc0xvZ3NUYXJnZXROYW1lKSB7XG4gICAgICAgIHZpc2l0KGRlZi5zZXJ2ZXJBY2Nlc3NMb2dzVGFyZ2V0TmFtZSk7XG4gICAgICB9XG5cbiAgICAgIHZpc2l0aW5nLmRlbGV0ZShuYW1lKTtcbiAgICAgIHZpc2l0ZWQuYWRkKG5hbWUpO1xuICAgICAgc29ydGVkLnB1c2goZGVmKTtcbiAgICB9O1xuXG4gICAgZm9yIChjb25zdCBkZWYgb2YgZGVmaW5pdGlvbnMpIHtcbiAgICAgIHZpc2l0KGRlZi5sb2dpY2FsTmFtZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNvcnRlZDtcbiAgfVxuXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyBIZWxwZXJzIGRlIGNvbnN0cnVjY2nDs25cbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgLyoqXG4gICAqIFRyYWR1Y2UgZWwgYGVuY3J5cHRpb25UeXBlYCBkZSBsYSBkZWZpbmljacOzbiBhIGxvcyB2YWxvcmVzIGNvbmNyZXRvcyBxdWVcbiAgICogZXNwZXJhIGVsIGNvbnN0cnVjdG9yIGRlIGBzMy5CdWNrZXRgLlxuICAgKlxuICAgKiBQYXJhIGBDVVNUT01FUl9NQU5BR0VEYCwgY3JlYSBsYSBjbGF2ZSBLTVMgY29tbyB1biByZWN1cnNvIENESyBzZXBhcmFkb1xuICAgKiB5IGxhIHJlZ2lzdHJhIGVuIGB0aGlzLmVuY3J5cHRpb25LZXlzYCBwYXJhIHF1ZSBvdHJvcyBjb25zdHJ1Y3RzIGRlbCBzdGFja1xuICAgKiBwdWVkYW4gcmVmZXJlbmNpYXJsYSAoZWouIHBhcmEgb3RvcmdhciBwZXJtaXNvcyBga21zOkRlY3J5cHRgKS5cbiAgICpcbiAgICogTGEgY2xhdmUgS01TIHNpZW1wcmUgc2UgY3JlYSBjb246XG4gICAqIC0gUm90YWNpw7NuIGF1dG9tw6F0aWNhIGhhYmlsaXRhZGEgKGJlc3QgcHJhY3RpY2UgZGUgc2VndXJpZGFkKS5cbiAgICogLSBgUmVtb3ZhbFBvbGljeS5SRVRBSU5gIHBhcmEgZXZpdGFyIHDDqXJkaWRhIGRlIGRhdG9zIGNpZnJhZG9zIHNpIGVsIHN0YWNrXG4gICAqICAgc2UgZGVzdHJ1eWUgYWNjaWRlbnRhbG1lbnRlLlxuICAgKlxuICAgKiBAcGFyYW0gZGVmaW5pdGlvbiAtIERlZmluaWNpw7NuIGRlbCBidWNrZXQgY29uIGVsIHRpcG8gZGUgY2lmcmFkbyBkZWNsYXJhZG8uXG4gICAqIEByZXR1cm5zIE9iamV0byBjb24gbG9zIHZhbG9yZXMgbGlzdG9zIHBhcmEgcGFzYXJsZSBhbCBjb25zdHJ1Y3RvciBkZSBgczMuQnVja2V0YC5cbiAgICovXG4gIHByaXZhdGUgcmVzb2x2ZUVuY3J5cHRpb24oZGVmaW5pdGlvbjogUzNCdWNrZXREZWZpbml0aW9uKToge1xuICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb247XG4gICAgZW5jcnlwdGlvbktleT86IGttcy5LZXk7XG4gICAgYnVja2V0S2V5RW5hYmxlZDogYm9vbGVhbjtcbiAgfSB7XG4gICAgc3dpdGNoIChkZWZpbml0aW9uLmVuY3J5cHRpb25UeXBlKSB7XG4gICAgICBjYXNlICdDVVNUT01FUl9NQU5BR0VEJzoge1xuICAgICAgICBjb25zdCBrZXkgPSBuZXcga21zLktleSh0aGlzLCBgJHtkZWZpbml0aW9uLmxvZ2ljYWxOYW1lfUttc0tleWAsIHtcbiAgICAgICAgICBhbGlhczogZGVmaW5pdGlvbi5rbXNBbGlhcyEsXG4gICAgICAgICAgZGVzY3JpcHRpb246IGBLTVMgS2V5IHBhcmEgZWwgYnVja2V0ICR7ZGVmaW5pdGlvbi5idWNrZXROYW1lfWAsXG4gICAgICAgICAgZW5hYmxlS2V5Um90YXRpb246IHRydWUsXG4gICAgICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmVuY3J5cHRpb25LZXlzW2RlZmluaXRpb24ubG9naWNhbE5hbWVdID0ga2V5O1xuICAgICAgICByZXR1cm4geyBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLktNUywgZW5jcnlwdGlvbktleToga2V5LCBidWNrZXRLZXlFbmFibGVkOiB0cnVlIH07XG4gICAgICB9XG4gICAgICBjYXNlICdLTVNfTUFOQUdFRCc6XG4gICAgICAgIHJldHVybiB7IGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uS01TX01BTkFHRUQsIGJ1Y2tldEtleUVuYWJsZWQ6IHRydWUgfTtcbiAgICAgIGNhc2UgJ1MzX01BTkFHRUQnOlxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHsgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELCBidWNrZXRLZXlFbmFibGVkOiBmYWxzZSB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdHJ1eWUgbGFzIHJlZ2xhcyBkZSBsaWZlY3ljbGUgZGUgUzMgYSBwYXJ0aXIgZGUgbGFzIGNvbmZpZ3VyYWNpb25lc1xuICAgKiBvcGNpb25hbGVzIGRlIGxhIGRlZmluaWNpw7NuLlxuICAgKlxuICAgKiBDYWRhIHJlZ2xhIHNlIGdlbmVyYSBzb2xvIHNpIGVsIGNhbXBvIGNvcnJlc3BvbmRpZW50ZSBlc3TDoSBkZWZpbmlkbyxcbiAgICogbWFudGVuaWVuZG8gZWwgcHJpbmNpcGlvIGRlIHF1ZSB1bmEgZGVmaW5pY2nDs24gbcOtbmltYSBwcm9kdWNlIHVuIGJ1Y2tldFxuICAgKiBtw61uaW1vIHNpbiByZWdsYXMgaW5uZWNlc2FyaWFzLlxuICAgKlxuICAgKiBSZWdsYXMgZ2VuZXJhZGFzIChlbiBvcmRlbik6XG4gICAqIDEuIGBBYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRzYCDigJQgTGltcGlhIHVwbG9hZHMgbXVsdGlwYXJ0IHF1ZSBxdWVkYXJvblxuICAgKiAgICBlbiBlc3RhZG8gaW5jb21wbGV0byAoZWouIGNsaWVudGUgZGVzY29uZWN0YWRvKS4gUHJldmllbmUgYWN1bXVsYWNpw7NuIGRlXG4gICAqICAgIGRhdG9zIGh1w6lyZmFub3MgcXVlIGdlbmVyYW4gY29zdG9zIHNpbiB2YWxvci4gU29sbyBzaSBgYWJvcnRNdWx0aXBhcnRVcGxvYWREYXlzYFxuICAgKiAgICBlc3TDoSBkZWZpbmlkby5cbiAgICpcbiAgICogMi4gYFRyYW5zaXRpb25Ub0ludGVsbGlnZW50VGllcmluZ2Ag4oCUIE11ZXZlIG9iamV0b3MgYWwgc3RvcmFnZSBjbGFzc1xuICAgKiAgICBJbnRlbGxpZ2VudC1UaWVyaW5nIGRlc3B1w6lzIGRlIE4gZMOtYXMgcGFyYSBvcHRpbWl6YWNpw7NuIGRlIGNvc3RvcyBhdXRvbcOhdGljYS5cbiAgICogICAgU2kgZWwgYnVja2V0IHRpZW5lIHZlcnNpb25hZG8gaGFiaWxpdGFkbywgdGFtYmnDqW4gYXBsaWNhIGxhIHRyYW5zaWNpw7NuIGFcbiAgICogICAgdmVyc2lvbmVzIG5vIGFjdHVhbGVzIChgbm9uY3VycmVudFZlcnNpb25UcmFuc2l0aW9uc2ApLiBTb2xvIHNpXG4gICAqICAgIGBsaWZlY3ljbGVUcmFuc2l0aW9uRGF5c2AgZXN0w6EgZGVmaW5pZG8uXG4gICAqXG4gICAqIDMuIGBPYmplY3RFeHBpcmF0aW9uYCDigJQgRWxpbWluYSBvYmpldG9zIGRlc3B1w6lzIGRlIE4gZMOtYXMuIMOadGlsIHBhcmEgYnVja2V0c1xuICAgKiAgICBkZSBsb2dzIGRvbmRlIGxhIHJldGVuY2nDs24gdGllbmUgdW4gdG9wZSBtw6F4aW1vLiBTb2xvIHNpIGBleHBpcmF0aW9uRGF5c2BcbiAgICogICAgZXN0w6EgZGVmaW5pZG8uXG4gICAqXG4gICAqIEBwYXJhbSBkZWZpbml0aW9uIC0gRGVmaW5pY2nDs24gZGVsIGJ1Y2tldCBjb24gbG9zIGNhbXBvcyBkZSBsaWZlY3ljbGUgb3BjaW9uYWxlcy5cbiAgICogQHJldHVybnMgQXJyYXkgZGUgcmVnbGFzIGRlIGxpZmVjeWNsZSBsaXN0byBwYXJhIHBhc2FybGUgYWwgY29uc3RydWN0b3IgZGUgYHMzLkJ1Y2tldGAuXG4gICAqICAgICAgICAgIFJldG9ybmEgdW4gYXJyYXkgdmFjw61vIHNpIG5pbmfDum4gY2FtcG8gZGUgbGlmZWN5Y2xlIGVzdMOhIGRlZmluaWRvLlxuICAgKi9cbiAgcHJpdmF0ZSBidWlsZExpZmVjeWNsZVJ1bGVzKGRlZmluaXRpb246IFMzQnVja2V0RGVmaW5pdGlvbik6IHMzLkxpZmVjeWNsZVJ1bGVbXSB7XG4gICAgY29uc3QgcnVsZXM6IHMzLkxpZmVjeWNsZVJ1bGVbXSA9IFtdO1xuXG4gICAgaWYgKGRlZmluaXRpb24uYWJvcnRNdWx0aXBhcnRVcGxvYWREYXlzKSB7XG4gICAgICBydWxlcy5wdXNoKHtcbiAgICAgICAgaWQ6ICdBYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRzJyxcbiAgICAgICAgYWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkQWZ0ZXI6IER1cmF0aW9uLmRheXMoZGVmaW5pdGlvbi5hYm9ydE11bHRpcGFydFVwbG9hZERheXMpLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKGRlZmluaXRpb24ubGlmZWN5Y2xlVHJhbnNpdGlvbkRheXMpIHtcbiAgICAgIHJ1bGVzLnB1c2goe1xuICAgICAgICBpZDogJ1RyYW5zaXRpb25Ub0ludGVsbGlnZW50VGllcmluZycsXG4gICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuSU5URUxMSUdFTlRfVElFUklORyxcbiAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogRHVyYXRpb24uZGF5cyhkZWZpbml0aW9uLmxpZmVjeWNsZVRyYW5zaXRpb25EYXlzKSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICAuLi4oZGVmaW5pdGlvbi52ZXJzaW9uZWQgJiYge1xuICAgICAgICAgIG5vbmN1cnJlbnRWZXJzaW9uVHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuSU5URUxMSUdFTlRfVElFUklORyxcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBEdXJhdGlvbi5kYXlzKGRlZmluaXRpb24ubGlmZWN5Y2xlVHJhbnNpdGlvbkRheXMpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChkZWZpbml0aW9uLmV4cGlyYXRpb25EYXlzKSB7XG4gICAgICBydWxlcy5wdXNoKHtcbiAgICAgICAgaWQ6ICdPYmplY3RFeHBpcmF0aW9uJyxcbiAgICAgICAgZXhwaXJhdGlvbjogRHVyYXRpb24uZGF5cyhkZWZpbml0aW9uLmV4cGlyYXRpb25EYXlzKSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBydWxlcztcbiAgfVxuXG4gIC8qKlxuICAgKiBNYXRlcmlhbGl6YSB1bmEgYFMzQnVja2V0RGVmaW5pdGlvbmAgZW4gdW4gcmVjdXJzbyBgczMuQnVja2V0YCBkZSBDREsuXG4gICAqXG4gICAqIEVzdGUgbcOpdG9kbyBlcyBlbCBuw7pjbGVvIGRlbCBtw7NkdWxvLiBPcnF1ZXN0YSBsb3MgaGVscGVycyBkZSBjaWZyYWRvIHlcbiAgICogbGlmZWN5Y2xlLCByZXN1ZWx2ZSBsYSByZWZlcmVuY2lhIGFsIGJ1Y2tldCBkZSBsb2dzIChxdWUgeWEgZXhpc3RlIGVuXG4gICAqIGB0aGlzLmJ1Y2tldHNgIGdyYWNpYXMgYWwgb3JkZW5hbWllbnRvIHRvcG9sw7NnaWNvIHByZXZpbyksIHkgY29uc3RydXllXG4gICAqIGVsIGJ1Y2tldCBjb24gdG9kYXMgbGFzIHByb3BpZWRhZGVzIGRlIHNlZ3VyaWRhZCBhcGxpY2FkYXMgZGUgZm9ybWFcbiAgICogaW52YXJpYWJsZTpcbiAgICogICAtIGBlbmZvcmNlU1NMOiB0cnVlYCAgICAgICAgICDihpIgUmVjaGF6YSBjdWFscXVpZXIgcmVxdWVzdCBzaW4gVExTLlxuICAgKiAgIC0gYGJsb2NrUHVibGljQWNjZXNzOiBCTE9DS19BTExgIOKGkiBOaW5nw7puIG9iamV0byBkZWwgYnVja2V0IGVzIHDDumJsaWNvLlxuICAgKiAgIC0gQ2lmcmFkbyBzaWVtcHJlIGFjdGl2byAgICAgICDihpIgRGV0ZXJtaW5hZG8gcG9yIGBlbmNyeXB0aW9uVHlwZWAuXG4gICAqXG4gICAqIFBhcmEgYnVja2V0cyBkZSBsb2dzIChgaXNMb2dzQnVja2V0ID0gdHJ1ZWApLCBhZGVtw6FzOlxuICAgKiAgIC0gQ29uZmlndXJhIGBPYmplY3RPd25lcnNoaXAgPSBPQkpFQ1RfV1JJVEVSYCB5IGBBY2Nlc3NDb250cm9sID1cbiAgICogICAgIExPR19ERUxJVkVSWV9XUklURWAsIHF1ZSBlcyBlbCByZXF1aXNpdG8gZGUgQUNMIHF1ZSBlbCBzZXJ2aWNpb1xuICAgKiAgICAgZGUgUzMgbmVjZXNpdGEgcGFyYSBwb2RlciBlc2NyaWJpciBsb3MgYXJjaGl2b3MgZGUgbG9nLlxuICAgKiAgIC0gQWdyZWdhIHVuYSBgUmVzb3VyY2VQb2xpY3lgIHF1ZSBwZXJtaXRlIGBzMzpQdXRPYmplY3RgIGFsIHByaW5jaXBhbFxuICAgKiAgICAgYHMzLmFtYXpvbmF3cy5jb21gIGNvbiBsYSBjb25kaWNpw7NuIGRlIEFDTCBgYnVja2V0LW93bmVyLWZ1bGwtY29udHJvbGAsXG4gICAqICAgICBnYXJhbnRpemFuZG8gcXVlIGVsIGR1ZcOxbyBkZWwgYnVja2V0IHJldGllbmUgY29udHJvbCB0b3RhbCBzb2JyZSBsb3MgbG9ncy5cbiAgICpcbiAgICogQWwgZmluYWxpemFyLCByZWdpc3RyYSBlbCBidWNrZXQgY3JlYWRvIGVuIGB0aGlzLmJ1Y2tldHNbbG9naWNhbE5hbWVdYFxuICAgKiBwYXJhIHF1ZSBlc3TDqSBkaXNwb25pYmxlIHRhbnRvIHBhcmEgbG9zIGJ1Y2tldHMgcXVlIGxvIHJlZmVyZW5jaWFuIGNvbW9cbiAgICogZGVzdGlubyBkZSBsb2dzLCBjb21vIHBhcmEgbG9zIGNvbnN1bWlkb3JlcyBleHRlcm5vcyBkZWwgbcOzZHVsby5cbiAgICpcbiAgICogQHBhcmFtIGRlZmluaXRpb24gLSBEZWZpbmljacOzbiBkZWwgYnVja2V0IGEgY3JlYXIuIERlYmUgaGFiZXIgcGFzYWRvIGB2YWxpZGF0ZVByb3BzYC5cbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQnVja2V0KGRlZmluaXRpb246IFMzQnVja2V0RGVmaW5pdGlvbik6IHZvaWQge1xuICAgIGNvbnN0IHsgZW5jcnlwdGlvbiwgZW5jcnlwdGlvbktleSwgYnVja2V0S2V5RW5hYmxlZCB9ID0gdGhpcy5yZXNvbHZlRW5jcnlwdGlvbihkZWZpbml0aW9uKTtcbiAgICBjb25zdCBsaWZlY3ljbGVSdWxlcyA9IHRoaXMuYnVpbGRMaWZlY3ljbGVSdWxlcyhkZWZpbml0aW9uKTtcbiAgICBjb25zdCByZW1vdmFsUG9saWN5ID1cbiAgICAgIGRlZmluaXRpb24ucmVtb3ZhbFBvbGljeSA9PT0gJ1JFVEFJTicgPyBSZW1vdmFsUG9saWN5LlJFVEFJTiA6IFJlbW92YWxQb2xpY3kuREVTVFJPWTtcblxuICAgIC8vIFJlc29sdmVyIHJlZmVyZW5jaWEgYWwgYnVja2V0IGRlIGxvZ3MgKHlhIGZ1ZSBjcmVhZG8gZ3JhY2lhcyBhbCBzb3J0KVxuICAgIGNvbnN0IHNlcnZlckFjY2Vzc0xvZ3NCdWNrZXQgPSBkZWZpbml0aW9uLnNlcnZlckFjY2Vzc0xvZ3NUYXJnZXROYW1lXG4gICAgICA/IHRoaXMuYnVja2V0c1tkZWZpbml0aW9uLnNlcnZlckFjY2Vzc0xvZ3NUYXJnZXROYW1lXVxuICAgICAgOiB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBidWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsIGRlZmluaXRpb24ubG9naWNhbE5hbWUsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGRlZmluaXRpb24uYnVja2V0TmFtZSxcbiAgICAgIHJlbW92YWxQb2xpY3ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogZGVmaW5pdGlvbi5yZW1vdmFsUG9saWN5ID09PSAnREVTVFJPWScsXG4gICAgICBlbmNyeXB0aW9uLFxuICAgICAgZW5jcnlwdGlvbktleSxcbiAgICAgIGJ1Y2tldEtleUVuYWJsZWQsXG4gICAgICBlbmZvcmNlU1NMOiB0cnVlLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHZlcnNpb25lZDogZGVmaW5pdGlvbi52ZXJzaW9uZWQsXG4gICAgICBldmVudEJyaWRnZUVuYWJsZWQ6IGRlZmluaXRpb24uZXZlbnRCcmlkZ2VFbmFibGVkID8/IGZhbHNlLFxuICAgICAgb2JqZWN0T3duZXJzaGlwOiBkZWZpbml0aW9uLmlzTG9nc0J1Y2tldFxuICAgICAgICA/IHMzLk9iamVjdE93bmVyc2hpcC5PQkpFQ1RfV1JJVEVSXG4gICAgICAgIDogczMuT2JqZWN0T3duZXJzaGlwLkJVQ0tFVF9PV05FUl9FTkZPUkNFRCxcbiAgICAgIC4uLihkZWZpbml0aW9uLmlzTG9nc0J1Y2tldCAmJiB7XG4gICAgICAgIGFjY2Vzc0NvbnRyb2w6IHMzLkJ1Y2tldEFjY2Vzc0NvbnRyb2wuTE9HX0RFTElWRVJZX1dSSVRFLFxuICAgICAgfSksXG4gICAgICAuLi4oc2VydmVyQWNjZXNzTG9nc0J1Y2tldCAmJiB7XG4gICAgICAgIHNlcnZlckFjY2Vzc0xvZ3NCdWNrZXQsXG4gICAgICAgIHNlcnZlckFjY2Vzc0xvZ3NQcmVmaXg6IGRlZmluaXRpb24uc2VydmVyQWNjZXNzTG9nc1ByZWZpeCxcbiAgICAgIH0pLFxuICAgICAgLi4uKGxpZmVjeWNsZVJ1bGVzLmxlbmd0aCA+IDAgJiYgeyBsaWZlY3ljbGVSdWxlcyB9KSxcbiAgICB9KTtcblxuICAgIC8vIFBvbGljeSBsZWFzdC1wcml2aWxlZ2UgcGFyYSBwZXJtaXRpciBlbnRyZWdhIGRlIGxvZ3MgUzMgZW4gZWwgYnVja2V0IGRlc3Rpbm8uXG4gICAgLy8gU2UgYWdyZWdhIFNPTE8gY3VhbmRvIHVuIGJ1Y2tldCBkZWNsYXJhIHNlcnZlciBhY2Nlc3MgbG9nZ2luZyBoYWNpYSBvdHJvLlxuICAgIGlmIChzZXJ2ZXJBY2Nlc3NMb2dzQnVja2V0KSB7XG4gICAgICB0aGlzLmFsbG93U2VydmVyQWNjZXNzTG9nc0RlbGl2ZXJ5KHtcbiAgICAgICAgdGFyZ2V0TG9nc0J1Y2tldDogc2VydmVyQWNjZXNzTG9nc0J1Y2tldCxcbiAgICAgICAgc291cmNlQnVja2V0OiBidWNrZXQsXG4gICAgICAgIHNvdXJjZUJ1Y2tldE5hbWU6IGRlZmluaXRpb24uYnVja2V0TmFtZSxcbiAgICAgICAgdGFyZ2V0UHJlZml4OiBkZWZpbml0aW9uLnNlcnZlckFjY2Vzc0xvZ3NQcmVmaXgsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLmJ1Y2tldHNbZGVmaW5pdGlvbi5sb2dpY2FsTmFtZV0gPSBidWNrZXQ7XG4gIH1cblxuICBwcml2YXRlIGFsbG93U2VydmVyQWNjZXNzTG9nc0RlbGl2ZXJ5KHBhcmFtczoge1xuICAgIHRhcmdldExvZ3NCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgICBzb3VyY2VCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgICBzb3VyY2VCdWNrZXROYW1lOiBzdHJpbmc7XG4gICAgdGFyZ2V0UHJlZml4Pzogc3RyaW5nO1xuICB9KTogdm9pZCB7XG4gICAgY29uc3QgcHJlZml4ID0gKHBhcmFtcy50YXJnZXRQcmVmaXggPz8gJycpLnRyaW0oKTtcbiAgICBjb25zdCBub3JtYWxpemVkUHJlZml4ID0gcHJlZml4Lmxlbmd0aCA9PT0gMCA/ICcnIDogcHJlZml4LmVuZHNXaXRoKCcvJykgPyBwcmVmaXggOiBgJHtwcmVmaXh9L2A7XG5cbiAgICAvLyBFbCBmb3JtYXRvIHTDrXBpY28gZGUgc2VydmVyIGFjY2VzcyBsb2dzIGFncmVnYSBlbCBub21icmUgZGVsIGJ1Y2tldCBvcmlnZW4gY29tbyBzdWJmb2xkZXIuXG4gICAgLy8gRWo6IDx0YXJnZXRQcmVmaXg+PHNvdXJjZUJ1Y2tldE5hbWU+L1lZWVktbW0tZGQtLi4uXG4gICAgY29uc3QgcmVzb3VyY2UgPSBwYXJhbXMudGFyZ2V0TG9nc0J1Y2tldC5hcm5Gb3JPYmplY3RzKFxuICAgICAgYCR7bm9ybWFsaXplZFByZWZpeH0ke3BhcmFtcy5zb3VyY2VCdWNrZXROYW1lfS8qYCxcbiAgICApO1xuXG4gICAgcGFyYW1zLnRhcmdldExvZ3NCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgc2lkOiBgQWxsb3dTM1NlcnZlckFjY2Vzc0xvZ3NGcm9tJHtwYXJhbXMuc291cmNlQnVja2V0Lm5vZGUuaWR9YCxcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBwcmluY2lwYWxzOiBbbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsb2dnaW5nLnMzLmFtYXpvbmF3cy5jb20nKV0sXG4gICAgICAgIGFjdGlvbnM6IFsnczM6UHV0T2JqZWN0J10sXG4gICAgICAgIHJlc291cmNlczogW3Jlc291cmNlXSxcbiAgICAgICAgLy8gUHJvdGVnZSBjb250cmEgY29uZnVzZWQgZGVwdXR5IHkgbGltaXRhIGVsIG9yaWdlbiBkZSBsb3MgbG9ncy5cbiAgICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICAgIEFybkxpa2U6IHsgJ2F3czpTb3VyY2VBcm4nOiBwYXJhbXMuc291cmNlQnVja2V0LmJ1Y2tldEFybiB9LFxuICAgICAgICAgIFN0cmluZ0VxdWFsczogeyAnYXdzOlNvdXJjZUFjY291bnQnOiBwYXJhbXMuc291cmNlQnVja2V0LnN0YWNrLmFjY291bnQgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbn1cbiJdfQ==