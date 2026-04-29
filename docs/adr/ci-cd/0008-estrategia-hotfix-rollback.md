# ADR-CICD-0008: Estrategia de hotfix y rollback

- **Estado**: Propuesto (fase 2)
- **Fecha**: 2026-04-26
- **Área**: CI/CD
- **Autores**: @steevensmelo
- **Aprobadores**: <pendiente>

## Contexto

`Skorify_CICD_strategy.pdf` describe un pipeline `cd-hotfix-deploy.yaml` para correcciones urgentes desde ramas `hotfix/*` con un flujo acelerado (lint + unit + build, sin pruebas pesadas) y luego merge dual a `main` y `develop`. Falta formalizar:

- Criterios para declarar un cambio como hotfix (vs un fix normal).
- Rollback: ¿se hace por CloudFront cache invalidation + S3 versioning para frontend? ¿Por Lambda alias para backend? ¿Por re-deploy de la versión anterior con un workflow `manual_dispatch`?
- Quién aprueba un hotfix a producción (¿requiere los mismos 2 reviewers que un release normal o puede ser un solo líder en horario de incidente?).

Este ADR queda en estado **Propuesto** hasta que el equipo tenga MVP de pipelines normales funcionando y haya un primer incidente o ejercicio que motive la decisión.

> **TODO** — completar por @steevensmelo cuando los pipelines DEV/STG/PROD estén estables.

## Decisión

<!-- TODO -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->
