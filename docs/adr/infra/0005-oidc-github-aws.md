# ADR-INFRA-0005: Autenticación GitHub Actions → AWS vía OIDC

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: Infra
- **Autores**: @Mateo454
- **Aprobadores**: <pendiente> (requiere los 3 líderes — toca IAM)

## Contexto

Los workflows de GitHub Actions necesitan credenciales para desplegar a AWS. Las dos opciones principales son:

- **AWS access keys de larga duración almacenadas en GitHub Secrets**: simple de configurar pero presenta riesgo si las llaves se filtran (rotación manual, sin scope por repo/ramo).
- **OIDC (OpenID Connect) entre GitHub y AWS**: GitHub emite un token de identidad por job; AWS lo intercambia por credenciales temporales asumiendo un IAM role con trust policy restringida a `repo:org/repo:ref:refs/heads/...`.

OIDC elimina credenciales de larga duración, permite scoping fino (rol distinto por ambiente, restringido a ramas específicas) y es el estándar recomendado por AWS y GitHub para CI/CD.

Esta es una decisión que toca IAM directamente, por lo cual requiere aprobación de los **tres líderes** según ADR-0002 general.

> **TODO** — completar por @Mateo454:
> - Definir nombre y ARN de los IAM roles por ambiente (`skorify-deploy-dev`, `skorify-deploy-stg`, `skorify-deploy-prd`).
> - Trust policy: condiciones exactas (`token.actions.githubusercontent.com:sub` matching repo y ref).
> - Permisos de cada rol: principio de menor privilegio (¿qué puede tocar cada rol en su ambiente?).
> - Definir si un solo provider OIDC sirve a todos los repos o si se separa por repo.
> - Documentar el procedimiento de bootstrap (crear el OIDC provider, los roles).

## Decisión

<!-- TODO -->

## Consecuencias

### Positivas

<!-- TODO -->

### Negativas / Trade-offs

<!-- TODO -->

### Neutrales / Riesgos a monitorear

<!-- TODO -->
