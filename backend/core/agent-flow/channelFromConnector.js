/**
 * Mapping connecteur ↔ provider Données / canal de contexte.
 * Fichier : backend/core/agent-flow/channelFromConnector.js
 */

function providerFromConnectorId(connectorId) {
  const id = String(connectorId || '').toLowerCase();
  if (id === 'http-generic' || id === 'http') return 'http';
  if (id === 'mail-in' || id === 'mail-out' || id === 'mail') return 'mail';
  if (id === 'facebook' || id === 'facebook-out') return 'facebook';
  return id || 'manual';
}

function connectorIdFromProvider(provider) {
  const p = String(provider || '').toLowerCase();
  if (p === 'http') return 'http-generic';
  if (p === 'mail') return 'mail-in';
  if (p === 'facebook') return 'facebook';
  return p;
}

module.exports = {
  providerFromConnectorId,
  connectorIdFromProvider
};
