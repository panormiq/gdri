/**
 * Gestion des Modèles - Agent Documentaire
 * Fichier : frontend/assets/js/models-management.js
 * 
 * Fonction : Interface de gestion complète des templates (documents et sections)
 */

(function() {
  const apiBase = window.API_BASE_URL || '';
  
  let templates = [];
  let currentTemplate = null;
  let currentTab = 'general';
  let fields = [];
  let variants = {};
  
  // Variables pour la gestion des modèles
  let models = [];
  let currentModel = null;
  let modelVariables = [];

  /**
   * Initialisation
   */
  function init() {
    if (window.CollectionFieldTypes) {
      CollectionFieldTypes.fillSelect(document.getElementById('variableType'), 'text');
      CollectionFieldTypes.fillSelect(document.getElementById('fieldType'), 'text');
    }
    loadTemplates();
    loadModels();
    initEventListeners();
    initMainTabs();
  }

  /**
   * Initialise les onglets principaux (Modèles / Templates)
   */
  function initMainTabs() {
    const mainTabs = document.querySelectorAll('[data-main-tab]');
    const mainPanels = document.querySelectorAll('[data-main-panel]');
    
    mainTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.mainTab;
        
        // Désactiver tous les onglets
        mainTabs.forEach((t) => t.classList.remove('is-active'));
        
        // Masquer tous les panneaux
        mainPanels.forEach((panel) => panel.classList.remove('is-active'));
        
        // Activer l'onglet cliqué
        tab.classList.add('is-active');
        
        // Afficher le panneau correspondant
        const targetPanel = document.querySelector(`[data-main-panel="${targetTab}"]`);
        if (targetPanel) {
          targetPanel.classList.add('is-active');
        }
      });
    });
  }

  /**
   * Charge la liste des templates
   */
  async function loadTemplates() {
    const templatesList = document.getElementById('templatesList');
    if (!templatesList) return;

    try {
      templatesList.innerHTML = '<div class="loading-message"><p>Chargement des modèles...</p></div>';

      const response = await fetch(`${apiBase}/agent-documentaire/templates`);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const payload = await response.json();
      
      if (!payload.success) {
        throw new Error(payload.error || 'Erreur lors du chargement');
      }

      templates = payload.data || [];
      
      // Charger les scopes uniques pour le filtre
      loadScopes();
      
      // Afficher la liste
      renderTemplatesList(templates);

    } catch (error) {
      console.error('❌ Erreur chargement templates:', error);
      templatesList.innerHTML = `
        <div class="error-message" style="padding: 2rem; text-align: center; color: #d32f2f;">
          <p>Erreur lors du chargement des modèles</p>
          <p style="font-size: 0.9rem; margin-top: 0.5rem;">${error.message}</p>
        </div>
      `;
    }
  }

  /**
   * Charge les scopes uniques pour le filtre
   */
  function loadScopes() {
    const filterScope = document.getElementById('filterScope');
    if (!filterScope) return;

    // Extraire les scopes uniques (première partie avant ':')
    const scopes = new Set();
    templates.forEach(template => {
      if (template.namespace.includes(':')) {
        const scope = template.namespace.split(':')[0];
        scopes.add(scope);
      } else {
        // Template document (pas de scope)
        scopes.add('document');
      }
    });

    // Ajouter les options
    filterScope.innerHTML = '<option value="all">Tous les scopes</option>';
    Array.from(scopes).sort().forEach(scope => {
      const option = document.createElement('option');
      option.value = scope;
      option.textContent = scope === 'document' ? 'Documents' : scope;
      filterScope.appendChild(option);
    });
  }

  /**
   * Affiche la liste des templates
   */
  function renderTemplatesList(templatesToRender) {
    const templatesList = document.getElementById('templatesList');
    if (!templatesList) return;

    if (templatesToRender.length === 0) {
      templatesList.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 3rem; text-align: center;">
          <p class="text-muted">Aucun modèle trouvé</p>
          <button class="btn btn-primary" id="createTemplateBtnEmpty" style="margin-top: 1rem;">➕ Créer un modèle</button>
        </div>
      `;
      
      const createBtn = document.getElementById('createTemplateBtnEmpty');
      if (createBtn) {
        createBtn.addEventListener('click', () => openTemplateModal());
      }
      return;
    }

    const html = templatesToRender.map(template => {
      const isDocument = !template.namespace.includes(':');
      const typeBadge = isDocument ? 'Document' : 'Section';
      const scope = isDocument ? 'Document' : template.namespace.split(':')[0];
      
      const properties = [];
      if (template.isOptional) properties.push('Optionnel');
      if (template.hasMultipleChoice) properties.push('Choix multiple');
      if (template.allowMultiple) properties.push('Dupliquable');

      return `
        <div class="template-card" data-namespace="${template.namespace}">
          <div class="template-card__header">
            <h3 class="template-card__name">${template.name || template.namespace}</h3>
            <span class="template-card__type">${typeBadge}</span>
          </div>
          <div class="template-card__meta">
            <div>Scope: ${scope}</div>
            <div>Namespace: ${template.namespace}</div>
            ${template.metadata?.createdAt ? 
              `<div>Créé le ${new Date(template.metadata.createdAt).toLocaleDateString('fr-FR')}</div>` : 
              ''
            }
          </div>
          ${properties.length > 0 ? `
            <div class="template-card__properties">
              ${properties.map(prop => `<span class="template-card__property">${prop}</span>`).join('')}
            </div>
          ` : ''}
          <div class="template-card__actions">
            <button class="btn btn-sm btn-primary" data-edit="${template.namespace}">✏️ Modifier</button>
            <button class="btn btn-sm btn-outline" data-delete="${template.namespace}">🗑️ Supprimer</button>
          </div>
        </div>
      `;
    }).join('');

    templatesList.innerHTML = html;

    // Attacher les événements
    templatesList.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const namespace = btn.dataset.edit;
        editTemplate(namespace);
      });
    });

    templatesList.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const namespace = btn.dataset.delete;
        deleteTemplate(namespace);
      });
    });

    templatesList.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
          const namespace = card.dataset.namespace;
          editTemplate(namespace);
        }
      });
    });
  }

  /**
   * Ouvre le modal de création/édition
   */
  async function openTemplateModal(template = null) {
    const modal = document.getElementById('templateModal');
    const title = document.getElementById('templateModalTitle');
    const form = document.getElementById('templateForm');
    
    if (!modal || !title || !form) return;

    currentTemplate = template;
    fields = template?.fields || [];
    variants = template?.variants || {};

    if (template) {
      // Extraire le nom depuis le namespace si name n'est pas défini
      let templateDisplayName = template.name;
      if (!templateDisplayName && template.namespace) {
        const nameParts = template.namespace.split(':');
        templateDisplayName = nameParts[nameParts.length - 1];
      }
      templateDisplayName = templateDisplayName || template.namespace || 'Template';
      
      title.textContent = `Modifier le template "${templateDisplayName}"`;
      
      // Remplir le formulaire
      document.getElementById('templateNamespace').value = template.namespace || '';
      
      // Pré-remplir le nom : utiliser template.name, sinon extraire depuis le namespace
      const templateNameField = document.getElementById('templateName');
      if (templateNameField) {
        let nameToSet = '';
        if (template.name && template.name.trim()) {
          nameToSet = template.name;
        } else if (template.namespace) {
          // Extraire le nom depuis le namespace (dernière partie après le :)
          const nameParts = template.namespace.split(':');
          const extractedName = nameParts[nameParts.length - 1];
          // Dénormaliser le nom (remplacer _ par espaces et mettre en forme)
          nameToSet = extractedName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        
        templateNameField.value = nameToSet;
        console.log('🔧 Champ templateName rempli avec:', nameToSet, '(template.name:', template.name, ', namespace:', template.namespace, ')');
      } else {
        console.error('❌ Champ templateName non trouvé dans le DOM');
      }
      
      document.getElementById('templateTitle').value = template.title || '';
      document.getElementById('templateLevel').value = template.level || 1;
      
      // Scope (première partie du namespace)
      if (template.namespace && template.namespace.includes(':')) {
        document.getElementById('templateScope').value = template.namespace.split(':')[0];
      } else {
        document.getElementById('templateScope').value = '';
      }
      
      // Propriétés
      document.getElementById('templateIsOptional').checked = template.isOptional || false;
      document.getElementById('templateHasMultipleChoice').checked = template.hasMultipleChoice || false;
      document.getElementById('templateAllowMultiple').checked = template.allowMultiple || false;
      document.getElementById('templateMaxInstances').value = template.maxInstances || 1;
      
      if (template.allowMultiple) {
        document.getElementById('maxInstancesGroup').style.display = 'block';
      }
      
      // Charger les champs et collections
      renderFields();
      loadCollectionsForTemplate();
      renderSelectedCollection(template.modelNamespace || null);
      loadDocumentVariables();
    } else {
      title.textContent = 'Nouveau template';
      form.reset();
      fields = [];
      variants = {};
      document.getElementById('templateNamespace').value = '';
      document.getElementById('maxInstancesGroup').style.display = 'none';
      renderFields();
      loadCollectionsForTemplate();
      renderSelectedCollection(null);
      loadDocumentVariables();
    }

    // Réinitialiser les onglets
    switchTab('general');
    
    modal.style.display = 'flex';
  }

  /**
   * Ferme le modal
   */
  function closeTemplateModal() {
    const modal = document.getElementById('templateModal');
    if (modal) {
      modal.style.display = 'none';
    }
    currentTemplate = null;
    fields = [];
    variants = {};
  }

  /**
   * Sauvegarde le template
   */
  async function saveTemplate() {
    const form = document.getElementById('templateForm');
    if (!form) return;

    const formData = new FormData(form);
    const templateName = document.getElementById('templateName').value.trim();
    const templateScope = document.getElementById('templateScope').value.trim();
    
    if (!templateName) {
      alert('Le nom du modèle est obligatoire');
      return;
    }

    try {
      // Générer le namespace
      let namespace;
      if (currentTemplate) {
        namespace = currentTemplate.namespace;
      } else {
        // Nouveau template - déterminer si document ou section
        if (templateScope) {
          // Section : scope:section_name
          const sectionName = normalizeName(templateName);
          namespace = `${templateScope}:${sectionName}`;
        } else {
          // Document : juste le nom normalisé
          namespace = normalizeName(templateName);
        }
      }

      const templateTitle = document.getElementById('templateTitle').value.trim() || templateName;
      const templateLevel = parseInt(document.getElementById('templateLevel').value) || 1;

      // Créer ou mettre à jour
      const isUpdate = !!currentTemplate;
      
      let url, method, body;
      
      if (isUpdate) {
        // Mise à jour : envoyer dans updates
        url = `${apiBase}/agent-documentaire/templates/${encodeURIComponent(namespace)}`;
        method = 'PUT';
        const templateModelSelect = document.getElementById('templateModelSelect');
        body = JSON.stringify({
          updates: {
            name: templateName,
            title: templateTitle,
            level: templateLevel,
            isOptional: document.getElementById('templateIsOptional').checked,
            hasMultipleChoice: document.getElementById('templateHasMultipleChoice').checked,
            allowMultiple: document.getElementById('templateAllowMultiple').checked,
            maxInstances: parseInt(document.getElementById('templateMaxInstances').value) || 1,
            fields: fields,
            variants: variants,
            modelNamespace: templateModelSelect?.value || null
          }
        });
      } else {
        // Création : envoyer dans le format attendu par l'API
        url = `${apiBase}/agent-documentaire/templates`;
        method = 'POST';
        body = JSON.stringify({
          namespace: namespace,
          data: {
            title: templateTitle,
            level: templateLevel,
            content: [] // Contenu vide pour l'instant
          },
          options: {
            isOptional: document.getElementById('templateIsOptional').checked,
            hasMultipleChoice: document.getElementById('templateHasMultipleChoice').checked,
            allowMultiple: document.getElementById('templateAllowMultiple').checked,
            maxInstances: parseInt(document.getElementById('templateMaxInstances').value) || 1,
            modelNamespace: document.getElementById('templateModelSelect')?.value || null,
            fields: fields,
            variants: variants
          }
        });
      }

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: body
      });

      const payload = await response.json();

      if (!payload.success) {
        throw new Error(payload.error || 'Erreur lors de la sauvegarde');
      }

      alert(`✅ Modèle ${isUpdate ? 'modifié' : 'créé'} avec succès !`);
      
      // Si c'est un nouveau template de document (pas de scope), créer un document et ouvrir l'éditeur
      if (!isUpdate && !templateScope) {
        // Template de document : créer un document et ouvrir l'éditeur
        try {
          const createDocResponse = await fetch(`${apiBase}/agent-documentaire/document/from-template`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templateNamespace: namespace,
              title: templateTitle
            })
          });

          const createDocPayload = await createDocResponse.json();
          
          if (!createDocPayload.success) {
            throw new Error(createDocPayload.error || 'Erreur lors de la création du document');
          }

          const newDocument = createDocPayload.data;
          const newDocumentId = newDocument._id || newDocument.id;
          
          // Construire l'URL de l'éditeur
          const editorBaseUrl = window.EDITOR_URL || `${window.location.origin}/frontend/pages/modules/document-agent/editor.php`;
          const editorUrl = `${editorBaseUrl}?document=${newDocumentId}&tab=variables`;
          
          // Rediriger vers l'éditeur avec le nouveau document
          window.location.href = editorUrl;
          return; // Ne pas continuer avec closeTemplateModal() et loadTemplates()
          
        } catch (docError) {
          console.error('❌ Erreur création document depuis template:', docError);
          alert(`Template créé, mais erreur lors de l'ouverture de l'éditeur : ${docError.message}`);
        }
      }
      
      closeTemplateModal();
      loadTemplates();

    } catch (error) {
      console.error('❌ Erreur sauvegarde template:', error);
      alert(`Erreur lors de la sauvegarde : ${error.message}`);
    }
  }

  /**
   * Édite un template
   */
  async function editTemplate(namespace) {
    try {
      const response = await fetch(`${apiBase}/agent-documentaire/templates/${encodeURIComponent(namespace)}`);
      
      if (!response.ok) {
        throw new Error(`Template non trouvé: ${response.status}`);
      }

      const payload = await response.json();
      
      if (!payload.success || !payload.data) {
        throw new Error(payload.error || 'Template non trouvé');
      }

      // Debug: vérifier les données du template
      console.log('📋 Template chargé:', payload.data);
      console.log('   - namespace:', payload.data.namespace);
      console.log('   - name:', payload.data.name);
      
      await openTemplateModal(payload.data);

    } catch (error) {
      console.error('❌ Erreur édition template:', error);
      alert(`Erreur lors du chargement : ${error.message}`);
    }
  }

  /**
   * Supprime un template
   */
  async function deleteTemplate(namespace) {
    const template = templates.find(t => t.namespace === namespace);
    const templateName = template?.name || namespace;

    if (!confirm(`Êtes-vous sûr de vouloir supprimer le modèle "${templateName}" ?\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      const response = await fetch(`${apiBase}/agent-documentaire/templates/${encodeURIComponent(namespace)}`, {
        method: 'DELETE'
      });

      const payload = await response.json();

      if (!payload.success) {
        throw new Error(payload.error || 'Erreur lors de la suppression');
      }

      alert('✅ Modèle supprimé avec succès !');
      loadTemplates();

    } catch (error) {
      console.error('❌ Erreur suppression template:', error);
      alert(`Erreur lors de la suppression : ${error.message}`);
    }
  }

  /**
   * Normalise un nom pour le namespace
   */
  function normalizeName(name) {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  /**
   * Change d'onglet dans le modal
   */
  function switchTab(tabName) {
    currentTab = tabName;

    // Mettre à jour les onglets
    document.querySelectorAll('.template-tab').forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('is-active');
      } else {
        tab.classList.remove('is-active');
      }
    });

    // Mettre à jour les panels
    document.querySelectorAll('.template-tab-panel').forEach(panel => {
      if (panel.dataset.panel === tabName) {
        panel.classList.add('is-active');
      } else {
        panel.classList.remove('is-active');
      }
    });
  }

  /**
   * Affiche les champs
   */
  function renderFields() {
    const fieldsList = document.getElementById('fieldsList');
    if (!fieldsList) return;

    if (fields.length === 0) {
      fieldsList.innerHTML = '<p class="text-muted">Aucun champ défini. Ajoutez des champs pour créer des variables dans votre modèle.</p>';
      return;
    }

    const html = fields.map((field, index) => {
      return `
        <div class="field-item">
          <div class="field-item__info">
            <div class="field-item__name">${field.label} <code>{{${field.name}}}</code></div>
            <div class="field-item__meta">Type: ${field.type} ${field.required ? '| Obligatoire' : ''}</div>
          </div>
          <div class="field-item__actions">
            <button class="btn btn-sm btn-outline" data-edit-field="${index}">✏️</button>
            <button class="btn btn-sm btn-outline" data-delete-field="${index}">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    fieldsList.innerHTML = html;

    // Attacher les événements
    fieldsList.querySelectorAll('[data-edit-field]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.editField);
        openFieldModal(fields[index], index);
      });
    });

    fieldsList.querySelectorAll('[data-delete-field]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.deleteField);
        fields.splice(index, 1);
        renderFields();
      });
    });
  }

  /**
   * Charge les collections disponibles dans le select de l'onglet Collection
   */
  async function loadCollectionsForTemplate() {
    const templateModelSelect = document.getElementById('templateModelSelect');
    if (!templateModelSelect) return;

    try {
      const response = await fetch(`${apiBase}/agent-documentaire/models`);
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || 'Erreur lors du chargement');
      }

      const availableModels = payload.data || [];
      
      // Vider et remplir le select
      templateModelSelect.innerHTML = '<option value="">Aucune collection</option>';
      
      availableModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.namespace || model.name;
        option.textContent = model.name || model.namespace;
        templateModelSelect.appendChild(option);
      });

    } catch (error) {
      console.error('❌ Erreur chargement collections:', error);
      templateModelSelect.innerHTML = '<option value="">Erreur de chargement</option>';
    }
  }

  /**
   * Affiche les variables de la collection sélectionnée
   */
  async function renderSelectedCollection(modelNamespace = null) {
    const templateModelSelect = document.getElementById('templateModelSelect');
    const selectedModelInfo = document.getElementById('selectedModelInfo');
    const modelVariablesList = document.getElementById('modelVariablesList');
    
    if (!templateModelSelect || !selectedModelInfo || !modelVariablesList) return;

    // Définir la valeur du select si un modèle est fourni
    if (modelNamespace) {
      templateModelSelect.value = modelNamespace;
    }

    const selectedNamespace = templateModelSelect.value;

    if (!selectedNamespace) {
      selectedModelInfo.style.display = 'none';
      return;
    }

    try {
      // Charger le modèle sélectionné
      const response = await fetch(`${apiBase}/agent-documentaire/models/${encodeURIComponent(selectedNamespace)}`);
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const payload = await response.json();
      if (!payload.success || !payload.data) {
        throw new Error(payload.error || 'Collection non trouvée');
      }

      const model = payload.data;
      const modelFields = model.fields || [];

      if (modelFields.length === 0) {
        modelVariablesList.innerHTML = '<p class="text-muted">Aucune variable dans cette collection.</p>';
      } else {
        const typeLabels = {
          text: 'Texte',
          number: 'Nombre',
          boolean: 'Booléen',
          image: 'Image'
        };

        const html = modelFields.map(field => {
          const unitDisplay = field.unit ? ` | Unité: ${field.unit}` : '';
          return `
            <div class="field-item">
              <div class="field-item__info">
                <div class="field-item__name">${field.label || field.name} <code>{{${model.namespace}:${field.name}}}</code></div>
                <div class="field-item__meta">Type: ${typeLabels[field.type] || field.type}${unitDisplay} ${field.required ? '| Obligatoire' : ''}</div>
              </div>
            </div>
          `;
        }).join('');

        modelVariablesList.innerHTML = html;
      }

      selectedModelInfo.style.display = 'block';

    } catch (error) {
      console.error('❌ Erreur chargement collection:', error);
      modelVariablesList.innerHTML = `<p class="text-muted" style="color: #d32f2f;">Erreur: ${error.message}</p>`;
      selectedModelInfo.style.display = 'block';
    }
  }

  /**
   * Charge les variables du document pour les afficher dans l'onglet Variables
   */
  async function loadDocumentVariables() {
    const documentVariablesList = document.getElementById('documentVariablesList');
    if (!documentVariablesList) return;

    // Vérifier si un documentId est disponible
    const documentId = window.DOCUMENT_ID;
    if (!documentId) {
      documentVariablesList.innerHTML = '<p class="text-muted">Aucun document associé. Les variables du document ne peuvent pas être chargées.</p>';
      return;
    }

    try {
      documentVariablesList.innerHTML = '<p class="text-muted">Chargement des variables du document...</p>';

      // Charger le document
      const response = await fetch(`${apiBase}/agent-documentaire/document/${encodeURIComponent(documentId)}`);
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const payload = await response.json();
      if (!payload.success || !payload.data) {
        throw new Error(payload.error || 'Document non trouvé');
      }

      const document = payload.data;
      
      // Extraire les variables du document
      // Les variables peuvent être dans json_content.variables ou dans les sections
      let documentVariables = [];
      
      if (document.json_content && document.json_content.variables) {
        // Variables globales du document
        const vars = document.json_content.variables;
        if (typeof vars === 'object') {
          documentVariables = Object.keys(vars).map(key => {
            const varData = vars[key];
            return {
              name: key,
              type: varData.type || 'text',
              value: varData.value || null,
              label: varData.label || key,
              occurrences: varData.occurrences || []
            };
          });
        }
      }

      // Afficher les variables
      if (documentVariables.length === 0) {
        documentVariablesList.innerHTML = '<p class="text-muted">Aucune variable définie dans ce document.</p>';
      } else {
        const typeLabels = {
          text: 'Texte',
          number: 'Nombre',
          boolean: 'Booléen',
          image: 'Image',
          table: 'Tableau'
        };

        const html = documentVariables.map(variable => {
          const typeLabel = typeLabels[variable.type] || variable.type;
          const occurrencesCount = variable.occurrences ? variable.occurrences.length : 0;
          return `
            <div class="field-item">
              <div class="field-item__info">
                <div class="field-item__name">${variable.label || variable.name} <code>{{${variable.name}}}</code></div>
                <div class="field-item__meta">Type: ${typeLabel} | Utilisée ${occurrencesCount} fois</div>
              </div>
              <div class="field-item__actions">
                <button class="btn btn-sm btn-outline" onclick="useDocumentVariable('${variable.name}', '${variable.type}')">➕ Utiliser</button>
              </div>
            </div>
          `;
        }).join('');

        documentVariablesList.innerHTML = html;
      }

    } catch (error) {
      console.error('❌ Erreur chargement variables du document:', error);
      documentVariablesList.innerHTML = `<p class="text-muted" style="color: #d32f2f;">Erreur: ${error.message}</p>`;
    }
  }

  /**
   * Utilise une variable du document dans le template
   */
  function useDocumentVariable(varName, varType) {
    // Vérifier si la variable n'existe pas déjà
    if (fields.some(f => f.name === varName)) {
      alert('Cette variable existe déjà dans le template.');
      return;
    }

    // Ajouter la variable aux champs du template
    const newField = {
      name: varName,
      label: varName, // Pourra être modifié après
      type: varType || 'text',
      required: false,
      default: ''
    };

    fields.push(newField);
    renderFields();
    
    // Afficher un message de confirmation
    const notification = document.createElement('div');
    notification.className = 'notification notification-success';
    notification.textContent = `Variable "${varName}" ajoutée au template.`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  // Exposer la fonction globalement pour qu'elle puisse être appelée depuis l'HTML
  window.useDocumentVariable = useDocumentVariable;

  /**
   * Affiche les variantes (conservée pour compatibilité, mais l'onglet Collection utilise maintenant loadCollectionsForTemplate)
   */
  function renderVariants() {
    // Cette fonction n'est plus utilisée pour l'onglet Collection
    // Elle est conservée pour compatibilité mais ne fait plus rien
    console.log('⚠️ renderVariants() appelée mais l\'onglet Collection utilise maintenant loadCollectionsForTemplate()');
  }

  /**
   * Ouvre le modal de champ
   */
  function openFieldModal(field = null, index = null) {
    const modal = document.getElementById('fieldModal');
    const title = document.getElementById('fieldModalTitle');
    const form = document.getElementById('fieldForm');
    
    if (!modal || !title || !form) return;

    if (field) {
      title.textContent = 'Modifier le champ';
      document.getElementById('fieldIndex').value = index;
      document.getElementById('fieldName').value = field.name || '';
      document.getElementById('fieldLabel').value = field.label || '';
      document.getElementById('fieldType').value = field.type || 'text';
      document.getElementById('fieldDefault').value = field.default || '';
      document.getElementById('fieldRequired').checked = field.required || false;
    } else {
      title.textContent = 'Nouveau champ';
      form.reset();
      document.getElementById('fieldIndex').value = '';
    }

    modal.style.display = 'flex';
  }

  /**
   * Ferme le modal de champ
   */
  function closeFieldModal() {
    const modal = document.getElementById('fieldModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Sauvegarde un champ
   */
  function saveField() {
    const form = document.getElementById('fieldForm');
    if (!form) return;

    const fieldName = document.getElementById('fieldName').value.trim();
    const fieldLabel = document.getElementById('fieldLabel').value.trim();
    
    if (!fieldName || !fieldLabel) {
      alert('Le nom et le libellé sont obligatoires');
      return;
    }

    const field = {
      name: normalizeName(fieldName),
      label: fieldLabel,
      type: document.getElementById('fieldType').value,
      default: document.getElementById('fieldDefault').value.trim() || undefined,
      required: document.getElementById('fieldRequired').checked
    };

    const index = document.getElementById('fieldIndex').value;
    
    if (index !== '' && index !== null) {
      // Modifier
      fields[parseInt(index)] = field;
    } else {
      // Ajouter
      fields.push(field);
    }

    renderFields();
    closeFieldModal();
  }

  /**
   * Ouvre le modal de variante
   */
  function openVariantModal(variant = null, key = null) {
    const modal = document.getElementById('variantModal');
    const title = document.getElementById('variantModalTitle');
    
    if (!modal || !title) return;

    if (variant) {
      title.textContent = 'Modifier la variante';
      document.getElementById('variantKey').value = key;
      document.getElementById('variantName').value = variant.name || '';
      document.getElementById('variantDescription').value = variant.description || '';
    } else {
      title.textContent = 'Nouvelle variante';
      document.getElementById('variantForm').reset();
      document.getElementById('variantKey').value = '';
    }

    // Rendre les valeurs des champs pour cette variante
    renderVariantFieldsValues(variant);

    modal.style.display = 'flex';
  }

  /**
   * Ferme le modal de variante
   */
  function closeVariantModal() {
    const modal = document.getElementById('variantModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Affiche les valeurs des champs pour une variante
   */
  function renderVariantFieldsValues(variant) {
    const container = document.getElementById('variantFieldsValues');
    if (!container) return;

    if (fields.length === 0) {
      container.innerHTML = '<p class="text-muted">Ajoutez d\'abord des champs au modèle.</p>';
      return;
    }

    const html = fields.map(field => {
      const value = variant?.values?.[field.name] || field.default || '';
      return `
        <div class="form-group">
          <label for="variant-field-${field.name}">${field.label}</label>
          <input type="${field.type === 'number' ? 'number' : 'text'}" 
                 id="variant-field-${field.name}" 
                 name="values.${field.name}"
                 class="form-control" 
                 value="${value}"
                 ${field.required ? 'required' : ''}>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  /**
   * Sauvegarde une variante
   */
  function saveVariant() {
    const form = document.getElementById('variantForm');
    if (!form) return;

    const variantName = document.getElementById('variantName').value.trim();
    
    if (!variantName) {
      alert('Le nom de la variante est obligatoire');
      return;
    }

    // Récupérer les valeurs des champs
    const values = {};
    fields.forEach(field => {
      const input = document.getElementById(`variant-field-${field.name}`);
      if (input) {
        values[field.name] = input.value.trim() || field.default || '';
      }
    });

    const variant = {
      name: variantName,
      description: document.getElementById('variantDescription').value.trim() || undefined,
      values: values
    };

    const key = document.getElementById('variantKey').value;
    
    if (key) {
      // Modifier - supprimer l'ancienne clé si elle a changé
      const newKey = normalizeName(variantName);
      if (key !== newKey) {
        delete variants[key];
        variants[newKey] = variant;
      } else {
        variants[key] = variant;
      }
    } else {
      // Ajouter
      const newKey = normalizeName(variantName);
      variants[newKey] = variant;
    }

    renderVariants();
    closeVariantModal();
  }

  /**
   * Génère la prévisualisation
   */
  function generatePreview() {
    const previewContent = document.getElementById('previewContent');
    if (!previewContent) return;

    if (fields.length === 0) {
      previewContent.innerHTML = '<p class="text-muted">L\'aperçu sera généré après avoir défini au moins un champ ou une variante.</p>';
      return;
    }

    // Générer un aperçu simple avec les champs
    let html = '<div class="preview-section">';
    html += '<h4>Exemple de rendu avec les variables</h4>';
    
    fields.forEach(field => {
      html += `<div style="margin-bottom: 1rem;">`;
      html += `<strong>${field.label}:</strong> `;
      html += `<code>{{${field.name}}}</code>`;
      if (field.default) {
        html += ` <span class="text-muted">(par défaut: ${field.default})</span>`;
      }
      html += `</div>`;
    });

    html += '</div>';

    if (Object.keys(variants).length > 0) {
      html += '<div class="preview-section" style="margin-top: 2rem;">';
      html += '<h4>Variantes disponibles</h4>';
      html += '<ul>';
      Object.keys(variants).forEach(key => {
        const variant = variants[key];
        html += `<li><strong>${variant.name}</strong>`;
        if (variant.description) {
          html += ` - ${variant.description}`;
        }
        html += `</li>`;
      });
      html += '</ul>';
      html += '</div>';
    }

    previewContent.innerHTML = html;
  }

  /**
   * ===================================
   * GESTION DES MODÈLES (COLLECTIONS)
   * ===================================
   */

  /**
   * Charge la liste des modèles
   */
  async function loadModels() {
    const modelsList = document.getElementById('modelsList');
    if (!modelsList) return;

    try {
      modelsList.innerHTML = '<div class="loading-message"><p>Chargement des modèles...</p></div>';

      const response = await fetch(`${apiBase}/agent-documentaire/models`);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const payload = await response.json();
      
      if (!payload.success) {
        throw new Error(payload.error || 'Erreur lors du chargement');
      }

      models = payload.data || [];
      renderModelsList(models);

    } catch (error) {
      console.error('❌ Erreur chargement modèles:', error);
      modelsList.innerHTML = `
        <div class="error-message" style="padding: 2rem; text-align: center; color: #d32f2f;">
          <p>Erreur lors du chargement des modèles</p>
          <p style="font-size: 0.9rem; margin-top: 0.5rem;">${error.message}</p>
        </div>
      `;
    }
  }

  /**
   * Affiche la liste des modèles
   */
  function renderModelsList(modelsToRender) {
    const modelsList = document.getElementById('modelsList');
    if (!modelsList) return;

    if (modelsToRender.length === 0) {
      modelsList.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 3rem; text-align: center;">
          <p class="text-muted">Aucun modèle trouvé</p>
          <button class="btn btn-primary" id="createModelBtnEmpty" style="margin-top: 1rem;">➕ Créer un modèle</button>
        </div>
      `;
      
      const createBtn = document.getElementById('createModelBtnEmpty');
      if (createBtn) {
        createBtn.addEventListener('click', () => openModelModal());
      }
      return;
    }

    const html = modelsToRender.map(model => {
      const fieldsCount = (model.fields || []).length;
      const variantsCount = (model.variants || []).length;

      return `
        <div class="template-card" data-namespace="${model.namespace}">
          <div class="template-card__header">
            <h3 class="template-card__name">${model.name}</h3>
            <span class="template-card__type">Collection</span>
          </div>
          <div class="template-card__meta">
            <div>Namespace: ${model.namespace}</div>
            <div>Variables: ${fieldsCount}</div>
            <div>Variantes: ${variantsCount}</div>
            ${model.metadata?.createdAt ? 
              `<div>Créé le ${new Date(model.metadata.createdAt).toLocaleDateString('fr-FR')}</div>` : 
              ''
            }
          </div>
          <div class="template-card__actions">
            <button class="btn btn-sm btn-primary" data-edit-model="${model.namespace}">✏️ Modifier</button>
            <button class="btn btn-sm btn-outline" data-delete-model="${model.namespace}">🗑️ Supprimer</button>
          </div>
        </div>
      `;
    }).join('');

    modelsList.innerHTML = html;

    // Attacher les événements
    modelsList.querySelectorAll('[data-edit-model]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const namespace = btn.dataset.editModel;
        editModel(namespace);
      });
    });

    modelsList.querySelectorAll('[data-delete-model]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const namespace = btn.dataset.deleteModel;
        deleteModel(namespace);
      });
    });
  }

  /**
   * Ouvre le modal de création/édition de modèle
   */
  function openModelModal(model = null) {
    console.log('📝 Ouverture du modal de modèle, model:', model);
    const modal = document.getElementById('modelModal');
    const title = document.getElementById('modelModalTitle');
    const form = document.getElementById('modelForm');
    
    console.log('🔍 Éléments du modal:', { modal, title, form });
    
    if (!modal || !title || !form) {
      console.error('❌ Éléments du modal manquants');
      return;
    }

    currentModel = model;
    modelVariables = model?.fields || [];

    if (model) {
      title.textContent = `Modifier le modèle "${model.name}"`;
      document.getElementById('modelName').value = model.name || '';
    } else {
      title.textContent = 'Nouveau template';
      form.reset();
      modelVariables = [];
    }

    renderModelVariables();
    modal.style.display = 'flex';
  }

  /**
   * Ferme le modal de modèle
   */
  function closeModelModal() {
    const modal = document.getElementById('modelModal');
    if (modal) {
      modal.style.display = 'none';
    }
    currentModel = null;
    modelVariables = [];
  }

  /**
   * Affiche la liste des variables du modèle
   */
  function renderModelVariables() {
    const variablesList = document.getElementById('modelVariablesList');
    if (!variablesList) return;

    if (modelVariables.length === 0) {
      variablesList.innerHTML = '<p class="text-muted">Aucune variable définie. Cliquez sur "Ajouter une var" pour commencer.</p>';
      return;
    }

    // Récupérer les champs de référence depuis le modèle actuel
    const referenceFields = currentModel?.referenceFields || [];

    const html = modelVariables.map((variable, index) => {
      const typeLabels = (window.CollectionFieldTypes && CollectionFieldTypes.labels()) || {
        text: 'Texte',
        number: 'Nombre',
        boolean: 'Booléen',
        image: 'Image'
      };
      
      const unitDisplay = variable.unit ? ` | Unité: ${variable.unit}` : '';
      const isReference = referenceFields.includes(variable.name);
      
      return `
        <div class="field-item">
          <div class="field-item__info" style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
            <label class="checkbox-label" style="margin: 0; cursor: pointer;" title="Utiliser comme champ de référence pour la sélection dans les templates">
              <input type="checkbox" class="reference-field-checkbox" data-field-name="${variable.name}" ${isReference ? 'checked' : ''} style="margin: 0;">
              <span style="font-size: 0.9rem; color: #666;">Réf.</span>
            </label>
            <div style="flex: 1;">
              <div class="field-item__name">${variable.label || variable.name} <code>{{${variable.name}}}</code></div>
              <div class="field-item__meta">Type: ${typeLabels[variable.type] || variable.type}${unitDisplay} ${variable.required ? '| Obligatoire' : ''}</div>
            </div>
          </div>
          <div class="field-item__actions">
            <button class="btn btn-sm btn-outline" data-edit-variable="${index}">✏️</button>
            <button class="btn btn-sm btn-outline" data-delete-variable="${index}">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    variablesList.innerHTML = html;

    // Attacher les événements
    variablesList.querySelectorAll('[data-edit-variable]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.editVariable);
        openVariableModal(modelVariables[index], index);
      });
    });

    variablesList.querySelectorAll('[data-delete-variable]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.deleteVariable);
        modelVariables.splice(index, 1);
        renderModelVariables();
      });
    });

    // Gestionnaire pour les cases à cocher de référence
    variablesList.querySelectorAll('.reference-field-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        // Mettre à jour currentModel.referenceFields en temps réel
        if (!currentModel) {
          currentModel = { referenceFields: [] };
        }
        if (!currentModel.referenceFields) {
          currentModel.referenceFields = [];
        }
        
        const fieldName = checkbox.dataset.fieldName;
        if (checkbox.checked) {
          if (!currentModel.referenceFields.includes(fieldName)) {
            currentModel.referenceFields.push(fieldName);
          }
        } else {
          currentModel.referenceFields = currentModel.referenceFields.filter(f => f !== fieldName);
        }
      });
    });
  }

  /**
   * Ouvre le modal de variable
   */
  function openVariableModal(variable = null, index = null) {
    const modal = document.getElementById('variableModal');
    const title = document.getElementById('variableModalTitle');
    const form = document.getElementById('variableForm');
    
    if (!modal || !title || !form) return;

    if (variable) {
      title.textContent = 'Modifier la variable';
      document.getElementById('variableIndex').value = index;
      document.getElementById('variableName').value = variable.name || '';
      document.getElementById('variableLabel').value = variable.label || '';
      document.getElementById('variableType').value = variable.type || 'text';
      document.getElementById('variableUnit').value = variable.unit || '';
      document.getElementById('variableRequired').checked = variable.required || false;
    } else {
      title.textContent = 'Nouvelle variable';
      form.reset();
      document.getElementById('variableIndex').value = '';
      document.getElementById('variableType').value = 'text';
      document.getElementById('variableUnit').value = '';
    }

    modal.style.display = 'flex';
  }

  /**
   * Ferme le modal de variable
   */
  function closeVariableModal() {
    const modal = document.getElementById('variableModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Sauvegarde une variable
   */
  function saveVariable() {
    const form = document.getElementById('variableForm');
    if (!form) return;

    const variableName = document.getElementById('variableName').value.trim();
    const variableLabel = document.getElementById('variableLabel').value.trim();
    
    if (!variableName || !variableLabel) {
      alert('Le nom et le libellé sont obligatoires');
      return;
    }

    const variable = {
      name: normalizeName(variableName),
      label: variableLabel,
      type: document.getElementById('variableType').value,
      unit: document.getElementById('variableUnit').value.trim() || undefined,
      required: document.getElementById('variableRequired').checked
    };

    const index = document.getElementById('variableIndex').value;
    
    if (index !== '' && index !== null) {
      // Modifier
      modelVariables[parseInt(index)] = variable;
    } else {
      // Ajouter
      modelVariables.push(variable);
    }

    renderModelVariables();
    closeVariableModal();
  }

  /**
   * Sauvegarde le modèle
   */
  async function saveModel() {
    const form = document.getElementById('modelForm');
    if (!form) return;

    const modelName = document.getElementById('modelName').value.trim();
    
    if (!modelName) {
      alert('Le nom du modèle est obligatoire');
      return;
    }

    try {
      // Collecter les champs de référence depuis les cases à cocher
      const referenceFields = [];
      const checkboxes = document.querySelectorAll('.reference-field-checkbox:checked');
      checkboxes.forEach(checkbox => {
        const fieldName = checkbox.dataset.fieldName;
        if (fieldName) {
          referenceFields.push(fieldName);
        }
      });

      const isUpdate = !!currentModel;
      let url, method, body;
      
      if (isUpdate) {
        // Mise à jour
        url = `${apiBase}/agent-documentaire/models/${encodeURIComponent(currentModel.namespace)}`;
        method = 'PUT';
        body = JSON.stringify({
          name: modelName,
          fields: modelVariables,
          referenceFields: referenceFields
        });
      } else {
        // Création
        url = `${apiBase}/agent-documentaire/models`;
        method = 'POST';
        body = JSON.stringify({
          name: modelName,
          fields: modelVariables,
          variants: [],
          referenceFields: referenceFields
        });
      }

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: body
      });

      const payload = await response.json();

      if (!payload.success) {
        throw new Error(payload.error || 'Erreur lors de la sauvegarde');
      }

      alert(`✅ Modèle ${isUpdate ? 'modifié' : 'créé'} avec succès !`);
      closeModelModal();
      loadModels();

    } catch (error) {
      console.error('❌ Erreur sauvegarde modèle:', error);
      alert(`Erreur lors de la sauvegarde : ${error.message}`);
    }
  }

  /**
   * Édite un modèle
   */
  async function editModel(namespace) {
    try {
      const response = await fetch(`${apiBase}/agent-documentaire/models/${encodeURIComponent(namespace)}`);
      
      if (!response.ok) {
        throw new Error(`Modèle non trouvé: ${response.status}`);
      }

      const payload = await response.json();
      
      if (!payload.success || !payload.data) {
        throw new Error(payload.error || 'Modèle non trouvé');
      }

      openModelModal(payload.data);

    } catch (error) {
      console.error('❌ Erreur édition modèle:', error);
      alert(`Erreur lors du chargement : ${error.message}`);
    }
  }

  /**
   * Supprime un modèle
   */
  async function deleteModel(namespace) {
    const model = models.find(m => m.namespace === namespace);
    const modelName = model?.name || namespace;

    if (!confirm(`Êtes-vous sûr de vouloir supprimer le modèle "${modelName}" ?\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      const response = await fetch(`${apiBase}/agent-documentaire/models/${encodeURIComponent(namespace)}`, {
        method: 'DELETE'
      });

      const payload = await response.json();

      if (!payload.success) {
        throw new Error(payload.error || 'Erreur lors de la suppression');
      }

      alert('✅ Modèle supprimé avec succès !');
      loadModels();

    } catch (error) {
      console.error('❌ Erreur suppression modèle:', error);
      alert(`Erreur lors de la suppression : ${error.message}`);
    }
  }

  /**
   * Initialise les événements
   */
  function initEventListeners() {
    console.log('🔧 Initialisation des événements...');
    
    // Bouton créer modèle (collection)
    const createModelBtn = document.getElementById('createModelBtn');
    console.log('🔍 Bouton createModelBtn trouvé:', createModelBtn);
    if (createModelBtn) {
      createModelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('✅ Clic sur createModelBtn détecté');
        openModelModal();
      });
      createModelBtn.setAttribute('data-listener-attached', 'true');
      console.log('✅ Événement attaché sur createModelBtn');
    } else {
      console.warn('⚠️ Bouton createModelBtn non trouvé dans le DOM');
      // Réessayer après un court délai
      setTimeout(() => {
        const retryBtn = document.getElementById('createModelBtn');
        if (retryBtn && !retryBtn.hasAttribute('data-listener-attached')) {
          console.log('🔄 Réessai d\'attachement de l\'événement');
          retryBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('✅ Clic sur createModelBtn détecté (retry)');
            openModelModal();
          });
          retryBtn.setAttribute('data-listener-attached', 'true');
        }
      }, 500);
    }

    // Modal modèle
    const modelModal = document.getElementById('modelModal');
    if (modelModal) {
      document.getElementById('modelModalClose')?.addEventListener('click', closeModelModal);
      document.getElementById('modelModalCancel')?.addEventListener('click', closeModelModal);
      document.getElementById('modelModalSave')?.addEventListener('click', saveModel);
      document.getElementById('addVariableBtn')?.addEventListener('click', () => openVariableModal());
    }

    // Modal variable
    const variableModal = document.getElementById('variableModal');
    if (variableModal) {
      document.getElementById('variableModalClose')?.addEventListener('click', closeVariableModal);
      document.getElementById('variableModalCancel')?.addEventListener('click', closeVariableModal);
      document.getElementById('variableModalSave')?.addEventListener('click', saveVariable);
    }

    // Bouton créer template
    const createBtn = document.getElementById('createTemplateBtn');
    if (createBtn) {
      createBtn.addEventListener('click', () => openTemplateModal());
    }

    // Modal template
    const templateModal = document.getElementById('templateModal');
    if (templateModal) {
      document.getElementById('templateModalClose')?.addEventListener('click', closeTemplateModal);
      document.getElementById('templateModalCancel')?.addEventListener('click', closeTemplateModal);
      document.getElementById('templateModalSave')?.addEventListener('click', saveTemplate);
    }

    // Onglets template
    document.querySelectorAll('.template-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        switchTab(tab.dataset.tab);
        if (tab.dataset.tab === 'preview') {
          generatePreview();
        }
      });
    });

    // Bouton allowMultiple
    const allowMultipleCheckbox = document.getElementById('templateAllowMultiple');
    if (allowMultipleCheckbox) {
      allowMultipleCheckbox.addEventListener('change', (e) => {
        const maxInstancesGroup = document.getElementById('maxInstancesGroup');
        if (maxInstancesGroup) {
          maxInstancesGroup.style.display = e.target.checked ? 'block' : 'none';
        }
      });
    }

    // Bouton ajouter champ
    const addFieldBtn = document.getElementById('addFieldBtn');
    if (addFieldBtn) {
      addFieldBtn.addEventListener('click', () => openFieldModal());
    }

    // Modal champ
    const fieldModal = document.getElementById('fieldModal');
    if (fieldModal) {
      document.getElementById('fieldModalClose')?.addEventListener('click', closeFieldModal);
      document.getElementById('fieldModalCancel')?.addEventListener('click', closeFieldModal);
      document.getElementById('fieldModalSave')?.addEventListener('click', saveField);
    }

    // Bouton ajouter variante
    const addVariantBtn = document.getElementById('addVariantBtn');
    if (addVariantBtn) {
      addVariantBtn.addEventListener('click', () => openVariantModal());
    }

    // Modal variante
    const variantModal = document.getElementById('variantModal');
    if (variantModal) {
      document.getElementById('variantModalClose')?.addEventListener('click', closeVariantModal);
      document.getElementById('variantModalCancel')?.addEventListener('click', closeVariantModal);
      document.getElementById('variantModalSave')?.addEventListener('click', saveVariant);
    }

    // Bouton actualiser prévisualisation
    const refreshPreviewBtn = document.getElementById('refreshPreviewBtn');
    if (refreshPreviewBtn) {
      refreshPreviewBtn.addEventListener('click', generatePreview);
    }

    // Filtres
    const filterType = document.getElementById('filterType');
    const filterScope = document.getElementById('filterScope');
    const searchTemplates = document.getElementById('searchTemplates');

    const applyFilters = () => {
      let filtered = [...templates];

      // Filtre type
      const type = filterType?.value;
      if (type && type !== 'all') {
        if (type === 'document') {
          filtered = filtered.filter(t => !t.namespace.includes(':'));
        } else if (type === 'section') {
          filtered = filtered.filter(t => t.namespace.includes(':'));
        }
      }

      // Filtre scope
      const scope = filterScope?.value;
      if (scope && scope !== 'all') {
        if (scope === 'document') {
          filtered = filtered.filter(t => !t.namespace.includes(':'));
        } else {
          filtered = filtered.filter(t => t.namespace.startsWith(`${scope}:`));
        }
      }

      // Recherche
      const search = searchTemplates?.value.toLowerCase().trim();
      if (search) {
        filtered = filtered.filter(t => 
          (t.name || '').toLowerCase().includes(search) ||
          (t.namespace || '').toLowerCase().includes(search) ||
          (t.title || '').toLowerCase().includes(search)
        );
      }

      renderTemplatesList(filtered);
    };

    filterType?.addEventListener('change', applyFilters);
    filterScope?.addEventListener('change', applyFilters);
    searchTemplates?.addEventListener('input', applyFilters);

    // Recherche dans les modèles
    const searchModels = document.getElementById('searchModels');
    if (searchModels) {
      searchModels.addEventListener('input', () => {
        const search = searchModels.value.toLowerCase().trim();
        if (search) {
          const filtered = models.filter(m => 
            (m.name || '').toLowerCase().includes(search) ||
            (m.namespace || '').toLowerCase().includes(search)
          );
          renderModelsList(filtered);
        } else {
          renderModelsList(models);
        }
      });
    }
  }

  // Initialiser quand le DOM est prêt
  console.log('🚀 État du document:', document.readyState);
  if (document.readyState === 'loading') {
    console.log('⏳ Attente du chargement du DOM...');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('✅ DOM chargé, initialisation...');
      init();
    });
  } else {
    console.log('✅ DOM déjà prêt, initialisation immédiate...');
    init();
  }
  
  // Vérification supplémentaire après un court délai
  setTimeout(() => {
    const createModelBtn = document.getElementById('createModelBtn');
    const modelModal = document.getElementById('modelModal');
    console.log('🔍 Vérification après délai:', { createModelBtn, modelModal });
    if (!createModelBtn) {
      console.error('❌ Le bouton createModelBtn n\'existe toujours pas dans le DOM');
    } else {
      // Réessayer d'attacher l'événement si nécessaire
      if (!createModelBtn.hasAttribute('data-listener-attached')) {
        console.log('🔄 Ré-attachement de l\'événement sur createModelBtn');
        createModelBtn.addEventListener('click', () => {
          console.log('✅ Clic sur createModelBtn détecté (fallback)');
          openModelModal();
        });
        createModelBtn.setAttribute('data-listener-attached', 'true');
      }
    }
    if (!modelModal) {
      console.error('❌ Le modal modelModal n\'existe toujours pas dans le DOM');
    }
  }, 1000);
  
  // Exposer openModelModal globalement pour débogage
  window.openModelModal = openModelModal;
  console.log('🌐 openModelModal exposé globalement pour débogage');
})();

