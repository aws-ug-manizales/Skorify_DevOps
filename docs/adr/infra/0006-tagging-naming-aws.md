# ADR-INFRA-0006: Estándar de tagging y naming AWS

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: Infra
- **Autores**: @Mateo454
- **Aprobadores**: <pendiente>

## Contexto

Tres ambientes en una sola cuenta AWS (ver ADR-INFRA-0002) hacen indispensable un estándar de tagging y naming para distinguir recursos por ambiente, atribuir costos y aplicar políticas IAM con condiciones por tag.

Sin estándar, los recursos se mezclan, los reportes de Cost Explorer son inutilizables y los IAM roles no pueden restringirse correctamente.

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
