/**
 * Visibilité des applications pour un utilisateur dans une entité.
 *
 * Flux :
 * 1. Plafond entité : entity.services_authorized
 * 2. Defaults rôle structurel (admin/user) dans l'entité
 * 3. Restriction utilisateur (entrepriseDb.users.services_authorized) si définie
 */

const { ObjectId } = require('mongodb');
const database = require('../config/database');
const { normalizeMembershipRole, resolveEntityMembership } = require('./entity-member-users');

const INFRASTRUCTURE_SERVICE_SLUGS = new Set(['prompt', 'ia', 'serveria']);

function isInfrastructureService(service) {
  const slug = String(service?.slug || '').trim().toLowerCase();
  return slug !== '' && INFRASTRUCTURE_SERVICE_SLUGS.has(slug);
}

function dedupeServices(services) {
  const out = [];
  const seen = new Set();
  for (const service of services || []) {
    const id = String(service?._id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(service);
  }
  return out;
}

function intersectServices(services, allowedIds) {
  const set = new Set((allowedIds || []).map((x) => String(x)));
  return services.filter((s) => set.has(String(s._id)));
}

/**
 * Résout le rôle structurel (admin/user) de l'utilisateur dans l'entité courante.
 * Priorité : membership entreprises[].role, puis rôle JWT plateforme.
 */
function resolveMembershipRoleForEntity(userDoc, entityId, jwtRole) {
  const membership = resolveEntityMembership(userDoc, entityId);
  if (membership && membership.role) {
    return normalizeMembershipRole(membership.role);
  }
  if (jwtRole === 'ADMIN_ENTITY' || jwtRole === 'ADMIN_GDRI') {
    return 'admin';
  }
  return 'user';
}

/**
 * @param {import('mongodb').Db} db
 * @param {{
 *   userId: string,
 *   entityId: string,
 *   jwtRole?: string,
 *   includeInactive?: boolean,
 *   bypassUserRestrictions?: boolean
 * }} options
 */
async function resolveUserEntityServices(db, options) {
  const {
    userId,
    entityId,
    jwtRole = '',
    includeInactive = false,
    bypassUserRestrictions = false
  } = options;

  const entityIdStr = String(entityId);
  const usersCollection = db.collection('users');
  const entitiesCollection = db.collection('entities');
  const servicesCollection = db.collection('services');

  const [user, entity] = await Promise.all([
    usersCollection.findOne({ _id: new ObjectId(userId) }),
    entitiesCollection.findOne({ _id: new ObjectId(entityIdStr) })
  ]);

  if (!entity) {
    return { services: [], membershipRole: 'user', source: 'entity_missing' };
  }

  const authorizedIds = Array.isArray(entity.services_authorized) ? entity.services_authorized : [];
  let services = authorizedIds.length
    ? await servicesCollection.find({ _id: { $in: authorizedIds } }).toArray()
    : [];

  services = dedupeServices(services).filter((s) => !isInfrastructureService(s));
  if (!includeInactive) {
    services = services.filter((s) => String(s.status || 'active') === 'active');
  }

  const membershipRole = user
    ? resolveMembershipRoleForEntity(user, entityIdStr, jwtRole)
    : (jwtRole === 'ADMIN_ENTITY' || jwtRole === 'ADMIN_GDRI' ? 'admin' : 'user');

  // Étape 2 : defaults par rôle structurel (si configurés)
  if (!bypassUserRestrictions) {
    const roleDefaults = entity.default_module_permissions?.[membershipRole];
    if (Array.isArray(roleDefaults) && roleDefaults.length > 0) {
      services = intersectServices(services, roleDefaults);
    }
  }

  // Étape 3 : restriction fine utilisateur dans l'entité
  if (!bypassUserRestrictions) {
    try {
      const entrepriseDb = await database.getEntrepriseDb(entityIdStr);
      const userRef = await entrepriseDb.collection('users').findOne({ userId: new ObjectId(userId) });
      if (userRef && Object.prototype.hasOwnProperty.call(userRef, 'services_authorized')) {
        const userAllowed = Array.isArray(userRef.services_authorized)
          ? userRef.services_authorized.map((x) => String(x))
          : [];
        services = intersectServices(services, userAllowed);
      }
    } catch (_) {
      // Base entreprise indisponible : on conserve le résultat role defaults / entité.
    }
  }

  return {
    services,
    membershipRole,
    source: 'entity_user'
  };
}

/**
 * Calcule services_authorized initiaux pour un nouvel utilisateur invité.
 */
function resolveInitialUserServiceIds(entity, membershipRole) {
  const entityIds = (Array.isArray(entity?.services_authorized) ? entity.services_authorized : [])
    .map((x) => String(x))
    .filter((id) => /^[a-f0-9]{24}$/i.test(id));
  const roleDefaults = entity?.default_module_permissions?.[membershipRole];
  if (Array.isArray(roleDefaults) && roleDefaults.length > 0) {
    const allowed = new Set(entityIds);
    return roleDefaults.map(String).filter((id) => allowed.has(id) && /^[a-f0-9]{24}$/i.test(id));
  }
  return entityIds;
}

module.exports = {
  INFRASTRUCTURE_SERVICE_SLUGS,
  dedupeServices,
  intersectServices,
  isInfrastructureService,
  resolveInitialUserServiceIds,
  resolveMembershipRoleForEntity,
  resolveUserEntityServices
};
