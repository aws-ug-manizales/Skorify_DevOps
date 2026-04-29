# ADR-INFRA-0010: Skorify_Data como librería consumida vía Git

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: Infra
- **Autores**: equipo Data (decisión ya implementada)
- **Aprobadores**: <pendiente>

## Contexto

Históricamente se asumió que `Skorify_Data` sería un servicio o un repo de migrations independiente. La auditoría del 2026-04-26 reveló que el equipo data ya implementó un modelo distinto que conviene formalizar: **el repo Data es una librería npm/pnpm consumida desde otros repos vía Git tag**.

Hechos observados en `Skorify_Data`:

- `package.json` con `"name": "skorifydata"` y configuración de exports.
- Existe el tag Git `v1.0.0-beta.2` ya publicado.
- El repo expone `lib/index.ts` que re-exporta `DBClient` (clase) y todas las entidades TypeORM.
- El subdirectorio `dev-server/` es un servicio Express interno cuya `package.json` instala `skorifydata` como dependencia desde Git, demostrando el patrón de consumo: `pnpm add github:aws-ug-manizales/Skorify_Data#v1.0.0-beta.2`.
- 15 entidades, servicios y migrations viven dentro de la librería.

Este modelo **no estaba documentado** en ADRs antes de hoy. Formalizarlo permite que:

- El equipo BE consuma la librería con una versión fija y conocida.
- Los cambios al schema se versionen explícitamente (no son cambios silenciosos en producción).
- Los reviewers entiendan por qué Data no es un servicio AWS independiente.

## Decisión

1. **Skorify_Data se publica como librería npm/pnpm** consumible vía Git.
2. **Mecanismo de consumo**: `pnpm add github:aws-ug-manizales/Skorify_Data#<tag>` (o el equivalente con `npm`/`yarn`). Las dependencias `peerDependencies` requeridas (`pg`, `typeorm`, `knex`, etc.) las instala el repo consumidor.
3. **Versionado**: se usan **Git tags semver** del repo Data como puntos fijos (ej. `v1.0.0-beta.2`, `v1.0.0`, `v1.1.0`). Cada PR a `main` que cambie el schema o la API exportada produce un nuevo tag.
4. **Consumidores actuales**:
   - `dev-server/` interno del propio repo Data — para pruebas.
   - `Skorify_Backend` — consumirá la librería para conectarse a la DB y reutilizar entidades/servicios.
5. **Consumidores potenciales** (a evaluar caso por caso):
   - `Skorify_Frontend` — solo si necesita los **tipos** de entidades en cliente. Si solo consume el backend, no necesita la librería.
6. **Migrations**: las migrations Knex viven en la librería y se ejecutan vía `knex migrate:latest` desde el repo consumidor o desde el propio repo Data según el contexto. El procedimiento exacto se documenta en `Skorify_Data/README.md` (responsabilidad del equipo data).

## Consecuencias

### Positivas

- Una sola fuente de verdad del modelo de datos — no hay duplicación entre BE y FE.
- Versionado explícito permite que un cambio breaking del schema bloquee a los consumidores hasta que migren.
- El equipo Data puede iterar en su repo y publicar versiones a su ritmo.
- Tipos TypeScript completos atraviesan el boundary: el BE recibe `User`, `Match`, etc. con sus tipos derivados de las entidades TypeORM.

### Negativas / Trade-offs

- Instalar desde Git es más lento y menos cacheable que un registro npm privado. Si el ritmo de releases crece, considerar publicar al GitHub Packages npm registry.
- La librería incluye dependencias pesadas (TypeORM, Knex, pg) que el frontend no necesita; si FE alguna vez la consume, evitar import del runtime y usar solo los tipos (`import type`).
- Coordinación de migrations: si dos consumidores corren `knex migrate:latest` con versiones distintas de la librería, pueden chocar. La política operativa debe definir quién es el "ejecutor canónico" de migrations en cada ambiente.

### Neutrales / Riesgos a monitorear

- Si en el futuro varios servicios consumen la librería, considerar publicar al **GitHub Packages npm registry** para mejor caching y autenticación granular.
- Si el equipo FE termina necesitando solo los tipos, exponer un sub-export (`skorifydata/types`) que no arrastre dependencias runtime.
- Monitorear el peso del bundle si BE termina con dependencias transitivas excesivas.

## Notas adicionales

- Este ADR formaliza una decisión que ya está en código. El estado `Propuesto` indica que falta la firma de los aprobadores; no que la decisión esté en debate.
- ADR relacionado: ADR-INFRA-0008 (stack PostgreSQL TypeORM + Knex).
