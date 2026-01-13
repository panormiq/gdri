// src/modules/editor/templateBuilder/components/rightPanel/CollectionsTab.js

// Charger le CSS
(function loadCSS() {
  if (!document.getElementById('collections-tab-styles')) {
    const link = document.createElement('link');
    link.id = 'collections-tab-styles';
    link.rel = 'stylesheet';
    const baseUrl = window.BASE_URL || '/';
    link.href = baseUrl + 'pages/modules/doc-template-v3/templateBuilder/components/rightPanel/CollectionsTab.css';
    document.head.appendChild(link);
  }
})();

// Fonction slugify pour générer l'alias
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

export default class CollectionsTab {
  constructor({ template, onFieldDrop, onTemplateChange }) {
    this.template = template;
    this.onFieldDrop = onFieldDrop;
    this.onTemplateChange = onTemplateChange;
    this.allCollections = []; // Toutes les collections disponibles
    this.attachedCollections = []; // Collections attachées avec leurs données complètes
    this.expandedCollections = new Set(); // IDs des collections déroulées
    this.fieldTypesData = null;
  }

  async render(container) {
    this.container = container;
    this.container.className = 'collections-tab';
    this.container.innerHTML = '';

    // Titre
    const title = document.createElement('h3');
    title.textContent = 'Collections';
    this.container.appendChild(title);

    // Bouton "Ajouter une collection"
    const addBtn = document.createElement('button');
    addBtn.className = 'add-collection-btn';
    addBtn.textContent = '+ Ajouter une collection';
    addBtn.onclick = () => this.openAddCollectionModal();
    this.container.appendChild(addBtn);

    // Charger les données nécessaires
    await this.loadData();

    // Liste des collections attachées
    this.collectionsList = document.createElement('div');
    this.collectionsList.className = 'collections-list';
    this.container.appendChild(this.collectionsList);

    // Afficher les collections attachées
    await this.renderAttachedCollections();
  }

  async loadData() {
    try {
      const { collectionApi } = await import('../../../shared/api/CollectionApi.js');
      
      // Charger toutes les collections disponibles
      const allResponse = await collectionApi.getAll();
      if (allResponse.success) {
        this.allCollections = allResponse.data || [];
      }

      // Charger les schémas pour FieldBuilder
      const typesRes = await collectionApi.getFieldTypes();
      this.fieldTypesData = typesRes.success ? typesRes.data : {};
      
      console.log('📦 fieldTypesData chargé:', {
        hasCoreFields: !!this.fieldTypesData?.coreFields,
        hasBaseTypes: !!this.fieldTypesData?.baseTypes,
        hasTypes: !!this.fieldTypesData?.types
      });

      // Charger les données complètes des collections attachées
      await this.loadAttachedCollections();
    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
    }
  }

