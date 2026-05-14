# SCPs (Service Control Policies)

Carpeta reservada para las Service Control Policies que se aplicarán a la OU `Skorify` y/o al root de la organización.

## Estado

**Vacío por diseño.** Las SCPs concretas se decidirán en un PR aparte (sub-ADR si aplica) cuando el equipo Infra defina el set mínimo. Hasta entonces, `OrganizationsModule` no aplica ninguna SCP.

## Mínimos esperados (ADR-INFRA-0002 §7)

Cuando se implementen, las SCPs base deberían denegar al menos:

- Uso de regiones distintas a las permitidas (`us-east-1`, `us-east-2` en este momento).
- Acciones administrativas con identidad `root` salvo las que AWS exige explícitamente.
- Modificación de los OIDC providers gestionados por IaC.

## Validación

`aws organizations attach-policy` **no tiene `--dry-run`**, así que la validación de cualquier SCP nueva es por aislamiento, no por simulación: adjuntar primero a una OU sandbox o cuenta no crítica fuera de `Skorify`, validar el efecto desde una identidad IAM dentro de esa cuenta, y solo después adjuntar a `Skorify`. Ver `ADR-INFRA-0011`.

## Convención propuesta para cuando exista contenido

```
scps/
├── deny-regions.json         # JSON content de la policy
├── deny-regions.test.ts      # tests unitarios contra el documento
└── ...
```

El módulo cargará los archivos JSON y los expondrá como recursos `AWS::Organizations::Policy` con `TargetIds=[OU_SKORIFY_ID]`. La carga concreta se diseñará en el PR de implementación.
