/**

 * FICHIER : modules/gderpi/backend/services/commande-client/listCommandesClient.js

 * RÔLE : Liste les commandes client avec filtres.

 */



const ensureCommandeClientIndexes = require('./ensureCommandeClientIndexes');

const toCommandeClientEntry = require('./toCommandeClientEntry');

const flattenFacturesForList = require('../facturation/flattenFacturesForList');

const { summarizeCommandesFournisseurByClient } = require('../commande-fournisseur/summarizeCommandesFournisseurByClient');
const applyReceptionFournisseurSideEffects = require('./applyReceptionFournisseurSideEffects');

const COLLECTION = 'gderpi_commandes_client';
const REPAIR_STATUTS = new Set(['achats_en_cours', 'attente_livraison_frs']);



async function listCommandesClient(db, entrepriseId, opts = {}) {

  await ensureCommandeClientIndexes(db);

  const col = db.collection(COLLECTION);

  const query = { entrepriseId: String(entrepriseId) };

  if (opts.boutiqueId) query.boutiqueId = String(opts.boutiqueId).trim();

  if (opts.statut) {

    const s = String(opts.statut).trim().toLowerCase();

    const legacyGroups = {

      confirmee: ['validee_gdri', 'confirmee'],

      en_cours: ['validee_gdri', 'en_cours', 'achats_en_cours', 'attente_livraison_frs', 'a_livrer']

    };

    if (legacyGroups[s]) query.statut = { $in: legacyGroups[s] };

    else query.statut = s;

  }

  if (opts.facturation === true) {

    query.$or = [

      { 'factures.0': { $exists: true } },

      { factureNumero: { $exists: true, $nin: [null, ''] } }

    ];

  } else if (opts.aFacturer === true) {

    query.statut = { $in: ['livree', 'a_facturer', 'facturee_partiellement', 'a_livrer'] };

  } else if (opts.actives === true) {

    query.statut = { $nin: ['facturee', 'annulee'] };

  } else if (opts.execution === true) {

    query.statut = {
      $in: [
        'achats_en_cours',
        'attente_livraison_frs',
        'a_livrer',
        'livree',
        'a_facturer',
        'facturee_partiellement'
      ]
    };

  } else if (opts.postFacturation === true) {

    query.statut = { $in: ['facturee', 'facturee_partiellement'] };

  }

  const docs = await col.find(query).sort({ updatedAt: -1 }).toArray();

  const cfSummaryByClient = await summarizeCommandesFournisseurByClient(
    db,
    entrepriseId,
    docs.map((d) => d.commandeClientId || d.id)
  );

  const repairedIds = [];
  for (const d of docs) {
    const id = String(d.commandeClientId || d.id || '').trim();
    const cfSummary = cfSummaryByClient.get(id);
    if (!REPAIR_STATUTS.has(String(d.statut)) || !(Number(cfSummary?.commandesFournisseurCount) > 0)) continue;
    await applyReceptionFournisseurSideEffects(db, entrepriseId, id);
    repairedIds.push(id);
  }

  if (repairedIds.length) {
    const refreshed = await col.find({
      entrepriseId: String(entrepriseId),
      commandeClientId: { $in: repairedIds }
    }).toArray();
    const byId = new Map(refreshed.map((d) => [String(d.commandeClientId || d.id), d]));
    for (let i = 0; i < docs.length; i += 1) {
      const id = String(docs[i].commandeClientId || docs[i].id || '').trim();
      if (byId.has(id)) docs[i] = byId.get(id);
    }
  }

  let entries = docs.map((d) => {
    const id = String(d.commandeClientId || d.id || '').trim();
    const cfSummary = cfSummaryByClient.get(id) || {
      commandesFournisseurCount: 0,
      commandesFournisseurBrouillonCount: 0
    };
    return toCommandeClientEntry(d, cfSummary);
  }).filter(Boolean);



  if (opts.facturation === true) {

    entries = entries.flatMap((c) => flattenFacturesForList(c));

    entries.sort((a, b) => {
      const cmdA = String(a.commandeClientId || a.id || '');
      const cmdB = String(b.commandeClientId || b.id || '');
      if (cmdA !== cmdB) {
        const da = a.factureDate ? new Date(a.factureDate).getTime() : 0;
        const db = b.factureDate ? new Date(b.factureDate).getTime() : 0;
        return db - da;
      }
      return (Number(a.factureIndex) || 0) - (Number(b.factureIndex) || 0);
    });

  }



  if (opts.facturation === true && opts.payee === '1') {

    entries = entries.filter((c) => c.facturePayee === true || c.soldeeParAvoir === true);

  } else if (opts.facturation === true && opts.payee === '0') {

    entries = entries.filter((c) => !c.facturePayee && !c.soldeeParAvoir && (Number(c.resteDuTtc) || 0) > 0.0001);

  }

  const q = String(opts.search || '').trim().toLowerCase();

  if (q) {

    entries = entries.filter((c) => {

      const hay = [c.numero, c.objet, c.factureNumero, c.clientId, c.documentClient, c.referenceClient, c.devisNumero].join(' ').toLowerCase();

      return hay.includes(q);

    });

  }

  return entries;

}



module.exports = listCommandesClient;

