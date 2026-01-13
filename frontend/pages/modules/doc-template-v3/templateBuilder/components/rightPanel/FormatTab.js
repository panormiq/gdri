// src/modules/editor/templateBuilder/components/rightPanel/FormatTab.js

// Charger le CSS
(function loadCSS() {
  if (!document.getElementById('format-tab-styles')) {
    const link = document.createElement('link');
    link.id = 'format-tab-styles';
    link.rel = 'stylesheet';
    const baseUrl = window.BASE_URL || '/';
    link.href = baseUrl + 'pages/modules/doc-template-v3/templateBuilder/components/rightPanel/FormatTab.css';
    document.head.appendChild(link);
  }
})();

export default class FormatTab {
  constructor({ onFormat, template, editor }) {
    this.onFormat = onFormat;
    this.template = template;
    this.editor = editor;
    this.buttons = new Map(); // Map pour stocker les boutons par commande
    this.imageStyleSelect = null; // Menu déroulant de styles d'image
    this.imageGroup = null; // Groupe Image (visible uniquement si image sélectionnée)
    this.selectedImageContainer = null; // Conteneur d'image sélectionnée
  }


  createFormatGroup(title, buttons, isLast = false) {
    const group = document.createElement('div');
    group.className = 'format-group';

    const groupTitle = document.createElement('h4');
    groupTitle.textContent = title;
    group.appendChild(groupTitle);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'format-buttons';

    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.className = 'format-button';
      button.title = btn.label;
      button.textContent = btn.icon || btn.label;
      button.dataset.command = btn.command;
      button.dataset.value = btn.value || '';
      
      // Stocker le bouton dans la map pour pouvoir mettre à jour son état
      this.buttons.set(btn.command + (btn.value || ''), button);
      
      button.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔘 FormatTab bouton cliqué:', btn.command, btn.value);
        console.log('📝 onFormat callback:', this.onFormat);
        
        if (this.onFormat) {
          console.log('✅ Appel de onFormat');
          this.onFormat(btn.command, btn.value);
        } else {
          console.error('❌ onFormat non défini!');
        }
        
        // Mettre à jour l'état des boutons après le clic
        // Utiliser un délai plus court pour une réponse plus rapide
        setTimeout(() => {
          this.updateButtonStates();
        }, 5);
      };
      
