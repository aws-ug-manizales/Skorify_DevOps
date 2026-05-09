# ADR-CICD-0003: Mapeo rama → ambiente y triggers de workflow

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: CI/CD
- **Autores**: @steevensmelo
- **Aprobadores**: <pendiente>

## Contexto

Definida la estrategia GitFlow (ADR-CICD-0002), hay que formalizar qué pipeline se dispara con cada evento de git y a qué ambiente despliega. El documento `Skorify_CICD_strategy.pdf` define el siguiente mapeo, que este ADR adopta y formaliza:

| Trigger | Workflow | Despliegue |
|---------|----------|------------|
| `pull_request` a `develop`, `release/*`, `main` | `ci-pr-validation.yaml` | ninguno |
| `push` a `develop` | `cd-dev-deploy.yaml` | DEV (auto) |
| `push` a `release/*` | `cd-staging-deploy.yaml` | STG (auto, pruebas completas) |
| `push` a `main` | `cd-prod-deploy.yaml` | PROD (con required reviewers) |
| `push` a `hotfix/*` | `cd-hotfix-deploy.yaml` | flujo acelerado a PROD |

> **TODO** — completar por @steevensmelo:
> - Especificar tipos exactos de evento `pull_request` (opened, synchronize, reopened).
> - Detallar cómo se manejan despliegues fallidos (¿bloquea el siguiente push?).
> - Política de `concurrency:` para evitar despliegues concurrentes al mismo ambiente.

## Decisión

<!-- TODO: redactar por @steevensmelo -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->
