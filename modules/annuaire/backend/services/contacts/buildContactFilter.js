/**
 * Boutique = filtre d'affichage. Les contacts internes appartiennent à l'entité légale.
 * - Vue entité : tous les collaborateurs internes (y compris legacy rattachés à une boutique)
 * - Vue boutique : uniquement si boutiqueOrganisationIds contient cette boutique
 */

const getOrganisationById = require('../organisations/getOrganisationById');

const ORG_COL = 'annuaire_organisations';

function isInternalOrganisation(org) {
  if (!org) return false;
  if (org.isOwnEntity) return true;
  if (org.gderpiBoutiqueId) return true;
  if (org.scope === 'interne') return true;
  return Array.isArray(org.roles) && org.roles.indexOf('boutique') >= 0;
}

async function buildEntityViewContactFilter(db, entrepriseId) {
  const eid = String(entrepriseId);
  const orgs = await db.collection(ORG_COL)
    .find({ entrepriseId: eid })
    .project({ organisationId: 1, isOwnEntity: 1, gderpiBoutiqueId: 1, roles: 1, scope: 1 })
    .toArray();

  const internalOrgIds = orgs
    .filter(isInternalOrganisation)
    .map(function (o) { return o.organisationId; });

  const or = [{ scope: 'interne' }];
  if (internalOrgIds.length) {
    or.push({ organisationId: { $in: internalOrgIds } });
  }
  return { $or: or };
}

async function buildContactFilter(db, entrepriseId, organisationId, options = {}) {
  if (options.view === 'entity') {
    return buildEntityViewContactFilter(db, entrepriseId);
  }

  const eid = String(entrepriseId);
  const orgId = String(organisationId || '').trim();
  if (!orgId) return {};

  const org = await getOrganisationById(db, eid, orgId);
  if (!org) return { organisationId: orgId };

  if (org.isOwnEntity) {
    return buildEntityViewContactFilter(db, entrepriseId);
  }

  // Client / fournisseur
  if (!org.gderpiBoutiqueId) {
    return { organisationId: orgId };
  }

  // Boutique : case cochée obligatoire
  const ownDoc = await db.collection(ORG_COL).findOne({ entrepriseId: eid, isOwnEntity: true });
  const or = [
    {
      organisationId: orgId,
      boutiqueOrganisationIds: orgId
    }
  ];

  if (ownDoc) {
    or.push({
      organisationId: ownDoc.organisationId,
      boutiqueOrganisationIds: orgId
    });
  }

  or.push({
    scope: 'interne',
    boutiqueOrganisationIds: orgId
  });

  return { $or: or };
}

module.exports = buildContactFilter;
module.exports.buildEntityViewContactFilter = buildEntityViewContactFilter;
