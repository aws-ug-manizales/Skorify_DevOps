# ADR-INFRA-0007: Gestión de secretos — runtime y CI

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: Infra
- **Autores**: @Mateo454
- **Aprobadores**: <pendiente> (requiere los 3 líderes — toca secretos)

## Contexto

El proyecto manejará credenciales de Datadog, posibles API keys de servicios externos, secretos de base de datos (cuando data defina), y otros valores sensibles que **no** deben vivir en el código.

Hay dos planos distintos donde se necesitan secretos:

1. **Runtime AWS** (Lambdas, Tasks, etc.): para conectar a base de datos, llamar APIs externas, autenticar con servicios.
2. **CI/CD GitHub Actions**: para autenticarse a Datadog, Slack, NPM registries, etc. (las credenciales AWS se resuelven vía OIDC, ver ADR-INFRA-0005).

Opciones:

- **AWS Secrets Manager**: secretos cifrados con KMS, rotación automática para algunos servicios, pricing por secreto.
- **AWS Systems Manager Parameter Store**: parámetros (incluyendo `SecureString` cifrados con KMS), gratis hasta cierto volumen, sin rotación nativa.
- **GitHub Environments secrets**: secretos por ambiente con required reviewers para acceso, ideal para CI.

> **TODO** — completar por @Mateo454 (con revisión de @lmichaelrc para rotación):
> - Decidir cuándo se usa Secrets Manager (rotación, cross-account) vs Parameter Store (simple, barato).
> - Política de rotación: qué se rota automáticamente y qué requiere intervención manual.
> - Cómo accede una Lambda a un secreto: ¿variable de entorno cifrada? ¿llamada SDK al inicio? ¿Lambda Powertools/extensión Secrets?
> - Convención de naming de los secretos (paralelo al ADR-INFRA-0006).
> - Política para los secretos de CI: cuáles van como GitHub Org secrets, cuáles por GitHub Environment.

## Decisión

<!-- TODO -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->
