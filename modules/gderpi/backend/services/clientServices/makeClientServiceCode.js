/**
 * FICHIER : modules/gderpi/backend/services/clientServices/makeClientServiceCode.js
 */

function makeClientServiceCode(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'service';
}

module.exports = makeClientServiceCode;
