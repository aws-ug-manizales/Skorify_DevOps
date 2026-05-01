# Módulo S3

`S3Module` es el construct de almacenamiento de Skorify. Recibe un array de definiciones y crea un bucket S3 por cada elemento.

El módulo está pensado para invocarse desde `lib/main.ts` varias veces, cada vez con un conjunto distinto de buckets si hace falta.

---

## Uso

En el flujo actual, `main.ts` carga la configuración desde SSM con un stack de lookup y luego materializa el módulo así:

```ts
const config = loadConfigFromSSM(lookupStack);

if (config.s3Buckets.length > 0) {
  new S3Module(envStack, 'S3Storage', {
    buckets: config.s3Buckets,
  });
}
```

El módulo no lee SSM por su cuenta. Solo consume el array que se le pasa.

---

## Contrato

### `S3BucketDefinition`

Cada elemento del array genera exactamente un bucket.

Campos:

- `logicalName`: identificador único dentro del módulo.
- `bucketName`: nombre físico del bucket en AWS.
- `versioned`: habilita versionado.
- `encryptionType`: `S3_MANAGED`, `KMS_MANAGED` o `CUSTOMER_MANAGED`.
- `kmsAlias`: requerido cuando `encryptionType = 'CUSTOMER_MANAGED'`.
- `serverAccessLogsTargetName`: `logicalName` del bucket que recibirá access logs.
- `serverAccessLogsPrefix`: prefijo opcional para los logs.
- `lifecycleTransitionDays`: transición a Intelligent-Tiering.
- `abortMultipartUploadDays`: aborta multipart uploads incompletos.
- `expirationDays`: expiración de objetos.
- `removalPolicy`: `RETAIN` o `DESTROY`.
- `isLogsBucket`: marca el bucket como receptor de access logs.
- `eventBridgeEnabled`: habilita eventos en EventBridge.

### `S3ModuleProps`

```ts
export interface S3ModuleProps {
  readonly buckets: S3BucketDefinition[];
}
```

---

## Qué aplica por defecto

Cada bucket creado por el módulo sale con:

- `enforceSSL: true`
- `blockPublicAccess: BLOCK_ALL`
- cifrado activo según `encryptionType`
- `BucketOwnerEnforced` para buckets normales
- `ObjectWriter` + `LOG_DELIVERY_WRITE` para buckets de logs

Si el bucket declara `serverAccessLogsTargetName`, el módulo:

- resuelve la dependencia entre buckets,
- crea la policy mínima para permitir entrega de logs,
- y ordena la creación para que el bucket destino exista antes que el origen.

---

## Cifrado

| Tipo | Comportamiento |
|---|---|
| `S3_MANAGED` | SSE-S3 administrado por AWS |
| `KMS_MANAGED` | SSE-KMS con clave administrada por AWS |
| `CUSTOMER_MANAGED` | Crea una clave KMS propia con rotación y alias obligatorio |

Cuando `CUSTOMER_MANAGED` está activo, el módulo expone la clave creada en `encryptionKeys[logicalName]`.

---

## Lifecycle

Si la definición lo pide, el módulo agrega reglas para:

- abortar multipart uploads incompletos,
- transicionar a Intelligent-Tiering,
- expirar objetos.

Las reglas se construyen solo cuando los campos correspondientes están definidos.

---

## Validaciones

El constructor falla rápido si detecta:

- `logicalName` repetidos,
- `CUSTOMER_MANAGED` sin `kmsAlias`,
- referencias de logs a buckets inexistentes,
- referencias de logs a buckets que no están marcados como `isLogsBucket`,
- ciclos entre buckets que se referencian para logging.

---

## Outputs

El construct expone:

- `buckets`: mapa `logicalName -> s3.Bucket`
- `encryptionKeys`: mapa `logicalName -> kms.Key` para buckets con `CUSTOMER_MANAGED`

---

## SSM requerido

El módulo ya no depende de `environment-name`.

El único parámetro que la aplicación consume para S3 es:

- `/skorify/s3/buckets`

Ese parámetro debe contener un JSON válido con un array de `S3BucketDefinition[]`.

---

## Ejemplo

```ts
new S3Module(envStack, 'S3Storage', {
  buckets: [
    {
      logicalName: 'AccessLogs',
      bucketName: 'skorify-dev-access-logs',
      versioned: true,
      encryptionType: 'S3_MANAGED',
      isLogsBucket: true,
      removalPolicy: 'RETAIN',
    },
    {
      logicalName: 'Assets',
      bucketName: 'skorify-dev-assets',
      versioned: true,
      encryptionType: 'KMS_MANAGED',
      serverAccessLogsTargetName: 'AccessLogs',
      serverAccessLogsPrefix: 'assets/',
      lifecycleTransitionDays: 30,
      abortMultipartUploadDays: 7,
      removalPolicy: 'DESTROY',
      eventBridgeEnabled: true,
    },
  ],
});
```

