/**
 * Utilitaires pour formater la numérotation des sections
 */

/**
 * Convertit un index (0-based) en numérotation selon le type
 * @param {number} index - Index de la section (0-based)
 * @param {string} type - Type de numérotation: 'numeric', 'alpha', 'alphaUpper', 'roman', 'romanUpper', 'custom'
 * @param {string} customFormat - Format personnalisé (ex: 'Section {n}') utilisé si type === 'custom'
 * @returns {string} - Numérotation formatée
 */
export function formatNumbering(index, type = 'numeric', customFormat = '{n}.') {
  // index est 0-based, on le convertit en 1-based pour la numérotation
  const num = index + 1;

  switch (type) {
    case 'numeric':
      return `${num}.`;
    
    case 'alpha':
      // a, b, c, ..., z, aa, ab, ...
      return `${numberToAlpha(num, false)}.`;
    
    case 'alphaUpper':
      // A, B, C, ..., Z, AA, AB, ...
      return `${numberToAlpha(num, true)}.`;
    
    case 'roman':
      // i, ii, iii, iv, v, ...
      return `${numberToRoman(num).toLowerCase()}.`;
    
    case 'romanUpper':
      // I, II, III, IV, V, ...
      return `${numberToRoman(num)}.`;
    
    case 'custom':
      // Format personnalisé avec {n} comme placeholder pour le numéro
      return customFormat.replace('{n}', num);
    
    default:
      return `${num}.`;
  }
}

/**
 * Convertit un nombre en lettre(s) alphabétique(s)
 * @param {number} num - Nombre à convertir (1-based)
 * @param {boolean} uppercase - true pour majuscules, false pour minuscules
 * @returns {string} - Lettre(s) alphabétique(s)
 */
function numberToAlpha(num, uppercase = false) {
  if (num <= 0) return '';
  
  const base = uppercase ? 'A' : 'a';
  const charCodeA = base.charCodeAt(0);
  let result = '';
  let n = num - 1; // Convertir en 0-based
  
  while (n >= 0) {
    result = String.fromCharCode(charCodeA + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  
  return result;
}

/**
 * Convertit un nombre en chiffres romains
 * @param {number} num - Nombre à convertir (1-based)
 * @returns {string} - Chiffres romains
 */
function numberToRoman(num) {
  if (num <= 0 || num > 3999) return num.toString();
  
  const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const symbols = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  
  let result = '';
  let n = num;
  
  for (let i = 0; i < values.length; i++) {
    const count = Math.floor(n / values[i]);
    if (count > 0) {
      result += symbols[i].repeat(count);
      n -= values[i] * count;
    }
  }
  
  return result;
}

/**
 * Calcule la numérotation hiérarchique d'une section
 * @param {Array} sectionPath - Chemin de la section dans la hiérarchie [parentIndex, childIndex, ...]
 * @param {string} type - Type de numérotation: 'numeric', 'alpha', 'alphaUpper', 'roman', 'romanUpper', 'custom'
 * @param {string} customFormat - Format personnalisé utilisé si type === 'custom'
 * @returns {string} - Numérotation hiérarchique formatée (ex: "1.1", "1.2.1")
 */
export function formatHierarchicalNumbering(sectionPath, type = 'numeric', customFormat = '{n}.') {
  if (!sectionPath || sectionPath.length === 0) return '';
  
  // sectionPath est un tableau [indexNiveau1, indexNiveau2, indexNiveau3, ...]
  // Chaque index est 0-based, on le convertit en 1-based pour la numérotation
  const parts = sectionPath.map(index => {
    const num = index + 1;
    
    switch (type) {
      case 'numeric':
        return num.toString();
      
      case 'alpha':
        return numberToAlpha(num, false);
      
      case 'alphaUpper':
        return numberToAlpha(num, true);
      
      case 'roman':
        return numberToRoman(num).toLowerCase();
      
      case 'romanUpper':
        return numberToRoman(num);
      
      case 'custom':
        return customFormat.replace('{n}', num);
      
      default:
        return num.toString();
    }
  });
  
  return parts.join('.') + '.';
}

