// src/modules/editor/collections/CollectionListPage.js
import Page from '../shared/components/page/Page.js';
import ListPage from '../shared/components/listPage/ListPage.js';
import { collectionApi } from '../shared/api/CollectionApi.js';

export default class CollectionListPage extends Page {
  constructor(router) {
    super(router);
    this.items = [];
  }

  async render(container) {
    console.log('📄 CollectionListPage.render appelé');
    container.innerHTML = '';

    // 1️⃣ Chargement des collections
    console.log('📤 Chargement des collections...');
    const res = await collectionApi.getAll();
    console.log('📦 Réponse getAll:', res);
    
    this.items = res.success ? res.data : [];
    console.log('📦 Collections chargées:', this.items.length);

    const listPage = new ListPage({
      title: 'Collections',
      items: this.items,
      emptyText: 'Aucune collection disponible',
      formAction: {
        placeholder: 'Rechercher...',
        buttonText: 'Créer une collection',
        onButtonClick: () => this.createCollection(),
        onInput: q => this.filter(q),
      },
      mapItemToCard: col => ({
        title: col.name,
        subtitle: col.description,
        onClick: () => this.navigate(`/collections/${col._id}/elements/list`),
        actions: [
          {
            label: 'Éditer',
            onClick: (e) => {
              e.stopPropagation();  // ⚡ STOP le click pour la card
              console.log('edit click id:', col._id);
              this.navigate(`/collections/edit/${col._id}`);
            },
          },
          {
            label: 'Supprimer',
            onClick: async (e) => {
              e.stopPropagation(); // Empêcher l'ouverture de la collection
              this.deleteCollection(col);
            },
          },
        ],
      }),
    });

    listPage.render(container);
  }

  createCollection() {
    this.navigate('/collections/create');
  }

  async deleteCollection(col) {
    if (!confirm(`Supprimer "${col.name}" ?`)) return;

    const res = await collectionApi.delete(col._id);
    if (res.success) {
      this.items = this.items.filter(item => item._id !== col._id);
      this.render(document.querySelector('#app'));
    }
  }

  filter(query) {
    const q = query.toLowerCase();
    const filtered = this.items.filter(item =>
      item.name.toLowerCase().includes(q)
    );

    const listPage = new ListPage({
      title: 'Collections',
      items: filtered,
      emptyText: 'Aucune collection disponible',
      formAction: {
        placeholder: 'Rechercher...',
        buttonText: 'Créer une collection',
        onButtonClick: () => this.createCollection(),
        onInput: q => this.filter(q),
      },
      mapItemToCard: col => ({
        title: col.name,
        subtitle: col.description,
        onClick: () => this.navigate(`/collections/${col._id}/elements/list`), // 🔹 clic sur la card
        actions: [
          {
            label: 'Éditer',
            onClick: (e) => {
              e.stopPropagation(); // Empêcher l'ouverture de la collection
              this.navigate(`/collections/edit/${col._id}`);
            },
          },
          {
            label: 'Supprimer',
            onClick: async (e) => {
              e.stopPropagation(); // Empêcher l'ouverture de la collection
              this.deleteCollection(col);
            },
          },
        ],
       
      }),
    });

    listPage.render(document.querySelector('#app'));
  }
}
