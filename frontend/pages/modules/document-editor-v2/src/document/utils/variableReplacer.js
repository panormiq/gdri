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

export function replaceVariables(html, variables) {
  if (!html) return '';

  // 🔹 Créer un DOM temporaire pour parser le HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  console.log('🔄 replaceVariables appelé avec:', {
    htmlLength: html.length,
    variables: variables,
    htmlPreview: html.substring(0, 200)
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
    
    // Vérifier si c'est une variable de collection (contient un point)
    if (variablePath.includes('.')) {
      const [alias, ...fieldParts] = variablePath.split('.');
      const fieldName = fieldParts.join('.');
      
      if (variables.collections && variables.collections[alias]) {
        const collectionData = variables.collections[alias];
        if (collectionData.values) {
          value = collectionData.values[fieldName] ?? '';
          console.log(`✅ Variable collection ${alias}.${fieldName} =`, value);
        }
      }
    } else {
      // Variable simple
      if (variables.simple && variables.simple[variablePath]) {
        value = variables.simple[variablePath] ?? '';
        console.log(`✅ Variable simple ${variablePath} =`, value);
      }
    }

    // Si on a trouvé une valeur, remplacer le span
    if (value !== '') {
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
  let result = tempDiv.innerHTML;

  // Remplacer les variables de collections
  if (variables.collections) {
    Object.entries(variables.collections).forEach(([alias, collectionData]) => {
      if (!collectionData || !collectionData.values) {
        console.warn(`⚠️ Collection data manquante pour alias "${alias}"`, collectionData);
        return;
      }

      const values = collectionData.values;
      console.log(`🔍 Remplacement variables collection "${alias}":`, values);
      
      Object.keys(values).forEach(fieldName => {
        const variablePattern = new RegExp(`\\{\\{${alias}\\.${fieldName}\\}\\}`, 'g');
        const value = values[fieldName] ?? '';
        result = result.replace(variablePattern, String(value));
      });
    });
  }

  // Remplacer les variables simples
  if (variables.simple) {
    Object.entries(variables.simple).forEach(([varName, value]) => {
      const variablePattern = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
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

