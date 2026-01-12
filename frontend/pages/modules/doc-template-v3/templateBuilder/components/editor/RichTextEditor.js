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
    
    // Images en attente d'upload (seront uploadées lors de la sauvegarde)
    this.pendingImageUploads = new Map(); // key: img element, value: { file, tempUrl }
    
    // Callbacks pour notifier FormatTab
    this.onImageSelected = null;
    this.onImageDeselected = null;
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
      
      // Maintenir le scroll en bas si on est sur la dernière ligne
      this.maintainScrollAtBottom();
    };
    this.editorElement.onpaste = (e) => this.handlePaste(e);
    
    // Désélectionner les images quand on clique ailleurs
    this.editorElement.onclick = (e) => {
      // Si on ne clique pas sur une image ou ses contrôles
      if (!e.target.closest('.template-image-container')) {
        document.querySelectorAll('.template-image-container.selected').forEach(container => {
          this.deselectImage(container);
        });
      }
    };
    
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
    
    // Le scroll est maintenant géré par le container parent (.template-builder-center)
    // S'assurer que le padding-top reste visible lors du scroll
    const scrollContainer = this.editorElement.closest('.template-builder-center');
    if (scrollContainer) {
      // Observer les changements de scroll pour s'assurer que le padding-top reste visible
      scrollContainer.addEventListener('scroll', () => {
        const computedStyle = window.getComputedStyle(this.editorElement);
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const editorRect = this.editorElement.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        
        // Si le padding-top est scrollé hors de la vue, le remettre en place
        if (scrollContainer.scrollTop > 0 && editorRect.top < containerRect.top + paddingTop) {
          // Le padding-top est visible, pas besoin d'ajustement
        }
      });
    }
    
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
          const paddingTopValue = `calc(${topValue}${topUnit} * var(--scale-ratio, ${scaleRatio}))`;
          this.editorElement.style.paddingTop = paddingTopValue;
          // S'assurer que le container parent respecte aussi le padding-top
          const scrollContainer = this.editorElement.closest('.template-builder-center');
          if (scrollContainer) {
            // Le padding-top doit être visible, donc on ne l'applique pas au container
            // mais on s'assure que le scroll commence bien après le padding
          }
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
    
    // Calculer la hauteur de page en fonction de la largeur de l'éditeur
    // Formule : hauteur = (largeur_éditeur / largeur_format_cm) * hauteur_format_cm
    // Exemple A4 portrait : si largeur = 600px, hauteur = 600 / 21 * 29.7
    const editorRect = this.editorElement.getBoundingClientRect();
    const editorWidth = editorRect.width;
    const pageWidthCm = orientation === 'portrait' ? size.width : size.height;
    const pageHeightCm = orientation === 'portrait' ? size.height : size.width;
    
    // Calculer la hauteur de page directement avec le ratio
    const pageHeightPx = (editorWidth / pageWidthCm) * pageHeightCm;
    
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
        // Footer réduit à une ligne minimum (hauteur de ligne)
        const lineHeight = parseFloat(getComputedStyle(this.editorElement).lineHeight) || 19.2;
        const footerHeight = marginBottom + lineHeight; // Une ligne minimum
        
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
    
    // Calculer la hauteur de page en fonction de la largeur de l'éditeur
    // Formule : hauteur = (largeur_éditeur / largeur_format_cm) * hauteur_format_cm
    // Exemple A4 portrait : si largeur = 600px, hauteur = 600 / 21 * 29.7
    const editorRect = this.editorElement.getBoundingClientRect();
    const editorWidth = editorRect.width;
    const pageWidthCm = orientation === 'portrait' ? size.width : size.height;
    const pageHeightCm = orientation === 'portrait' ? size.height : size.width;
    
    // Calculer la hauteur de page directement avec le ratio
    const pageHeightPx = (editorWidth / pageWidthCm) * pageHeightCm;
    
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
        
        // Ne pas scroller automatiquement pour éviter les sauts désagréables
        // Le scroll se fera naturellement si nécessaire
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
  
  maintainScrollAtBottom() {
    // Détecter si on est sur la dernière ligne et maintenir le scroll en bas
    if (!this.editorElement) return;
    
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    let element = range.startContainer;
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement;
    }
    
    // Trouver le paragraphe parent
    while (element && element !== this.editorElement) {
      if (element.tagName === 'P' || 
          element.classList.contains('doc-title-level-1') || 
          element.classList.contains('doc-title-level-2') || 
          element.classList.contains('doc-title-level-3')) {
        break;
      }
      element = element.parentElement;
    }
    
    if (!element || element === this.editorElement) return;
    
    // Vérifier si c'est le dernier élément éditable
    const allElements = Array.from(this.editorElement.querySelectorAll('p, div.doc-title-level-1, div.doc-title-level-2, div.doc-title-level-3'))
      .filter(el => !el.classList.contains('margin-spacer-footer') && !el.classList.contains('margin-spacer-header'));
    
    const lastElement = allElements[allElements.length - 1];
    
    // Si on est sur le dernier élément, maintenir le scroll en bas
    if (lastElement && (element === lastElement || element.contains(lastElement) || lastElement.contains(element))) {
      // Le container parent qui gère le scroll (template-builder-center)
      const scrollContainer = this.editorElement.closest('.template-builder-center');
      if (scrollContainer) {
        // Attendre que le DOM soit mis à jour
        setTimeout(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }, 10);
      }
    }
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
    if (!this.editorElement || !this.template) return;
    
    // Si le template a un contenu HTML sauvegardé, l'utiliser au lieu de régénérer depuis la structure
    // Cela préserve les images et autres éléments HTML complexes qui ne sont pas dans la structure JSON
    if (this.template.content && this.template.content.trim()) {
      console.log('📄 Utilisation du contenu HTML sauvegardé au lieu de régénérer depuis la structure');
      this.setContent(this.template.content);
      return;
    }
    
    // Sinon, régénérer depuis la structure JSON (comportement par défaut)
    if (!this.template.structure) return;
    
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
    
    // Gérer l'alignement des images
    if (['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'].includes(command)) {
      const selectedImage = document.querySelector('.template-image-container.selected');
      if (selectedImage) {
        const wrapper = selectedImage.closest('.image-container-wrapper');
        if (wrapper) {
          if (command === 'justifyLeft') {
            wrapper.style.textAlign = 'left';
          } else if (command === 'justifyCenter') {
            wrapper.style.textAlign = 'center';
          } else if (command === 'justifyRight') {
            wrapper.style.textAlign = 'right';
          } else if (command === 'justifyFull') {
            wrapper.style.textAlign = 'justify';
          }
          this.handleContentChange();
          return;
        }
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
    } else if (command === 'insertImage') {
      // Gérer l'insertion d'image
      console.log('🖼️ Commande insertImage appelée');
      this.insertImage();
    } else {
      // Exécuter la commande normale (seulement si on n'a pas déjà géré le cas du paragraphe)
      if (!(command === 'formatBlock' && value && value.toLowerCase() === 'p' && titleElementBefore && sectionIdBefore)) {
        document.execCommand(command, false, value);
        this.handleContentChange();
      }
    }
  }

  /**
   * Insère une image dans un nouveau paragraphe après le paragraphe actuel
   */
  insertImage(imageData = null) {
    console.log('🖼️ insertImage appelé, imageData:', imageData);
    if (!this.editorElement) {
      console.error('❌ editorElement non disponible');
      return;
    }

    const selection = window.getSelection();
    if (selection.rangeCount === 0) {
      console.error('❌ Aucune sélection disponible');
      return;
    }

    const range = selection.getRangeAt(0);
    
    // Trouver le paragraphe actuel
    let currentParagraph = range.commonAncestorContainer;
    if (currentParagraph.nodeType === Node.TEXT_NODE) {
      currentParagraph = currentParagraph.parentElement;
    }
    
    // Remonter jusqu'à trouver un paragraphe ou un titre
    while (currentParagraph && currentParagraph !== this.editorElement) {
      const tagName = currentParagraph.tagName ? currentParagraph.tagName.toLowerCase() : '';
      if (tagName === 'p' || tagName === 'div' || ['h1', 'h2', 'h3'].includes(tagName)) {
        break;
      }
      currentParagraph = currentParagraph.parentElement;
    }

    // Créer un nouveau div pour l'image (pas un <p> car il contient des <div>)
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'image-container-wrapper';
    
    // Créer le conteneur d'image redimensionnable
    const imageContainer = document.createElement('div');
    imageContainer.className = 'template-image-container';
    imageContainer.contentEditable = false;
    
    // Si on a des données d'image, les utiliser, sinon créer un placeholder
    if (imageData) {
      this.createImageElement(imageContainer, imageData);
      imageWrapper.appendChild(imageContainer);
    } else {
      // Créer un placeholder redimensionnable
      const placeholder = this.createImagePlaceholder(imageContainer);
      imageContainer.appendChild(placeholder);
      imageWrapper.appendChild(imageContainer);
      
      // Ajouter le bouton de suppression DANS le placeholder (position absolute)
      const deleteButton = document.createElement('button');
      deleteButton.className = 'image-delete-button';
      deleteButton.innerHTML = '×';
      deleteButton.title = 'Supprimer l\'image';
      deleteButton.onclick = (e) => {
        e.stopPropagation();
        if (confirm('Supprimer cette image ?')) {
          imageContainer.closest('.image-container-wrapper')?.remove();
          this.handleContentChange();
        }
      };
      placeholder.appendChild(deleteButton);
      
      // Au clic sur le placeholder : sélectionner avec poignées (pas de modal)
      // Le modal s'ouvrira via le groupe "Image" dans FormatTab
      imageContainer.onclick = (e) => {
        e.stopPropagation();
        this.selectImage(imageContainer);
      };
      
      // Rendre le conteneur redimensionnable même sans image
      this.makeImageResizable(imageContainer);
    }
    
    // Insérer le wrapper après le paragraphe actuel
    if (currentParagraph && currentParagraph.nextSibling) {
      currentParagraph.parentNode.insertBefore(imageWrapper, currentParagraph.nextSibling);
    } else if (currentParagraph) {
      currentParagraph.parentNode.appendChild(imageWrapper);
    } else {
      this.editorElement.appendChild(imageWrapper);
    }
    
    // Mettre le focus après l'image
    const newRange = document.createRange();
    newRange.setStartAfter(imageWrapper);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
    
    this.handleContentChange();
  }

  /**
   * Crée un placeholder pour l'image (zone cliquable redimensionnable)
   */
  createImagePlaceholder(container) {
    const placeholder = document.createElement('div');
    placeholder.className = 'image-placeholder';
    placeholder.style.width = '300px';
    placeholder.style.height = '200px';
    placeholder.style.border = '2px dashed var(--color-light, #ddd)';
    placeholder.style.borderRadius = 'var(--border-radius, 4px)';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.background = 'var(--color-primary-light, #f0f7ff)';
    placeholder.style.cursor = 'pointer';
    placeholder.style.position = 'relative';
    placeholder.style.margin = '0 auto';
    
    const icon = document.createElement('div');
    icon.innerHTML = '🖼️';
    icon.style.fontSize = '48px';
    icon.style.opacity = '0.5';
    
    const text = document.createElement('div');
    text.textContent = 'Cliquez pour insérer une image';
    text.style.marginTop = 'var(--spacing-sm, 8px)';
    text.style.fontSize = 'var(--font-size-small, 14px)';
    text.style.color = 'var(--color-gray, #666)';
    
    const content = document.createElement('div');
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.alignItems = 'center';
    content.appendChild(icon);
    content.appendChild(text);
    
    placeholder.appendChild(content);
    
    // Rendre le placeholder redimensionnable
    container.style.position = 'relative';
    container.style.display = 'inline-block';
    container.style.minWidth = '100px';
    container.style.minHeight = '100px';
    
    return placeholder;
  }

  /**
   * Crée l'élément image dans le conteneur
   */
  createImageElement(container, imageData) {
    container.innerHTML = '';
    
    // Image
    const img = document.createElement('img');
    img.className = 'template-image';
    img.draggable = false;
    
    container.appendChild(img);
    
    // Bouton supprimer DANS le conteneur (position absolute)
    const deleteButton = document.createElement('button');
    deleteButton.className = 'image-delete-button';
    deleteButton.innerHTML = '×';
    deleteButton.title = 'Supprimer l\'image';
    deleteButton.onclick = (e) => {
      e.stopPropagation();
      if (confirm('Supprimer cette image ?')) {
        container.closest('.image-container-wrapper')?.remove();
        this.handleContentChange();
      }
    };
    container.appendChild(deleteButton);
    
    // Définir la source de l'image
    if (imageData.type === 'variable') {
      // Variable de collection ou template
      img.dataset.imageType = 'variable';
      img.dataset.variablePath = imageData.variablePath;
      img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj57e3t2YXJpYWJsZX19fTwvdGV4dD48L3N2Zz4=';
      img.alt = `{{${imageData.variablePath}}}`;
    } else if (imageData.type === 'upload') {
      // Image uploadée
      img.dataset.imageType = 'upload';
      img.dataset.imageId = imageData.imageId;
      img.src = imageData.url || imageData.src;
      img.alt = imageData.alt || 'Image';
    }
    
    // Appliquer les dimensions si fournies
    if (imageData.width) {
      img.style.width = imageData.width;
      container.dataset.imageWidth = imageData.width;
    }
    if (imageData.height) {
      img.style.height = imageData.height;
      container.dataset.imageHeight = imageData.height;
    }
    
    // Appliquer le style d'image si fourni
    if (imageData.styleName) {
      container.dataset.imageStyle = imageData.styleName;
      this.applyImageStyle(container, imageData.styleName);
    }
    
    // Gérer le crop si fourni
    if (imageData.crop) {
      container.dataset.crop = JSON.stringify(imageData.crop);
    }
    
    // Stocker les données de l'image dans le conteneur
    container._imageData = imageData;
    
    // Double-clic pour éditer (seulement si l'image est chargée)
    container.ondblclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Vérifier que l'image est chargée (pas un placeholder)
      const imgElement = container.querySelector('img.template-image');
      if (imgElement && imgElement.src && !imgElement.src.includes('data:image/svg+xml')) {
        this.showImageEditModal(container, imageData);
      }
    };
    
    // Rendre l'image redimensionnable
    this.makeImageResizable(container);
  }

  /**
   * Affiche le modal de sélection de source d'image
   */
  showImageSourceModal(onSelect) {
    console.log('🖼️ showImageSourceModal appelé');
    // Créer le modal
    const modal = document.createElement('div');
    modal.className = 'image-source-modal';
    // Forcer les styles inline pour garantir l'affichage
    modal.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: rgba(0, 0, 0, 0.5) !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 999999 !important; width: 100vw !important; height: 100vh !important;';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'image-source-modal-content';
    
    const title = document.createElement('h3');
    title.textContent = 'Sélectionner la source de l\'image';
    modalContent.appendChild(title);

    // Onglets pour les différents types de sources
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'image-source-tabs';
    
    const uploadTab = document.createElement('button');
    uploadTab.className = 'image-source-tab active';
    uploadTab.textContent = 'Upload';
    uploadTab.onclick = () => this.switchImageSourceTab(modalContent, 'upload', onSelect);
    
    const variableTab = document.createElement('button');
    variableTab.className = 'image-source-tab';
    variableTab.textContent = 'Variable';
    variableTab.onclick = () => this.switchImageSourceTab(modalContent, 'variable', onSelect);
    
    tabsContainer.appendChild(uploadTab);
    tabsContainer.appendChild(variableTab);
    modalContent.appendChild(tabsContainer);

    // Contenu des onglets
    const contentArea = document.createElement('div');
    contentArea.className = 'image-source-content';
    modalContent.appendChild(contentArea);

    // Afficher l'onglet upload par défaut
    this.switchImageSourceTab(modalContent, 'upload', onSelect);

    // Boutons
    const buttons = document.createElement('div');
    buttons.className = 'image-source-modal-buttons';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Annuler';
    cancelButton.onclick = () => document.body.removeChild(modal);
    buttons.appendChild(cancelButton);
    
    modalContent.appendChild(buttons);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    console.log('✅ Modal ajouté au DOM');

    // Fermer le modal en cliquant à l'extérieur
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };
  }

  switchImageSourceTab(modalContent, tabName, onSelect) {
    const tabs = modalContent.querySelectorAll('.image-source-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    const contentArea = modalContent.querySelector('.image-source-content');
    contentArea.innerHTML = '';

    if (tabName === 'upload') {
      tabs[0].classList.add('active');
      
      const uploadArea = document.createElement('div');
      uploadArea.className = 'image-source-upload-area';
      
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.id = 'image-upload-input';
      
      const uploadButton = document.createElement('button');
      uploadButton.className = 'image-source-upload-button';
      uploadButton.textContent = 'Choisir un fichier';
      uploadButton.onclick = () => input.click();
      
      const dragArea = document.createElement('div');
      dragArea.className = 'image-source-drag-area';
      dragArea.innerHTML = '<p>Glissez-déposez une image ici</p><p>ou</p>';
      dragArea.appendChild(uploadButton);
      
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          const imageData = await this.uploadImage(file);
          if (imageData) {
            const modal = modalContent.closest('.image-source-modal');
            if (modal) document.body.removeChild(modal);
            onSelect(imageData);
          }
        }
      };

      // Drag & drop
      dragArea.ondragover = (e) => {
        e.preventDefault();
        dragArea.classList.add('dragover');
      };
      dragArea.ondragleave = () => {
        dragArea.classList.remove('dragover');
      };
      dragArea.ondrop = async (e) => {
        e.preventDefault();
        dragArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          const imageData = await this.uploadImage(file);
          if (imageData) {
            const modal = modalContent.closest('.image-source-modal');
            if (modal) document.body.removeChild(modal);
            onSelect(imageData);
          }
        }
      };

      uploadArea.appendChild(input);
      uploadArea.appendChild(dragArea);
      contentArea.appendChild(uploadArea);
      
    } else if (tabName === 'variable') {
      tabs[1].classList.add('active');
      
      // Variables de collection
      const collectionsGroup = document.createElement('div');
      collectionsGroup.className = 'image-source-variables-group';
      
      const collectionsLabel = document.createElement('label');
      collectionsLabel.textContent = 'Variable de collection';
      collectionsLabel.className = 'image-source-label';
      collectionsGroup.appendChild(collectionsLabel);
      
      const collectionsSelect = document.createElement('select');
      collectionsSelect.className = 'image-source-select';
      collectionsSelect.innerHTML = '<option value="">-- Sélectionner --</option>';
      
      // Récupérer les collections du template
      const collections = [];
      if (this.template?.defaultCollection) {
        collections.push({
          alias: this.template.defaultCollection.alias,
          collectionId: this.template.defaultCollection.collectionId,
          fields: this.template.defaultCollection.fields || []
        });
      }
      if (this.template?.additionalCollections) {
        this.template.additionalCollections.forEach(col => {
          collections.push({
            alias: col.alias,
            collectionId: col.collectionId,
            fields: col.fields || []
          });
        });
      }
      
      // Récupérer les champs de type image
      collections.forEach(collection => {
        const imageFields = collection.fields.filter(f => f.type === 'image' || f.uiType === 'Image');
        if (imageFields.length > 0) {
          const optgroup = document.createElement('optgroup');
          optgroup.label = collection.alias;
          imageFields.forEach(field => {
            const option = document.createElement('option');
            option.value = `${collection.alias}.${field.name}`;
            option.textContent = `${collection.alias}.${field.name}`;
            optgroup.appendChild(option);
          });
          collectionsSelect.appendChild(optgroup);
        }
      });
      
      collectionsGroup.appendChild(collectionsSelect);
      contentArea.appendChild(collectionsGroup);

      // Variables de template (images fixes)
      const templateGroup = document.createElement('div');
      templateGroup.className = 'image-source-variables-group';
      
      const templateLabel = document.createElement('label');
      templateLabel.textContent = 'Image du template';
      templateLabel.className = 'image-source-label';
      templateGroup.appendChild(templateLabel);
      
      const templateSelect = document.createElement('select');
      templateSelect.className = 'image-source-select';
      templateSelect.innerHTML = '<option value="">-- Sélectionner --</option>';
      
      // Récupérer les images du template
      if (this.template?.images && this.template.images.length > 0) {
        this.template.images.forEach((img, index) => {
          const option = document.createElement('option');
          option.value = `template.image_${index}`;
          option.textContent = img.originalName || img.fileName || `Image ${index + 1}`;
          templateSelect.appendChild(option);
        });
      }
      
      templateGroup.appendChild(templateSelect);
      contentArea.appendChild(templateGroup);

      // Bouton valider
      const validateButton = document.createElement('button');
      validateButton.className = 'image-source-validate-button';
      validateButton.textContent = 'Utiliser cette variable';
      validateButton.onclick = () => {
        const selectedCollection = collectionsSelect.value;
        const selectedTemplate = templateSelect.value;
        
        if (selectedCollection) {
          const modal = modalContent.closest('.image-source-modal');
          if (modal) document.body.removeChild(modal);
          onSelect({
            type: 'variable',
            variablePath: selectedCollection
          });
        } else if (selectedTemplate) {
          const imageIndex = parseInt(selectedTemplate.match(/\d+/)?.[0] || '0');
          const image = this.template.images[imageIndex];
          if (image) {
            const modal = modalContent.closest('.image-source-modal');
            if (modal) document.body.removeChild(modal);
            onSelect({
              type: 'template',
              imageId: image.id,
              url: image.url,
              fileName: image.fileName
            });
          }
        } else {
          alert('Veuillez sélectionner une variable');
        }
      };
      
      contentArea.appendChild(validateButton);
    }
  }

  /**
   * Prépare une image pour l'upload (stocke le fichier et retourne une URL temporaire)
   */
  prepareImageUpload(file) {
    // Créer une URL temporaire pour afficher l'image immédiatement
    const tempUrl = URL.createObjectURL(file);
    
    return {
      type: 'upload',
      tempUrl: tempUrl,
      file: file,
      fileName: file.name,
      width: null,
      height: null,
      pendingUpload: true // Flag pour indiquer que l'upload est en attente
    };
  }

  /**
   * Upload une image vers le backend (appelé lors de la sauvegarde)
   */
  async uploadImage(file) {
    if (!this.template || !this.template._id) {
      throw new Error('Template non sauvegardé. Veuillez d\'abord sauvegarder le template.');
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      const apiBase = window.API_BASE_URL || '/api';
      const response = await fetch(`${apiBase}/doc-template/templates/${this.template._id}/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: formData
      });

      // Vérifier si la réponse est OK
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = `Erreur ${response.status}: ${response.statusText}`;
        
        // Essayer de parser le JSON si possible
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            // Si le parsing JSON échoue, on garde le message d'erreur par défaut
          }
        } else {
          // Si ce n'est pas du JSON, essayer de lire le texte
          try {
            const text = await response.text();
            if (text) {
              errorMessage = text.substring(0, 200); // Limiter la longueur
            }
          } catch (e) {
            // Ignorer les erreurs de lecture
          }
        }
        
        throw new Error(errorMessage);
      }

      // Parser la réponse JSON
      let result;
      try {
        result = await response.json();
      } catch (e) {
        throw new Error('Réponse invalide du serveur (pas de JSON)');
      }

      if (result.success) {
        return {
          type: 'upload',
          imageId: result.data.id,
          url: result.data.url,
          fileName: result.data.fileName,
          width: null,
          height: null
        };
      } else {
        throw new Error(result.error || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('Erreur upload image:', error);
      throw error;
    }
  }

  /**
   * Collecte toutes les images en attente d'upload dans l'éditeur
   */
  getPendingImageUploads() {
    const pending = [];
    const images = this.editorElement.querySelectorAll('img[data-pending-upload="true"]');
    
    images.forEach(img => {
      const uploadData = this.pendingImageUploads.get(img);
      if (uploadData && uploadData.file) {
        pending.push({
          img: img,
          file: uploadData.file
        });
      }
    });
    
    return pending;
  }

  /**
   * Met à jour une image après l'upload réussi
   */
  updateImageAfterUpload(img, imageData) {
    // Remplacer l'URL temporaire par l'URL réelle via l'API
    const apiBase = window.API_BASE_URL || '';
    const imageUrl = imageData.url.startsWith('/') ? imageData.url : `${apiBase}${imageData.url}`;
    img.src = imageUrl;
    img.dataset.imageType = 'upload';
    img.dataset.imageId = imageData.imageId;
    img.removeAttribute('data-pending-upload');
    
    // Nettoyer l'URL temporaire
    const uploadData = this.pendingImageUploads.get(img);
    if (uploadData && uploadData.tempUrl) {
      URL.revokeObjectURL(uploadData.tempUrl);
    }
    
    // Retirer de la liste des uploads en attente
    this.pendingImageUploads.delete(img);
    
    // Déclencher un changement de contenu pour sauvegarder la nouvelle URL
    this.handleContentChange();
  }

  /**
   * Applique un style d'image au conteneur
   */
  applyImageStyle(container, styleName) {
    // Récupérer les styles depuis le template
    const imageStyles = this.template?.imageStyles || [];
    const style = imageStyles.find(s => s.name === styleName);
    
    const img = container.querySelector('img');
    const placeholder = container.querySelector('.image-placeholder');
    const targetElement = img || placeholder;
    
    if (style && targetElement) {
      // Réinitialiser les styles d'abord
      targetElement.style.borderRadius = '';
      targetElement.style.boxShadow = '';
      targetElement.style.border = '';
      targetElement.style.opacity = '';
      
      if (style.borderRadius && style.borderRadius !== '0' && style.borderRadius !== 'none') {
        targetElement.style.borderRadius = style.borderRadius;
      }
      if (style.boxShadow && style.boxShadow !== 'none') {
        targetElement.style.boxShadow = style.boxShadow;
      }
      if (style.border && style.border !== 'none') {
        targetElement.style.border = style.border;
      }
      if (style.opacity !== undefined) {
        targetElement.style.opacity = style.opacity;
      }
      
      // Sauvegarder le nom du style dans le dataset
      container.dataset.imageStyle = styleName;
    } else if (!styleName) {
      // Si aucun style, réinitialiser
      if (targetElement) {
        targetElement.style.borderRadius = '';
        targetElement.style.boxShadow = '';
        targetElement.style.border = '';
        targetElement.style.opacity = '';
        delete container.dataset.imageStyle;
      }
    }
  }

  /**
   * Applique un style d'image à l'image sélectionnée
   */
  applyImageStyleToSelected(styleName) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    let element = range.commonAncestorContainer;
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement;
    }
    
    const imageContainer = element.closest('.template-image-container');
    if (imageContainer) {
      this.applyImageStyle(imageContainer, styleName);
      this.handleContentChange();
    }
  }

  /**
   * Rend une image redimensionnable
   */
  makeImageResizable(container) {
    container.style.position = 'relative';
    container.style.display = 'inline-block';
    
    // Stocker l'état des cadenas
    container.dataset.lockWidth = 'false';
    container.dataset.lockHeight = 'false';
    
    // Gérer le clic sur le conteneur (image ou placeholder)
    const img = container.querySelector('img');
    const placeholder = container.querySelector('.image-placeholder');
    
    // Si c'est une image, gérer le clic sur l'image
    if (img) {
      img.onclick = (e) => {
        e.stopPropagation();
        // Sélectionner l'image
        this.selectImage(container);
      };
    }
    
    // Si c'est un placeholder, le clic est déjà géré dans insertImage
    // Mais on s'assure qu'il n'y a pas de modal qui s'ouvre
    if (placeholder) {
      placeholder.onclick = (e) => {
        e.stopPropagation();
        // Sélectionner le conteneur (pas ouvrir de modal)
        this.selectImage(container);
      };
    }
  }

  /**
   * Sélectionne une image (pour afficher les contrôles)
   */
  selectImage(container) {
    // Retirer la sélection précédente
    document.querySelectorAll('.template-image-container.selected').forEach(el => {
      el.classList.remove('selected');
      this.removeResizeHandles(el);
      this.removeLockButtons(el);
    });
    
    // Sélectionner cette image
    container.classList.add('selected');
    
    // Ajouter les poignées de redimensionnement
    this.addResizeHandles(container);
    
    // Ajouter les cadenas
    this.addLockButtons(container);
    
    // Notifier FormatTab qu'une image est sélectionnée
    if (this.onImageSelected) {
      this.onImageSelected(container);
    }
  }

  /**
   * Retire la sélection d'une image
   */
  deselectImage(container) {
    container.classList.remove('selected');
    this.removeResizeHandles(container);
    this.removeLockButtons(container);
    
    // Notifier FormatTab qu'aucune image n'est sélectionnée
    if (this.onImageDeselected) {
      this.onImageDeselected();
    }
  }

  /**
   * Ajoute les poignées de redimensionnement (8 poignées)
   */
  addResizeHandles(container) {
    // Vérifier si les poignées existent déjà
    if (container.querySelector('.resize-handle')) return;
    
    // Vérifier qu'il y a soit une image soit un placeholder
    const img = container.querySelector('img');
    const placeholder = container.querySelector('.image-placeholder');
    if (!img && !placeholder) return;
    
    const positions = [
      { name: 'nw', top: '0%', left: '0%', cursor: 'nw-resize' }, // Nord-ouest
      { name: 'n', top: '0%', left: '50%', cursor: 'n-resize' },  // Nord
      { name: 'ne', top: '0%', left: '100%', cursor: 'ne-resize' }, // Nord-est
      { name: 'e', top: '50%', left: '100%', cursor: 'e-resize' },  // Est
      { name: 'se', top: '100%', left: '100%', cursor: 'se-resize' }, // Sud-est
      { name: 's', top: '100%', left: '50%', cursor: 's-resize' },  // Sud
      { name: 'sw', top: '100%', left: '0%', cursor: 'sw-resize' }, // Sud-ouest
      { name: 'w', top: '50%', left: '0%', cursor: 'w-resize' }    // Ouest
    ];
    
    positions.forEach(pos => {
      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      handle.dataset.position = pos.name;
      handle.style.cssText = `
        position: absolute;
        top: ${pos.top};
        left: ${pos.left};
        transform: translate(-50%, -50%);
        width: 12px;
        height: 12px;
        background: var(--color-primary, #0055AA);
        border: 2px solid var(--color-white, #fff);
        border-radius: 50%;
        cursor: ${pos.cursor};
        z-index: 1000;
        pointer-events: all;
      `;
      
      // Gestion du redimensionnement
      handle.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.startResize(container, pos.name, e);
      };
      
      container.appendChild(handle);
    });
  }

  /**
   * Retire les poignées de redimensionnement
   */
  removeResizeHandles(container) {
    container.querySelectorAll('.resize-handle').forEach(handle => {
      handle.remove();
    });
  }

  /**
   * Ajoute les boutons de verrouillage (cadenas)
   */
  addLockButtons(container) {
    // Vérifier si les cadenas existent déjà
    if (container.querySelector('.lock-button')) return;
    
    // Trouver l'élément cible (image ou placeholder)
    const img = container.querySelector('img');
    const placeholder = container.querySelector('.image-placeholder');
    const targetElement = img || placeholder;
    
    if (!targetElement) return;
    
    // S'assurer que l'élément cible a position relative
    const computedStyle = window.getComputedStyle(targetElement);
    if (computedStyle.position === 'static') {
      targetElement.style.position = 'relative';
    }
    
    // Cadenas largeur (sur le côté gauche, au milieu verticalement)
    const lockWidthBtn = document.createElement('button');
    lockWidthBtn.className = 'lock-button lock-width';
    lockWidthBtn.innerHTML = '🔓';
    lockWidthBtn.title = 'Verrouiller la largeur';
    lockWidthBtn.style.cssText = `
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      z-index: 1001;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid var(--color-light, #ddd);
      cursor: pointer;
      font-size: 16px;
      padding: 4px 6px;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: all var(--transition-fast);
    `;
    lockWidthBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleLock(container, 'width');
    };
    lockWidthBtn.onmouseenter = () => {
      lockWidthBtn.style.transform = 'translateY(-50%) scale(1.15)';
      lockWidthBtn.style.background = 'rgba(255, 255, 255, 1)';
    };
    lockWidthBtn.onmouseleave = () => {
      lockWidthBtn.style.transform = 'translateY(-50%) scale(1)';
      lockWidthBtn.style.background = 'rgba(255, 255, 255, 0.9)';
    };
    
    // Cadenas hauteur (en haut, au milieu horizontalement)
    const lockHeightBtn = document.createElement('button');
    lockHeightBtn.className = 'lock-button lock-height';
    lockHeightBtn.innerHTML = '🔓';
    lockHeightBtn.title = 'Verrouiller la hauteur';
    lockHeightBtn.style.cssText = `
      position: absolute;
      left: 50%;
      top: 0;
      transform: translateX(-50%);
      z-index: 1001;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid var(--color-light, #ddd);
      cursor: pointer;
      font-size: 16px;
      padding: 4px 6px;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: all var(--transition-fast);
    `;
    lockHeightBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleLock(container, 'height');
    };
    lockHeightBtn.onmouseenter = () => {
      lockHeightBtn.style.transform = 'translateX(-50%) scale(1.15)';
      lockHeightBtn.style.background = 'rgba(255, 255, 255, 1)';
    };
    lockHeightBtn.onmouseleave = () => {
      lockHeightBtn.style.transform = 'translateX(-50%) scale(1)';
      lockHeightBtn.style.background = 'rgba(255, 255, 255, 0.9)';
    };
    
    // Ajouter les cadenas à l'élément cible (image ou placeholder)
    targetElement.appendChild(lockWidthBtn);
    targetElement.appendChild(lockHeightBtn);
    
    // Stocker les références
    container._lockWidthBtn = lockWidthBtn;
    container._lockHeightBtn = lockHeightBtn;
    container._lockTargetElement = targetElement;
  }

  /**
   * Retire les boutons de verrouillage
   */
  removeLockButtons(container) {
    // Retirer depuis l'élément cible (image ou placeholder) ou depuis le container
    const targetElement = container._lockTargetElement || container;
    const lockWidthBtn = targetElement.querySelector('.lock-button.lock-width') || container.querySelector('.lock-button.lock-width');
    const lockHeightBtn = targetElement.querySelector('.lock-button.lock-height') || container.querySelector('.lock-button.lock-height');
    if (lockWidthBtn) lockWidthBtn.remove();
    if (lockHeightBtn) lockHeightBtn.remove();
    container._lockWidthBtn = null;
    container._lockHeightBtn = null;
    container._lockTargetElement = null;
  }

  /**
   * Bascule le verrouillage (largeur ou hauteur)
   */
  toggleLock(container, type) {
    const lockWidth = container.dataset.lockWidth === 'true';
    const lockHeight = container.dataset.lockHeight === 'true';
    
    if (type === 'width') {
      // Si on verrouille la largeur, déverrouiller la hauteur
      if (lockWidth) {
        container.dataset.lockWidth = 'false';
        container._lockWidthBtn.innerHTML = '🔓';
        container._lockWidthBtn.title = 'Verrouiller la largeur';
      } else {
        container.dataset.lockWidth = 'true';
        container.dataset.lockHeight = 'false';
        container._lockWidthBtn.innerHTML = '🔒';
        container._lockWidthBtn.title = 'Déverrouiller la largeur';
        // Déverrouiller l'autre
        container._lockHeightBtn.innerHTML = '🔓';
        container._lockHeightBtn.title = 'Verrouiller la hauteur';
      }
    } else if (type === 'height') {
      // Si on verrouille la hauteur, déverrouiller la largeur
      if (lockHeight) {
        container.dataset.lockHeight = 'false';
        container._lockHeightBtn.innerHTML = '🔓';
        container._lockHeightBtn.title = 'Verrouiller la hauteur';
      } else {
        container.dataset.lockHeight = 'true';
        container.dataset.lockWidth = 'false';
        container._lockHeightBtn.innerHTML = '🔒';
        container._lockHeightBtn.title = 'Déverrouiller la hauteur';
        // Déverrouiller l'autre
        container._lockWidthBtn.innerHTML = '🔓';
        container._lockWidthBtn.title = 'Verrouiller la largeur';
      }
    }
  }

  /**
   * Démarre le redimensionnement
   */
  startResize(container, position, e) {
    const img = container.querySelector('img');
    const placeholder = container.querySelector('.image-placeholder');
    
    // Si ni image ni placeholder, on ne peut pas redimensionner
    if (!img && !placeholder) return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = container.offsetWidth;
    const startHeight = container.offsetHeight;
    const startRatio = startWidth / startHeight;
    const lockWidth = container.dataset.lockWidth === 'true';
    const lockHeight = container.dataset.lockHeight === 'true';
    
    // Calculer le ratio original
    let originalRatio = startRatio;
    if (img && img.src) {
      const originalImg = new Image();
      originalImg.src = img.src;
      const originalWidth = originalImg.width || img.naturalWidth || startWidth;
      const originalHeight = originalImg.height || img.naturalHeight || startHeight;
      if (originalWidth > 0 && originalHeight > 0) {
        originalRatio = originalWidth / originalHeight;
      }
    }
    
    const onMouseMove = (e) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      
      // Calculer les nouvelles dimensions selon la position de la poignée
      if (position.includes('e')) newWidth = startWidth + deltaX;
      if (position.includes('w')) newWidth = startWidth - deltaX;
      if (position.includes('s')) newHeight = startHeight + deltaY;
      if (position.includes('n')) newHeight = startHeight - deltaY;
      
      // Appliquer les verrous
      if (lockWidth) {
        // Largeur verrouillée : garder la largeur, ajuster la hauteur proportionnellement
        newHeight = newWidth / originalRatio;
      } else if (lockHeight) {
        // Hauteur verrouillée : garder la hauteur, ajuster la largeur proportionnellement
        newWidth = newHeight * originalRatio;
      } else {
        // Aucun verrou : garder le ratio original
        const currentRatio = newWidth / newHeight;
        if (Math.abs(currentRatio - originalRatio) > 0.01) {
          // Ajuster pour maintenir le ratio
          if (position.includes('e') || position.includes('w')) {
            newHeight = newWidth / originalRatio;
          } else {
            newWidth = newHeight * originalRatio;
          }
        }
      }
      
      // Limites minimales
      newWidth = Math.max(50, newWidth);
      newHeight = Math.max(50, newHeight);
      
      // Appliquer les nouvelles dimensions
      container.style.width = newWidth + 'px';
      container.style.height = newHeight + 'px';
      
      // Si c'est une image, ajuster ses dimensions
      if (img) {
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
      }
      
      // Si c'est un placeholder, ajuster ses dimensions
      if (placeholder) {
        placeholder.style.width = '100%';
        placeholder.style.height = '100%';
      }
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.handleContentChange();
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Affiche le modal d'édition d'image (rogner, rotation, suppression de fond)
   */
  showImageEditModal(container, imageData) {
    const img = container.querySelector('img');
    if (!img) return;
    
    // Créer le modal
    const modal = document.createElement('div');
    modal.className = 'image-edit-modal';
    modal.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: rgba(0, 0, 0, 0.7) !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 999999 !important;';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'image-edit-modal-content';
    modalContent.style.cssText = 'background: var(--color-white, #fff); padding: var(--spacing-lg, 24px); border-radius: var(--border-radius-lg, 8px); max-width: 90vw; max-height: 90vh; overflow: auto; position: relative;';
    
    const title = document.createElement('h3');
    title.textContent = 'Éditer l\'image';
    title.style.cssText = 'margin-top: 0; margin-bottom: var(--spacing-md, 16px);';
    modalContent.appendChild(title);
    
    // Zone de prévisualisation et édition
    const previewContainer = document.createElement('div');
    previewContainer.className = 'image-edit-preview';
    previewContainer.style.cssText = 'position: relative; margin-bottom: var(--spacing-md, 16px); border: 1px solid var(--color-light, #ddd); border-radius: var(--border-radius, 4px); overflow: hidden; background: #f5f5f5;';
    
    const canvas = document.createElement('canvas');
    canvas.id = 'image-edit-canvas';
    canvas.style.cssText = 'max-width: 100%; display: block;';
    
    // Charger l'image dans le canvas
    const canvasImg = new Image();
    canvasImg.crossOrigin = 'anonymous';
    canvasImg.onload = () => {
      canvas.width = Math.min(canvasImg.width, 800);
      canvas.height = Math.min(canvasImg.height, 600);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(canvasImg, 0, 0, canvas.width, canvas.height);
      
      // Stocker l'image originale pour les transformations
      canvas._originalImage = canvasImg;
      canvas._currentRotation = 0;
      canvas._cropData = null;
    };
    canvasImg.src = img.src;
    
    previewContainer.appendChild(canvas);
    modalContent.appendChild(previewContainer);
    
    // Contrôles d'édition
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'image-edit-controls';
    controlsContainer.style.cssText = 'display: flex; flex-direction: column; gap: var(--spacing-md, 16px);';
    
    // Rotation
    const rotationGroup = document.createElement('div');
    rotationGroup.style.cssText = 'display: flex; align-items: center; gap: var(--spacing-sm, 8px);';
    
    const rotationLabel = document.createElement('label');
    rotationLabel.textContent = 'Rotation:';
    rotationLabel.style.cssText = 'font-weight: 500; min-width: 100px;';
    
    const rotateLeftBtn = document.createElement('button');
    rotateLeftBtn.textContent = '↺ 90°';
    rotateLeftBtn.className = 'image-edit-btn';
    rotateLeftBtn.onclick = () => this.rotateImage(canvas, -90);
    
    const rotateRightBtn = document.createElement('button');
    rotateRightBtn.textContent = '↻ 90°';
    rotateRightBtn.className = 'image-edit-btn';
    rotateRightBtn.onclick = () => this.rotateImage(canvas, 90);
    
    rotationGroup.appendChild(rotationLabel);
    rotationGroup.appendChild(rotateLeftBtn);
    rotationGroup.appendChild(rotateRightBtn);
    controlsContainer.appendChild(rotationGroup);
    
    // Crop
    const cropGroup = document.createElement('div');
    cropGroup.style.cssText = 'display: flex; align-items: center; gap: var(--spacing-sm, 8px);';
    
    const cropLabel = document.createElement('label');
    cropLabel.textContent = 'Rogner:';
    cropLabel.style.cssText = 'font-weight: 500; min-width: 100px;';
    
    const cropBtn = document.createElement('button');
    cropBtn.textContent = 'Sélectionner zone';
    cropBtn.className = 'image-edit-btn';
    cropBtn.onclick = () => this.startCrop(canvas);
    
    const cropApplyBtn = document.createElement('button');
    cropApplyBtn.textContent = 'Appliquer';
    cropApplyBtn.className = 'image-edit-btn';
    cropApplyBtn.style.display = 'none';
    cropApplyBtn.onclick = () => this.applyCrop(canvas);
    
    const cropCancelBtn = document.createElement('button');
    cropCancelBtn.textContent = 'Annuler';
    cropCancelBtn.className = 'image-edit-btn';
    cropCancelBtn.style.display = 'none';
    cropCancelBtn.onclick = () => this.cancelCrop(canvas);
    
    cropGroup.appendChild(cropLabel);
    cropGroup.appendChild(cropBtn);
    cropGroup.appendChild(cropApplyBtn);
    cropGroup.appendChild(cropCancelBtn);
    controlsContainer.appendChild(cropGroup);
    
    // Suppression de fond
    const bgRemovalGroup = document.createElement('div');
    bgRemovalGroup.style.cssText = 'display: flex; align-items: center; gap: var(--spacing-sm, 8px);';
    
    const bgRemovalLabel = document.createElement('label');
    bgRemovalLabel.textContent = 'Fond:';
    bgRemovalLabel.style.cssText = 'font-weight: 500; min-width: 100px;';
    
    const bgRemovalBtn = document.createElement('button');
    bgRemovalBtn.textContent = 'Supprimer le fond';
    bgRemovalBtn.className = 'image-edit-btn';
    bgRemovalBtn.onclick = () => this.removeBackground(canvas);
    
    bgRemovalGroup.appendChild(bgRemovalLabel);
    bgRemovalGroup.appendChild(bgRemovalBtn);
    controlsContainer.appendChild(bgRemovalGroup);
    
    modalContent.appendChild(controlsContainer);
    
    // Boutons d'action
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = 'display: flex; justify-content: flex-end; gap: var(--spacing-sm, 8px); margin-top: var(--spacing-md, 16px);';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Annuler';
    cancelButton.className = 'image-edit-btn';
    cancelButton.onclick = () => document.body.removeChild(modal);
    
    const applyButton = document.createElement('button');
    applyButton.textContent = 'Appliquer';
    applyButton.className = 'image-edit-btn';
    applyButton.style.cssText = 'background: var(--color-primary, #0055AA); color: var(--color-white, #fff);';
    applyButton.onclick = () => {
      // Appliquer les modifications à l'image dans l'éditeur
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        img.src = url;
        this.handleContentChange();
        document.body.removeChild(modal);
      }, 'image/png');
    };
    
    buttonsContainer.appendChild(cancelButton);
    buttonsContainer.appendChild(applyButton);
    modalContent.appendChild(buttonsContainer);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Fermer en cliquant à l'extérieur
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };
    
    // Stocker les références pour le crop
    canvas._cropBtn = cropBtn;
    canvas._cropApplyBtn = cropApplyBtn;
    canvas._cropCancelBtn = cropCancelBtn;
  }

  /**
   * Fait tourner l'image
   */
  rotateImage(canvas, angle) {
    if (!canvas._originalImage) return;
    
    canvas._currentRotation = (canvas._currentRotation + angle) % 360;
    if (canvas._currentRotation < 0) canvas._currentRotation += 360;
    
    const ctx = canvas.getContext('2d');
    const img = canvas._originalImage;
    
    // Calculer les nouvelles dimensions
    const is90or270 = Math.abs(canvas._currentRotation % 180) === 90;
    const newWidth = is90or270 ? img.height : img.width;
    const newHeight = is90or270 ? img.width : img.height;
    
    canvas.width = Math.min(newWidth, 800);
    canvas.height = Math.min(newHeight, 600);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((canvas._currentRotation * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
    ctx.restore();
  }

  /**
   * Démarre le mode crop
   */
  startCrop(canvas) {
    canvas.style.cursor = 'crosshair';
    canvas._isCropping = true;
    canvas._cropBtn.style.display = 'none';
    canvas._cropApplyBtn.style.display = 'inline-block';
    canvas._cropCancelBtn.style.display = 'inline-block';
    
    let startX, startY, cropRect;
    
    const onMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      cropRect = { x: startX, y: startY, width: 0, height: 0 };
    };
    
    const onMouseMove = (e) => {
      if (!cropRect) return;
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      
      cropRect.width = currentX - startX;
      cropRect.height = currentY - startY;
      
      // Redessiner avec le rectangle de sélection
      this.drawCanvasWithCrop(canvas, cropRect);
    };
    
    const onMouseUp = () => {
      if (cropRect && cropRect.width !== 0 && cropRect.height !== 0) {
        canvas._cropData = cropRect;
      }
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
    };
    
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Dessine le canvas avec le rectangle de crop
   */
  drawCanvasWithCrop(canvas, cropRect) {
    const ctx = canvas.getContext('2d');
    const img = canvas._originalImage;
    
    // Redessiner l'image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (canvas._currentRotation !== 0) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((canvas._currentRotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
    } else {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    ctx.restore();
    
    // Dessiner le rectangle de sélection
    if (cropRect) {
      ctx.strokeStyle = '#0055AA';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
      
      // Zone assombrie
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.clearRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
    }
  }

  /**
   * Applique le crop
   */
  applyCrop(canvas) {
    if (!canvas._cropData) return;
    
    const crop = canvas._cropData;
    const ctx = canvas.getContext('2d');
    const img = canvas._originalImage;
    
    // Créer un nouveau canvas pour le résultat
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = Math.abs(crop.width);
    croppedCanvas.height = Math.abs(crop.height);
    const croppedCtx = croppedCanvas.getContext('2d');
    
    // Extraire la zone
    const sx = Math.min(crop.x, crop.x + crop.width);
    const sy = Math.min(crop.y, crop.y + crop.height);
    const sw = Math.abs(crop.width);
    const sh = Math.abs(crop.height);
    
    croppedCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, croppedCanvas.width, croppedCanvas.height);
    
    // Remplacer le canvas
    canvas.width = croppedCanvas.width;
    canvas.height = croppedCanvas.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(croppedCanvas, 0, 0);
    
    // Réinitialiser
    canvas._cropData = null;
    canvas._isCropping = false;
    canvas.style.cursor = 'default';
    canvas._cropBtn.style.display = 'inline-block';
    canvas._cropApplyBtn.style.display = 'none';
    canvas._cropCancelBtn.style.display = 'none';
  }

  /**
   * Annule le crop
   */
  cancelCrop(canvas) {
    canvas._cropData = null;
    canvas._isCropping = false;
    canvas.style.cursor = 'default';
    canvas._cropBtn.style.display = 'inline-block';
    canvas._cropApplyBtn.style.display = 'none';
    canvas._cropCancelBtn.style.display = 'none';
    
    // Redessiner sans crop
    this.drawCanvasWithCrop(canvas, null);
  }

  /**
   * Supprime le fond de l'image (algorithme simple basé sur la couleur)
   */
  removeBackground(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Détecter la couleur de fond (couleur la plus présente aux bords)
    const edgeColors = [];
    const edgeSize = 10;
    
    for (let y = 0; y < edgeSize; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        edgeColors.push([data[idx], data[idx + 1], data[idx + 2]]);
      }
    }
    for (let y = canvas.height - edgeSize; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        edgeColors.push([data[idx], data[idx + 1], data[idx + 2]]);
      }
    }
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < edgeSize; x++) {
        const idx = (y * canvas.width + x) * 4;
        edgeColors.push([data[idx], data[idx + 1], data[idx + 2]]);
      }
      for (let x = canvas.width - edgeSize; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        edgeColors.push([data[idx], data[idx + 1], data[idx + 2]]);
      }
    }
    
    // Calculer la couleur moyenne des bords
    let avgR = 0, avgG = 0, avgB = 0;
    edgeColors.forEach(color => {
      avgR += color[0];
      avgG += color[1];
      avgB += color[2];
    });
    avgR = Math.round(avgR / edgeColors.length);
    avgG = Math.round(avgG / edgeColors.length);
    avgB = Math.round(avgB / edgeColors.length);
    
    // Seuil de tolérance
    const tolerance = 30;
    
    // Rendre transparent les pixels similaires au fond
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const distance = Math.sqrt(
        Math.pow(r - avgR, 2) + Math.pow(g - avgG, 2) + Math.pow(b - avgB, 2)
      );
      
      if (distance < tolerance) {
        data[i + 3] = 0; // Alpha = 0 (transparent)
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
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
      console.log('📝 setContent appelé, longueur HTML:', html.length);
      console.log('📝 Images dans le HTML:', html.match(/<img[^>]*data-image-id[^>]*>/g)?.length || 0);
      
      // Corriger le HTML invalide : convertir <p class="image-container-wrapper"> en <div class="image-container-wrapper">
      // Car un <div> ne peut pas être un enfant direct d'un <p> en HTML
      // Utiliser une regex pour remplacer les balises ouvrantes et fermantes
      html = html.replace(/<p\s+class="image-container-wrapper"[^>]*>/gi, '<div class="image-container-wrapper">');
      // Remplacer les </p> qui suivent directement un </div> de image-container-wrapper
      // On doit utiliser une approche plus robuste avec un parser, mais pour l'instant on fait une regex simple
      html = html.replace(/<\/div>\s*<\/p>(?=\s*(?:<[^>]+>|$))/g, '</div></div>');
      
      this.editorElement.innerHTML = html;
      
      // Restaurer toutes les images (ajouter les fonctionnalités de redimensionnement, etc.)
      this.restoreImages();
      
      // Rendre les variables draggables après le changement de contenu
      this.makeVariablesDraggable();
      
      // Mettre à jour les indicateurs de pages
      setTimeout(() => {
      }, 100);
    }
  }

  /**
   * Restaure toutes les images dans l'éditeur après le chargement du contenu
   */
  restoreImages() {
    if (!this.editorElement) return;
    
    // Chercher tous les conteneurs d'images (avec ou sans image)
    const imageContainers = this.editorElement.querySelectorAll('.template-image-container');
    console.log(`🖼️ Restauration de ${imageContainers.length} conteneur(s) d'image...`);
    
    if (imageContainers.length === 0) {
      console.log('⚠️ Aucun conteneur d\'image trouvé dans le HTML');
      return;
    }
    
    imageContainers.forEach((container, index) => {
      const img = container.querySelector('img.template-image');
      const placeholderEl = container.querySelector('.image-placeholder');
      
      console.log(`🖼️ Conteneur ${index + 1}:`, {
        hasImage: !!img,
        hasPlaceholder: !!placeholderEl,
        containerHTML: container.outerHTML.substring(0, 200)
      });
      
      if (img) {
        console.log(`🖼️ Image ${index + 1}:`, {
          src: img.src,
          imageType: img.dataset.imageType,
          imageId: img.dataset.imageId
        });
        // Vérifier si le bouton de suppression existe, sinon le créer
        if (!container.querySelector('.image-delete-button')) {
          const deleteButton = document.createElement('button');
          deleteButton.className = 'image-delete-button';
          deleteButton.innerHTML = '×';
          deleteButton.title = 'Supprimer l\'image';
          deleteButton.onclick = (e) => {
            e.stopPropagation();
            if (confirm('Supprimer cette image ?')) {
              container.closest('.image-container-wrapper')?.remove();
              this.handleContentChange();
            }
          };
          container.appendChild(deleteButton);
        }
        
        // Rendre l'image redimensionnable si ce n'est pas déjà fait
        if (!container.hasAttribute('data-resizable')) {
          this.makeImageResizable(container);
          container.setAttribute('data-resizable', 'true');
        }
        
        // Ajouter le gestionnaire de clic pour la sélection
        container.onclick = (e) => {
          if (e.target.closest('.resize-handle') || e.target.closest('.lock-button') || e.target.closest('.image-delete-button')) {
            return; // Ne pas sélectionner si on clique sur les contrôles
          }
          e.stopPropagation();
          this.selectImage(container);
        };
        
        // Vérifier si l'URL de l'image est une URL API et la convertir si nécessaire
        if (img.dataset.imageType === 'upload' && img.dataset.imageId) {
          // L'URL devrait être via l'API
          const imageId = img.dataset.imageId;
          const templateId = this.template?._id;
          
          // Toujours reconstruire l'URL API pour s'assurer qu'elle est correcte
          if (templateId) {
            // Construire l'URL API (relatif ou absolu selon la configuration)
            const currentSrc = img.src || '';
            const isAbsolute = currentSrc.startsWith('http://') || currentSrc.startsWith('https://');
            const apiBase = (window.API_BASE_URL && !isAbsolute) ? window.API_BASE_URL : '';
            const imageUrl = `${apiBase}/api/doc-template/templates/${templateId}/images/${imageId}`;
            
            // Mettre à jour l'URL seulement si elle est différente ou invalide
            if (!currentSrc || currentSrc.startsWith('blob:') || !currentSrc.includes('/api/doc-template/') || !currentSrc.includes(imageId)) {
              img.src = imageUrl;
              console.log(`🖼️ URL de l'image ${index + 1} mise à jour:`, imageUrl);
            }
          }
        } else if (img.src && img.src.startsWith('blob:') && !img.dataset.pendingUpload) {
          // Si l'image a une URL blob mais n'est pas marquée comme en attente, elle a été perdue
          // Essayer de récupérer l'image depuis le template si on a un imageId
          const imageId = img.dataset.imageId;
          const templateId = this.template?._id;
          if (imageId && templateId) {
            const apiBase = window.API_BASE_URL || '';
            img.src = `${apiBase}/api/doc-template/templates/${templateId}/images/${imageId}`;
            img.dataset.imageType = 'upload';
            console.log(`🖼️ Image blob restaurée:`, img.src);
          }
        }
      }
      
      // Vérifier si c'est un placeholder et restaurer ses fonctionnalités
      if (placeholderEl) {
        // S'assurer que le placeholder a position relative pour le bouton de suppression
        placeholderEl.style.position = 'relative';
        
        // Vérifier si le bouton de suppression existe, sinon le créer
        if (!placeholderEl.querySelector('.image-delete-button')) {
          const deleteButton = document.createElement('button');
          deleteButton.className = 'image-delete-button';
          deleteButton.innerHTML = '×';
          deleteButton.title = 'Supprimer l\'image';
          deleteButton.onclick = (e) => {
            e.stopPropagation();
            if (confirm('Supprimer cette image ?')) {
              container.closest('.image-container-wrapper')?.remove();
              this.handleContentChange();
            }
          };
          placeholderEl.appendChild(deleteButton);
        }
        
        // Ajouter le gestionnaire de clic pour la sélection du placeholder
        placeholderEl.onclick = (e) => {
          if (e.target.closest('.image-delete-button')) {
            return; // Ne pas sélectionner si on clique sur le bouton de suppression
          }
          e.stopPropagation();
          this.selectImage(container);
        };
        
        // Rendre le placeholder redimensionnable si ce n'est pas déjà fait
        if (!container.hasAttribute('data-resizable')) {
          this.makeImageResizable(container);
          container.setAttribute('data-resizable', 'true');
        }
        
        console.log(`🖼️ Placeholder ${index + 1} restauré`);
      }
    });
    
    console.log(`✅ Restauration terminée: ${imageContainers.length} conteneur(s) traité(s)`);
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

