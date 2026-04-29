/* =============================================================================
 * Inicialización de la presentación reveal.js v6 + highlight.js
 * Tema Skorify — DevOps · CI/CD · Infraestructura · SRE
 * ============================================================================= */

(function () {
  Reveal.initialize({
    hash: true,
    slideNumber: 'c/t',
    controls: true,
    progress: true,
    center: false,
    transition: 'slide',
    transitionSpeed: 'default',
    backgroundTransition: 'fade',
    width: 1280,
    height: 800,
    margin: 0.06,
    minScale: 0.2,
    maxScale: 2.0,
    plugins: [RevealHighlight, RevealNotes],
  });
})();
