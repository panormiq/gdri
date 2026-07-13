/**
 * FICHIER : modules/pm/backend/services/integrations/gderpi/syncCardFromCommande.js
 * RÔLE : Met à jour une carte PM depuis une commande client GDERPI.
 */

const getCardById = require('../../cards/getCardById');
const toCardEntry = require('../../cards/toCardEntry');
const commandeStatusTasks = require('./commandeStatusTasks');
const columnForCommandeStatut = require('./columnForCommandeStatut');

const COLLECTION = 'pm_cards';

async function syncCardFromCommande(db, entrepriseId, commande, cardId) {
  const targetCardId = cardId || commande?.pmCardId;
  if (!targetCardId) {
    if (!commande?.devisId) return null;
    const linked = await db.collection(COLLECTION).findOne({
      entrepriseId: String(entrepriseId),
      'gderpi.devisId': String(commande.devisId)
    });
    if (!linked) return null;
    return syncCardFromCommande(db, entrepriseId, commande, linked.cardId);
  }

  const existing = await getCardById(db, entrepriseId, targetCardId);
  if (!existing) return null;

  const statut = String(commande.statut || '').toLowerCase();
  const now = new Date();
  const tasks = commandeStatusTasks(statut, { facturePayee: commande.facturePayee });
  const columnId = columnForCommandeStatut(statut);

  const gderpi = {
    ...(existing.gderpi || {}),
    commandeClientId: commande.commandeClientId || commande.id,
    commandeClientNumero: commande.numero || '',
    devisId: commande.devisId || existing.gderpi?.devisId || null,
    devisNumero: commande.devisNumero || existing.gderpi?.devisNumero || '',
    clientId: commande.clientId || existing.gderpi?.clientId || null,
    boutiqueId: commande.boutiqueId || existing.gderpi?.boutiqueId || null,
    lastStatut: statut,
    syncAt: now
  };

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), cardId: String(targetCardId).trim() },
    {
      $set: {
        type: 'commande',
        columnId,
        gderpi,
        tasks,
        status: statut === 'facturee' || statut === 'annulee' ? 'done' : 'in_progress',
        updatedAt: now
      },
      $push: {
        activities: {
          date: now,
          type: 'gderpi_commande',
          message: `GDERPI commande ${gderpi.commandeClientNumero || gderpi.commandeClientId} — statut « ${statut} »`
        }
      }
    }
  );

  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    cardId: String(targetCardId).trim()
  });
  return toCardEntry(doc);
}

module.exports = syncCardFromCommande;
