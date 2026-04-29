# ADR-INFRA-0003: Frontend Next.js SSG en S3 + CloudFront

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: Infra
- **Autores**: @Mateo454
- **Aprobadores**: <pendiente>

## Contexto

El equipo frontend confirmó que Next.js se usará en modo **static export (SSG)**: `next build` genera HTML/CSS/JS estáticos sin requerir runtime servidor. Este modo permite servir el sitio desde un bucket S3 con CDN, sin necesidad de Lambda@Edge ni AWS Amplify Hosting ni OpenNext.

Componentes propuestos:

- **S3** — bucket privado con los artefactos estáticos.
- **CloudFront** — distribución CDN con OAC (Origin Access Control) hacia S3.
- **Route53** — zona DNS y registros para los hostnames de cada ambiente.
- **ACM** — certificado TLS para CloudFront (debe estar en `us-east-1`).

> **TODO** — completar por @Mateo454:
> - Definir hostnames por ambiente (`dev.skorify.example`, `stg...`, `skorify.example`).
> - Política de cache de CloudFront: TTL para HTML vs assets con hash.
> - Estrategia de invalidación al desplegar (¿invalidación amplia o solo de páginas modificadas?).
> - Headers de seguridad (CSP, HSTS, etc.) vía CloudFront Functions o Response Headers Policy.
> - Estrategia de error pages 403/404 → `index.html` para SPA-routing si aplica.

## Decisión

<!-- TODO -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->

<!--
NOTA OBSERVADA (auditoría 2026-04-26):

`Skorify_Frontend/next.config.ts` no incluye `output: 'export'`, por lo que Next.js
no está en modo static export. Sin esa configuración, Next.js requiere runtime para
SSR/API routes y no podría servirse desde S3+CloudFront puro como describe este ADR.

Acción requerida antes de desplegar a la infra que construya el equipo Infra:
- Equipo Frontend debe activar `output: 'export'` en `next.config.ts` y verificar
  que ningún feature del repo dependa de SSR, API routes, ISR o middleware dinámico.
- Si alguno de esos features es necesario, este ADR debe ser reemplazado por uno
  con un target distinto (ej. SSR con OpenNext sobre Lambda+CloudFront).

Restricción del proyecto: AWS Amplify Hosting queda fuera de alcance — el target
acordado es S3 + CloudFront vía CDK. Ver ADR-INFRA-0009 para el plan de fase 0.
-->

