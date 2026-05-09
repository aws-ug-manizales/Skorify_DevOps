# ADR-0003: Estructura del equipo DevOps "Mediocampistas" y áreas

- **Estado**: Aceptado
- **Fecha**: 2026-04-26
- **Área**: General
- **Autores**: @edisoncast (Edison Castro, coordinador general)
- **Aprobadores**: @steevensmelo (Steevens Castañeda, CI/CD), @Mateo454 (Mateo Marín, Infra), @lmichaelrc (Michael Rivera, SRE)

## Contexto

El proyecto Skorify se organiza simulando una estructura de industria con cuatro equipos: frontend, backend, devops y data. El equipo DevOps internamente se subdivide en áreas para cubrir el ciclo completo desde commit hasta operación, sin que una sola persona tenga que dominar todos los frentes.

El equipo es heterogéneo: un coordinador general, tres sub-líderes con experiencia y la mayoría de integrantes son estudiantes. Sin una estructura clara:

- Las decisiones se atascan en el coordinador general.
- Los estudiantes no tienen un canal natural de mentoría técnica.
- No hay claridad de a quién escalar un problema operativo.

## Decisión

El equipo DevOps "Mediocampistas" se organiza en **tres áreas** con un líder por área y aproximadamente 4 integrantes adicionales por área:

| Área | Líder | Tamaño | Alcance |
|------|-------|--------|---------|
| **CI/CD** | Steevens Castañeda | 5 | GitHub Actions, pipelines, plantillas reusables, pre-commit, secret scanning, SCA, gestión de secretos en CI |
| **Infra** | Mateo Marín | 5 | IaC (CDK frontend, SAM backend), recursos AWS, ambientes, IAM, OIDC, red, KMS, gestión de secretos runtime, cost governance |
| **SRE** | Michael Rivera | 5 | Observabilidad (Datadog), logging estructurado, métricas, traces, alertas, audit logging (CloudTrail), runbooks, postmortems |

**Coordinación general**: Edison Castro. Responsable de alinear las tres áreas, desbloquear dependencias inter-área y firmar como autor o revisor cruzado en ADRs generales.

**Reglas de operación**:

1. Cada área es dueña de su carpeta de ADRs (`docs/adr/{ci-cd,infra,sre}/`).
2. Los ADRs generales viven en `docs/adr/` y son escritos típicamente por el coordinador general o por consenso de los tres líderes.
3. Aprobación de ADRs específicos de área: 2 personas del área + 1 revisor de otra área.
4. Aprobación de ADRs sensibles (IAM, OIDC, red, secretos, audit logs): los tres líderes de área (ver ADR-0002).
5. Los estudiantes están explícitamente invitados a proponer y revisar ADRs como parte del proceso formativo.

## Consecuencias

### Positivas

- Ownership claro por temática técnica.
- Los estudiantes saben a quién acudir según el tema.
- Las decisiones que afectan a una sola área no requieren consenso de todo el equipo.
- La coordinación general no se vuelve cuello de botella en cada decisión.

### Negativas / Trade-offs

- Riesgo de silos: que CI/CD no entienda lo que hace Infra. Mitigación: cross-review obligatorio en ADRs.
- Si un líder se ausenta, su área queda sin dirección. Mitigación: los líderes documentan sus decisiones en ADRs para que sean reproducibles.
- Tamaño fijo de 5 por área es rígido; si el proyecto crece, habrá que reorganizar.

### Neutrales / Riesgos a monitorear

- La disolución del área de Seguridad (ver ADR-0002) cargó responsabilidades extra sobre las tres áreas. Monitorear si los líderes están sobrecargados.
- Reevaluar la estructura al final del MVP. Si una persona se mueve de área, registrar el cambio.

## Notas adicionales

- El equipo se denomina "Mediocampistas". El origen del nombre lo conoce el grupo y no se documenta aquí.
- Los handles individuales de GitHub y los equipos de la org `aws-ug-manizales` (referenciados en CODEOWNERS) están pendientes de definir/crear al momento de aceptar este ADR.
