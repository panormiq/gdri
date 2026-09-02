/**
 * Collection Mongo des copies d'e-mails envoyés par GDERPI.
 */

const { getMailService } = require('./MailHelper');

async function getGderpiSentEmailsCollection(entrepriseId) {
  const mail = getMailService();
  if (!mail?.database || typeof mail.database.getCollection !== 'function') {
    throw new Error('Service mail indisponible');
  }
  if (!mail.database.db && typeof mail.database.connect === 'function') {
    await mail.database.connect();
  }
  const id = String(entrepriseId || '').trim();
  if (!id) throw new Error('Entreprise requise');
  return mail.database.getCollection('emails_' + id + '_gderpi');
}

module.exports = getGderpiSentEmailsCollection;
