/**
 * Détail d'un e-mail envoyé par GDERPI (corps HTML).
 */

const { ObjectId } = require('mongodb');
const getGderpiSentEmailsCollection = require('./getGderpiSentEmailsCollection');
const { serializeGderpiSentEmail } = require('./gderpiMailDocumentTypes');

async function getGderpiSentEmailById(entrepriseId, emailId) {
  const id = String(emailId || '').trim();
  if (!id || !ObjectId.isValid(id) || String(new ObjectId(id)) !== id) {
    throw new Error('E-mail introuvable');
  }

  const collection = await getGderpiSentEmailsCollection(entrepriseId);
  const doc = await collection.findOne({
    _id: new ObjectId(id),
    module_name: 'gderpi'
  });
  if (!doc) throw new Error('E-mail introuvable');
  return serializeGderpiSentEmail(doc, { includeBody: true });
}

module.exports = getGderpiSentEmailById;