      buttonsContainer.appendChild(button);
    });

    group.appendChild(buttonsContainer);
    
    // Ajouter une classe pour le séparateur si ce n'est pas le dernier groupe
    if (!isLast) {
      group.classList.add('format-group-separator');
    }
    
    this.container.appendChild(group);
  }
  
  render(container) {
    this.container = container;
    this.container.className = 'format-tab';
    this.container.innerHTML = '';
    this.buttons.clear(); // Réinitialiser la map des boutons

    // Groupe : Formatage texte
    this.createFormatGroup('Format de texte', [
      { label: 'Gras', command: 'bold', icon: 'B' },
      { label: 'Italique', command: 'italic', icon: 'I' },
      { label: 'Souligné', command: 'underline', icon: 'U' },
      { label: 'Barré', command: 'strikeThrough', icon: 'S' }
    ], false);

    // Groupe : Titres
    this.createFormatGroup('Titres', [
      { label: 'Titre 1', command: 'formatBlock', value: 'h1', icon: 'H1' },
      { label: 'Titre 2', command: 'formatBlock', value: 'h2', icon: 'H2' },
      { label: 'Titre 3', command: 'formatBlock', value: 'h3', icon: 'H3' },
      { label: 'Paragraphe', command: 'formatBlock', value: 'p', icon: 'P' }
    ], false);

    // Groupe : Listes
    this.createFormatGroup('Listes', [
      { label: 'Liste à puces', command: 'insertUnorderedList', icon: '•' },
      { label: 'Liste numérotée', command: 'insertOrderedList', icon: '1.' }
    ], false);

    // Groupe : Alignement
    this.createFormatGroup('Alignement', [
      { label: 'Gauche', command: 'justifyLeft', icon: '◄' },
      { label: 'Centre', command: 'justifyCenter', icon: '↔' },
      { label: 'Droite', command: 'justifyRight', icon: '►' },
      { label: 'Justifié', command: 'justifyFull', icon: '◄↔►' }
    ], false);

    // Groupe : Insertion
    const insertionGroup = document.createElement('div');
    insertionGroup.className = 'format-group';
    
    const insertionTitle = document.createElement('h4');
    insertionTitle.textContent = 'Insertion';
    insertionGroup.appendChild(insertionTitle);
    
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'format-buttons';
    
    // Bouton Tableau
    const tableButton = this.createFormatButton('Tableau', 'insertTable', '⊞');
    buttonsContainer.appendChild(tableButton);
    
    // Bouton Image
    const imageButton = this.createFormatButton('Image', 'insertImage', '🖼');
    buttonsContainer.appendChild(imageButton);
    
    // Bouton Lien
    const linkButton = this.createFormatButton('Lien', 'createLink', '🔗');
    buttonsContainer.appendChild(linkButton);
    
    insertionGroup.appendChild(buttonsContainer);
    this.container.appendChild(insertionGroup);
    
    // Groupe : Image (visible uniquement quand une image est sélectionnée)
    // Le séparateur sera ajouté AVANT ce groupe
    this.createImageGroup();
    
    // Configurer les écouteurs de sélection
    this.setupSelectionListeners();
    
    // Mettre à jour l'état initial des boutons
    setTimeout(() => this.updateButtonStates(), 100);
  }
  
  updateButtonStates() {
    // Parcourir tous les boutons et mettre à jour leur état
    // document.queryCommandState fonctionne avec la sélection actuelle dans le document
    this.buttons.forEach((button, key) => {
      const command = button.dataset.command;
      const value = button.dataset.value;
      
      if (command) {
        try {
          // Pour formatBlock, vérifier si la valeur correspond
          if (command === 'formatBlock' && value) {
            // Vérifier d'abord les div avec classes doc-title-level-X
            const selection = window.getSelection();
            let isActive = false;
            
            if (selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              let element = range.commonAncestorContainer;
              
              // Si c'est un nœud texte, remonter au parent
              if (element.nodeType === Node.TEXT_NODE) {
                element = element.parentElement;
              }
              
              // Remonter dans la hiérarchie jusqu'à trouver un titre ou paragraphe
              while (element && element !== document.body) {
                const tagName = element.tagName ? element.tagName.toLowerCase() : '';
                const className = element.className || '';
                
                // Vérifier si c'est un h1/h2/h3 ou un div avec classe doc-title-level-X
                if (tagName === value.toLowerCase()) {
                  isActive = true;
                  break;
                } else if (tagName === 'div' && /doc-title-level-[1-3]/.test(className)) {
                  const level = className.match(/doc-title-level-([1-3])/);
                  if (level && level[1] === value.charAt(1)) {
                    isActive = true;
                    break;
                  }
                } else if (tagName === 'p' && value.toLowerCase() === 'p') {
                  isActive = true;
                  break;
                }
                
                element = element.parentElement;
              }
            }
            
            // Fallback sur queryCommandValue si on n'a pas trouvé
            if (!isActive) {
              const currentFormat = document.queryCommandValue('formatBlock');
              isActive = currentFormat === value.toLowerCase();
            }
            
            button.classList.toggle('active', isActive);
          } else {
            // Pour les autres commandes, utiliser queryCommandState
            const isActive = document.queryCommandState(command);
            button.classList.toggle('active', isActive);
          }
        } catch (e) {
          // Si la commande n'est pas supportée, ne rien faire
          console.warn('Commande non supportée pour queryCommandState:', command);
        }
      }
    });
  }
  
  setupSelectionListeners() {
    // Écouter les changements de sélection dans le document
    // Note: selectionchange se déclenche aussi lors des changements de focus
    document.addEventListener('selectionchange', () => {
      // Utiliser un petit délai pour s'assurer que la sélection est bien établie
      setTimeout(() => {
        this.updateButtonStates();
        this.updateImageStyleSelect();
      }, 10);
    });
    
    // Écouter aussi les clics et touches dans l'éditeur contentEditable
    // Chercher tous les éléments contentEditable (l'éditeur principal)
    const editorElements = document.querySelectorAll('[contenteditable="true"]');
    editorElements.forEach(editorElement => {
      // Cliquer dans l'éditeur pour déplacer le curseur
      editorElement.addEventListener('click', () => {
        setTimeout(() => {
          this.updateButtonStates();
          this.updateImageStyleSelect();
        }, 10);
      });
      
      // Relâcher la souris après sélection
      editorElement.addEventListener('mouseup', () => {
        setTimeout(() => {
          this.updateButtonStates();
          this.updateImageStyleSelect();
        }, 10);
      });
      
      // Déplacer le curseur avec le clavier
      editorElement.addEventListener('keyup', () => {
        setTimeout(() => {
          this.updateButtonStates();
          this.updateImageStyleSelect();
        }, 10);
      });
      
      editorElement.addEventListener('keydown', () => {
        setTimeout(() => {
          this.updateButtonStates();
          this.updateImageStyleSelect();
        }, 10);
      });
      
      // Focus sur l'éditeur
      editorElement.addEventListener('focus', () => {
        setTimeout(() => {
          this.updateButtonStates();
          this.updateImageStyleSelect();
        }, 10);
      });
    });
  }

  createFormatButton(label, command, icon) {
    const button = document.createElement('button');
    button.className = 'format-button';
    button.title = label;
    button.textContent = icon || label;
    button.dataset.command = command;
    button.dataset.value = '';
    
    this.buttons.set(command, button);
    
    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.onFormat) {
        this.onFormat(command, null);
      }
      setTimeout(() => {
        this.updateButtonStates();
        this.updateImageStyleSelect();
      }, 5);
    };
    
    return button;
  }

  getSelectedImage() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;
    
    const range = selection.getRangeAt(0);
    let element = range.commonAncestorContainer;
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement;
    }
    
    // Chercher un conteneur d'image
    const imageContainer = element.closest('.template-image-container');
    return imageContainer;
  }

  updateImageStyleSelect() {
    if (!this.imageStyleSelect) return;
    
    const selectedImage = this.getSelectedImage();
    
    if (selectedImage) {
      // Mettre à jour la valeur sélectionnée
      const currentStyle = selectedImage.dataset.imageStyle || '';
      this.imageStyleSelect.value = currentStyle;
    }
  }

  setTemplate(template) {
    this.template = template;
    // Recharger les styles d'image dans le select
    if (this.imageStyleSelect) {
      this.imageStyleSelect.innerHTML = '<option value="">Aucun style</option>';
      if (template?.imageStyles && template.imageStyles.length > 0) {
        template.imageStyles.forEach(style => {
          const option = document.createElement('option');
          option.value = style.name;
          option.textContent = style.name;
          this.imageStyleSelect.appendChild(option);
        });
      }
    }
  }

  setEditor(editor) {
    this.editor = editor;
    
    // Connecter les callbacks pour la sélection d'image
    if (editor) {
      editor.onImageSelected = (container) => {
        this.selectedImageContainer = container;
        this.showImageGroup();
      };
      
      editor.onImageDeselected = () => {
        this.selectedImageContainer = null;
        this.hideImageGroup();
      };
    }
  }

  /**
   * Crée le groupe Image
   */
  createImageGroup() {
    this.imageGroup = document.createElement('div');
    this.imageGroup.className = 'format-group image-source-group';
    this.imageGroup.style.display = 'none'; // Caché par défaut
    
    const title = document.createElement('h4');
    title.textContent = 'Image';
    this.imageGroup.appendChild(title);
    
    // Ligne Source + Style (côte à côte)
    const sourceStyleRow = document.createElement('div');
    sourceStyleRow.style.cssText = 'display: flex; align-items: center; gap: var(--spacing-sm, 8px); margin-bottom: var(--spacing-sm, 8px);';
    
    // Bouton Source (à gauche)
    const sourceButton = document.createElement('button');
    sourceButton.textContent = 'Source';
    sourceButton.className = 'format-button';
    sourceButton.style.cssText = 'flex: 0 0 auto;';
    sourceButton.onclick = () => this.showImageSourceModal();
    sourceStyleRow.appendChild(sourceButton);
    
    // Style d'image (à droite)
    const styleContainer = document.createElement('div');
    styleContainer.style.cssText = 'display: flex; align-items: center; gap: var(--spacing-xs, 4px); flex: 1; justify-content: flex-end;';
    
    const styleLabel = document.createElement('label');
    styleLabel.textContent = 'Style:';
    styleLabel.style.cssText = 'font-weight: 500; font-size: var(--font-size-sm, 14px); white-space: nowrap;';
    styleContainer.appendChild(styleLabel);
    
    this.imageStyleSelect = document.createElement('select');
    this.imageStyleSelect.className = 'image-style-select';
    this.imageStyleSelect.innerHTML = '<option value="">Aucun style</option>';
    
    // Charger les styles d'image depuis le template
    if (this.template?.imageStyles && this.template.imageStyles.length > 0) {
      this.template.imageStyles.forEach(style => {
        const option = document.createElement('option');
        option.value = style.name;
        option.textContent = style.name;
        this.imageStyleSelect.appendChild(option);
      });
    }
    
    this.imageStyleSelect.onchange = () => {
      const selectedImage = this.getSelectedImage();
      if (selectedImage && this.editor) {
        const styleName = this.imageStyleSelect.value;
        this.editor.applyImageStyleToSelected(styleName);
      }
    };
    
    this.imageStyleSelect.style.cssText = 'padding: var(--spacing-xs, 4px); border: 1px solid var(--color-light, #ddd); border-radius: var(--border-radius, 4px); font-size: var(--font-size-sm, 14px); min-width: 150px;';
    styleContainer.appendChild(this.imageStyleSelect);
    
    sourceStyleRow.appendChild(styleContainer);
    this.imageGroup.appendChild(sourceStyleRow);
    
    this.container.appendChild(this.imageGroup);
  }

  /**
   * Affiche le modal de sélection de source d'image
   */
  showImageSourceModal() {
    if (!this.selectedImageContainer || !this.editor) return;
    
    // Créer le modal
    const modal = document.createElement('div');
    modal.className = 'image-source-modal';
    modal.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: rgba(0, 0, 0, 0.5) !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 999999 !important;';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'image-source-modal-content';
    modalContent.style.cssText = 'background: var(--color-white, #fff); padding: var(--spacing-lg, 24px); border-radius: var(--border-radius-lg, 8px); max-width: 500px; width: 90vw; position: relative;';
    
    const title = document.createElement('h3');
    title.textContent = 'Sélectionner la source de l\'image';
    title.style.cssText = 'margin-top: 0; margin-bottom: var(--spacing-md, 16px);';
    modalContent.appendChild(title);
    
    // Onglets
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'image-source-tabs';
    tabsContainer.style.cssText = 'display: flex; gap: var(--spacing-sm, 8px); margin-bottom: var(--spacing-md, 16px);';
    
    const uploadTab = document.createElement('button');
    uploadTab.className = 'image-source-tab active';
    uploadTab.textContent = 'Fichier';
    uploadTab.style.cssText = 'flex: 1; padding: var(--spacing-sm, 8px); border: 1px solid var(--color-light, #ddd); background: var(--color-primary, #0055AA); color: var(--color-white, #fff); border-radius: var(--border-radius, 4px); cursor: pointer;';
    
    const variableTab = document.createElement('button');
    variableTab.className = 'image-source-tab';
    variableTab.textContent = 'Variable';
    variableTab.style.cssText = 'flex: 1; padding: var(--spacing-sm, 8px); border: 1px solid var(--color-light, #ddd); background: var(--color-white, #fff); border-radius: var(--border-radius, 4px); cursor: pointer;';
    
    tabsContainer.appendChild(uploadTab);
    tabsContainer.appendChild(variableTab);
    modalContent.appendChild(tabsContainer);
    
    // Contenu des onglets
    const contentArea = document.createElement('div');
    contentArea.className = 'image-source-content';
    contentArea.style.cssText = 'min-height: 200px;';
    
    // Onglet Upload (Fichier)
    const uploadGroup = document.createElement('div');
    uploadGroup.className = 'image-source-upload-group';
    
    // Input file caché
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.id = 'image-upload-input-modal';
    
    // Zone de drag and drop
    const dragArea = document.createElement('div');
    dragArea.className = 'image-source-drag-area';
    dragArea.style.cssText = 'border: 2px dashed var(--color-light, #ddd); border-radius: var(--border-radius, 4px); padding: var(--spacing-lg, 24px); text-align: center; cursor: pointer; transition: all var(--transition-fast); background: var(--color-light, #f5f5f5);';
    dragArea.innerHTML = '<p style="margin: 0 0 var(--spacing-sm, 8px) 0; font-size: var(--font-size-lg, 18px);">📁</p><p style="margin: 0 0 var(--spacing-xs, 4px) 0;">Glissez-déposez une image ici</p><p style="margin: 0; color: var(--color-gray, #666); font-size: var(--font-size-sm, 14px);">ou</p>';
    
    const browseButton = document.createElement('button');
    browseButton.textContent = 'Parcourir les fichiers';
    browseButton.className = 'format-button';
    browseButton.style.cssText = 'margin-top: var(--spacing-sm, 8px);';
    browseButton.onclick = () => fileInput.click();
    dragArea.appendChild(browseButton);
    
    // Gestion du drag and drop
    dragArea.ondragover = (e) => {
      e.preventDefault();
      dragArea.style.borderColor = 'var(--color-primary, #0055AA)';
      dragArea.style.background = 'var(--color-primary-light, #f0f7ff)';
    };
    
    dragArea.ondragleave = () => {
      dragArea.style.borderColor = 'var(--color-light, #ddd)';
      dragArea.style.background = 'var(--color-light, #f5f5f5)';
    };
    
    dragArea.ondrop = async (e) => {
      e.preventDefault();
      dragArea.style.borderColor = 'var(--color-light, #ddd)';
      dragArea.style.background = 'var(--color-light, #f5f5f5)';
      
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        await this.handleImageUpload(file);
        document.body.removeChild(modal);
      }
    };
    
    dragArea.onclick = () => fileInput.click();
    
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await this.handleImageUpload(file);
        document.body.removeChild(modal);
      }
    };
    
    uploadGroup.appendChild(fileInput);
    uploadGroup.appendChild(dragArea);
    
    // Onglet Variable
    const variableGroup = document.createElement('div');
    variableGroup.className = 'image-source-variable-group';
    variableGroup.style.display = 'none';
    const variableLabel = document.createElement('label');
    variableLabel.textContent = 'Variable:';
    variableLabel.style.cssText = 'display: block; margin-bottom: var(--spacing-xs, 4px); font-weight: 500;';
    const variableSelect = document.createElement('select');
    variableSelect.innerHTML = '<option value="">-- Sélectionner --</option>';
    variableSelect.style.cssText = 'width: 100%; padding: var(--spacing-xs, 4px); border: 1px solid var(--color-light, #ddd); border-radius: var(--border-radius, 4px); box-sizing: border-box;';
    
    // Charger les collections depuis l'API pour avoir les champs complets
    const loadCollectionsWithFields = async () => {
      const collections = [];
      
      // Charger les types pour normaliser les champs
      let fieldTypesData = null;
      try {
        const { collectionApi } = await import('../../../shared/api/CollectionApi.js');
        const typesRes = await collectionApi.getFieldTypes();
        if (typesRes.success) {
          fieldTypesData = typesRes.data;
        }
      } catch (error) {
        console.error('❌ Erreur chargement fieldTypes:', error);
      }
      
      // Fonction pour normaliser les champs
      const normalizeFields = (fields) => {
        if (!fieldTypesData || !fieldTypesData.baseTypes) return fields;
        return fields.map(field => ({
          ...field,
          uiType: fieldTypesData.baseTypes[field.typeRef]?.uiType || field.uiType || 'Texte'
        }));
      };
      
      // Charger defaultCollection si elle existe
      if (this.template?.defaultCollection) {
        const collData = {
          alias: this.template.defaultCollection.alias,
          fields: []
        };
        
        // Si c'est une collection virtuelle (avec fields directement)
        if (this.template.defaultCollection.fields) {
          collData.fields = normalizeFields(this.template.defaultCollection.fields);
        } 
        // Sinon charger depuis l'API
        else if (this.template.defaultCollection.collectionId) {
          try {
            const { collectionApi } = await import('../../../shared/api/CollectionApi.js');
            const response = await collectionApi.getById(this.template.defaultCollection.collectionId);
            if (response.success && response.data) {
              collData.fields = normalizeFields(response.data.fields || []);
            }
          } catch (error) {
            console.error('❌ Erreur chargement defaultCollection:', error);
          }
        }
        
        collections.push(collData);
      }
      
      // Charger additionalCollections
      if (this.template?.additionalCollections) {
        for (const colRef of this.template.additionalCollections) {
          const collData = {
            alias: colRef.alias,
            fields: []
          };
          
          // Charger depuis l'API
          if (colRef.collectionId) {
            try {
              const { collectionApi } = await import('../../../shared/api/CollectionApi.js');
              const response = await collectionApi.getById(colRef.collectionId);
              if (response.success && response.data) {
                collData.fields = normalizeFields(response.data.fields || []);
              }
            } catch (error) {
              console.error('❌ Erreur chargement collection:', error);
            }
          }
          
          collections.push(collData);
        }
      }
      
      return collections;
    };
    
    // Fonction pour détecter si un champ est de type image
    const isImageField = (field) => {
      // Vérifier le type ou uiType directement
      if (field.type === 'image' || field.uiType === 'Image') {
        return true;
      }
      // Vérifier le typeRef (Image utilise typeRef: "file")
      if (field.typeRef === 'file') {
        // Vérifier le label
        const label = (field.label || '').toLowerCase();
        if (label.includes('image')) {
          return true;
        }
        // Vérifier les extensions autorisées
        const extensions = field.validation?.extensions || [];
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
        if (Array.isArray(extensions) && extensions.some(ext => imageExtensions.includes(ext.toLowerCase()))) {
          return true;
        }
      }
      return false;
    };
    
    // Charger et afficher les collections
    loadCollectionsWithFields().then(collections => {
      collections.forEach(collection => {
        const imageFields = collection.fields.filter(isImageField);
        if (imageFields.length > 0) {
          const optgroup = document.createElement('optgroup');
          optgroup.label = collection.alias;
          imageFields.forEach(field => {
            const option = document.createElement('option');
            option.value = `${collection.alias}.${field.name}`;
            option.textContent = `${field.label || field.name} (${collection.alias}.${field.name})`;
            optgroup.appendChild(option);
          });
          variableSelect.appendChild(optgroup);
        }
      });
    });
    
    variableGroup.appendChild(variableLabel);
    variableGroup.appendChild(variableSelect);
    
    contentArea.appendChild(uploadGroup);
    contentArea.appendChild(variableGroup);
    modalContent.appendChild(contentArea);
    
    // Boutons (déclarer avant switchTab pour éviter l'erreur de référence)
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = 'display: flex; justify-content: flex-end; gap: var(--spacing-sm, 8px); margin-top: var(--spacing-md, 16px);';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Annuler';
    cancelButton.className = 'format-button';
    cancelButton.onclick = () => document.body.removeChild(modal);
    
    const validateButton = document.createElement('button');
    validateButton.textContent = 'Utiliser cette variable';
    validateButton.className = 'format-button';
    validateButton.style.cssText = 'background: var(--color-primary, #0055AA); color: var(--color-white, #fff); display: none;';
    validateButton.onclick = () => {
      if (variableSelect.value) {
        this.handleVariableSelection(variableSelect.value);
        document.body.removeChild(modal);
      } else {
        alert('Veuillez sélectionner une variable');
      }
    };
    
    buttonsContainer.appendChild(cancelButton);
    buttonsContainer.appendChild(validateButton);
    modalContent.appendChild(buttonsContainer);
    
    // Gestion des onglets (après la déclaration de validateButton)
    let currentTab = 'upload';
    const switchTab = (tabName) => {
      currentTab = tabName;
      uploadTab.style.background = tabName === 'upload' ? 'var(--color-primary, #0055AA)' : 'var(--color-white, #fff)';
      uploadTab.style.color = tabName === 'upload' ? 'var(--color-white, #fff)' : 'var(--color-dark, #333)';
      variableTab.style.background = tabName === 'variable' ? 'var(--color-primary, #0055AA)' : 'var(--color-white, #fff)';
      variableTab.style.color = tabName === 'variable' ? 'var(--color-white, #fff)' : 'var(--color-dark, #333)';
      uploadGroup.style.display = tabName === 'upload' ? 'block' : 'none';
      variableGroup.style.display = tabName === 'variable' ? 'block' : 'none';
      validateButton.style.display = tabName === 'variable' ? 'block' : 'none';
    };
    
    uploadTab.onclick = () => switchTab('upload');
    variableTab.onclick = () => switchTab('variable');
    
    // Afficher l'onglet upload par défaut
    switchTab('upload');
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Fermer en cliquant à l'extérieur
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };
  }

  /**
   * Gère l'insertion d'une image (l'upload sera fait lors de la sauvegarde)
   */
  async handleImageUpload(file) {
    if (!this.selectedImageContainer || !this.editor) return;
    
    // Préparer l'image avec une URL temporaire (pas d'upload immédiat)
    const imageData = this.editor.prepareImageUpload(file);
    if (!imageData) return;
    
    let img = this.selectedImageContainer.querySelector('img.template-image');
    const placeholder = this.selectedImageContainer.querySelector('.image-placeholder');
    
    // Si c'est un placeholder, créer l'image
    if (placeholder && !img) {
      img = document.createElement('img');
      img.className = 'template-image';
      img.draggable = false;
      this.selectedImageContainer.innerHTML = '';
      
      this.selectedImageContainer.appendChild(img);
      
      const deleteButton = document.createElement('button');
      deleteButton.className = 'image-delete-button';
      deleteButton.innerHTML = '×';
      deleteButton.title = 'Supprimer l\'image';
      deleteButton.onclick = (e) => {
        e.stopPropagation();
        if (confirm('Supprimer cette image ?')) {
          // Nettoyer l'URL temporaire si nécessaire
          const uploadData = this.editor.pendingImageUploads.get(img);
          if (uploadData && uploadData.tempUrl) {
            URL.revokeObjectURL(uploadData.tempUrl);
          }
          this.editor.pendingImageUploads.delete(img);
          this.selectedImageContainer.closest('.image-container-wrapper')?.remove();
          this.editor.handleContentChange();
        }
      };
      this.selectedImageContainer.appendChild(deleteButton);
      this.editor.makeImageResizable(this.selectedImageContainer);
    }
    
    if (!img) return;
    
    // Stocker les données d'upload pour plus tard
    this.editor.pendingImageUploads.set(img, {
      file: imageData.file,
      tempUrl: imageData.tempUrl
    });
    
    // Charger l'image avec l'URL temporaire
    img.src = imageData.tempUrl;
    img.dataset.imageType = 'upload';
    img.dataset.pendingUpload = 'true'; // Flag pour indiquer que l'upload est en attente
    delete img.dataset.variablePath;
    delete img.dataset.imageId; // Pas d'ID encore
    img.alt = imageData.fileName || 'Image';
    
    // Mettre à jour les données de l'image dans le container
    this.selectedImageContainer._imageData = {
      type: 'upload',
      url: imageData.tempUrl,
      tempUrl: imageData.tempUrl,
      fileName: imageData.fileName,
      alt: imageData.fileName || 'Image'
    };
    
    // Appliquer le style si un style était sélectionné
    const currentStyle = this.selectedImageContainer.dataset.imageStyle;
    if (currentStyle && this.editor) {
      this.editor.applyImageStyle(this.selectedImageContainer, currentStyle);
    }
    
    // Réattacher les event listeners pour le double-clic
    if (this.editor && this.editor.reattachImageListeners) {
      this.editor.reattachImageListeners(this.selectedImageContainer);
    }
    
    this.editor.handleContentChange();
  }

  /**
   * Gère la sélection d'une variable
   */
  handleVariableSelection(variablePath) {
    if (!this.selectedImageContainer || !this.editor) return;
    
    let img = this.selectedImageContainer.querySelector('img.template-image');
    const placeholder = this.selectedImageContainer.querySelector('.image-placeholder');
    
    // Si c'est un placeholder, créer l'image
    if (placeholder && !img) {
      img = document.createElement('img');
      img.className = 'template-image';
      img.draggable = false;
      this.selectedImageContainer.innerHTML = '';
      
      this.selectedImageContainer.appendChild(img);
      
      const deleteButton = document.createElement('button');
      deleteButton.className = 'image-delete-button';
      deleteButton.innerHTML = '×';
      deleteButton.title = 'Supprimer l\'image';
      deleteButton.onclick = (e) => {
        e.stopPropagation();
        if (confirm('Supprimer cette image ?')) {
          this.selectedImageContainer.closest('.image-container-wrapper')?.remove();
          this.editor.handleContentChange();
        }
      };
      this.selectedImageContainer.appendChild(deleteButton);
      this.editor.makeImageResizable(this.selectedImageContainer);
    }
    
    if (!img) return;
    
    // Charger la variable
    img.dataset.imageType = 'variable';
    img.dataset.variablePath = variablePath;
    // Utiliser la fonction de l'éditeur pour générer le placeholder
    if (this.editor && this.editor.generateVariableImagePlaceholder) {
      img.src = this.editor.generateVariableImagePlaceholder(variablePath);
    } else {
      // Fallback si la fonction n'est pas disponible
      const svgContent = `<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="100" fill="#f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#999" text-anchor="middle" dy=".3em">{{${variablePath}}}</text></svg>`;
      const base64 = btoa(unescape(encodeURIComponent(svgContent)));
      img.src = `data:image/svg+xml;base64,${base64}`;
    }
    img.alt = `{{${variablePath}}}`;
    
    // Mettre à jour les données de l'image dans le container
    this.selectedImageContainer._imageData = {
      type: 'variable',
      variablePath: variablePath,
      alt: `{{${variablePath}}}`
    };
    
    // Appliquer le style si un style était sélectionné
    const currentStyle = this.selectedImageContainer.dataset.imageStyle;
    if (currentStyle && this.editor) {
      this.editor.applyImageStyle(this.selectedImageContainer, currentStyle);
    }
    
    // Réattacher les event listeners pour le double-clic
    if (this.editor && this.editor.reattachImageListeners) {
      this.editor.reattachImageListeners(this.selectedImageContainer);
    }
    
    this.editor.handleContentChange();
  }

  /**
   * Affiche le groupe Image
   */
  showImageGroup() {
    if (this.imageGroup) {
      this.imageGroup.style.display = 'block';
      // Ajouter le séparateur AVANT le groupe Image (sur le groupe Insertion)
      const insertionGroup = this.imageGroup.previousElementSibling;
      if (insertionGroup && insertionGroup.classList.contains('format-group')) {
        insertionGroup.classList.add('format-group-separator');
      }
    }
  }

  /**
   * Cache le groupe Image
   */
  hideImageGroup() {
    if (this.imageGroup) {
      this.imageGroup.style.display = 'none';
      // Retirer le séparateur du groupe Insertion
      const insertionGroup = this.imageGroup.previousElementSibling;
      if (insertionGroup && insertionGroup.classList.contains('format-group-separator')) {
        insertionGroup.classList.remove('format-group-separator');
      }
    }
  }
}

