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

  // Si pas de champs indexés, utiliser le premier champ disponible
  const fieldsToUse = indexedFields.length > 0 
    ? indexedFields 
    : (this.collection.fields || []).slice(0, 1);

  const titleField = fieldsToUse[0];
  const title = titleField && el[titleField.name] !== undefined && el[titleField.name] !== null
    ? String(el[titleField.name])
    : `Élément ${el._id}`;

  // Sous-titre : autres champs indexés (ou champs suivants si pas d'indexés)
  const subtitleFields = indexedFields.length > 0
    ? indexedFields.slice(1)
    : (this.collection.fields || []).slice(1, 3); // Prendre les 2-3 premiers champs suivants

  const subtitle = subtitleFields
    .filter(f => el[f.name] !== undefined && el[f.name] !== null)
    .map(f => {
      const value = el[f.name];
      // Formater la valeur selon le type
      let displayValue = value;
      if (typeof value === 'object' && value !== null) {
        if (value.type === 'upload' && value.url) {
          displayValue = '📎 Fichier';
        } else if (value.type === 'document' && value.name) {
          displayValue = `📄 ${value.name}`;
        } else {
          displayValue = JSON.stringify(value);
        }
      }
      return `${f.label || f.name}: ${displayValue}`;
    })
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
        onClick: (e) => {
          e.stopPropagation(); // Empêcher l'ouverture de l'élément
          this.deleteElement(el);
        }
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