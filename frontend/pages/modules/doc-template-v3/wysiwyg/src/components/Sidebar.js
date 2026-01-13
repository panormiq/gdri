console.log('📄 FICHIER CHARGÉ: Sidebar.js');

/**
 * Sidebar - Barre d'outils complète avec toutes les fonctions Word
 */

import { FormatUtils } from '../utils/formatUtils.js';
import { Tooltip } from './Tooltip.js';

export class Sidebar {
  constructor(containerEl, editor) {
    this.container = containerEl;
    this.editor = editor;
    this.buttons = new Map();
    this.tooltips = [];
    this.init();
  }

  init() {
    console.log('🚀 INIT SIDEBAR - Début');
    console.log('📦 Container sidebar:', this.container);
    console.log('📝 Éditeur:', this.editor);
    
    if (!this.container) {
      console.error('❌ ERREUR: Container sidebar est null!');
      return;
    }
    
    this.container.innerHTML = '';
    this.container.className = 'wysiwyg-sidebar';

    // Créer les onglets
    console.log('📑 Création des onglets...');
    this.createTabs();
    
    // Créer le contenu des onglets
    console.log('📝 Création de l\'onglet Format...');
    this.createFormatTab();
    console.log('📝 Création de l\'onglet Insertion...');
    this.createInsertTab();
    console.log('📝 Création de l\'onglet Style...');
    this.createStyleTab();
    
    // Afficher l'onglet par défaut
    this.showTab('format');
    
    // Écouter les changements de sélection pour mettre à jour les boutons
    this.setupSelectionListener();
    
    console.log('✅ Sidebar initialisée');
    console.log('📊 Nombre de boutons créés:', this.buttons.size);
  }

  createTabs() {
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'sidebar-tabs';
    
    const tabs = [
      { id: 'format', label: 'Format', icon: '✎' },
      { id: 'insert', label: 'Insertion', icon: '➕' },
      { id: 'style', label: 'Style', icon: '🎨' }
    ];

    tabs.forEach(tab => {
      const tabEl = document.createElement('button');
      tabEl.className = 'sidebar-tab';
      tabEl.dataset.tab = tab.id;
      tabEl.innerHTML = `<span class="tab-icon">${tab.icon}</span> <span class="tab-label">${tab.label}</span>`;
      tabEl.onclick = () => this.showTab(tab.id);
      tabsContainer.appendChild(tabEl);
    });

    this.container.appendChild(tabsContainer);
  }

  createFormatTab() {
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    tabContent.id = 'tab-format';
    tabContent.style.display = 'none';

    // Groupe : Formatage texte
    this.createButtonGroup(tabContent, 'Format de texte', [
      { id: 'bold', label: 'Gras', icon: 'B', command: 'bold', shortcut: 'Ctrl+B', tooltip: 'Mettre en gras' },
      { id: 'italic', label: 'Italique', icon: 'I', command: 'italic', shortcut: 'Ctrl+I', tooltip: 'Mettre en italique' },
      { id: 'underline', label: 'Souligné', icon: 'U', command: 'underline', shortcut: 'Ctrl+U', tooltip: 'Souligner' },
      { id: 'strike', label: 'Barré', icon: 'S', command: 'strikeThrough', shortcut: 'Ctrl+Shift+X', tooltip: 'Barrer le texte' }
    ]);

    // Groupe : Titres
    this.createButtonGroup(tabContent, 'Titres', [
      { id: 'h1', label: 'Titre 1', icon: 'H1', command: 'formatBlock', value: 'h1', tooltip: 'Titre de niveau 1' },
      { id: 'h2', label: 'Titre 2', icon: 'H2', command: 'formatBlock', value: 'h2', tooltip: 'Titre de niveau 2' },
      { id: 'h3', label: 'Titre 3', icon: 'H3', command: 'formatBlock', value: 'h3', tooltip: 'Titre de niveau 3' },
      { id: 'p', label: 'Paragraphe', icon: 'P', command: 'formatBlock', value: 'p', tooltip: 'Paragraphe normal' }
    ]);

    // Groupe : Listes
    this.createButtonGroup(tabContent, 'Listes', [
      { id: 'ul', label: 'Liste à puces', icon: '•', command: 'insertUnorderedList', tooltip: 'Liste à puces' },
      { id: 'ol', label: 'Liste numérotée', icon: '1.', command: 'insertOrderedList', tooltip: 'Liste numérotée' }
    ]);

    // Groupe : Alignement
    this.createButtonGroup(tabContent, 'Alignement', [
      { id: 'align-left', label: 'Gauche', icon: '◄', command: 'justifyLeft', tooltip: 'Aligner à gauche' },
      { id: 'align-center', label: 'Centre', icon: '↔', command: 'justifyCenter', tooltip: 'Centrer' },
      { id: 'align-right', label: 'Droite', icon: '►', command: 'justifyRight', tooltip: 'Aligner à droite' },
      { id: 'align-justify', label: 'Justifié', icon: '◄↔►', command: 'justifyFull', tooltip: 'Justifier' }
    ]);

    // Groupe : Couleurs
    const colorGroup = document.createElement('div');
    colorGroup.className = 'button-group';
    const colorTitle = document.createElement('h4');
    colorTitle.textContent = 'Couleurs';
    colorGroup.appendChild(colorTitle);

    const colorContainer = document.createElement('div');
    colorContainer.className = 'color-picker-container';
    
    // Couleur de texte
    const textColorLabel = document.createElement('label');
    textColorLabel.textContent = 'Texte: ';
    const textColorInput = document.createElement('input');
    textColorInput.type = 'color';
    textColorInput.value = '#000000';
    textColorInput.onchange = (e) => {
      FormatUtils.applyFormat('foreColor', e.target.value);
      this.updateButtonStates();
    };
    textColorLabel.appendChild(textColorInput);
    colorContainer.appendChild(textColorLabel);

    // Couleur de fond
    const bgColorLabel = document.createElement('label');
    bgColorLabel.textContent = 'Fond: ';
    const bgColorInput = document.createElement('input');
    bgColorInput.type = 'color';
    bgColorInput.value = '#ffffff';
    bgColorInput.onchange = (e) => {
      FormatUtils.applyFormat('backColor', e.target.value);
      this.updateButtonStates();
    };
    bgColorLabel.appendChild(bgColorInput);
    colorContainer.appendChild(bgColorLabel);

    colorGroup.appendChild(colorContainer);
    tabContent.appendChild(colorGroup);

    this.container.appendChild(tabContent);
  }

