/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/listCommandesFournisseur.js
 * RÔLE : Liste les commandes fournisseur avec filtres.
 *
 * ENTRÉES : db, entrepriseId, { statut, fournisseurId, search }
 * SORTIES : CommandeFournisseur[]
 *
 * DÉPEND DE : ensureCommandeFournisseurIndexes.js, toCommandeFournisseurEntry.js
 * NE PAS : création
 *
 * APPELÉ PAR : workflowController
 */

const ensureCommandeFournisseurIndexes = require('./ensureCommandeFournisseurIndexes');
const toCommandeFournisseurEntry = require('./toCommandeFournisseurEntry');

const COLLECTION = 'gderpi_commandes_fournisseur';

async function listCommandesFournisseur(db, entrepriseId, opts = {}) {
  await ensureCommandeFournisseurIndexes(db);
  const col = db.collection(COLLECTION);
  const query = { entrepriseId: String(entrepriseId) };
  if (opts.statut) query.statut = String(opts.statut).trim().toLowerCase();
  if (opts.fournisseurId) query.fournisseurId = String(opts.fournisseurId).trim();
  if (opts.commandeClientId) query.commandeClientId = String(opts.commandeClientId).trim();
  if (opts.enAttente === true) {
    query.statut = { $in: ['envoyee', 'confirmee', 'partiellement_recue'] };
  }
  const docs = await col.find(query).sort({ updatedAt: -1 }).toArray();
  let entries = docs.map((d) => toCommandeFournisseurEntry(d)).filter(Boolean);
  const q = String(opts.search || '').trim().toLowerCase();
  if (q) {
    entries = entries.filter((c) => {
      const hay = [c.numero, c.objet, c.fournisseurId].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  return entries;
}

module.exports = listCommandesFournisseur;
