/**
 * FICHIER : modules/gderpi/backend/services/boutiques/updateBoutique.js
 * RÔLE : Met à jour une boutique — identité vers Annuaire, paramètres locaux conservés.
 */

const normalizeBoutique = require('./normalizeBoutique');
const getBoutiqueById = require('./getBoutiqueById');
const path = require('path');
const isAnnuaireAvailable = require('../../integrations/annuaire-bridge/isAnnuaireAvailable');
const provisionAnnuaireForBoutique = require('../../integrations/annuaire-bridge/provisionAnnuaireForBoutique');
const pushBoutiqueIdentityToAnnuaire = require('../../integrations/annuaire-bridge/pushBoutiqueIdentityToAnnuaire');
const omitContactsFromGderpiFields = require('../../integrations/annuaire-bridge/omitContactsFromGderpiFields');
const gderpiContactsUnset = require('../../integrations/annuaire-bridge/gderpiContactsUnset');

const COLLECTION = 'gderpi_boutiques';

async function updateBoutique(db, entrepriseId, boutiqueId, data) {
  const id = String(boutiqueId || '').trim();
  if (!id) throw new Error('Identifiant boutique requis');
  const col = db.collection(COLLECTION);
  const eid = String(entrepriseId);
  const existing = await col.findOne({ entrepriseId: eid, boutiqueId: id });
  if (!existing) throw new Error('Boutique introuvable');

  const raw = data && typeof data === 'object' ? data : {};
  const patch = { ...raw };
  delete patch.contacts;

  const normalized = normalizeBoutique({ ...existing, ...patch, id });
  if (!normalized.nom) throw new Error('Nom de boutique requis');
  const slugConflict = await col.findOne({
    entrepriseId: eid,
    slug: normalized.slug,
    boutiqueId: { $ne: id }
  });
  if (slugConflict) throw new Error('Ce slug boutique existe déjà');

  let annuaireOrganisationId = normalized.annuaireOrganisationId || existing.annuaireOrganisationId || null;
  if (isAnnuaireAvailable()) {
    if (!annuaireOrganisationId) {
      annuaireOrganisationId = await provisionAnnuaireForBoutique(db, entrepriseId, normalized, raw);
    } else {
      await pushBoutiqueIdentityToAnnuaire(db, entrepriseId, {
        ...normalized,
        annuaireOrganisationId
      });
      if (normalized.isPrincipale === true) {
        const setPrimaryCompanyOrganisation = require(path.join(
          __dirname,
          '../../../../annuaire/backend/services/organisations/setPrimaryCompanyOrganisation.js'
        ));
        await setPrimaryCompanyOrganisation(db, entrepriseId, annuaireOrganisationId);
      }
    }
  }

  const now = new Date();
  const gderpiFields = omitContactsFromGderpiFields({
    ...normalized,
    annuaireOrganisationId,
    updatedAt: now
  });

  await col.updateOne(
    { entrepriseId: eid, boutiqueId: id },
    { $set: gderpiFields, $unset: gderpiContactsUnset() }
  );

  return getBoutiqueById(db, eid, id);
}

module.exports = updateBoutique;
