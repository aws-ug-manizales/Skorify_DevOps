# ADR-0001: Adopción del formato Nygard y proceso de ADRs

- **Estado**: Aceptado
- **Fecha**: 2026-04-26
- **Área**: General
- **Autores**: @edisoncast (Edison Castro, coordinador general)
- **Aprobadores**: @steevensmelo (Steevens Castañeda, CI/CD), @Mateo454 (Mateo Marín, Infra), @lmichaelrc (Michael Rivera, SRE)

## Contexto

El equipo DevOps "Mediocampistas" toma decisiones técnicas que afectan a los tres equipos de aplicación (frontend, backend, data). El equipo es heterogéneo: tres sub-líderes con experiencia y la mayoría de integrantes son estudiantes en su primer proyecto de software. Las decisiones que se tomen en abril de 2026 deben ser entendibles, auditables y reversibles para personas que se incorporen meses después o que rotan entre áreas.

Sin un mecanismo formal de registro:

- Las decisiones quedan dispersas en mensajes de WhatsApp y reuniones.
- Quien llega nuevo no entiende **por qué** se eligió X sobre Y.
- Las reversiones se hacen sin documentar la nueva motivación.
- Los estudiantes pierden una oportunidad de aprendizaje sobre gobernanza técnica.

Necesitamos un formato simple, en español, que cualquier integrante del equipo pueda leer y escribir sin formación previa.

## Decisión

Adoptamos el formato **Nygard** para todas las decisiones arquitectónicas del equipo DevOps. Cada ADR contiene como mínimo: Estado, Fecha, Área, Autores, Aprobadores, Contexto, Decisión y Consecuencias.

Reglas del proceso:

1. **Propuesta vía Pull Request**: cualquier integrante puede proponer un ADR creando un PR con el archivo en `docs/adr/{area}/NNNN-titulo.md` y estado `Propuesto`.
2. **Aprobación estándar**: 2 personas del área dueña + 1 persona cruzada de otra área.
3. **Aprobación reforzada**: ADRs que toquen IAM, OIDC, red, secretos o audit logs requieren los **tres líderes de área** (Steevens Castañeda, Mateo Marín, Michael Rivera). Esto compensa la disolución del área de Seguridad — ver ADR-0002.
4. **Mergeo**: al mergearse, el estado pasa a `Aceptado`.
5. **Inmutabilidad**: los ADRs aceptados no se editan. Cambios sustanciales → ADR nuevo con `Reemplaza por: ADR-XXXX`; el viejo se marca `Obsoleto` con un commit que solo cambia el campo Estado.
6. **Idioma**: todo el contenido en español. Nombres de archivos en kebab-case y términos técnicos reservados en inglés.
7. **Numeración**: los ADRs generales (transversales) se numeran en `docs/adr/`. Los específicos de área se numeran independientemente en `docs/adr/ci-cd/`, `docs/adr/infra/` y `docs/adr/sre/`.

## Consecuencias

### Positivas

- Trazabilidad histórica de cada decisión técnica.
- Onboarding más rápido para nuevos integrantes.
- Ejercicio pedagógico para los estudiantes: aprenden a escribir y revisar ADRs, una práctica habitual en la industria.
- El requisito de cross-review evita decisiones tomadas en silos por una sola área.

### Negativas / Trade-offs

- Overhead de proceso para decisiones pequeñas. Mitigación: reservar ADRs para decisiones que tengan impacto cross-team o sean difíciles de revertir.
- La aprobación reforzada (3 líderes) puede ralentizar decisiones sensibles. Aceptamos el costo a cambio de evitar agujeros de gobernanza tras la disolución del área de Seguridad.

### Neutrales / Riesgos a monitorear

- Si los ADRs se vuelven una formalidad sin discusión real, perdemos el valor. Cada ADR debe tener sección **Contexto** suficientemente detallada para que el lector entienda por qué la decisión no es trivial.
- Los ADRs `Propuesto` que queden olvidados generan deuda. Revisar pendientes en cada retrospectiva del equipo.

## Notas adicionales

- Plantilla canónica: [`0000-template.md`](./0000-template.md).
- Formato Nygard original (referencia histórica): post de Michael Nygard "Documenting Architecture Decisions" (2011). Buscable como referencia de la industria.
