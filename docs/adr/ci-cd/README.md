# ADRs — Área CI/CD

**Líder de área**: Steevens Castañeda

**Alcance**: GitHub Actions, pipelines, plantillas reusables, pre-commit, secret scanning, SCA, gestión de secretos en CI.

## Índice

| ADR | Título | Estado |
|-----|--------|--------|
| [0001](./0001-github-actions-plataforma-cicd.md) | GitHub Actions como plataforma de CI/CD | Aceptado |
| [0002](./0002-branching-gitflow.md) | Estrategia de branching GitFlow | Aceptado |
| [0003](./0003-mapeo-rama-ambiente-triggers.md) | Mapeo rama → ambiente y triggers de workflow | Aceptado |
| [0004](./0004-plantillas-reusable-workflows.md) | Plantillas centralizadas vía reusable workflows | Aceptado |
| [0005](./0005-stages-mvp-lint-unit-sca.md) | Stages obligatorios MVP: Lint, Unit, SCA | Aceptado |
| [0006](./0006-conventional-commits.md) | Conventional Commits + commitlint | Propuesto |
| [0007](./0007-pre-commit-hooks.md) | Pre-commit hooks por tipo de proyecto | Aceptado |
| [0008](./0008-estrategia-hotfix-rollback.md) | Estrategia de hotfix y rollback | Propuesto (fase 2) |
| [0009](./0009-versionado-semver-plantillas.md) | Versionado semver de plantillas centralizadas | Aceptado |
| [0010](./0010-husky-vs-pre-commit-framework.md) | Estandarización de pre-commit — Husky vs framework `pre-commit` | Propuesto |

## Documento de referencia

La estrategia general de CI/CD está descrita en `Skorify_CICD_strategy.pdf` (versión 1.0, abril 2026). Los ADRs de esta área formalizan y extienden ese documento.
