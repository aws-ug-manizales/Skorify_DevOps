# Presentación · Avances DevOps de Skorify

Presentación TED-style de 20 minutos para el equipo interno (Frontend · Backend · Data · DevOps).
Construida con [reveal.js v5](https://revealjs.com/) y servida como HTML estático.

- **Tema**: *De localhost a producción · el camino DevOps de Skorify*
- **Coordinador**: @edisoncast (Edison Castro)
- **Líderes de área**: @steevensmelo (Steevens · CI/CD) · @Mateo454 (Mateo · Infra) · @lmichaelrc (Michael · SRE)
- **Equipo**: "Mediocampistas" · 19 slides · ~63 s por slide · 20 minutos
- **Idioma**: español (anglicismos solo para términos técnicos sin traducción natural)

---

## Cómo abrir la presentación

Reveal.js carga vía CDN, así que **no requiere `npm install`**. Solo necesitas un servidor HTTP estático local porque algunos navegadores bloquean recursos cuando se abre con `file://`.

```bash
cd docs/presentacion
python3 -m http.server 8000
# luego abre http://localhost:8000 en el navegador
```

Alternativas equivalentes:

```bash
# Node.js
npx serve .

# PHP
php -S localhost:8000
```

---

## Atajos de teclado en reveal.js

| Tecla | Acción |
|-------|--------|
| `→` / `Espacio` | Siguiente slide |
| `←` | Slide anterior |
| `F` | Pantalla completa |
| `S` | Modo presentador (notas + cronómetro + slide siguiente) |
| `O` / `Esc` | Vista general (overview) |
| `B` / `.` | Pausar (pantalla negra) |
| `?` | Mostrar todos los atajos |

---

## Modo presentador

Pulsa `S` durante la presentación. Se abre una segunda ventana con:

- Slide actual + slide siguiente.
- Notas del orador (las `<aside class="notes">` del HTML).
- Cronómetro y reloj.

> Ambas ventanas quedan sincronizadas. Útil cuando el proyector muestra una pantalla y el portátil otra.

---

## Exportar a PDF

Reveal.js soporta exportación nativa a PDF con un parámetro de URL:

```
http://localhost:8000/?print-pdf
```

Después usa el cuadro de impresión del navegador (Chrome/Edge funciona mejor que Firefox):

1. Abre la URL con `?print-pdf` al final.
2. `Ctrl+P` → destino: *Guardar como PDF*.
3. Configuración:
   - Tamaño de papel: **Letter** o **A4 horizontal**.
   - Márgenes: **Ninguno**.
   - Gráficos de fondo: **Activado**.
4. Guarda.

> Si los diagramas Mermaid no aparecen en el PDF, espera unos segundos antes de imprimir (Mermaid renderiza tras `Reveal.initialize`).

---

## Estructura de archivos

```
docs/presentacion/
├── index.html              # Las 17 slides
├── css/
│   └── skorify-theme.css   # Tema custom (paleta púrpura, Inter)
├── js/
│   └── slides-init.js      # Init reveal.js + Mermaid + highlight
├── img/
│   └── logo.jpg            # Logo Skorify (de Pagina_Web)
└── README.md               # Este archivo
```

---

## Identidad visual

Coherente 1:1 con [`Pagina_Web/css/styles.css`](../../../Pagina_Web/css/styles.css):

- Fondo principal `#1b1f30` (`--secondary-color`).
- Acentos `#8b5cf6` (`--primary-color`) y `#a855f7` (`--accent-color`).
- Tipografía `Inter` (400/500/600/700/800).
- Iconos Font Awesome 6.4.0.

---

## Mapa narrativo (5 actos · 19 slides · 20 minutos · ~63 s por slide)

| # | Slide | Acto |
|---|-------|------|
| 1 | Portada | I · El punto de partida |
| 2 | El reto que recibimos · tres equipos diversos | I |
| 3 | La pregunta | I |
| 4 | La decisión · 28 ADRs antes de `cdk deploy` | I |
| 5 | La primera decisión · estructura del equipo Mediocampistas | I |
| 6 | 28 decisiones documentadas | II · Lo decidido |
| 7 | CI · GitHub Actions como columna vertebral | II |
| 8 | CI ya tiene código · Trivy SCA | II |
| 9 | CD · cuando el merge se vuelve deploy | II |
| 10 | Infraestructura · AWS con CDK + SAM | II |
| 11 | Tres ambientes · tres cuentas | II |
| 12 | SRE · Datadog | II |
| 13 | Infraestructura ya tiene código · módulo S3 | III · Lo construido |
| 14 | Devcontainer · onboarding en 5 minutos | III |
| 15 | El estado actual · adopción cruzada del contrato | III |
| 16 | Hoja de ruta · tres fases | IV · Hacia producción |
| 17 | Lo que falta · sin maquillaje | IV |
| 18 | Lo que aprendí liderando | IV |
| 19 | Cierre · el camino sigue | V |

---

## Datos verificables citados en la presentación

| Slide | Cita | Fuente |
|-------|------|--------|
| 2 | Stacks reales por equipo (React+Next, Iraca, TypeORM+Knex) | `package.json` de cada repo |
| 4 | 28 ADRs en formato Nygard | `docs/adr/` en `feat/self-validation-ci` |
| 5 | Estructura "Mediocampistas" · líderes de área | `docs/adr/0003-estructura-equipo-devops.md` |
| 6 | 6 Aceptados · 22 Propuestos | Verificable con `scripts/verify-adr-status.py` |
| 10 | Workflow SCA con Trivy | `.github/workflows/shared--sca-generic.yml` (`develop`) |
| 11 | Script `verify-adr-status.py` (88 líneas) | `scripts/verify-adr-status.py` (`feat/self-validation-ci`) |
| 12 | Módulo S3 CDK (493 líneas + 275 tests) | `lib/modules/s3/main.ts` (`develop`) |
| 13 | Devcontainer con AWS SSO automatizado | `.devcontainer/devcontainer.json` (`develop`) |
| 14 | 47 PRs Frontend · 41 PRs Backend · 19 ramas Data | `git log` en cada repo |
| 14 | Frontend rama `feature/ci-vulnerability-scan` | `git branch -r` en `Skorify_Frontend` |
| 14 | Data H10 con SQS + DLQ + IAM | Commit `feat(h10)` en `Skorify_Data` |

---

## Personalización rápida

Si necesitas cambiar texto antes de presentar, edita directamente `index.html`. Cada slide es un `<section>` con su `<aside class="notes">` para las notas del orador.

Si cambias colores, modifica las `--primary-color` y compañía en `css/skorify-theme.css`.
