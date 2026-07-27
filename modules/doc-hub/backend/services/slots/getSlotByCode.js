/**
 * FICHIER : modules/doc-hub/backend/services/slots/getSlotByCode.js
 * RÔLE : Récupère un type de pièce par son code.
 */

async function getSlotByCode(entrepriseDb, code) {
  return entrepriseDb.collection('doc_hub_slot_templates').findOne({ code });
}

module.exports = getSlotByCode;
