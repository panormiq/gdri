/**
 * FICHIER : modules/gderpi/backend/services/clients/getClientById.js
 * RÔLE : Retourne un client par clientId, enrichi depuis l'Annuaire si lié.
 */

const toClientEntry = require('./toClientEntry');
const enrichClientWithAnnuaire = require('../../integrations/annuaire-bridge/enrichClientWithAnnuaire');

const COLLECTION = 'gderpi_clients';

async function getClientById(db, entrepriseId, clientId) {
  const id = String(clientId || '').trim();
  if (!id) return null;
  const col = db.collection(COLLECTION);
  const doc = await col.findOne({ entrepriseId: String(entrepriseId), clientId: id });
  const entry = toClientEntry(doc);
  if (!entry) return null;
  return enrichClientWithAnnuaire(db, entrepriseId, entry);
}

module.exports = getClientById;
