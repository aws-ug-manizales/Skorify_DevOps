# Skorify DevOps - Repositorio Central

Repositorio centralizado del equipo DevOps/SRE del proyecto **Skorify**, plataforma de predicciones para el Mundial 2026.

## Estructura del repositorio

```
.
├── .github/workflows/     # Reusable Workflows de GitHub Actions
├── actions/               # Composite Actions reutilizables
├── iac/                   # Infraestructura como Codigo (IaC)
├── scripts/               # Scripts operativos y de automatizacion
├── sre/                   # Runbooks, monitoreo y documentacion SRE
└── docs/                  # Documentacion general del equipo
```

### `.github/workflows/` - Reusable Workflows

Workflows reutilizables que los repositorios de Frontend, Backend y Datos consumen via `workflow_call`. Convencion de nombrado: `stage-componente.yml`.

**Uso desde un repo consumidor:**

```yaml
jobs:
  lint:
    uses: aws-ug-manizales/Skorify_DevOps/.github/workflows/lint-frontend.yml@v1
    with:
      node-version: '20'
    secrets: inherit
```

### `actions/` - Composite Actions

Pasos atomicos reutilizables que se usan dentro de los workflows (setup de Node, credenciales AWS, notificaciones, etc).

**Uso:**

```yaml
steps:
  - uses: aws-ug-manizales/Skorify_DevOps/actions/setup-node@v1
    with:
      node-version: '20'
```

### `iac/` - Infraestructura como Codigo

Definiciones de infraestructura transversal de AWS que no pertenece a un repositorio especifico (VPC, RDS, buckets compartidos, CDN, monitoreo).

### `scripts/` - Scripts Operativos

Scripts de automatizacion para tareas operativas: backups de BD, rollbacks, invalidacion de cache, rotacion de secrets.

### `sre/` - Site Reliability Engineering

Runbooks de incidentes, definiciones de SLOs, configuraciones de alertas/dashboards y registro de postmortems.

### `docs/` - Documentacion

Guias de uso de los shared workflows, guia de contribucion, decisiones arquitectonicas (ADRs) y onboarding por repo de aplicacion.

Subcarpetas relevantes:

- [`docs/adr/`](./docs/adr/) — Architecture Decision Records (formato Nygard, en espanol)
- [`docs/onboarding/`](./docs/onboarding/) — guias para conectar cada repo de aplicacion a las plantillas
- [`docs/contributing.md`](./docs/contributing.md) — proceso de contribucion al repo

## Ambientes

| Ambiente | Rama asociada | Proposito |
|----------|--------------|-----------|
| DEV | `develop` | Integracion y feedback rapido |
| Staging | `release/vX.X` | Pruebas completas pre-produccion |
| PROD | `main` | Produccion con aprobacion manual |

## Equipo DevOps "Mediocampistas"

| Area | Lider | Alcance |
|------|-------|---------|
| **CI/CD** | Steevens Castaneda (@steevensmelo) | GitHub Actions, pipelines, plantillas, secret scanning, SCA |
| **Infra** | Mateo Marin (@Mateo454) | IaC (CDK + SAM), AWS, IAM, OIDC, red, KMS, ambientes |
| **SRE** | Michael Rivera (@lmichaelrc) | Observabilidad (Datadog), logs, metricas, traces, audit logging |

**Coordinacion general**: Edison Castro (@edisoncast).

> El area de Seguridad fue disuelta y sus responsabilidades se redistribuyeron entre las tres areas. Ver [ADR-0002 general](./docs/adr/0002-redistribucion-responsabilidades-seguridad.md).

## ADRs

Toda decision tecnica significativa se documenta como ADR antes de implementarse:

1. Crear ADR como `Propuesto` via Pull Request siguiendo la [plantilla Nygard](./docs/adr/0000-template.md).
2. Aprobacion: **2 revisores del area duena + 1 revisor cruzado** de otra area. ADRs sensibles (IAM, OIDC, red, secretos, audit logs) requieren los **tres lideres de area**.
3. Los ADRs aceptados no se editan; cambios → ADR nuevo que `Reemplaza por: ADR-XXXX`.

Ver el [indice general de ADRs](./docs/adr/) y los indices por area: [CI/CD](./docs/adr/ci-cd/), [Infra](./docs/adr/infra/), [SRE](./docs/adr/sre/).

## Convencion de commits

Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `ci:`, `adr:` (este ultimo para PRs que añaden o cambian un ADR).
