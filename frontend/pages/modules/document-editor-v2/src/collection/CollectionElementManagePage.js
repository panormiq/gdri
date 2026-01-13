// src/modules/editor/collection/CollectionCreatePage.js
import Page from '../shared/components/page/Page.js';
import SchemaForm from '../shared/components/schemaForm/SchemaForm.js';
import FieldBuilder from '../shared/components/fieldBuilder/FieldBuilder.js';
import ListPage from '../shared/components/listPage/ListPage.js';
import { collectionApi } from '../shared/api/CollectionApi.js';
import { collectionElementApi } from '../shared/api/CollectionElementApi.js';
import FieldRenderer from '../shared/components/fieldBuilder/FieldRenderer.js';
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

export default class CollectionElementManagePage extends Page {
  constructor(router, params = {}) {
    super();
    this.router = router;

    this.collectionData = params.collection || null;
    this.collectionId = this.collectionData?._id || null;
    this.fields = this.collectionData?.fields || [];

    // ✅ Objet pour stocker les valeurs du formulaire
    // Si édition, prendre le premier élément (params.elements[0])
    // Sinon, initialiser avec un objet vide pour la création
    const elementFromParams = (params.elements && params.elements.length > 0)
      ? params.elements[0]
      : null;

    // S'assurer que l'ID est une string
    this.dataId = elementFromParams?._id ? String(elementFromParams._id) : null;
    
    console.log('📋 CollectionElementManagePage initialisé:', {
      dataId: this.dataId,
      dataIdType: typeof this.dataId,
      dataIdLength: this.dataId?.length,
      hasElement: !!elementFromParams,
      elementFromParams: elementFromParams
    });
    
    // Initialiser elementData : si édition, copier l'élément, sinon objet vide
    if (this.dataId && elementFromParams) {
      // Édition : copier toutes les données sauf _id (on le garde séparément)
      const { _id, ...elementDataWithoutId } = elementFromParams;
      this.elementData = { ...elementDataWithoutId };
      console.log('✅ Mode édition - elementData initialisé:', this.elementData);
    } else {
      // Création : objet vide, les valeurs par défaut seront appliquées dans le render
      this.elementData = {};
      console.log('✅ Mode création - elementData vide');
    }
  }

  async render(container) {
    container.innerHTML = '';

    // Charger le CSS
    this.loadStyles();

    // Container principal avec classe CSS
    const pageContainer = document.createElement('div');
    pageContainer.className = 'collection-element-manage-page';
    container.appendChild(pageContainer);

    const title = document.createElement('h1');
    title.textContent = this.dataId
      ? "Modifier l'élément"
      : "Créer un élément";
    pageContainer.appendChild(title);

    // 🔹 Rendu des champs
    for (const field of this.fields) {
      const fieldContainer = document.createElement('div');
      fieldContainer.className = 'field-container';
      pageContainer.appendChild(fieldContainer);

      const renderer = new FieldRenderer({
        field,
        value: this.elementData[field.name] ?? field.defaultValue ?? null,
        onChange: (val) => {
          this.elementData[field.name] = val;
          console.log("elementData", this.elementData);
        }
      });

      await renderer.render(fieldContainer);
    }

    // 🔹 Bouton de sauvegarde
    const saveBtn = document.createElement('button');
    saveBtn.textContent = this.dataId ? "Mettre à jour" : "Créer";
    saveBtn.classList.add('btn', 'btn-primary');
    saveBtn.addEventListener('click', async () => {
      try {
        console.log('💾 Sauvegarde:', {
          dataId: this.dataId,
          collectionId: this.collectionId,
          elementData: this.elementData
        });
        
        let res;
        if (this.dataId) {
          // 📝 Update - s'assurer que l'ID est une string
          const updateId = String(this.dataId);
          const updateCollectionId = String(this.collectionId);
          console.log('📝 Mise à jour avec:', {
            dataId: updateId,
            dataIdLength: updateId.length,
            collectionId: updateCollectionId,
            elementData: this.elementData
          });
          res = await collectionElementApi.update(updateCollectionId, updateId, this.elementData);
        } else {
          // 🆕 Create
          console.log('🆕 Création');
          res = await collectionElementApi.create(this.collectionId, this.elementData);
        }

        if (res.success) {
          alert("Élément enregistré avec succès !");
          this.router.navigate(`/collections/${this.collectionId}/elements/list`);
        } else {
          alert("Erreur lors de l'enregistrement : " + res.error);
        }
      } catch (err) {
        console.error(err);
        alert("Erreur inattendue !");
      }
    });

    pageContainer.appendChild(saveBtn);
  }

  /* ----------------------------------------
     Load Styles
  ----------------------------------------- */
  loadStyles() {
    import('../utils/loadCSS.js').then(({ default: loadCSS }) => {
      loadCSS('collection/CollectionElementManagePage.css', 'collection-element-manage-page-styles');
    });
  }
}
