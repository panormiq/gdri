// src/modules/editor/templateBuilder/components/editor/RichTextEditor.js

// Charger le CSS
import loadCSS from '../../../utils/loadCSS.js';
loadCSS('templateBuilder/components/editor/RichTextEditor.css', 'rich-text-editor-styles');

import { formatHierarchicalNumbering } from '../../utils/numberingUtils.js';
import { flattenSections } from '../../utils/sectionHierarchy.js';

export default class RichTextEditor {
  constructor({ template, onContentChange, onTitleCreated, onSectionChange, onTitleLevelChanged }) {
    this.template = template;
    this.onContentChange = onContentChange;
    this.onTitleCreated = onTitleCreated; // Callback quand un titre est créé
    this.onSectionChange = onSectionChange; // Callback quand la section active change (clic dans l'éditeur)
    this.onTitleLevelChanged = onTitleLevelChanged; // Callback quand le niveau d'un titre change
    this.currentSectionId = null;
    this.editorElement = null;
    this.dragCaretIndicator = null;
    this.dropRange = null;
  }

  render(container) {
    this.container = container;
    this.container.classList.add('rich-text-editor-container');
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
    
    // Événements
    this.editorElement.oninput = () => this.handleContentChange();
    this.editorElement.onpaste = (e) => this.handlePaste(e);
    
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
      
      // Étape 2 : Si on est dans un élément, utiliser caretRangeFromPoint pour position exacte
      if (elementUnderCursor) {
        if (document.caretRangeFromPoint) {
          try {
            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
            if (range && elementUnderCursor.contains(range.commonAncestorContainer)) {
              bestRange = range;
              
              // Vérifier si on est à droite d'une ligne existante
              const rect = range.getBoundingClientRect();
              const parentRect = elementUnderCursor.getBoundingClientRect();
              
              // Si le curseur est à droite du dernier caractère visible, on est à la fin de la ligne
              // On doit insérer à la fin du texte de l'élément, pas au début
              if (e.clientX > rect.left && e.clientX <= parentRect.right) {
                // Trouver le dernier nœud texte dans l'élément
                const walker = document.createTreeWalker(
                  elementUnderCursor,
                  NodeFilter.SHOW_TEXT,
                  null
                );
                
                let lastTextNode = null;
                let node;
                while (node = walker.nextNode()) {
                  lastTextNode = node;
                }
                
                if (lastTextNode && lastTextNode.textContent.length > 0) {
                  // Insérer à la fin du dernier nœud texte
                  bestRange = document.createRange();
                  bestRange.setStart(lastTextNode, lastTextNode.textContent.length);
                  bestRange.collapse(true);
                } else {
                  // Pas de texte, utiliser la fin de l'élément
                  bestRange = document.createRange();
                  bestRange.selectNodeContents(elementUnderCursor);
                  bestRange.collapse(false);
                }
              }
            }
          } catch (err) {
            // Fallback : utiliser le début de l'élément
            bestRange = document.createRange();
            bestRange.setStart(elementUnderCursor, 0);
            bestRange.collapse(true);
          }
        } else {
          // Fallback : utiliser le début de l'élément
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
        this.dropRange = bestRange;
      } else if (this.dragCaretIndicator) {
        // Si pas de range trouvé, cacher le caret
        this.dragCaretIndicator.style.display = 'none';
      }
    };
    
    this.container.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      
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
      e.dataTransfer.dropEffect = 'copy';
      
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
    
    // Fonction centralisée pour gérer le drop
    this.handleDrop = (e) => {
      e.preventDefault();
      
      // Cacher l'indicateur de caret
      if (this.dragCaretIndicator) {
        this.dragCaretIndicator.style.display = 'none';
      }
      
      const variablePath = e.dataTransfer.getData('text/plain');
      if (variablePath) {
        // Utiliser le range stocké (le plus proche trouvé) ou chercher à nouveau
        let range = this.dropRange;
        
        if (!range) {
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
          
          // Étape 2 : Si on est dans un élément, utiliser caretRangeFromPoint pour position exacte
          if (elementUnderCursor) {
            if (document.caretRangeFromPoint) {
              try {
                range = document.caretRangeFromPoint(e.clientX, e.clientY);
                if (range && elementUnderCursor.contains(range.commonAncestorContainer)) {
                  // Vérifier si on est à droite d'une ligne existante
                  const rangeRect = range.getBoundingClientRect();
                  const parentRect = elementUnderCursor.getBoundingClientRect();
                  
                  // Si le curseur est à droite du dernier caractère visible, on est à la fin de la ligne
                  // On doit insérer à la fin du texte de l'élément, pas au début
                  if (e.clientX > rangeRect.left && e.clientX <= parentRect.right) {
                    // Trouver le dernier nœud texte dans l'élément
                    const walker = document.createTreeWalker(
                      elementUnderCursor,
                      NodeFilter.SHOW_TEXT,
                      null
                    );
                    
                    let lastTextNode = null;
                    let node;
                    while (node = walker.nextNode()) {
                      lastTextNode = node;
                    }
                    
                    if (lastTextNode && lastTextNode.textContent.length > 0) {
                      // Insérer à la fin du dernier nœud texte
                      range = document.createRange();
                      range.setStart(lastTextNode, lastTextNode.textContent.length);
                      range.collapse(true);
                    } else {
                      // Pas de texte, utiliser la fin de l'élément
                      range = document.createRange();
                      range.selectNodeContents(elementUnderCursor);
                      range.collapse(false);
                    }
                  }
                } else {
                  // Le range n'est pas dans l'élément, utiliser le début
                  range = document.createRange();
                  range.setStart(elementUnderCursor, 0);
                  range.collapse(true);
                }
              } catch (err) {
                // Fallback : utiliser le début de l'élément
                range = document.createRange();
                range.setStart(elementUnderCursor, 0);
                range.collapse(true);
              }
            } else {
              // Fallback : utiliser le début de l'élément
              range = document.createRange();
              range.setStart(elementUnderCursor, 0);
              range.collapse(true);
            }
          }
          
          // Étape 3 : Si aucun élément n'est sous le curseur, chercher le premier run vide
          if (!range) {
            for (const element of allElements) {
              const isEmpty = element.textContent.trim() === '' || 
                             (element.children.length === 0 && element.textContent.trim() === '') ||
                             (element.innerHTML === '<br>' || element.innerHTML === '<br/>' || element.innerHTML.trim() === '');
              
              if (isEmpty) {
                range = document.createRange();
                range.setStart(element, 0);
                range.collapse(true);
                break;
              }
            }
          }
          
          // Étape 4 : Si toujours rien, créer une nouvelle ligne
          if (!range) {
            const newP = document.createElement('p');
            newP.innerHTML = '<br>';
            this.editorElement.appendChild(newP);
            range = document.createRange();
            range.setStart(newP, 0);
            range.collapse(true);
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

    // Rendre tout le contenu du document (toutes les sections)
    this.renderAllSections();
    
    // Appliquer les styles de mise en page
    this.applyLayoutStyles();
  }

  applyPageFormat() {
    if (!this.template || !this.template.generalStyles || !this.template.generalStyles.default) {
      return;
    }

    const pagination = this.template.generalStyles.default.pagination || {};
    const pageSize = pagination.pageSize || 'A4';
    const orientation = pagination.orientation || 'portrait';

    // Dimensions réelles en cm (pour export PDF)
    const PAGE_SIZES = {
      A4: { width: 21, height: 29.7 },
      A3: { width: 29.7, height: 42 }
    };

    const size = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
    
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

    // Calculer le ratio d'échelle pour l'affichage écran
    // On veut que la page tienne dans ~80% de la largeur disponible
    // avec une marge confortable
    if (!this.container) return;
    
    const containerWidth = this.container.clientWidth || 800; // fallback
    const maxDisplayWidth = containerWidth * 0.85; // 85% de la largeur disponible
    const scale = Math.min(maxDisplayWidth / realWidth, 1); // Ne pas agrandir au-delà de 100%
    
    // Dimensions d'affichage (avec scale)
    const displayWidth = realWidth * scale;
    const displayHeight = realHeight * scale;

    // Appliquer les dimensions et le scale au wrapper de page
    if (this.pageWrapper) {
      // Dimensions réelles (pour export PDF)
      this.pageWrapper.style.width = `${realWidth}px`;
      this.pageWrapper.style.minHeight = `${realHeight}px`;
      
      // Scale pour l'affichage
      this.pageWrapper.style.transform = `scale(${scale})`;
      this.pageWrapper.style.transformOrigin = 'top center';
      
      // Ajuster la hauteur du container pour éviter le scroll vertical dû au scale
      this.pageWrapper.style.marginBottom = `${(realHeight * scale) - realHeight}px`;
      
      // Stocker les dimensions réelles pour l'export PDF
      this.pageWrapper.dataset.realWidth = realWidth;
      this.pageWrapper.dataset.realHeight = realHeight;
      this.pageWrapper.dataset.pageSize = pageSize;
      this.pageWrapper.dataset.orientation = orientation;
      this.pageWrapper.dataset.scale = scale;
    }

    // Appliquer les marges si définies (en dimensions réelles, le scale s'appliquera)
    const margins = this.template.generalStyles.default.margin || {};
    if (this.editorElement && margins) {
      this.editorElement.style.paddingTop = margins.top || '0';
      this.editorElement.style.paddingRight = margins.right || '0';
      this.editorElement.style.paddingBottom = margins.bottom || '0';
      this.editorElement.style.paddingLeft = margins.left || '0';
    }
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
      const headingTag = section.level === 1 ? 'h1' : section.level === 2 ? 'h2' : 'h3';
      const title = section.title || 'Sans titre';
      const number = formatHierarchicalNumbering(path, numberingType, numberingCustom);
      
      // Rendre le titre avec la numérotation hiérarchique
      let sectionHTML = `<${headingTag} data-section-id="${section.id}">${number} ${title}</${headingTag}>`;
      
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
      range = newRange;
    } else {
      // Sinon, utiliser le range normal et supprimer le contenu sélectionné
      range.deleteContents();
    }

    // Créer un span pour la variable
    const variableSpan = document.createElement('span');
    variableSpan.className = 'template-variable';
    variableSpan.contentEditable = false;
    variableSpan.dataset.variable = variablePath;
    variableSpan.textContent = `{{${variablePath}}}`;
    variableSpan.style.color = '#0055AA';
    variableSpan.style.fontStyle = 'italic';
    variableSpan.style.backgroundColor = '#f0f0f0';
    variableSpan.style.padding = '2px 4px';
    variableSpan.style.borderRadius = '3px';

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
    
    this.handleContentChange();
  }

  applyFormat(command, value = null) {
    // Détecter si on change le niveau d'un titre existant
    if (command === 'formatBlock' && value && ['h1', 'h2', 'h3'].includes(value.toLowerCase())) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let element = range.commonAncestorContainer;
        
        // Si c'est un nœud texte, remonter au parent
        if (element.nodeType === Node.TEXT_NODE) {
          element = element.parentElement;
        }
        
        // Remonter dans la hiérarchie jusqu'à trouver un titre
        while (element && element !== this.editorElement) {
          if (element.tagName && /^H[1-3]$/i.test(element.tagName)) {
            // C'est un titre existant, on va changer son niveau
            const newLevel = parseInt(value.charAt(1));
            const sectionId = element.dataset.sectionId;
            
            // Appeler le callback pour changer le niveau
            if (this.onTitleLevelChanged && sectionId) {
              setTimeout(() => {
                this.onTitleLevelChanged(sectionId, newLevel);
              }, 10);
              
              // Exécuter la commande pour changer le format
              document.execCommand(command, false, value);
              this.handleContentChange();
              return;
            }
            break;
          }
          element = element.parentElement;
        }
      }
    }
    
    document.execCommand(command, false, value);
    this.handleContentChange();
    
    // Détecter si on vient de créer un titre (h1, h2, h3)
    if (command === 'formatBlock' && value && ['h1', 'h2', 'h3'].includes(value.toLowerCase())) {
      // Notifier le parent pour créer une nouvelle section
      if (this.onTitleCreated) {
        setTimeout(() => {
          this.onTitleCreated(value.toLowerCase());
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
    
    // Appliquer les styles globaux à l'éditeur
    if (defaultStyles.fontFamily) {
      this.editorElement.style.fontFamily = defaultStyles.fontFamily;
    }
    if (defaultStyles.fontSize) {
      this.editorElement.style.fontSize = `${defaultStyles.fontSize}px`;
    }
    if (defaultStyles.color) {
      this.editorElement.style.color = defaultStyles.color;
    }
    
    // Appliquer les styles aux titres h1, h2, h3
    ['h1', 'h2', 'h3'].forEach(heading => {
      const headingElements = this.editorElement.querySelectorAll(heading);
      const headingStyle = headingsStyles[heading] || {};
      
      headingElements.forEach(element => {
        // Taille de police
        if (headingStyle.fontSize) {
          element.style.fontSize = `${headingStyle.fontSize}px`;
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
        
        // Marges gauche/droite
        if (headingStyle.useGlobalMargin === false) {
          // Si la checkbox est décochée, utiliser les marges spécifiques
          if (headingStyle.margin) {
            if (headingStyle.margin.left) {
              element.style.marginLeft = headingStyle.margin.left;
            } else {
              element.style.marginLeft = '';
            }
            if (headingStyle.margin.right) {
              element.style.marginRight = headingStyle.margin.right;
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
              element.style.marginLeft = defaultStyles.margin.left;
            }
            if (defaultStyles.margin.right) {
              element.style.marginRight = defaultStyles.margin.right;
            }
          }
        }
        
        // Padding gauche/droite
        if (headingStyle.padding) {
          if (headingStyle.padding.left) {
            element.style.paddingLeft = headingStyle.padding.left;
          }
          if (headingStyle.padding.right) {
            element.style.paddingRight = headingStyle.padding.right;
          }
        }
      });
    });
  }
}

