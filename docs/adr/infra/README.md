# ADRs — Área Infra

**Líder de área**: Mateo Marín (@Mateo454)

**Alcance**: IaC (CDK frontend, SAM backend), recursos AWS, ambientes, IAM, OIDC, red, KMS, gestión de secretos runtime, cost governance.

> Esta área absorbió responsabilidades de OIDC, IAM, red y KMS al disolverse el área de Seguridad — ver [ADR-0002 general](../0002-redistribucion-responsabilidades-seguridad.md).

## Índice

| ADR | Título | Estado |
|-----|--------|--------|
| [0001](./0001-cdk-frontend-sam-backend.md) | CDK para frontend y SAM para backend | Aceptado |
| [0002](./0002-aislamiento-ambientes-por-cuenta.md) | Aislamiento de ambientes por cuenta AWS | Aceptado |
| [0003](./0003-frontend-nextjs-ssg-s3-cloudfront.md) | Frontend Next.js SSG en S3 + CloudFront | Aceptado |
| [0004](./0004-backend-lambda-apigw-typescript.md) | Backend en Lambda + API Gateway + Node.js TypeScript | Propuesto |
| [0005](./0005-oidc-github-aws.md) | Autenticación GitHub Actions a AWS vía OIDC | Aceptado |
| [0006](./0006-tagging-naming-aws.md) | Estándar de tagging y naming AWS | Propuesto |
| [0007](./0007-gestion-secretos.md) | Gestión de secretos: SSM/Secrets Manager para runtime | Propuesto |
| [0008](./0008-motor-postgresql.md) | Stack PostgreSQL — TypeORM + Knex (decisión del equipo data) | Propuesto |
| [0009](./0009-estado-fase0-y-plan-migracion-aws.md) | Estado fase 0 y plan de migración a AWS | Propuesto |
| [0010](./0010-skorify-data-como-libreria.md) | Skorify_Data como librería consumida vía Git | Propuesto |
| [0011](./0011-organizations-cuentas-y-ous-en-iac.md) | AWS Organization, cuentas y OUs gestionadas como IaC | Aceptado |
| [0012](./0012-iam-identity-center-grupos-permission-sets.md) | IAM Identity Center: grupos, permission sets y assignments | Aceptado |
