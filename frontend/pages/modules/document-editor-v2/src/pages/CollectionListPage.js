// src/modules/editor/collection/CollectionCreatePage.js
import Page from '../shared/components/page/Page.js';
import CreatePage from '../shared/components/createPage/CreatePage.js';
import { collectionApi } from '../shared/api/CollectionApi.js';

export default class CollectionCreatePage extends Page {
  constructor(router) {
    super(router); // ✅ rend this.router accessible
    this.fieldTypes = null;
  }

  async render(container) {
    // 🔹 Charger les types de champs depuis l'API
    const res = await collectionApi.getFieldTypes();
    if (!res.success) return alert('Impossible de charger les types de champs');
    this.fieldTypes = res.data;

    // 🔹 Créer la page générique pour les fields
    new CreatePage({
      title: 'Créer une collection',
      api: collectionApi,
      coreFields: ['label', 'name'], // core spécifique à la collection
      fieldTypes: this.fieldTypes, // tous les types possibles
      submitText: 'Créer la collection',
      onSuccess: data => {
        // 🔹 après création, redirection vers la liste
        this.navigate('/editor/collections');
      },
    }).render(container);
  }
}
