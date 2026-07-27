/**
 * FICHIER : modules/doc-hub/backend/services/slots/listSlotTemplates.js
 * RÔLE : Liste les types de pièces triés par ordre d'affichage.
 */

async function listSlotTemplates(entrepriseDb) {
  return entrepriseDb
    .collection('doc_hub_slot_templates')
    .find({})
    .sort({ sortOrder: 1 })
    .toArray();
}

module.exports = listSlotTemplates;
