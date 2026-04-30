# ADR-CICD-0005: Stages obligatorios MVP — Lint, Unit, SCA

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: CI/CD
- **Autores**: @steevensmelo
- **Aprobadores**: <pendiente>

## Contexto

El documento `Skorify_CICD_strategy.pdf` define una lista completa de stages aspirantes (lint, unit, SCA, SAST, build, integration, E2E, performance, deploy, notificación). Implementarlos todos en la primera iteración no es realista para el timeline ni para el perfil del equipo.

El equipo CI/CD definió que el alcance MVP cubrirá solo **Linting & formatting**, **Unit tests** y **SCA**. SAST, integration, E2E y performance quedan para fase 2.

Razones para la priorización:

- Lint y unit cubren la mayor parte de defectos comunes con bajo costo de implementación.
- SCA (con Trivy o equivalente) detecta vulnerabilidades en dependencias, una superficie de ataque que crece sola sin ningún cambio de código.
- SAST y E2E requieren más curva (tuning de reglas Semgrep, escritura de pruebas Playwright) y se introducen cuando el equipo gane fluidez.

> **TODO** — completar por @steevensmelo:
> - Elegir herramientas concretas por tipo de repo (los tres son Node + TypeScript: eslint+prettier aplica a FE, BE y Data).
> - Elegir framework de unit testing (Vitest, Jest, etc.) por consistencia con cada equipo de aplicación.
> - Elegir herramienta SCA y umbral de severidad que rompe el pipeline.
> - Definir cuándo se evolucionará a fase 2 (criterios de readiness).

## Decisión

<!-- TODO: redactar por @steevensmelo -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->

<!--
NOTA OBSERVADA (auditoría 2026-04-26):

Estado real al momento de redactar:
- Skorify_Frontend: tiene ESLint + Prettier configurados; sin tests escritos; sin SCA.
- Skorify_Backend: sin ESLint configurado; tiene Jest configurado pero sin tests; sin SCA.
- Skorify_Data: sin ESLint, sin Jest/Vitest, sin SCA; 37 PRs mergeados sin checks automáticos.

Implementar los stages MVP es trabajo greenfield para BE y Data, y completar
unit tests + SCA para los tres repos. Plan de adopción incremental:
1) Habilitar lint en BE y Data (instalar ESLint + Prettier).
2) Activar Trivy como job SCA en los tres repos.
3) Escribir primeros unit tests cuando cada equipo pueda priorizar.
-->

