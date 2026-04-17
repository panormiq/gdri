// front/src/modules/editor/document/utils/variableReplacer.js

/**
 * 🔹 Remplace les variables dans le HTML d'un template
 * 
 * Format des variables :
 * - Variables simples : {{nomVariable}}
 * - Variables collection : {{aliasCollection.nomChamp}}
 * - Variables sous-collection : {{aliasSousCollection.nomChamp}}
 * 
 * @param {string} html - HTML du template avec variables
 * @param {Object} variables - Objet contenant les variables
 * @param {Object} variables.simple - Variables simples { nomVariable: valeur }
 * @param {Object} variables.collections - Variables collections { alias: { values: {...} } }
 * @returns {string} HTML avec variables remplacées
 */
/**
 * 🔹 Récupère le style du run précédent (parent ou élément précédent)
 * @param {HTMLElement} element - Élément variable
 * @returns {string} Style CSS à appliquer
 */
function getParentRunStyle(element) {
  if (!element || !element.parentElement) return '';
  
  const parent = element.parentElement;
  
  // D'abord, vérifier si le parent a un style inline
  if (parent.style && parent.style.cssText) {
    // Copier les styles du parent sauf ceux qui sont spécifiques aux variables
    const parentStyles = parent.style.cssText;
    // Enlever les styles de variable (backgroundColor, padding, borderRadius)
    const cleanedStyles = parentStyles
      .split(';')
      .filter(style => {
        const prop = style.split(':')[0].trim();
        return !['background-color', 'padding', 'border-radius'].includes(prop.toLowerCase());
      })
      .join(';');
    
    if (cleanedStyles) {
      return cleanedStyles;
    }
  }
  
  // Si pas de style inline, chercher le style du parent du parent (run précédent)
  if (parent.parentElement && parent.parentElement.style && parent.parentElement.style.cssText) {
    return parent.parentElement.style.cssText;
  }
  
  return '';
}

/**
 * 🔹 Construit l'URL d'une image de collection
 * @param {Object} imageData - Données de l'image (peut être un objet avec previewUrl, url, filename, etc. ou une string)
 * @param {string} collectionId - ID de la collection
 * @returns {string} URL de l'image
 */
export function buildCollectionImageUrl(imageData, collectionId) {
  if (!imageData) return '';
  
  // Si c'est déjà une URL string, la retourner telle quelle (sauf si c'est une blob URL)
  if (typeof imageData === 'string') {
    // Ignorer les URLs blob (problèmes CSP)
    if (imageData.startsWith('blob:')) {
      console.warn('⚠️ URL blob détectée, ignorée pour des raisons de sécurité CSP');
      return '';
    }
    // Si c'est une URL complète, la retourner
    if (imageData.startsWith('http://') || imageData.startsWith('https://') || imageData.startsWith('/') || imageData.startsWith('data:')) {
      return imageData;
    }
    // Sinon, construire l'URL API
    const apiBase = window.API_BASE_URL || '/api';
    return `${apiBase}/doc-template/collections/${collectionId}/images/${imageData}`;
  }
  
  // Si c'est un objet, extraire l'URL ou le filename
  if (typeof imageData === 'object') {
    // Essayer previewUrl d'abord (mais ignorer si c'est une blob URL)
    if (imageData.previewUrl) {
      if (imageData.previewUrl.startsWith('blob:')) {
        console.warn('⚠️ previewUrl est une blob URL, ignorée pour des raisons de sécurité CSP');
      } else {
        return imageData.previewUrl;
      }
    }
    // Sinon url
    if (imageData.url) {
      if (imageData.url.startsWith('blob:')) {
        console.warn('⚠️ url est une blob URL, ignorée pour des raisons de sécurité CSP');
      } else {
        return imageData.url;
      }
    }
    // Sinon filename
    if (imageData.filename) {
      const apiBase = window.API_BASE_URL || '/api';
      const encodedFilename = encodeURIComponent(imageData.filename);
      const url = `${apiBase}/doc-template/collections/${collectionId}/images/${encodedFilename}`;
      console.log('🔗 buildCollectionImageUrl depuis filename:', {
        filename: imageData.filename,
        encodedFilename,
        collectionId,
        url
      });
      return url;
    }
    // Sinon fileName
    if (imageData.fileName) {
      const apiBase = window.API_BASE_URL || '/api';
      const encodedFilename = encodeURIComponent(imageData.fileName);
      const url = `${apiBase}/doc-template/collections/${collectionId}/images/${encodedFilename}`;
      console.log('🔗 buildCollectionImageUrl depuis fileName:', {
        fileName: imageData.fileName,
        encodedFilename,
        collectionId,
        url
      });
      return url;
    }
  }
  
  return '';
}

