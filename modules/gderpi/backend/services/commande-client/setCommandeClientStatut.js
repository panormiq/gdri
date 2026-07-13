/**

 * FICHIER : modules/gderpi/backend/services/commande-client/setCommandeClientStatut.js

 * RÔLE : Met à jour le statut interne d'une commande client (pipeline).

 */



const fetchCommandeClientEntry = require('./fetchCommandeClientEntry');

const { STATUTS } = require('../workflow/commandeClientStatuts');



const COLLECTION = 'gderpi_commandes_client';



async function setCommandeClientStatut(db, entrepriseId, commandeClientId, statut, extra = {}) {

  const next = String(statut || '').trim().toLowerCase();

  if (!STATUTS.has(next)) throw new Error('Statut invalide : ' + next);



  const existing = await fetchCommandeClientEntry(db, entrepriseId, commandeClientId);

  if (!existing) throw new Error('Commande client introuvable');



  const now = new Date();

  const $set = { statut: next, updatedAt: now, ...(extra.set || {}) };

  const update = { $set, $push: { historique: { statut: next, date: now, ...(extra.historique || {}) } } };



  await db.collection(COLLECTION).updateOne(

    { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },

    update

  );

  const entry = await fetchCommandeClientEntry(db, entrepriseId, commandeClientId);

  try {
    const notifyPmFromCommande = require('../../integrations/pm-bridge/notifyPmFromCommande');
    await notifyPmFromCommande(db, entrepriseId, entry);
  } catch (_) {}

  return entry;

}



module.exports = setCommandeClientStatut;

