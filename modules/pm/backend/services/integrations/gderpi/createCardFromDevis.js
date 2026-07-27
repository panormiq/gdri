/**
 * FICHIER : modules/pm/backend/services/integrations/gderpi/createCardFromDevis.js
 * RÔLE : Crée une carte PM à partir d'un devis GDERPI (sans carte liée).
 */

const createCard = require('../../cards/createCard');
const syncCardFromDevis = require('./syncCardFromDevis');
const columnForDevisStatut = require('./columnForDevisStatut');
const appendCardActivity = require('../../cards/appendCardActivity');

async function createCardFromDevis(db, entrepriseId, devis) {
  if (!devis) throw new Error('Devis requis');

  const numero = String(devis.numero || devis.devisId || devis.id || '').trim();
  const objet = String(devis.objet || '').trim();
  const title = objet
    ? (numero ? `${numero} — ${objet}` : objet)
    : (numero ? `Devis ${numero}` : 'Nouveau devis');

  const card = await createCard(db, entrepriseId, {
    type: 'devis',
    columnId: columnForDevisStatut(devis.statut || devis.status),
    title,
    description: String(devis.notes || '').trim(),
    contactName: String(devis.contactNom || '').trim(),
    contactEmail: String(devis.contactEmail || '').trim()
  });

  const synced = await syncCardFromDevis(
    db,
    entrepriseId,
    { ...devis, pmCardId: card.cardId },
    { cardId: card.cardId }
  );

  await appendCardActivity(db, entrepriseId, card.cardId, {
    type: 'gderpi_create',
    message: `Carte créée depuis le devis GDERPI ${numero || card.cardId}`
  });

  return synced || card;
}

module.exports = createCardFromDevis;