/**
 * 🔹 Vérifie si une valeur est une image (objet avec propriétés d'image)
 * @param {*} value - Valeur à vérifier
 * @returns {boolean}
 */
function isImageValue(value) {
  if (!value) return false;
  
  // Si c'est un objet, vérifier s'il a des propriétés typiques d'une image
  if (typeof value === 'object') {
    const hasImageProperty = !!(value.previewUrl || value.url || value.filename || value.fileName);
    console.log('🔍 isImageValue check:', {
      value,
      hasImageProperty,
      keys: Object.keys(value || {}),
      previewUrl: value.previewUrl,
      url: value.url,
      filename: value.filename,
      fileName: value.fileName
    });
    return hasImageProperty;
  }
  
  return false;
}

export function replaceVariables(html, variables, template = null) {
  if (!html) return '';

  // 🔹 Créer un DOM temporaire pour parser le HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  console.log('🔄 replaceVariables appelé avec:', {
    htmlLength: html.length,
    variables: variables,
    htmlPreview: html.substring(0, 200)
  });

  // 🔹 Trouver toutes les images avec data-variable-path (variables d'image)
  const variableImages = tempDiv.querySelectorAll('img[data-variable-path]');
  
  variableImages.forEach(img => {
    const variablePath = img.dataset.variablePath;
    
    console.log('🖼️ Image variable trouvée:', {
      variablePath,
      currentSrc: img.src,
      imgHTML: img.outerHTML
    });

    // Extraire la valeur de la variable
    let value = '';
    let isImage = false;
    let collectionId = null;
    
    // Vérifier si c'est une variable de collection (contient un point)
    if (variablePath.includes('.')) {
      const [alias, ...fieldParts] = variablePath.split('.');
      const fieldName = fieldParts.join('.');
      
      if (variables.collections && variables.collections[alias]) {
        const collectionData = variables.collections[alias];
        if (collectionData.values) {
          value = collectionData.values[fieldName] ?? '';
          // Vérifier si c'est une image
          isImage = isImageValue(value);
          // Récupérer le collectionId
          collectionId = collectionData.collectionId;
          console.log(`✅ Variable image collection ${alias}.${fieldName} =`, value, 'isImage:', isImage);
        }
      }
    } else {
      // Variable simple (normalement pas d'images dans les variables simples)
      if (variables.simple && variables.simple[variablePath]) {
        value = variables.simple[variablePath] ?? '';
        isImage = isImageValue(value);
        console.log(`✅ Variable simple image ${variablePath} =`, value, 'isImage:', isImage);
      }
    }

    // Si on a trouvé une valeur d'image, remplacer le src
    if (value !== '' && isImage && collectionId) {
      const imageUrl = buildCollectionImageUrl(value, collectionId);
      if (imageUrl) {
        img.src = imageUrl;
        img.alt = variablePath;
        img.className = (img.className || '').replace('template-image', '') + ' collection-image';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        // Supprimer les attributs de variable
        delete img.dataset.imageType;
        delete img.dataset.variablePath;
        console.log(`✅ Image variable ${variablePath} remplacée avec URL:`, imageUrl);
      } else {
        console.warn(`⚠️ Impossible de construire l'URL pour l'image ${variablePath}`);
        // Garder le placeholder si on ne peut pas construire l'URL
      }
    } else {
      if (value === '') {
        console.warn(`⚠️ Variable ${variablePath} non trouvée dans variables`);
      } else if (!isImage) {
        console.warn(`⚠️ Variable ${variablePath} n'est pas une image`);
      } else if (!collectionId) {
        console.warn(`⚠️ Variable ${variablePath} est une image mais collectionId manquant`);
      }
    }
  });

  // 🔹 Trouver tous les spans avec classe template-variable
  const variableSpans = tempDiv.querySelectorAll('.template-variable');
  
  variableSpans.forEach(span => {
    const variablePath = span.dataset.variable || span.textContent.replace(/[{}]/g, '');
    const variableText = span.textContent.trim();
    
    console.log('🔍 Variable span trouvée:', {
      variablePath,
      variableText,
      spanHTML: span.outerHTML
    });

    // Extraire la valeur de la variable
    let value = '';
    let isImage = false;
    let collectionId = null;
    
    // Vérifier si c'est une variable de collection (contient un point)
    if (variablePath.includes('.')) {
      const [alias, ...fieldParts] = variablePath.split('.');
      const fieldName = fieldParts.join('.');
      
      if (variables.collections && variables.collections[alias]) {
        const collectionData = variables.collections[alias];
        if (collectionData.values) {
          value = collectionData.values[fieldName] ?? '';
          // Vérifier si c'est une image
          isImage = isImageValue(value);
          // Récupérer le collectionId
          collectionId = collectionData.collectionId;
          console.log(`✅ Variable collection ${alias}.${fieldName} =`, value, 'isImage:', isImage);
        }
      }
    } else {
      // Variable simple
      if (variables.simple && variables.simple[variablePath]) {
        value = variables.simple[variablePath] ?? '';
        isImage = isImageValue(value);
        console.log(`✅ Variable simple ${variablePath} =`, value, 'isImage:', isImage);
      }
    }

    // Si on a trouvé une valeur, remplacer le span
    if (value !== '') {
      // Si c'est une image, créer une balise <img>
      if (isImage && collectionId) {
        const imageUrl = buildCollectionImageUrl(value, collectionId);
        if (imageUrl) {
          const img = document.createElement('img');
          img.src = imageUrl;
          img.alt = variablePath;
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
          img.className = 'collection-image';
          span.parentNode.replaceChild(img, span);
          console.log(`✅ Variable image remplacée par <img> avec URL:`, imageUrl);
        } else {
          console.warn(`⚠️ Impossible de construire l'URL pour l'image ${variablePath}`);
          span.parentNode.removeChild(span);
        }
      } else {
        // Chercher le run précédent (sibling précédent avec style)
        let previousSibling = span.previousSibling;
        let runStyle = '';
        
        // Chercher le premier sibling précédent qui est un élément avec style
        while (previousSibling) {
          if (previousSibling.nodeType === Node.ELEMENT_NODE) {
            const elem = previousSibling;
            if (elem.style && elem.style.cssText) {
              // Copier les styles sauf ceux spécifiques aux variables
              runStyle = elem.style.cssText
                .split(';')
                .filter(style => {
                  const prop = style.split(':')[0].trim().toLowerCase();
                  return prop && !['background-color', 'padding', 'border-radius'].includes(prop);
                })
                .join(';');
              break;
            }
          }
          previousSibling = previousSibling.previousSibling;
        }
        
        // Si pas de run précédent, vérifier le parent
        if (!runStyle) {
          runStyle = getParentRunStyle(span);
        }
        
        // Remplacer le span par la valeur avec le style du run précédent
        if (runStyle && runStyle.trim()) {
          // Créer un span avec les styles du run précédent
          const newSpan = document.createElement('span');
          newSpan.textContent = String(value);
          newSpan.setAttribute('style', runStyle);
          span.parentNode.replaceChild(newSpan, span);
          console.log(`✅ Variable remplacée avec style du run précédent:`, runStyle);
        } else {
          // Sinon, remplacer par du texte simple (sans span)
          const textNode = document.createTextNode(String(value));
          span.parentNode.replaceChild(textNode, span);
          console.log(`✅ Variable remplacée par texte simple`);
        }
      }
    } else {
      // Si pas de valeur, supprimer quand même les styles de la variable
      // mais garder le texte {{variable}} pour debug
      span.style.backgroundColor = '';
      span.style.color = '';
      span.style.fontStyle = '';
      span.style.padding = '';
      span.style.borderRadius = '';
      span.className = '';
      console.warn(`⚠️ Variable ${variablePath} non trouvée dans variables`);
    }
  });

  // 🔹 Remplacer aussi les variables en texte brut {{variable}} (au cas où)
  // ET aussi dans les attributs src des images (pour les placeholders SVG)
  let result = tempDiv.innerHTML;

  // Remplacer les variables de collections
  if (variables.collections) {
    Object.entries(variables.collections).forEach(([alias, collectionData]) => {
      if (!collectionData || !collectionData.values) {
        console.warn(`⚠️ Collection data manquante pour alias "${alias}"`, collectionData);
        return;
      }

      const values = collectionData.values;
      const collectionId = collectionData.collectionId;
      console.log(`🔍 Remplacement variables collection "${alias}":`, values);
      
      Object.keys(values).forEach(fieldName => {
        const variablePattern = new RegExp(`\\{\\{${alias}\\.${fieldName}\\}\\}`, 'g');
        const value = values[fieldName] ?? '';
        
        console.log(`🔍 Remplacement variable ${alias}.${fieldName}:`, {
          value,
          isImage: isImageValue(value),
          collectionId,
          valueType: typeof value,
          valueKeys: typeof value === 'object' ? Object.keys(value || {}) : null
        });
        
        // Si c'est une image, créer une balise <img>
        if (isImageValue(value) && collectionId) {
          const imageUrl = buildCollectionImageUrl(value, collectionId);
          console.log(`🖼️ Image détectée pour ${alias}.${fieldName}, URL construite:`, imageUrl);
          if (imageUrl) {
            const imgTag = `<img src="${imageUrl}" alt="${alias}.${fieldName}" class="collection-image" style="max-width: 100%; height: auto;" />`;
            result = result.replace(variablePattern, imgTag);
            console.log(`✅ Variable ${alias}.${fieldName} remplacée par image avec URL:`, imageUrl);
            
            // AUSSI remplacer dans les attributs src des images existantes qui contiennent le placeholder
            // (pour les images avec data-variable-path qui n'ont pas été traitées ci-dessus)
            const srcPattern = new RegExp(`(src=["'])([^"']*\\{\\{${alias}\\.${fieldName}\\}\\}[^"']*)(["'])`, 'gi');
            result = result.replace(srcPattern, (match, prefix, srcContent, suffix) => {
              // Remplacer le placeholder dans le src par l'URL réelle
              const newSrc = srcContent.replace(variablePattern, imageUrl);
              return `${prefix}${newSrc}${suffix}`;
            });
          } else {
            console.warn(`⚠️ Impossible de construire l'URL pour ${alias}.${fieldName}, valeur:`, value);
            result = result.replace(variablePattern, '');
          }
        } else {
          if (isImageValue(value) && !collectionId) {
            console.warn(`⚠️ Image détectée pour ${alias}.${fieldName} mais collectionId manquant`);
          }
          result = result.replace(variablePattern, String(value));
        }
      });
    });
  }

  // Remplacer les variables simples
  if (variables.simple) {
    Object.entries(variables.simple).forEach(([varName, value]) => {
      const variablePattern = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
      // Pour les variables simples, on ne gère pas les images (elles sont dans les collections)
      result = result.replace(variablePattern, String(value ?? ''));
    });
  }

  // 🔹 Nettoyer les variables non remplacées (pour debug)
  const remainingVars = result.match(/\{\{[^}]+\}\}/g);
  if (remainingVars && remainingVars.length > 0) {
    console.warn('⚠️ Variables non remplacées:', remainingVars);
  }

  return result;
}

