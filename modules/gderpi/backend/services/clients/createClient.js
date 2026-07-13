/**
 * FICHIER : modules/gderpi/backend/services/clients/createClient.js
 * RÔLE : Crée un client lié obligatoirement à l'Annuaire GDRI.
 */

const ensureClientIndexes = require('./ensureClientIndexes');
const normalizeClient = require('./normalizeClient');
const toClientEntry = require('./toClientEntry');
const requireAnnuaireForTiers = require('../../integrations/annuaire-bridge/requireAnnuaireForTiers');
const provisionAnnuaireForClient = require('../../integrations/annuaire-bridge/provisionAnnuaireForClient');
const linkOrganisationToGderpiClient = require('../../integrations/annuaire-bridge/linkOrganisationToGderpiClient');
const enrichClientWithAnnuaire = require('../../integrations/annuaire-bridge/enrichClientWithAnnuaire');
const omitContactsFromGderpiFields = require('../../integrations/annuaire-bridge/omitContactsFromGderpiFields');

const COLLECTION = 'gderpi_clients';

async function createClient(db, entrepriseId, data) {
  requireAnnuaireForTiers();

  const raw = data && typeof data === 'object' ? data : {};
  const normalized = normalizeClient(raw);
  const annuaireOrganisationId = await provisionAnnuaireForClient(db, entrepriseId, normalized, raw);

  await ensureClientIndexes(db);
  const col = db.collection(COLLECTION);
  const now = new Date();
  const doc = omitContactsFromGderpiFields({
    entrepriseId: String(entrepriseId),
    clientId: normalized.id,
    ...normalized,
    annuaireOrganisationId,
    createdAt: now,
    updatedAt: now
  });
  await col.insertOne(doc);
  await linkOrganisationToGderpiClient(db, entrepriseId, annuaireOrganisationId, normalized.id);

  return enrichClientWithAnnuaire(db, entrepriseId, toClientEntry(doc));
}

module.exports = createClient;
