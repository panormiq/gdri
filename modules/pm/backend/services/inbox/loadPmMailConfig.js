/**
 * FICHIER : modules/pm/backend/services/inbox/loadPmMailConfig.js
 * RÔLE : Charge la config mail dédiée PM (mail_configs module_name=pm).
 */

const path = require('path');
const database = require(path.join(__dirname, '../../../../../backend/config/database'));

function resolveImapFromConfig(config) {
  if (!config || typeof config !== 'object') return null;
  if (config.imap_config && typeof config.imap_config === 'object') {
    return config.imap_config;
  }
  if (Array.isArray(config.profils_imap) && Array.isArray(config.comptes)) {
    const byId = Object.fromEntries(config.profils_imap.map((p) => [p.id, p]));
    const compte = config.comptes.find((c) => c.profil_imap_id);
    if (!compte || !byId[compte.profil_imap_id]) return null;
    const profil = byId[compte.profil_imap_id];
    return {
      host: profil.host,
      port: profil.port,
      secure: profil.secure !== false,
      user: compte.email || compte.login,
      password: compte.password,
      mailbox: compte.imap_mailbox || 'INBOX'
    };
  }
  return null;
}

async function loadPmMailConfig(entrepriseId) {
  const col = await database.getCollection('mail_configs');
  let doc = await col.findOne({
    module_name: 'pm',
    entity_id: String(entrepriseId)
  });

  if (!doc?.config?.imap_config && !doc?.config?.profils_imap) {
    doc = await col.findOne({
      module_name: 'mail',
      entity_id: String(entrepriseId)
    });
  }

  const imap = resolveImapFromConfig(doc?.config);
  return {
    imap,
    config: doc?.config || null,
    inheritedFrom: doc?.module_name || null
  };
}

module.exports = loadPmMailConfig;
