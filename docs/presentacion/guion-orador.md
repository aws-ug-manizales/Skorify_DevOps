# Guion del orador · "De localhost a producción"

Presentación de 20 minutos · 17 slides · estilo TEDx · español
**Convenciones:** ⏸ pausa · 🎯 énfasis · 👀 mirar al público · 🔄 transición · ➡ avanzar fragment

---

## Antes de empezar (1 min, opcional)

Camina al centro del escenario. Inhala. Mira al público. **Espera 3 segundos en silencio** antes de hablar — eso te ancla y le anuncia al público que algo importante va a pasar.

---

## Slide 1 — Portada (30 s)

🎯 **No leas el título.** El título está en pantalla.

**Verbal**: *"Buenas tardes. Soy Edison, líder DevOps de Skorify. En los próximos 20 minutos no voy a contarles todo lo que hicimos — voy a contarles lo más caro que aprendí mientras lo hacíamos."*

⏸ **Pausa 2 s.** 👀 Barre la sala con la mirada.

**Tip**: dejar el silencio hace que la siguiente frase pegue más.

---

## Slide 2 — El reto que recibimos (1 min)

🎯 **Empieza por el reto, no por la solución.**

➡ Avanza el primer fragment (Data). *"Cuando llegué, había tres equipos en marcha."*
➡ Fragment 2 (Backend). *"Tres stacks distintos."*
➡ Fragment 3 (Frontend). *"Tres formas distintas de empacar, probar, desplegar."*
➡ Fragment 4 (footer rojo). 🎯 *"Y cero infraestructura. Cero CI/CD. Cero convención común."*

⏸ **Pausa 2 s** después del cero-cero-cero — deja que el silencio haga el trabajo.

**Story tip**: si tienes tiempo, agrega una anécdota corta antes del slide 3 (*"el día que vi tres ramas con el nombre de la misma persona supe que esto era un problema humano, no técnico"*).

---

## Slide 3 — La pregunta (45 s)

🎯 **Lee la pregunta despacio.** Esta es la única slide donde leer literalmente está bien — es la pregunta-ancla de la charla.

**Verbal**: *"¿Construimos cloud sin saber qué construir…"* ⏸ pausa de 1 s *"…o decidimos primero?"*

👀 Mira al público. **No avances todavía.** Deja la pregunta flotando.

---

## Slide 4 — La decisión (1 min 15 s)

🎯 **Frase central**: *"Antes del primer `cdk deploy` escribimos 28 ADRs."*

**Verbal**: *"La respuesta fue: decidimos primero. Antes del primer cdk deploy, antes de la primera línea de Terraform que no escribiremos, escribimos veintiocho decisiones de arquitectura. En formato Nygard. Con autor, fecha, y firma."*

🔄 **Transición**: *"La primera de esas decisiones no era técnica. Era humana."*

---

## Slide 5 — Estructura del equipo Mediocampistas (1 min 30 s)

🎯 **Esta slide es de servicio al público.** Aquí la audiencia debe llevarse: *"sé a quién preguntar."*

➡ Fragment 1 — CI/CD: *"Steevens lidera CI/CD. Pipelines, plantillas, escaneos. Cinco personas."*
➡ Fragment 2 — Infra: *"Mateo lidera Infra. CDK, SAM, AWS, IAM. Seis personas."*
➡ Fragment 3 — SRE: *"Michael lidera SRE. Logs, métricas, alertas. Cuatro personas."*
➡ Fragment 4 — footer: 🎯 *"¿Pipeline? Steevens. ¿AWS? Mateo. ¿Logs? Michael. Y yo coordino lo que cruza áreas."*

⏸ **Pausa.** Mira a Mateo y Michael en el público si están allí.

---

## Slide 6 — 28 decisiones documentadas (1 min)

🎯 **No leas la tabla.** Sólo dos números importan: 6 y 22.

**Verbal**: *"Veintiocho decisiones. Seis aceptadas — esos son los pilares: GitHub Actions, CDK, SAM, Datadog, formato ADR, estructura del equipo. Veintidós siguen propuestas, en revisión activa."*

🔄 *"Si quieren leerlas, están públicas, en main."* (señala el botón).

---

## Slide 7 — CI/CD · Columna vertebral (1 min 30 s)

🎯 **Lee el flujo paso a paso, un fragment a la vez.**

