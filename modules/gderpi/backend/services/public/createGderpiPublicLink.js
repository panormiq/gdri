/**
 * Crée un lien public sécurisé pour un document GDERPI (commande client, facture…).
 */

const { generatePublicToken, hashToken } = require('../../utils/tokenUtils');

const COLLECTION = 'gderpi_public_links';

async function createGderpiPublicLink(db, entrepriseId, docType, docId, { expiresAt, sentTo } = {}) {
  const token = generatePublicToken(entrepriseId);
  const tokenHash = hashToken(token);
  const now = new Date();

  await db.collection(COLLECTION).insertOne({
    tokenHash,
    entrepriseId: String(entrepriseId),
    docType: String(docType).trim(),
    docId: String(docId).trim(),
    sentTo: String(sentTo || '').trim(),
    expiresAt: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    downloadCount: 0,
    createdAt: now
  });

  return { token, tokenHash, expiresAt: expiresAt || null };
}

module.exports = createGderpiPublicLink;
