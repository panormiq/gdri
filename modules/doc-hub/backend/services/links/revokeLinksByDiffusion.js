/**
 * FICHIER : modules/doc-hub/backend/services/links/revokeLinksByDiffusion.js
 * RÔLE : Révoque tous les liens actifs d'une diffusion.
 */

async function revokeLinksByDiffusion(entrepriseDb, diffusionId) {
  await entrepriseDb.collection('doc_hub_download_links').updateMany(
    { diffusionId: String(diffusionId), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

module.exports = revokeLinksByDiffusion;