**Verbal antes del primer fragment**: *"Cuando un equipo abre un PR, este es el flujo que debería ejecutarse."*

➡ Fragment 1: *"Cualquier repo abre un PR."*
➡ Fragment 2: *"El repo llama las plantillas oficiales — no escribe las suyas."*
➡ Fragment 3: *"Las plantillas ejecutan lint, tests, escaneo de seguridad y build."*
➡ Fragment 4 (caja final magenta): 🎯 *"Mismo control de calidad para Frontend, Backend y Data."*
➡ Fragment 5 (bloque megáfono): *"Mensaje directo a los tres equipos: alineen sus pipelines a Skorify_DevOps. No reinventen workflows."*

---

## Slide 8 — Infraestructura · AWS (1 min 30 s)

🎯 **Una columna a la vez.** Cada columna es una historia distinta.

➡ Fragment 1 — Frontend: *"Frontend: Next.js compila estático, sube a S3, sirve desde CloudFront."*
➡ Fragment 2 — Backend: *"Backend: Node y TypeScript, empacado con SAM, corre en Lambda detrás de API Gateway."*
➡ Fragment 3 — Data: *"Data: librería propia, PostgreSQL en RDS, y SQS con DLQ — eso ya lo está construyendo el equipo de Data en su historia H10."*

🎯 **Frase de cierre**: *"Una sola cuenta AWS. Aislamiento por IAM y tags. Sin gastar de más."*

---

## Slide 9 — SRE · Datadog (1 min 15 s)

🎯 **MVP a la izquierda, Fase 2 a la derecha.**

➡ Fragment 1 — MVP: *"En Fase 1 instalamos Datadog y empezamos con lo básico: logs estructurados, métricas, traces."*
➡ Fragment 2 — Fase 2: *"En Fase 2, cuando haya tráfico real, sumamos SLOs, alertas, on-call rotativo y runbooks."*

🔄 *"¿Por qué Datadog? Porque es lo que la industria usa. Si los estudiantes salen del proyecto y entran a una empresa, ya saben la herramienta."*

---

## Slide 10 — CI/CD ya tiene código · Trivy (1 min)

🎯 **Pasa rápido.** El código está para que vean que es real, no para leerlo.

**Verbal**: *"Esto ya está en `develop`. Workflow reusable, container fijado a Trivy 0.70, tres scanners — vulnerabilidades, secretos, misconfigurations — en una pasada. Cualquier repo lo invoca con workflow_call."*

🎯 *"Lo importante no es Trivy. Lo importante es que es reusable."*

---

## Slide 11 — Infraestructura ya tiene código · S3 (1 min 15 s)

🎯 **El concepto, no la sintaxis.**

**Verbal**: *"Módulo S3 en CDK. La gracia no es que tenga 493 líneas — la gracia es que el módulo no decide qué bucket crear. Recibe la lista desde SSM Parameter Store. Agregar un bucket es un cambio en SSM, no un deploy."*

🔄 *"Eso baja la fricción para los equipos cuando necesiten storage."*

---

## Slide 12 — Devcontainer · onboarding (1 min 15 s)

🎯 **Esta es la slide más útil para el día a día del público.**

**Verbal**: *"Antes: descargar Node, instalar CDK, configurar AWS CLI, pedir SSO, equivocarse de región, perder dos horas. Ahora: clonar, 'Reopen in Container', listo. SSO automatizado, CDK bootstrap automatizado."*

🎯 *"Si tienen dudas con AWS o CDK, Mateo y Michael los pueden guiar."*

---

## Slide 13 — Estado actual (1 min 30 s)

🎯 **Slide de victoria — ráfaga de números.** Aquí el público debe sentir momentum.

➡ Fragment 1 (header "Volumen"): *"Hoy los equipos ya están subiendo código de verdad."*
➡ Fragments 2-4 (cards de números): *"Frontend: 47 PRs… Backend: 41… Data: 19 ramas activas. Esto NO existía cuando empezamos."*
➡ Fragment 5 (header "Adopción"): 🎯 *"Y miren la prueba de que las decisiones funcionan."*
➡ Fragments 6-8 (cards de adopción): *"Frontend ya implementa el workflow de validación. Data ya hace SQS y DLQ en AWS. DevOps tiene 8 ramas activas en paralelo."*

