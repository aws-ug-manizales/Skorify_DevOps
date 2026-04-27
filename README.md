# Skorify Infraestructura

Repositorio de infraestructura como código para Skorify, implementado con AWS CDK y TypeScript.

El stack principal vive en `lib/main.ts`, lee configuración desde AWS Systems Manager Parameter Store y hoy consume solo:

- `/skorify/s3/buckets`

La metadata del stack se etiqueta con `SKORIFY_ENVIRONMENT` y, si no existe, cae en `dev`. El `stackName` físico se mantiene fijo como `skorify-infra`.

---

## Arquitectura

El proyecto está organizado por módulos:

- `lib/config/ssm-reader.ts`: lee la configuración de SSM.
- `lib/modules/s3/`: módulo S3 dinámico, invocado desde `main.ts` con un array de definiciones.
- `.devcontainer/`: entorno de desarrollo con AWS CLI, SSO fijo para dev y bootstrap automático.
- `.vscode/tasks.json`: tareas CDK para `Synth`, `Diff`, `Deploy` y `Destroy`.

### Flujo general

1. El devcontainer se abre.
2. `postAttachCommand` ejecuta `setup-credentials.sh`.
3. El script valida sesión AWS con el profile activo.
4. Si no hay sesión, ejecuta `aws sso login`.
5. Si falta, hace `cdk bootstrap`.
6. `main.ts` resuelve `/skorify/s3/buckets` y materializa los buckets S3 definidos.

---

## Requisitos

Solo necesitas:

1. Docker Desktop u otra implementación compatible.
2. Visual Studio Code.
3. La extensión Dev Containers.

No necesitas instalar Node.js ni AWS CLI en la máquina anfitriona.

---

## Inicio rápido

```bash
git clone <TU_URL>
cd skorify-infraestructura
```

Luego abre el proyecto en el devcontainer y acepta `Reopen in Container`.

La autenticación AWS se ejecuta al adjuntarse al contenedor, no como paso manual separado. Si la sesión expira, el mismo flujo vuelve a hacer `aws sso login`.

---

## SSM

El repositorio espera que exista previamente el parámetro:

- `/skorify/s3/buckets`

Ese valor debe ser un JSON válido con un array de definiciones `S3BucketDefinition[]`. El módulo S3 no crea ese parámetro; solo lo consume.

---

## Tareas de CDK

Las tareas disponibles en `.vscode/tasks.json` son solo estas cuatro:

1. `CDK: Synth`
2. `CDK: Diff`
3. `CDK: Deploy`
4. `CDK: Destroy`

Todas pasan por `./.devcontainer/scripts/cdk-wrapper.sh`, que valida credenciales antes de ejecutar CDK.

---

## Desarrollo local dentro del contenedor

```bash
npm run build
npm test
```

Para comandos CDK, usa las tareas del editor o llama al wrapper directamente:

```bash
./.devcontainer/scripts/cdk-wrapper.sh synth
./.devcontainer/scripts/cdk-wrapper.sh diff
./.devcontainer/scripts/cdk-wrapper.sh deploy
./.devcontainer/scripts/cdk-wrapper.sh destroy
```

