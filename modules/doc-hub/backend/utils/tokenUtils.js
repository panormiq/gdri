/**
 * Tokens de téléchargement publics
 * Format URL : base64url (v2). Legacy : dh:entrepriseId:secret
 */

const crypto = require('crypto');

const PREFIX = 'dh';

function generateDownloadToken(entrepriseId) {
  const secret = crypto.randomBytes(32).toString('hex');
  const payload = JSON.stringify({ v: 2, e: String(entrepriseId), s: secret });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

function parseDownloadToken(token) {
  if (!token || typeof token !== 'string') return null;

  let raw = String(token).trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }

  if (raw.startsWith(`${PREFIX}:`)) {
    const parts = raw.split(':');
    if (parts.length === 3 && parts[0] === PREFIX) {
      return { entrepriseId: parts[1], secret: parts[2], legacy: true };
    }
  }

  try {
    const json = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (json && json.e && json.s) {
      return { entrepriseId: String(json.e), secret: String(json.s), legacy: false };
    }
  } catch {
    /* invalid */
  }

  return null;
}

function hashToken(token) {
  let raw = String(token).trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* keep */
  }
  return crypto.createHash('sha256').update(raw).digest('hex');
}

module.exports = { generateDownloadToken, parseDownloadToken, hashToken, PREFIX };