  async loadAttachedCollections() {
    this.attachedCollections = [];
    
    if (!this.template) {
      console.log('⚠️ Template non défini');
      return;
    }

    // Gérer defaultCollection (virtuelle ou référence)
    if (this.template.defaultCollection) {
      // Si c'est une collection virtuelle (avec fields directement)
      if (this.template.defaultCollection.fields) {
        const virtualCollection = {
          _id: 'virtual_' + (this.template._id || 'new'),
          name: this.template.name || 'Nouveau Template',
          label: this.template.name || 'Nouveau Template',
          fields: this.template.defaultCollection.fields || [],
          isVirtual: true
        };
        
        this.attachedCollections.push({
          ...this.template.defaultCollection,
          collection: virtualCollection,
          isDefault: true
        });
      } 
      // Si c'est une référence à une collection existante
      else if (this.template.defaultCollection.collectionId) {
        const collection = await this.loadCollectionData(this.template.defaultCollection.collectionId);
        if (collection) {
          this.attachedCollections.push({
            ...this.template.defaultCollection,
            collection,
            isDefault: true
          });
        }
      }
      // Sinon créer une collection virtuelle vide
      else {
        const virtualCollection = {
          _id: 'virtual_' + (this.template._id || 'new'),
          name: this.template.name || 'Nouveau Template',
          label: this.template.name || 'Nouveau Template',
          fields: [],
          isVirtual: true
        };
        
        // Initialiser defaultCollection si elle n'existe pas
        if (!this.template.defaultCollection.alias) {
          this.template.defaultCollection = {
            alias: slugify(this.template.name || 'document'),
            fields: []
          };
        }
        
        this.attachedCollections.push({
          ...this.template.defaultCollection,
          collection: virtualCollection,
          isDefault: true
        });
      }
    } 
    // Si pas de defaultCollection, en créer une virtuelle
    else {
      const virtualCollection = {
        _id: 'virtual_new',
        name: this.template.name || 'Nouveau Template',
        label: this.template.name || 'Nouveau Template',
        fields: [],
        isVirtual: true
      };
      
      this.template.defaultCollection = {
        alias: slugify(this.template.name || 'document'),
        fields: []
      };
      
      this.attachedCollections.push({
        ...this.template.defaultCollection,
        collection: virtualCollection,
        isDefault: true
      });
    }

    // Charger additionalCollections
    if (this.template.additionalCollections && this.template.additionalCollections.length > 0) {
      for (const collRef of this.template.additionalCollections) {
        const collection = await this.loadCollectionData(collRef.collectionId);
        if (collection) {
          this.attachedCollections.push({
            ...collRef,
            collection,
            isDefault: false
          });
        }
      }
    }
  }

  async loadCollectionData(collectionId) {
    try {
      const { collectionApi } = await import('../../../shared/api/CollectionApi.js');
      const response = await collectionApi.getById(collectionId);
      return response.success ? response.data : null;
    } catch (error) {
      console.error('❌ Erreur chargement collection:', error);
      return null;
    }
  }

  async renderAttachedCollections() {
    if (!this.collectionsList) return;

    this.collectionsList.innerHTML = '';

    if (this.attachedCollections.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'empty-message';
      emptyMsg.textContent = 'Aucune collection attachée. Cliquez sur "Ajouter une collection" pour commencer.';
      this.collectionsList.appendChild(emptyMsg);
      return;
    }

    // Afficher chaque collection attachée
    for (const collData of this.attachedCollections) {
      const collElement = this.createCollectionElement(collData);
      this.collectionsList.appendChild(collElement);
    }
  }

