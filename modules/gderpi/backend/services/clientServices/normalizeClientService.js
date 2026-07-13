/**
 * FICHIER : modules/gderpi/backend/services/clientServices/normalizeClientService.js
 */

const crypto = require('crypto');
const makeClientServiceCode = require('./makeClientServiceCode');

function normalizeClientService(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const libelle = String(s.libelle || '').trim();
  const codeRaw = String(s.code || '').trim();
  const sortOrder = Number(s.sortOrder);
  return {
    id: String(s.id || s.clientServiceId || '').trim() || crypto.randomUUID(),
    code: makeClientServiceCode(codeRaw || libelle),
    libelle: libelle || codeRaw,
    actif: s.actif !== false,
    sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 0,
    createdAt: s.createdAt || null,
    updatedAt: s.updatedAt || null
  };
}

module.exports = normalizeClientService;
