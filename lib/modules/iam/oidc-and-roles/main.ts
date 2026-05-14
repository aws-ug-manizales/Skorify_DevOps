import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

// ============================================================
// Tipos
// ============================================================

/**
 * Sufijo del `sub` claim emitido por GitHub Actions, después del
 * prefijo `repo:{org}/{repoName}:`. Cubre los 3 tipos de evento que
 * GitHub documenta:
 *
 * - **`ref:refs/heads/{branch}`** y **`ref:refs/tags/{tag}`**: workflows
 *   disparados por push o tag.
 * - **`pull_request`**: literal (sin `*`). Aplica a todos los PRs del
 *   repo sin distinción de origen ni rama.
 * - **`environment:{name}`**: workflows que apuntan a un GitHub
 *   Environment específico (recomendado para PROD).
 *
 * Soporta `*` solo en la parte final dinámica (ej. `ref:refs/heads/release/*`).
 *
 * Referencias:
 * - https://docs.github.com/en/actions/reference/security/oidc
 * - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html
 */
export type GitHubSubPattern =
  | `ref:refs/heads/${string}`
  | `ref:refs/tags/${string}`
  | 'pull_request'
  | `environment:${string}`;

/**
 * Rol IAM federado a GitHub OIDC. La trust policy queda condicionada al
 * `sub` del token: solo el repo + pattern declarados pueden asumirlo.
 */
export interface DeployRoleDefinition {
  /** CDK construct ID y clave en el output `roles`. */
  readonly logicalName: string;

  /** Nombre físico del rol en IAM. Convención: `{org}-{dominio}-deploy`. */
  readonly roleName: string;

  /**
   * Nombre del repositorio (sin la organización). La org la pasa el
   * caller en `OidcAndRolesModuleProps.githubOrg`. Ejemplo:
   * `'Skorify_Backend'`, no `'aws-ug-manizales/Skorify_Backend'`.
   */
  readonly repoName: string;

  /**
   * Patrones aceptados en el `sub` del JWT. Cada elemento se concatena
   * como `repo:{org}/{repoName}:{pattern}` y se evalúa con `StringLike`
   * en la trust policy.
   */
  readonly subPatterns: GitHubSubPattern[];

  /**
   * Statements inline. El módulo no envuelve managed policies amplias:
   * cada rol declara explícitamente lo que puede hacer.
   */
  readonly statements: iam.PolicyStatement[];

  /** Descripción para el atributo `Description` del rol IAM. */
  readonly description?: string;
}

export interface OidcAndRolesModuleProps {
  /**
   * Organización GitHub. Se concatena con `repo` de cada rol para armar
   * el `sub` del trust policy. En Skorify: `aws-ug-manizales`.
   */
  readonly githubOrg: string;

  /** Roles a crear bajo el mismo OIDC provider. */
  readonly roles: DeployRoleDefinition[];

  /**
   * Audience del JWT. AWS espera siempre `sts.amazonaws.com` para los
   * tokens emitidos por GitHub Actions; expuesto solo por testabilidad.
   */
  readonly audience?: string;
}

// ============================================================
// Construcción
// ============================================================

/**
 * Crea un OIDC provider para `token.actions.githubusercontent.com` y
 * los roles federados que lo consumen. Diseñado para correr una vez
 * por cuenta: cada workload account materializa su propio provider y
 * sus roles, sin cross-account assume.
 *
 * No agrega managed policies amplias por su cuenta. Cada rol declara
 * sus statements inline.
 */
export class OidcAndRolesModule extends Construct {
  /** OIDC provider creado para GitHub Actions. */
  public readonly provider: iam.OpenIdConnectProvider;

  /** Roles indexados por `logicalName`. `roleArn` resuelve al ARN. */
  public readonly roles: Record<string, iam.Role> = {};

  constructor(scope: Construct, id: string, props: OidcAndRolesModuleProps) {
    super(scope, id);

    this.validateProps(props);

    const audience = props.audience ?? 'sts.amazonaws.com';

    this.provider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: [audience],
    });

    for (const role of props.roles) {
      this.roles[role.logicalName] = this.createRole(role, props.githubOrg, audience);
    }
  }

  // ============================================================
  // Validaciones
  // ============================================================

  /** Fail fast antes de tocar AWS. */
  private validateProps(props: OidcAndRolesModuleProps): void {
    if (!props.githubOrg.trim()) {
      throw new Error('[OidcAndRolesModule] githubOrg no puede estar vacío.');
    }

    const logicalNames = props.roles.map((r) => r.logicalName);
    if (new Set(logicalNames).size !== logicalNames.length) {
      throw new Error('[OidcAndRolesModule] Todos los logicalName deben ser únicos.');
    }

    const roleNames = props.roles.map((r) => r.roleName);
    if (new Set(roleNames).size !== roleNames.length) {
      throw new Error('[OidcAndRolesModule] Todos los roleName deben ser únicos.');
    }

    for (const role of props.roles) {
      if (role.subPatterns.length === 0) {
        throw new Error(
          `[OidcAndRolesModule] El rol "${role.logicalName}" no declara subPatterns. ` +
            `Sin ellos cualquier workflow del repo podría asumirlo.`,
        );
      }

      if (role.statements.length === 0) {
        throw new Error(
          `[OidcAndRolesModule] El rol "${role.logicalName}" no declara statements. ` +
            `Un rol sin permisos no tiene sentido; declarar al menos uno o sacar el rol del array.`,
        );
      }

      if (role.repoName.includes('/')) {
        throw new Error(
          `[OidcAndRolesModule] repoName del rol "${role.logicalName}" no debe incluir la org ` +
            `(recibido: "${role.repoName}"). Pasar solo el nombre del repo; la org va en githubOrg.`,
        );
      }
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

  /**
   * Crea un rol con trust policy condicionada al `sub` del JWT de
   * GitHub Actions. Cada `subPattern` se concatena como
   * `repo:{org}/{repoName}:{pattern}`. La condición `StringLike` permite
   * `*` en la parte final dinámica (ej. `ref:refs/heads/release/*`).
   */
  private createRole(
    definition: DeployRoleDefinition,
    githubOrg: string,
    audience: string,
  ): iam.Role {
    const subs = definition.subPatterns.map(
      (pattern) => `repo:${githubOrg}/${definition.repoName}:${pattern}`,
    );

    const role = new iam.Role(this, definition.logicalName, {
      roleName: definition.roleName,
      description: definition.description,
      assumedBy: new iam.FederatedPrincipal(
        this.provider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': audience,
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': subs,
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      inlinePolicies: {
        deploy: new iam.PolicyDocument({
          statements: definition.statements,
        }),
      },
    });

    return role;
  }
}