  createInsertTab() {
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    tabContent.id = 'tab-insert';
    tabContent.style.display = 'none';

    // Groupe : Insertion
    this.createButtonGroup(tabContent, 'Éléments', [
      { id: 'insert-table', label: 'Tableau', icon: '⊞', command: 'insertTable', tooltip: 'Insérer un tableau' },
      { id: 'insert-image', label: 'Image', icon: '🖼', command: 'insertImage', tooltip: 'Insérer une image' },
      { id: 'insert-link', label: 'Lien', icon: '🔗', command: 'createLink', tooltip: 'Insérer un lien' },
      { id: 'insert-hr', label: 'Ligne', icon: '─', command: 'insertHorizontalRule', tooltip: 'Insérer une ligne horizontale' }
    ]);

    // Groupe : Variables
    const varGroup = document.createElement('div');
    varGroup.className = 'button-group';
    const varTitle = document.createElement('h4');
    varTitle.textContent = 'Variables';
    varGroup.appendChild(varTitle);

    const varList = document.createElement('div');
    varList.className = 'variable-list';
    
    // Variables par défaut (à charger depuis l'API plus tard)
    const variables = [
      { name: 'Client.Nom', label: 'Nom du client' },
      { name: 'Client.Prenom', label: 'Prénom du client' },
      { name: 'Vehicule.Marque', label: 'Marque du véhicule' },
      { name: 'Vehicule.Modele', label: 'Modèle du véhicule' }
    ];

    variables.forEach(variable => {
      const varBtn = document.createElement('button');
      varBtn.className = 'variable-button';
      varBtn.textContent = variable.label;
      varBtn.onclick = () => {
        if (this.editor && this.editor.insertVariable) {
          this.editor.insertVariable(variable.name);
        }
      };
      varList.appendChild(varBtn);
    });

    varGroup.appendChild(varList);
    tabContent.appendChild(varGroup);

    this.container.appendChild(tabContent);
  }

