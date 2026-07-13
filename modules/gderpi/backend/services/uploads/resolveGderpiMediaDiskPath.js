/**
 * FICHIER : modules/gderpi/backend/services/uploads/resolveGderpiMediaDiskPath.js
 * RÔLE : Résout le chemin disque d'un média GDERPI (image ou document).
 */

const fs = require('fs');
const path = require('path');

const ALLOWED_SCOPES = new Set([
  'boutique-logo',
  'article-image',
  'misc',
  'client-document',
  'fournisseur-document'
]);

function safeSegment(value, label) {
  const raw = String(value || '').trim();
  if (!raw || raw.includes('..') || raw.includes('/') || raw.includes('\\')) {
    throw new Error(`${label} invalide`);
  }
  return raw;
}

function resolveGderpiMediaDiskPath(entrepriseId, scope, filename) {
  const ent = safeSegment(entrepriseId, 'Entreprise');
  const sc = String(scope || 'misc').trim().toLowerCase();
  if (!ALLOWED_SCOPES.has(sc)) {
    throw new Error('Scope média invalide');
  }
  const name = safeSegment(filename, 'Fichier');

  const uploadRoot = path.resolve(path.join(__dirname, '../../uploads'));
  const filePath = path.resolve(uploadRoot, ent, sc, name);
  if (!filePath.startsWith(uploadRoot + path.sep)) {
    throw new Error('Chemin média refusé');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error('Fichier introuvable');
  }
  return filePath;
}

module.exports = resolveGderpiMediaDiskPath;
