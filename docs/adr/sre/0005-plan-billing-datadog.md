# ADR-SRE-0005: Plan de Datadog y modelo de billing

- **Estado**: Propuesto (bloqueado)
- **Fecha**: 2026-04-26
- **Área**: SRE
- **Autores**: @lmichaelrc
- **Aprobadores**: <pendiente>

## Contexto

ADR-SRE-0001 adopta Datadog como plataforma de observabilidad. Datadog cobra por host, ingesta de logs, traces y otras dimensiones. Para un proyecto comunitario hay que definir:

- Qué plan se usa (free trial, Pro, Enterprise).
- Quién paga (sponsor de la comunidad? recursos del User Group? créditos AWS si aplica?).
- Cuál es el presupuesto mensual aceptable y qué hacemos si se excede.

**Bloqueador**: estos puntos no están definidos. Sin claridad de billing, no podemos comprometer la decisión de Datadog a largo plazo.

> **TODO** — completar cuando se defina el sponsor y presupuesto:
> - Plan elegido y costo mensual estimado.
> - Proceso para escalar el plan si el proyecto crece.
> - Plan de contingencia si el sponsor se retira (¿migración a CloudWatch?).
> - Quién es el dueño de la cuenta Datadog y los procedimientos de acceso.

## Decisión

<!-- BLOQUEADO: pendiente definición de billing y sponsor -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->