  createStyleTab() {
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    tabContent.id = 'tab-style';
    tabContent.style.display = 'none';

    // Groupe : Taille de police
    const fontSizeGroup = document.createElement('div');
    fontSizeGroup.className = 'button-group';
    const fontSizeTitle = document.createElement('h4');
    fontSizeTitle.textContent = 'Taille de police';
    fontSizeGroup.appendChild(fontSizeTitle);

    const fontSizeSelect = document.createElement('select');
    fontSizeSelect.className = 'font-size-select';
    const sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
    sizes.forEach(size => {
      const option = document.createElement('option');
      option.value = `${size}px`;
      option.textContent = size;
      fontSizeSelect.appendChild(option);
    });
    fontSizeSelect.value = '16px';
    fontSizeSelect.onchange = (e) => {
      FormatUtils.applyFormat('fontSize', e.target.value);
      this.updateButtonStates();
    };
    fontSizeGroup.appendChild(fontSizeSelect);
    tabContent.appendChild(fontSizeGroup);

    // Groupe : Police
    const fontGroup = document.createElement('div');
    fontGroup.className = 'button-group';
    const fontTitle = document.createElement('h4');
    fontTitle.textContent = 'Police';
    fontGroup.appendChild(fontTitle);

    const fontSelect = document.createElement('select');
    fontSelect.className = 'font-family-select';
    const fonts = ['Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Comic Sans MS'];
    fonts.forEach(font => {
      const option = document.createElement('option');
      option.value = font;
      option.textContent = font;
      fontSelect.appendChild(option);
    });
    fontSelect.onchange = (e) => {
      FormatUtils.applyFormat('fontName', e.target.value);
      this.updateButtonStates();
    };
    fontGroup.appendChild(fontSelect);
    tabContent.appendChild(fontGroup);

    this.container.appendChild(tabContent);
  }

  createButtonGroup(container, title, buttons) {
    const group = document.createElement('div');
    group.className = 'button-group';
    
    const groupTitle = document.createElement('h4');
    groupTitle.textContent = title;
    group.appendChild(groupTitle);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    buttons.forEach((btnConfig, index) => {
      console.log(`🔘 Création bouton ${index + 1}/${buttons.length}:`, btnConfig.label, btnConfig.command);
      
      const button = document.createElement('button');
      button.className = 'toolbar-button';
      button.dataset.command = btnConfig.command;
      button.dataset.value = btnConfig.value || '';
      button.innerHTML = `<span class="button-icon">${btnConfig.icon}</span> <span class="button-label">${btnConfig.label}</span>`;
      
      console.log(`✅ Bouton créé:`, button);
      
      button.onclick = (e) => {
        console.log('🔘 CLIC DÉTECTÉ SUR LE BOUTON!');
        e.preventDefault();
        e.stopPropagation();
        
        console.log('═══════════════════════════════════════');
        console.log('🔘 BOUTON CLIQUÉ');
        console.log('═══════════════════════════════════════');
        console.log('📌 Commande:', btnConfig.command);
        console.log('📌 Label:', btnConfig.label);
        console.log('📌 Valeur:', btnConfig.value);
        console.log('📌 Config complète:', btnConfig);
        
        // Vérifier que l'éditeur existe
        if (!this.editor) {
          console.error('❌ Éditeur non défini!');
          alert('Erreur: Éditeur non initialisé');
          return;
        }
        
        if (!this.editor.container) {
          console.error('❌ Container éditeur non défini!');
          alert('Erreur: Container éditeur non trouvé');
          return;
        }
        
        const editorContainer = this.editor.container;
        console.log('✅ Container trouvé:', editorContainer);
        console.log('📝 contentEditable:', editorContainer.contentEditable);
        console.log('📝 ID:', editorContainer.id);
        console.log('📝 Classe:', editorContainer.className);
        
        // Vérifier la sélection AVANT de donner le focus
        const selectionBefore = window.getSelection();
        console.log('📋 Sélection AVANT focus:', {
          rangeCount: selectionBefore.rangeCount,
          isCollapsed: selectionBefore.isCollapsed,
          toString: selectionBefore.toString(),
          selectedText: selectionBefore.toString()
        });
        
        // Donner le focus à l'éditeur
        editorContainer.focus();
        console.log('🎯 Focus donné à l\'éditeur');
        console.log('🎯 Élément actif:', document.activeElement);
        
        // Attendre un peu puis appliquer le format
        setTimeout(() => {
          const selection = window.getSelection();
          const selectedText = selection.toString();
          
          console.log('═══════════════════════════════════════');
          console.log('📋 SÉLECTION APRÈS FOCUS');
          console.log('═══════════════════════════════════════');
          console.log('📌 Nombre de ranges:', selection.rangeCount);
          console.log('📌 Est vide (collapsed):', selection.isCollapsed);
          console.log('📌 Texte sélectionné:', selectedText);
          console.log('📌 Longueur du texte:', selectedText.length);
          
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            console.log('📌 Range start:', {
              container: range.startContainer,
              offset: range.startOffset,
              nodeName: range.startContainer.nodeName,
              textContent: range.startContainer.textContent?.substring(0, 50)
            });
            console.log('📌 Range end:', {
              container: range.endContainer,
              offset: range.endOffset
            });
            console.log('📌 Dans l\'éditeur:', editorContainer.contains(range.commonAncestorContainer));
          }
          
          // Appliquer le format de manière très simple
          if (['bold', 'italic', 'underline', 'strikeThrough'].includes(btnConfig.command)) {
            console.log('═══════════════════════════════════════');
            console.log('🎨 APPLICATION DU FORMAT');
            console.log('═══════════════════════════════════════');
            console.log('📌 Format à appliquer:', btnConfig.command);
            console.log('📌 Sur le texte:', selectedText || '(aucun texte sélectionné)');
            
            const success = document.execCommand(btnConfig.command, false, null);
            
            console.log('✅ Résultat execCommand:', success);
            
            if (success) {
              // Vérifier l'état après
              const stateAfter = document.queryCommandState(btnConfig.command);
              console.log('📊 État du format après:', stateAfter);
              
              // Vérifier le texte sélectionné après
              const selectionAfter = window.getSelection();
              console.log('📋 Sélection APRÈS formatage:', {
                rangeCount: selectionAfter.rangeCount,
                isCollapsed: selectionAfter.isCollapsed,
                toString: selectionAfter.toString()
              });
            } else {
              console.error('❌ execCommand a échoué pour:', btnConfig.command);
              alert(`Erreur: Impossible d'appliquer ${btnConfig.command}`);
            }
          } else if (btnConfig.command === 'insertTable') {
            console.log('📊 Insertion d\'un tableau');
            this.insertTable();
          } else if (btnConfig.command === 'insertImage') {
            console.log('🖼️ Insertion d\'une image');
            this.insertImage();
          } else if (btnConfig.command === 'createLink') {
            console.log('🔗 Création d\'un lien');
            this.createLink();
          } else {
            console.log('📊 Autre commande:', btnConfig.command);
            FormatUtils.applyFormat(btnConfig.command, btnConfig.value);
          }
          
          console.log('═══════════════════════════════════════');
          console.log('✅ FIN DU TRAITEMENT');
          console.log('═══════════════════════════════════════');
          
          // Mettre à jour l'état des boutons
          setTimeout(() => {
            this.updateButtonStates();
          }, 100);
        }, 100);
      };

      // Ajouter tooltip
      if (btnConfig.tooltip) {
        Tooltip.attach(button, btnConfig.tooltip, btnConfig.shortcut);
      }

      this.buttons.set(btnConfig.id, button);
      buttonContainer.appendChild(button);
    });

