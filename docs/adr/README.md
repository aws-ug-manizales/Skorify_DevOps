# Architecture Decision Records (ADRs)

Esta carpeta contiene todas las decisiones arquitectónicas del equipo DevOps "Mediocampistas".

## Formato

Usamos el formato **Nygard** ([plantilla](./0000-template.md)). Cada ADR tiene:

- **Estado**: `Propuesto`, `Aceptado`, `Rechazado`, `Obsoleto` o `Reemplazado por ADR-XXXX`
- **Contexto**, **Decisión** y **Consecuencias** como secciones obligatorias

## Proceso

1. Se propone un ADR vía Pull Request con estado `Propuesto`.
2. Aprobación: **2 personas del área dueña + 1 cruzado** de otra área.
3. ADRs sensibles (IAM, OIDC, red, secretos, audit logs) requieren los **tres líderes de área** (Steevens Castañeda, Mateo Marín, Michael Rivera).
4. Una vez mergeado, el estado pasa a `Aceptado`.
5. Cambios sobre un ADR aceptado → **ADR nuevo** que `Reemplaza por: ADR-XXXX`. No se editan ADRs aceptados.

Ver [ADR-0001 — Adopción del formato y proceso de ADRs](./0001-adopcion-formato-adr.md).

## Organización

```
docs/adr/
├── 0000-template.md
├── 0001-adopcion-formato-adr.md          # generales (transversales)
├── 0002-...md
├── ci-cd/                                # owner: Steevens Castañeda
├── infra/                                # owner: Mateo Marín
└── sre/                                  # owner: Michael Rivera
```

## Índice general

### Generales (transversales)

| ADR | Título | Estado |
|-----|--------|--------|
| [0001](./0001-adopcion-formato-adr.md) | Adopción del formato Nygard y proceso de ADRs | Aceptado |
| [0002](./0002-redistribucion-responsabilidades-seguridad.md) | Redistribución de responsabilidades tras disolución del área de Seguridad | Aceptado |
| [0003](./0003-estructura-equipo-devops.md) | Estructura del equipo DevOps (Mediocampistas) y áreas | Aceptado |

### Por área

- [CI/CD](./ci-cd/README.md)
- [Infra](./infra/README.md)
- [SRE](./sre/README.md)

## Convenciones de numeración

- Numeración por área (cada carpeta tiene su `0001`, `0002`, ...).
- ADRs generales viven en la raíz de `docs/adr/` y comparten su propia secuencia.
- Nombre de archivo: `NNNN-titulo-en-kebab-case.md`.