⏸ **Pausa** después del último fragment. *"La columna vertebral dejó de ser teoría hace semanas."*

---

## Slide 14 — Hoja de ruta · tres fases (1 min 30 s)

➡ Fragment 1 — Fase 0: *"Fase cero: hoy. Decidir y hacer bootstrap. Cerramos esta semana."*
➡ Fragment 2 — Fase 1: *"Fase uno: la siguiente. Construir AWS de verdad, OIDC, deploys reales, Datadog instalado."*
➡ Fragment 3 — Fase 2: *"Fase dos: cuando haya tráfico real. Operación, alertas, on-call. Hoy no lo necesitamos — pero ya está decidido."*

---

## Slide 15 — Lo que falta · sin maquillaje (1 min 45 s) ⚠ slide crítica

🎯 **Cambia el tono. Más serio. Más lento.**

**Verbal de apertura**: *"Si me detuviera aquí, esta charla sería propaganda. Lo que duele también es parte del avance."*

⏸ **Pausa 2 s**.

➡ Fragment 1 (columna izquierda): *"22 de 28 ADRs siguen sin firmar. Decidir no es firmar. Tenemos firmas pendientes en cosas críticas."*
➡ Fragment 2 (columna derecha): *"Sobre Datadog: aquí no falta 'alguien de presupuesto'. Somos comunidad, no empresa. La decisión de pagar Datadog la tomamos entre todos. Mientras la posponemos, hoy no tenemos un solo log estructurado en producción."*
➡ Fragment 3 (bloque rojo): 🎯 **El golpe**. *"La autocrítica más fuerte: el backend tiene 17 ramas, varias con nombres de personas. El contrato existe — pero ese equipo todavía no lo siente como suyo. Eso no se arregla con un workflow. Se arregla con conversación. Y esa conversación me toca a mí."*

⏸ **Pausa 3 s.** No llenes el silencio.

---

## Slide 16 — Lo que aprendí liderando (1 min 30 s)

🎯 **Una lección a la vez, en silencio entre cada una.**

➡ Fragment 1: *"Decidir explícitamente reduce reuniones."* ⏸
➡ Fragment 2: *"Los ADRs son contratos sociales más que técnicos."* ⏸
➡ Fragment 3: *"Coordinar tres áreas requiere tres lenguajes."* ⏸
➡ Fragment 4: *"Velocidad sin columna vertebral pone en riesgo la coherencia."* ⏸
➡ Fragment 5: *"El mejor onboarding es un devcontainer que funciona."* ⏸
➡ Fragment 6 (footnote): *"Mayoría del equipo son estudiantes en su primer proyecto. Decidir bien es enseñar bien."*

---

## Slide 17 — Cierre (45 s)

🎯 **Despedida corta. No la alargues.**

**Verbal**: *"El camino sigue. Lo que hicimos en Fase 0 no es la meta — es la columna vertebral que sostiene Fase 1 y Fase 2. Los siguientes 28 ADRs ya empiezan."*

⏸ **Pausa 2 s. Mira al público.**

*"Las preguntas las respondemos entre los cuatro líderes. Si quieren contribuir a un ADR, hablen con el área correspondiente. Gracias."*

⏸ **No te muevas.** Espera el aplauso. Sonríe. Da las gracias con un asentimiento.

---

## Tips generales TEDx

- **Manos visibles, no en bolsillos**. Gestos abiertos, no cerrados al pecho.
- **Pies plantados** en momentos de énfasis; camina solo en transiciones.
- **Voz**: baja en momentos críticos (slide 15, "lo que falta"), sube ligeramente en momentos de celebración (slide 13, "estado actual").
- **No leas las slides.** Las slides son para el público, no para ti.
- **Si te equivocas**, no lo señales. Sigue. El público no notó.
- **Cronómetro**: marca slides 5, 9 y 13 como hitos. Si llegas a slide 5 y van más de 6 min, recorta historias en slides siguientes.

---

## Indicaciones de Reveal.js para el orador

- Pulsa **`S`** al iniciar: abre el modo presentador con notas, slide siguiente y cronómetro.
- Las flechas **➡** del guion = una pulsación a *flecha derecha / espacio*.
- Si te pierdes, **`Esc`** muestra el overview de todos los slides.
- **`B`** o **`.`** pone la pantalla en negro — útil si quieres que el público te mire solo a ti.
- **`F`** pantalla completa.
