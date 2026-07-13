/**
 * FICHIER : modules/pm/backend/services/integrations/gderpi/listGderpiDevisForLink.js
 * RÔLE : Liste les devis GDERPI disponibles pour liaison depuis une carte PM.
 */

const isGderpiAvailable = require('../isGderpiAvailable');

async function listGderpiDevisForLink(db, entrepriseId, options = {}) {
  if (!isGderpiAvailable()) return [];

  const listDevis = require('../../../../../gderpi/backend/services/devis/listDevis');
  const search = String(options.search || '').trim();
  const unlinkedOnly = options.unlinkedOnly !== false;
  const limit = Math.min(Math.max(Number(options.limit) || 40, 1), 100);

  const entries = await listDevis(db, entrepriseId, { search });
  let filtered = unlinkedOnly
    ? entries.filter((d) => !d.pmCardId)
    : entries;

  return filtered.slice(0, limit).map((d) => ({
    devisId: d.devisId || d.id,
    numero: d.numero || '',
    objet: d.objet || '',
    statut: d.statut || '',
    clientId: d.clientId || null,
    pmCardId: d.pmCardId || null,
    updatedAt: d.updatedAt || null
  }));
}

module.exports = listGderpiDevisForLink;
