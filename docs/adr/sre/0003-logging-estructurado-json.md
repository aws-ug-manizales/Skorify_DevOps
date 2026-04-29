# ADR-SRE-0003: Estrategia de logging estructurado JSON

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: SRE
- **Autores**: @lmichaelrc
- **Aprobadores**: <pendiente>

## Contexto

Logs de texto plano son difíciles de filtrar, agregar y correlacionar. Logs en formato **JSON estructurado** permiten que Datadog (y CloudWatch Logs Insights) parseen automáticamente los campos, faciliten búsquedas por atributos (`service`, `env`, `request_id`) y se correlacionen con traces vía `trace_id`/`span_id`.

Atributos candidatos a estandarizar:

- `timestamp` (ISO 8601 UTC)
- `level` (`debug`, `info`, `warn`, `error`)
- `service` (`skorify-frontend`, `skorify-backend`, etc.)
- `env` (`dev`, `stg`, `prd`)
- `request_id`, `trace_id`, `span_id`
- `message` (texto humano)
- `error.kind`, `error.message`, `error.stack` cuando aplique

> **TODO** — completar por @lmichaelrc:
> - Elegir librería de logging para Node.js TypeScript (pino, winston, AWS Lambda Powertools).
> - Convención de campos obligatorios vs opcionales.
> - Política de **PII / datos sensibles**: qué nunca se loguea, qué se redacta.
> - Niveles de log activos por ambiente (DEV puede loguear `debug`, PROD solo `info+`).
> - Política de retención por ambiente y tipo de log.

## Decisión

<!-- TODO -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->
