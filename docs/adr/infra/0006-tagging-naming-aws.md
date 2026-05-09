# ADR-INFRA-0006: Estándar de tagging y naming AWS

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: Infra
- **Autores**: @Mateo454
- **Aprobadores**: <pendiente>

## Contexto

Una cuenta AWS por ambiente bajo la OU `Skorify` (ver ADR-INFRA-0002) hace que la frontera entre DEV, STG y PROD sea la frontera de cuenta. Sin embargo, sigue siendo indispensable un estándar de tagging y naming dentro de cada cuenta para distinguir recursos por servicio, dominio y owner; atribuir costos por dimensiones cruzadas en el roll-up de Cost Explorer en master; y mantener consistencia entre cuentas.

Sin estándar, los recursos se mezclan dentro de cada cuenta, los reportes de Cost Explorer cruzados se vuelven inutilizables y los IAM roles dentro de una cuenta no pueden restringirse a recursos por dominio.

Tags candidatas (a definir por el equipo):

- `Environment`: `dev` | `stg` | `prd`
- `Project`: `skorify`
- `Owner`: nombre del área o del líder responsable
- `CostCenter`: para atribución de costos
- `ManagedBy`: `cdk` | `sam` | `manual`

Naming candidato: `skorify-{env}-{servicio}-{detalle}` en kebab-case.

> **TODO** — completar por @Mateo454:
> - Lista final de tags obligatorios y opcionales.
> - Convención exacta de naming por tipo de recurso (algunos servicios AWS limitan caracteres o longitud).
> - Cómo se enforce: ¿constructs CDK que añaden tags por defecto? ¿AWS Tag Policies? ¿linter de IaC?
> - Política de revisión cuando un recurso se crea sin los tags requeridos.

## Decisión

<!-- TODO -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->
