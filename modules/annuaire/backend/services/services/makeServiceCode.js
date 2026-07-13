/**
 * FICHIER : modules/annuaire/backend/services/services/makeServiceCode.js
 */

function makeServiceCode(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'service';
}

module.exports = makeServiceCode;
