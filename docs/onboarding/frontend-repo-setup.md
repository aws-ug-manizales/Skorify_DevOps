# Onboarding: Skorify_Frontend

Guía paso a paso para conectar el repo `Skorify_Frontend` a las plantillas centralizadas de `Skorify_DevOps`.

> **Estado**: CASCARÓN. Esta guía describe el procedimiento esperado a alto nivel; los detalles exactos se completan cuando los reusable workflows estén implementados (ver ADR-CICD-0004).

> **Nota fase 0**: las plantillas de despliegue (`cd-dev`, `cd-staging`, `cd-prod`) asumen que la infra AWS ya fue construida por el equipo Infra (fase 1 según ADR-INFRA-0009). Hasta que eso ocurra, los workflows de despliegue no son aplicables — solo el de validación CI tiene sentido.

## Estado real observado (auditoría 2026-04-26)

- Stack: Next.js 16.2.2 + React 19.2.4 + TypeScript.
- Package manager: **yarn** (la composite action `setup-node-pnpm` deberá ajustarse o crearse una hermana para yarn).
- Pre-commit: ya usa **Husky + lint-staged** (no `.pre-commit-config.yaml`).
- `next.config.ts` **no** tiene `output: 'export'` activo — debe activarse antes de desplegar a S3+CloudFront. Ver ADR-INFRA-0003.

## Pre-requisitos

- Permisos de administrador en el repo `aws-ug-manizales/Skorify_Frontend`.
- El repo `Skorify_DevOps` tiene al menos un tag publicado (ej. `v0.1.0`).

## Pasos esperados

1. **Branch protection en `main` y `develop`**
   - Activar "Require a pull request before merging".
   - Mínimo 2 reviewers.
   - Required status checks (los nombres exactos se definen cuando los workflows existan).

2. **GitHub Environments**
   - Crear `dev`, `stg`, `prd`. **Los nombres importan**: el rol `skorify-frontend-infra` (deploy de infra vía CDK) tiene la trust policy condicionada al `sub` `repo:aws-ug-manizales/Skorify_Frontend:environment:{dev|stg|prd}`, así que el job que hace `cdk deploy` debe declarar exactamente uno de esos nombres en `environment:` o el AssumeRole falla. Ver ADR-INFRA-0003 y ADR-INFRA-0005.
   - En cada environment: branch policy (`develop` para `dev`, `release/*` para `stg`, `main`/`hotfix/*` para `prd`, según ADR-CICD-0003) y, al menos en `prd`, required reviewers (los líderes definidos en ADR-INFRA-0003).
   - Configurar secrets necesarios por ambiente (ver ADR-INFRA-0007).

3. **Workflows wrapper**
   - Crear `.github/workflows/ci.yml` que invoque `aws-ug-manizales/Skorify_DevOps/.github/workflows/frontend-ci.yml@vX`.
   - Crear `.github/workflows/cd-dev.yml`, `cd-staging.yml`, `cd-prod.yml` con los reusable correspondientes. El job que despliega infra (`cdk deploy`) debe declarar `environment: dev|stg|prd` (ver paso 2); el job que sincroniza assets a S3 no usa environment.
   - Pasar inputs requeridos por las plantillas.

4. **Pre-commit**
   - Copiar `pre-commit/frontend.pre-commit-config.yaml` de Skorify_DevOps a la raíz del repo como `.pre-commit-config.yaml`.
   - Documentar `pre-commit install` en el README del repo.

5. **CODEOWNERS**
   - Crear `CODEOWNERS` con los owners del repo de aplicación.

> **TODO**: completar comandos exactos y snippets cuando los reusable workflows estén implementados.

## Quién hace este onboarding

Según el plan, lo realiza una pareja: alguien del equipo DevOps (idealmente Steevens Castañeda) + alguien del equipo Frontend, con valor pedagógico para los estudiantes.
