console.log('📄 FICHIER CHARGÉ: Editor.js');

/**
 * Editor - Éditeur WYSIWYG avec contentEditable
 * Gère l'édition des sections, titres et numérotation automatique
 */

import { FormatUtils } from '../utils/formatUtils.js';

export class Editor {
  constructor(containerEl) {
    this.container = containerEl;
    this.content = null;
    this.sections = [];
    this.onContentChange = null;
    this.init();
  }

  init() {
    console.log('🚀 INIT ÉDITEUR - Début');
    console.log('📦 Container reçu:', this.container);
    
    if (!this.container) {
      console.error('❌ ERREUR: Container est null ou undefined!');
      return;
    }
    
    this.container.className = 'wysiwyg-editor';
    this.container.contentEditable = true;
    this.container.spellcheck = true;
    
    console.log('✅ Éditeur initialisé:', {
      container: this.container,
      contentEditable: this.container.contentEditable,
      id: this.container.id,
      className: this.container.className,
      tagName: this.container.tagName
    });
    
    console.log('🎧 Attachement des événements...');
    
    // Écouter les changements
    this.container.addEventListener('input', (e) => {
      console.log('⌨️ Événement INPUT déclenché');
      // S'assurer qu'il y a toujours du contenu éditable
      this.ensureEditableContent();
      
      // Mettre à jour le contenu des sections si nécessaire
      // (géré automatiquement par la structure HTML)
      if (this.onContentChange) {
        this.onContentChange();
      }
    });
    
    console.log('✅ Événement INPUT attaché');
    
    
    // Écouter les changements de sélection pour mettre à jour les boutons
    this.container.addEventListener('mouseup', (e) => {
      console.log('🖱️ Événement MOUSEUP déclenché dans l\'éditeur');
      // Délai pour laisser la sélection se stabiliser
      setTimeout(() => {
        const selection = window.getSelection();
        console.log('📋 Sélection après mouseup:', {
          rangeCount: selection.rangeCount,
          isCollapsed: selection.isCollapsed
        });
        
        if (selection.rangeCount > 0) {
          const selectedText = selection.toString();
          console.log('📝 Texte sélectionné:', selectedText || '(vide)');
          if (selectedText) {
            console.log('📏 Longueur:', selectedText.length);
            console.log('📍 Position:', {
              startContainer: selection.getRangeAt(0).startContainer,
              startOffset: selection.getRangeAt(0).startOffset,
              endOffset: selection.getRangeAt(0).endOffset
            });
          }
        } else {
          console.log('⚠️ Aucune sélection disponible');
        }
        
        if (this.onSelectionChange) {
          this.onSelectionChange();
        }
      }, 10);
    });
    
    console.log('✅ Événement MOUSEUP attaché');
    
    this.container.addEventListener('keyup', () => {
      setTimeout(() => {
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
          const selectedText = selection.toString();
          if (selectedText) {
            console.log('⌨️ Texte sélectionné (après frappe):', selectedText);
          }
        }
        
        if (this.onSelectionChange) {
          this.onSelectionChange();
        }
      }, 10);
    });
    
