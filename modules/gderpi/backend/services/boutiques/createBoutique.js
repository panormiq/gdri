/**
 * FICHIER : modules/gderpi/backend/services/boutiques/createBoutique.js
 * RÔLE : Crée une boutique et son organisation Annuaire interne si le module est actif.
 */

const ensureBoutiqueIndexes = require('./ensureBoutiqueIndexes');
const normalizeBoutique = require('./normalizeBoutique');
const toBoutiqueEntry = require('./toBoutiqueEntry');
const isAnnuaireAvailable = require('../../integrations/annuaire-bridge/isAnnuaireAvailable');
const provisionAnnuaireForBoutique = require('../../integrations/annuaire-bridge/provisionAnnuaireForBoutique');
const enrichBoutiqueWithAnnuaire = require('../../integrations/annuaire-bridge/enrichBoutiqueWithAnnuaire');
const omitContactsFromGderpiFields = require('../../integrations/annuaire-bridge/omitContactsFromGderpiFields');

const COLLECTION = 'gderpi_boutiques';

async function createBoutique(db, entrepriseId, data) {
  await ensureBoutiqueIndexes(db);
  const col = db.collection(COLLECTION);
  const eid = String(entrepriseId);
  const raw = data && typeof data === 'object' ? data : {};
  const normalized = normalizeBoutique(raw);
  if (!normalized.nom) throw new Error('Nom de boutique requis');
  const slugTaken = await col.findOne({ entrepriseId: eid, slug: normalized.slug });
  if (slugTaken) throw new Error('Ce slug boutique existe déjà');

  const existingCount = await col.countDocuments({ entrepriseId: eid });
  if (existingCount === 0) {
    normalized.isPrincipale = true;
  }

  let annuaireOrganisationId = null;
  if (isAnnuaireAvailable()) {
    annuaireOrganisationId = await provisionAnnuaireForBoutique(db, entrepriseId, normalized, raw);
  }

  const now = new Date();
  const doc = omitContactsFromGderpiFields({
    entrepriseId: eid,
    boutiqueId: normalized.id,
    ...normalized,
    annuaireOrganisationId,
    createdAt: now,
    updatedAt: now
  });
  await col.insertOne(doc);
  return enrichBoutiqueWithAnnuaire(db, entrepriseId, toBoutiqueEntry(doc));
}

module.exports = createBoutique;
