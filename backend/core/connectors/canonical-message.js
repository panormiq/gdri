/**
 * Message canonique — format d'échange entre connecteurs et agents.
 * Fichier : backend/core/connectors/canonical-message.js
 */

const crypto = require('crypto');

/**
 * @param {Object} partial
 * @returns {Object}
 */
function createCanonicalMessage(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: partial.id || `evt-${crypto.randomUUID()}`,
    source: String(partial.source || 'unknown'),
    sourceRef: partial.sourceRef != null ? String(partial.sourceRef) : null,
    entrepriseId: partial.entrepriseId != null ? String(partial.entrepriseId) : null,
    instanceId: partial.instanceId != null ? String(partial.instanceId) : null,
    text: partial.text != null ? String(partial.text) : '',
    from: partial.from
      || (partial.author && (partial.author.email || partial.author.name))
      || '',
    subject: partial.subject
      || (partial.metadata && partial.metadata.subject)
      || '',
    channel: partial.channel || '',
    author: {
      id: partial.author?.id != null ? String(partial.author.id) : null,
      name: partial.author?.name != null ? String(partial.author.name) : null,
      email: partial.author?.email != null ? String(partial.author.email) : null
    },
    timestamp: partial.timestamp || now,
    attachments: Array.isArray(partial.attachments) ? partial.attachments : [],
    metadata: partial.metadata && typeof partial.metadata === 'object' ? partial.metadata : {}
  };
}

/**
 * Applique un mapping { champCanonique: cheminSource } sur un objet brut.
 * @param {Object} raw
 * @param {Object} mapping
 * @param {Object} base
 * @returns {Object}
 */
function mapToCanonical(raw, mapping, base = {}) {
  const { getByPath } = require('./path-utils');
  const out = { ...base };

  if (!mapping || typeof mapping !== 'object') {
    out.text = out.text || String(raw?.text || raw?.message || raw?.body || '');
    return createCanonicalMessage(out);
  }

  for (const [target, sourcePath] of Object.entries(mapping)) {
    if (!sourcePath) continue;
    const value = getByPath(raw, sourcePath);
    if (value === undefined) continue;

    if (target.includes('.')) {
      const parts = target.split('.');
      let cursor = out;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') {
          cursor[parts[i]] = {};
        }
        cursor = cursor[parts[i]];
      }
      cursor[parts[parts.length - 1]] = value;
    } else {
      out[target] = value;
    }
  }

  return createCanonicalMessage(out);
}

module.exports = {
  createCanonicalMessage,
  mapToCanonical
};
