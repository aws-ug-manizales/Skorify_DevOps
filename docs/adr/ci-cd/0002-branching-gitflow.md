# ADR-CICD-0002: Estrategia de branching GitFlow

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: CI/CD
- **Autores**: @steevensmelo
- **Aprobadores**: <pendiente>

## Contexto

El proyecto despliega a tres ambientes (DEV, STG, PROD) y usa una sola cuenta AWS. Necesitamos una estrategia de branching que:

- Sea entendible por estudiantes en su primer proyecto.
- Soporte hotfixes urgentes sin saltarse las validaciones.
- Esté alineada con el documento `Skorify_CICD_strategy.pdf` v1.0 (abril 2026), que ya describe el flujo `develop` → DEV, `release/*` → STG, `main` → PROD, `hotfix/*`.

> **TODO** — completar por @steevensmelo:
> - Justificar elección de GitFlow vs alternativas (trunk-based, GitHub Flow).
> - Definir nomenclatura exacta de ramas (`feature/<jira-id>-...`, `release/v1.2.0`, `hotfix/...`).
> - Reglas de protección por rama.

<!--
NOTA OBSERVADA (2026-04-26, al clonar los 3 repos):

El estado actual de los repos no es consistente con `Skorify_CICD_strategy.pdf`,
que define la rama de integración como `develop`. La realidad observada:

| Repo                | Rama de integración | Otras ramas relevantes      |
|---------------------|---------------------|-----------------------------|
| Skorify_Frontend    | develop             | (coincide con la estrategia)|
| Skorify_Backend     | development         | (NO coincide)               |
| Skorify_Data        | development         | ya tiene `staging` activa   |

Convenciones de nombres de feature branch que conviven hoy:
  - `feat/...`
  - `feature/...`
  - `feature/H06/...` (con ID de historia)
  - `feature/h04-...` (con ID en kebab)

Los mensajes de commit existentes no siguen Conventional Commits de forma
uniforme (`Configurar deploy`, `Agrega pipeline`, `feat: ...` mezclados).

Decisiones a tomar al cerrar este ADR:
  1) ¿Estandarizamos en `develop` (lo que dice el doc) o en `development` (mayoritario en los repos)?
  2) Si cambiamos `development` → `develop` o viceversa, plan de migración por repo.
  3) Convención única de nombres de feature branch.
  4) Cómo tratar lo que ya hizo el equipo data (incluyendo su rama `staging`).
-->


## Decisión

<!-- TODO: redactar por @steevensmelo -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->
