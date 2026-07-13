/**
 * Crée un lien public sécurisé pour un devis (PDF + validation).
 */

const { generatePublicToken, hashToken } = require('../../utils/tokenUtils');

const COLLECTION = 'gderpi_devis_public_links';

async function createDevisPublicLink(db, entrepriseId, devisId, { expiresAt, sentTo } = {}) {
  const token = generatePublicToken(entrepriseId);
  const tokenHash = hashToken(token);
  const now = new Date();

  await db.collection(COLLECTION).insertOne({
    tokenHash,
    entrepriseId: String(entrepriseId),
    devisId: String(devisId).trim(),
    sentTo: String(sentTo || '').trim(),
    expiresAt: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    acceptUsedAt: null,
    downloadCount: 0,
    createdAt: now
  });

  return { token, tokenHash, expiresAt: expiresAt || null };
}

module.exports = createDevisPublicLink;
