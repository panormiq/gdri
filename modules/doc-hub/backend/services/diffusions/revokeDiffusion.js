/**
 * FICHIER : modules/doc-hub/backend/services/diffusions/revokeDiffusion.js
 * RÔLE : Révoque une diffusion et tous ses liens de téléchargement.
 */

const { ObjectId } = require('mongodb');
const revokeLinksByDiffusion = require('../links/revokeLinksByDiffusion');

async function revokeDiffusion(entrepriseDb, diffusionId) {
  const result = await entrepriseDb.collection('doc_hub_diffusions').updateOne(
    { _id: new ObjectId(diffusionId) },
    { $set: { status: 'revoked', revokedAt: new Date() } }
  );
  if (result.matchedCount === 0) return false;
  await revokeLinksByDiffusion(entrepriseDb, diffusionId);
  return true;
}

module.exports = revokeDiffusion;
