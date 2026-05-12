# Composite action: setup-aws-credentials

Configura credenciales AWS temporales vía OIDC en un workflow de un repo Skorify. Resuelve el ARN del rol federado a partir de `environment` y `domain` según la matriz de `ADR-INFRA-0005`, y delega en `aws-actions/configure-aws-credentials@v6` con el `audience` y `role-session-name` estandarizados.

No cubre la cuenta de gestión (master): el sitio de la comunidad (`Pagina_Web`) usa `aws-actions/configure-aws-credentials` directo, no este composite.

No usa secrets: el ARN se deriva. El workflow que lo invoca solo necesita `permissions: id-token: write`.

## Uso

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v6

      - name: Configure AWS credentials
        uses: aws-ug-manizales/Skorify_DevOps/actions/setup-aws-credentials@<sha>
        with:
          environment: dev       # dev | stg | prd
          domain: frontend       # backend | frontend | data | infra | ops

      - run: aws sts get-caller-identity
```

Pinear a un SHA (no a `@main`) en repos de producción.

## Inputs

| Input | Requerido | Default | Descripción |
|---|---|---|---|
| `environment` | sí | — | `dev` \| `stg` \| `prd`. |
| `domain` | sí | — | `backend` \| `frontend` \| `data` \| `infra` \| `ops`. |
| `aws-region` | no | `us-east-1` | Región. |

## Outputs

| Output | Descripción |
|---|---|
| `role-arn` | ARN del rol asumido. |
| `account-id` | ID de la cuenta AWS resuelta. |

## Resolución del rol

`environment` → cuenta workload:

| environment | cuenta |
|---|---|
| `dev` | `968306633562` |
| `stg` | `553284493694` |
| `prd` | `151646410766` |

`domain` → nombre del rol:

| domain | rol |
|---|---|
| `backend` / `frontend` / `data` / `infra` | `skorify-{domain}-deploy` |
| `ops` | `skorify-ops-readonly` |

Una combinación inválida (`environment` o `domain` fuera de los valores listados) falla con un error claro antes de intentar el assume.

## Trust policies

Cada rol solo puede asumirse desde el repo y la rama declarados en su trust policy (ver `lib/config/iam-roles-config.ts`):

| Ambiente | `sub` aceptado |
|---|---|
| dev | `repo:aws-ug-manizales/{repo}:ref:refs/heads/develop` |
| stg | `repo:aws-ug-manizales/{repo}:ref:refs/heads/release/*` |
| prd | `repo:aws-ug-manizales/{repo}:ref:refs/heads/main` y `hotfix/*` |

`skorify-ops-readonly` acepta cualquier rama (`refs/heads/*`).

Si el workflow corre desde una rama que no matchea el `sub` del rol, el assume falla con `AccessDenied`. Eso es esperado: es la garantía de aislamiento.

## Referencias

- `ADR-INFRA-0005`: OIDC GitHub a AWS.
- `ADR-CICD-0003`: mapeo rama a ambiente.
- `lib/modules/iam/oidc-and-roles/`: el módulo CDK que crea los roles.
- `docs/runbooks/oidc-bootstrap.md`: procedimiento de bootstrap.
