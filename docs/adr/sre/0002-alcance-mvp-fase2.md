# ADR-SRE-0002: Alcance MVP y fase 2 de observabilidad

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: SRE
- **Autores**: @lmichaelrc
- **Aprobadores**: <pendiente>

## Contexto

Datadog ofrece muchas capacidades (logs, metrics, APM, RUM, synthetics, SLOs, CSM, etc.). Implementar todo de inicio dispersa el esfuerzo del equipo y eleva el costo. Necesitamos priorizar.

Propuesta de alcance MVP (lo que arranca con el proyecto):

- **Logs** estructurados de Lambdas y reactor del frontend (errores).
- **Métricas** nativas de AWS (Lambda errors/duration, API Gateway latency/4xx/5xx) vía CloudWatch metric streams.
- **Traces** APM en backend Lambdas (vía Datadog Lambda Layer o DD-Trace).
- **CloudTrail integrado** a Datadog para audit logs.

Fase 2 (después del MVP, sujeto a éxito y presupuesto):

- **RUM** (Real User Monitoring) en el frontend Next.js.
- **Synthetics** (uptime checks, browser tests) para detección proactiva de outages.
- **SLOs** (Service Level Objectives) con error budget tracking.
- **Chaos engineering** experimental (opcional, pedagógico).

> **TODO** — completar por @lmichaelrc:
> - Definir métodos exactos de envío (Lambda Layer, forwarder, OpenTelemetry).
> - Lista de dashboards iniciales mínimos (uno por servicio + uno cross-service).
> - Criterios para promover capacidades de fase 2 a producción.

## Decisión

<!-- TODO -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->
