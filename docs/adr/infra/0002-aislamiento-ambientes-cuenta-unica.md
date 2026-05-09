# ADR-INFRA-0002: Una cuenta AWS con aislamiento por prefijos + IAM + tags

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: Infra
- **Autores**: @Mateo454
- **Aprobadores**: <pendiente>

## Contexto

El proyecto opera con **una sola cuenta AWS** para los tres ambientes (DEV, STG, PROD). Esto es una restricción del proyecto comunitario (presupuesto, complejidad de gestionar Organizations) y no se revisará en el MVP.

Operar tres ambientes en una cuenta tiene riesgos conocidos:

- Blast radius compartido: un error en DEV puede tocar recursos de PROD si los IAM no están bien acotados.
- Límites de servicio compartidos: los tres ambientes consumen las mismas cuotas (Lambda concurrency, API Gateway throttling).
- Visibilidad de costos: hay que disciplinar tagging para distinguir consumo por ambiente.

El equipo Infra debe definir las prácticas que mitiguen estos riesgos.

> **TODO** — completar por @Mateo454:
> - Convención de prefijos (`skorify-{env}-{servicio}`) y casing (kebab-case vs PascalCase) para nombres de recursos.
> - IAM roles separados por ambiente con políticas que restrinjan el acceso a recursos del propio ambiente (condiciones por tag, ARN o prefijo).
> - Tags obligatorios (`Environment`, `Project`, `Owner`, `CostCenter`).
> - VPCs y subnets separadas o compartidas (decidir según necesidad real).
> - Estrategia de límites/budgets por ambiente para evitar que DEV consuma cuota de PROD.

## Decisión

<!-- TODO -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->
