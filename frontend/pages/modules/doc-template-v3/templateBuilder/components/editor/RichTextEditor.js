// src/modules/editor/templateBuilder/components/editor/RichTextEditor.js

// Charger le CSS
(function loadCSS() {
  if (!document.getElementById('rich-text-editor-styles')) {
    const link = document.createElement('link');
    link.id = 'rich-text-editor-styles';
    link.rel = 'stylesheet';
    const baseUrl = window.BASE_URL || '/';
    link.href = baseUrl + 'pages/modules/doc-template-v3/templateBuilder/components/editor/RichTextEditor.css';
    document.head.appendChild(link);
  }
})();

import { formatHierarchicalNumbering } from '../../utils/numberingUtils.js';
import { flattenSections } from '../../utils/sectionHierarchy.js';

export default class RichTextEditor {
  constructor({ template, onContentChange, onTitleCreated, onSectionChange, onTitleLevelChanged, onTitleDeleted }) {
    this.template = template;
    this.onContentChange = onContentChange;
    this.onTitleCreated = onTitleCreated; // Callback quand un titre est créé
    this.onSectionChange = onSectionChange; // Callback quand la section active change (clic dans l'éditeur)
    this.onTitleLevelChanged = onTitleLevelChanged; // Callback quand le niveau d'un titre change
    this.onTitleDeleted = onTitleDeleted; // Callback quand un titre est supprimé (transformé en paragraphe ou supprimé)
    this.currentSectionId = null;
    this.editorElement = null;
    this.dragCaretIndicator = null;
    this.dropRange = null;
    this.draggedVariableElement = null; // Variable en cours de déplacement
    this.resizeObserver = null; // Observer pour les changements de taille
    this.pageBreakObserver = null; // Observer pour gérer les sauts de page
    this.pageBreakCheckTimeout = null; // Timeout pour debounce des vérifications de saut de page
    this.recalculateSpacersTimeout = null; // Timeout pour debounce du recalcul des spacers
  }

  render(container) {
    this.container = container;
    this.container.className = 'rich-text-editor-container';
    this.container.innerHTML = '';

    // Wrapper de page (pour centrer et styliser)
    this.pageWrapper = document.createElement('div');
    this.pageWrapper.className = 'page-wrapper';
    this.container.appendChild(this.pageWrapper);

    // Zone d'édition
    this.editorElement = document.createElement('div');
    this.editorElement.className = 'rich-text-editor';
    this.editorElement.contentEditable = true;
    this.editorElement.spellcheck = false;
    
    // Attributs par défaut pour le format de page
    this.editorElement.setAttribute('data-format', 'A4');
    this.editorElement.setAttribute('data-orientation', 'portrait');
    
    // Événements
    this.editorElement.oninput = () => {
      this.handleContentChange();
      // Rendre les variables draggables après chaque modification
      this.makeVariablesDraggable();
    };
    this.editorElement.onpaste = (e) => this.handlePaste(e);
    
    // Gérer la touche Entrée dans un titre : créer un paragraphe et mettre à jour la numérotation
    this.editorElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        // Vérifier si on est dans un titre avant de gérer
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          let element = range.startContainer;
          if (element.nodeType === Node.TEXT_NODE) {
            element = element.parentElement;
          }
          
          // Trouver le paragraphe parent
          while (element && element !== this.editorElement) {
            if (element.classList.contains('doc-title-level-1') ||
                element.classList.contains('doc-title-level-2') ||
                element.classList.contains('doc-title-level-3')) {
              this.handleEnterKey(e);
              break;
            }
            element = element.parentElement;
          }
        }
        