/**
 * 🔹 Extrait toutes les variables d'un template HTML
 * 
 * @param {string} html - HTML du template
 * @returns {Array} Liste des variables trouvées [{ type: 'simple'|'collection', path: '...', alias?: '...', field?: '...' }]
 */
export function extractVariables(html) {
  if (!html) return [];

  const variables = [];
  const variableRegex = /\{\{([^}]+)\}\}/g;
  let match;

  while ((match = variableRegex.exec(html)) !== null) {
    const fullPath = match[1].trim();
    
    // Vérifier si c'est une variable de collection (contient un point)
    if (fullPath.includes('.')) {
      const [alias, ...fieldParts] = fullPath.split('.');
      const field = fieldParts.join('.');
      
      variables.push({
        type: 'collection',
        path: fullPath,
        alias: alias,
        field: field
      });
    } else {
      variables.push({
        type: 'simple',
        path: fullPath
      });
    }
  }

  // Dédupliquer
  const unique = [];
  const seen = new Set();
  
  variables.forEach(v => {
    if (!seen.has(v.path)) {
      seen.add(v.path);
      unique.push(v);
    }
  });

  return unique;
}

/**
 * 🔹 Extrait les variables d'un template et les groupe par type
 * 
 * @param {string} html - HTML du template
 * @param {Object} template - Template avec defaultCollection et additionalCollections
 * @returns {Object} { simple: [...], collections: { alias: { collectionId, fields: [...] } } }
 */
export function extractAndGroupVariables(html, template) {
  const allVariables = extractVariables(html);
  
  const result = {
    simple: [],
    collections: {}
  };

  allVariables.forEach(v => {
    if (v.type === 'simple') {
      result.simple.push(v.path);
    } else if (v.type === 'collection') {
      const alias = v.alias;
      
      if (!result.collections[alias]) {
        // Trouver la collection correspondante
        let collectionInfo = null;
        
        // Vérifier defaultCollection
        if (template.defaultCollection && template.defaultCollection.alias === alias) {
          collectionInfo = template.defaultCollection;
        } else {
          // Vérifier additionalCollections
          const additional = template.additionalCollections || [];
          collectionInfo = additional.find(c => c.alias === alias);
        }
        
        result.collections[alias] = {
          collectionId: collectionInfo?.collectionId || null,
          alias: alias,
          fields: []
        };
      }
      
      if (!result.collections[alias].fields.includes(v.field)) {
        result.collections[alias].fields.push(v.field);
      }
    }
  });

  return result;
}

