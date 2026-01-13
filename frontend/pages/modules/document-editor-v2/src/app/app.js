import Router from './Router.js';
import routes from './Routes.js';

const outlet = document.getElementById('app');

// Détecter automatiquement le basePath depuis l'URL actuelle
// Support pour : /continue/doc_template/front OU /gdri/frontend/pages/modules/document-editor-v2
const currentPath = window.location.pathname;
let basePath = '';

// Si on est dans GDR
const gdriMatch = currentPath.match(/^(\/gdri\/frontend\/pages\/modules\/document-editor-v2)/);
if (gdriMatch) {
  basePath = gdriMatch[1];
} else {
  // Sinon, chercher le chemin doc_template
  const docTemplateMatch = currentPath.match(/^(\/continue\/doc_template\/front)/);
  if (docTemplateMatch) {
    basePath = docTemplateMatch[1];
  }
}

console.log('📍 BasePath détecté:', basePath || '(racine)');

const router = new Router({
  routes,
  outlet,
  basePath: basePath,
});

router.start();
window.router = router;
