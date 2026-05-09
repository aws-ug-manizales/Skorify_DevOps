# ADR-INFRA-0008: Stack PostgreSQL — TypeORM (entidades) + Knex (migrations y queries)

- **Estado**: Propuesto
- **Fecha**: 2026-04-26
- **Área**: Infra
- **Autores**: equipo Data (decisión ya implementada en `Skorify_Data`)
- **Aprobadores**: <pendiente>

## Contexto

El proyecto necesita una base de datos relacional. Tras conversación inicial entre los líderes, se confirmó **PostgreSQL** como motor. Este ADR fue marcado originalmente como "bloqueado" porque faltaba que el equipo data definiera el caso de uso y el stack concreto.

La auditoría del 2026-04-26 sobre el repo `Skorify_Data` reveló que el equipo data ya implementó las decisiones técnicas y las tiene en código. Este ADR formaliza esa realidad para que sea revisable y aprobable, en lugar de quedar como conocimiento implícito en el repo.

Hechos observados en `Skorify_Data` que motivan la decisión:

- `package.json` declara `pg`, `typeorm`, `knex`.
- `knexfile.js` configura el directorio `./migrations` con cliente `pg`.
- `/entities` contiene 15 entidades TypeScript decoradas con `@Entity`, `@Column`, `@PrimaryGeneratedColumn`, etc. (TypeORM).
- `/migrations` contiene un archivo Knex (`20260408210039_initial_setup.js`) que crea todas las tablas iniciales.
- `lib/services/*.service.ts` extiende `BaseDataService` y usa Knex (no QueryBuilder de TypeORM) para ejecutar queries.
- `docker-compose.yml` levanta `postgres:18.3-alpine` para desarrollo local.

El equipo data eligió un **patrón híbrido inusual**: TypeORM solo para definir el schema vía decoradores y Knex para ejecutar migrations y queries. Es atípico y merece justificación explícita.

Lo que **NO** está decidido aún:

- El motor AWS exacto (RDS Postgres vs Aurora vs Aurora Serverless v2). Eso depende de cuándo el equipo Infra construya y bajo qué presupuesto. Se difiere a un ADR posterior.

## Decisión

1. **Motor**: PostgreSQL.
2. **Versión local**: PostgreSQL 18.3 (imagen `postgres:18.3-alpine`).
3. **Definición de schema**: **TypeORM** mediante clases TypeScript decoradas (`@Entity`, `@Column`, etc.) en `Skorify_Data/entities/`.
4. **Migrations y queries en runtime**: **Knex** (`knex` y `pg`) configurado en `knexfile.js`, con migrations versionadas en `Skorify_Data/migrations/`.
5. **Soft delete**: campo `deleted_at TIMESTAMP NULL` en tablas que lo requieren (User, Team, Group, Prediction, Instance). La validación es manual en cada servicio (`where deleted_at IS NULL`); **no** se usa `DeleteDateColumn` de TypeORM.
6. **RBAC**: campo `role VARCHAR` en `User` con valores `general | global | instance`. Implementado como string libre en código, **sin** enum SQL.
7. **Modelo de empaquetado**: el repo Data se publica como librería npm/pnpm consumible vía Git tag (ver ADR-INFRA-0010). El backend importa `DBClient` y servicios desde esta librería en lugar de definir su propia conexión a la DB.
8. **Decisión diferida**: motor AWS específico (RDS vs Aurora vs Aurora Serverless v2) y configuración por ambiente. Se documentará en un ADR aparte cuando el equipo Infra construya.

## Consecuencias

### Positivas

- Schema y queries viven en el mismo repo, en TypeScript con tipos completos. Ningún equipo de aplicación duplica la definición de tablas.
- Knex permite migrations atómicas con rollback nativo, mejor que las migrations propias de TypeORM en proyectos pequeños.
- TypeORM aporta tipos automáticos sobre las entidades para los consumidores (BE), que pueden importar `User`, `Match`, etc. sin redeclararlas.
- Patrón de librería consumida vía Git centraliza la fuente de verdad del modelo de datos.

### Negativas / Trade-offs

- **Patrón híbrido TypeORM + Knex es inusual** y no encontrarás muchos ejemplos en la comunidad. La curva de aprendizaje para un nuevo integrante es mayor que adoptar uno solo de los dos.
- Soft delete manual (sin `DeleteDateColumn`) es propenso a errores: cualquier query nuevo debe acordarse de filtrar `deleted_at IS NULL`. Un olvido devuelve datos borrados.
- RBAC con string libre (no enum SQL) permite valores inválidos en la columna sin que la base se entere. Validación queda 100% en código.
- El motor AWS sigue sin definir; cuando Infra construya, hay que volver a este ADR (o crear uno hijo) para decidir RDS vs Aurora.

### Neutrales / Riesgos a monitorear

- Si en el futuro el equipo decide unificar a "solo TypeORM" o "solo Knex", este ADR se reemplazará. Hoy se acepta el híbrido tal como está implementado.
- Monitorear la integridad del soft delete: si crece a más de 5–6 tablas, considerar promoverlo a un patrón compartido (ej. una utilidad `softDeleteWhere()` o un decorator custom).
- Considerar añadir un `CHECK constraint` a `User.role` en una migration futura si el RBAC se mantiene como `general | global | instance`.

## Notas adicionales

- Documentación del modelo en `Skorify_Data/docs/DATABASE.md` y diagrama ER en `Skorify_Data/docs/SkorifyDB.png`.
- Concepto de negocio relevante: `Instance` es una "polla/pool" — grupo privado de usuarios que comparten reglas dentro de un torneo.
