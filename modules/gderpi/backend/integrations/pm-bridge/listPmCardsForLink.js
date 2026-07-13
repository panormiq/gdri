/**
 * FICHIER : modules/gderpi/backend/integrations/pm-bridge/listPmCardsForLink.js
 * RÔLE : Liste les cartes PM disponibles pour liaison depuis un devis GDERPI.
 */

const isPmAvailable = require('./isPmAvailable');

async function listPmCardsForLink(db, entrepriseId, options = {}) {
  if (!isPmAvailable()) return [];

  const listCards = require('../../../../pm/backend/services/cards/listCards');
  const search = String(options.search || '').trim();
  const unlinkedOnly = options.unlinkedOnly !== false;
  const limit = Math.min(Math.max(Number(options.limit) || 40, 1), 100);

  let cards = await listCards(db, entrepriseId, { search: search || undefined });
  if (unlinkedOnly) {
    cards = cards.filter((c) => !c.gderpi?.devisId);
  }

  return cards.slice(0, limit).map((c) => ({
    cardId: c.cardId,
    title: c.title || '',
    contactName: c.contactName || '',
    contactEmail: c.contactEmail || '',
    columnId: c.columnId || '',
    type: c.type || '',
    hasDevis: Boolean(c.gderpi?.devisId),
    updatedAt: c.updatedAt || null
  }));
}

module.exports = listPmCardsForLink;
