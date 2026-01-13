// src/modules/editor/collection/CollectionListPage.js
import ListPage from '../shared/components/listPage/ListPage.js';
import Page from '../shared/components/page/Page.js';
import { collectionApi } from '../shared/api/CollectionApi.js';

export default class CollectionListPage extends Page {
  constructor(router) {
    super(router);
  }

  render(container) {
    new ListPage({
      title: 'Collections',
      api: collectionApi,
      emptyText: 'Aucune collection disponible.',
      formAction: {
        placeholder: 'Rechercher...',
        buttonText: 'Créer une collection',
        onButtonClick: name => this.createCollection(name),
      },
      mapItemToCard: (col, refresh) => ({
        title: col.name,
        subtitle: col.description,
        actions: [
          {
            label: 'Éditer',
            onClick: () => {
              this.navigate(`/editor/collections/edit/${col._id}`);
            },
          },
          {
            label: 'Supprimer',
            onClick: async () => {
              if (!confirm(`Supprimer "${col.name}" ?`)) return;
              const res = await collectionApi.delete(col._id);
              if (res.success) refresh();
            },
          },
        ],
      }),
    }).render(container);
  }

  createCollection(name) {
    // 🔹 SPA redirect vers la page de création
    this.navigate('/editor/collections/create');
  }
}
