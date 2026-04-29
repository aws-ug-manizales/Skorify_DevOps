# ADR-CICD-0010: Estandarización de pre-commit — Husky vs framework `pre-commit`

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: CI/CD
- **Autores**: @steevensmelo (Steevens Castañeda)
- **Aprobadores**: <pendiente>

## Contexto

ADR-CICD-0007 estableció el uso de pre-commit hooks por tipo de proyecto, asumiendo el framework `pre-commit` (https://pre-commit.com) — el cascarón actual en `pre-commit/*.pre-commit-config.yaml` está orientado a esa herramienta. La auditoría del 2026-04-26 reveló que **`Skorify_Frontend` ya usa Husky + lint-staged**, no `pre-commit` framework:

- `.husky/pre-commit` ejecuta `npx lint-staged`.
- Reglas declaradas en `package.json` bajo `lint-staged`.
- ESLint + Prettier corren contra los archivos staged.

Los repos `Skorify_Backend` y `Skorify_Data` no tienen hooks de ningún tipo todavía.

Hay una decisión cruzada que tomar antes de pedir a BE y Data que adopten algo:

**Opción A — Estandarizar en Husky + lint-staged**:
- Pros: FE ya lo usa; ambas son tools del ecosistema npm/Node, compatibles con los 3 repos (todos son Node).
- Pros: instalación trivial (`npm install --save-dev husky lint-staged`).
- Contras: específico de proyectos JavaScript/TypeScript; si Data o cualquier futuro repo del proyecto añade Python u otro stack, Husky no sirve directamente.

**Opción B — Estandarizar en framework `pre-commit`**:
- Pros: agnóstico de lenguaje; soporta hooks Python, Go, Ruby, JS, etc.
- Pros: gestión centralizada de versiones de los hooks vía `.pre-commit-config.yaml`.
- Contras: requiere instalar Python en la máquina del desarrollador (la herramienta es Python).
- Contras: el equipo FE tendría que migrar de Husky, perdiendo el setup que ya funciona.

**Opción C — Híbrido (NO recomendado)**:
- Cada repo elige; FE sigue con Husky, BE/Data adoptan `pre-commit`.
- Contras: tres flavors distintos de hooks complican onboarding y la guía única de desarrollo.

> **TODO** — completar por @steevensmelo:
> - Decidir entre A y B.
> - Si se elige A (Husky), reemplazar los archivos `pre-commit/*.pre-commit-config.yaml` por configs de `lint-staged` y un script de `husky/install.sh`.
> - Si se elige B (`pre-commit`), pedir al equipo FE migrar de Husky.
> - Especificar el conjunto exacto de hooks por tipo de repo.
> - Definir si el hook se enforce solo localmente o también como job de CI (defensa en profundidad).

## Decisión

<!-- TODO -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->

## Notas adicionales

- ADR relacionado: ADR-CICD-0007 (pre-commit hooks por tipo de proyecto). Este ADR es una decisión cruzada que afina la herramienta concreta.
- Cuando se cierre este ADR, los archivos de cascarón en `pre-commit/` se reemplazarán por la configuración correspondiente (Husky o `pre-commit` framework).
