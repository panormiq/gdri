/**
 * FICHIER : modules/gderpi/backend/services/commande-client/updateCommandeClientStatus.js
 * RÔLE : Met à jour le statut d'une commande client (annulation manuelle uniquement).
 */

const getCommandeClientById = require('./getCommandeClientById');
const { MANUAL_TRANSITIONS } = require('../workflow/commandeClientStatuts');

const COLLECTION = 'gderpi_commandes_client';

async function updateCommandeClientStatus(db, entrepriseId, commandeClientId, newStatus) {
  const existing = await getCommandeClientById(db, entrepriseId, commandeClientId);
  if (!existing) throw new Error('Commande client introuvable');

  const statut = String(newStatus || '').trim().toLowerCase();
  const allowed = MANUAL_TRANSITIONS[existing.statut];
  if (!allowed || !allowed.has(statut)) {
    throw new Error(
      'Transition non autorisée : ' + existing.statut + ' → ' + statut +
      '. Utilisez les actions métier pour avancer le pipeline.'
    );
  }

  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },
    {
      $set: { statut, updatedAt: now },
      $push: { historique: { statut, date: now } }
    }
  );

  const entry = await getCommandeClientById(db, entrepriseId, commandeClientId);

  try {
    const notifyPmFromCommande = require('../../integrations/pm-bridge/notifyPmFromCommande');
    await notifyPmFromCommande(db, entrepriseId, entry);
  } catch (_) {}

  return entry;
}

module.exports = updateCommandeClientStatus;
