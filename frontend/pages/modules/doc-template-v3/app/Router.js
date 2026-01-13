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
    console.log('🔍 Pathname initial:', initialPath);
    
    // Retirer les paramètres de requête et fragments si présents (au cas où)
    if (initialPath.includes('?')) {
      initialPath = initialPath.split('?')[0];
    }
    if (initialPath.includes('#')) {
      initialPath = initialPath.split('#')[0];
    }
    
    // Retirer le basePath si défini
    if (this.basePath && initialPath.startsWith(this.basePath)) {
      initialPath = initialPath.slice(this.basePath.length);
      console.log('🔍 Pathname après retrait du basePath:', initialPath);
    }
    
    // Retirer aussi les anciens chemins si présents
    const oldBasePathMatch = initialPath.match(/^(\/continue\/doc_template\/front)/);
    if (oldBasePathMatch) {
      initialPath = initialPath.replace(oldBasePathMatch[1], '');
    }
    
    // Normaliser index.php vers /
    if (initialPath.endsWith('/index.php')) {
      initialPath = initialPath.replace('/index.php', '') || '/';
    } else if (initialPath === '/index.php' || initialPath.endsWith('index.php')) {
      initialPath = '/';
    }
    
    // S'assurer qu'on commence par /
    if (!initialPath.startsWith('/')) {
      initialPath = '/' + initialPath;
    }
    
    // Si le path est vide après normalisation, utiliser /
    if (!initialPath || initialPath === '') {
      initialPath = '/';
    }
    
    console.log('🚀 Router démarré avec path normalisé:', initialPath);
    
    // Utiliser resolve avec le pathname complet pour bénéficier de toute la logique de normalisation
    this.resolve(window.location.pathname);
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
    console.log('🔍 Resolve - fullPath:', fullPath);
    
    // Retirer les paramètres de requête et fragments si présents
    if (path.includes('?')) {
      path = path.split('?')[0];
    }
    if (path.includes('#')) {
      path = path.split('#')[0];
    }
    
    // Retirer le chemin de base si présent
    if (this.basePath && path.startsWith(this.basePath)) {
      path = path.slice(this.basePath.length);
      console.log('🔍 Path après retrait du basePath:', path);
    }
    
    // Retirer aussi les anciens chemins si présents
    const oldBasePathMatch = path.match(/^(\/continue\/doc_template\/front)/);
    if (oldBasePathMatch) {
      path = path.replace(oldBasePathMatch[1], '');
    }
    
    // Normaliser les chemins index.php
    if (path === '/index.php' || path.endsWith('/index.php')) {
      path = path.replace('/index.php', '') || '/';
    }
    
    // S'assurer qu'on commence par /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Si le path est vide après normalisation, utiliser /
    if (!path || path === '') {
      path = '/';
    }
    
    console.log('🔍 Path normalisé pour matching:', path);
    
    // ⚠️ IMPORTANT : Ignorer les routes API - elles sont gérées par le proxy Apache
    if (path.startsWith('/api') || path.startsWith('/doc-template/api')) {
      console.log('⛔ Route API détectée, ignorée par le router JS');
      return; // Ne pas router les routes API, laisser Apache/le proxy s'en charger
    }
    
    console.log('🔄 Resolve:', { fullPath, path });

    const match = this.matchRoute(path);

    if (!match) {
      console.warn('❌ NO MATCH pour le path:', path);
      console.warn('📍 Routes disponibles:', this.routes.map(r => r.regex.source));
      this.outlet.innerHTML = `
        <div style="padding: 2rem; text-align: center;">
          <h2>404 - Page non trouvée</h2>
          <p>La route <code>${path}</code> n'existe pas.</p>
          <a href="${this.basePath || '/'}" data-link>Retour à l'accueil</a>
        </div>
      `;
      return;
    }

    console.log('✅ MATCHED:', match.route.regex.source);

    // Nettoyer l'outlet avant de commencer
    this.outlet.innerHTML = '';
    
    // Afficher un indicateur de chargement
    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = 'padding: 2rem; text-align: center;';
    loadingDiv.innerHTML = '<p>Chargement...</p>';
    this.outlet.appendChild(loadingDiv);

    let pageInstance;
    try {
      if (typeof match.route.component === 'function') {
        try {
          // Essayer d'abord comme constructeur synchrone
          pageInstance = new match.route.component(this, match.params);
        } catch (err) {
          // Si ça échoue, essayer comme fonction asynchrone
          if (err.name !== 'TypeError' || !err.message.includes('is not a constructor')) {
            throw err; // Re-lancer si ce n'est pas une erreur de constructeur
          }
          pageInstance = await match.route.component(this, match.params);
        }
      } else {
        pageInstance = match.route.component;
      }

      if (!pageInstance) {
        console.log('🔀 Redirection détectée, arrêt du rendu');
        return;
      }

      // Retirer l'indicateur de chargement
      this.outlet.innerHTML = '';
      
      await pageInstance.render(this.outlet);
      console.log('✅ PAGE RENDERED');
      
    } catch (err) {
      console.error('❌ Erreur lors du rendu de la page:', err);
      console.error('📍 Stack:', err.stack);
      this.outlet.innerHTML = `
        <div style="padding: 2rem; text-align: center;">
          <h2>Erreur lors du chargement</h2>
          <p style="color: #d32f2f;">${err.message || 'Erreur inconnue'}</p>
          <details style="margin-top: 1rem; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
            <summary style="cursor: pointer; color: #666;">Détails techniques</summary>
            <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; margin-top: 0.5rem;">${err.stack || 'Pas de stack trace disponible'}</pre>
          </details>
          <a href="${this.basePath || '/'}" data-link style="display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: #1976d2; color: white; text-decoration: none; border-radius: 4px;">Retour à l'accueil</a>
        </div>
      `;
    }
  }

  matchRoute(path) {
    for (const route of this.routes) {
      const match = path.match(route.regex);
      if (match && match[0] === path) { // match exact
        // Extraire les paramètres depuis les groupes de capture
        // Les routes utilisent des groupes numérotés (params[1], params[2], etc.)
        const params = match.slice(1); // Retirer le premier élément qui est le match complet
        return { route, params };
      }
    }
    return null;
  }
}
