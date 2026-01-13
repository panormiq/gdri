// src/modules/editor/collection/CollectionCreatePage.js
import Page from '../shared/components/page/Page.js';
import SchemaForm from '../shared/components/schemaForm/SchemaForm.js';
import FieldBuilder from '../shared/components/fieldBuilder/FieldBuilder.js';
import ListPage from '../shared/components/listPage/ListPage.js';
import { collectionApi } from '../shared/api/CollectionApi.js';

/* ----------------------------------------
   Utils
----------------------------------------- */
function slugify(text) {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/* ----------------------------------------
   Page
----------------------------------------- */
export default class CollectionCreatePage extends Page {
  constructor(router, params = {}) {
    super();
    this.router = router;
    
    // 🆔 édition si collection passée
    this.collectionData = params || null;
    this.collectionId = this.collectionData?._id || null;

    // Core
    this.collectionCoreData = this.collectionData
      ? {
          name: this.collectionData.name,
          description: this.collectionData.description,
          tags: (this.collectionData.tags || []).join(', ')
        }
      : {};

    // Fields
    this.fields = Array.isArray(this.collectionData?.fields)
      ? [...this.collectionData.fields]
      : [];
        console.log("fields recu", this.fields)
    // Schemas
    this.collectionCoreSchema = null;
    this.fieldTypesData = null;

    // UI state
    this.fieldsContainer = null;
    this.activeFieldBuilder = null;
    this.collectionForm = null;
  }

  /* ----------------------------------------
     Render
  ----------------------------------------- */
  async render(container) {
    container.innerHTML = '';

    // Charger le CSS
    this.loadStyles();

    // Container principal avec classe CSS
    const pageContainer = document.createElement('div');
    pageContainer.className = 'collection-create-page';
    container.appendChild(pageContainer);

    await this.loadSchemas();

    const title = document.createElement('h1');
    title.textContent = this.collectionId
      ? 'Modifier la collection'
      : 'Créer une collection';
    pageContainer.appendChild(title);

    this.renderCollectionCoreForm(pageContainer);
    this.renderFieldSection(pageContainer);
    this.renderSubmitButton(pageContainer);
  }

  /* ----------------------------------------
     Load Styles
  ----------------------------------------- */
  loadStyles() {
    import('../utils/loadCSS.js').then(({ default: loadCSS }) => {
      loadCSS('collection/CollectionCreatePage.css', 'collection-create-page-styles');
    });
  }

  /* ----------------------------------------
     Schemas
  ----------------------------------------- */
  async loadSchemas() {
    const coreRes = await collectionApi.getCore();
    const typesRes = await collectionApi.getFieldTypes();

    this.collectionCoreSchema = coreRes.success ? coreRes.data.core : {};
    this.fieldTypesData = typesRes.success ? typesRes.data : {};
  }

  /* ----------------------------------------
     Core form
  ----------------------------------------- */
  renderCollectionCoreForm(container) {
    const section = document.createElement('section');

    this.collectionForm = new SchemaForm({
      schema: this.collectionCoreSchema,
      values: this.collectionCoreData,
      onChange: data => (this.collectionCoreData = data)
    });

    this.collectionForm.render(section);
    container.appendChild(section);
  }

  /* ----------------------------------------
     Fields
  ----------------------------------------- */
  renderFieldSection(container) {
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = 'Champs dynamiques';
    section.appendChild(h2);

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Ajouter un champ';
    addBtn.onclick = () =>
      this.openFieldBuilder({
        onSave: field => {
          this.fields.push(field);
          this.renderFieldsList();
        }
      });

    section.appendChild(addBtn);

    this.fieldsContainer = document.createElement('div');
    this.fieldsContainer.className = 'fields-container';
    section.appendChild(this.fieldsContainer);

    container.appendChild(section);

    this.renderFieldsList();
  }

  /* ----------------------------------------
     List
  ----------------------------------------- */
  renderFieldsList() {
    const list = new ListPage({
      title: 'Champs de la collection',
      items: this.fields,
      emptyText: 'Aucun champ ajouté',
      mapItemToCard: field => {
        const typeLabel =
          Object.values(this.fieldTypesData.types).find(
            t => t.typeRef === field.typeRef
          )?.label || field.typeRef;

        return {
          title: field.label,
          subtitle: typeLabel,
          content: JSON.stringify(field.validationOverrides || {}, null, 2),
          actions: [
            {
              label: 'Modifier',
              onClick: () =>
                this.openFieldBuilder({
                  field,
                  onSave: updated => {
                    const i = this.fields.indexOf(field);
                    if (i !== -1) this.fields[i] = updated;
                    this.renderFieldsList();
                  }
                })
            },
            {
              label: 'Supprimer',
              onClick: () => {
                this.fields = this.fields.filter(f => f !== field);
                this.renderFieldsList();
              }
            }
          ]
        };
      }
    });

    this.fieldsContainer.innerHTML = '';
    list.render(this.fieldsContainer);
  }

  /* ----------------------------------------
     FieldBuilder (single instance)
  ----------------------------------------- */
  openFieldBuilder({ field = null, onSave }) {
  // Si un builder est déjà ouvert, demander confirmation
  if (this.activeFieldBuilder) {
    const ok = confirm(
      'Un champ est déjà en cours d’édition. Voulez-vous l’abandonner ?'
    );
    if (!ok) return;
    this.closeFieldBuilder();
  }

  const container = document.createElement('div');
  this.fieldsContainer.prepend(container);
 field && console.log("field", field);
  // Déterminer les données à passer au FieldBuilder
  const fieldData = field
    ? {
        ...field,          // Éditer un champ existant
       uiType: field.uiType  // 🔑 pour le select
      }
    : {
       
        name: '',
        position: this.fields.length,
        id: `new_${Date.now()}`, // id temporaire pour la création           // initialisation vide
        validation: {},
        options: {}
      };
    fieldData && console.log("donnée transmise", fieldData);
  // Créer le FieldBuilder
  const builder = new FieldBuilder({
    fieldCoreSchema: this.fieldTypesData.coreFields,
    baseTypes: this.fieldTypesData.baseTypes,
    types: this.fieldTypesData.types,
    fieldData, // 👈 ici on passe l'objet correct
    onAdd: fieldData => {
      this.closeFieldBuilder();
      onSave(fieldData);
    }
  });

  builder.render(container);

  this.activeFieldBuilder = { builder, container };
}

  closeFieldBuilder() {
    if (this.activeFieldBuilder) {
      this.activeFieldBuilder.container.remove();
      this.activeFieldBuilder = null;
    }
  }

  /* ----------------------------------------
     Submit
  ----------------------------------------- */
  renderSubmitButton(container) {
    const btn = document.createElement('button');
    btn.textContent = this.collectionId
      ? 'Mettre à jour la collection'
      : 'Créer la collection';

    btn.onclick = async () => {
      const core = this.collectionForm.getValues();
    console.log("fielllds",this.fields)
      const payload = {
       
        name: core.name,
        slug: slugify(core.name),
        description: core.description || '',
        tags: core.tags
          ? core.tags.split(',').map(t => t.trim())
          : [],
        fields: this.fields.map((f, i) => {
    // 🔹 Chercher le type dans fieldTypesData
   

    return {
      ...f,
      position: i,
      id: f.id || `${f.name}_${i}` // génération d'un id si absent
    };
  })
      };
console.log("createpage paylodsssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",payload);
      const res = this.collectionId
        ? await collectionApi.update(this.collectionId, payload)
        : await collectionApi.create(payload);

      if (res.success) {
        alert('Collection sauvegardée');
        this.navigate('/');
      } else {
        alert(res.error || res.message || 'Erreur');
      }
    };

    container.appendChild(btn);
  }
}
