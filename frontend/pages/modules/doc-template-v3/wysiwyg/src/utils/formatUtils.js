console.log('📄 FICHIER CHARGÉ: formatUtils.js');

/**
 * Utilitaires pour le formatage de texte moderne (sans execCommand)
 * Gère la sélection et l'application de formats
 */

export class FormatUtils {
  /**
   * Applique un format à la sélection actuelle
   * @param {string} command - Commande de formatage (bold, italic, underline, etc.)
   * @param {string|null} value - Valeur optionnelle (pour fontSize, fontName, etc.)
   */
  static applyFormat(command, value = null) {
    // Utiliser execCommand directement - c'est la méthode la plus fiable
    // execCommand fonctionne bien avec contentEditable et gère automatiquement les sélections complexes
    
    try {
      // Pour les commandes de formatage de texte simples, utiliser execCommand directement
      if (['bold', 'italic', 'underline', 'strikeThrough'].includes(command)) {
        const success = document.execCommand(command, false, null);
        if (!success) {
          console.warn(`execCommand a échoué pour: ${command}`);
        }
        return;
      }

      // Pour les couleurs
      if (command === 'foreColor' && value) {
        document.execCommand('foreColor', false, value);
        return;
      }

      if (command === 'backColor' && value) {
        document.execCommand('backColor', false, value);
        return;
      }

      // Pour la taille de police
      if (command === 'fontSize' && value) {
        // execCommand attend un nombre de 1 à 7, pas une valeur en px
        // On va utiliser une approche différente
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
          const range = selection.getRangeAt(0);
          const span = document.createElement('span');
          span.style.fontSize = value;
          try {
            range.surroundContents(span);
          } catch (e) {
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
          }
        }
        return;
      }

      // Pour la police
      if (command === 'fontName' && value) {
        document.execCommand('fontName', false, value);
        return;
      }

      // Commandes de bloc (alignement)
      if (['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'].includes(command)) {
        document.execCommand(command, false, null);
        return;
      }

      // Format de bloc (titres)
      if (command === 'formatBlock' && value) {
        document.execCommand('formatBlock', false, `<${value}>`);
        return;
      }

      // Listes
      if (command === 'insertUnorderedList') {
        document.execCommand('insertUnorderedList', false, null);
        return;
      }

      if (command === 'insertOrderedList') {
        document.execCommand('insertOrderedList', false, null);
        return;
      }

      // Ligne horizontale
      if (command === 'insertHorizontalRule') {
        document.execCommand('insertHorizontalRule', false, null);
        return;
      }

      // Fallback pour les autres commandes
      document.execCommand(command, false, value);
      
    } catch (e) {
      console.error('Erreur lors de l\'application du format:', command, e);
    }
  }

  /**
   * Applique un format de texte à une sélection
   */
  static applyTextFormat(range, command, value, selection) {
    // Vérifier que la sélection est valide
    if (!range || range.collapsed) {
      return;
    }

    // Vérifier que la sélection contient du texte
    const selectedText = range.toString().trim();
    if (!selectedText) {
      return;
    }

    // Méthode 1 : Utiliser execCommand d'abord (plus fiable pour les sélections complexes)
    // C'est la méthode la plus robuste pour gérer les sélections qui traversent plusieurs éléments
    try {
      // S'assurer que la sélection est active
      selection.removeAllRanges();
      selection.addRange(range.cloneRange());
      
      // Utiliser execCommand qui gère bien les cas complexes
      const success = document.execCommand(command, false, value);
      
      if (success) {
        // Mettre à jour la sélection après le formatage
        const newRange = selection.getRangeAt(0);
        if (newRange) {
          // Trouver le span créé et sélectionner son contenu
          const span = newRange.commonAncestorContainer;
          if (span && span.nodeType === Node.ELEMENT_NODE && span.tagName === 'SPAN') {
            selection.removeAllRanges();
            const finalRange = document.createRange();
            finalRange.selectNodeContents(span);
            finalRange.collapse(false);
            selection.addRange(finalRange);
          }
        }
        return;
      }
    } catch (e) {
      console.warn('execCommand a échoué, tentative avec extractContents:', e);
    }

    // Méthode 2 : Utiliser extractContents (plus propre mais moins robuste)
    try {
      // Cloner la sélection
      const clonedRange = range.cloneRange();
      
      // Extraire le contenu
      const contents = clonedRange.extractContents();
      
      // Si le contenu est vide, ne rien faire
      if (!contents || (!contents.textContent.trim() && contents.childNodes.length === 0)) {
        return;
      }
      
      // Créer un span avec le format
      const span = document.createElement('span');
      this.applyStyleToElement(span, command, value);
      
      // Ajouter le contenu au span
      span.appendChild(contents);
      
      // Insérer le span à la position de la sélection
      range.insertNode(span);
      
      // Nettoyer les spans vides
      this.cleanupEmptySpans(span.parentElement);
      
      // Restaurer la sélection sur le span
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      newRange.collapse(false);
      selection.addRange(newRange);
      
      return;
    } catch (e) {
      console.warn('extractContents a échoué, tentative avec surroundContents:', e);
    }

    // Méthode 3 : Utiliser surroundContents (pour les sélections dans un seul élément)
    try {
      const span = document.createElement('span');
      this.applyStyleToElement(span, command, value);
      range.surroundContents(span);
      
      // Nettoyer les spans vides
      this.cleanupEmptySpans(span.parentElement);
      
      // Restaurer la sélection
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      newRange.collapse(false);
      selection.addRange(newRange);
      
      return;
    } catch (e2) {
      console.error('Toutes les méthodes ont échoué pour appliquer le format:', command, e2);
    }
  }

  /**
   * Nettoie les spans vides créés par le formatage
   */
  static cleanupEmptySpans(container) {
    if (!container) return;
    
    const emptySpans = container.querySelectorAll('span:empty');
    emptySpans.forEach(span => {
      // Vérifier si le span est vraiment vide (pas d'espace, pas de texte)
      if (!span.textContent.trim() && span.childNodes.length === 0) {
        const parent = span.parentElement;
        if (parent) {
          parent.removeChild(span);
          // Normaliser pour fusionner les nœuds texte adjacents
          parent.normalize();
        }
      }
    });
  }

  /**
   * Applique un style à un élément
   */
  static applyStyleToElement(element, command, value) {
    switch (command) {
      case 'bold':
        element.style.fontWeight = 'bold';
        break;
      case 'italic':
        element.style.fontStyle = 'italic';
        break;
      case 'underline':
        element.style.textDecoration = 'underline';
        break;
      case 'strikeThrough':
        element.style.textDecoration = 'line-through';
        break;
      case 'fontSize':
        if (value) element.style.fontSize = value;
        break;
      case 'fontName':
        if (value) element.style.fontFamily = value;
        break;
      case 'foreColor':
        if (value) element.style.color = value;
        break;
      case 'backColor':
        if (value) element.style.backgroundColor = value;
        break;
    }
  }

  /**
   * Applique un format de bloc (alignement, etc.)
   */
  static applyBlockFormat(range, property, value) {
    let block = range.commonAncestorContainer;
    
    // Remonter jusqu'à trouver un élément de bloc
    while (block && block.nodeType !== Node.ELEMENT_NODE) {
      block = block.parentElement;
    }
    
    if (!block) {
      // Créer un paragraphe si nécessaire
      const p = document.createElement('p');
      range.surroundContents(p);
      block = p;
    }

    // Trouver l'élément de bloc parent
    while (block && !this.isBlockElement(block)) {
      block = block.parentElement;
    }

    if (block) {
      block.style[property] = value;
    }
  }

  /**
   * Enveloppe la sélection dans un élément de bloc
   */
  static wrapInBlock(range, tagName) {
    const block = document.createElement(tagName);
    try {
      range.surroundContents(block);
    } catch (e) {
      // Si surroundContents échoue, extraire le contenu
      const contents = range.extractContents();
      block.appendChild(contents);
      range.insertNode(block);
    }
  }

  /**
   * Insère une liste
   */
  static insertList(range, listType) {
    const list = document.createElement(listType);
    const li = document.createElement('li');
    
    const selectedText = range.toString();
    if (selectedText) {
      li.textContent = selectedText;
      range.deleteContents();
    }
    
    list.appendChild(li);
    range.insertNode(list);
  }

  /**
   * Vérifie si un élément est un élément de bloc
   */
  static isBlockElement(element) {
    const blockElements = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE'];
    return blockElements.includes(element.tagName);
  }

  /**
   * Vérifie si un format est actif sur la sélection
   * @param {string} command - Commande à vérifier
   * @returns {boolean}
   */
  static isFormatActive(command) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    
    // Trouver l'élément parent
    let node = range.commonAncestorContainer;
    while (node && node.nodeType !== Node.ELEMENT_NODE) {
      node = node.parentElement;
    }
    if (!node) {
      // Si c'est un text node, prendre le parent
      node = range.startContainer;
      while (node && node.nodeType !== Node.TEXT_NODE) {
        node = node.parentElement;
      }
      if (node) node = node.parentElement;
    }
    
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      // Fallback sur queryCommandState
      try {
        return document.queryCommandState(command);
      } catch (e) {
        return false;
      }
    }

    const element = node;
    const computed = window.getComputedStyle(element);
    
    switch (command) {
      case 'bold':
        const fontWeight = computed.fontWeight;
        return fontWeight === 'bold' || fontWeight === '700' || 
               (parseInt(fontWeight) >= 600);
      case 'italic':
        return computed.fontStyle === 'italic';
      case 'underline':
        return computed.textDecoration.includes('underline') || 
               computed.textDecorationLine.includes('underline');
      case 'strikeThrough':
        return computed.textDecoration.includes('line-through') ||
               computed.textDecorationLine.includes('line-through');
      case 'justifyLeft':
        return computed.textAlign === 'left';
      case 'justifyCenter':
        return computed.textAlign === 'center';
      case 'justifyRight':
        return computed.textAlign === 'right';
      case 'justifyFull':
        return computed.textAlign === 'justify';
      default:
        // Fallback sur queryCommandState
        try {
          return document.queryCommandState(command);
        } catch (e) {
          return false;
        }
    }
  }

  /**
   * Insère du texte à la position du curseur
   */
  static insertText(text) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    // Placer le curseur après le texte inséré
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

