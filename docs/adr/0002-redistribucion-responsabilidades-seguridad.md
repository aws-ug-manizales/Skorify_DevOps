# ADR-0002: Redistribución de responsabilidades tras disolución del área de Seguridad

- **Estado**: Aceptado
- **Fecha**: 2026-04-26
- **Área**: General
- **Autores**: @edisoncast (Edison Castro, coordinador general)
- **Aprobadores**: @steevensmelo (Steevens Castañeda, CI/CD), @Mateo454 (Mateo Marín, Infra), @lmichaelrc (Michael Rivera, SRE)

## Contexto

El equipo DevOps "Mediocampistas" se diseñó originalmente con cuatro áreas: CI/CD, Infra, SRE y **Seguridad**. El área de Seguridad sería responsable de OIDC, IAM, ejercicios de red team y revisión de aspectos de seguridad transversales.

Antes del arranque del proyecto, el sub-líder designado para Seguridad dejó de estar disponible y no fue reemplazado. Tenemos un timeline ajustado para entregar y no podemos esperar a reclutar un nuevo líder ni promover internamente sin afectar la entrega.

Si dejamos las responsabilidades de seguridad sin dueño explícito:

- Nadie configura OIDC, IAM ni KMS → el resto de áreas se bloquea.
- El secret scanning, SCA y SAST no se incorporan a los pipelines.
- Quedamos sin revisor con perspectiva de seguridad para cambios sensibles.
- Existe el riesgo de que cada área asuma que "alguien más" se encargará.

## Decisión

Disolvemos formalmente el área de Seguridad y redistribuimos sus responsabilidades entre las tres áreas restantes según la siguiente tabla:

| Responsabilidad original (Seguridad) | Reasignada a | Notas |
|--------------------------------------|--------------|-------|
| OIDC GitHub→AWS | Infra | Trust policies, identity provider |
| IAM (roles, policies, boundaries) | Infra | Roles por ambiente, principio de menor privilegio |
| Network security (VPC, SG, NACL) | Infra | Si aplica al stack final |
| KMS y encriptación at-rest | Infra | Llaves por ambiente |
| Secret scanning en código (gitleaks) | CI/CD | Hook pre-commit + job en CI |
| SCA (vulnerabilidades en dependencias) | CI/CD | Trivy en stage SCA |
| SAST (vulnerabilidades en código) | CI/CD | Semgrep, fase 2 |
| Audit logging (CloudTrail) | SRE | Integrado a Datadog para visibilidad runtime |
| Gestión de secretos runtime | Infra (provisioning) + SRE (rotación y monitoreo) | SSM/Secrets Manager |
| Gestión de secretos CI | CI/CD | GitHub Environments secrets |

**Quedan fuera de alcance MVP** (documentadas como riesgo conocido):

- **Red team / pentesting activo**: no realista para el timeline ni el perfil del equipo (mayoría estudiantes). Mitigación: SCA + SAST automatizado cubre defensiva básica.
- **DAST** (dynamic application security testing): se evaluará en fase 2.
- **Compliance formal** (PCI/GDPR/SOC2): no aplica al alcance del proyecto.

**Compensación de gobernanza**: ADRs que toquen IAM, OIDC, red, secretos o audit logs requieren aprobación de los **tres líderes de área**, no solo del área dueña + 1 cruzado. Esto reemplaza la revisión que habría hecho el líder de Seguridad.

## Consecuencias

### Positivas

- Cada responsabilidad de seguridad tiene un dueño explícito y documentado.
- Las áreas absorbentes ya tienen contexto natural: IAM/OIDC encajan con quien gestiona AWS; secret scanning encaja con quien gestiona pipelines.
- La regla de cross-review reforzado mantiene tres pares de ojos en cambios sensibles.

### Negativas / Trade-offs

- Sin un líder de seguridad dedicado, perdemos profundidad técnica en temas como threat modeling o revisión de código con foco offensive.
- La carga de los tres líderes aumenta porque deben revisar todos los ADRs sensibles.
- Red team queda explícitamente fuera, lo cual deja una superficie de ataque sin probar.

### Neutrales / Riesgos a monitorear

- **Riesgo**: que ningún área se sienta dueña real de la seguridad y los temas se posterguen. Mitigación: cada retrospectiva revisa el backlog de ítems de seguridad y los tres líderes son corresponsables.
- Si en fase 2 el proyecto crece, reevaluar si conviene reactivar el área de Seguridad con un líder nuevo.

## Notas adicionales

- Cualquier ADR que toque temas absorbidos debe enlazar a este ADR-0002 en su sección de Contexto para hacer explícita la genealogía de la decisión.