  createCollectionElement(collData) {
    const { collection, alias, isDefault } = collData;
    const isExpanded = this.expandedCollections.has(collection._id);

    // Container principal
    const container = document.createElement('div');
    container.className = 'attached-collection';
    container.dataset.collectionId = collection._id;

    // Header (titre cliquable)
    const header = document.createElement('div');
    header.className = 'collection-header';
    
    const chevron = document.createElement('span');
    chevron.className = 'collection-chevron';
    chevron.textContent = isExpanded ? '▼' : '▶';
    header.appendChild(chevron);

    const title = document.createElement('span');
    title.className = 'collection-title';
    title.textContent = collection.label || collection.name;
    if (alias && alias !== 'collection') {
      title.title = `Alias: ${alias}`; // Tooltip avec l'alias
    }
    header.appendChild(title);

    // Bouton ajouter champ
    const addFieldBtn = document.createElement('button');
    addFieldBtn.className = 'add-field-btn';
    addFieldBtn.textContent = '+ Champ';
    addFieldBtn.onclick = (e) => {
      e.stopPropagation();
      this.openAddFieldModal(collection, collData);
    };
    header.appendChild(addFieldBtn);

    // Bouton supprimer (sauf pour defaultCollection si on veut la protéger)
    if (!isDefault) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-collection-btn';
      deleteBtn.textContent = '×';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        this.removeCollection(collection._id);
      };
      header.appendChild(deleteBtn);
    }

    header.onclick = () => this.toggleCollection(collection._id);
    container.appendChild(header);

    // Contenu déroulable (variables)
    const content = document.createElement('div');
    content.className = 'collection-content';
    content.style.display = isExpanded ? 'block' : 'none';

    if (isExpanded) {
      const fields = collection.fields || [];
      
      if (fields.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-fields-message';
        emptyMsg.textContent = 'Aucun champ dans cette collection';
        content.appendChild(emptyMsg);
      } else {
        fields.forEach(field => {
          const fieldEl = this.createFieldElement(field, alias || 'collection');
          content.appendChild(fieldEl);
        });
      }
    }

    container.appendChild(content);
    return container;
  }

  toggleCollection(collectionId) {
    if (this.expandedCollections.has(collectionId)) {
      this.expandedCollections.delete(collectionId);
    } else {
      this.expandedCollections.add(collectionId);
    }
    this.renderAttachedCollections();
  }

  createFieldElement(field, alias) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'collection-field';
    fieldDiv.draggable = true;
    fieldDiv.dataset.fieldPath = `${alias}.${field.name}`;
    fieldDiv.dataset.fieldLabel = field.label || field.name;

    // Icône drag
    const dragIcon = document.createElement('span');
    dragIcon.className = 'field-drag-icon';
    dragIcon.textContent = '☰';
    fieldDiv.appendChild(dragIcon);

    // Label
    const label = document.createElement('span');
    label.className = 'field-label';
    label.textContent = field.label || field.name;
    fieldDiv.appendChild(label);

    // Variable
    const variable = document.createElement('span');
    variable.className = 'field-variable';
    variable.textContent = `{{${alias}.${field.name}}}`;
    fieldDiv.appendChild(variable);

    // Gestion drag & drop avec offset du curseur
    fieldDiv.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', `${alias}.${field.name}`);
      e.dataTransfer.effectAllowed = 'copy';
      fieldDiv.classList.add('dragging');
      
      // Créer une image de drag personnalisée avec offset
      const dragImage = document.createElement('div');
      dragImage.textContent = `{{${alias}.${field.name}}}`;
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.style.left = '-1000px';
      dragImage.style.padding = '4px 8px';
      dragImage.style.background = '#0055AA';
      dragImage.style.color = 'white';
      dragImage.style.borderRadius = '4px';
      dragImage.style.fontSize = '12px';
      dragImage.style.fontFamily = 'monospace';
      dragImage.style.pointerEvents = 'none';
      dragImage.style.whiteSpace = 'nowrap';
      document.body.appendChild(dragImage);
      
      // Forcer le calcul des dimensions
      const rect = dragImage.getBoundingClientRect();
      
      // Offset : le curseur est en haut à gauche, la variable est décalée en bas à droite
      // On veut que le curseur soit bien séparé de la variable
      const offsetX = 30;  // 30px à droite du curseur (plus d'espace)
      const offsetY = 25;  // 25px en bas du curseur (plus d'espace)
      
      e.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
      
      // Nettoyer après un court délai
      setTimeout(() => {
        if (document.body.contains(dragImage)) {
          document.body.removeChild(dragImage);
        }
      }, 0);
    };

    fieldDiv.ondragend = () => {
      fieldDiv.classList.remove('dragging');
      // Nettoyer le caret indicator si il existe
      const caretIndicator = document.querySelector('.drag-caret-indicator');
      if (caretIndicator) {
        caretIndicator.style.display = 'none';
      }
    };

    // Click pour insérer directement
    fieldDiv.onclick = () => {
      if (this.onFieldDrop) {
        this.onFieldDrop(`${alias}.${field.name}`);
      }
    };

    return fieldDiv;
  }

  openAddCollectionModal() {
    // Créer le modal
    const modal = document.createElement('div');
    modal.className = 'collection-modal';
    modal.id = 'add-collection-modal';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = () => this.closeModal(modal);
    modal.appendChild(overlay);

    const content = document.createElement('div');
    content.className = 'modal-content';

    const header = document.createElement('div');
    header.className = 'modal-header';
    const title = document.createElement('h3');
    title.textContent = 'Ajouter une collection';
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '×';
    closeBtn.onclick = () => this.closeModal(modal);
    header.appendChild(closeBtn);
    content.appendChild(header);

    // Champ de recherche
    const searchContainer = document.createElement('div');
    searchContainer.className = 'modal-search';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Rechercher une collection...';
    searchInput.className = 'search-input';
    searchContainer.appendChild(searchInput);
    content.appendChild(searchContainer);

    // Liste des collections
    const listContainer = document.createElement('div');
    listContainer.className = 'modal-collections-list';
    content.appendChild(listContainer);

    // Filtrer les collections déjà attachées
    const attachedIds = new Set(this.attachedCollections.map(c => c.collection._id));
    const availableCollections = this.allCollections.filter(c => !attachedIds.has(c._id));

    const renderList = (collections) => {
      listContainer.innerHTML = '';
      if (collections.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-message';
        emptyMsg.textContent = 'Aucune collection disponible';
        listContainer.appendChild(emptyMsg);
        return;
      }

      collections.forEach(collection => {
        const item = document.createElement('div');
        item.className = 'modal-collection-item';
        
        const name = document.createElement('span');
        name.textContent = collection.label || collection.name;
        item.appendChild(name);

        const addBtn = document.createElement('button');
        addBtn.className = 'modal-add-btn';
        addBtn.textContent = 'Ajouter';
        addBtn.onclick = () => this.addCollection(collection);
        item.appendChild(addBtn);

        listContainer.appendChild(item);
      });
    };

    searchInput.oninput = () => {
      const query = searchInput.value.toLowerCase();
      const filtered = availableCollections.filter(c => 
        (c.label || c.name || '').toLowerCase().includes(query)
      );
      renderList(filtered);
    };

    renderList(availableCollections);

    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = 'Fermer';
    cancelBtn.onclick = () => this.closeModal(modal);
    footer.appendChild(cancelBtn);
    content.appendChild(footer);

    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Animation
    setTimeout(() => modal.classList.add('show'), 10);
    searchInput.focus();
  }

  closeModal(modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }

  async addCollection(collection) {
    const alias = slugify(collection.label || collection.name);
    
    // Ajouter à additionalCollections (ou defaultCollection si vide)
    if (!this.template) {
      console.error('❌ Template non défini');
      return;
    }

    if (!this.template.additionalCollections) {
      this.template.additionalCollections = [];
    }

    const newCollectionRef = {
      collectionId: collection._id,
      alias: alias,
      referenceField: null,
      parentAlias: null
    };

    this.template.additionalCollections.push(newCollectionRef);

    // Notifier le changement
    if (this.onTemplateChange) {
      this.onTemplateChange({ additionalCollections: this.template.additionalCollections });
    }

    // Recharger et réafficher
    await this.loadAttachedCollections();
    await this.renderAttachedCollections();

    // Fermer le modal
    const modal = document.getElementById('add-collection-modal');
    if (modal) {
      this.closeModal(modal);
    }
  }

  removeCollection(collectionId) {
    if (!confirm('Êtes-vous sûr de vouloir retirer cette collection ?')) {
      return;
    }

    // Retirer de additionalCollections
    if (this.template.additionalCollections) {
      this.template.additionalCollections = this.template.additionalCollections.filter(
        c => c.collectionId !== collectionId
      );
    }

    // Notifier le changement
    if (this.onTemplateChange) {
      this.onTemplateChange({ additionalCollections: this.template.additionalCollections });
    }

    // Recharger et réafficher
    this.loadAttachedCollections().then(() => {
      this.renderAttachedCollections();
    });
  }

  async openAddFieldModal(collection, collData) {
    if (!this.fieldTypesData) {
      alert('Chargement des données en cours...');
      return;
    }

    // Créer le modal
    const modal = document.createElement('div');
    modal.className = 'collection-modal';
    modal.id = 'add-field-modal';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = () => this.closeModal(modal);
    modal.appendChild(overlay);

    const content = document.createElement('div');
    content.className = 'modal-content modal-content-large';

    const header = document.createElement('div');
    header.className = 'modal-header';
    const title = document.createElement('h3');
    title.textContent = `Ajouter un champ à "${collection.label || collection.name}"`;
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '×';
    closeBtn.onclick = () => this.closeModal(modal);
    header.appendChild(closeBtn);
    content.appendChild(header);

    // Container pour FieldBuilder
    const builderContainer = document.createElement('div');
    builderContainer.className = 'field-builder-container';
    content.appendChild(builderContainer);

    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = 'Annuler';
    cancelBtn.onclick = () => this.closeModal(modal);
    footer.appendChild(cancelBtn);
    content.appendChild(footer);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Charger FieldBuilder
    const { default: FieldBuilder } = await import('../../../shared/components/fieldBuilder/FieldBuilder.js');
    
    // Utiliser le bon schema : fieldTypesData.coreFields (pour les champs) et non collectionCoreSchema (pour les collections)
    const fieldCoreSchema = this.fieldTypesData.coreFields || {};
    
    const fieldBuilder = new FieldBuilder({
      fieldCoreSchema: fieldCoreSchema,
      baseTypes: this.fieldTypesData.baseTypes,
      types: this.fieldTypesData.types,
      fieldData: null,
      onAdd: async (fieldData) => {
        // Ajouter le champ à la collection via l'API
        await this.addFieldToCollection(collection, fieldData);
        this.closeModal(modal);
      }
    });

    fieldBuilder.render(builderContainer);

    // Animation
    setTimeout(() => modal.classList.add('show'), 10);
  }

  async addFieldToCollection(collection, fieldData) {
    try {
      const newField = {
        ...fieldData,
        id: fieldData.id || `field_${Date.now()}`,
        position: (collection.fields || []).length
      };

      // Si c'est une collection virtuelle, stocker dans le template
      if (collection.isVirtual) {
        if (!this.template.defaultCollection) {
          this.template.defaultCollection = {
            alias: slugify(this.template.name || 'document'),
            fields: []
          };
        }
        
        if (!this.template.defaultCollection.fields) {
          this.template.defaultCollection.fields = [];
        }
        
        this.template.defaultCollection.fields.push(newField);
        
        // Mettre à jour la collection virtuelle
        collection.fields = [...(collection.fields || []), newField];
        
        // Notifier le changement
        if (this.onTemplateChange) {
          this.onTemplateChange({ defaultCollection: this.template.defaultCollection });
        }
        
        // Réafficher avec la collection déroulée
        this.expandedCollections.add(collection._id);
        await this.renderAttachedCollections();
      } 
      // Sinon, mettre à jour via l'API
      else {
        const { collectionApi } = await import('../../../shared/api/CollectionApi.js');
        
        const currentFields = collection.fields || [];
        // Exclure _id des données de mise à jour (champ immuable)
        const { _id, ...collectionWithoutId } = collection;
        const updatedCollection = {
          ...collectionWithoutId,
          fields: [...currentFields, newField]
        };

        const response = await collectionApi.update(collection._id, updatedCollection);
        
        if (response.success) {
          // Recharger les collections attachées
          await this.loadAttachedCollections();
          // Réafficher avec la collection déroulée
          this.expandedCollections.add(collection._id);
          await this.renderAttachedCollections();
        } else {
          alert('Erreur lors de l\'ajout du champ: ' + (response.error || 'Erreur inconnue'));
        }
      }
    } catch (error) {
      console.error('❌ Erreur ajout champ:', error);
      alert('Erreur lors de l\'ajout du champ');
    }
  }

  setTemplate(template) {
    this.template = template;
    if (this.container) {
      this.loadAttachedCollections().then(() => {
        this.renderAttachedCollections();
      });
    }
  }
}
