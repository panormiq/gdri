/**
 * FICHIER : modules/gderpi/backend/services/boutiques/getBoutiqueById.js
 * RÔLE : Retourne une boutique par id, enrichie depuis l'Annuaire si liée.
 */

const toBoutiqueEntry = require('./toBoutiqueEntry');
const enrichBoutiqueWithAnnuaire = require('../../integrations/annuaire-bridge/enrichBoutiqueWithAnnuaire');

const COLLECTION = 'gderpi_boutiques';

async function getBoutiqueById(db, entrepriseId, boutiqueId) {
  const id = String(boutiqueId || '').trim();
  if (!id) return null;
  const col = db.collection(COLLECTION);
  const doc = await col.findOne({ entrepriseId: String(entrepriseId), boutiqueId: id });
  const entry = toBoutiqueEntry(doc);
  if (!entry) return null;
  return enrichBoutiqueWithAnnuaire(db, entrepriseId, entry);
}

module.exports = getBoutiqueById;
