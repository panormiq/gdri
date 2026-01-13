export default class Router {
  constructor({ routes, outlet, basePath = '' }) {
    this.routes = routes;
    this.outlet = outlet;
    this.basePath = basePath;

    // ⚡ pour debugger les double-calls
    this.lastResolvedPath = null;
  }

  start() {
    window.addEventListener('popstate', () => {
      console.log('📝 popstate detected');
      this.resolve(window.location.pathname);
    });

    document.addEventListener('click', e => {
      const link = e.target.closest('[data-link]');
      if (!link) return;

      e.preventDefault();
      this.navigate(link.getAttribute('href'));
    });

    // Normaliser le pathname initial (gère le rafraîchissement de page)
    let initialPath = window.location.pathname;
    
    // Retirer le chemin de base si présent (GDR ou doc_template)
    const gdriMatch = initialPath.match(/^(\/gdri\/frontend\/pages\/modules\/document-editor-v2)/);
    if (gdriMatch) {
      initialPath = initialPath.replace(gdriMatch[1], '');
    } else {
      const docTemplateMatch = initialPath.match(/^(\/continue\/doc_template\/front)/);
      if (docTemplateMatch) {
        initialPath = initialPath.replace(docTemplateMatch[1], '');
      }
    }
    
    // Normaliser index.php vers /
    if (initialPath.endsWith('/index.php') || initialPath === '/index.php') {
      initialPath = '/';
    }
    
    // S'assurer qu'on commence par /
    if (!initialPath.startsWith('/')) {
      initialPath = '/' + initialPath;
    }
    
    console.log('🚀 Router démarré avec path:', initialPath);
    this.resolve(initialPath);
  }

  navigate(path) {
    history.pushState({}, '', this.basePath + path);
    this.resolve(this.basePath + path);
  }

  async resolve(fullPath) {
    // ⚡ ne rien faire si c'est déjà la même route
    if (fullPath === this.lastResolvedPath) {
      console.log('⛔ Same path as last resolved, skipping');
      return;
    }
    this.lastResolvedPath = fullPath;

    let path = fullPath;
    
    // Retirer le chemin de base si présent
    if (this.basePath && path.startsWith(this.basePath)) {
      path = path.slice(this.basePath.length) || '/';
    }
    
    // Retirer aussi le chemin complet du projet si présent (GDR ou doc_template)
    const gdriMatch = path.match(/^(\/gdri\/frontend\/pages\/modules\/document-editor-v2)/);
    if (gdriMatch) {
      path = path.replace(gdriMatch[1], '');
    } else {
      const docTemplateMatch = path.match(/^(\/continue\/doc_template\/front)/);
      if (docTemplateMatch) {
        path = path.replace(docTemplateMatch[1], '');
      }
    }
    
    // Normaliser les chemins index.php
    if (path === '/index.php' || path.endsWith('/index.php')) {
      path = '/';
    }
    
    // S'assurer qu'on commence par /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    console.log('🔄 Resolve:', { fullPath, path });

    const match = this.matchRoute(path);

    if (!match) {
      console.warn('❌ NO MATCH');
      this.outlet.innerHTML = '<h2>404</h2>';
      return;
    }

    console.log('✅ MATCHED:', match.route.regex.source);

    this.outlet.innerHTML = ''; // vider avant de commencer

    let pageInstance;
    try {
      if (typeof match.route.component === 'function') {
        try {
          pageInstance = new match.route.component(this, match.params);
        } catch (err) {
          pageInstance = await match.route.component(this, match.params);
        }
      }

      if (!pageInstance) {
        console.log('🔀 Redirection détectée, arrêt du rendu');
        return;
      }

      await pageInstance.render(this.outlet);
      console.log('✅ PAGE RENDERED');
      
    } catch (err) {
      console.error('❌ Erreur:', err);
      this.outlet.innerHTML = `<h2>Erreur</h2>`;
    }
  }

  matchRoute(path) {
    for (const route of this.routes) {
      const match = path.match(route.regex);
      if (match && match[0] === path) { // match exact
        return { route, params: match.groups ? match.groups : match };
      }
    }
    return null;
  }
}
