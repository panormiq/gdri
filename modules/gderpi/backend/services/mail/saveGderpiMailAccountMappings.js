/**
 * Enregistre les associations contact GDERPI → compte mail.
 */

const path = require('path');
const database = require(path.join(__dirname, '../../../../../backend/config/database'));
const getGderpiMailAccounts = require('./getGderpiMailAccounts');
const listGderpiMailContacts = require('./listGderpiMailContacts');

const MAIL_CONFIGS = 'mail_configs';
const DEPS = 'mail_module_dependencies';

function normalizeMappings(raw) {
  const input = raw?.contactAccountMappings && typeof raw.contactAccountMappings === 'object'
    ? raw.contactAccountMappings
    : (raw && typeof raw === 'object' ? raw : {});
  const out = {};
  for (const [email, accountId] of Object.entries(input)) {
    const key = String(email || '').trim().toLowerCase();
    const value = String(accountId || '').trim();
    if (key && value) out[key] = value;
  }
  return out;
}

async function saveGderpiMailAccountMappings(db, entrepriseId, payload) {
  const entityId = String(entrepriseId);
  const mappings = normalizeMappings(payload);
  let defaultAccountId = String(payload?.defaultAccountId || '').trim();
  if (!defaultAccountId) {
    const contacts = await listGderpiMailContacts(db, entrepriseId);
    const firstGeneric = contacts.find((c) => c.kind === 'generic' && c.hasEmail);
    if (firstGeneric && mappings[firstGeneric.email]) {
      defaultAccountId = mappings[firstGeneric.email];
    }
  }
  const col = database.getCollection(MAIL_CONFIGS);
  const now = new Date();

  const existing = await col.findOne({ module_name: 'gderpi', entity_id: entityId });
  const config = { ...(existing?.config || {}) };

  const current = await getGderpiMailAccounts(db, entrepriseId);
  const accountById = (current.accounts || []).reduce((acc, item) => {
    acc[String(item.id)] = item;
    return acc;
  }, {});

  for (const [email, accountId] of Object.entries(mappings)) {
    const account = accountById[accountId];
    if (!account) {
      throw new Error(`Compte mail introuvable pour ${email}: ${accountId}`);
    }
  }

  if (defaultAccountId && !accountById[defaultAccountId]) {
    throw new Error(`Compte par défaut invalide: ${defaultAccountId}`);
  }

  config.gderpi_contact_accounts = mappings;
  if (defaultAccountId) config.gderpi_default_account = defaultAccountId;
  else delete config.gderpi_default_account;

  await col.updateOne(
    { module_name: 'gderpi', entity_id: entityId },
    {
      $set: {
        module_name: 'gderpi',
        entity_id: entityId,
        config,
        updated_at: now
      },
      $setOnInsert: { created_at: now }
    },
    { upsert: true }
  );

  await database.getCollection(DEPS).updateOne(
    { entity_id: entityId, module_name: 'gderpi', depends_on: 'mail' },
    {
      $set: {
        entity_id: entityId,
        module_name: 'gderpi',
        depends_on: 'mail',
        updated_at: now
      },
      $setOnInsert: { created_at: now }
    },
    { upsert: true }
  );

  return getGderpiMailAccounts(db, entrepriseId);
}

module.exports = saveGderpiMailAccountMappings;
