/**
 * FICHIER : modules/annuaire/backend/services/integrations/gderpi/upsertOrganisationFromGderpi.js
 * RÔLE : Crée ou met à jour une organisation Annuaire depuis un tiers GDERPI.
 */

const toOrganisationEntry = require('../../organisations/toOrganisationEntry');

const ORG_COL = 'annuaire_organisations';

function buildOrganisationFilter(entrepriseId, payload) {
  const eid = String(entrepriseId);
  if (payload.gderpiClientId) {
    return { entrepriseId: eid, gderpiClientId: String(payload.gderpiClientId) };
  }
  if (payload.gderpiFournisseurId) {
    return { entrepriseId: eid, gderpiFournisseurId: String(payload.gderpiFournisseurId) };
  }
  if (payload.gderpiBoutiqueId) {
    return { entrepriseId: eid, gderpiBoutiqueId: String(payload.gderpiBoutiqueId) };
  }
  if (payload.organisationId) {
    return { entrepriseId: eid, organisationId: String(payload.organisationId) };
  }
  return null;
}

async function upsertOrganisationFromGderpi(db, entrepriseId, payload) {
  const filter = buildOrganisationFilter(entrepriseId, payload);
  if (!filter) throw new Error('Identifiant GDERPI organisation manquant');

  const existing = await db.collection(ORG_COL).findOne(filter);
  const now = new Date();
  const scope = payload.scope === 'interne' ? 'interne' : 'externe';

  if (existing) {
    const set = {
      raisonSociale: payload.raisonSociale || existing.raisonSociale,
      prenom: payload.prenom ?? existing.prenom ?? '',
      nom: payload.nom ?? existing.nom ?? '',
      type: payload.type || existing.type || 'entreprise',
      scope: payload.scope || existing.scope || scope,
      roles: payload.roles || existing.roles,
      siret: payload.siret || existing.siret,
      formeJuridique: payload.formeJuridique ?? existing.formeJuridique ?? '',
      tvaIntracommunautaire: payload.tvaIntracommunautaire ?? existing.tvaIntracommunautaire ?? '',
      rcs: payload.rcs ?? existing.rcs ?? '',
      capitalSocial: payload.capitalSocial ?? existing.capitalSocial ?? '',
      adresse: payload.adresse ?? existing.adresse ?? '',
      codePostal: payload.codePostal ?? existing.codePostal ?? '',
      ville: payload.ville ?? existing.ville ?? '',
      pays: payload.pays ?? existing.pays ?? 'France',
      email: payload.email || existing.email,
      telephone: payload.telephone || existing.telephone,
      siteWeb: payload.siteWeb ?? existing.siteWeb ?? '',
      logo: payload.logo ?? existing.logo ?? '',
      notes: payload.notes ?? existing.notes ?? '',
      gderpiClientId: payload.gderpiClientId ?? existing.gderpiClientId ?? null,
      gderpiFournisseurId: payload.gderpiFournisseurId ?? existing.gderpiFournisseurId ?? null,
      gderpiBoutiqueId: payload.gderpiBoutiqueId ?? existing.gderpiBoutiqueId ?? null,
      updatedAt: now
    };
    await db.collection(ORG_COL).updateOne(
      { _id: existing._id },
      { $set: set }
    );
    const doc = await db.collection(ORG_COL).findOne({ _id: existing._id });
    return { org: toOrganisationEntry(doc), created: false };
  }

  const doc = {
    entrepriseId: String(entrepriseId),
    organisationId: payload.organisationId,
    raisonSociale: payload.raisonSociale,
    prenom: payload.prenom || '',
    nom: payload.nom || '',
    type: payload.type || 'entreprise',
    scope,
    roles: payload.roles || (scope === 'interne' && payload.gderpiBoutiqueId ? ['boutique'] : scope === 'interne' ? ['interne'] : ['client']),
    siret: payload.siret || '',
    formeJuridique: payload.formeJuridique || '',
    tvaIntracommunautaire: payload.tvaIntracommunautaire || '',
    rcs: payload.rcs || '',
    capitalSocial: payload.capitalSocial || '',
    adresse: payload.adresse || '',
    codePostal: payload.codePostal || '',
    ville: payload.ville || '',
    pays: payload.pays || 'France',
    logo: payload.logo || '',
    email: payload.email || '',
    telephone: payload.telephone || '',
    siteWeb: payload.siteWeb || '',
    notes: payload.notes || '',
    isOwnEntity: false,
    gderpiClientId: payload.gderpiClientId || null,
    gderpiFournisseurId: payload.gderpiFournisseurId || null,
    gderpiBoutiqueId: payload.gderpiBoutiqueId || null,
    createdAt: now,
    updatedAt: now
  };
  await db.collection(ORG_COL).insertOne(doc);
  return { org: toOrganisationEntry(doc), created: true };
}

module.exports = upsertOrganisationFromGderpi;
