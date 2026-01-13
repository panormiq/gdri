export default class Router {
  constructor({ routes, outlet, basePath = '' }) {
    this.routes = routes;
    this.outlet = outlet;
    this.basePath = basePath;
  }

  start() {
    // Gestion du back/forward
    window.addEventListener('popstate', () => {
      this.resolve(window.location.pathname);
    });

    // Gestion des clics sur les liens SPA
    document.addEventListener('click', e => {
      const link = e.target.closest('[data-link]');
      if (!link) return;

      e.preventDefault();
      this.navigate(link.getAttribute('href'));
    });

    // Résolution initiale de la route
    this.resolve(window.location.pathname);
  }

  navigate(path) {
    // Ajout de l'historique et résolution
    history.pushState({}, '', this.basePath + path);
    this.resolve(this.basePath + path);
  }

  resolve(fullPath) {
    console.log('FULL PATH:', fullPath);
    console.log('BASE PATH:', this.basePath);

    // On retire le basePath pour obtenir le chemin SPA
    let path = fullPath;
    if (this.basePath && path.startsWith(this.basePath)) {
      path = path.slice(this.basePath.length) || '/';
    }

    // Gestion cas particulier /index.php
    if (path === '/index.php') path = '/';

    console.log('SPA PATH (after strip):', path);

    const match = this.matchRoute(path);

    if (!match) {
      console.warn('❌ NO MATCH FOR:', path);
      this.outlet.innerHTML = '<h2>404</h2>';
      return;
    }

    console.log('✅ MATCHED ROUTE:', match.route);

    // On instancie la page en passant router + params
    this.outlet.innerHTML = '';
    const page = new match.route.component(this, match.params);
    page.render(this.outlet);
  }

  matchRoute(path) {
    for (const route of this.routes) {
      const match = path.match(route.regex);
      if (match) {
        return { route, params: match.groups ? match.groups : match };
      }
    }
    return null;
  }
}