        // Recalculer tous les spacers après la création de la ligne (Enter crée toujours une nouvelle ligne)
        setTimeout(() => {
          this.recalculateAllSpacers();
        }, 100);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        // Recalculer tous les spacers après suppression (peut supprimer une ligne)
        setTimeout(() => {
          this.recalculateAllSpacers();
        }, 100);
      }
    });
    
    // Gestion du drag & drop pour les variables
    this.dragCaretIndicator = null;
    
    // Permettre le drop aussi sur le container (pas seulement l'éditeur)
    this.container.ondragenter = (e) => {
      e.preventDefault();
      // Créer l'indicateur de caret
      if (!this.dragCaretIndicator) {
        this.dragCaretIndicator = document.createElement('div');
        this.dragCaretIndicator.className = 'drag-caret-indicator';
        this.dragCaretIndicator.style.position = 'fixed';
        this.dragCaretIndicator.style.pointerEvents = 'none';
        this.dragCaretIndicator.style.zIndex = '10000';
        this.dragCaretIndicator.innerHTML = '|';
        this.dragCaretIndicator.style.color = '#0055AA';
        this.dragCaretIndicator.style.fontSize = '16px';
        this.dragCaretIndicator.style.fontWeight = 'bold';
        this.dragCaretIndicator.style.lineHeight = '1.2';
        document.body.appendChild(this.dragCaretIndicator);
      }
      // Afficher immédiatement le caret à la position la plus proche
      this.updateCaretPosition(e);
    };
    
    this.editorElement.ondragenter = (e) => {
      e.preventDefault();
      // Créer l'indicateur de caret s'il n'existe pas
      if (!this.dragCaretIndicator) {
        this.dragCaretIndicator = document.createElement('div');
        this.dragCaretIndicator.className = 'drag-caret-indicator';
        this.dragCaretIndicator.style.position = 'fixed';
        this.dragCaretIndicator.style.pointerEvents = 'none';
        this.dragCaretIndicator.style.zIndex = '10000';
        this.dragCaretIndicator.innerHTML = '|';
        this.dragCaretIndicator.style.color = '#0055AA';
        this.dragCaretIndicator.style.fontSize = '16px';
        this.dragCaretIndicator.style.fontWeight = 'bold';
        this.dragCaretIndicator.style.lineHeight = '1.2';
        document.body.appendChild(this.dragCaretIndicator);
      }
      // Afficher immédiatement le caret à la position la plus proche
      this.updateCaretPosition(e);
    };
    
    // Fonction pour trouver la position exacte dans le texte en utilisant une recherche binaire optimisée
    this.findExactTextPosition = (element, x, y) => {
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let bestNode = null;
      let bestOffset = 0;
      let bestDistance = Infinity;
      const tempRange = document.createRange();
      
      // Parcourir tous les nœuds texte
      let node;
      while (node = walker.nextNode()) {
        if (!node.textContent || node.textContent.length === 0) continue;
        
        // Obtenir les coordonnées du nœud texte en utilisant un Range
        try {
          tempRange.selectNodeContents(node);
          const nodeRect = tempRange.getBoundingClientRect();
          
          // Vérifier si le point est dans ce nœud (avec tolérance)
          if (x < nodeRect.left - 5 || x > nodeRect.right + 5) continue;
          if (y < nodeRect.top - nodeRect.height || y > nodeRect.bottom + nodeRect.height) continue;
        } catch (err) {
          // Si on ne peut pas obtenir les coordonnées, ignorer ce nœud
          continue;
        }
        
        // Recherche binaire pour trouver l'offset optimal
        let left = 0;
        let right = node.textContent.length;
        let bestNodeOffset = 0;
        let bestNodeDistance = Infinity;
        const range = document.createRange();
        
        // Recherche binaire optimisée (max 10 itérations)
        for (let iter = 0; iter < 10 && left <= right; iter++) {
          const mid = Math.floor((left + right) / 2);
          
          range.setStart(node, mid);
          range.collapse(true);
          
          try {
            const rect = range.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
              // Position invalide, ajuster
              if (mid === 0) {
                left = 1;
                continue;
              }
              if (mid === node.textContent.length) {
                right = mid - 1;
                continue;
              }
            }
            
            const centerX = rect.left;
            const distance = Math.abs(x - centerX);
            
            if (distance < bestNodeDistance) {
              bestNodeDistance = distance;
              bestNodeOffset = mid;
            }
            
            // Ajuster la recherche
            if (x < centerX) {
              right = mid - 1;
            } else {
              left = mid + 1;
            }
          } catch (err) {
            break;
          }
        }
        
        // Vérifier aussi les positions aux extrémités
        for (const offset of [0, node.textContent.length]) {
          range.setStart(node, offset);
          range.collapse(true);
          
          try {
            const rect = range.getBoundingClientRect();
            const centerX = rect.left;
            const distance = Math.abs(x - centerX);
            
            if (distance < bestNodeDistance) {
              bestNodeDistance = distance;
              bestNodeOffset = offset;
            }
          } catch (err) {
            // Ignorer
          }
        }
        
        // Si cette position est meilleure que les précédentes
        if (bestNodeDistance < bestDistance) {
          bestNode = node;
          bestOffset = bestNodeOffset;
          bestDistance = bestNodeDistance;
        }
      }
      
      if (bestNode !== null) {
        return { node: bestNode, offset: bestOffset };
      }
      
      return null;
    };
    
    // Fonction pour trouver et afficher le caret le plus proche
    this.updateCaretPosition = (e) => {
      if (!this.dragCaretIndicator) return;
      
      let bestRange = null;
      
      // Étape 1 : Chercher si le curseur est dans un élément (h1, p, etc.)
      const allElements = this.editorElement.querySelectorAll('p, div, h1, h2, h3, h4, li');
      let elementUnderCursor = null;
      
      for (const element of allElements) {
        const rect = element.getBoundingClientRect();
        // Vérifier si le curseur est dans cet élément
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          elementUnderCursor = element;
          break;
        }
      }
      
      // Étape 2 : Si on est dans un élément, trouver la position exacte dans le texte
      if (elementUnderCursor) {
        // Essayer d'abord caretRangeFromPoint
        if (document.caretRangeFromPoint) {
          try {
            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
            if (range && elementUnderCursor.contains(range.commonAncestorContainer)) {
              // Vérifier si le range est dans un nœud texte (position précise)
              const container = range.commonAncestorContainer;
              if (container.nodeType === Node.TEXT_NODE) {
                bestRange = range;
              } else {
                // Le range est sur un élément, utiliser findExactTextPosition
                const textPos = this.findExactTextPosition(elementUnderCursor, e.clientX, e.clientY);
                if (textPos) {
                  bestRange = document.createRange();
                  bestRange.setStart(textPos.node, textPos.offset);
                  bestRange.collapse(true);
                }
              }
            }
          } catch (err) {
            // caretRangeFromPoint a échoué, utiliser findExactTextPosition
            const textPos = this.findExactTextPosition(elementUnderCursor, e.clientX, e.clientY);
            if (textPos) {
              bestRange = document.createRange();
              bestRange.setStart(textPos.node, textPos.offset);
              bestRange.collapse(true);
            }
          }
        } else {
          // Pas de caretRangeFromPoint, utiliser findExactTextPosition
          const textPos = this.findExactTextPosition(elementUnderCursor, e.clientX, e.clientY);
          if (textPos) {
            bestRange = document.createRange();
            bestRange.setStart(textPos.node, textPos.offset);
            bestRange.collapse(true);
          }
        }
        
        // Si toujours pas de range, utiliser le début de l'élément
        if (!bestRange) {
          bestRange = document.createRange();
          bestRange.setStart(elementUnderCursor, 0);
          bestRange.collapse(true);
        }
      }
      
      // Étape 3 : Si aucun élément n'est sous le curseur, chercher le premier run vide
      if (!bestRange) {
        for (const element of allElements) {
          const isEmpty = element.textContent.trim() === '' || 
                         (element.children.length === 0 && element.textContent.trim() === '') ||
                         (element.innerHTML === '<br>' || element.innerHTML === '<br/>' || element.innerHTML.trim() === '');
          
          if (isEmpty) {
            bestRange = document.createRange();
            bestRange.setStart(element, 0);
            bestRange.collapse(true);
            break;
          }
        }
      }
      
      // Étape 4 : Si toujours rien, créer une nouvelle ligne
      if (!bestRange) {
        const newP = document.createElement('p');
        newP.innerHTML = '<br>';
        this.editorElement.appendChild(newP);
        bestRange = document.createRange();
        bestRange.setStart(newP, 0);
        bestRange.collapse(true);
      }
      
      // Afficher le caret à la position trouvée
      if (bestRange && this.dragCaretIndicator) {
        // Créer un range temporaire pour obtenir la position exacte
        const tempRange = bestRange.cloneRange();
        tempRange.collapse(true);
        const rect = tempRange.getBoundingClientRect();
        
        // Obtenir l'élément pour récupérer la taille de police
        let element = bestRange.commonAncestorContainer;
        if (element.nodeType === Node.TEXT_NODE) {
          element = element.parentElement;
        }
        
        // Récupérer la taille de police calculée
        const computedStyle = window.getComputedStyle(element);
        const fontSize = computedStyle.fontSize;
        const lineHeight = computedStyle.lineHeight || '1.2';
        
        // Ajuster la taille du caret en fonction de la taille du texte
        this.dragCaretIndicator.style.fontSize = fontSize;
        this.dragCaretIndicator.style.lineHeight = lineHeight;
        
        // Positionner exactement sur le caret (pas de décalage)
        this.dragCaretIndicator.style.left = (rect.left + window.scrollX) + 'px';
        this.dragCaretIndicator.style.top = (rect.top + window.scrollY) + 'px';
        this.dragCaretIndicator.style.display = 'block';
        this.dragCaretIndicator.style.visibility = 'visible';
        this.dragCaretIndicator.style.opacity = '1';
        
        // Stocker le range pour le drop
        this.dropRange = bestRange.cloneRange();
      } else if (this.dragCaretIndicator) {
        // Si pas de range trouvé, cacher le caret
        this.dragCaretIndicator.style.display = 'none';
      }
    };
    
    this.container.ondragover = (e) => {
      e.preventDefault();
      
      // Détecter si c'est une variable existante qui est dragée
      const isMovingVariable = e.dataTransfer.types.includes('application/variable-move') || 
                               (this.draggedVariableElement && this.draggedVariableElement.parentNode);
      
      // Utiliser 'move' pour les variables existantes, 'copy' pour les nouvelles
      e.dataTransfer.dropEffect = isMovingVariable ? 'move' : 'copy';
      
      // S'assurer que le caret existe
      if (!this.dragCaretIndicator) {
        this.dragCaretIndicator = document.createElement('div');
        this.dragCaretIndicator.className = 'drag-caret-indicator';
        this.dragCaretIndicator.style.position = 'fixed';
        this.dragCaretIndicator.style.pointerEvents = 'none';
        this.dragCaretIndicator.style.zIndex = '10000';
        this.dragCaretIndicator.innerHTML = '|';
        this.dragCaretIndicator.style.color = '#0055AA';
        this.dragCaretIndicator.style.fontSize = '16px';
        this.dragCaretIndicator.style.fontWeight = 'bold';
        this.dragCaretIndicator.style.lineHeight = '1.2';
        document.body.appendChild(this.dragCaretIndicator);
      }
      
      // Mettre à jour la position du caret en temps réel
      this.updateCaretPosition(e);
    };
    
    this.editorElement.ondragover = (e) => {
      e.preventDefault();
      
      // Détecter si c'est une variable existante qui est dragée
      const isMovingVariable = e.dataTransfer.types.includes('application/variable-move') || 
                               (this.draggedVariableElement && this.draggedVariableElement.parentNode);
      
      // Utiliser 'move' pour les variables existantes, 'copy' pour les nouvelles
      e.dataTransfer.dropEffect = isMovingVariable ? 'move' : 'copy';
      
      // S'assurer que le caret existe
      if (!this.dragCaretIndicator) {
        this.dragCaretIndicator = document.createElement('div');
        this.dragCaretIndicator.className = 'drag-caret-indicator';
        this.dragCaretIndicator.style.position = 'fixed';
        this.dragCaretIndicator.style.pointerEvents = 'none';
        this.dragCaretIndicator.style.zIndex = '10000';
        this.dragCaretIndicator.innerHTML = '|';
        this.dragCaretIndicator.style.color = '#0055AA';
        this.dragCaretIndicator.style.fontSize = '16px';
        this.dragCaretIndicator.style.fontWeight = 'bold';
        this.dragCaretIndicator.style.lineHeight = '1.2';
        document.body.appendChild(this.dragCaretIndicator);
      }
      
      // Mettre à jour la position du caret en temps réel
      this.updateCaretPosition(e);
    };
    
    this.container.ondragleave = (e) => {
      // Cacher le caret si on sort complètement du container
      if (this.dragCaretIndicator && !this.container.contains(e.relatedTarget)) {
        this.dragCaretIndicator.style.display = 'none';
      }
      // S'assurer que le caret du navigateur est visible quand on sort du drag
      if (document.activeElement === this.editorElement) {
        setTimeout(() => {
          const selection = window.getSelection();
          if (selection.rangeCount === 0) {
            const range = document.createRange();
            range.selectNodeContents(this.editorElement);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }, 10);
      }
    };
    
    this.editorElement.ondragleave = (e) => {
      // Ne rien faire si on reste dans le container
      // Le caret sera géré par le container
      // Mais s'assurer que le caret du navigateur est visible
      if (document.activeElement === this.editorElement && !this.editorElement.contains(e.relatedTarget)) {
        setTimeout(() => {
          const selection = window.getSelection();
          if (selection.rangeCount === 0) {
            const range = document.createRange();
            range.selectNodeContents(this.editorElement);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }, 10);
      }
    };
    
    this.editorElement.ondrop = (e) => {
      e.stopPropagation(); // Empêcher la propagation au container
      this.handleDrop(e);
    };
    
    // Permettre aussi le drop sur le container (pour les zones en dehors de l'éditeur)
    this.container.ondrop = (e) => {
      // Si le drop est sur l'éditeur, il sera déjà géré par editorElement.ondrop
      // On ne gère que si le drop est en dehors de l'éditeur
      if (!this.editorElement.contains(e.target)) {
        this.handleDrop(e);
      }
    };
    
    // Fonction pour trouver la position exacte dans le texte à partir des coordonnées
    this.findTextPositionFromPoint = (x, y) => {
      // Chercher l'élément sous le curseur
      const allElements = this.editorElement.querySelectorAll('p, div, h1, h2, h3, h4, li');
      let elementUnderCursor = null;
      
      for (const element of allElements) {
        const rect = element.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          elementUnderCursor = element;
          break;
        }
      }
      
      if (elementUnderCursor) {
        // Utiliser findExactTextPosition pour trouver la position précise
        const textPos = this.findExactTextPosition(elementUnderCursor, x, y);
        if (textPos) {
          const range = document.createRange();
          range.setStart(textPos.node, textPos.offset);
          range.collapse(true);
          return range;
        }
        
        // Fallback : utiliser caretRangeFromPoint si disponible
        if (document.caretRangeFromPoint) {
          try {
            const range = document.caretRangeFromPoint(x, y);
            if (range && elementUnderCursor.contains(range.commonAncestorContainer)) {
              const container = range.commonAncestorContainer;
              if (container.nodeType === Node.TEXT_NODE) {
                return range;
              }
            }
          } catch (err) {
            // Ignorer
          }
        }
        
        // Dernier recours : début de l'élément
        const range = document.createRange();
        range.setStart(elementUnderCursor, 0);
        range.collapse(true);
        return range;
      }
      
      return null;
    };
    
    // Fonction centralisée pour gérer le drop
    this.handleDrop = (e) => {
      e.preventDefault();
      
      // Cacher l'indicateur de caret
      if (this.dragCaretIndicator) {
        this.dragCaretIndicator.style.display = 'none';
      }
      
      const variablePath = e.dataTransfer.getData('text/plain');
      const isMovingVariable = e.dataTransfer.getData('application/variable-move') === 'true';
      const draggedVariableElement = isMovingVariable ? this.draggedVariableElement : null;
      
      if (variablePath) {
        let range = null;
        
        // Priorité 1 : Utiliser le range stocké pendant le drag (le plus précis car calculé en temps réel)
        if (this.dropRange) {
          try {
            if (this.editorElement.contains(this.dropRange.commonAncestorContainer)) {
              // Vérifier que le range est dans un nœud texte (position précise)
              const container = this.dropRange.commonAncestorContainer;
              if (container.nodeType === Node.TEXT_NODE) {
                range = this.dropRange.cloneRange();
              } else {
                // Le range est sur un élément, utiliser findExactTextPosition pour trouver la position exacte
                const element = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
                if (element) {
                  const textPos = this.findExactTextPosition(element, e.clientX, e.clientY);
                  if (textPos) {
                    range = document.createRange();
                    range.setStart(textPos.node, textPos.offset);
                    range.collapse(true);
                  } else {
                    // Fallback : utiliser le range stocké
                    range = this.dropRange.cloneRange();
                  }
                }
              }
            }
          } catch (err) {
            // Le range stocké n'est plus valide
          }
        }
        
        // Priorité 2 : Utiliser findTextPositionFromPoint pour trouver la position exacte
        if (!range) {
          range = this.findTextPositionFromPoint(e.clientX, e.clientY);
        }
        
        // Priorité 3 : Utiliser caretRangeFromPoint comme fallback
        if (!range && document.caretRangeFromPoint) {
          try {
            const caretRange = document.caretRangeFromPoint(e.clientX, e.clientY);
            if (caretRange && this.editorElement.contains(caretRange.commonAncestorContainer)) {
              const container = caretRange.commonAncestorContainer;
              if (container.nodeType === Node.TEXT_NODE) {
                range = caretRange;
              }
            }
          } catch (err) {
            // caretRangeFromPoint a échoué
          }
        }
        
        // Priorité 3 : Fallback - chercher l'élément sous le curseur
        if (!range) {
          const allElements = this.editorElement.querySelectorAll('p, div, h1, h2, h3, h4, li');
          for (const element of allElements) {
            const rect = element.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
              range = document.createRange();
              range.setStart(element, 0);
              range.collapse(true);
              break;
            }
          }
        }
        
        // Priorité 4 : Dernier recours - créer une nouvelle ligne à la fin
        if (!range) {
          const newP = document.createElement('p');
          newP.innerHTML = '<br>';
          this.editorElement.appendChild(newP);
          range = document.createRange();
          range.setStart(newP, 0);
          range.collapse(true);
        }
        
        // Si on déplace une variable existante, la supprimer de l'ancienne position
        if (isMovingVariable && draggedVariableElement && draggedVariableElement.parentNode) {
          // Vérifier qu'on ne la replace pas au même endroit
          const newRangeRect = range.getBoundingClientRect();
          const oldElementRect = draggedVariableElement.getBoundingClientRect();
          const isSamePosition = Math.abs(newRangeRect.left - oldElementRect.left) < 10 &&
                                 Math.abs(newRangeRect.top - oldElementRect.top) < 10;
          
          if (!isSamePosition) {
            draggedVariableElement.remove();
          } else {
            // Même position, ne rien faire
            this.dropRange = null;
            this.draggedVariableElement = null;
            return;
          }
        }
        
        // Appliquer la sélection
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Insérer la variable
        this.insertVariable(variablePath);
        
        // La restauration du caret est gérée dans insertVariable
        // Mais on force une restauration supplémentaire ici pour être sûr
        requestAnimationFrame(() => {
          if (this.editorElement) {
            this.editorElement.focus();
            const currentSelection = window.getSelection();
            if (currentSelection.rangeCount === 0) {
              // Si pas de sélection, en créer une après la dernière variable
              const variables = this.editorElement.querySelectorAll('.template-variable');
              if (variables.length > 0) {
                const lastVariable = variables[variables.length - 1];
                const newRange = document.createRange();
                newRange.setStartAfter(lastVariable);
                newRange.collapse(true);
                currentSelection.removeAllRanges();
                currentSelection.addRange(newRange);
              } else {
                // Sinon, à la fin de l'éditeur
                const newRange = document.createRange();
                newRange.selectNodeContents(this.editorElement);
                newRange.collapse(false);
                currentSelection.removeAllRanges();
                currentSelection.addRange(newRange);
              }
            }
            // Forcer le focus pour déclencher l'affichage du caret
            this.editorElement.blur();
            this.editorElement.focus();
          }
        });
        
        // Nettoyer
        this.dropRange = null;
        this.draggedVariableElement = null;
      }
    };
    
    // Le caret permanent est désactivé - on utilise le caret noir du navigateur
    this.permanentCaret = null;
    this.updatePermanentCaret = () => {
      // Fonction désactivée - on utilise le caret du navigateur
    };
    
    // Écouter les clics dans l'éditeur pour détecter la section active
    this.editorElement.addEventListener('click', (e) => {
      // S'assurer que l'éditeur a le focus pour afficher le caret
      if (document.activeElement !== this.editorElement) {
        this.editorElement.focus();
      }
      this.detectActiveSection(e);
    });
    
    // Écouter aussi les changements de sélection (mouvement du curseur)
    this.editorElement.addEventListener('keyup', () => {
      this.detectActiveSection();
    });
    
    // S'assurer que le caret est visible quand l'éditeur a le focus
    this.editorElement.addEventListener('focus', () => {
      // Forcer l'affichage du caret en créant une sélection si nécessaire
      const selection = window.getSelection();
      if (selection.rangeCount === 0) {
        const range = document.createRange();
        range.selectNodeContents(this.editorElement);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    });
    
    this.pageWrapper.appendChild(this.editorElement);

    // Appliquer le format de page
    this.applyPageFormat();
    
    // Observer les changements de taille pour recalculer le scaling
    this.setupResizeObserver();
    
    // Observer pour gérer les sauts de page avec des spacers dans le flux
    this.setupPageBreakObserver();

    // Rendre tout le contenu du document (toutes les sections)
    this.renderAllSections();
    
    // Appliquer les styles de mise en page
    this.applyLayoutStyles();
    
    // Rendre les variables existantes draggables
    this.makeVariablesDraggable();
  }

  applyPageFormat() {
    // Récupérer le format depuis les attributs data ou depuis le template
    let pageSize = 'A4';
    let orientation = 'portrait';
    
    if (this.editorElement) {
      // Priorité aux attributs data sur l'éditeur
      pageSize = this.editorElement.getAttribute('data-format') || pageSize;
      orientation = this.editorElement.getAttribute('data-orientation') || orientation;
    }
    
    // Si le template existe, utiliser ses valeurs (mais les attributs data ont la priorité)
    if (this.template && this.template.generalStyles && this.template.generalStyles.default) {
      const pagination = this.template.generalStyles.default.pagination || {};
      if (!this.editorElement?.getAttribute('data-format')) {
        pageSize = pagination.pageSize || pageSize;
      }
      if (!this.editorElement?.getAttribute('data-orientation')) {
        orientation = pagination.orientation || orientation;
      }
    }

    // Dimensions réelles en cm (pour export PDF)
    const PAGE_SIZES = {
      A0: { width: 84.1, height: 118.9 },
      A1: { width: 59.4, height: 84.1 },
      A2: { width: 42, height: 59.4 },
      A3: { width: 29.7, height: 42 },
      A4: { width: 21, height: 29.7 },
      A5: { width: 14.8, height: 21 },
      A6: { width: 10.5, height: 14.8 }
    };

    let size;
    if (pageSize === 'custom') {
      // Format personnalisé : utiliser les dimensions du template
      const customWidth = this.template?.generalStyles?.default?.pagination?.customWidth || 21;
      const customHeight = this.template?.generalStyles?.default?.pagination?.customHeight || 29.7;
      size = { width: customWidth, height: customHeight };
    } else {
      size = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
    }
    
    // Conversion cm en px (1cm = 37.795275591px à 96 DPI)
    const pxPerCm = 37.795275591;
    
    // Dimensions réelles en pixels (pour export PDF)
    let realWidth, realHeight;
    if (orientation === 'portrait') {
      realWidth = size.width * pxPerCm;
      realHeight = size.height * pxPerCm;
    } else {
      // paysage
      realWidth = size.height * pxPerCm;
      realHeight = size.width * pxPerCm;
    }

    // Mettre à jour les attributs data sur l'éditeur
    if (this.editorElement) {
      this.editorElement.setAttribute('data-format', pageSize);
      this.editorElement.setAttribute('data-orientation', orientation);
    }
    
    // Calculer le ratio d'échelle basé sur la largeur réelle du rich-text-editor
    if (!this.editorElement) return;
    
    // Fonction pour calculer et appliquer le scaling
    const calculateAndApplyScaling = () => {
      // Mesurer la largeur réelle du rich-text-editor
      const editorRect = this.editorElement.getBoundingClientRect();
      const editorWidth = editorRect.width || 800; // fallback en pixels
      
      // Calculer le ratio : largeur réelle rich-text-editor / largeur format
      // Si l'éditeur est plus large que le format, le ratio sera > 1 (agrandit le texte)
      // Si l'éditeur est plus petit que le format, le ratio sera < 1 (réduit le texte)
      const scaleRatio = editorWidth / realWidth;
      
      // Définir la variable CSS --scale-ratio sur l'éditeur
      this.editorElement.style.setProperty('--scale-ratio', scaleRatio);
      
      // Stocker le ratio dans le dataset de l'éditeur
      this.editorElement.dataset.scaleRatio = scaleRatio;
      
      // Aussi sur le pageWrapper pour compatibilité
      if (this.pageWrapper) {
        this.pageWrapper.style.setProperty('--scale-ratio', scaleRatio);
        this.pageWrapper.dataset.scaleRatio = scaleRatio;
      }
      
      console.log('📐 Ratio calculé:', {
        editorWidth,
        realWidth,
        scaleRatio,
        pageSize,
        orientation
      });
      
      // Appliquer les marges si définies (avec ratio pour la fidélité)
      if (this.template && this.template.generalStyles && this.template.generalStyles.default) {
        const margins = this.template.generalStyles.default.margin || {};
        if (margins.top) {
          const topValue = parseFloat(margins.top) || 0;
          const topUnit = margins.top.replace(/[\d.-]/g, '') || 'px';
          this.editorElement.style.paddingTop = `calc(${topValue}${topUnit} * var(--scale-ratio, ${scaleRatio}))`;
        }
        if (margins.right) {
          const rightValue = parseFloat(margins.right) || 0;
          const rightUnit = margins.right.replace(/[\d.-]/g, '') || 'px';
          this.editorElement.style.paddingRight = `calc(${rightValue}${rightUnit} * var(--scale-ratio, ${scaleRatio}))`;
        }
        if (margins.bottom) {
          const bottomValue = parseFloat(margins.bottom) || 0;
          const bottomUnit = margins.bottom.replace(/[\d.-]/g, '') || 'px';
          this.editorElement.style.paddingBottom = `calc(${bottomValue}${bottomUnit} * var(--scale-ratio, ${scaleRatio}))`;
        }
        if (margins.left) {
          const leftValue = parseFloat(margins.left) || 0;
          const leftUnit = margins.left.replace(/[\d.-]/g, '') || 'px';
          this.editorElement.style.paddingLeft = `calc(${leftValue}${leftUnit} * var(--scale-ratio, ${scaleRatio}))`;
        }
      }
    };
    
    // Attendre que le DOM soit rendu pour obtenir la largeur réelle
    // Utiliser requestAnimationFrame pour s'assurer que les dimensions sont calculées
    requestAnimationFrame(() => {
      calculateAndApplyScaling();
    });
    
    // Dimensions réelles (pour export PDF) - sur pageWrapper
    if (this.pageWrapper) {
      this.pageWrapper.style.width = `${realWidth}px`;
      this.pageWrapper.style.minHeight = `${realHeight}px`;
      
      // Stocker les dimensions réelles pour l'export PDF
      this.pageWrapper.dataset.realWidth = realWidth;
      this.pageWrapper.dataset.realHeight = realHeight;
      this.pageWrapper.dataset.pageSize = pageSize;
      this.pageWrapper.dataset.orientation = orientation;
    }
  }
  
  setupResizeObserver() {
    // Observer les changements de taille du rich-text-editor pour recalculer le scaling
    if (!this.editorElement || !window.ResizeObserver) {
      // Fallback sur window resize si ResizeObserver n'est pas disponible
      window.addEventListener('resize', () => {
        if (this.editorElement) {
          this.applyPageFormat();
        }
      });
      return;
    }
    
    // Utiliser ResizeObserver pour détecter les changements de taille
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    this.resizeObserver = new ResizeObserver(() => {
      // Recalculer le scaling quand la taille change
      this.applyPageFormat();
    });
    
    this.resizeObserver.observe(this.editorElement);
  }
  
  
  setupPageBreakObserver() {
    // Observer pour détecter les changements de contenu et gérer les sauts de page
    if (!this.editorElement) return;
    
    if (this.pageBreakObserver) {
      this.pageBreakObserver.disconnect();
    }
    
    this.isUpdatingPageBreaks = false; // Flag pour éviter les boucles infinies
    
    this.pageBreakObserver = new MutationObserver((mutations) => {
      // Ignorer si on est déjà en train de mettre à jour les sauts de page
      if (this.isUpdatingPageBreaks) return;
      
      // Ignorer les mutations sur les spacers eux-mêmes
      const hasNonSpacerMutation = mutations.some(mutation => {
        const target = mutation.target;
        return !target.classList || !target.classList.contains('page-break-spacer');
      });
      
      if (!hasNonSpacerMutation) return;
      
      // Ne pas vérifier automatiquement à chaque mutation
      // On vérifie seulement sur Enter ou fin de ligne
      // (désactivé pour éviter les appels trop fréquents)
    });
    
    this.pageBreakObserver.observe(this.editorElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  
  // Fonction principale pour recalculer tous les spacers
  recalculateAllSpacers() {
    if (!this.editorElement || this.isUpdatingPageBreaks) {
      return;
    }
    
    this.isUpdatingPageBreaks = true;
    
    // Supprimer tous les spacers existants
    const existingSpacers = this.editorElement.querySelectorAll('.margin-spacer-footer, .margin-spacer-header');
    existingSpacers.forEach(spacer => spacer.remove());
    
    // Récupérer les dimensions de la page
    const pageSize = this.editorElement.getAttribute('data-format') || 'A4';
    const orientation = this.editorElement.getAttribute('data-orientation') || 'portrait';
    const scaleRatio = parseFloat(this.editorElement.dataset.scaleRatio) || 1;
    
    const PAGE_SIZES = {
      A0: { width: 84.1, height: 118.9 },
      A1: { width: 59.4, height: 84.1 },
      A2: { width: 42, height: 59.4 },
      A3: { width: 29.7, height: 42 },
      A4: { width: 21, height: 29.7 },
      A5: { width: 14.8, height: 21 },
      A6: { width: 10.5, height: 14.8 }
    };
    
    let size;
    if (pageSize === 'custom') {
      const customWidth = this.template?.generalStyles?.default?.pagination?.customWidth || 21;
      const customHeight = this.template?.generalStyles?.default?.pagination?.customHeight || 29.7;
      size = { width: customWidth, height: customHeight };
    } else {
      size = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
    }
    
    const pxPerCm = 37.795275591;
    const pageHeightCm = orientation === 'portrait' ? size.height : size.width;
    const pageWidthCm = orientation === 'portrait' ? size.width : size.height;
    
    // Calculer la hauteur de page
    const editorRect = this.editorElement.getBoundingClientRect();
    const editorWidth = editorRect.width;
    const realWidthPx = pageWidthCm * pxPerCm;
    const realHeightPx = pageHeightCm * pxPerCm;
    const pageHeightPx = (editorWidth / realWidthPx) * realHeightPx;
    
    const margins = this.template?.generalStyles?.default?.margin || {};
    const marginTop = this.parseMargin(margins.top || '2.5cm', scaleRatio);
    const marginBottom = this.parseMargin(margins.bottom || '2.5cm', scaleRatio);
    const marginLeft = this.parseMargin(margins.left || '2.5cm', scaleRatio);
    const marginRight = this.parseMargin(margins.right || '2.5cm', scaleRatio);
    
    const pageMargin = parseFloat(getComputedStyle(this.editorElement).getPropertyValue('--page-margin')) || 5;
    const totalPageHeight = pageHeightPx + pageMargin;
    const editableHeight = pageHeightPx - marginTop - marginBottom;
    const pageLimit = editableHeight;
    
    // Parcourir tous les éléments éditable (p, div avec doc-title-level-X)
    const allElements = Array.from(this.editorElement.querySelectorAll('p, div.doc-title-level-1, div.doc-title-level-2, div.doc-title-level-3'))
      .filter(el => !el.classList.contains('margin-spacer-footer') && !el.classList.contains('margin-spacer-header'));
    
    // Calculer la position cumulative de chaque élément (basé sur les hauteurs précédentes)
    // Commencer après la marge du haut de la première page
    let cumulativeTop = marginTop;
    
    allElements.forEach((element, index) => {
      // Calculer la hauteur de l'élément (incluant les marges)
      const elementRect = element.getBoundingClientRect();
      const elementHeight = elementRect.height;
      
      // Récupérer les marges CSS de l'élément pour les inclure dans le calcul
      const computedStyle = window.getComputedStyle(element);
      const marginTopEl = parseFloat(computedStyle.marginTop) || 0;
      const marginBottomEl = parseFloat(computedStyle.marginBottom) || 0;
      
      // Pour le premier élément, on commence à marginTop
      // Pour les suivants, on ajoute la marge du haut de l'élément
      if (index > 0) {
        cumulativeTop += marginTopEl;
      }
      
      // Calculer la position dans la page actuelle
      // On utilise le reste de la division euclidienne pour trouver la position dans la page
      const positionInTotalPage = cumulativeTop % totalPageHeight;
      let positionInCurrentPage;
      
      if (positionInTotalPage < pageMargin) {
        // On est dans la marge entre les pages
        positionInCurrentPage = marginTop;
      } else {
        // On soustrait la marge entre les pages et on ajoute marginTop
        positionInCurrentPage = (positionInTotalPage - pageMargin) + marginTop;
      }
      
      // Si positionInCurrentPage dépasse déjà pageLimit, on est sur une nouvelle page
      if (positionInCurrentPage > pageLimit) {
        const excess = positionInCurrentPage - pageLimit;
        positionInCurrentPage = marginTop + excess;
      }
      
      // Position du bas de l'élément dans la zone éditable (incluant la marge du bas)
      const elementBottom = positionInCurrentPage + elementHeight + marginBottomEl;
      
      if (elementBottom > pageLimit) {
        // Calculer la hauteur disponible
        const availableHeight = Math.max(0, pageLimit - positionInCurrentPage);
        const footerHeight = marginBottom + availableHeight;
        
        // Créer le footer spacer
        const footerSpacer = document.createElement('p');
        footerSpacer.className = 'margin-spacer-footer';
        footerSpacer.contentEditable = 'false';
        footerSpacer.style.height = `${footerHeight}px`;
        footerSpacer.style.margin = '0';
        footerSpacer.style.marginLeft = `-${marginLeft}px`;
        footerSpacer.style.marginRight = `-${marginRight}px`;
        footerSpacer.style.padding = '0';
        footerSpacer.style.pointerEvents = 'none';
        footerSpacer.style.userSelect = 'none';
        footerSpacer.style.display = 'block';
        footerSpacer.style.visibility = 'visible';
        footerSpacer.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        footerSpacer.style.marginBottom = `${pageMargin}px`;
        
        // Insérer avant l'élément
        element.parentNode.insertBefore(footerSpacer, element);
        
        // Créer le header spacer
        const headerSpacer = document.createElement('p');
        headerSpacer.className = 'margin-spacer-header';
        headerSpacer.contentEditable = 'false';
        headerSpacer.style.height = `${marginTop}px`;
        headerSpacer.style.margin = '0';
        headerSpacer.style.marginLeft = `-${marginLeft}px`;
        headerSpacer.style.marginRight = `-${marginRight}px`;
        headerSpacer.style.padding = '0';
        headerSpacer.style.pointerEvents = 'none';
        headerSpacer.style.userSelect = 'none';
        headerSpacer.style.display = 'block';
        headerSpacer.style.visibility = 'visible';
        headerSpacer.style.boxShadow = '0 -4px 6px rgba(0, 0, 0, 0.1)';
        headerSpacer.style.width = '100%';
        
        // Insérer après le footer
        footerSpacer.parentNode.insertBefore(headerSpacer, footerSpacer.nextSibling);
        
        // Mettre à jour cumulativeTop pour les éléments suivants
        // On passe à la page suivante : on calcule la position après le saut de page
        const currentPageIndex = Math.floor(cumulativeTop / totalPageHeight);
        // Position après le footer + header = début de la nouvelle page
        cumulativeTop = (currentPageIndex + 1) * totalPageHeight + pageMargin + marginTop;
        // Ajouter la hauteur de l'élément sur la nouvelle page (incluant la marge du bas)
        cumulativeTop += elementHeight + marginBottomEl;
      } else {
        // L'élément tient dans la page actuelle, mettre à jour cumulativeTop
        // Inclure la hauteur de l'élément et sa marge du bas
        cumulativeTop += elementHeight + marginBottomEl;
      }
    });
    
    this.isUpdatingPageBreaks = false;
  }
  
  checkAndInsertMarginSpacers() {
    if (!this.editorElement) {
      return;
    }
    
    // Récupérer les dimensions de la page
    const pageSize = this.editorElement.getAttribute('data-format') || 'A4';
    const orientation = this.editorElement.getAttribute('data-orientation') || 'portrait';
    const scaleRatio = parseFloat(this.editorElement.dataset.scaleRatio) || 1;
    
    const PAGE_SIZES = {
      A0: { width: 84.1, height: 118.9 },
      A1: { width: 59.4, height: 84.1 },
      A2: { width: 42, height: 59.4 },
      A3: { width: 29.7, height: 42 },
      A4: { width: 21, height: 29.7 },
      A5: { width: 14.8, height: 21 },
      A6: { width: 10.5, height: 14.8 }
    };
    
    let size;
    if (pageSize === 'custom') {
      const customWidth = this.template?.generalStyles?.default?.pagination?.customWidth || 21;
      const customHeight = this.template?.generalStyles?.default?.pagination?.customHeight || 29.7;
      size = { width: customWidth, height: customHeight };
    } else {
      size = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
    }
    
    const pxPerCm = 37.795275591;
    const pageHeightCm = orientation === 'portrait' ? size.height : size.width;
    const pageWidthCm = orientation === 'portrait' ? size.width : size.height;
    
    // Calculer la hauteur de page
    const editorRect = this.editorElement.getBoundingClientRect();
    const editorWidth = editorRect.width;
    const realWidthPx = pageWidthCm * pxPerCm;
    const realHeightPx = pageHeightCm * pxPerCm;
    const pageHeightPx = (editorWidth / realWidthPx) * realHeightPx;
    
    const margins = this.template?.generalStyles?.default?.margin || {};
    const marginTop = this.parseMargin(margins.top || '2.5cm', scaleRatio);
    const marginBottom = this.parseMargin(margins.bottom || '2.5cm', scaleRatio);
    const marginLeft = this.parseMargin(margins.left || '2.5cm', scaleRatio);
    const marginRight = this.parseMargin(margins.right || '2.5cm', scaleRatio);
    
    // Obtenir la position du caret
    const selection = window.getSelection();
    if (selection.rangeCount === 0) {
      return;
    }
    
    const range = selection.getRangeAt(0);
    
    // Trouver l'élément contenant le caret (paragraphe)
    let caretElement = range.startContainer;
    if (caretElement.nodeType === Node.TEXT_NODE) {
      caretElement = caretElement.parentElement;
    }
    
    // Trouver le paragraphe parent
    while (caretElement && caretElement !== this.editorElement) {
      if (caretElement.tagName === 'P' || 
          caretElement.classList.contains('doc-title-level-1') ||
          caretElement.classList.contains('doc-title-level-2') ||
          caretElement.classList.contains('doc-title-level-3')) {
        break;
      }
      caretElement = caretElement.parentElement;
    }
    
    if (!caretElement || caretElement === this.editorElement) {
      return;
    }
    
    // Calculer la position du paragraphe par rapport au début de l'éditeur
    // Utiliser offsetTop qui donne la position relative au parent
    let paragraphTop = 0;
    let currentElement = caretElement;
    while (currentElement && currentElement !== this.editorElement) {
      paragraphTop += currentElement.offsetTop;
      currentElement = currentElement.offsetParent;
    }
    
    // Si offsetTop ne fonctionne pas bien, utiliser getBoundingClientRect
    if (paragraphTop === 0 || paragraphTop < 0) {
      const elementRect = caretElement.getBoundingClientRect();
      const editorRectForCaret = this.editorElement.getBoundingClientRect();
      paragraphTop = elementRect.top - editorRectForCaret.top + this.editorElement.scrollTop;
    }
    
    // Position du caret : utiliser la position du haut du paragraphe
    // (on vérifie si le bas du paragraphe dépasse, donc on a besoin du haut)
    const caretY = paragraphTop;
    
    // Obtenir la hauteur du texte
    const textHeight = caretElement.getBoundingClientRect().height;
    
    // Position du bas du texte = position du caret + hauteur du texte
    const textBottom = caretY + textHeight;
    
    // Marge entre les pages (variable CSS pour customiser plus tard)
    const pageMargin = parseFloat(getComputedStyle(this.editorElement).getPropertyValue('--page-margin')) || 5; // px
    
    // Hauteur totale d'une page (hauteur + marge entre pages)
    const totalPageHeight = pageHeightPx + pageMargin;
    
    // Calculer l'index de la page actuelle (combien de pages complètes on a déjà)
    const currentPageIndex = Math.floor(caretY / totalPageHeight);
    
    // Calculer la position relative dans la page actuelle (reste de la division euclidienne)
    const positionInTotalPage = caretY % totalPageHeight;
    
    // Si on est dans la marge entre les pages (les premiers pixels), on est sur la page suivante
    // La zone éditable commence après marginTop de chaque page
    let positionInCurrentPage;
    if (positionInTotalPage < pageMargin) {
      // On est dans la marge entre les pages, donc on est au début de la page suivante
      // La position dans la zone éditable commence après marginTop
      positionInCurrentPage = marginTop;
    } else {
      // On soustrait la marge entre les pages pour avoir la position dans la page
      // Puis on ajoute marginTop car la zone éditable commence après la marge du haut
      positionInCurrentPage = (positionInTotalPage - pageMargin) + marginTop;
    }
    
    // Limite de la zone éditable dans la page = hauteur de page - marge haut - marge bas
    const editableHeight = pageHeightPx - marginTop - marginBottom;
    
    // La limite est la hauteur éditable (sans les marges)
    const pageLimit = editableHeight;
    
    // Si positionInCurrentPage dépasse déjà pageLimit, on est déjà sur une nouvelle page
    // Dans ce cas, on doit recalculer pour la page suivante
    if (positionInCurrentPage > pageLimit) {
      // On est déjà sur une nouvelle page, recalculer la position
      const excess = positionInCurrentPage - pageLimit;
      positionInCurrentPage = marginTop + excess;
    }
    
    // Position du bas dans la zone éditable de la page actuelle
    const textBottomInPage = positionInCurrentPage + textHeight;
    
    console.log('📊 Calcul simple:', {
      caretY,
      textHeight,
      textBottom,
      pageHeightPx,
      marginBottom,
      pageLimit,
      totalPageHeight,
      positionInCurrentPage,
      textBottomInPage,
      depasse: textBottomInPage > pageLimit
    });
    
    // Si la position du bas du texte dépasse la limite de la page, on est sur une nouvelle page
    if (textBottomInPage > pageLimit) {
      console.log('🆕 Nouvelle page détectée !');
      
      // Calculer la hauteur disponible dans la page actuelle
      // S'assurer que availableHeight n'est jamais négatif
      const availableHeight = Math.max(0, pageLimit - positionInCurrentPage);
      
      // Hauteur du footer = marge bottom + hauteur disponible
      const footerHeight = marginBottom + availableHeight;
      
      // Créer le P footer
      const footerSpacer = document.createElement('p');
      footerSpacer.className = 'margin-spacer-footer';
      footerSpacer.contentEditable = 'false';
      footerSpacer.style.height = `${footerHeight}px`;
      footerSpacer.style.margin = '0';
      footerSpacer.style.marginLeft = `-${marginLeft}px`;
      footerSpacer.style.marginRight = `-${marginRight}px`;
      footerSpacer.style.padding = '0';
      footerSpacer.style.pointerEvents = 'none';
      footerSpacer.style.userSelect = 'none';
      footerSpacer.style.display = 'block';
      footerSpacer.style.visibility = 'visible';
      footerSpacer.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'; // Ombrage en bas
      
      // Insérer après l'élément du caret
      caretElement.parentNode.insertBefore(footerSpacer, caretElement.nextSibling);
      
      // Créer le P header pour la page suivante
      const headerSpacer = document.createElement('p');
      headerSpacer.className = 'margin-spacer-header';
      headerSpacer.contentEditable = 'false';
      headerSpacer.style.height = `${marginTop}px`;
      headerSpacer.style.margin = '0';
      headerSpacer.style.marginLeft = `-${marginLeft}px`;
      headerSpacer.style.marginRight = `-${marginRight}px`;
      headerSpacer.style.padding = '0';
      headerSpacer.style.pointerEvents = 'none';
      headerSpacer.style.userSelect = 'none';
      headerSpacer.style.display = 'block';
      headerSpacer.style.visibility = 'visible';
      headerSpacer.style.boxShadow = '0 -4px 6px rgba(0, 0, 0, 0.1)'; // Ombrage en haut
      headerSpacer.style.width = '100%';
      
      // Ajouter le margin entre les pages sur le footer au lieu du header
      footerSpacer.style.marginBottom = `${pageMargin}px`;
      
      console.log('✅ Ajout du P footer de hauteur:', footerHeight, {
        marginBottom,
        availableHeight,
        positionInCurrentPage,
        pageLimit
      });
      console.log('✅ Ajout du P header de hauteur:', marginTop);
      
      // Insérer après le footer
      footerSpacer.parentNode.insertBefore(headerSpacer, footerSpacer.nextSibling);
      
      // Créer un paragraphe vide après le header et placer le caret dedans
      const newParagraph = document.createElement('p');
      newParagraph.textContent = '\u200B'; // Caractère invisible pour que le paragraphe ne soit pas vide
      newParagraph.style.margin = '0';
      newParagraph.style.padding = '0';
      
      // Insérer après le header
      headerSpacer.parentNode.insertBefore(newParagraph, headerSpacer.nextSibling);
      
      // Placer le caret dans le nouveau paragraphe
      setTimeout(() => {
        const range = document.createRange();
        const selection = window.getSelection();
        range.setStart(newParagraph, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Focus sur l'éditeur pour que le caret soit visible
        this.editorElement.focus();
        
        // Scroller pour que le nouveau paragraphe soit visible
        newParagraph.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 10);
    }
  }
  
  recalculateSpacersAfterElement(startElement) {
    // Recalculer les spacers pour tous les éléments après startElement
    // (logique simplifiée pour l'instant, peut être améliorée)
    const allElements = this.editorElement.querySelectorAll('p, div.doc-title-level-1, div.doc-title-level-2, div.doc-title-level-3');
    let foundStart = false;
    
    allElements.forEach((el) => {
      if (el === startElement) {
        foundStart = true;
        return;
      }
      
      if (foundStart && !el.classList.contains('margin-spacer-footer') && !el.classList.contains('margin-spacer-header')) {
        // Vérifier si cet élément a besoin d'un spacer
        // (logique à implémenter si nécessaire)
      }
    });
  }
  
  moveCursorToEditableZone(yPosition) {
    // Trouver le premier élément éditable (p ou div avec doc-title-level-X) proche de la position Y
    const paragraphs = this.editorElement.querySelectorAll('p, div.doc-title-level-1, div.doc-title-level-2, div.doc-title-level-3');
    
    let bestPara = null;
    let bestDistance = Infinity;
    
    paragraphs.forEach((para) => {
      // Ignorer les spacers
      if (para.classList.contains('page-break-spacer')) return;
      
      try {
        const rect = para.getBoundingClientRect();
        const editorRect = this.editorElement.getBoundingClientRect();
        const relativeY = rect.top - editorRect.top + this.editorElement.scrollTop;
        
        const distance = Math.abs(relativeY - yPosition);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestPara = para;
        }
      } catch (e) {
        // Ignorer les erreurs
      }
    });
    
    if (bestPara) {
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(bestPara);
        range.collapse(true); // Placer au début de l'élément
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (e) {
        // Ignorer les erreurs de sélection
      }
    }
  }
  
  moveCursorToPosition(yPosition) {
    // Trouver l'élément le plus proche de la position Y
    const range = document.createRange();
    const selection = window.getSelection();
    
    // Parcourir tous les éléments de l'éditeur (seulement les éléments, pas les nœuds de texte)
    const walker = document.createTreeWalker(
      this.editorElement,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          // Ignorer les spacers de saut de page
          if (node.classList && node.classList.contains('page-break-spacer')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    let node;
    let bestNode = null;
    let bestDistance = Infinity;
    
    while (node = walker.nextNode()) {
      // Vérifier que c'est un élément (pas un nœud de texte)
      if (node.nodeType === Node.ELEMENT_NODE && node.getBoundingClientRect) {
        try {
          const rect = node.getBoundingClientRect();
          const editorRect = this.editorElement.getBoundingClientRect();
          const relativeY = rect.top - editorRect.top + this.editorElement.scrollTop;
          
          const distance = Math.abs(relativeY - yPosition);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestNode = node;
          }
        } catch (e) {
          // Ignorer les erreurs de getBoundingClientRect
          continue;
        }
      }
    }
    
    if (bestNode) {
      try {
        // Si c'est un élément éditable (p, div avec doc-title-level-X), placer le curseur au début
        if (bestNode.tagName === 'P' || bestNode.classList.contains('doc-title-level-1') || 
            bestNode.classList.contains('doc-title-level-2') || bestNode.classList.contains('doc-title-level-3')) {
          range.selectNodeContents(bestNode);
          range.collapse(true);
        } else {
          // Pour les autres éléments, essayer de trouver le premier nœud de texte
          const textNode = bestNode.firstChild;
          if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            range.setStart(textNode, 0);
            range.setEnd(textNode, 0);
          } else {
            range.selectNodeContents(bestNode);
            range.collapse(true);
          }
        }
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (e) {
        // Ignorer les erreurs de sélection
      }
    }
  }
  
  parseMargin(marginValue, scaleRatio) {
    // Parser une valeur de marge (ex: "2.5cm", "20px")
    if (!marginValue) return 0;
    
    const match = marginValue.match(/^([\d.]+)(cm|px|pt|em)$/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2];
    
    // Conversion en pixels
    const pxPerCm = 37.795275591;
    let pixels = 0;
    
    if (unit === 'cm') {
      pixels = value * pxPerCm;
    } else if (unit === 'px') {
      pixels = value;
    } else if (unit === 'pt') {
      pixels = value * (pxPerCm / 28.35); // 1pt = 1/72 inch, 1cm = 28.35pt
    } else if (unit === 'em') {
      // Approximation : 1em = 16px par défaut
      pixels = value * 16;
    }
    
    return pixels * scaleRatio;
  }

  renderAllSections() {
    if (!this.editorElement || !this.template || !this.template.structure) return;
    
    const sections = this.template.structure.sections || [];
    if (sections.length === 0) {
      this.editorElement.innerHTML = '';
      
      
      return;
    }
    
    // Aplatir la hiérarchie pour obtenir une liste plate avec les chemins
    const flatList = flattenSections(sections);
    
    // Rendre toutes les sections avec leurs titres, numérotation hiérarchique et paragraphes
    const numberingType = this.template?.generalStyles?.numbering?.type || 'numeric';
    const numberingCustom = this.template?.generalStyles?.numbering?.custom || '{n}.';  
    const html = flatList.map(({ section, path }) => {
      // Utiliser des div avec classes personnalisées au lieu de h1/h2/h3
      const titleClass = section.level === 1 ? 'doc-title-level-1' : section.level === 2 ? 'doc-title-level-2' : 'doc-title-level-3';
      const title = section.title || 'Sans titre';
      const number = formatHierarchicalNumbering(path, numberingType, numberingCustom);
      
      // Rendre le titre avec la numérotation hiérarchique
      let sectionHTML = `<div class="${titleClass}" data-section-id="${section.id}">${number} ${title}</div>`;
      
      // Ajouter les paragraphes de la section
      const paragraphs = section.paragraphs || [];
      if (paragraphs.length > 0) {
        sectionHTML += paragraphs.map(p => `<p>${p}</p>`).join('\n');
      } else {
        // Si pas de paragraphes, ajouter un paragraphe vide pour permettre l'édition
        sectionHTML += '<p><br></p>';
      }
      
      return sectionHTML;
    }).join('\n');
    
    this.editorElement.innerHTML = html;
    
    
    // Charger la première section par défaut
    if (flatList.length > 0) {
      this.currentSectionId = flatList[0].section.id;
    }
    
    // Appliquer les styles de mise en page après le rendu
    this.applyLayoutStyles();
    
    
    // Rendre les variables draggables après le rendu
    this.makeVariablesDraggable();
  }
  
  scrollToSection(sectionId) {
    this.currentSectionId = sectionId;
    
    if (!this.editorElement) return;
    
    // Trouver l'élément titre correspondant à cette section
    const titleElement = this.editorElement.querySelector(`[data-section-id="${sectionId}"]`);
    if (titleElement) {
      // Scroll vers l'élément avec un léger offset
      titleElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Mettre en évidence la section (optionnel)
      titleElement.style.backgroundColor = 'rgba(0, 85, 170, 0.1)';
      setTimeout(() => {
        titleElement.style.backgroundColor = '';
      }, 1000);
    }
  }
  
  loadSection(sectionId) {
    // Ancienne méthode : remplacée par scrollToSection
    // On garde cette méthode pour compatibilité mais elle appelle maintenant scrollToSection
    this.scrollToSection(sectionId);
  }
  
  detectActiveSection(event = null) {
    if (!this.editorElement) return;
    
    // Obtenir la position du curseur ou du clic
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    let element = range.commonAncestorContainer;
    
    // Si c'est un nœud texte, remonter au parent
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement;
    }
    
    // Remonter dans la hiérarchie pour trouver le titre de section le plus proche
    let sectionTitle = null;
    let current = element;
    
    while (current && current !== this.editorElement) {
      // Vérifier si c'est un titre avec data-section-id
      if (current.tagName && current.tagName.match(/^H[1-3]$/i) && current.dataset.sectionId) {
        sectionTitle = current;
        break;
      }
      current = current.parentElement;
    }
    
    // Si on n'a pas trouvé de titre, chercher le titre précédent dans le DOM
    if (!sectionTitle) {
      // Récupérer tous les titres
      const allTitles = Array.from(this.editorElement.querySelectorAll('[data-section-id]'));
      
      // Trouver le titre qui précède le curseur
      for (let i = allTitles.length - 1; i >= 0; i--) {
        const title = allTitles[i];
        const titleRect = title.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        // Si le titre est avant l'élément du curseur (ou au même niveau), c'est notre section
        if (titleRect.top <= elementRect.top) {
          sectionTitle = title;
          break;
        }
      }
      
      // Si aucun titre n'a été trouvé, prendre le premier
      if (!sectionTitle && allTitles.length > 0) {
        sectionTitle = allTitles[0];
      }
    }
    
    // Si on a trouvé une section, notifier le changement
    if (sectionTitle && sectionTitle.dataset.sectionId) {
      const sectionId = sectionTitle.dataset.sectionId;
      
      // Ne notifier que si la section a changé
      if (sectionId !== this.currentSectionId) {
        this.currentSectionId = sectionId;
        
        // Notifier le parent
        if (this.onSectionChange) {
          this.onSectionChange(sectionId);
        }
      }
    }
  }

  findSection(structure, sectionId) {
    if (!structure || !structure.sections) return null;

    for (const section of structure.sections) {
      if (section.id === sectionId) {
        return section;
      }
      // Recherche récursive dans les sous-sections
      if (section.sections && section.sections.length > 0) {
        const found = this.findSection({ sections: section.sections }, sectionId);
        if (found) return found;
      }
    }
    return null;
  }

  handleContentChange() {
    if (this.onContentChange) {
      const content = this.editorElement.innerHTML;
      this.onContentChange(content);
    }
  }

  handlePaste(e) {
    e.preventDefault();
    
    // Récupérer le texte brut
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    
    // Insérer le texte (le formatage sera géré par l'éditeur)
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    this.handleContentChange();
  }

  getLastTextElement() {
    if (!this.editorElement) return null;
    
    // Trouver le dernier élément de texte ou paragraphe
    const allElements = Array.from(this.editorElement.querySelectorAll('p, h1, h2, h3, div, span'));
    if (allElements.length === 0) return null;
    
    // Retourner le dernier élément qui a du contenu ou peut en avoir
    let lastElement = allElements[allElements.length - 1];
    
    // Si c'est un paragraphe vide, le retourner quand même
    if (lastElement.tagName === 'P' || /^H[1-3]$/i.test(lastElement.tagName)) {
      return lastElement;
    }
    
    // Sinon, chercher le dernier paragraphe
    const paragraphs = Array.from(this.editorElement.querySelectorAll('p'));
    return paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : null;
  }

  insertVariable(variablePath) {
    if (!this.editorElement) return;

    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    
    // Vérifier si le curseur est à l'intérieur d'une variable existante
    let currentNode = range.startContainer;
    if (currentNode.nodeType === Node.TEXT_NODE) {
      currentNode = currentNode.parentElement;
    }
    
    // Chercher si on est dans un span avec la classe template-variable
    const existingVariable = currentNode.closest('.template-variable');
    if (existingVariable) {
      // Si on est dans une variable, placer la nouvelle variable après celle-ci
      const newRange = document.createRange();
      newRange.setStartAfter(existingVariable);
      newRange.collapse(true);
      range.setStart(newRange.startContainer, newRange.startOffset);
      range.collapse(true);
    } else {
      // Sinon, utiliser le range normal et supprimer le contenu sélectionné
      range.deleteContents();
    }

    // Créer un span pour la variable
    const variableSpan = document.createElement('span');
    variableSpan.className = 'template-variable';
    variableSpan.contentEditable = false;
    variableSpan.draggable = true; // Rendre la variable draggable
    variableSpan.dataset.variable = variablePath;
    variableSpan.textContent = `{{${variablePath}}}`;
    variableSpan.style.color = '#0055AA';
    variableSpan.style.fontStyle = 'italic';
    variableSpan.style.backgroundColor = '#f0f0f0';
    variableSpan.style.padding = '2px 4px';
    variableSpan.style.borderRadius = '3px';
    variableSpan.style.cursor = 'move'; // Curseur pour indiquer qu'on peut déplacer

    // Gestion du drag pour les variables existantes
    variableSpan.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', variablePath);
      e.dataTransfer.setData('application/variable-move', 'true');
      this.draggedVariableElement = variableSpan;
      e.dataTransfer.effectAllowed = 'move';
      
      // Créer une image de drag personnalisée
      const dragImage = document.createElement('div');
      dragImage.textContent = `{{${variablePath}}}`;
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
      
      const rect = dragImage.getBoundingClientRect();
      const offsetX = 30;
      const offsetY = 25;
      
      e.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
      
      setTimeout(() => {
        if (document.body.contains(dragImage)) {
          document.body.removeChild(dragImage);
        }
      }, 0);
    };

    range.insertNode(variableSpan);
    
    // Placer le curseur après la variable
    const newRange = document.createRange();
    newRange.setStartAfter(variableSpan);
    newRange.collapse(true);
    
    // Appliquer la sélection immédiatement
    selection.removeAllRanges();
    selection.addRange(newRange);
    
    // Forcer le focus et la mise à jour du caret
    const restoreCaret = () => {
      // S'assurer que l'éditeur a le focus
      if (this.editorElement) {
        this.editorElement.focus();
        
        // Vérifier et restaurer la sélection
        const currentSelection = window.getSelection();
        if (currentSelection.rangeCount === 0 || !this.editorElement.contains(currentSelection.anchorNode)) {
          // Créer une nouvelle sélection après la variable
          const restoreRange = document.createRange();
          restoreRange.setStartAfter(variableSpan);
          restoreRange.collapse(true);
          currentSelection.removeAllRanges();
          currentSelection.addRange(restoreRange);
        }
        
        // Forcer un événement de focus pour déclencher l'affichage du caret
        this.editorElement.blur();
        this.editorElement.focus();
      }
    };
    
    // Restaurer immédiatement
    restoreCaret();
    
    // Restaurer après que le DOM soit mis à jour
    requestAnimationFrame(() => {
      restoreCaret();
      // Double vérification après un court délai
      setTimeout(() => {
        restoreCaret();
      }, 50);
    });
    
    // Rendre la variable draggable après insertion
    this.makeVariablesDraggable();
    
    this.handleContentChange();
  }
  
  // Fonction pour rendre toutes les variables existantes draggables
  makeVariablesDraggable() {
    if (!this.editorElement) return;
    
    const variables = this.editorElement.querySelectorAll('.template-variable');
    variables.forEach(variableSpan => {
      // Toujours rendre draggable et réattacher l'événement (au cas où il aurait été perdu)
      variableSpan.draggable = true;
      variableSpan.style.cursor = 'move';
      
      const variablePath = variableSpan.dataset.variable;
      if (variablePath) {
        // Toujours réattacher l'événement dragstart (même si déjà draggable)
        variableSpan.ondragstart = (e) => {
          e.dataTransfer.setData('text/plain', variablePath);
          e.dataTransfer.setData('application/variable-move', 'true');
          this.draggedVariableElement = variableSpan;
          e.dataTransfer.effectAllowed = 'move';
          
          // Créer une image de drag personnalisée
          const dragImage = document.createElement('div');
          dragImage.textContent = `{{${variablePath}}}`;
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
          
          const rect = dragImage.getBoundingClientRect();
          const offsetX = 30;
          const offsetY = 25;
          
          e.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
          
          setTimeout(() => {
            if (document.body.contains(dragImage)) {
              document.body.removeChild(dragImage);
            }
          }, 0);
        };
      }
    });
  }

  applyFormat(command, value = null) {
    const selection = window.getSelection();
    let titleElementBefore = null;
    let sectionIdBefore = null;
    let currentTitleLevel = null;
    
    // Capturer l'élément titre actuel avant modification (si c'est un titre)
    if (command === 'formatBlock' && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let element = range.commonAncestorContainer;
      
      // Si c'est un nœud texte, remonter au parent
      if (element.nodeType === Node.TEXT_NODE) {
        element = element.parentElement;
      }
      
      // Remonter dans la hiérarchie jusqu'à trouver un titre (h1/h2/h3 ou div avec classe doc-title-level-X)
      while (element && element !== this.editorElement) {
        const tagName = element.tagName ? element.tagName.toLowerCase() : '';
        const className = element.className || '';
        
        // Vérifier si c'est un h1/h2/h3 ou un div avec classe doc-title-level-X
        if (tagName && /^h[1-3]$/i.test(tagName)) {
          titleElementBefore = element;
          sectionIdBefore = element.dataset.sectionId;
          currentTitleLevel = parseInt(tagName.charAt(1));
          break;
        } else if (tagName === 'div' && /doc-title-level-[1-3]/.test(className)) {
          titleElementBefore = element;
          sectionIdBefore = element.dataset.sectionId;
          const match = className.match(/doc-title-level-([1-3])/);
          currentTitleLevel = match ? parseInt(match[1]) : 1;
          break;
        }
        element = element.parentElement;
      }
    }
    
    // Détecter si on change le niveau d'un titre existant ou si on clique sur le même niveau
    // Utiliser des classes personnalisées au lieu de h1, h2, h3 pour éviter les conflits avec les styles globaux
    if (command === 'formatBlock' && value && ['h1', 'h2', 'h3'].includes(value.toLowerCase())) {
      if (titleElementBefore && sectionIdBefore) {
        // C'est un titre existant
        const newLevel = parseInt(value.charAt(1));
        
        // Si on clique sur le même niveau de titre, le transformer en paragraphe
        if (currentTitleLevel === newLevel) {
          // Extraire le texte sans la numérotation avant de transformer
          let titleText = titleElementBefore.textContent || titleElementBefore.innerText || '';
          titleText = titleText.trim();
          
          // La numérotation est au format "1. ", "1.1. ", "1.2.3. ", etc. (avec point final et espace)
          // La fonction formatHierarchicalNumbering retourne "1.2.3. " (avec point final)
          // On doit retirer tout ce qui ressemble à une numérotation au début
          
          // D'abord, retirer la numérotation hiérarchique (1.2.3. ) ou simple (1. )
          // Pattern: chiffres/lettres séparés par des points, terminés par un point et un espace
          titleText = titleText.replace(/^([\d\w]+\.)+\s+/, ''); // Format hiérarchique "1.2.3. "
          titleText = titleText.replace(/^[\d\w]+\.\s+/, ''); // Format simple "1. " ou "a. "
          titleText = titleText.replace(/^[\d\w]+\./, ''); // Format sans espace après le point "1."
          titleText = titleText.replace(/^[\d\w]+\s+/, ''); // Format sans point "1 "
          
          // Retirer les espaces en début après suppression de la numérotation
          titleText = titleText.trim();
          
          // Si le texte est vide ou très court après nettoyage
          if (!titleText || titleText.length < 1) {
            // Utiliser le texte original et retirer tout ce qui ressemble à une numérotation
            titleText = (titleElementBefore.textContent || titleElementBefore.innerText || '').trim();
            // Retirer tout ce qui commence par des chiffres/lettres et des points suivi d'un espace
            titleText = titleText.replace(/^[^\w\s]*[\d\w\.]+\s+/, '').trim();
          }
          
          // Nettoyer les espaces multiples en début
          titleText = titleText.replace(/^\s+/, '').trim();
          
          // Stocker la référence à l'élément avant transformation
          const elementToTransform = titleElementBefore;
          const cleanedText = titleText; // Stocker le texte nettoyé
          
          // NE PAS utiliser execCommand, remplacer directement l'élément
          // pour éviter que des styles soient appliqués
          if (elementToTransform && elementToTransform.parentNode) {
            // Créer un nouveau paragraphe propre sans aucun attribut ni style
            const newParagraph = document.createElement('p');
            newParagraph.textContent = cleanedText;
            
            // Remplacer l'ancien élément par le nouveau paragraphe
            elementToTransform.parentNode.replaceChild(newParagraph, elementToTransform);
            
            // Remettre le curseur dans le nouveau paragraphe
            const selection = window.getSelection();
            const newRange = document.createRange();
            newRange.selectNodeContents(newParagraph);
            newRange.collapse(false); // À la fin
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            // Forcer le focus sur l'éditeur
            if (this.editorElement) {
              this.editorElement.focus();
            }
            
            // Notifier le changement
            this.handleContentChange();
          }
          
          // Notifier la suppression du titre
          if (this.onTitleDeleted && sectionIdBefore) {
            setTimeout(() => {
              this.onTitleDeleted(sectionIdBefore);
            }, 100);
          }
          return;
        }
        
        // Sinon, changer le niveau du titre
        // Appeler le callback pour changer le niveau
        if (this.onTitleLevelChanged && sectionIdBefore) {
          setTimeout(() => {
            this.onTitleLevelChanged(sectionIdBefore, newLevel);
          }, 10);
          
          // Exécuter la commande pour changer le format
          document.execCommand(command, false, value);
          this.handleContentChange();
          return;
        }
      }
    }
    
    // Détecter si on transforme un titre en paragraphe AVANT d'exécuter execCommand
    // pour éviter que des styles soient appliqués
    if (command === 'formatBlock' && titleElementBefore && sectionIdBefore) {
      // Si on transforme explicitement en paragraphe
      if (value && value.toLowerCase() === 'p') {
        // Extraire le texte sans la numérotation
        let titleText = titleElementBefore.textContent || titleElementBefore.innerText || '';
        titleText = titleText.trim();
        
        // La numérotation est au format "1. ", "1.1. ", "1.2.3. ", etc. (avec point final et espace)
        // D'abord, retirer la numérotation hiérarchique (1.2.3. ) ou simple (1. )
        titleText = titleText.replace(/^([\d\w]+\.)+\s+/, ''); // Format hiérarchique "1.2.3. "
        titleText = titleText.replace(/^[\d\w]+\.\s+/, ''); // Format simple "1. " ou "a. "
        titleText = titleText.replace(/^[\d\w]+\./, ''); // Format sans espace après le point "1."
        titleText = titleText.replace(/^[\d\w]+\s+/, ''); // Format sans point "1 "
        
        // Retirer les espaces en début après suppression de la numérotation
        titleText = titleText.trim();
        
        if (!titleText || titleText.length < 1) {
          // Utiliser le texte original et retirer tout ce qui ressemble à une numérotation
          titleText = (titleElementBefore.textContent || titleElementBefore.innerText || '').trim();
          titleText = titleText.replace(/^[^\w\s]*[\d\w\.]+\s+/, '').trim();
        }
        
        // Nettoyer les espaces multiples en début
        titleText = titleText.replace(/^\s+/, '').trim();
        
        const cleanedText = titleText; // Stocker le texte nettoyé
        
        // NE PAS utiliser execCommand qui applique des styles
        // Remplacer directement l'élément par un nouveau paragraphe propre
        if (titleElementBefore && titleElementBefore.parentNode) {
          // Créer un nouveau paragraphe propre sans aucun attribut ni style
          const newParagraph = document.createElement('p');
          newParagraph.textContent = cleanedText;
          
          // Remplacer l'ancien élément par le nouveau paragraphe
          titleElementBefore.parentNode.replaceChild(newParagraph, titleElementBefore);
          
          // Remettre le curseur dans le nouveau paragraphe
          const selection = window.getSelection();
          const newRange = document.createRange();
          newRange.selectNodeContents(newParagraph);
          newRange.collapse(false);
          selection.removeAllRanges();
          selection.addRange(newRange);
          
          // Forcer le focus sur l'éditeur
          if (this.editorElement) {
            this.editorElement.focus();
          }
          
          // Notifier le changement
          this.handleContentChange();
          
          // Notifier la suppression du titre
          if (this.onTitleDeleted && sectionIdBefore) {
            setTimeout(() => {
              this.onTitleDeleted(sectionIdBefore);
            }, 10);
          }
        }
        
        // IMPORTANT : Ne pas continuer avec execCommand, on a déjà fait le remplacement
        return;
      } else {
        // Pour les autres transformations, vérifier après un délai
        setTimeout(() => {
          if (titleElementBefore && titleElementBefore.parentNode) {
            const currentTag = titleElementBefore.tagName ? titleElementBefore.tagName.toLowerCase() : '';
            
            // Si ce n'est plus un titre (transformé en autre chose)
            // Vérifier h1/h2/h3 ou div avec classe doc-title-level-X
            const isTitle = ['h1', 'h2', 'h3'].includes(currentTag) || 
                           (currentTag === 'div' && /doc-title-level-[1-3]/.test(titleElementBefore.className || ''));
            if (!isTitle) {
              // Notifier la suppression du titre
              if (this.onTitleDeleted && sectionIdBefore) {
                this.onTitleDeleted(sectionIdBefore);
              }
            }
          }
          this.handleContentChange();
        }, 10);
      }
    }
    
    // Intercepter formatBlock pour h1/h2/h3 et utiliser des div avec classes personnalisées
    if (command === 'formatBlock' && value && ['h1', 'h2', 'h3'].includes(value.toLowerCase())) {
      const level = parseInt(value.charAt(1));
      const className = `doc-title-level-${level}`;
      
      // Si on a une sélection
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // Si c'est un titre existant, le convertir
        if (titleElementBefore) {
          // Récupérer le contenu et les attributs
          const content = titleElementBefore.innerHTML;
          const sectionId = titleElementBefore.dataset.sectionId;
          
          // Créer un nouveau div avec la classe
          const newTitle = document.createElement('div');
          newTitle.className = className;
          newTitle.innerHTML = content;
          if (sectionId) {
            newTitle.dataset.sectionId = sectionId;
          }
          
          // Remplacer l'ancien titre
          titleElementBefore.parentNode.replaceChild(newTitle, titleElementBefore);
          
          // Mettre à jour la sélection
          const newRange = document.createRange();
          newRange.selectNodeContents(newTitle);
          newRange.collapse(false);
          selection.removeAllRanges();
          selection.addRange(newRange);
        } else {
          // Créer un nouveau titre
          const newTitle = document.createElement('div');
          newTitle.className = className;
          
          // Si la sélection contient du texte, l'utiliser
          if (!range.collapsed) {
            newTitle.innerHTML = range.toString();
            range.deleteContents();
          } else {
            newTitle.innerHTML = '<br>';
          }
          
          range.insertNode(newTitle);
          
          // Mettre à jour la sélection
          const newRange = document.createRange();
          newRange.selectNodeContents(newTitle);
          newRange.collapse(false);
          selection.removeAllRanges();
          selection.addRange(newRange);
          
          // Notifier la création d'un nouveau titre
          if (this.onTitleCreated) {
            setTimeout(() => {
              this.onTitleCreated(value.toLowerCase());
            }, 10);
          }
        }
        
        this.handleContentChange();
      }
    } else {
      // Exécuter la commande normale (seulement si on n'a pas déjà géré le cas du paragraphe)
      if (!(command === 'formatBlock' && value && value.toLowerCase() === 'p' && titleElementBefore && sectionIdBefore)) {
        document.execCommand(command, false, value);
        this.handleContentChange();
      }
    }
  }

  handleEnterKey(e) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    let element = range.commonAncestorContainer;
    
    // Si c'est un nœud texte, remonter au parent
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement;
    }
    
    // Remonter dans la hiérarchie jusqu'à trouver un titre
    let titleElement = null;
    let titleLevel = null;
    while (element && element !== this.editorElement) {
      const tagName = element.tagName ? element.tagName.toLowerCase() : '';
      const className = element.className || '';
      
      // Vérifier si c'est un h1/h2/h3 ou un div avec classe doc-title-level-X
      if (['h1', 'h2', 'h3'].includes(tagName)) {
        titleElement = element;
        titleLevel = parseInt(tagName.charAt(1));
        break;
      } else if (tagName === 'div' && /doc-title-level-[1-3]/.test(className)) {
        titleElement = element;
        const match = className.match(/doc-title-level-([1-3])/);
        titleLevel = match ? parseInt(match[1]) : 1;
        break;
      }
      element = element.parentElement;
    }
    
    // Si on est dans un titre, créer un paragraphe après
    if (titleElement) {
      e.preventDefault();
      
      // Créer un nouveau paragraphe
      const newParagraph = document.createElement('p');
      newParagraph.innerHTML = '<br>';
      
      // Insérer le paragraphe après le titre
      if (titleElement.nextSibling) {
        titleElement.parentNode.insertBefore(newParagraph, titleElement.nextSibling);
      } else {
        titleElement.parentNode.appendChild(newParagraph);
      }
      
      // Mettre le curseur dans le nouveau paragraphe
      const newRange = document.createRange();
      newRange.selectNodeContents(newParagraph);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      // Mettre à jour la numérotation si nécessaire
      // Notifier le changement de contenu pour que la numérotation soit mise à jour
      if (this.onContentChange) {
        setTimeout(() => {
          this.handleContentChange();
          // Si on a un callback pour mettre à jour la numérotation, l'appeler
          // (sera géré par TemplateBuilderPage qui écoute onContentChange)
        }, 10);
      }
    }
  }

  getContent() {
    return this.editorElement ? this.editorElement.innerHTML : '';
  }

  setContent(html) {
    if (this.editorElement) {
      this.editorElement.innerHTML = html;
      
      
      // Rendre les variables draggables après le changement de contenu
      this.makeVariablesDraggable();
      
      // Mettre à jour les indicateurs de pages
      setTimeout(() => {
      }, 100);
    }
  }

  setTemplate(template) {
    this.template = template;
    if (this.pageWrapper) {
      this.applyPageFormat();
    }
    // Re-render toutes les sections quand le template change
    if (this.editorElement) {
      this.renderAllSections();
    }
    // Appliquer les styles de mise en page
    this.applyLayoutStyles();
  }
  
  applyLayoutStyles() {
    if (!this.editorElement || !this.template || !this.template.generalStyles) return;
    
    const defaultStyles = this.template.generalStyles.default || {};
    const headingsStyles = this.template.generalStyles.headings || {};
    
    // Récupérer le ratio depuis la variable CSS ou le dataset
    const scaleRatio = this.pageWrapper?.dataset.scaleRatio || 
                      parseFloat(getComputedStyle(this.pageWrapper || this.editorElement).getPropertyValue('--scale-ratio')) || 
                      1;
    
    // Appliquer les styles globaux à l'éditeur
    // Note: fontSize est géré par le CSS avec calc(), on ne l'applique pas en inline
    if (defaultStyles.fontFamily) {
      this.editorElement.style.fontFamily = defaultStyles.fontFamily;
    }
    // fontSize est géré par le CSS .rich-text-editor avec calc()
    // On stocke juste la valeur de base dans une variable CSS si besoin
    if (defaultStyles.fontSize) {
      this.editorElement.style.setProperty('--base-font-size', `${defaultStyles.fontSize}px`);
    }
    if (defaultStyles.color) {
      this.editorElement.style.color = defaultStyles.color;
    }
    
    // Définir les variables CSS pour les tailles de titres personnalisées
    if (headingsStyles.h1?.fontSize) {
      this.editorElement.style.setProperty('--doc-font-size-h1', `${headingsStyles.h1.fontSize}px`);
    }
    if (headingsStyles.h2?.fontSize) {
      this.editorElement.style.setProperty('--doc-font-size-h2', `${headingsStyles.h2.fontSize}px`);
    }
    if (headingsStyles.h3?.fontSize) {
      this.editorElement.style.setProperty('--doc-font-size-h3', `${headingsStyles.h3.fontSize}px`);
    }
    
    // Appliquer les styles aux titres (h1/h2/h3 ou div avec classes doc-title-level-X)
    // IMPORTANT : Ne pas appliquer de styles aux éléments qui n'ont pas data-section-id
    // (car ils ont été transformés en paragraphes et doivent rester sans styles)
    ['h1', 'h2', 'h3'].forEach(heading => {
      // Chercher à la fois les balises h1/h2/h3 et les div avec classes doc-title-level-X
      const headingElements = this.editorElement.querySelectorAll(
        `${heading}[data-section-id], .doc-title-level-${heading.charAt(1)}[data-section-id]`
      );
      const headingStyle = headingsStyles[heading] || {};
      
      headingElements.forEach(element => {
        // Ignorer les éléments qui n'ont pas data-section-id (ce sont d'anciens titres transformés)
        if (!element.hasAttribute('data-section-id')) {
          return;
        }
        
        // Double vérification : si c'est un paragraphe, ne pas appliquer de styles
        if (element.tagName && element.tagName.toLowerCase() === 'p') {
          return;
        }
        // Taille de police (avec ratio pour la fidélité)
        if (headingStyle.fontSize) {
          element.style.fontSize = `calc(${headingStyle.fontSize}px * var(--scale-ratio, ${scaleRatio}))`;
        }
        
        // Font
        if (headingStyle.useGlobalFont === false) {
          // Si la checkbox est décochée, utiliser la font spécifique ou la valeur par défaut
          if (headingStyle.fontFamily) {
            element.style.fontFamily = headingStyle.fontFamily;
          } else {
            // Si pas de font spécifique, utiliser une valeur par défaut (ne pas hériter)
            element.style.fontFamily = 'Arial';
          }
        } else {
          // Si la checkbox est cochée ou non définie, utiliser la font globale
          if (defaultStyles.fontFamily) {
            element.style.fontFamily = defaultStyles.fontFamily;
          }
        }
        
        // Couleur
        if (headingStyle.useGlobalColor === false) {
          // Si la checkbox est décochée, utiliser la couleur spécifique ou noir par défaut
          if (headingStyle.color) {
            element.style.color = headingStyle.color;
          } else {
            // Si pas de couleur spécifique, utiliser noir par défaut (ne pas hériter de la globale)
            element.style.color = '#000000';
          }
        } else {
          // Si la checkbox est cochée ou non définie, utiliser la couleur globale
          if (defaultStyles.color) {
            element.style.color = defaultStyles.color;
          }
        }
        
        // Marges gauche/droite (avec ratio pour la fidélité)
        if (headingStyle.useGlobalMargin === false) {
          // Si la checkbox est décochée, utiliser les marges spécifiques
          if (headingStyle.margin) {
            if (headingStyle.margin.left) {
              // Convertir en valeur numérique si c'est une string avec unité
              const leftValue = parseFloat(headingStyle.margin.left) || 0;
              const leftUnit = headingStyle.margin.left.replace(/[\d.-]/g, '') || 'px';
              element.style.marginLeft = `calc(${leftValue}${leftUnit} * var(--scale-ratio, ${scaleRatio}))`;
            } else {
              element.style.marginLeft = '';
            }
            if (headingStyle.margin.right) {
              const rightValue = parseFloat(headingStyle.margin.right) || 0;
              const rightUnit = headingStyle.margin.right.replace(/[\d.-]/g, '') || 'px';
              element.style.marginRight = `calc(${rightValue}${rightUnit} * var(--scale-ratio, ${scaleRatio}))`;
            } else {
              element.style.marginRight = '';
            }
          } else {
            // Si pas de marges spécifiques, ne pas hériter des marges globales
            element.style.marginLeft = '';
            element.style.marginRight = '';
          }
        } else {
          // Si la checkbox est cochée ou non définie, utiliser les marges globales
          if (defaultStyles.margin) {
            if (defaultStyles.margin.left) {
              const leftValue = parseFloat(defaultStyles.margin.left) || 0;
              const leftUnit = defaultStyles.margin.left.replace(/[\d.-]/g, '') || 'px';
              element.style.marginLeft = `calc(${leftValue}${leftUnit} * var(--scale-ratio, ${scaleRatio}))`;
            }
            if (defaultStyles.margin.right) {
              const rightValue = parseFloat(defaultStyles.margin.right) || 0;
              const rightUnit = defaultStyles.margin.right.replace(/[\d.-]/g, '') || 'px';
              element.style.marginRight = `calc(${rightValue}${rightUnit} * var(--scale-ratio, ${scaleRatio}))`;
            }
          }
        }
        
        // Padding gauche/droite (avec ratio pour la fidélité)
        if (headingStyle.padding) {
          if (headingStyle.padding.left) {
            const leftValue = parseFloat(headingStyle.padding.left) || 0;
            const leftUnit = headingStyle.padding.left.replace(/[\d.-]/g, '') || 'px';
            element.style.paddingLeft = `calc(${leftValue}${leftUnit} * var(--scale-ratio, ${scaleRatio}))`;
          }
          if (headingStyle.padding.right) {
            const rightValue = parseFloat(headingStyle.padding.right) || 0;
            const rightUnit = headingStyle.padding.right.replace(/[\d.-]/g, '') || 'px';
            element.style.paddingRight = `calc(${rightValue}${rightUnit} * var(--scale-ratio, ${scaleRatio}))`;
          }
        }
      });
    });
  }
}

