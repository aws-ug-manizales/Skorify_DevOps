## Descripcion

<!-- Describe brevemente qué cambia este PR y por qué -->

## Tipo de cambio

- [ ] Nuevo workflow / action
- [ ] Modificacion de workflow / action existente
- [ ] Cambio de infraestructura (IaC)
- [ ] Runbook / documentacion SRE
- [ ] Script operativo
- [ ] Nuevo ADR o cambio en ADR existente
- [ ] Documentacion general

## Si es un ADR

- **Numero y titulo**: ADR-XXXX —
- **Area**: CI/CD | Infra | SRE | General
- **Estado propuesto**: Propuesto | Aceptado
- **Reemplaza a**: (si aplica) ADR-YYYY
- **Toca IAM, OIDC, red, secretos o audit logs?**: Si / No
  - Si si, requiere review de los **tres lideres de area**

## Impacto

<!-- Indica qué repositorios o ambientes se ven afectados -->

- [ ] Frontend
- [ ] Backend
- [ ] Datos
- [ ] Infraestructura transversal

## Checklist

- [ ] He probado los cambios localmente o en un ambiente de prueba
- [ ] La documentacion relevante ha sido actualizada
- [ ] Los workflows modificados siguen la convencion de nombrado `stage-componente.yml`
- [ ] No se exponen secrets ni credenciales en el codigo
- [ ] (Si es ADR) Esta incluido en el indice del area correspondiente
