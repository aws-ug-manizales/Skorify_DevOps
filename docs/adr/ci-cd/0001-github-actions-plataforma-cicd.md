# ADR-CICD-0001: GitHub Actions como plataforma de CI/CD

- **Estado**: Aceptado
- **Fecha**: 2026-04-26
- **Área**: CI/CD
- **Autores**: @steevensmelo (Steevens Castañeda)
- **Aprobadores**: @steevensmelo, @Mateo454, @lmichaelrc, @edisoncast

## Contexto

El proyecto Skorify necesita una plataforma de CI/CD que automatice validación de código, ejecución de pruebas, escaneo de seguridad y despliegue a tres ambientes (DEV, STG, PROD) sobre AWS. La plataforma será usada por cuatro equipos (frontend, backend, data y devops) con perfiles dispares: sub-líderes con experiencia y mayoría de estudiantes en su primer proyecto.

Restricciones que orientaron la decisión:

- Los repositorios del proyecto ya viven en GitHub bajo la org `aws-ug-manizales`.
- Presupuesto limitado por ser un proyecto comunitario; no podemos pagar plataformas con licencias caras.
- Curva de aprendizaje debe ser razonable para estudiantes; preferimos herramientas con documentación abundante en español/inglés y ejemplos públicos.
- Necesitamos integraciones nativas con AWS (OIDC), análisis de seguridad y entornos protegidos para aprobaciones.

Alternativas consideradas durante la discusión del equipo:

- **GitHub Actions**: integrado al hosting del código, sin servidor adicional, marketplace amplio.
- **AWS CodePipeline + CodeBuild**: nativo de AWS pero requiere más configuración y la curva inicial es más empinada.
- **Jenkins / GitLab CI / CircleCI**: descartadas por requerir hosting adicional o por estar fuera del ecosistema en el que ya trabajamos.

## Decisión

Adoptamos **GitHub Actions** como plataforma única de CI/CD para todos los repositorios del proyecto Skorify (Skorify_Frontend, Skorify_Backend, Skorify_Data y Skorify_DevOps).

Implicaciones inmediatas:

1. Todos los pipelines se definen en archivos `.github/workflows/*.yml` o se invocan vía `workflow_call` desde plantillas centralizadas en `Skorify_DevOps`.
2. Los ambientes de despliegue se modelan con **GitHub Environments** (DEV, STG, PROD) con sus propios secretos y reglas de protección.
3. La autenticación a AWS se hace vía **OIDC** (sin credenciales de larga duración en GitHub Secrets) — ver ADR-INFRA-0005.
4. Los runners son los hospedados por GitHub (`ubuntu-latest`); no se usan self-hosted runners en la fase MVP.

## Consecuencias

### Positivas

- Cero infraestructura adicional para el equipo: la plataforma ya está disponible donde vive el código.
- Marketplace de actions reduce el código boilerplate de los pipelines.
- `workflow_call` permite centralizar plantillas y versionarlas — ver ADR-CICD-0004.
- GitHub Environments + Required Reviewers cubre los requerimientos de aprobación a producción.

### Negativas / Trade-offs

- Vendor lock-in con GitHub: si en el futuro el código se mueve a otra plataforma, los workflows hay que reescribirlos.
- Costos de minutos de runner pueden subir si crecen los pipelines (especialmente E2E y performance en fase 2). Se mitiga con caching, jobs concurrentes selectivos y filtros por path.
- Los runners hospedados son menos flexibles que self-hosted (versiones de OS, herramientas no instaladas).

### Neutrales / Riesgos a monitorear

- Monitorear consumo de minutos por mes para detectar antes de alcanzar el límite del plan gratis del org.
- Si en fase 2 se introducen pruebas de carga pesadas, evaluar si conviene un self-hosted runner para esos jobs específicos.