    group.appendChild(buttonContainer);
    container.appendChild(group);
  }

  showTab(tabId) {
    // Cacher tous les onglets
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.style.display = 'none';
    });

    // Désactiver tous les boutons d'onglets
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
      tab.classList.remove('active');
    });

    // Afficher l'onglet sélectionné
    const selectedTab = document.getElementById(`tab-${tabId}`);
    if (selectedTab) {
      selectedTab.style.display = 'block';
    }

    // Activer le bouton d'onglet
    const tabButton = document.querySelector(`[data-tab="${tabId}"]`);
    if (tabButton) {
      tabButton.classList.add('active');
    }
  }

  setupSelectionListener() {
    // Écouter les changements de sélection dans l'éditeur
    document.addEventListener('selectionchange', () => {
      this.updateButtonStates();
    });

    // Écouter les clics dans l'éditeur
    if (this.editor && this.editor.container) {
      this.editor.container.addEventListener('click', () => {
        setTimeout(() => this.updateButtonStates(), 10);
      });

      this.editor.container.addEventListener('keyup', () => {
        this.updateButtonStates();
      });
    }
  }

  updateButtonStates() {
    // Mettre à jour l'état actif/inactif des boutons selon la sélection
    this.buttons.forEach((button, id) => {
      const command = button.dataset.command;
      if (command) {
        const isActive = FormatUtils.isFormatActive(command);
        button.classList.toggle('active', isActive);
      }
    });
  }

  insertTable() {
    const rows = prompt('Nombre de lignes:', '3');
    const cols = prompt('Nombre de colonnes:', '3');
    
    if (rows && cols) {
      const table = document.createElement('table');
      table.className = 'wysiwyg-table';
      
      for (let i = 0; i < parseInt(rows); i++) {
        const tr = document.createElement('tr');
        for (let j = 0; j < parseInt(cols); j++) {
          const td = document.createElement('td');
          td.contentEditable = true;
          tr.appendChild(td);
        }
        table.appendChild(tr);
      }

      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(table);
      }
    }
  }

  insertImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = document.createElement('img');
          img.src = event.target.result;
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
          
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }

  createLink() {
    const url = prompt('URL du lien:', 'https://');
    if (url) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.textContent = selection.toString();
        range.deleteContents();
        range.insertNode(link);
      } else {
        // Insérer un lien avec le texte de l'URL
        FormatUtils.insertText(url);
        const range = selection.getRangeAt(0);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.textContent = url;
        range.deleteContents();
        range.insertNode(link);
      }
    }
  }
}

