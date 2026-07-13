/**
 * FICHIER : modules/gderpi/backend/services/fournisseurs/updateFournisseur.js
 * RÔLE : Met à jour un fournisseur — identité vers Annuaire, champs locaux conservés.
 */

const normalizeFournisseur = require('./normalizeFournisseur');
const getFournisseurById = require('./getFournisseurById');
const requireAnnuaireForTiers = require('../../integrations/annuaire-bridge/requireAnnuaireForTiers');
const pushFournisseurIdentityToAnnuaire = require('../../integrations/annuaire-bridge/pushFournisseurIdentityToAnnuaire');
const omitContactsFromGderpiFields = require('../../integrations/annuaire-bridge/omitContactsFromGderpiFields');
const gderpiContactsUnset = require('../../integrations/annuaire-bridge/gderpiContactsUnset');

const COLLECTION = 'gderpi_fournisseurs';

async function updateFournisseur(db, entrepriseId, fournisseurId, data) {
  requireAnnuaireForTiers();

  const id = String(fournisseurId || '').trim();
  if (!id) throw new Error('Identifiant fournisseur requis');
  const col = db.collection(COLLECTION);
  const existing = await col.findOne({ entrepriseId: String(entrepriseId), fournisseurId: id });
  if (!existing) throw new Error('Fournisseur introuvable');

  const raw = data && typeof data === 'object' ? data : {};
  const patch = { ...raw };
  delete patch.contacts;
  delete patch.documents;
  delete patch._fromAnnuaireOrganisationId;

  const normalized = normalizeFournisseur({ ...existing, ...patch, id });
  if (!normalized.raisonSociale) throw new Error('Raison sociale fournisseur requise');
  if (!normalized.annuaireOrganisationId) {
    throw new Error('Fournisseur non lié à l\'Annuaire — exécutez l\'import Annuaire depuis le module Annuaire');
  }

  const now = new Date();
  const gderpiFields = omitContactsFromGderpiFields({
    ...normalized,
    documents: existing.documents,
    updatedAt: now
  });

  await col.updateOne(
    { entrepriseId: String(entrepriseId), fournisseurId: id },
    { $set: gderpiFields, $unset: gderpiContactsUnset() }
  );

  await pushFournisseurIdentityToAnnuaire(db, entrepriseId, gderpiFields);
  return getFournisseurById(db, entrepriseId, id);
}

module.exports = updateFournisseur;
