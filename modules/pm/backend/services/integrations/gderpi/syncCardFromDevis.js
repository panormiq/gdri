/**
 * FICHIER : modules/pm/backend/services/integrations/gderpi/syncCardFromDevis.js
 * RÔLE : Met à jour une carte PM depuis un devis GDERPI (appelé par le bridge ou l'API PM).
 */

const getCardById = require('../../cards/getCardById');
const toCardEntry = require('../../cards/toCardEntry');
const devisStatusTasks = require('./devisStatusTasks');
const columnForDevisStatut = require('./columnForDevisStatut');

const COLLECTION = 'pm_cards';

async function syncCardFromDevis(db, entrepriseId, devis, options = {}) {
  const cardId = options.cardId || devis?.pmCardId;
  if (!cardId) return null;

  const existing = await getCardById(db, entrepriseId, cardId);
  if (!existing) return null;

  const statut = String(devis.statut || devis.status || '').toLowerCase();
  const now = new Date();
  const tasks = devisStatusTasks(statut);
  const columnId = columnForDevisStatut(statut);
  const gderpi = {
    devisId: devis.devisId || devis.id,
    devisNumero: devis.numero || '',
    commandeClientId: devis.commandeClientId || null,
    commandeClientNumero: devis.commandeClientNumero || '',
    clientId: devis.clientId || null,
    boutiqueId: devis.boutiqueId || null,
    lastStatut: statut,
    syncAt: now
  };

  const activity = {
    date: now,
    type: 'gderpi_devis',
    message: `GDERPI devis ${gderpi.devisNumero || gderpi.devisId} — statut « ${statut} »`
  };

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), cardId: String(cardId).trim() },
    {
      $set: {
        type: 'devis',
        columnId,
        gderpi,
        tasks,
        status: ['refuse', 'expire'].includes(statut) ? 'done' : 'in_progress',
        updatedAt: now
      },
      $push: { activities: activity }
    }
  );

  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    cardId: String(cardId).trim()
  });
  return toCardEntry(doc);
}

module.exports = syncCardFromDevis;
