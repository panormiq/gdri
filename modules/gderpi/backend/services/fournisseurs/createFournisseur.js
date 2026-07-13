/**
 * FICHIER : modules/gderpi/backend/services/fournisseurs/createFournisseur.js
 * RÔLE : Crée un fournisseur lié obligatoirement à l'Annuaire GDRI.
 */

const ensureFournisseurIndexes = require('./ensureFournisseurIndexes');
const normalizeFournisseur = require('./normalizeFournisseur');
const toFournisseurEntry = require('./toFournisseurEntry');
const requireAnnuaireForTiers = require('../../integrations/annuaire-bridge/requireAnnuaireForTiers');
const provisionAnnuaireForFournisseur = require('../../integrations/annuaire-bridge/provisionAnnuaireForFournisseur');
const linkOrganisationToGderpiFournisseur = require('../../integrations/annuaire-bridge/linkOrganisationToGderpiFournisseur');
const enrichFournisseurWithAnnuaire = require('../../integrations/annuaire-bridge/enrichFournisseurWithAnnuaire');
const omitContactsFromGderpiFields = require('../../integrations/annuaire-bridge/omitContactsFromGderpiFields');

const COLLECTION = 'gderpi_fournisseurs';

async function createFournisseur(db, entrepriseId, data) {
  requireAnnuaireForTiers();

  const raw = data && typeof data === 'object' ? data : {};
  const normalized = normalizeFournisseur(raw);
  if (!normalized.raisonSociale) throw new Error('Raison sociale fournisseur requise');

  const annuaireOrganisationId = await provisionAnnuaireForFournisseur(db, entrepriseId, normalized, raw);

  await ensureFournisseurIndexes(db);
  const col = db.collection(COLLECTION);
  const now = new Date();
  const doc = omitContactsFromGderpiFields({
    entrepriseId: String(entrepriseId),
    fournisseurId: normalized.id,
    ...normalized,
    annuaireOrganisationId,
    createdAt: now,
    updatedAt: now
  });
  await col.insertOne(doc);
  await linkOrganisationToGderpiFournisseur(db, entrepriseId, annuaireOrganisationId, normalized.id);

  return enrichFournisseurWithAnnuaire(db, entrepriseId, toFournisseurEntry(doc));
}

module.exports = createFournisseur;
