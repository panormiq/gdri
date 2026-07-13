/**
 * FICHIER : modules/gderpi/backend/services/uploads/saveGderpiDocumentFile.js
 * RÔLE : Enregistre un document tiers (client / fournisseur) sur disque.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const validateGderpiDocumentMime = require('./validateGderpiDocumentMime');
const buildGderpiImageMediaPath = require('./buildGderpiImageMediaPath');

const ALLOWED_SCOPES = new Set(['client-document', 'fournisseur-document']);

const EXT_BY_MIME = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp'
};

function resolveScope(scope) {
  const raw = String(scope || '').trim().toLowerCase();
  if (!ALLOWED_SCOPES.has(raw)) {
    throw new Error('Scope document invalide');
  }
  return raw;
}

function resolveExtension(file) {
  const mime = String(file.mimetype || '').toLowerCase();
  const fromMime = EXT_BY_MIME[mime];
  if (fromMime) return fromMime;
  const fromName = path.extname(file.originalname || '').toLowerCase();
  if (fromName && fromName.length <= 6) return fromName;
  return '.bin';
}

function writeUploadedFile(file, targetPath) {
  if (file.buffer && Buffer.isBuffer(file.buffer)) {
    fs.writeFileSync(targetPath, file.buffer);
    return;
  }
  if (file.path && fs.existsSync(file.path)) {
    try {
      fs.renameSync(file.path, targetPath);
    } catch (err) {
      if (err.code === 'EXDEV' || err.code === 'ENOENT') {
        fs.copyFileSync(file.path, targetPath);
        try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }
        return;
      }
      throw err;
    }
    return;
  }
  throw new Error('Fichier upload invalide ou introuvable');
}

function saveGderpiDocumentFile(entrepriseId, scope, file) {
  if (!file) throw new Error('Fichier upload invalide');
  const ent = String(entrepriseId || '').trim();
  if (!ent) throw new Error('Entreprise non identifiée');
  if (!validateGderpiDocumentMime(file.mimetype)) {
    throw new Error('Format non supporté (PDF, Word, Excel, texte, CSV ou image).');
  }

  const safeScope = resolveScope(scope);
  const ext = resolveExtension(file);
  const filename = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const uploadRoot = path.join(__dirname, '../../uploads');
  const targetDir = path.join(uploadRoot, ent, safeScope);
  fs.mkdirSync(targetDir, { recursive: true });

  const targetPath = path.join(targetDir, filename);
  writeUploadedFile(file, targetPath);

  return {
    filename,
    scope: safeScope,
    mediaPath: buildGderpiImageMediaPath(ent, safeScope, filename),
    absolutePath: targetPath,
    mimeType: String(file.mimetype || '').toLowerCase(),
    originalName: String(file.originalname || filename).trim(),
    sizeBytes: Number(file.size) || 0
  };
}

module.exports = { saveGderpiDocumentFile, ALLOWED_SCOPES };
