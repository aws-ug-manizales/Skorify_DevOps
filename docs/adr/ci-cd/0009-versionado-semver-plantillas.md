# ADR-CICD-0009: Versionado semver de plantillas centralizadas

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: CI/CD
- **Autores**: @steevensmelo
- **Aprobadores**: <pendiente>

## Contexto

Los repos de aplicación consumirán los reusable workflows publicados en Skorify_DevOps (ver ADR-CICD-0004). Si los repos referencian las plantillas con `@main`, cualquier cambio en el repo central se aplica inmediatamente y puede romper builds sin aviso. Si las referencian con SHA, los repos quedan congelados en una versión opaca.

Un esquema **semver con tags** balancea ambos extremos:

- `v1`, `v2`, ... — tags móviles que apuntan al último release menor de esa mayor. Permiten recibir parches sin acción manual.
- `v1.0.0`, `v1.1.0`, `v1.1.1` — tags inmutables para fijar a una versión exacta cuando se necesita reproducibilidad estricta.

> **TODO** — completar por @steevensmelo:
> - Definir reglas para mayor/menor/parche en este contexto (¿qué cuenta como breaking change en un workflow?).
> - Decidir si se usan release notes en GitHub Releases para cada bump y qué formato.
> - Decidir si se automatiza el bump con `semantic-release` (depende de ADR-CICD-0006) o se hace manual.

## Decisión

<!-- TODO: redactar por @steevensmelo -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->
