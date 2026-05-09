# ADR-SRE-0004: Política de alertas, severidades y on-call

- **Estado**: Propuesto (fase 2)
- **Fecha**: 2026-04-26
- **Área**: SRE
- **Autores**: @lmichaelrc
- **Aprobadores**: <pendiente>

## Contexto

Una vez que la observabilidad MVP esté capturando señales (ver ADR-SRE-0002), el siguiente paso es definir alertas con criterios claros. Sin política, se cae en alguno de estos extremos:

- Demasiadas alertas → fatiga, ignorar avisos.
- Pocas alertas → incidentes pasan desapercibidos hasta que un usuario reclama.

Este ADR queda en estado **Propuesto** hasta que el equipo SRE tenga MVP de telemetría operativo. Sin datos reales no podemos calibrar umbrales.

> **TODO** — completar cuando MVP de telemetría esté operativo:
> - Niveles de severidad (P1/P2/P3) y respuesta esperada por nivel.
> - Canales de alerta (Slack/Discord, email, PagerDuty) por severidad.
> - Lista inicial de alertas críticas (errores 5xx > X%, p99 latency > Y, Lambda errors, costos por encima de presupuesto).
> - Política de on-call: ¿hay turnos en este proyecto comunitario o solo best-effort?
> - Runbooks por alerta (en `docs/runbooks/`).

## Decisión

<!-- TODO -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->
