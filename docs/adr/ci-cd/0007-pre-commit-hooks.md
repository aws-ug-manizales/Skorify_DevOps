# ADR-CICD-0007: Pre-commit hooks por tipo de proyecto

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: CI/CD
- **Autores**: @steevensmelo
- **Aprobadores**: <pendiente>

## Contexto

Detectar problemas en el commit local es más barato que detectarlos en CI, y mucho más barato que detectarlos en un revisor humano. La herramienta `pre-commit` (https://pre-commit.com) gestiona hooks declarativos en un archivo `.pre-commit-config.yaml`.

Hooks comunes propuestos para los tres repos de aplicación (frontend, backend, data):

- **gitleaks** — secret scanning (responsabilidad absorbida de Seguridad, ver ADR-0002 general).
- **commitlint** — validación de Conventional Commits (ver ADR-CICD-0006).
- **trailing-whitespace**, **end-of-file-fixer** — higiene básica.

Hooks específicos por tipo de repo:

- **Frontend (Skorify_Frontend)**: `eslint`, `prettier`, `tsc --noEmit`.
- **Backend (Skorify_Backend)**: `eslint`, `prettier`, `tsc --noEmit`. Si se editan plantillas SAM, considerar `cfn-lint` o equivalente.
- **Data (Skorify_Data)**: Node.js + TypeScript + pnpm (confirmado por auditoría 2026-04-26). Aplican los mismos hooks que Backend: `eslint`, `prettier`, `tsc --noEmit`. Sin SAM ni CFN.

Las configuraciones de referencia viven en `pre-commit/` de este repo y los repos de aplicación las extienden o copian.

> **TODO** — completar por @steevensmelo:
> - Elegir el conjunto definitivo de hooks por tipo de repo.
> - Decidir si los hooks son obligatorios (instalación documentada) o un job de CI los ejecuta también como red de seguridad.
> - Definir quién mantiene los archivos de referencia en `pre-commit/`.

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
- Skorify_Frontend: ya usa Husky + lint-staged. Hook `.husky/pre-commit` ejecuta
  `npx lint-staged`, con reglas declaradas en `package.json`.
- Skorify_Backend: sin pre-commit hooks de ningún tipo.
- Skorify_Data: sin pre-commit hooks.

El cascarón actual de este ADR asume el framework `pre-commit`
(https://pre-commit.com), que NO es lo que FE usa. Existe entonces una decisión
cruzada pendiente: ¿estandarizar en Husky (lo de FE) o en `pre-commit` framework?
Ver ADR-CICD-0010.

Mientras se decide, los repos BE y Data NO están adoptando ningún hook todavía.
-->

