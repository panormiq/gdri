// front/src/modules/editor/document/DocumentListPage.js
import Page from '../shared/components/page/Page.js';
import ListPage from '../shared/components/listPage/ListPage.js';
import { documentApi } from '../shared/api/DocumentApi.js';

export default class DocumentListPage extends Page {
  constructor(router) {
    super(router);
    this.items = [];
  }

  async render(container) {
    container.innerHTML = '';

    // Charger le CSS de la page
    this.loadStyles();

    // 1️⃣ Chargement des documents
    const res = await documentApi.getAll();
    this.items = res.success ? res.data : [];

    const listPage = new ListPage({
      title: 'Documents',
      items: this.items,
      emptyText: 'Aucun document disponible',
      formAction: {
        placeholder: 'Rechercher...',
        buttonText: 'Créer un nouveau document',
        onButtonClick: () => this.createDocument(),
        onInput: q => this.filter(q),
      },
      mapItemToCard: doc => ({
        title: doc.name,
        subtitle: `Créé le ${new Date(doc.createdAt).toLocaleDateString('fr-FR')}`,
        onClick: () => this.navigate(`/documents/${doc._id}`),
        actions: [
          {
            label: 'Voir',
            onClick: (e) => {
              e.stopPropagation();
              this.navigate(`/documents/${doc._id}`);
            },
          },
          {
            label: 'Supprimer',
            onClick: async () => this.deleteDocument(doc),
          },
        ],
      }),
    });

    listPage.render(container);
  }

  loadStyles() {
    // Charger le CSS de DocumentListPage
    if (!document.getElementById('documentlistpage-styles')) {
      const link = document.createElement('link');
      link.id = 'documentlistpage-styles';
      link.rel = 'stylesheet';
      const baseUrl = window.BASE_URL || '/';
      link.href = baseUrl + 'pages/modules/doc-template-v3/document/DocumentListPage.css';
      document.head.appendChild(link);
    }
  }

  createDocument() {
    this.navigate('/documents/create');
  }

  async deleteDocument(doc) {
    if (!confirm(`Supprimer "${doc.name}" ?`)) return;

    const res = await documentApi.delete(doc._id);
    if (res.success) {
      this.items = this.items.filter(item => item._id !== doc._id);
      this.render(document.querySelector('#app'));
    } else {
      alert('Erreur lors de la suppression: ' + (res.error || 'Erreur inconnue'));
    }
  }

  filter(query) {
    const q = query.toLowerCase();
    const filtered = this.items.filter(item =>
      item.name.toLowerCase().includes(q)
    );

    const listPage = new ListPage({
      title: 'Documents',
      items: filtered,
      emptyText: 'Aucun document disponible',
      formAction: {
        placeholder: 'Rechercher...',
        buttonText: 'Créer un nouveau document',
        onButtonClick: () => this.createDocument(),
        onInput: q => this.filter(q),
      },
      mapItemToCard: doc => ({
        title: doc.name,
        subtitle: `Créé le ${new Date(doc.createdAt).toLocaleDateString('fr-FR')}`,
        onClick: () => this.navigate(`/documents/${doc._id}`),
        actions: [
          {
            label: 'Voir',
            onClick: (e) => {
              e.stopPropagation();
              this.navigate(`/documents/${doc._id}`);
            },
          },
          {
            label: 'Supprimer',
            onClick: async () => this.deleteDocument(doc),
          },
        ],
      }),
    });

    // Re-render dans le même container
    const container = document.querySelector('#app');
    container.innerHTML = '';
    listPage.render(container);
  }
}

