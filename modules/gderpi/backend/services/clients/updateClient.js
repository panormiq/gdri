/**
 * FICHIER : modules/gderpi/backend/services/clients/updateClient.js
 * RÔLE : Met à jour un client — identité vers Annuaire, champs commerciaux locaux.
 */

const normalizeClient = require('./normalizeClient');
const getClientById = require('./getClientById');
const requireAnnuaireForTiers = require('../../integrations/annuaire-bridge/requireAnnuaireForTiers');
const pushClientIdentityToAnnuaire = require('../../integrations/annuaire-bridge/pushClientIdentityToAnnuaire');
const omitContactsFromGderpiFields = require('../../integrations/annuaire-bridge/omitContactsFromGderpiFields');
const gderpiContactsUnset = require('../../integrations/annuaire-bridge/gderpiContactsUnset');

const COLLECTION = 'gderpi_clients';

async function updateClient(db, entrepriseId, clientId, data) {
  requireAnnuaireForTiers();

  const id = String(clientId || '').trim();
  if (!id) throw new Error('Identifiant client requis');
  const col = db.collection(COLLECTION);
  const existing = await col.findOne({ entrepriseId: String(entrepriseId), clientId: id });
  if (!existing) throw new Error('Client introuvable');

  const raw = data && typeof data === 'object' ? data : {};
  const patch = { ...raw };
  delete patch.contacts;
  delete patch.documents;
  delete patch._fromAnnuaireOrganisationId;
  delete patch._annuaireLinked;

  const normalized = normalizeClient({ ...existing, ...patch, id });
  if (!normalized.annuaireOrganisationId) {
    throw new Error('Client non lié à l\'Annuaire — exécutez l\'import Annuaire depuis le module Annuaire');
  }

  const now = new Date();
  const gderpiFields = omitContactsFromGderpiFields({
    ...normalized,
    documents: existing.documents,
    updatedAt: now
  });

  await col.updateOne(
    { entrepriseId: String(entrepriseId), clientId: id },
    { $set: gderpiFields, $unset: gderpiContactsUnset() }
  );

  await pushClientIdentityToAnnuaire(db, entrepriseId, gderpiFields);
  return getClientById(db, entrepriseId, id);
}

module.exports = updateClient;
