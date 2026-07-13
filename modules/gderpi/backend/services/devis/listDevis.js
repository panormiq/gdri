/**
 * FICHIER : modules/gderpi/backend/services/devis/listDevis.js
 * RÔLE : Liste les devis avec filtres boutique, statut et recherche.
 *
 * ENTRÉES : db, entrepriseId, { boutiqueId, statut, search }
 * SORTIES : Devis[]
 *
 * DÉPEND DE : ensureDevisIndexes.js, toDevisEntry.js
 * NE PAS : création/modification
 *
 * APPELÉ PAR : devisController
 */

const ensureDevisIndexes = require('./ensureDevisIndexes');
const toDevisEntry = require('./toDevisEntry');
const isDevisContentEmpty = require('./isDevisContentEmpty');
const purgeEmptyDevisBrouillons = require('./purgeEmptyDevisBrouillons');

const COLLECTION = 'gderpi_devis';

async function listDevis(db, entrepriseId, { boutiqueId = '', statut = '', search = '' } = {}) {
  await ensureDevisIndexes(db);
  const col = db.collection(COLLECTION);
  const query = { entrepriseId: String(entrepriseId) };
  if (boutiqueId) query.boutiqueId = String(boutiqueId).trim();
  if (statut) query.statut = String(statut).trim().toLowerCase();
  const docs = await col.find(query).sort({ updatedAt: -1 }).toArray();
  let entries = docs.map((d) => toDevisEntry(d)).filter(Boolean);
  await purgeEmptyDevisBrouillons(db, entrepriseId, entries);
  entries = entries.filter((d) => !isDevisContentEmpty(d));
  const q = String(search || '').trim().toLowerCase();
  if (q) {
    entries = entries.filter((d) => {
      const hay = [
        d.numero, d.objet, d.notes, d.clientId,
        d.documentClient, d.referenceClient, d.commandeClientNumero,
        d.contactNom, d.contactEmail
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  return entries;
}

module.exports = listDevis;