    // Écouter aussi les changements de sélection au clavier (Shift+flèches)
    this.container.addEventListener('keydown', (e) => {
      // Si on utilise Shift+flèches pour sélectionner
      if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || 
                         e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        setTimeout(() => {
          const selection = window.getSelection();
          if (selection.rangeCount > 0 && !selection.isCollapsed) {
            const selectedText = selection.toString();
            if (selectedText) {
              console.log('⌨️ Texte sélectionné (clavier):', selectedText);
            }
          }
        }, 10);
      }
    });

    // Gérer le collage pour nettoyer le HTML
    this.container.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      FormatUtils.insertText(text);
    });

    // Gérer les raccourcis clavier
    this.container.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });
  }

  handleKeyboardShortcuts(e) {
    // Ctrl+B : Gras
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      FormatUtils.applyFormat('bold');
      return;
    }

    // Ctrl+I : Italique
    if (e.ctrlKey && e.key === 'i') {
      e.preventDefault();
      FormatUtils.applyFormat('italic');
      return;
    }

    // Ctrl+U : Souligné
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      FormatUtils.applyFormat('underline');
      return;
    }

    // Ctrl+Shift+X : Barré
    if (e.ctrlKey && e.shiftKey && e.key === 'X') {
      e.preventDefault();
      FormatUtils.applyFormat('strikeThrough');
      return;
    }
  }

  renderSections(sections) {
    // Extraire toutes les sections de manière récursive
    this.sections = this.extractAllSections(sections);
    this.container.innerHTML = '';
    
    // Si aucune section, créer une section par défaut vide
    if (this.sections.length === 0) {
      this.sections = [{
        id: 'sec_' + Date.now(),
        niveau: 1,
        titre: null, // Section sans titre pour commencer
        content: []
      }];
    }
    
    // Créer la structure du document
    this.sections.forEach((section, index) => {
      const sectionEl = this.createSectionElement(section, index);
      this.container.appendChild(sectionEl);
    });

    // Appliquer la numérotation
    this.updateNumbering();
    
    // S'assurer qu'il y a au moins un paragraphe éditable
    this.ensureEditableContent();
  }
  
  /**
   * S'assure qu'il y a du contenu éditable dans l'éditeur
   */
  ensureEditableContent() {
    // Si l'éditeur est vide, créer une section avec un paragraphe
    if (this.container.children.length === 0) {
      const section = {
        id: 'sec_' + Date.now(),
        niveau: 1,
        titre: null,
        content: []
      };
      this.sections = [section];
      const sectionEl = this.createSectionElement(section, 0);
      this.container.appendChild(sectionEl);
    }
    
    // S'assurer que chaque section a au moins un paragraphe
    const sections = this.container.querySelectorAll('.wysiwyg-section');
    sections.forEach(sectionEl => {
      const contentEl = sectionEl.querySelector('.section-content');
      if (contentEl) {
        const paragraphs = contentEl.querySelectorAll('p');
        if (paragraphs.length === 0) {
          const p = document.createElement('p');
          p.textContent = '';
          contentEl.appendChild(p);
        }
      }
    });
  }

  extractAllSections(contentJson, level = 0) {
    const allSections = [];
    
    if (!contentJson) {
      return [{
        id: 'sec1',
        niveau: 1,
        titre: 'Nouvelle section',
        content: []
      }];
    }

    // Si c'est un tableau de sections
    if (Array.isArray(contentJson)) {
      contentJson.forEach(item => {
        if (item.id && (item.titre !== undefined || item.titre === null)) {
          allSections.push({
            ...item,
            niveau: item.niveau || level + 1
          });
          
          // Extraire les sous-sections récursivement
          if (item.content && Array.isArray(item.content)) {
            const subSections = this.extractAllSections(item.content, item.niveau || level + 1);
            allSections.push(...subSections);
          }
        }
      });
    } 
    // Si c'est un objet avec une propriété sections
    else if (contentJson.sections && Array.isArray(contentJson.sections)) {
      return this.extractAllSections(contentJson.sections, level);
    }
    // Si c'est une section unique
    else if (contentJson.id) {
      allSections.push({
        ...contentJson,
        niveau: contentJson.niveau || level + 1
      });
      
      if (contentJson.content && Array.isArray(contentJson.content)) {
        const subSections = this.extractAllSections(contentJson.content, contentJson.niveau || level + 1);
        allSections.push(...subSections);
      }
    }

    return allSections.length > 0 ? allSections : [{
      id: 'sec1',
      niveau: 1,
      titre: 'Nouvelle section',
      content: []
    }];
  }

  createSectionElement(section, index) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'wysiwyg-section';
    sectionDiv.dataset.sectionId = section.id;
    sectionDiv.dataset.niveau = section.niveau || 1;

      // Titre éditable avec numérotation
      if (section.titre !== null) {
        const titleEl = document.createElement('h2');
        titleEl.className = `section-title niveau-${section.niveau || 1}`;
        // Le titre est éditable car le conteneur principal est contentEditable
        titleEl.dataset.sectionId = section.id;
        titleEl.textContent = section.titre || '';
        
        // Numéro de section (sera mis à jour par updateNumbering)
        const numberSpan = document.createElement('span');
        numberSpan.className = 'section-number';
        numberSpan.contentEditable = false;
        titleEl.insertBefore(numberSpan, titleEl.firstChild);
        
        // Écouter les changements du titre via l'événement input du conteneur
        // (géré au niveau du conteneur principal)

        sectionDiv.appendChild(titleEl);
      }

    // Contenu de la section
    const contentEl = document.createElement('div');
    contentEl.className = 'section-content';
    // Ne pas mettre contentEditable ici - le conteneur principal gère déjà l'édition

    // Rendre le contenu existant
    if (section.content && Array.isArray(section.content)) {
      section.content.forEach(item => {
        if (item.type === 'paragraph') {
          const p = this.createParagraphElement(item);
          contentEl.appendChild(p);
        }
      });
    } else {
      // Paragraphe vide par défaut
      const p = document.createElement('p');
      p.textContent = '';
      contentEl.appendChild(p);
    }

    // Les changements sont gérés au niveau du conteneur principal

    sectionDiv.appendChild(contentEl);

    return sectionDiv;
  }

  createParagraphElement(paragraphData) {
    const p = document.createElement('p');
    
    if (paragraphData.content && Array.isArray(paragraphData.content)) {
      paragraphData.content.forEach(run => {
        if (run.text) {
          const span = document.createElement('span');
          span.textContent = run.text;
          
          // Appliquer les styles
          if (run.styles) {
            if (run.styles.bold) span.style.fontWeight = 'bold';
            if (run.styles.italic) span.style.fontStyle = 'italic';
            if (run.styles.underline) span.style.textDecoration = 'underline';
            if (run.styles.backgroundColor) span.style.backgroundColor = run.styles.backgroundColor;
            if (run.styles.color) span.style.color = run.styles.color;
            if (run.styles.fontSize) span.style.fontSize = run.styles.fontSize;
          }
          
          p.appendChild(span);
        }
      });
    } else if (paragraphData.text) {
      p.textContent = paragraphData.text;
    }

    return p;
  }

  updateSectionTitle(sectionId, newTitle) {
    const section = this.sections.find(s => s.id === sectionId);
    if (section) {
      section.titre = newTitle;
    }
  }

  updateSectionContent(sectionId, contentEl) {
    const section = this.sections.find(s => s.id === sectionId);
    if (section) {
      // Extraire le contenu HTML et le convertir en structure JSON
      const paragraphs = Array.from(contentEl.querySelectorAll('p'));
      section.content = paragraphs.map(p => {
        const runs = [];
        const processNode = (node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent.trim()) {
              runs.push({
                text: node.textContent,
                styles: {}
              });
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const styles = {};
            const computed = window.getComputedStyle(node);
            
            if (computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 600) {
              styles.bold = true;
            }
            if (computed.fontStyle === 'italic') {
              styles.italic = true;
            }
            if (computed.textDecoration.includes('underline')) {
              styles.underline = true;
            }
            if (computed.color && computed.color !== 'rgb(0, 0, 0)') {
              styles.color = computed.color;
            }
            if (computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)') {
              styles.backgroundColor = computed.backgroundColor;
            }

            Array.from(node.childNodes).forEach(child => {
              processNode(child);
            });
          }
        };

        Array.from(p.childNodes).forEach(child => {
          processNode(child);
        });

        return {
          type: 'paragraph',
          content: runs
        };
      });
    }
  }

  updateNumbering() {
    // Mettre à jour la numérotation de toutes les sections
    const sections = this.container.querySelectorAll('.wysiwyg-section');
    const numbering = this.calculateNumbering(sections);
    
    sections.forEach((sectionEl, index) => {
      const sectionId = sectionEl.dataset.sectionId;
      const niveau = parseInt(sectionEl.dataset.niveau) || 1;
      const number = numbering[sectionId];
      
      const titleEl = sectionEl.querySelector('.section-title');
      if (titleEl) {
        const numberSpan = titleEl.querySelector('.section-number');
        if (numberSpan && number) {
          numberSpan.textContent = `${number} `;
        }
      }
    });
  }

  calculateNumbering(sections) {
    const numbering = {};
    const counters = {};
    
    sections.forEach(sectionEl => {
      const niveau = parseInt(sectionEl.dataset.niveau) || 1;
      
      // Réinitialiser les compteurs des niveaux inférieurs
      for (let i = niveau + 1; i <= 6; i++) {
        counters[i] = 0;
      }
      
      // Incrémenter le compteur du niveau actuel
      counters[niveau] = (counters[niveau] || 0) + 1;
      
      // Construire le numéro
      const number = [];
      for (let i = 1; i <= niveau; i++) {
        number.push(counters[i] || 1);
      }
      
      const sectionId = sectionEl.dataset.sectionId;
      numbering[sectionId] = number.join('.');
    });
    
    return numbering;
  }

  scrollToSection(sectionId) {
    const sectionEl = this.container.querySelector(`[data-section-id="${sectionId}"]`);
    if (sectionEl) {
      sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.highlightSection(sectionId);
    }
  }

  highlightSection(sectionId) {
    // Retirer le highlight de toutes les sections
    this.container.querySelectorAll('.wysiwyg-section').forEach(section => {
      section.classList.remove('highlighted');
    });
    
    // Ajouter le highlight à la section sélectionnée
    const sectionEl = this.container.querySelector(`[data-section-id="${sectionId}"]`);
    if (sectionEl) {
      sectionEl.classList.add('highlighted');
      setTimeout(() => {
        sectionEl.classList.remove('highlighted');
      }, 2000);
    }
  }

  insertVariable(variablePath) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

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
    variableSpan.style.cursor = 'default';

    range.insertNode(variableSpan);
    
    // Placer le curseur après la variable
    range.setStartAfter(variableSpan);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    if (this.onContentChange) {
      this.onContentChange();
    }
  }

  applyFormat(command, value = null) {
    FormatUtils.applyFormat(command, value);
  }

  setPageSize(widthPx, heightPx) {
    this.container.style.width = widthPx + 'px';
    this.container.style.minHeight = heightPx + 'px';
  }

  getContent() {
    // Retourner le contenu au format JSON
    return {
      sections: this.sections.map(section => {
        const sectionEl = this.container.querySelector(`[data-section-id="${section.id}"]`);
        if (sectionEl) {
          const titleEl = sectionEl.querySelector('.section-title');
          if (titleEl) {
            section.titre = titleEl.textContent.replace(/^\d+\.\s*/, '');
          }
          
          const contentEl = sectionEl.querySelector('.section-content');
          if (contentEl) {
            this.updateSectionContent(section.id, contentEl);
          }
        }
        return section;
      })
    };
  }
}

