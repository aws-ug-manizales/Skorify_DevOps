# Onboarding: Skorify_Backend

Guía paso a paso para conectar el repo `Skorify_Backend` a las plantillas centralizadas de `Skorify_DevOps`.

> **Estado**: CASCARÓN. Esta guía describe el procedimiento esperado a alto nivel; los detalles exactos se completan cuando los reusable workflows estén implementados (ver ADR-CICD-0004).

> **Nota fase 0**: las plantillas de despliegue asumen que la infra AWS ya fue construida por el equipo Infra (fase 1 según ADR-INFRA-0009) y que el backend corre en Lambda + API Gateway. Hoy el backend corre como monolito Node con framework Iraca en puerto 9898 — no es aplicable a estas plantillas todavía. Ver `<!-- NOTA OBSERVADA -->` en ADR-INFRA-0004.

## Estado real observado (auditoría 2026-04-26)

- Stack: Node.js + TypeScript + pnpm + arquitectura hexagonal + Jest.
- Framework HTTP: `@scifamek-open-source/iraca/web-api` (Iraca) — no es API Gateway nativo.
- SAM template existe solo como GENERADOR de código en `builders/src/single-lambda-aws/templates/`, no como infra desplegable.
- Workflow existente `.github/workflows/deploy.yml` solo construye, no despliega.
- Sin ESLint, sin pre-commit, sin Datadog, sin storage AWS conectado.
- Decisión técnica pendiente: empaquetar Iraca como handler Lambda (vía Lambda Web Adapter) vs reescribir handlers nativos. Ver ADR-INFRA-0009.

## Pre-requisitos

- Permisos de administrador en el repo `aws-ug-manizales/Skorify_Backend`.
- El repo `Skorify_DevOps` tiene al menos un tag publicado (ej. `v0.1.0`).

## Pasos esperados

1. **Branch protection en `main` y `develop`** — análogo a `Skorify_Frontend`.

2. **GitHub Environments** — `development`, `staging`, `production` con secretos y reviewers.

3. **Workflows wrapper**
   - `.github/workflows/ci.yml` invocando `backend-ci.yml@vX`.
   - `.github/workflows/cd-dev.yml`, `cd-staging.yml`, `cd-prod.yml` invocando los respectivos.

4. **Pre-commit**
   - Copiar `pre-commit/backend.pre-commit-config.yaml` a la raíz del repo como `.pre-commit-config.yaml`.

5. **SAM**
   - El repo contendrá `template.yaml` y `samconfig.toml` gestionados por el equipo Backend.
   - Verificar que el proceso de build (`sam build`) está cubierto por la plantilla CI.

6. **CODEOWNERS** del repo.

> **TODO**: completar comandos y snippets cuando reusable workflows existan.

## Quién hace este onboarding

DevOps (idealmente Steevens Castañeda) + alguien del equipo Backend en pareja.
