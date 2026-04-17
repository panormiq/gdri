import Router from './Router.js';
import routes from './Routes.js';
import loadCSS from '../utils/loadCSS.js';

console.log('📦 app.js chargé');

loadCSS('styles/AppNav.css');

function createAppShell(root, basePath) {
  root.innerHTML = '';

  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const nav = document.createElement('nav');
  nav.className = 'app-nav';

  const left = document.createElement('div');
  left.className = 'app-nav-left';

  const right = document.createElement('div');
  right.className = 'app-nav-right';

  const links = [
    { label: 'Accueil', path: '/' },
    { label: 'Templates', path: '/templates' },
    { label: 'Documents', path: '/documents' },
    { label: 'Collections', path: '/collections' },
  ];

  links.forEach(link => {
    const a = document.createElement('a');
    a.className = 'app-nav-link';
    a.href = (basePath || '') + link.path;
    a.dataset.link = 'true';
    a.dataset.path = link.path;
    a.textContent = link.label;
    left.appendChild(a);
  });

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'app-nav-back';
  backButton.textContent = '← Retour';
  backButton.title = 'Revenir à la page précédente';
  backButton.onclick = () => window.history.back();
  right.appendChild(backButton);

  nav.appendChild(left);
  nav.appendChild(right);

  const content = document.createElement('div');
  content.className = 'app-content';
  content.id = 'app-content';

  shell.appendChild(nav);
  shell.appendChild(content);
  root.appendChild(shell);

  return { shell, nav, content };
}

function getNormalizedPath(basePath) {
  let path = window.location.pathname || '/';
  if (basePath && path.startsWith(basePath)) {
    path = path.slice(basePath.length);
  }
  if (path.endsWith('/index.php')) {
    path = path.replace('/index.php', '') || '/';
  }
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return path || '/';
}

function setActiveNav(nav, basePath) {
  if (!nav) return;
  const path = getNormalizedPath(basePath);
  nav.querySelectorAll('.app-nav-link').forEach(link => {
    const linkPath = link.dataset.path || '/';
    const isActive = linkPath === '/'
      ? path === '/'
      : path.startsWith(linkPath);
    link.classList.toggle('active', isActive);
  });
}

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

    const { content, nav } = createAppShell(outlet, basePath);
    const router = new Router({
      routes,
      outlet: content,
      basePath: basePath,
    });

    const originalNavigate = router.navigate.bind(router);
    router.navigate = (path) => {
      originalNavigate(path);
      setActiveNav(nav, basePath);
    };

    router.start();
    window.router = router;
    setActiveNav(nav, basePath);
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
