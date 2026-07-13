/**
 * FICHIER : modules/gderpi/backend/services/fournisseurs/getFournisseurById.js
 * RÔLE : Retourne un fournisseur par id, enrichi depuis l'Annuaire si lié.
 */

const toFournisseurEntry = require('./toFournisseurEntry');
const enrichFournisseurWithAnnuaire = require('../../integrations/annuaire-bridge/enrichFournisseurWithAnnuaire');

const COLLECTION = 'gderpi_fournisseurs';

async function getFournisseurById(db, entrepriseId, fournisseurId) {
  const id = String(fournisseurId || '').trim();
  if (!id) return null;
  const col = db.collection(COLLECTION);
  const doc = await col.findOne({ entrepriseId: String(entrepriseId), fournisseurId: id });
  const entry = toFournisseurEntry(doc);
  if (!entry) return null;
  return enrichFournisseurWithAnnuaire(db, entrepriseId, entry);
}

module.exports = getFournisseurById;
