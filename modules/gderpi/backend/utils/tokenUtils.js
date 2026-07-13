/**
 * Tokens publics GDERPI (devis PDF / validation client)
 */

const crypto = require('crypto');

const PREFIX = 'gd';

function generatePublicToken(entrepriseId) {
  const secret = crypto.randomBytes(32).toString('hex');
  const payload = JSON.stringify({ v: 1, e: String(entrepriseId), s: secret });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

function parsePublicToken(token) {
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

module.exports = { generatePublicToken, parsePublicToken, hashToken, PREFIX };
