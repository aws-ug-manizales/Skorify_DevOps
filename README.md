# Skorify - Repositorio de Infraestructura

Repositorio centralizado del equipo DevOps/SRE del proyecto **Skorify**, plataforma de predicciones para el Mundial 2026.

> **Nota**: Este repositorio contiene dos componentes principales:
> 1. **Shared Workflows y Actions** - Reutilizables para todos los proyectos Skorify
> 2. **Infraestructura AWS** - Implementada con AWS CDK

---

## 🌍 Ambientes

| Ambiente | Rama asociada | Proposito |
|----------|--------------|-----------|
| DEV | `develop` | Integracion y feedback rapido |
| Staging | `release/vX.X` | Pruebas completas pre-produccion |
| PROD | `main` | Produccion con aprobacion manual |

---

## Estructura del repositorio

```
skorify-infraestructura/
├── .devcontainer/
│   ├── devcontainer.json       # Configuración del devcontainer
│   ├── README.md              # Documentación del entorno de desarrollo
│   └── scripts/
│       ├── cdk-wrapper.sh      # Wrapper que valida credenciales antes de CDK
│       └── setup-credentials.sh # Configura sesión AWS SSO
├── .github/
│   ├── workflows/              # Workflows reutilizables
│   │   ├── build-backend.yml
│   │   ├── build-frontend.yml
│   │   ├── deploy-backend.yml
│   │   ├── deploy-frontend.yml
│   │   ├── lint-backend.yml
│   │   ├── lint-data.yml
│   │   ├── lint-frontend.yml
│   │   ├── sca-generic.yml
│   │   ├── unit-tests-backend.yml
│   │   └── unit-tests-frontend.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── actions/                    # Composite Actions reutilizables
│   ├── create-release-tag/
│   ├── setup-aws-credentials/
│   └── setup-node/
├── lib/                        # Código CDK (TypeScript)
│   ├── main.ts                 # Stack principal de CDK
│   ├── config/
│   │   └── ssm-reader.ts       # Lee configuración desde SSM Parameter Store
│   └── modules/
│       └── s3/
│           ├── main.ts         # Módulo dinámico para crear buckets S3
│           └── README.md      # Documentación del módulo S3
├── test/
│   └── modules.test.ts         # Tests unitarios del proyecto
├── .vscode/
│   ├── extensions.json         # Extensiones recomendadas
│   └── tasks.json              # Tareas CDK: Synth, Diff, Deploy, Destroy
├── cdk.json                    # Configuración principal de CDK
├── cdk.context.json           # Contextos de CDK
├── package.json               # Dependencias y scripts npm
├── package-lock.json
├── tsconfig.json              # Configuración de TypeScript
├── jest.config.js             # Configuración de Jest para tests
├── .eslintrc.json             # Configuración de ESLint
├── .eslintignore              # Archivos ignorados por ESLint
├── .prettierrc                # Configuración de Prettier
├── .prettierignore            # Archivos ignorados por Prettier
├── .gitignore                 # Archivos ignorados por Git
├── diagrama-infraestructura.html # Diagrama visual de la infraestructura
├── CONTRIBUTING.md            # Guía de contribución
└── README.md                  # Este archivo
```

### Propósito de cada archivo

| Archivo/Directorio | Descripción |
|-------------------|-------------|
| **`.devcontainer/`** | Entorno de desarrollo en contenedor. Ver [.devcontainer/README.md](.devcontainer/README.md) |
| **`.github/workflows/`** | Workflows reutilizables que otros repositorios consumen via `workflow_call` |
| **`actions/`** | Composite Actions atómicas para usar dentro de workflows |
| **`lib/main.ts`** | Stack principal de CDK |
| **`lib/config/ssm-reader.ts`** | Lee configuración desde AWS Parameter Store |
| **`lib/modules/s3/`** | Módulo para crear buckets S3 dinámicamente. Ver [lib/modules/s3/README.md](lib/modules/s3/README.md) |
| **`test/modules.test.ts`** | Tests unitarios del proyecto |
| **`.vscode/tasks.json`** | Define las tareas integradas en VS Code para operar CDK |
| **`cdk.json`** | Configuración principal del CDK (app, output, context) |
| **`package.json`** | Dependencias npm y scripts del proyecto |
| **`tsconfig.json`** | Configuración del compilador de TypeScript |
| **`jest.config.js`** | Configuración del framework de testing Jest |
| **`.eslintrc.json`** | Reglas de linting para mantener código limpio |
| **`.prettierrc`** | Configuración del formateador de código Prettier |
| **`diagrama-infraestructura.html`** | Visualización gráfica de la infraestructura desplegada |
| **`CONTRIBUTING.md`** | Guía de contribución al proyecto |

---

## 🚀 Uso del Developer Container

Todo el desarrollo se realiza dentro del **Dev Container**. Esto asegura que todos los colaboradores tengan el mismo entorno de desarrollo configurado automáticamente.

### Requisitos previos

- [Docker](https://www.docker.com/) instalado
- [VS Code](https://code.visualstudio.com/) con extensión [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

### Cómo abrir el proyecto

1. Abre este repositorio en VS Code
2. VS Code detectará automáticamente la configuración del devcontainer
3. Haz clic en **"Reopen in Container"** cuando se solicite
4. El contenedor se construirá y configurará automáticamente

> Para más detalles sobre el flujo de desarrollo, credenciales AWS y comandos disponibles, consulta [.devcontainer/README.md](.devcontainer/README.md).

---

## ☁️ AWS CDK - Infraestructura

El stack principal vive en `lib/main.ts`, lee configuración desde AWS Systems Manager Parameter Store.

### Comandos CDK (disponibles en el devcontainer)

| Comando | Descripción |
|---------|-------------|
| `☁️ CDK: Synth` | Genera CloudFormation template |
| `🔍 CDK: Diff` | Muestra diferencias con lo desplegado |
| `🚀 CDK: Deploy` | Despliega la infraestructura |
| `💣 CDK: Destroy` | Elimina los recursos |

> **Nota**: La documentación del módulo S3 está disponible en [lib/modules/s3/README.md](lib/modules/s3/README.md).

---

## 📄 Licencia

MIT
