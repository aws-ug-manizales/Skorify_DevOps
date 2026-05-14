# ADR-INFRA-0003: Frontend Next.js SSG en S3 + CloudFront

- **Estado**: Aceptado
- **Fecha**: 2026-05-12
- **Área**: Infra
- **Autores**: @edisoncast, @Mateo454
- **Aprobadores**: @steevensmelo (CI/CD), @Mateo454 (Infra), @lmichaelrc (SRE). Requiere los tres líderes por tratarse de un ADR de infra que toca IAM (roles de deploy).

## Contexto

El equipo frontend confirmó que Next.js se usará en modo **static export (SSG)**: `next build` con `output: 'export'` genera HTML/CSS/JS estáticos sin runtime servidor. Eso permite servir el sitio desde un bucket S3 privado detrás de CloudFront, sin Lambda@Edge, sin OpenNext y sin AWS Amplify Hosting (Amplify está fuera de alcance del proyecto, ver ADR-INFRA-0009).

Pendientes resueltos en este ADR:
- Dónde vive la infra del frontend y qué rol la despliega.
- Naming de recursos por ambiente.
- Hostnames y certificados.
- Política de cache y de invalidación.
- Headers de seguridad.
- Páginas de error 403/404.

Restricción conocida (ver nota al final): el `Skorify_Frontend/next.config.ts` actual **no** tiene `output: 'export'`. El equipo frontend debe activarlo y verificar que ningún feature dependa de SSR/API routes/ISR/middleware dinámico antes de desplegar. Si alguno es necesario, este ADR se reemplaza por uno con target SSR.

## Decisión

1. **Modo y componentes**: SSG (`output: 'export'`) servido desde **S3 privado** + **CloudFront con OAC** (Origin Access Control hacia S3). Opcionalmente **Route53** (registros para los hostnames) y **ACM** (certificado TLS en `us-east-1`) cuando haya dominio. Todo gestionado con **AWS CDK**.

2. **Dónde vive la infra**: en el repo **`Skorify_Frontend`**, no en `Skorify_DevOps`. El repo del frontend tiene su propio CDK app (`infra/`) que define un stack `skorify-frontend-{env}` por ambiente. Razones: el equipo frontend es dueño de su infra (mismo patrón que el backend tendrá con SAM), y evita acoplar el repo a un package de módulos compartidos de `Skorify_DevOps` (que hoy no se publica como paquete). Un `StaticSiteModule` reusable en `Skorify_DevOps` queda como follow-up si más sitios estáticos lo necesitan.

3. **Dos roles de deploy** (mismo patrón que Pagina_Web: `awsug-pagina-web-deploy` + `awsug-pagina-web-infra`):
   - **`skorify-frontend-deploy`**: bajo privilegio, uso frecuente. Hace `next build && next export` y `aws s3 sync out/ s3://skorify-frontend-{env}` + `cloudfront create-invalidation`. Permisos: `s3:Put/Get/DeleteObject/ListBucket` sobre `skorify-frontend-*` + `cloudfront:CreateInvalidation/GetInvalidation/ListInvalidations`. Trust policy por rama según ADR-CICD-0003: `repo:aws-ug-manizales/Skorify_Frontend:ref:refs/heads/develop` (DEV), `release/*` (STG), `main` y `hotfix/*` (PROD). El job de assets **no** declara `environment:`.
   - **`skorify-frontend-infra`**: alto privilegio, uso raro: `cdk deploy` de la infra. Permisos: gestión del bucket `skorify-frontend-*` (config, no objetos), CloudFront (distro/OAC/response-headers-policy), Route53 (zonas y registros del dominio del proyecto), ACM (read/request), CloudFormation sobre `skorify-frontend-*`, `sts:AssumeRole` sobre los roles bootstrap `cdk-hnb659fds-*`, y S3 sobre el bucket `cdk-hnb659fds-assets-*`. El job `cdk-deploy-infra` corre **detrás de un GitHub Environment** (`dev`/`stg`/`prd` en el repo `Skorify_Frontend`) con required reviewers y branch policy. Al declarar `environment:`, GitHub emite el `sub` del OIDC como `repo:aws-ug-manizales/Skorify_Frontend:environment:{env}`, **no** `ref:refs/heads/...`; la trust policy de este rol usa ese patrón. Así el deploy de infra pasa siempre por el Environment (no se puede asumir el rol con un push directo). Mismo razonamiento aplica a `awsug-pagina-web-infra` (`environment:production`).

