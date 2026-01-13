// front/src/modules/editor/document/DocumentCreatePage.js
import Page from '../shared/components/page/Page.js';
import ListPage from '../shared/components/listPage/ListPage.js';
import { templateApi } from '../shared/api/TemplateApi.js';
import { collectionApi } from '../shared/api/CollectionApi.js';
import { collectionElementApi } from '../shared/api/CollectionElementApi.js';
import { documentApi } from '../shared/api/DocumentApi.js';
import { extractAndGroupVariables, replaceVariables } from './utils/variableReplacer.js';
import loadCSS from '../utils/loadCSS.js';

export default class DocumentCreatePage extends Page {
  constructor(router, templateId = null) {
    super(router);
    this.templateId = templateId;
    this.selectedTemplate = null;
    this.templates = [];
    this.step = templateId ? 'form' : 'template'; // 'template' ou 'form'
    this.variables = {
      simple: {},
      collections: {}
    };
  }

  async render(container) {
    container.innerHTML = '';
    this.loadStyles();

    if (this.step === 'template') {
      await this.renderTemplateSelection(container);
    } else {
      await this.renderVariableForm(container);
    }
  }

  async renderTemplateSelection(container) {
    // Charger les templates
    const res = await templateApi.getAll();
    this.templates = res.success ? res.data : [];

    const listPage = new ListPage({
      title: 'Sélectionner un template',
      items: this.templates,
      emptyText: 'Aucun template disponible',
      formAction: {
        placeholder: 'Rechercher un template...',
        buttonText: null,
        onInput: q => this.filterTemplates(q),
      },
      mapItemToCard: template => ({
        title: template.name || 'Sans nom',
        subtitle: template.defaultCollection 
          ? `Collection: ${template.defaultCollection.alias || 'Non définie'}` 
          : 'Aucune collection associée',
        onClick: () => this.selectTemplate(template),
      }),
    });

    listPage.render(container);
  }

  async renderVariableForm(container) {
    if (!this.selectedTemplate) {
      // Charger le template si on a l'ID
      if (this.templateId) {
        const res = await templateApi.getById(this.templateId);
        if (res.success) {
          this.selectedTemplate = res.data;
        } else {
          container.innerHTML = `<div class="error-message">Erreur: ${res.error || 'Template non trouvé'}</div>`;
          return;
        }
      } else {
        container.innerHTML = `<div class="error-message">Aucun template sélectionné</div>`;
        return;
      }
    }

    // Extraire les variables du template
    const variableGroups = extractAndGroupVariables(
      this.selectedTemplate.content || '',
      this.selectedTemplate
    );

    // Créer le formulaire
    const formContainer = document.createElement('div');
    formContainer.className = 'document-create-form';

    // Titre
    const title = document.createElement('h1');
    title.textContent = `Créer un document depuis "${this.selectedTemplate.name}"`;
    formContainer.appendChild(title);

    // Nom du document
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Nom du document *';
    nameLabel.setAttribute('for', 'document-name');
    nameGroup.appendChild(nameLabel);
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'document-name';
    nameInput.required = true;
    nameInput.placeholder = 'Ex: Devis 2025-001';
    nameGroup.appendChild(nameInput);
    formContainer.appendChild(nameGroup);

    // Variables simples
    if (variableGroups.simple.length > 0) {
      const simpleSection = document.createElement('div');
      simpleSection.className = 'form-section';
      const simpleTitle = document.createElement('h2');
      simpleTitle.textContent = 'Variables simples';
      simpleSection.appendChild(simpleTitle);

      variableGroups.simple.forEach(varName => {
        const group = document.createElement('div');
        group.className = 'form-group';
        const label = document.createElement('label');
        label.textContent = varName;
        label.setAttribute('for', `var-${varName}`);
        group.appendChild(label);
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `var-${varName}`;
        input.dataset.variable = varName;
        input.onchange = (e) => {
          this.variables.simple[varName] = e.target.value;
        };
        group.appendChild(input);
        simpleSection.appendChild(group);
      });

      formContainer.appendChild(simpleSection);
    }

    // Variables collections
    if (Object.keys(variableGroups.collections).length > 0) {
      const collectionsSection = document.createElement('div');
      collectionsSection.className = 'form-section';
      const collectionsTitle = document.createElement('h2');
      collectionsTitle.textContent = 'Collections';
      collectionsSection.appendChild(collectionsTitle);

      // Rendre chaque collection
      for (const [alias, collectionInfo] of Object.entries(variableGroups.collections)) {
        await this.renderCollectionSelector(
          collectionsSection,
          alias,
          collectionInfo
        );
      }

      formContainer.appendChild(collectionsSection);
    }

    // Boutons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'form-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Annuler';
    cancelBtn.onclick = () => this.navigate('/documents');
    buttonsContainer.appendChild(cancelBtn);

    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'btn btn-primary';
    createBtn.textContent = 'Créer le document';
    createBtn.onclick = () => this.createDocument(nameInput.value);
    buttonsContainer.appendChild(createBtn);

    formContainer.appendChild(buttonsContainer);
    container.appendChild(formContainer);
  }

