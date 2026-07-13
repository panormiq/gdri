/**
 * FICHIER : modules/gderpi/backend/services/fournisseurs/listFournisseurs.js
 * RÔLE : Liste les fournisseurs avec recherche texte.
 *
 * ENTRÉES : db, entrepriseId, { search, actifOnly }
 * SORTIES : Fournisseur[]
 *
 * DÉPEND DE : ensureFournisseurIndexes.js, toFournisseurEntry.js
 * NE PAS : mutation
 *
 * APPELÉ PAR : fournisseursController
 */

const ensureFournisseurIndexes = require('./ensureFournisseurIndexes');
const toFournisseurEntry = require('./toFournisseurEntry');
const enrichFournisseurWithAnnuaire = require('../../integrations/annuaire-bridge/enrichFournisseurWithAnnuaire');
const isAnnuaireAvailable = require('../../integrations/annuaire-bridge/isAnnuaireAvailable');

const COLLECTION = 'gderpi_fournisseurs';

async function listFournisseurs(db, entrepriseId, { search = '', actifOnly = false } = {}) {
  await ensureFournisseurIndexes(db);
  const col = db.collection(COLLECTION);
  const query = { entrepriseId: String(entrepriseId) };
  if (actifOnly) query.actif = { $ne: false };
  const docs = await col.find(query).sort({ updatedAt: -1 }).toArray();
  const q = String(search || '').trim().toLowerCase();
  let entries = docs.map((d) => toFournisseurEntry(d)).filter(Boolean);
  if (q) {
    entries = entries.filter((f) => {
      const hay = [
        f.displayName, f.raisonSociale, f.email, f.telephone, f.ville, f.siret, f.contactNom
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  if (isAnnuaireAvailable()) {
    entries = await Promise.all(
      entries.map((f) => enrichFournisseurWithAnnuaire(db, entrepriseId, f))
    );
  }
  return entries;
}

module.exports = listFournisseurs;
