/**
 * FICHIER : modules/gderpi/backend/services/boutiques/listBoutiques.js
 * RÔLE : Liste les boutiques d'une entreprise avec recherche optionnelle.
 *
 * ENTRÉES : db, entrepriseId, { search, actifOnly }
 * SORTIES : Boutique[]
 *
 * DÉPEND DE : ensureBoutiqueIndexes.js, toBoutiqueEntry.js
 * NE PAS : mutation
 *
 * APPELÉ PAR : boutiquesController
 */

const ensureBoutiqueIndexes = require('./ensureBoutiqueIndexes');
const toBoutiqueEntry = require('./toBoutiqueEntry');
const enrichBoutiqueWithAnnuaire = require('../../integrations/annuaire-bridge/enrichBoutiqueWithAnnuaire');
const isAnnuaireAvailable = require('../../integrations/annuaire-bridge/isAnnuaireAvailable');

const COLLECTION = 'gderpi_boutiques';

async function listBoutiques(db, entrepriseId, { search = '', actifOnly = false } = {}) {
  await ensureBoutiqueIndexes(db);
  const col = db.collection(COLLECTION);
  const query = { entrepriseId: String(entrepriseId) };
  if (actifOnly) query.actif = { $ne: false };
  const docs = await col.find(query).sort({ nom: 1, updatedAt: -1 }).toArray();
  const q = String(search || '').trim().toLowerCase();
  let entries = docs.map((d) => toBoutiqueEntry(d)).filter(Boolean);
  if (q) {
    entries = entries.filter((b) => {
      const hay = [b.nom, b.slug, b.raisonSociale, b.ville, b.email, b.siret].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  if (isAnnuaireAvailable()) {
    entries = await Promise.all(
      entries.map((b) => enrichBoutiqueWithAnnuaire(db, entrepriseId, b))
    );
  }
  return entries;
}

module.exports = listBoutiques;
