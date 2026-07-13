/**
 * FICHIER : modules/annuaire/backend/services/services/normalizeService.js
 */

const crypto = require('crypto');
const makeServiceCode = require('./makeServiceCode');

function normalizeService(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const libelle = String(s.libelle || '').trim();
  const codeRaw = String(s.code || '').trim();
  const sortOrder = Number(s.sortOrder);
  return {
    id: String(s.id || s.serviceId || '').trim() || crypto.randomUUID(),
    organisationId: String(s.organisationId || '').trim() || null,
    code: makeServiceCode(codeRaw || libelle),
    libelle: libelle || codeRaw,
    actif: s.actif !== false,
    sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 0
  };
}

module.exports = normalizeService;
