/**
 * FICHIER : modules/banque/backend/services/parsing/cleanOperationBlock.js
 * RÔLE : Aplati un bloc d'opération et coupe les artefacts de pagination/en-tête.
 */

const normalizeSpaces = require('./normalizeSpaces');

function cleanOperationBlock(rawBlock) {
  let flat = normalizeSpaces(rawBlock);

  // Couper les artefacts de pagination/entete qui polluent parfois la fin d'une ligne.
  const cutMarkers = [
    /\bop[ée]\.\s*date\b/i,
    /\bRELEVE DE COMPTES EN EUROS\b/i,
    /\bDate d[' ]arr[êe]t[ée]\b/i,
    /\(suite\)/i,
    /\bPage\s+\d+\b/i
  ];

  for (const marker of cutMarkers) {
    const match = flat.match(marker);
    if (match && typeof match.index === 'number') {
      flat = flat.slice(0, match.index).trim();
    }
  }

  // Nettoyage ponctuel de symboles bruit.
  flat = flat.replace(/[þ¨]+/g, ' ');
  return normalizeSpaces(flat);
}

module.exports = cleanOperationBlock;
