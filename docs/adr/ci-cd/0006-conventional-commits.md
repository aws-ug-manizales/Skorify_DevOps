# ADR-CICD-0006: Conventional Commits + commitlint

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: CI/CD
- **Autores**: @steevensmelo
- **Aprobadores**: <pendiente>

## Contexto

El proyecto involucra varios equipos y mayoría de estudiantes. Los mensajes de commit varían en estilo, lo cual dificulta:

- Generar changelogs automáticos.
- Decidir el siguiente número de versión (semver) sin intervención manual.
- Filtrar commits relevantes en la historia (`fix:` vs `feat:` vs `docs:`).

**Conventional Commits** es un estándar simple (`<tipo>(<alcance>): <descripción>`) ampliamente adoptado. **commitlint** valida los mensajes en un hook de pre-commit y/o como check de CI.

Tipos a habilitar (propuestos): `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `build`, `perf`, `revert`, `adr`.

> **TODO** — completar por @steevensmelo:
> - Decidir si se aplica solo en PRs (validación del título) o también en cada commit.
> - Decidir si se integra `semantic-release` para automatizar tags y changelog (genera versiones desde mensajes), o si las versiones son manuales.
> - Definir convención exacta de `<alcance>` (¿nombre del módulo, área, ticket?).

## Decisión

<!-- TODO: redactar por @steevensmelo -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->
