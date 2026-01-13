// src/modules/editor/templateBuilder/components/rightPanel/FormatTab.js

// Charger le CSS
import loadCSS from '../../../utils/loadCSS.js';
loadCSS('templateBuilder/components/rightPanel/FormatTab.css', 'format-tab-styles');

export default class FormatTab {
  constructor({ onFormat }) {
    this.onFormat = onFormat;
    this.buttons = new Map(); // Map pour stocker les boutons par commande
  }


  createFormatGroup(title, buttons) {
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
    this.container.appendChild(group);
  }
  
  render(container) {
    this.container = container;
    this.container.className = 'format-tab';
    this.container.innerHTML = '';
    this.buttons.clear(); // Réinitialiser la map des boutons

    // Titre
    const title = document.createElement('h3');
    title.textContent = 'Formatage';
    this.container.appendChild(title);

    // Groupe : Formatage texte
    this.createFormatGroup('Format de texte', [
      { label: 'Gras', command: 'bold', icon: 'B' },
      { label: 'Italique', command: 'italic', icon: 'I' },
      { label: 'Souligné', command: 'underline', icon: 'U' },
      { label: 'Barré', command: 'strikeThrough', icon: 'S' }
    ]);

    // Groupe : Titres
    this.createFormatGroup('Titres', [
      { label: 'Titre 1', command: 'formatBlock', value: 'h1', icon: 'H1' },
      { label: 'Titre 2', command: 'formatBlock', value: 'h2', icon: 'H2' },
      { label: 'Titre 3', command: 'formatBlock', value: 'h3', icon: 'H3' },
      { label: 'Paragraphe', command: 'formatBlock', value: 'p', icon: 'P' }
    ]);

    // Groupe : Listes
    this.createFormatGroup('Listes', [
      { label: 'Liste à puces', command: 'insertUnorderedList', icon: '•' },
      { label: 'Liste numérotée', command: 'insertOrderedList', icon: '1.' }
    ]);

    // Groupe : Alignement
    this.createFormatGroup('Alignement', [
      { label: 'Gauche', command: 'justifyLeft', icon: '◄' },
      { label: 'Centre', command: 'justifyCenter', icon: '↔' },
      { label: 'Droite', command: 'justifyRight', icon: '►' },
      { label: 'Justifié', command: 'justifyFull', icon: '◄↔►' }
    ]);

    // Groupe : Insertion
    this.createFormatGroup('Insertion', [
      { label: 'Tableau', command: 'insertTable', icon: '⊞' },
      { label: 'Image', command: 'insertImage', icon: '🖼' },
      { label: 'Lien', command: 'createLink', icon: '🔗' }
    ]);
    
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
            const currentFormat = document.queryCommandValue('formatBlock');
            const isActive = currentFormat === value.toLowerCase();
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
      setTimeout(() => this.updateButtonStates(), 10);
    });
    
    // Écouter aussi les clics et touches dans l'éditeur contentEditable
    // Chercher tous les éléments contentEditable (l'éditeur principal)
    const editorElements = document.querySelectorAll('[contenteditable="true"]');
    editorElements.forEach(editorElement => {
      // Cliquer dans l'éditeur pour déplacer le curseur
      editorElement.addEventListener('click', () => {
        setTimeout(() => this.updateButtonStates(), 10);
      });
      
      // Relâcher la souris après sélection
      editorElement.addEventListener('mouseup', () => {
        setTimeout(() => this.updateButtonStates(), 10);
      });
      
      // Déplacer le curseur avec le clavier
      editorElement.addEventListener('keyup', () => {
        setTimeout(() => this.updateButtonStates(), 10);
      });
      
      editorElement.addEventListener('keydown', () => {
        setTimeout(() => this.updateButtonStates(), 10);
      });
      
      // Focus sur l'éditeur
      editorElement.addEventListener('focus', () => {
        setTimeout(() => this.updateButtonStates(), 10);
      });
    });
  }
}

