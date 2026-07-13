/**
 * Synchronise les instances mail-in / mail-out depuis les comptes mail (mail_configs).
 * L'admin ne crée qu'un compte ; les connecteurs entrant/sortant sont dérivés automatiquement.
 */

const { ConnectorInstanceService } = require('./ConnectorInstanceService');
const connectorRegistry = require('./ConnectorRegistry');
const { buildInstancePayload } = require('./instance-defaults');

function accountSyncKey(connectorId, accountRef) {
  return `${connectorId}:${String(accountRef)}`;
}

function listAccountsFromConfig(config) {
  if (!config || !Array.isArray(config.comptes)) return [];
  const imapById = Object.fromEntries((config.profils_imap || []).map((p) => [p.id, p]));
  const smtpById = Object.fromEntries((config.profils_smtp || []).map((p) => [p.id, p]));

  return config.comptes
    .map((c) => {
      const id = String(c.id || c.email || '');
      if (!id) return null;
      const imapProfil = c.profil_imap_id ? imapById[c.profil_imap_id] : null;
      const smtpProfil = c.profil_smtp_id ? smtpById[c.profil_smtp_id] : null;
      return {
        id,
        label: String(c.from_name || c.email || id),
        email: String(c.email || ''),
        hasImap: !!(imapProfil && imapProfil.host && c.email),
        hasSmtp: !!(smtpProfil && smtpProfil.host && c.email),
        mailbox: c.imap_mailbox || 'INBOX',
        enabled: c.enabled !== false
      };
    })
    .filter(Boolean);
}

async function upsertAutoInstance(instanceService, entrepriseId, connectorId, account, extraSettings = {}) {
  const key = accountSyncKey(connectorId, account.id);
  const col = instanceService.col();
  const now = new Date();
  const manifest = connectorRegistry.getManifest(connectorId);
  const template = buildInstancePayload(manifest, {
    connectorId,
    settings: {
      autoSynced: true,
      mailAccountKey: key,
      accountRef: account.id,
      ...extraSettings
    }
  });

  const existing = await col.findOne({
    entrepriseId: String(entrepriseId),
    connectorId,
    'settings.mailAccountKey': key
  });

  const doc = {
    entrepriseId: String(entrepriseId),
    connectorId,
    name: `${account.label} (${connectorId === 'mail-in' ? 'entrant' : 'sortant'})`,
    enabled: account.enabled,
    settings: template.settings,
    mapping: template.mapping,
    ingestModes: template.ingestModes,
    credentials: template.credentials || {},
    presetId: template.presetId || 'default',
    updated_at: now
  };

  if (existing) {
    await col.updateOne(
      { _id: existing._id },
      {
        $set: {
          name: doc.name,
          enabled: doc.enabled,
          settings: { ...(existing.settings || {}), ...doc.settings },
          mapping: doc.mapping,
          ingestModes: doc.ingestModes,
          presetId: doc.presetId,
          updated_at: now
        }
      }
    );
    return String(existing._id);
  }

  const result = await col.insertOne({
    ...doc,
    cursor: null,
    created_at: now
  });
  return String(result.insertedId);
}

/**
 * @param {import('../database')} database
 * @param {string} entrepriseId
 * @param {Object} config
 */
async function syncMailAccountConnectors(database, entrepriseId, config) {
  if (!entrepriseId || !config) return { synced: 0, removed: 0 };

  const instanceService = new ConnectorInstanceService(database);
  await instanceService.ensureIndexes();

  const accounts = listAccountsFromConfig(config);
  const activeKeys = new Set();

  for (const account of accounts) {
    if (account.hasImap) {
      activeKeys.add(accountSyncKey('mail-in', account.id));
      await upsertAutoInstance(instanceService, entrepriseId, 'mail-in', account, {
        mailbox: account.mailbox,
        pollIntervalMinutes: 3,
        unseenOnly: true
      });
    }
    if (account.hasSmtp) {
      activeKeys.add(accountSyncKey('mail-out', account.id));
      await upsertAutoInstance(instanceService, entrepriseId, 'mail-out', account, {});
    }
  }

  const col = instanceService.col();
  const stale = await col
    .find({
      entrepriseId: String(entrepriseId),
      connectorId: { $in: ['mail-in', 'mail-out'] },
      'settings.autoSynced': true
    })
    .toArray();

  let removed = 0;
  for (const doc of stale) {
    const key = doc.settings?.mailAccountKey;
    if (key && !activeKeys.has(key)) {
      await col.deleteOne({ _id: doc._id });
      removed += 1;
    }
  }

  return { synced: activeKeys.size, removed };
}

module.exports = {
  syncMailAccountConnectors,
  listAccountsFromConfig
};
