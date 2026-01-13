export default class DocumentListPage {
  constructor(router) {
    this.router = router;
  }

  async render(container) {
    container.innerHTML = '';

    // Charger le CSS de la page
    this.loadStyles();

    const pageContainer = document.createElement('div');
    pageContainer.className = 'document-list-page';

    // Titre
    const title = document.createElement('h1');
    title.textContent = 'Gestion des Documents';
    pageContainer.appendChild(title);

    // Message temporaire (à compléter plus tard)
    const message = document.createElement('div');
    message.className = 'placeholder-message';
    message.innerHTML = `
      <p>📄 Gestion des Documents</p>
      <p>Cette fonctionnalité sera disponible prochainement.</p>
      <p>
        Vous pourrez créer et gérer vos documents à partir de vos templates.
      </p>
    `;
    pageContainer.appendChild(message);

    container.appendChild(pageContainer);
  }

  loadStyles() {
    import('../utils/loadCSS.js').then(({ default: loadCSS }) => {
      loadCSS('pages/DocumentListPage.css', 'documentlistpage-styles');
    });
  }
}

