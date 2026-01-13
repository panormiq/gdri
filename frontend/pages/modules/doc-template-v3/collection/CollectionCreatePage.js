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
    if (!document.getElementById('collection-create-page-styles')) {
      const link = document.createElement('link');
      link.id = 'collection-create-page-styles';
      link.rel = 'stylesheet';
      const baseUrl = window.BASE_URL || '/';
      link.href = baseUrl + 'pages/modules/doc-template-v3/collection/CollectionCreatePage.css';
      document.head.appendChild(link);
    }
  }

  /* ----------------------------------------
     Schemas
  ----------------------------------------- */
  async loadSchemas() {
    const coreRes = await collectionApi.getCore();
    const typesRes = await collectionApi.getFieldTypes();

    console.log('📦 Core response:', coreRes);
    console.log('📦 Types response:', typesRes);

    this.collectionCoreSchema = coreRes.success ? coreRes.data.core : {};
    this.fieldTypesData = typesRes.success ? typesRes.data : {};
    
    console.log('📦 collectionCoreSchema:', this.collectionCoreSchema);
    console.log('📦 fieldTypesData:', this.fieldTypesData);
    console.log('📦 fieldTypesData.coreFields:', this.fieldTypesData?.coreFields);
    console.log('📦 fieldTypesData.baseTypes:', this.fieldTypesData?.baseTypes);
    console.log('📦 fieldTypesData.types:', this.fieldTypesData?.types);
  }

  /* ----------------------------------------
     Core form
  ----------------------------------------- */
  renderCollectionCoreForm(container) {
    const section = document.createElement('section');
    section.className = 'collection-core-form';

    console.log('📝 Rendu du formulaire core avec schema:', this.collectionCoreSchema);
    console.log('📝 Valeurs initiales:', this.collectionCoreData);

    if (!this.collectionCoreSchema || Object.keys(this.collectionCoreSchema).length === 0) {
      console.warn('⚠️ collectionCoreSchema est vide ou non défini');
      const warning = document.createElement('div');
      warning.className = 'warning';
      warning.textContent = '⚠️ Les champs de base ne sont pas chargés. Veuillez rafraîchir la page.';
      warning.style.color = 'orange';
      warning.style.padding = '1rem';
      warning.style.border = '1px solid orange';
      warning.style.borderRadius = '4px';
      warning.style.marginBottom = '1rem';
      section.appendChild(warning);
    }

    this.collectionForm = new SchemaForm({
      schema: this.collectionCoreSchema,
      values: this.collectionCoreData,
      onChange: data => {
        console.log('📝 Core form data changed:', data);
        this.collectionCoreData = data;
      }
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
    addBtn.className = 'btn-add-field';
    addBtn.onclick = (e) => {
      e.preventDefault();
      console.log('🔘 Bouton "Ajouter un champ" cliqué');
      console.log('📦 fieldTypesData disponible:', !!this.fieldTypesData);
      console.log('📦 coreFields disponible:', !!this.fieldTypesData?.coreFields);
      
      if (!this.fieldTypesData || !this.fieldTypesData.coreFields) {
        alert('Erreur: Les données de types de champs ne sont pas chargées. Veuillez rafraîchir la page.');
        console.error('❌ fieldTypesData ou coreFields manquant:', {
          fieldTypesData: this.fieldTypesData,
          coreFields: this.fieldTypesData?.coreFields
        });
        return;
      }
      
      this.openFieldBuilder({
        onSave: field => {
          console.log('💾 Champ sauvegardé:', field);
          this.fields.push(field);
          this.renderFieldsList();
        }
      });
    };

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
    console.log('🔧 openFieldBuilder appelé avec:', { field, fieldTypesData: this.fieldTypesData });
    
    // Vérifier que les données sont chargées
    if (!this.fieldTypesData) {
      console.error('❌ fieldTypesData non chargé');
      alert('Erreur: Les données de types de champs ne sont pas chargées. Veuillez rafraîchir la page.');
      return;
    }
    
    if (!this.fieldTypesData.coreFields) {
      console.error('❌ coreFields manquant dans fieldTypesData:', this.fieldTypesData);
      alert('Erreur: Les core fields ne sont pas disponibles. Veuillez rafraîchir la page.');
      return;
    }
    
    // Si un builder est déjà ouvert, demander confirmation
    if (this.activeFieldBuilder) {
      const ok = confirm(
        'Un champ est déjà en cours d\'édition. Voulez-vous l\'abandonner ?'
      );
      if (!ok) return;
      this.closeFieldBuilder();
    }

    const container = document.createElement('div');
    this.fieldsContainer.prepend(container);
    
    field && console.log("📝 Édition du champ:", field);
    
    // Déterminer les données à passer au FieldBuilder
    const fieldData = field
      ? {
          ...field,          // Éditer un champ existant
          uiType: field.uiType  // 🔑 pour le select
        }
      : {
          name: '',
          position: this.fields.length,
          id: `new_${Date.now()}`, // id temporaire pour la création
          validation: {},
          options: {}
        };
    
    console.log("📦 Données transmises au FieldBuilder:", fieldData);
    console.log("📦 fieldCoreSchema:", this.fieldTypesData.coreFields);
    console.log("📦 baseTypes:", this.fieldTypesData.baseTypes);
    console.log("📦 types:", this.fieldTypesData.types);
    
    // Créer le FieldBuilder
    try {
      const builder = new FieldBuilder({
        fieldCoreSchema: this.fieldTypesData.coreFields,
        baseTypes: this.fieldTypesData.baseTypes,
        types: this.fieldTypesData.types,
        fieldData, // 👈 ici on passe l'objet correct
        onAdd: fieldData => {
          console.log('✅ Champ ajouté via FieldBuilder:', fieldData);
          this.closeFieldBuilder();
          onSave(fieldData);
        }
      });

      builder.render(container);
      this.activeFieldBuilder = { builder, container };
      console.log('✅ FieldBuilder créé et rendu');
    } catch (error) {
      console.error('❌ Erreur lors de la création du FieldBuilder:', error);
      alert('Erreur lors de l\'ouverture du formulaire de champ: ' + error.message);
    }
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
