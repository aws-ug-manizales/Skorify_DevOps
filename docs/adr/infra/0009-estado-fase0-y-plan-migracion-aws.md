# ADR-INFRA-0009: Estado fase 0 y plan de migración a AWS

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: Infra
- **Autores**: @Mateo454 (Mateo Marín)
- **Aprobadores**: <pendiente> (requiere los 3 líderes — toca el roadmap general de infra)

## Contexto

La auditoría del 2026-04-26 sobre los tres repos de aplicación reveló una brecha grande entre los ADRs target (qué queremos) y la realidad del código (qué hay hoy):

- Los ADRs INFRA-0001, INFRA-0003, INFRA-0004 describen un target de infra AWS con CDK (frontend) + SAM (backend) + S3/CloudFront + Lambda/API Gateway.
- En realidad: el equipo Infra todavía no ha construido los recursos AWS. Cada repo de aplicación está corriendo en un estado provisional muy distinto al target.

Estado real al 2026-04-26 (referencias verificables):

| Repo | Realidad fase 0 | Target ADR |
|------|-----------------|-----------|
| `Skorify_Frontend` | Next.js 16.2.2 sin `output: 'export'`, sin carpeta `infra/`, sin workflows AWS. Despliegue actual: indefinido. | ADR-INFRA-0003 (S3 + CloudFront vía CDK) |
| `Skorify_Backend` | Node monolítico con framework Iraca (`@scifamek-open-source/iraca/web-api`), corre en puerto 9898 con `nodemon`. SAM template existe solo como generador de código en `builders/`. Workflow `.github/workflows/deploy.yml` solo construye, no despliega. | ADR-INFRA-0004 (Lambda + API Gateway + SAM) |
| `Skorify_Data` | PostgreSQL local con Docker Compose. Es una librería consumible vía Git tag (`#v1.0.0-beta.2`). Sin AWS. | ADR-INFRA-0008 (Postgres en AWS, motor por definir) |

Los líderes del proyecto confirmaron explícitamente:

- **El backend DEBE correr en Lambda** (acuerdo global).
- **El frontend NO usará Amplify**: irá a S3 + CloudFront.
- **El equipo Infra construirá ambos recursos**.

Por tanto los ADRs target no se anulan; lo que falta es un plan explícito que lleve de la realidad (fase 0) al target.

## Decisión

Adoptamos un **modelo de fases** explícito para la migración a AWS. El equipo Infra es dueño de las fases 1 y 2; los equipos de aplicación colaboran en lo que les corresponda.

### Fase 0 — Estado actual (al 2026-04-26)

Aceptamos que el proyecto opera hoy en este estado y que es transitorio:

- Frontend: Next.js corriendo en cualquier despliegue temporal definido por el equipo FE (puede ser local, Vercel temporal, GitHub Pages u otro). Este ADR no fija ningún despliegue temporal — el equipo FE decide cómo demostrar avance mientras Infra construye.
- Backend: Iraca como monolito Node. Despliegue temporal a definir por BE+Infra (App Runner, EC2, ECS u otra opción de bajo costo) si necesitan demostrar avance antes de la fase 1.
- Data: Postgres local con Docker Compose; consumido por BE+FE solo en local.
- Sin OIDC, sin Datadog, sin pipelines de despliegue a AWS.

### Fase 1 — Construcción de infra AWS (owner: equipo Infra)

> **TODO** — completar por @Mateo454 con tiempos y dependencias:
>
> Recursos a construir, agrupados por sub-proyecto:
>
> - **Frontend**: bucket S3 + CloudFront + ACM (certificado en `us-east-1`) + Route53. CDK en TypeScript dentro del repo `Skorify_Frontend/infra/`.
> - **Backend**: API Gateway (REST o HTTP API por definir) + función Lambda + IAM roles. SAM en `Skorify_Backend/template.yaml`. Decisión por tomar entre BE+Infra: si Iraca se empaqueta como handler Lambda (vía Lambda Web Adapter o adaptador HTTP) o si BE reescribe handlers nativos.
> - **Data**: instancia PostgreSQL en AWS (motor RDS vs Aurora vs Aurora Serverless v2 a decidir en ADR posterior). VPC, subnets y SGs según necesidad real.
> - **Cross-cutting**: OIDC provider GitHub→AWS + IAM roles `skorify-deploy-{env}` (ver ADR-INFRA-0005).
> - **Pre-requisito FE**: el equipo Frontend activa `output: 'export'` en `next.config.ts` y verifica que ningún feature dependa de SSR/API routes/ISR.

### Fase 2 — Operación y observabilidad

> **TODO** — completar por @Mateo454 + @lmichaelrc:
>
> - Datadog integrado (ver ADR-SRE-0001 y -0002).
> - Pipelines completos en los tres repos (ver ADR-CICD-0001 y siguientes).
> - SSO/IAM avanzado, KMS, rotación de secretos.

## Consecuencias

### Positivas

- El equipo deja de pretender que la infra ya existe: el plan reconoce la realidad fase 0 y la trata como transitoria.
- Cada equipo de aplicación sabe qué se espera de él en la fase 1 (FE activa SSG, BE define empaquetado de Iraca, Data prepara migration de local a AWS).
- Reduce el riesgo de "deuda técnica fantasma": los ADRs target dejan de ser ficción y pasan a ser meta verificable.

### Negativas / Trade-offs

- Documentar la fase 0 puede dar la impresión de que la realidad provisional es aceptable a largo plazo. Mitigación: este ADR debe revisitarse cuando se cierre la fase 1; en ese momento la fase 0 deja de ser "estado actual" y pasa a ser "histórico".
- El acoplamiento entre BE e Infra (Iraca → Lambda) introduce una decisión técnica no trivial: empaquetar vs reescribir. Cualquiera de las dos tiene costo.

### Neutrales / Riesgos a monitorear

- **Riesgo**: que la fase 0 se prolongue más de lo esperado. Acordar una fecha tentativa para el cierre de fase 1 (no se fija en este ADR; lo define Infra) y revisar mensualmente.
- **Riesgo**: que cada equipo de aplicación haga decisiones de despliegue temporal divergentes durante la fase 0. Mitigación: cada equipo escribe sus decisiones temporales en su propio repo (no requiere ADR si es transitorio y no afecta a otros equipos), pero las comunica al coordinador para visibilidad.

## Notas adicionales

- Los ADRs INFRA-0001, INFRA-0003 y INFRA-0004 contienen bloques `<!-- NOTA OBSERVADA -->` que enlazan a este ADR.
- La decisión de motor AWS PostgreSQL (RDS vs Aurora) se difiere a un ADR independiente cuando Infra esté listo para construir.
