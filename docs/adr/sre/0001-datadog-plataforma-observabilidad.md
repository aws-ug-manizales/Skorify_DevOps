# ADR-SRE-0001: Datadog como plataforma de observabilidad

- **Estado**: Aceptado
- **Fecha**: 2026-04-26
- **Área**: SRE
- **Autores**: @lmichaelrc (Michael Rivera)
- **Aprobadores**: @lmichaelrc, @steevensmelo, @Mateo454, @edisoncast

> **Nota (2026-05-09)**: el contexto original asume que los tres ambientes corren en una sola cuenta AWS. Ese supuesto cambió con ADR-INFRA-0002 (cuenta por ambiente bajo la OU `Skorify`). La decisión de usar Datadog y el modelo de señales (logs, métricas, traces, audit) **siguen vigentes**; lo que cambia son los aspectos operativos derivados de la topología, principalmente CloudTrail y Datadog cross account (sin asumir centralización todavía: la centralización de logs en una cuenta dedicada queda diferida en ADR-INFRA-0011, decisión por tomar en un ADR SRE de seguimiento). No se edita este documento porque está aceptado.

## Contexto

El proyecto Skorify necesita observabilidad sobre tres ambientes que corren en una sola cuenta AWS, con frontend (Next.js SSG en S3+CloudFront), backend (Lambda+API Gateway) y eventualmente data (PostgreSQL). El equipo necesita ver:

- **Logs** estructurados de cada Lambda y de los componentes del frontend.
- **Métricas** custom y nativas de AWS (latencia API, errores Lambda, costo).
- **Traces** distribuidos (request entra por API Gateway → Lambda → DB).
- **Audit logs** de CloudTrail centralizados (responsabilidad absorbida del área de Seguridad).

Opciones evaluadas:

- **Datadog**: plataforma SaaS unificada (logs, metrics, APM, RUM, synthetics, SLOs). Excelente UX, dashboards potentes, integraciones con AWS sin desarrollo custom. Costo recurrente por host/Gb.
- **AWS CloudWatch + X-Ray**: nativo, sin costo externo significativo (pago por uso AWS), integrado a IAM. Dashboards más rudimentarios, correlación entre componentes manual.
- **Open Source self-hosted (Grafana + Loki + Tempo + Prometheus)**: flexible, gratis pero requiere infraestructura adicional y operación que el equipo no puede asumir hoy.

El equipo decidió **Datadog** anteponiendo el valor pedagógico (es una herramienta estándar de la industria que los estudiantes encontrarán en su carrera) y la unificación de señales (logs+métricas+traces en una sola UI con correlación automática). La decisión está aceptada; este ADR la formaliza.

## Decisión

Adoptamos **Datadog** como plataforma única de observabilidad para el proyecto Skorify, cubriendo logs, métricas, traces y audit logs (CloudTrail integrado).

Implicaciones:

1. Las Lambdas envían logs y traces a Datadog vía la integración nativa AWS↔Datadog (forwarder Lambda o subscripción de log groups). El método exacto se define en el ADR-SRE-0002.
2. CloudTrail se integra a Datadog para visibilidad de eventos de seguridad y auditoría.
3. El frontend reporta errores y eventos a Datadog (RUM) en fase 2 — no MVP.
4. La cuenta de Datadog y el plan asociado están **pendientes de definir** (ver ADR-SRE-0005). Hasta entonces, el equipo SRE puede prototipar con la cuenta de prueba gratuita.

## Consecuencias

### Positivas

- Una sola UI para todas las señales: reduce el costo cognitivo cuando un estudiante investiga un incidente.
- Correlación automática logs ↔ traces ↔ métricas vía atributos (`trace_id`, `service`, `env`).
- Integración con AWS (CloudWatch metric streams, CloudTrail events) sin desarrollo custom.
- Valor pedagógico: Datadog es referencia en la industria; aprenderlo aporta a la formación de los estudiantes.

### Negativas / Trade-offs

- **Costo recurrente** que hay que financiar (ver ADR-SRE-0005). Si el plan no se asegura, el ADR podría reemplazarse por uno que use CloudWatch como fallback.
- **Vendor lock-in**: dashboards, alertas y SLOs en Datadog no son trivialmente migrables a otra plataforma. Mitigación: mantener la instrumentación basada en estándares abiertos (OpenTelemetry) cuando sea posible.
- **Curva de aprendizaje**: configurar tags, índices de logs, monitors y SLOs requiere tiempo. Mitigación: documentar plantillas y patrones en `docs/runbooks/`.

### Neutrales / Riesgos a monitorear

- Volumen de logs y trace ingestion: el costo escala rápido si no se filtran o samplean traces. Establecer presupuestos y alertas de uso desde el día 1.
- Si el plan elegido (ADR-SRE-0005) tiene límites estrictos, hay que planificar fase 2 (RUM, synthetics) considerando incremento.
