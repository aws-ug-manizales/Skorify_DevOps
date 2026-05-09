# Onboarding: Skorify_Data

Guía para conectar el repo `Skorify_Data` a las plantillas centralizadas de `Skorify_DevOps`.

> **Estado**: DESBLOQUEADO PARCIALMENTE. La auditoría del 2026-04-26 confirmó el stack del repo. Lo que sigue bloqueado es el target de despliegue AWS (depende de fase 1 según ADR-INFRA-0009).

## Stack confirmado tras auditoría

- **Lenguaje**: Node.js + TypeScript
- **Package manager**: pnpm
- **Base de datos**: PostgreSQL (TypeORM para entidades + Knex para migrations y queries; ver ADR-INFRA-0008)
- **Modelo de empaquetado**: librería consumida vía Git tag (`#v1.0.0-beta.2` ya existe; ver ADR-INFRA-0010)
- **Branching actual**: `main ← staging ← development ← features/*` (3 niveles)
- **Sin workflows GitHub Actions hoy**, sin tests, sin ESLint configurado

## Pasos esperados (en cuanto se acepten los ADRs relevantes)

1. **Branch protection** en `main`, `staging`, `development` — análogo a los otros repos.
2. **GitHub Environments** — cuando Infra construya AWS (fase 1).
3. **Workflows wrapper**
   - `.github/workflows/ci.yml` invocando `data-ci.yml@vX` cuando el reusable se implemente.
   - Workflows de despliegue solo aplican una vez que se decida el target AWS de la base de datos (fase 1).
4. **Pre-commit / hooks**
   - Adoptar la herramienta que se decida en ADR-CICD-0010 (Husky o framework `pre-commit`).
   - Hooks de referencia: ESLint, Prettier, commitlint, gitleaks.
5. **Tests**: el repo no tiene tests hoy. Adoptar Jest o Vitest cuando se prioriice.
6. **Migrations en producción**: definir en fase 1 quién es el "ejecutor canónico" de `knex migrate:latest` por ambiente. Ver ADR-INFRA-0008.

## Bloqueadores remanentes

- Decisión de motor AWS específico para Postgres (RDS vs Aurora vs Aurora Serverless v2) — depende de fase 1 / ADR-INFRA-0009.
- Decisión Husky vs `pre-commit` framework — depende de ADR-CICD-0010.

## Quién hace este onboarding

DevOps (Steevens Castañeda) + alguien del equipo Data en pareja.