4. **Naming**: bucket `skorify-frontend-{env}` (kebab-case, `env` ∈ `dev`/`stg`/`prd`), stack CloudFormation `skorify-frontend-{env}`, OAC `skorify-frontend-{env}-oac`, response headers policy `skorify-frontend-{env}-headers`.

5. **Hostnames y certificados**: convención `{prefix}skorify.{tld}` donde `dev` y `stg` llevan prefijo (`dev-skorify.{tld}`, `stg-skorify.{tld}`) y `prd` no (`skorify.{tld}`). El dominio (`{tld}`) y el certificado ACM se confirman cuando se registre el dominio del proyecto. Mientras tanto, los stacks se despliegan **sin alias**: usan el dominio default `*.cloudfront.net` y el certificado default de CloudFront. El CDK app del frontend expone `domainAliases` y `acmCertificateArn` como inputs opcionales con default vacío, igual que el Terraform de Pagina_Web.

6. **Cache**: dos behaviors en la distribución:
   - **Default behavior**: managed cache policy `CachingOptimized` (TTL razonable, respeta `Cache-Control` del origen). El HTML de export no lleva hash, así que se invalida en cada deploy.
   - **`/_next/static/*`**: cache largo (`max-age` ~1 año, immutable). Esos assets llevan content hash en el nombre, nunca cambian para un mismo hash.
   - Compresión activada, `viewer_protocol_policy: redirect-to-https`, métodos `GET/HEAD/OPTIONS`.

7. **Invalidación**: post-deploy se invalida `/*`. Es lo más simple, los deploys son infrecuentes y CloudFront da 1000 invalidaciones/mes gratis. Se puede optimizar más adelante a invalidar solo los paths HTML (`/`, `/index.html`, `/*.html`) y dejar `/_next/static/*` sin invalidar (es immutable).

8. **Headers de seguridad**: Response Headers Policy con:
   - HSTS: `max-age=63072000` (2 años), `includeSubDomains`, `preload`, `override`.
   - `X-Content-Type-Options: nosniff`.
   - `X-Frame-Options: DENY`.
   - `Referrer-Policy: same-origin`.
   - CSP base (a afinar con el equipo frontend): MUI usa estilos inline (`style-src 'self' 'unsafe-inline'`), el frontend llama al backend API (`connect-src 'self' https://<api-host>`), `script-src 'self'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`. La CSP exacta se ajusta cuando el frontend esté desplegado y se vea qué orígenes usa de verdad.

9. **Páginas de error**: 403 y 404 → `/404.html` con `response_code = 404`. Next.js export genera `404.html` desde `app/not-found.tsx`. No se usa el patrón SPA (403/404 → `/index.html` con 200): el export estático genera un HTML por ruta, así que una ruta inexistente debe devolver 404 real (mejor para SEO y para que clientes y monitoring detecten errores).

10. **Ambientes**: stacks `skorify-frontend-dev` (cuenta `968306633562`), `skorify-frontend-stg` (`553284493694`), `skorify-frontend-prd` (`151646410766`). El stack se materializa según `CDK_DEFAULT_ACCOUNT`, igual que el `SkorifyBootstrapStack`.

## Consecuencias

### Positivas

- **Sin runtime servidor**: nada de Lambda, contenedores, escalado. S3 + CloudFront, costo mínimo, latencia baja por el CDN.
- **Equipo frontend dueño de su infra**: el CDK vive en su repo; cambian la infra con un PR ahí, sin depender del repo de DevOps.
- **Separación de privilegios**: el sync de assets (frecuente) no necesita los permisos del deploy de infra (raro, alto privilegio, con aprobación). Mismo patrón ya validado en Pagina_Web.
- **404 real**: mejor para SEO y monitoring que enmascarar rutas inexistentes como 200.
- **Assets immutables cacheados forever**: `_next/static/*` no se invalida, el CDN sirve siempre desde edge.

