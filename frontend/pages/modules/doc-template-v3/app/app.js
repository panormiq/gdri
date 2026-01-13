import Router from './Router.js';
import routes from './Routes.js';

console.log('📦 app.js chargé');

// Attendre que le DOM soit prêt
function initApp() {
  console.log('🚀 Initialisation de l\'application...');
  
  const outlet = document.getElementById('app');
  
  if (!outlet) {
    console.error('❌ Élément #app introuvable');
    return;
  }
  
  console.log('✅ Élément #app trouvé');
  // Détecter automatiquement le basePath depuis l'URL actuelle
  const currentPath = window.location.pathname;
  console.log('📍 Pathname actuel:', currentPath);

  // ⚠️ IMPORTANT : Ne pas initialiser le router si on est sur une route API
  if (currentPath.includes('/api')) {
    console.log('⛔ Route API détectée, router JS non initialisé');
  } else {
    let basePath = '';

    // Détecter le chemin jusqu'à doc-template-v3 (même si suivi d'une sous-route)
    // Exemples possibles:
    // - /frontend/pages/modules/doc-template-v3/templates
    // - /frontend/pages/modules/doc-template-v3/index.php
    // - /frontend/pages/modules/doc-template-v3/documents/edit/123
    // - /gdri/frontend/pages/modules/doc-template-v3/templates
    const moduleMatch = currentPath.match(/^(.+?\/doc-template-v3)/);
    if (moduleMatch) {
      basePath = moduleMatch[1];
      console.log('📍 BasePath détecté depuis module:', basePath);
    } else if (currentPath.startsWith('/doc-template')) {
      // Gérer le cas où le chemin commence directement par /doc-template
      const docTemplateMatch = currentPath.match(/^(\/doc-template)/);
      if (docTemplateMatch) {
        basePath = docTemplateMatch[1];
        console.log('📍 BasePath détecté (doc-template):', basePath);
      }
    }
    
    // Si toujours pas trouvé, essayer de détecter depuis index.php
    if (!basePath) {
      const indexMatch = currentPath.match(/^(.+?\/doc-template-v3\/index\.php)/);
      if (indexMatch) {
        basePath = indexMatch[1].replace('/index.php', '');
        console.log('📍 BasePath détecté depuis index.php:', basePath);
      }
    }

    console.log('📍 BasePath final:', basePath || '(racine)');

    const router = new Router({
      routes,
      outlet,
      basePath: basePath,
    });

    router.start();
    window.router = router;
    console.log('✅ Router initialisé');
  }
}

// Attendre que le DOM soit chargé
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // DOM déjà chargé
  initApp();
}
