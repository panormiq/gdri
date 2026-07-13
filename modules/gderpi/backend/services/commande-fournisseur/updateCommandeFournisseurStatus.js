/**

 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/updateCommandeFournisseurStatus.js

 * RÔLE : Met à jour le statut d'une commande fournisseur.

 *

 * ENTRÉES : db, entrepriseId, commandeFournisseurId, statut

 * SORTIES : CommandeFournisseur

 *

 * DÉPEND DE : getCommandeFournisseurById.js, toCommandeFournisseurEntry.js

 * NE PAS : création

 *

 * APPELÉ PAR : workflowController

 */



const getCommandeFournisseurById = require('./getCommandeFournisseurById');

const toCommandeFournisseurEntry = require('./toCommandeFournisseurEntry');

const markCfLignesFullyReceived = require('./markCfLignesFullyReceived');

const maybeAdvanceCommandeFromCf = require('../commande-client/maybeAdvanceCommandeFromCf');
const maybeAdvanceCommandeAfterCfEnvoyee = require('../commande-client/maybeAdvanceCommandeAfterCfEnvoyee');
const applyReceptionFournisseurSideEffects = require('../commande-client/applyReceptionFournisseurSideEffects');
const reopenBesoinsFromCommandeFournisseur = require('../besoins/reopenBesoinsFromCommandeFournisseur');
const sendCommandeFournisseurToFournisseur = require('./sendCommandeFournisseurToFournisseur');

const COLLECTION = 'gderpi_commandes_fournisseur';
const COLLECTION_CMD = 'gderpi_commandes_client';



const TRANSITIONS = {

  brouillon: new Set(['envoyee', 'annulee']),

  envoyee: new Set(['confirmee', 'recue', 'partiellement_recue', 'annulee']),

  confirmee: new Set(['recue', 'partiellement_recue', 'annulee']),

  partiellement_recue: new Set(['recue', 'partiellement_recue', 'annulee']),

  recue: new Set([]),

  annulee: new Set([])

};



async function updateCommandeFournisseurStatus(db, entrepriseId, commandeFournisseurId, newStatus, options = {}) {

  const existing = await getCommandeFournisseurById(db, entrepriseId, commandeFournisseurId);

  if (!existing) throw new Error('Commande fournisseur introuvable');



  const statut = String(newStatus || '').trim().toLowerCase();

  const allowed = TRANSITIONS[existing.statut];

  if (!allowed || !allowed.has(statut)) {

    throw new Error('Transition non autorisée : ' + existing.statut + ' → ' + statut);

  }

  if (statut === 'envoyee' && existing.statut === 'brouillon' && options.sendEmail !== false) {
    await sendCommandeFournisseurToFournisseur(
      db,
      entrepriseId,
      commandeFournisseurId,
      options.emailPayload || {},
      options.req || null
    );
  }



  const now = new Date();

  const $set = { statut, updatedAt: now };

  if (statut === 'recue') {

    $set.lignes = markCfLignesFullyReceived(existing.lignes);

  }



  await db.collection(COLLECTION).updateOne(

    { entrepriseId: String(entrepriseId), commandeFournisseurId: String(commandeFournisseurId).trim() },

    {

      $set,

      $push: { historique: { statut, date: now } }

    }

  );



  const doc = await db.collection(COLLECTION).findOne({

    entrepriseId: String(entrepriseId),

    commandeFournisseurId: String(commandeFournisseurId).trim()

  });

  const entry = toCommandeFournisseurEntry(doc);



  if (statut === 'annulee' && existing.statut === 'brouillon' && entry?.commandeClientId) {
    const cmdDoc = await db.collection(COLLECTION_CMD).findOne({
      entrepriseId: String(entrepriseId),
      commandeClientId: String(entry.commandeClientId).trim()
    });
    if (cmdDoc) {
      const besoins = reopenBesoinsFromCommandeFournisseur(
        cmdDoc.besoins,
        commandeFournisseurId,
        existing.lignes
      );
      await db.collection(COLLECTION_CMD).updateOne(
        { entrepriseId: String(entrepriseId), commandeClientId: String(entry.commandeClientId).trim() },
        { $set: { besoins, updatedAt: now } }
      );
    }
  }

  if (statut === 'envoyee' && entry?.commandeClientId) {
    await maybeAdvanceCommandeAfterCfEnvoyee(db, entrepriseId, entry.commandeClientId);
  }

  if (['recue', 'partiellement_recue'].includes(statut) && entry?.commandeClientId) {
    await applyReceptionFournisseurSideEffects(db, entrepriseId, entry.commandeClientId);
  }



  return entry;

}



module.exports = updateCommandeFournisseurStatus;

