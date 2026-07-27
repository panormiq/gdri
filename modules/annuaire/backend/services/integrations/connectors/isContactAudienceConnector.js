/**
 * FICHIER : modules/annuaire/backend/services/integrations/connectors/isContactAudienceConnector.js
 * RÔLE : Détermine si un connecteur cible les contacts (hôte Annuaire).
 */

const FALLBACK_IDS = new Set(['mail-in', 'mail-out', 'facebook']);

function isContactAudienceConnector(manifest, connectorId) {
  const id = String(connectorId || '').trim();
  if (!manifest) return FALLBACK_IDS.has(id);

  if (String(manifest.audience || '').trim() === 'contact') return true;

  const hosts = Array.isArray(manifest.hosts) ? manifest.hosts : [];
  if (hosts.map(String).includes('annuaire')) return true;

  return FALLBACK_IDS.has(id);
}

module.exports = isContactAudienceConnector;
