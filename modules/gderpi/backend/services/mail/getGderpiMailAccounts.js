/**
 * Comptes mail disponibles + contacts GDERPI + associations courantes.
 */

const path = require('path');
const database = require(path.join(__dirname, '../../../../../backend/config/database'));
const listMailAccountsFromConfig = require('./listMailAccountsFromConfig');
const listGderpiMailContacts = require('./listGderpiMailContacts');
const { checkMailAvailable } = require('./MailHelper');

const MAIL_CONFIGS = 'mail_configs';

async function getGderpiMailAccounts(db, entrepriseId) {
  const col = database.getCollection(MAIL_CONFIGS);
  const entityId = String(entrepriseId);

  const [gderpiDoc, mailDoc] = await Promise.all([
    col.findOne({ module_name: 'gderpi', entity_id: entityId }),
    col.findOne({ module_name: 'mail', entity_id: entityId })
  ]);

  const gderpiConfig = gderpiDoc?.config || null;
  const mailConfig = mailDoc?.config || null;
  const mailStatus = await checkMailAvailable(entrepriseId);
  const accounts = listMailAccountsFromConfig(mailConfig);
  const accountByEmail = accounts.reduce((acc, item) => {
    acc[String(item.email || '').trim().toLowerCase()] = item.id;
    return acc;
  }, {});
  const contacts = (await listGderpiMailContacts(db, entrepriseId)).map((contact) => {
    const email = String(contact.email || '').trim().toLowerCase();
    return {
      ...contact,
      suggestedAccountId: contact.hasEmail ? (accountByEmail[email] || '') : ''
    };
  });

  return {
    inheritedFrom: mailConfig ? 'mail' : null,
    hasOwnConfig: Boolean(gderpiConfig),
    mailAvailable: mailStatus.available,
    mailStatusMessage: mailStatus.message,
    accounts,
    contacts,
    contactAccountMappings: gderpiConfig?.gderpi_contact_accounts || {},
    defaultAccountId: gderpiConfig?.gderpi_default_account || ''
  };
}

module.exports = getGderpiMailAccounts;
