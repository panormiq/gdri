/**
 * FICHIER : modules/gderpi/backend/services/uploads/saveGderpiImageFile.js
 * RÔLE : Déplace un fichier temporaire vers le stockage GDERPI par entreprise/scope.
 *
 * ENTRÉES : entrepriseId, scope, multer file
 * SORTIES : { filename, scope, publicPath, absolutePath }
 *
 * DÉPEND DE : validateGderpiImageMime, buildGderpiImagePublicPath
 * NE PAS : réponse HTTP
 *
 * APPELÉ PAR : uploadController.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const validateGderpiImageMime = require('./validateGderpiImageMime');
const buildGderpiImagePublicPath = require('./buildGderpiImagePublicPath');

const ALLOWED_SCOPES = new Set(['boutique-logo', 'article-image', 'misc']);

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg'
};

function resolveScope(scope) {
  const raw = String(scope || 'misc').trim().toLowerCase();
  return ALLOWED_SCOPES.has(raw) ? raw : 'misc';
}

function resolveExtension(file) {
  const mime = String(file.mimetype || '').toLowerCase();
  const fromMime = EXT_BY_MIME[mime];
  if (fromMime) return fromMime;
  const fromName = path.extname(file.originalname || '').toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
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

function saveGderpiImageFile(entrepriseId, scope, file) {
  if (!file) {
    throw new Error('Fichier upload invalide');
  }
  const ent = String(entrepriseId || '').trim();
  if (!ent) {
    throw new Error('Entreprise non identifiée');
  }
  if (!validateGderpiImageMime(file.mimetype)) {
    throw new Error('Format image non supporté (JPEG, PNG, GIF, WebP, SVG).');
  }

  const safeScope = resolveScope(scope);
  const ext = resolveExtension(file);
  const filename = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const uploadRoot = path.join(__dirname, '../../uploads');
  const targetDir = path.join(uploadRoot, ent, safeScope);
  fs.mkdirSync(targetDir, { recursive: true });

  const targetPath = path.join(targetDir, filename);
  writeUploadedFile(file, targetPath);

  const publicPath = buildGderpiImagePublicPath(ent, safeScope, filename);
  return {
    filename,
    scope: safeScope,
    publicPath,
    absolutePath: targetPath
  };
}

module.exports = saveGderpiImageFile;
