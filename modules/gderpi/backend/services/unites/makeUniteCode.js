/**
 * FICHIER : modules/gderpi/backend/services/unites/makeUniteCode.js
 * RÔLE : Génère un code unité URL-safe.
 *
 * ENTRÉES : string libellé ou code
 * SORTIES : code lowercase
 *
 * DÉPEND DE : aucun
 * NE PAS : persistance
 *
 * APPELÉ PAR : normalizeUnite.js
 */

function makeUniteCode(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'unite';
}

module.exports = makeUniteCode;
