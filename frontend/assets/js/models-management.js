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

  /**
   * Initialisation
   */
  function init() {
    loadTemplates();
    initEventListeners();
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
      if (template.isStandalone) properties.push('Standalone');

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
      title.textContent = `Modifier le modèle "${template.name || template.namespace}"`;
      
      // Remplir le formulaire
      document.getElementById('templateNamespace').value = template.namespace;
      document.getElementById('templateName').value = template.name || '';
      document.getElementById('templateTitle').value = template.title || '';
      document.getElementById('templateLevel').value = template.level || 1;
      
      // Scope (première partie du namespace)
      if (template.namespace.includes(':')) {
        document.getElementById('templateScope').value = template.namespace.split(':')[0];
      }
      
      // Propriétés
      document.getElementById('templateIsOptional').checked = template.isOptional || false;
      document.getElementById('templateHasMultipleChoice').checked = template.hasMultipleChoice || false;
      document.getElementById('templateAllowMultiple').checked = template.allowMultiple || false;
      document.getElementById('templateMaxInstances').value = template.maxInstances || 1;
      document.getElementById('templateIsStandalone').checked = template.isStandalone !== undefined ? template.isStandalone : true;
      
      if (template.allowMultiple) {
        document.getElementById('maxInstancesGroup').style.display = 'block';
      }
      
      // Charger les champs et variantes
      renderFields();
      renderVariants();
    } else {
      title.textContent = 'Nouveau modèle';
      form.reset();
      fields = [];
      variants = {};
      document.getElementById('templateNamespace').value = '';
      document.getElementById('maxInstancesGroup').style.display = 'none';
      renderFields();
      renderVariants();
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
        body = JSON.stringify({
          updates: {
            name: templateName,
            title: templateTitle,
            level: templateLevel,
            isOptional: document.getElementById('templateIsOptional').checked,
            hasMultipleChoice: document.getElementById('templateHasMultipleChoice').checked,
            allowMultiple: document.getElementById('templateAllowMultiple').checked,
            maxInstances: parseInt(document.getElementById('templateMaxInstances').value) || 1,
            isStandalone: document.getElementById('templateIsStandalone').checked,
            fields: fields,
            variants: variants
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
            isStandalone: document.getElementById('templateIsStandalone').checked,
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
   * Affiche les variantes
   */
  function renderVariants() {
    const variantsList = document.getElementById('variantsList');
    if (!variantsList) return;

    const variantKeys = Object.keys(variants);
    
    if (variantKeys.length === 0) {
      variantsList.innerHTML = '<p class="text-muted">Aucune variante définie. Ajoutez des variantes pour permettre un choix multiple.</p>';
      return;
    }

    const html = variantKeys.map(key => {
      const variant = variants[key];
      return `
        <div class="variant-item">
          <div class="variant-item__info">
            <div class="variant-item__name">${variant.name || key}</div>
            <div class="variant-item__meta">${variant.description || 'Pas de description'}</div>
          </div>
          <div class="variant-item__actions">
            <button class="btn btn-sm btn-outline" data-edit-variant="${key}">✏️</button>
            <button class="btn btn-sm btn-outline" data-delete-variant="${key}">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    variantsList.innerHTML = html;

    // Attacher les événements
    variantsList.querySelectorAll('[data-edit-variant]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.editVariant;
        openVariantModal(variants[key], key);
      });
    });

    variantsList.querySelectorAll('[data-delete-variant]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.deleteVariant;
        delete variants[key];
        renderVariants();
      });
    });
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
   * Initialise les événements
   */
  function initEventListeners() {
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
  }

  // Initialiser quand le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

