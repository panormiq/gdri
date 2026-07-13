/**
 * Résolution des comptes mail (collection mail_configs) pour les connecteurs.
 */

async function getEntityMailConfig(database, entityId, moduleName = 'mail') {
  if (!entityId) return null;
  const col = database.getCollection('mail_configs');
  const doc = await col.findOne({
    module_name: String(moduleName),
    entity_id: String(entityId)
  });
  return doc?.config || null;
}

function listMailAccounts(config) {
  if (!config || !Array.isArray(config.comptes)) return [];
  return config.comptes
    .map((c) => ({
      id: String(c.id || c.email || ''),
      email: String(c.email || ''),
      label: String(c.from_name || c.email || c.id || ''),
      hasImap: !!c.profil_imap_id,
      hasSmtp: !!c.profil_smtp_id
    }))
    .filter((a) => a.id);
}

function resolveImapConfigForAccount(config, accountRef, mailboxOverride) {
  if (!config || accountRef == null || accountRef === '') return null;
  const id = String(accountRef);

  const profiles = config.smtp_profiles;
  if (profiles && profiles[id]) {
    const p = profiles[id];
    const imap = p.imap || config.imap_config;
    const user = p.smtp?.auth?.user;
    const password = p.smtp?.auth?.pass;
    if (imap?.host && user && password) {
      return {
        host: imap.host,
        port: parseInt(imap.port, 10) || 993,
        secure: imap.secure !== false,
        user,
        password,
        mailbox: mailboxOverride || 'INBOX'
      };
    }
  }

  if (Array.isArray(config.profils_imap) && Array.isArray(config.comptes)) {
    const byId = (arr) => (arr || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
    const imapById = byId(config.profils_imap);
    const compte = config.comptes.find((c) => String(c.id) === id || String(c.email) === id);
    if (!compte?.profil_imap_id || !imapById[compte.profil_imap_id]) return null;
    const profil = imapById[compte.profil_imap_id];
    if (!compte.email || !compte.password) return null;
    return {
      host: profil.host,
      port: parseInt(profil.port, 10) || 993,
      secure: profil.secure !== false,
      user: compte.email,
      password: compte.password,
      mailbox: mailboxOverride || compte.imap_mailbox || 'INBOX'
    };
  }

  if (config.imap_config && typeof config.imap_config === 'object' && config.comptes?.length === 1) {
    const only = config.comptes[0];
    if (String(only.id) === id || String(only.email) === id || config.comptes.length === 1) {
      return {
        ...config.imap_config,
        user: config.imap_config.user || only.email,
        password: config.imap_config.password || only.password,
        mailbox: mailboxOverride || config.imap_config.mailbox || 'INBOX'
      };
    }
  }

  return null;
}

async function loadMailConfigForConnector(database, entityId) {
  const config = await getEntityMailConfig(database, entityId, 'mail');
  if (config) return config;
  return null;
}

module.exports = {
  getEntityMailConfig,
  listMailAccounts,
  loadMailConfigForConnector,
  resolveImapConfigForAccount
};