### Trade-offs

- **SSG es una restricción**: nada de SSR, ISR, API routes ni middleware dinámico. Si el frontend necesita alguno, hay que reemplazar este ADR por uno con target SSR (OpenNext sobre Lambda+CloudFront), más complejo y más caro.
- **`output: 'export'` pendiente del lado del frontend**: el repo no lo tiene activado todavía. Bloqueante para el primer deploy.
- **i18n con `next-intl` en SSG**: requiere que las rutas con locale sean estáticas (`generateStaticParams`) o usar `next-intl` "without i18n routing". El frontend hoy no usa `[locale]` segments (estructura `app/(dashboard)`), así que parece compatible, pero el equipo frontend debe confirmar al activar el export.
- **Dos roles más por cuenta**: `skorify-frontend-deploy` ya existía; se agrega `skorify-frontend-infra`. Más superficie de IAM que mantener.
- **Hostnames diferidos**: hasta que haya dominio, el sitio vive en `*.cloudfront.net`. No es ideal para compartir, pero desbloquea el deploy.

### A monitorear

- **Tamaño del export**: si crece mucho, los tiempos de `aws s3 sync` y de invalidación suben. Por ahora no es problema.
- **CSP rota features**: una CSP muy estricta puede romper MUI, las llamadas al API o recursos externos. Iterar con el frontend desplegado.
- **Drift de la distro**: igual que con Pagina_Web, asegurar que el `cdk deploy` de infra se corra desde el CI (no a mano) para que el state quede consistente. El workflow del frontend debe incluir el job de `cdk deploy` de infra detrás del environment con reviewers.
- **`skorify-frontend-infra` con `sts:AssumeRole` a los cdk-bootstrap roles**: igual que `skorify-infra-deploy`, el `cdk-hnb659fds-cfn-exec-role` default es admin; el least-privilege real está en la trust policy OIDC (solo el repo `Skorify_Frontend` en sus ramas).

## Notas adicionales

- ADRs correlacionados:
  - ADR-INFRA-0002: aislamiento por cuenta (los 3 ambientes son 3 cuentas).
  - ADR-INFRA-0005: OIDC GitHub a AWS (los 2 roles del frontend son federados).
  - ADR-INFRA-0006: tagging/naming AWS.
  - ADR-INFRA-0009: estado fase 0 y plan de migración (Amplify fuera de alcance).
  - ADR-CICD-0003: mapeo rama a ambiente (los `sub` patterns de los roles).
- Trabajo de seguimiento, fuera del alcance de este ADR:
  - Agregar el rol `skorify-frontend-infra` al `SkorifyBootstrapStack` y ajustar `skorify-frontend-deploy` a assets-only (cambio en `lib/modules/iam/oidc-and-roles/` de `Skorify_DevOps`).
  - El CDK app del frontend en `Skorify_Frontend/infra/`.
  - El workflow del frontend (job `cdk-deploy-infra` con environment + job `deploy-assets`).
  - Coordinar con el equipo frontend la activación de `output: 'export'`.
  - Registrar el dominio del proyecto y completar hostnames + ACM.
  - Evaluar extraer un `StaticSiteModule` reusable a `Skorify_DevOps` si Pagina_Web migra a CDK o aparece otro sitio estático.
- Decisión explícitamente diferida: la CSP exacta (se afina con el frontend desplegado).

<!--
NOTA DE AUDITORÍA (2026-04-26, vigente al 2026-05-12):

Skorify_Frontend/next.config.ts todavía no incluye output: 'export'. Sin esa
configuración, next build no genera el export estático y no hay nada que
sincronizar a S3. Acción requerida del equipo frontend antes del primer deploy:
- Activar output: 'export' en next.config.ts.
- Verificar que ningún feature del repo dependa de SSR, API routes, ISR o
  middleware dinámico. No hay src/middleware.ts y la estructura app/(dashboard) no
  usa [locale] routing, así que a priori es compatible, pero hay que confirmarlo.
- Si algún feature necesita runtime servidor, reemplazar este ADR por uno con
  target SSR.
-->
