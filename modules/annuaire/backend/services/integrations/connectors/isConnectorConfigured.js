/**
 * FICHIER : modules/annuaire/backend/services/integrations/connectors/isConnectorConfigured.js
 * RÔLE : Heuristique « configuré » pour un connecteur contact (instances + legacy FB).
 */

function hasAccountRef(instance) {
  const ref = instance?.settings?.accountRef;
  return Boolean(ref != null && String(ref).trim());
}

function hasPageId(instance) {
  const pageId = instance?.settings?.pageId;
  return Boolean(pageId != null && String(pageId).trim());
}

/**
 * @param {string} connectorId
 * @param {Object[]} instances - instances du même connectorId
 * @param {{ facebookLegacyConfigured?: boolean }} [opts]
 */
function isConnectorConfigured(connectorId, instances, opts = {}) {
  const id = String(connectorId || '').trim();
  const list = Array.isArray(instances) ? instances : [];

  if (id === 'facebook') {
    if (list.some(hasPageId)) return true;
    return Boolean(opts.facebookLegacyConfigured);
  }

  if (id === 'mail-in' || id === 'mail-out') {
    return list.some(hasAccountRef) || list.length > 0;
  }

  return list.length > 0;
}

module.exports = isConnectorConfigured;
