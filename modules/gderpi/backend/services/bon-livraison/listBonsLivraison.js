const { COLLECTION, ensureIndexes } = require('./bonLivraisonCollection');
const toBonLivraisonEntry = require('./toBonLivraisonEntry');

function matchesSearch(entry, q) {
  const hay = [
    entry.numero,
    entry.commandeClientNumero,
    entry.clientId,
    entry.objet,
    entry.devisNumero,
    entry.referenceClient,
    entry.documentClient,
    entry.adresseLivraison
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

async function listBonsLivraison(db, entrepriseId, opts = {}) {
  await ensureIndexes(db);
  const query = { entrepriseId: String(entrepriseId) };
  if (opts.commandeClientId) {
    query.commandeClientId = String(opts.commandeClientId).trim();
  }
  if (opts.boutiqueId) {
    query.boutiqueId = String(opts.boutiqueId).trim();
  }
  let docs = await db.collection(COLLECTION).find(query).sort({ createdAt: -1 }).toArray();
  const search = String(opts.search || opts.q || '').trim().toLowerCase();
  if (search) {
    docs = docs.filter((doc) => matchesSearch(toBonLivraisonEntry(doc) || doc, search));
  }
  return docs.map(toBonLivraisonEntry).filter(Boolean);
}

module.exports = listBonsLivraison;
