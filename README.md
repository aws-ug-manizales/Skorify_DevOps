# Skorify Infraestructura

Repositorio de infraestructura como código para Skorify, implementado con AWS CDK y TypeScript.

El stack principal vive en `lib/main.ts`, lee configuración desde AWS Systems Manager Parameter Store y hoy consume solo:

- `/skorify/s3/buckets`

La metadata del stack se etiqueta con `SKORIFY_ENVIRONMENT` y, si no existe, cae en `dev`. El `stackName` físico se mantiene fijo como `skorify-infra`.

---

## Arquitectura

```
skorify-infraestructura/
├── .devcontainer/
│   ├── devcontainer.json       # Configuración del devcontainer
│   ├── README.md              # Documentación del entorno de desarrollo
│   └── scripts/
│       ├── cdk-wrapper.sh     # Wrapper que valida credenciales antes de CDK
│       └── setup-credentials.sh # Configura sesión AWS SSO
├── .vscode/
│   └── tasks.json             # Tareas CDK: Synth, Diff, Deploy, Destroy
├── lib/
│   ├── main.ts                # Stack principal de CDK
│   ├── config/
│   │   └── ssm-reader.ts      # Lee configuración desde SSM Parameter Store
│   └── modules/
│       └── s3/
│           ├── main.ts        # Módulo dinámico para crear buckets S3
│           └── README.md      # Documentación del módulo S3
├── test/
│   └── modules.test.ts        # Tests unitarios del proyecto
├── cdk.json                   # Configuración principal de CDK
├── cdk.context.json           # Contextos de CDK
├── package.json               # Dependencias y scripts npm
├── tsconfig.json              # Configuración de TypeScript
├── jest.config.js             # Configuración de Jest para tests
├── diagrama-infraestructura.html # Diagrama visual de la infraestructura
├── .eslintrc.json             # Configuración de ESLint
├── .eslintignore              # Archivos ignorados por ESLint
├── .prettierrc                # Configuración de Prettier
├── .prettierignore            # Archivos ignorados por Prettier
└── .gitignore                 # Archivos ignorados por Git
```

### Propósito de cada archivo

- **`lib/main.ts`**: Stack principal que resuelve configuración desde SSM y crea los recursos.
- **`lib/config/ssm-reader.ts`**: Lee parámetros de AWS Systems Manager Parameter Store.
- **`lib/modules/s3/main.ts`**: Módulo dinámico que crea buckets S3 a partir de un array de definiciones.
- **`lib/modules/s3/README.md`**: Documentación específica del módulo S3.
- **`.devcontainer/devcontainer.json`**: Configuración del entorno de desarrollo en contenedor.
- **`.devcontainer/README.md`**: Documentación del entorno de desarrollo.
- **`.devcontainer/scripts/cdk-wrapper.sh`**: Valida credenciales AWS antes de ejecutar cualquier comando CDK.
- **`.devcontainer/scripts/setup-credentials.sh`**: Configura la sesión AWS SSO automáticamente.
- **`.vscode/tasks.json`**: Define las tareas integradas en VS Code para operar CDK.
- **`test/modules.test.ts`**: Tests unitarios para validar la lógica de los módulos.
- **`cdk.json`**: Configuración principal del CDK (app, output, context).
- **`cdk.context.json`**: Contextos específicos del CDK.
- **`package.json`**: Dependencias npm y scripts del proyecto.
- **`tsconfig.json`**: Configuración del compilador de TypeScript.
- **`jest.config.js`**: Configuración del framework de testing Jest.
- **`diagrama-infraestructura.html`**: Visualización gráfica de la infraestructura desplegada.
- **`.eslintrc.json`**: Reglas de linting para mantener código limpio.
- **`.eslintignore`**: Archivos excluidos del linting.
- **`.prettierrc`**: Configuración del formateador de código Prettier.
- **`.prettierignore`**: Archivos excluidos del formateo.
- **`.gitignore`**: Archivos que Git debe ignorar.

### Flujo general

1. El devcontainer se abre.
2. `postAttachCommand` ejecuta `setup-credentials.sh`.
3. El script valida sesión AWS con el profile activo.
4. Si no hay sesión, ejecuta `aws sso login`.
5. Si falta, hace `cdk bootstrap`.
6. `main.ts` resuelve `/skorify/s3/buckets` y materializa los buckets S3 definidos.

### SSO hardcodeado para ambiente dev

Los valores de SSO están **hardcodeados** en `setup-credentials.sh` intencionalmente:

- **SSO_START_URL**: `https://aws-users-groups-manizales.awsapps.com/start`
- **SSO_REGION**: `us-east-1`
- **SSO_ACCOUNT_ID**: `968306633562` (cuenta de desarrollo)
- **SSO_ROLE_NAME**: `InfraestructuraTeam`

**Razón**: El devcontainer está diseñado para trabajar **exclusivamente con el ambiente de desarrollo (dev)**. No existe configuración para cambiar de ambiente desde el contenedor — el objetivo es que los desarrolladores siempre trabajen contra la cuenta dev sin posibilidad de error al apuntar a producción por accidente.

Esta decisión:
- Previene despliegues accidentales en producción desde el entorno local.
- Simplifica el flujo de desarrollo: al abrir el contenedor, ya se tiene la sesión correcta.
- El script `cdk-wrapper.sh` valida credenciales antes de ejecutar cualquier comando CDK, añadiendo una capa extra de seguridad.

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

