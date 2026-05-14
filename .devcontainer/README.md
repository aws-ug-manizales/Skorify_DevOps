# Dev Container - Skorify Infraestructura

Este documento describe el flujo real del entorno de desarrollo dentro del devcontainer.

---

## Qué hace el contenedor

El contenedor usa la imagen base `mcr.microsoft.com/devcontainers/typescript-node:24` y agrega la feature de AWS CLI. Node 24 es la versión LTS actual y alinea con `@types/node@^24.x` declarado en `package.json`, además de coincidir con la versión usada por los workflows del resto de los repos de la organización.

Al crear el contenedor:

1. `postCreateCommand` instala `aws-cdk` globalmente y las dependencias del proyecto.
2. `postAttachCommand` ejecuta `./.devcontainer/scripts/setup-credentials.sh`.

Eso significa que la validación de AWS se dispara al adjuntarse al devcontainer, no al abrir la carpeta en otro IDE fuera de este flujo.

---

## Credenciales AWS

El script `setup-credentials.sh` está fijado para la cuenta de desarrollo:

- Portal SSO: `https://aws-users-groups-manizales.awsapps.com/start`
- Región SSO: `us-east-1`
- Cuenta dev: `968306633562`
- Rol/permission set: `InfraestructuraTeam`

El script:

1. escribe esos valores en el profile activo,
2. valida si ya existe una sesión `sts get-caller-identity`,
3. si no existe, ejecuta `aws sso login`,
4. y al final revisa si `CDKToolkit` ya está bootstrappeado.

Si `CDKToolkit` no existe, corre bootstrap de CDK para la cuenta actual.

---

## Wrapper de CDK

`cdk-wrapper.sh` existe para proteger los comandos CDK:

1. llama a `setup-credentials.sh --require-auth`,
2. y luego ejecuta `npx cdk "$@"`.

Las tareas `Synth`, `Diff`, `Deploy` y `Destroy` pasan por ese wrapper.

---

## Configuración relevante

### `devcontainer.json`

Los puntos importantes son:

- `postCreateCommand`: instalación inicial.
- `postAttachCommand`: ejecución automática del setup AWS.
- `remoteUser: node`: el contenedor trabaja como usuario `node`.

### Variables reconocidas por el script

`setup-credentials.sh` usa estas variables opcionales cuando están presentes:

- `AWS_PROFILE`
- `AWS_REGION`
- `AWS_DEFAULT_REGION`
- `AWS_SSO_REGION`

Si no se definen, el script usa `default` para el profile y `us-east-1` para la región SSO.

---

## Parámetros SSM requeridos

El devcontainer no crea parámetros en AWS. El repositorio solo consume:

- `/skorify/s3/buckets`

La documentación del módulo S3 describe el formato exacto del JSON.

---

## Estructura

```text
.devcontainer/
├── devcontainer.json
├── README.md
└── scripts/
    ├── setup-credentials.sh
    └── cdk-wrapper.sh
```

