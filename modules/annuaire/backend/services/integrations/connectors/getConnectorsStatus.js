/**
 * FICHIER : modules/annuaire/backend/services/integrations/connectors/getConnectorsStatus.js
 * RÔLE : Statut des connecteurs « contact » pour l’Annuaire (disponible / configuré / activé).
 */

const path = require('path');
const database = require(path.join(__dirname, '../../../../../../backend/config/database'));
const { connectorRegistry } = require(path.join(
  __dirname,
  '../../../../../../backend/core/connectors/connector-loader'
));
const { ConnectorInstanceService } = require(path.join(
  __dirname,
  '../../../../../../backend/core/connectors/ConnectorInstanceService'
));
const isContactAudienceConnector = require('./isContactAudienceConnector');
const isConnectorConfigured = require('./isConnectorConfigured');

async function hasFacebookLegacyConfig(entrepriseId) {
  try {
    const doc = await database.getCollection('facebook_configs').findOne({
      entrepriseId: String(entrepriseId),
      pageAccessToken: { $exists: true, $nin: [null, ''] }
    });
    return Boolean(doc);
  } catch (_) {
    return false;
  }
}

async function getConnectorsStatus(entrepriseId) {
  const eid = String(entrepriseId || '').trim();
  if (!eid) {
    return { connectors: [] };
  }

  const instanceService = new ConnectorInstanceService(database);
  const allInstances = await instanceService.listByEntreprise(eid);
  const facebookLegacyConfigured = await hasFacebookLegacyConfig(eid);

  const registered = connectorRegistry.list();
  const byId = new Map(registered.map((c) => [c.id, c]));

  const candidateIds = new Set();
  registered.forEach((c) => {
    const manifest = connectorRegistry.getManifest(c.id);
    if (isContactAudienceConnector(manifest, c.id)) {
      candidateIds.add(c.id);
    }
  });
  ['mail-in', 'mail-out', 'facebook'].forEach((id) => candidateIds.add(id));

  const connectors = Array.from(candidateIds)
    .sort()
    .map((id) => {
      const meta = byId.get(id);
      const manifest = connectorRegistry.getManifest(id);
      const available = Boolean(meta || manifest);
      const instances = allInstances.filter((i) => String(i.connectorId) === id);
      const configured = available
        ? isConnectorConfigured(id, instances, { facebookLegacyConfigured })
        : false;
      const enabled = configured && (
        instances.some((i) => i.enabled !== false)
        || (id === 'facebook' && facebookLegacyConfigured && instances.length === 0)
      );

      return {
        id,
        name: (meta && meta.name) || (manifest && manifest.name) || id,
        available,
        configured,
        enabled,
        instanceCount: instances.length,
        audience: (manifest && manifest.audience) || (available ? 'contact' : null),
        hosts: (manifest && Array.isArray(manifest.hosts)) ? manifest.hosts : (available ? ['annuaire'] : [])
      };
    })
    .filter((c) => c.available || ['mail-in', 'mail-out', 'facebook'].includes(c.id));

  return { connectors };
}

module.exports = getConnectorsStatus;
