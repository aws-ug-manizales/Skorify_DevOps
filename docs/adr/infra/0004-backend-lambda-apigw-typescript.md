# ADR-INFRA-0004: Backend en Lambda + API Gateway + Node.js TypeScript

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: Infra
- **Autores**: @Mateo454
- **Aprobadores**: <pendiente>

## Contexto

El backend del proyecto Skorify es serverless: AWS Lambda como compute y API Gateway como entrada HTTP. El equipo backend confirmó que las funciones se escriben en **TypeScript** sobre runtime Node.js. SAM gestiona el packaging y despliegue (ver ADR-INFRA-0001).

> **TODO** — completar por @Mateo454:
> - Versión de runtime Node.js a fijar (la más reciente LTS soportada por Lambda al momento del MVP).
> - Tipo de API Gateway: **REST API** vs **HTTP API**. HTTP API es más barato y suficiente para la mayoría de casos.
> - Mecanismo de autenticación de las APIs (Cognito, JWT custom, API Keys, IAM, ninguno para MVP).
> - Tamaño de memoria por defecto y timeout de las Lambdas.
> - Cómo se construye el bundle TS: esbuild via `sam build`, manual, o capa Lambda compartida.
> - Almacenamiento (DynamoDB? RDS Postgres compartido con data?).

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

Al momento de la auditoría, Skorify_Backend NO corre en Lambda. Hallazgos:
- El servidor arranca en puerto 9898 con `nodemon` (estilo monolito Node).
- Usa el framework `@scifamek-open-source/iraca/web-api` (Iraca) para HTTP
  routing y DI, no API Gateway nativo de AWS.
- `template.yaml` SAM existe solo como GENERADOR de código en
  `builders/src/single-lambda-aws/templates/sam.template.yaml`, no como
  infraestructura desplegable.
- `.github/workflows/deploy.yml` solo construye, no despliega a AWS.
- No hay integración con Datadog, ni storage AWS conectado (DynamoDB/RDS).

Restricción del proyecto: el backend DEBE correr en Lambda — es un acuerdo
global confirmado por el coordinador. Este ADR sigue siendo el target válido.

Acciones requeridas (a planificar entre BE + Infra):
- Decidir si el código actual con Iraca se empaqueta como handler Lambda
  (vía Lambda Web Adapter o adaptador HTTP) o si se reescribe a handlers nativos.
- Construir el stack SAM real para Lambda + API Gateway por parte de Infra.
- Migrar el workflow `deploy.yml` existente a un pipeline que sí despliegue.

Plan de migración detallado en ADR-INFRA-0009.
-->

