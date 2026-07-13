/**
 * Résolution de templates {{var}} pour connecteurs génériques.
 * Fichier : backend/core/connectors/template-resolver.js
 */

const { getByPath } = require('./path-utils');

/**
 * @param {string} template
 * @param {Object} context
 * @returns {string}
 */
function resolveTemplate(template, context = {}) {
  if (template == null) return '';
  return String(template).replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, key) => {
    const value = getByPath(context, key.trim());
    return value == null ? '' : String(value);
  });
}

/**
 * @param {*} value
 * @param {Object} context
 * @returns {*}
 */
function resolveDeep(value, context) {
  if (typeof value === 'string') {
    return resolveTemplate(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveDeep(item, context));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveDeep(v, context);
    }
    return out;
  }
  return value;
}

module.exports = {
  resolveTemplate,
  resolveDeep
};
