# ADR-CICD-0004: Plantillas centralizadas vía reusable workflows

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: CI/CD
- **Autores**: @steevensmelo
- **Aprobadores**: <pendiente>

## Contexto

Tres repos de aplicación (Skorify_Frontend, Skorify_Backend, Skorify_Data) necesitan pipelines con stages comunes (lint, unit, SCA, build, deploy). Si cada repo mantiene su propia copia de los workflows:

- Una corrección de seguridad o un cambio en la convención hay que aplicarlo manualmente en N repos.
- La evolución natural lleva a divergencia: cada repo termina con su propia variante y nadie sabe cuál es la "buena".
- Los estudiantes se pierden cuando ven tres formas diferentes de hacer lo mismo.

GitHub Actions ofrece **reusable workflows** (`workflow_call`) que permiten que un repo central (Skorify_DevOps) publique workflows versionados y que los repos de aplicación los consuman con `uses: aws-ug-manizales/Skorify_DevOps/.github/workflows/<archivo>.yml@v1`.

> **TODO** — completar por @steevensmelo:
> - Diseñar inputs y secrets que cada workflow recibe.
> - Definir cuándo usar reusable workflow vs composite action vs script.

<!--
DECISIÓN PARCIAL YA TOMADA por el líder de CI/CD (commit 15288b9, 2026-04-26):

Granularidad: **un workflow por (stage, componente)**, con nombrado
`stage-componente.yml`. Ejemplos creados:
  - `lint-frontend.yml`, `lint-backend.yml`, `lint-data.yml`
  - `unit-tests-frontend.yml`, `unit-tests-backend.yml`
  - `build-frontend.yml`, `build-backend.yml`
  - `deploy-frontend.yml`, `deploy-backend.yml`
  - `sca-generic.yml` (cross-componente)

Esto da granularidad fina: cada repo de aplicación arma su pipeline
combinando solo los stages que necesita, en lugar de invocar un
megaworkflow por flujo. Encaja con el modelo de stages descrito en
`Skorify_CICD_strategy.pdf`.

Composite actions (en `actions/` raíz, no `.github/actions/`) se usan para
pasos atómicos compartidos entre workflows: `setup-node`, `setup-aws-credentials`,
`run-trivy`, `run-eslint`, `notify-slack`, `create-release-tag`.

Versionado: ver ADR-CICD-0009.

Documentación de uso: `docs/contributing.md` (mantenida por el líder CI/CD).
-->

## Decisión

<!-- TODO: redactar formalmente por @steevensmelo, incorporando la decisión
ya tomada arriba (modelo stage-componente) -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->