  async renderCollectionSelector(container, alias, collectionInfo) {
    const collectionId = collectionInfo.collectionId;
    if (!collectionId) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      errorDiv.textContent = `Collection "${alias}" non trouvée dans le template`;
      container.appendChild(errorDiv);
      return;
    }

    // Charger la collection
    const collectionRes = await collectionApi.getById(collectionId);
    if (!collectionRes.success) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      errorDiv.textContent = `Erreur lors du chargement de la collection "${alias}"`;
      container.appendChild(errorDiv);
      return;
    }

    const collection = collectionRes.data;

    // Charger les éléments de la collection
    const elementsRes = await collectionElementApi.getByCollection(collectionId);
    const elements = elementsRes.success ? elementsRes.data : [];

    console.log('🔍 DocumentCreatePage - Éléments chargés:', {
      collectionId,
      alias,
      elementsCount: elements.length,
      firstElement: elements[0],
      collectionFields: collection.fields
    });

    // Filtrer pour ne garder que les éléments avec des champs indexés remplis
    const indexedFields = (collection.fields || []).filter(f => f.indexed);
    
    console.log('🔍 Champs indexés:', indexedFields);

    // Si aucun champ indexé, afficher tous les éléments
    let filteredElements = elements;
    if (indexedFields.length > 0) {
      filteredElements = elements.filter(el => {
        // Vérifier qu'au moins un champ indexé a une valeur
        // Les éléments peuvent avoir la structure { values: { ... } } ou directement les champs
        const hasValue = indexedFields.some(field => {
          // Essayer d'abord avec el.values?.[field.name]
          let value = el.values?.[field.name];
          // Si pas trouvé, essayer directement el[field.name]
          if (value === undefined) {
            value = el[field.name];
          }
          return value !== undefined && value !== null && value !== '';
        });
        return hasValue;
      });
    }

    console.log('🔍 Éléments filtrés:', {
      total: elements.length,
      filtered: filteredElements.length,
      filteredElements: filteredElements
    });

    // Créer le sélecteur
    const group = document.createElement('div');
    group.className = 'form-group collection-selector';
    group.dataset.alias = alias;
    group.dataset.collectionId = collectionId;

    const label = document.createElement('label');
    label.textContent = `${collection.name} (${alias})`;
    group.appendChild(label);

    // Recherche
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'collection-search';
    searchInput.placeholder = 'Rechercher un élément...';
    searchInput.oninput = (e) => this.filterCollectionElements(alias, e.target.value, filteredElements, group);
    group.appendChild(searchInput);

    // Liste des éléments (début vide, remplie par la recherche)
    const elementsList = document.createElement('div');
    elementsList.className = 'collection-elements-list';
    elementsList.dataset.indexedFields = JSON.stringify(indexedFields);
    group.appendChild(elementsList);

    // Bouton créer nouveau
    const createNewBtn = document.createElement('button');
    createNewBtn.type = 'button';
    createNewBtn.className = 'btn btn-secondary btn-sm';
    createNewBtn.textContent = '+ Créer un nouvel élément';
    createNewBtn.onclick = () => this.createNewElement(collectionId, alias, group);
    group.appendChild(createNewBtn);

    // Afficher tous les éléments au début
    this.renderCollectionElementsList(elementsList, filteredElements, alias, indexedFields, collection);

    container.appendChild(group);
  }

  renderCollectionElementsList(container, elements, alias, indexedFields, collection) {
    container.innerHTML = '';

    if (elements.length === 0) {
      container.innerHTML = '<div class="empty-message">Aucun élément disponible</div>';
      return;
    }

    elements.forEach(element => {
      const item = document.createElement('div');
      item.className = 'collection-element-item';
      item.dataset.elementId = element._id;

      // Titre depuis le premier champ indexé (ou le premier champ si aucun indexé)
      let title = `Élément ${element._id}`;
      if (indexedFields.length > 0) {
        const titleField = indexedFields[0];
        // Essayer d'abord avec element.values?.[field.name]
        let value = element.values?.[titleField.name];
        // Si pas trouvé, essayer directement element[field.name]
        if (value === undefined) {
          value = element[titleField.name];
        }
        if (value !== undefined && value !== null && value !== '') {
          title = String(value);
        }
      } else if (collection && collection.fields && collection.fields.length > 0) {
        // Si aucun champ indexé, utiliser le premier champ disponible
        const firstField = collection.fields[0];
        let value = element.values?.[firstField.name];
        if (value === undefined) {
          value = element[firstField.name];
        }
        if (value !== undefined && value !== null && value !== '') {
          title = String(value);
        }
      }

      // Sous-titre depuis les autres champs indexés
      const subtitle = indexedFields
        .slice(1)
        .map(f => {
          // Essayer d'abord avec element.values?.[f.name]
          let value = element.values?.[f.name];
          // Si pas trouvé, essayer directement element[f.name]
          if (value === undefined) {
            value = element[f.name];
          }
          return value ? `${f.label || f.name}: ${value}` : null;
        })
        .filter(Boolean)
        .join(' • ');

      item.innerHTML = `
        <div class="element-title">${title}</div>
        ${subtitle ? `<div class="element-subtitle">${subtitle}</div>` : ''}
      `;

      item.onclick = () => this.selectCollectionElement(alias, element, item);

      container.appendChild(item);
    });
  }

  filterCollectionElements(alias, query, allElements, group) {
    const elementsList = group.querySelector('.collection-elements-list');
    const indexedFields = elementsList.dataset.indexedFields
      ? JSON.parse(elementsList.dataset.indexedFields)
      : [];

    // Récupérer la collection depuis le dataset
    const collectionId = group.dataset.collectionId;
    // On ne peut pas récupérer la collection complète ici, donc on utilise seulement les indexedFields

    const q = query.toLowerCase();
    const filtered = allElements.filter(el => {
      if (!q) return true; // Si pas de recherche, afficher tous
      
      // Rechercher dans tous les champs indexés
      if (indexedFields.length > 0) {
        return indexedFields.some(field => {
          // Essayer d'abord avec el.values?.[field.name]
          let value = el.values?.[field.name];
          // Si pas trouvé, essayer directement el[field.name]
          if (value === undefined) {
            value = el[field.name];
          }
          return value && String(value).toLowerCase().includes(q);
        });
      } else {
        // Si aucun champ indexé, rechercher dans tous les champs
        return Object.values(el.values || el).some(value => {
          return value && String(value).toLowerCase().includes(q);
        });
      }
    });

    // On passe null pour collection car on ne l'a pas ici, mais ce n'est pas grave pour le filtre
    this.renderCollectionElementsList(elementsList, filtered, alias, indexedFields, null);
  }

  selectCollectionElement(alias, element, itemElement) {
    // Désélectionner les autres
    const group = itemElement.closest('.collection-selector');
    group.querySelectorAll('.collection-element-item').forEach(item => {
      item.classList.remove('selected');
    });

    // Sélectionner celui-ci
    itemElement.classList.add('selected');

    // Stocker la sélection
    // Les éléments peuvent avoir leurs valeurs dans element.values ou directement sur element
    const values = element.values || {};
    
    // Si values est vide, essayer de récupérer les valeurs directement depuis element
    if (Object.keys(values).length === 0) {
      // Exclure les champs système
      const systemFields = ['_id', 'createdAt', 'updatedAt', 'collectionId'];
      Object.keys(element).forEach(key => {
        if (!systemFields.includes(key)) {
          values[key] = element[key];
        }
      });
    }
    
    console.log('🔍 Sélection élément collection:', {
      alias,
      elementId: element._id,
      values,
      elementStructure: element
    });

    this.variables.collections[alias] = {
      collectionId: group.dataset.collectionId,
      elementId: element._id,
      values: values
    };
    
    console.log('📦 Variables collections après sélection:', this.variables.collections);
  }

  async createNewElement(collectionId, alias, group) {
    // Ouvrir la page de création d'élément
    this.navigate(`/collections/${collectionId}/elements?returnTo=/documents/create&templateId=${this.templateId || this.selectedTemplate._id}&alias=${alias}`);
  }

  filterTemplates(query) {
    const q = query.toLowerCase();
    const filtered = this.templates.filter(template =>
      (template.name || '').toLowerCase().includes(q)
    );

    const listPage = new ListPage({
      title: 'Sélectionner un template',
      items: filtered,
      emptyText: 'Aucun template disponible',
      formAction: {
        placeholder: 'Rechercher un template...',
        buttonText: null,
        onInput: q => this.filterTemplates(q),
      },
      mapItemToCard: template => ({
        title: template.name || 'Sans nom',
        subtitle: template.defaultCollection 
          ? `Collection: ${template.defaultCollection.alias || 'Non définie'}` 
          : 'Aucune collection associée',
        onClick: () => this.selectTemplate(template),
      }),
    });

    const container = document.querySelector('#app');
    container.innerHTML = '';
    listPage.render(container);
  }

  selectTemplate(template) {
    this.selectedTemplate = template;
    this.templateId = template._id;
    this.step = 'form';
    this.render(document.querySelector('#app'));
  }

  async createDocument(name) {
    if (!name || !name.trim()) {
      alert('Le nom du document est obligatoire');
      return;
    }

    console.log('📝 Création du document avec variables:', {
      templateContent: this.selectedTemplate.content?.substring(0, 200),
      variables: this.variables
    });

    // Remplacer les variables dans le HTML
    const htmlWithVariables = this.selectedTemplate.content || '';
    const htmlFinal = replaceVariables(htmlWithVariables, this.variables);

    console.log('✅ HTML après remplacement:', {
      originalLength: htmlWithVariables.length,
      finalLength: htmlFinal.length,
      preview: htmlFinal.substring(0, 300)
    });

    // Créer le document
    const documentData = {
      templateId: this.selectedTemplate._id,
      name: name.trim(),
      content: htmlFinal,
      variables: this.variables
    };

    const res = await documentApi.create(documentData);
    if (res.success) {
      // Rediriger vers l'éditeur
      this.navigate(`/documents/edit/${res.data._id}`);
    } else {
      alert('Erreur lors de la création: ' + (res.error || 'Erreur inconnue'));
    }
  }

  loadStyles() {
    import('../utils/loadCSS.js').then(module => {
      module.default('document/DocumentCreatePage.css', 'documentcreatepage-styles');
    });
  }
}

