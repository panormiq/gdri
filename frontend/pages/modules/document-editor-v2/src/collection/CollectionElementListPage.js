import Page from '../shared/components/page/Page.js';
import ListPage from '../shared/components/listPage/ListPage.js';
import FieldBuilder from '../shared/components/fieldBuilder/FieldBuilder.js';
import { collectionElementApi } from '../shared/api/CollectionElementApi.js';

export default class CollectionElementsPage extends Page {
  constructor(router, collection) {
    super(router);
    this.collection = collection.collection;
    this.elements = collection.elements || [];
    console.log("elements",this.elements)
    this.listPage = null;
    this.activeFieldBuilder = null;
  }

  async render(container) {
    container.innerHTML = '';
 const listPage = new ListPage({
      title: this.collection.name,
      items: this.elements,
      emptyText: 'Aucun element disponible',
      formAction: {
        placeholder: 'Rechercher...',
        buttonText: 'Ajouter un element',
        onButtonClick: () => this.navigate(`/collections/${this.collection._id}/elements/`),
        onInput: q => this.filter(q),
      },
mapItemToCard: el => {
  const indexedFields =
    (this.collection.fields || []).filter(f => f.indexed);

  const titleField = indexedFields[0];
  const title = titleField
    ? el[titleField.name]
    : `Élément ${el._id}`;

  const subtitle = indexedFields
    .slice(1)
    .map(f => `${f.label || f.name} : ${el[f.name] ?? '-'}`)
    .join(' • ');

  // S'assurer que l'ID est bien une string
  const elementId = String(el._id);
  const collectionId = String(this.collection._id);
  
  console.log('🔍 Navigation vers édition:', {
    elementId,
    elementIdLength: elementId.length,
    collectionId,
    fullElement: el
  });
  
  return {
    title,
    subtitle,
    onClick: () =>
      this.navigate(`/collections/${collectionId}/elements/${elementId}`),
    actions: [
      {
        label: 'Éditer',
        onClick: (e) => {
          e.stopPropagation(); // Empêcher le double clic
          this.navigate(`/collections/${collectionId}/elements/${elementId}`);
        }
      },
      {
        label: 'Supprimer',
        onClick: () => this.deleteElement(el)
      }
    ]
  };
}
    });

    listPage.render(container);
  }

  

  

  renderElementsList(container) {
    this.elementsContainer = container;

    this.listPage = new ListPage({
      title: `Éléments de la collection "${this.collection.name}"`, // titre ici
      items: this.elements,
      emptyText: 'Aucun élément pour cette collection',
      formAction: {
        placeholder: 'Rechercher un élément...',
        buttonText: 'Ajouter un élément',
        onButtonClick: () => this.openElementBuilder(),
        onInput: q => this.filterElements(q),
      },
      mapItemToCard: el => ({
        title: el.name || `Élément ${el._id}`,
        subtitle: JSON.stringify(el.values || {}, null, 2),
        actions: [
          {
            label: 'Éditer',
            onClick: () => this.openElementBuilder(el),
          },
          {
            label: 'Supprimer',
            onClick: async () => this.deleteElement(el),
          },
        ],
      }),
    });

    this.listPage.render(container);
  }

  filterElements(query) {
    const q = query.toLowerCase();
    const filtered = this.elements.filter(el =>
      (el.name || '').toLowerCase().includes(q)
    );
    this.listPage.updateItems(filtered);
  }

  async deleteElement(el) {
    if (!confirm(`Supprimer l’élément "${el.name}" ?`)) return;
    const res = await collectionElementApi.delete(this.collection._id, el._id);
    if (res.success) {
      this.elements = this.elements.filter(e => e._id !== el._id);
      this.listPage.updateItems(this.elements);
    } else {
      alert(res.error || 'Erreur lors de la suppression');
    }
  }

  openElementBuilder(element = null) {
    if (this.activeFieldBuilder) {
      if (!confirm('Un élément est déjà en cours d’édition. Voulez-vous l’abandonner ?')) return;
      this.closeElementBuilder();
    }

    const container = document.createElement('div');
    this.elementsContainer.prepend(container);

    const fieldData = element
      ? { ...element, uiType: element.uiType } // édition
      : {
          id: `new_${Date.now()}`,
          name: '',
          position: this.elements.length,
          values: {},
          validation: {},
          options: {},
        };

    const builder = new FieldBuilder({
      fieldCoreSchema: this.collection.fieldCoreSchema || {},
      baseTypes: this.collection.baseTypes || {},
      types: this.collection.types || {},
      fieldData,
      onAdd: async data => {
        let res;
        if (element?._id) {
          res = await collectionElementApi.update(this.collection._id, element._id, data);
          if (res.success) {
            const i = this.elements.findIndex(e => e._id === element._id);
            if (i !== -1) this.elements[i] = res.data;
          } else {
            alert(res.error || 'Erreur lors de la mise à jour');
          }
        } else {
          res = await collectionElementApi.create(this.collection._id, data);
          if (res.success) this.elements.push(res.data);
          else alert(res.error || 'Erreur lors de la création');
        }
        this.listPage.updateItems(this.elements);
        this.closeElementBuilder();
      },
    });

    builder.render(container);
    this.activeFieldBuilder = { builder, container };
  }
addElement(){
    this.navigate('/collections/create');
}
  closeElementBuilder() {
    if (this.activeFieldBuilder) {
      this.activeFieldBuilder.container.remove();
      this.activeFieldBuilder = null;
    }
  }
}