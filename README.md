# Skorify - Repositorio de Infraestructura

Repositorio centralizado del equipo DevOps/SRE del proyecto **Skorify**, plataforma de predicciones para el Mundial 2026.

> **Nota**: Este repositorio contiene dos componentes principales:
> 1. **Shared Workflows y Actions** - Reutilizables para todos los proyectos Skorify
> 2. **Infraestructura AWS** - Implementada con AWS CDK

## Estructura del repositorio

```
.
├── .devcontainer/         # Entorno de desarrollo en contenedor
├── .github/workflows/     # Reusable Workflows de GitHub Actions
├── actions/               # Composite Actions reutilizables
├── lib/                   # Código CDK (TypeScript)
├── test/                  # Tests unitarios
├── docs/                  # Documentación
├── cdk.json               # Configuración de CDK
├── package.json           # Dependencias npm
└── tsconfig.json          # Configuración de TypeScript
```

---

## 🌍 Ambientes

| Ambiente | Rama asociada | Proposito |
|----------|--------------|-----------|
| DEV | `develop` | Integracion y feedback rapido |
| Staging | `release/vX.X` | Pruebas completas pre-produccion |
| PROD | `main` | Produccion con aprobacion manual |

---

## ☁️ AWS CDK - Infraestructura

El stack principal vive en `lib/main.ts`, lee configuración desde AWS Systems Manager Parameter Store y hoy consume solo:

- `/skorify/s3/buckets`

La metadata del stack se etiqueta con `SKORIFY_ENVIRONMENT` y, si no existe, cae en `dev`. El `stackName` físico se mantiene fijo como `skorify-infra`.

### Arquitectura CDK

```
lib/
├── main.ts                # Stack principal de CDK
├── config/
│   └── ssm-reader.ts      # Lee configuración desde SSM Parameter Store
└── modules/
    └── s3/
        ├── main.ts        # Módulo dinámico para crear buckets S3
        └── README.md      # Documentación del módulo S3
```

### Comandos CDK

| Comando | Descripción |
|---------|-------------|
| `☁️ CDK: Synth` | Genera CloudFormation template |
| `🔍 CDK: Diff` | Muestra diferencias con lo desplegado |
| `🚀 CDK: Deploy` | Despliega la infraestructura |
| `💣 CDK: Destroy` | Elimina los recursos |

### Configuración de buckets S3

Los buckets se definen en AWS Parameter Store como JSON:

```json
[
  {
    "logicalName": "AccessLogs",
    "bucketName": "skorify-access-logs",
    "versioned": true,
    "encryptionType": "S3_MANAGED",
    "isLogsBucket": true,
    "expirationDays": 180,
    "removalPolicy": "RETAIN"
  }
]
```

Parámetros en SSM:
- `/skorify/s3/buckets` → JSON array de definiciones de buckets

---

## 🔄 GitHub Actions - Shared Workflows

Workflows reutilizables que los repositorios de Frontend, Backend y Datos consumen via `workflow_call`. Convencion de nombrado: `stage-componente.yml`.

**Uso desde un repo consumidor:**

```yaml
jobs:
  lint:
    uses: skorify-org/skorify-shared-workflows/.github/workflows/lint--frontend.yml@v1
    with:
      node-version: '20'
    secrets: inherit
```

### `actions/` - Composite Actions

Pasos atomicos reutilizables que se usan dentro de los workflows (setup de Node, credenciales AWS, notificaciones, etc).

**Uso:**

```yaml
steps:
  - uses: skorify-org/skorify-shared-workflows/actions/setup-node@v1
    with:
      node-version: '20'
```

---

## 🛠️ Desarrollo

### Requisitos

- Node.js 18+
- AWS CDK CLI (`npm install -g aws-cdk`)
- AWS CLI configurado con SSO

### Configuración local

1. Clonar el repositorio
2. Ejecutar `npm install`
3. Configurar credenciales AWS: `aws sso login --profile skorify-dev`
4. Ejecutar `npx cdk synth` para verificar

### Tests

```bash
npm test
```

---

## 📚 Documentación

- [Dev Container](.devcontainer/README.md) - Entorno de desarrollo
- [Módulo S3](lib/modules/s3/README.md) - Documentación del módulo de almacenamiento
- [Contribuir](docs/contributing.md) - Guía de contribución
- [Workflows](docs/workflows-usage.md) - Uso de workflows

---

## 📄 Licencia

MIT
