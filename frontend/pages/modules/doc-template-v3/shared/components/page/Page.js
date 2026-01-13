// src/modules/editor/shared/components/Page.js
export default class Page {
  constructor(router) {
    this.router = router;
  }

  // Méthode pour naviguer SPA
  navigate(path) {
    if (!this.router) return;
    this.router.navigate(path);
  }

  // Chaque page doit implémenter render()
  render(container) {
    throw new Error('render() doit être implémenté par la page fille');
  }
}
