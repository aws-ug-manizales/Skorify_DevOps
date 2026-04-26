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

### `iac/` - Infraestructura como Codigo

Definiciones de infraestructura transversal de AWS que no pertenece a un repositorio especifico (VPC, RDS, buckets compartidos, CDN, monitoreo).

### `scripts/` - Scripts Operativos

Scripts de automatizacion para tareas operativas: backups de BD, rollbacks, invalidacion de cache, rotacion de secrets.

### `sre/` - Site Reliability Engineering

Runbooks de incidentes, definiciones de SLOs, configuraciones de alertas/dashboards y registro de postmortems.

### `docs/` - Documentacion

Guias de uso de los shared workflows, guia de contribucion, referencia de ambientes y politica de secrets.

## Ambientes

| Ambiente | Rama asociada | Proposito |
|----------|--------------|-----------|
| DEV | `develop` | Integracion y feedback rapido |
| Staging | `release/vX.X` | Pruebas completas pre-produccion |
| PROD | `main` | Produccion con aprobacion manual |
