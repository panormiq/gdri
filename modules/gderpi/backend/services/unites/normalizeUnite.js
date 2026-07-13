/**
 * FICHIER : modules/gderpi/backend/services/unites/normalizeUnite.js
 * RÔLE : Normalise une unité de mesure catalogue.
 *
 * ENTRÉES : raw objet unité
 * SORTIES : unité normalisée
 *
 * DÉPEND DE : crypto, makeUniteCode.js
 * NE PAS : persistance Mongo
 *
 * APPELÉ PAR : createUnite.js, updateUnite.js, toUniteEntry.js
 */

const crypto = require('crypto');
const makeUniteCode = require('./makeUniteCode');

function normalizeUnite(raw) {
  const u = raw && typeof raw === 'object' ? raw : {};
  const libelle = String(u.libelle || '').trim();
  const codeRaw = String(u.code || '').trim();
  const sortOrder = Number(u.sortOrder);
  return {
    id: String(u.id || u.uniteId || '').trim() || crypto.randomUUID(),
    code: makeUniteCode(codeRaw || libelle),
    libelle: libelle || codeRaw,
    actif: u.actif !== false,
    sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 0,
    createdAt: u.createdAt || null,
    updatedAt: u.updatedAt || null
  };
}

module.exports = normalizeUnite;
