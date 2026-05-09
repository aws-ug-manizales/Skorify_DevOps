# ADR-INFRA-0001: CDK para frontend y SAM para backend

- **Estado**: Aceptado
- **Fecha**: 2026-04-26
- **Área**: Infra
- **Autores**: @Mateo454 (Mateo Marín)
- **Aprobadores**: @Mateo454, @steevensmelo, @lmichaelrc, @edisoncast

## Contexto

El proyecto necesita Infrastructure as Code (IaC) para los recursos AWS de los tres ambientes. El equipo evaluó las opciones disponibles dentro del ecosistema AWS y de la comunidad:

- **AWS CDK** (Cloud Development Kit) — define infraestructura en lenguajes de programación generales (TypeScript, Python, etc.) y compila a CloudFormation. Tiene constructs de alto nivel para casi todos los servicios AWS.
- **AWS SAM** (Serverless Application Model) — extensión de CloudFormation optimizada para aplicaciones serverless (Lambda, API Gateway, DynamoDB). Sintaxis YAML simplificada y CLI con utilidades específicas (local invoke, deploy, build).
- **Terraform** — multi-cloud, lenguaje propio (HCL), ecosistema maduro.
- **CloudFormation puro** — más verboso, sin abstracciones de alto nivel.

El equipo decidió usar **dos herramientas distintas**:

- **CDK para frontend** porque el stack del frontend (S3 + CloudFront + Route53 + ACM) tiene varias piezas no-serverless donde los constructs de alto nivel de CDK reducen mucho boilerplate.
- **SAM para backend** porque el backend es 100% serverless (Lambda + API Gateway) y SAM tiene utilidades específicas para iterar localmente (`sam local invoke`, `sam local start-api`).

Esta decisión se tomó antes de iniciar el proyecto y se documenta aquí en lugar de re-evaluarse. La decisión está aceptada; este ADR registra contexto y consecuencias para mantenedores futuros.

## Decisión

1. La infraestructura del frontend (Skorify_Frontend y sus recursos AWS) se define con **AWS CDK** en TypeScript, ubicado en una carpeta `infra/` dentro del repo Skorify_Frontend.
2. La infraestructura del backend (Skorify_Backend y sus recursos AWS) se define con **AWS SAM** en YAML, ubicada junto al código de las funciones Lambda en Skorify_Backend.
3. La infraestructura específica del repo Skorify_Data (motor AWS para PostgreSQL: RDS vs Aurora vs Aurora Serverless v2) se decidirá en un ADR aparte. El stack del repo Data ya está definido (Node.js + TypeScript + librería con TypeORM + Knex; ver ADR-INFRA-0008 y ADR-INFRA-0010).
4. Los recursos compartidos entre ambientes (cuenta AWS, OIDC provider para GitHub, IAM roles transversales) se definen con **CDK** en un repo o carpeta a definir por el equipo Infra.

## Consecuencias

### Positivas

- Cada equipo de aplicación usa la herramienta que mejor se ajusta a su carga de trabajo: el equipo backend itera localmente con `sam local`; el equipo frontend aprovecha los constructs de CDK para CDN, certificados y DNS.
- Los repos de aplicación quedan auto-contenidos: cada uno declara su propia infra junto a su código.

### Negativas / Trade-offs

- **Dos herramientas que aprender** para los estudiantes que roten entre frontend y backend. Mitigación: documentar ejemplos básicos en `docs/onboarding/` y ofrecer parejas mixtas durante el bootstrap.
- **Mantenimiento dual**: bumps de versión, configuración de credenciales y patrones de despliegue se duplican.
- Los recursos cross-stack (un bucket de logs central, un secret compartido) requieren coordinación porque viven en el repo de uno de los dos equipos o en un tercer repo.
- CloudFormation drift puede ocurrir si una herramienta toca recursos de la otra; hay que evitarlo con disciplina de scoping.

### Neutrales / Riesgos a monitorear

- Si el equipo en algún momento prefiere unificar (por ejemplo, todo a CDK o todo a Terraform), este ADR deberá ser reemplazado por uno nuevo.
- Monitorear el costo de switching cuando alguien rota entre frontend y backend; si se vuelve fricción real, replantear.

<!--
NOTA OBSERVADA (auditoría 2026-04-26):

Al momento de la auditoría, la infra AWS aún no ha sido construida por el equipo Infra.
Hallazgos por repo:
- Skorify_Frontend: no existe carpeta `infra/` con código CDK.
- Skorify_Backend: no existe `template.yaml` SAM en raíz; la plantilla solo aparece como
  generador de código en `builders/src/single-lambda-aws/templates/sam.template.yaml`.
- Skorify_Data: no aplica (no es responsable de infra de cómputo).

Esta brecha entre el target descrito en este ADR y el estado real está documentada
en ADR-INFRA-0009 (estado fase 0 y plan de migración a AWS). El target de este
ADR sigue siendo válido y es el destino acordado del proyecto.
-->

