/**
 * Lecture de chemins dans un objet (notation pointée ou $.a.b).
 * Fichier : backend/core/connectors/path-utils.js
 */

/**
 * @param {Object} obj
 * @param {string} path
 * @returns {*}
 */
function getByPath(obj, path) {
  if (obj == null || path == null || path === '') return undefined;

  let normalized = String(path).trim();
  if (normalized.startsWith('$.')) {
    normalized = normalized.slice(2);
  } else if (normalized === '$') {
    return obj;
  }

  const parts = normalized.split('.').filter(Boolean);
  let cursor = obj;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

module.exports = { getByPath };
