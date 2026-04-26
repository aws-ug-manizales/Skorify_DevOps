# Guia de contribucion

## Proceso para agregar o modificar workflows

1. Crea una rama desde `main` con el prefijo `feat/` o `fix/`
2. Realiza los cambios siguiendo la convencion de nombrado
3. Abre un PR usando el template proporcionado
4. Espera la aprobacion de los CODEOWNERS correspondientes
5. Haz merge a `main` y crea un tag si es un cambio significativo

## Convencion de nombrado para workflows

```
stage-componente.yml
```

Ejemplos: `lint-frontend.yml`, `deploy-backend.yml`, `sca-generic.yml`

## Convencion para composite actions

Cada action vive en su propio directorio dentro de `actions/`:

```
actions/
└── nombre-de-la-action/
    └── action.yml
```

## Tags y versionamiento

Cuando un cambio en un workflow es estable y listo para ser consumido por los repos:

```bash
git tag v1.0.0
git push origin v1.0.0
```
