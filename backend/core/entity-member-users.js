/**
 * Membres d'une entité (périmètre backoffice entité).
 * - Membres : users.entreprises[].entrepriseId
 * - Rôles métier : collection entity_roles (console entité)
 * - Les rôles plateforme (ADMIN_GDRI, ADMIN_ENTITY, USER_ENTITY) ne font pas partie du périmètre entité.
 */

const { ObjectId } = require('mongodb');

const PLATFORM_GLOBAL_ROLES = new Set(['ADMIN_GDRI', 'ADMIN_ENTITY', 'USER_ENTITY']);

const DEFAULT_ENTITY_ROLES = [
  {
    key: 'admin',
    label: 'Administrateur',
    description: 'Gère l\'entité, les utilisateurs et la configuration.',
    isSystem: true
  },
  {
    key: 'user',
    label: 'Utilisateur',
    description: 'Accès standard aux applications autorisées.',
    isSystem: true
  }
];

const STRUCTURAL_ROLE_KEYS = new Set(DEFAULT_ENTITY_ROLES.map((r) => r.key));

function resolveEntityMembership(userDoc, entityId) {
  const entityIdStr = String(entityId);
  return (userDoc.entreprises || []).find(
    (entry) => entry && String(entry.entrepriseId) === entityIdStr
  ) || null;
}

function isPlatformOperator(userDoc) {
  return PLATFORM_GLOBAL_ROLES.has(String(userDoc?.role || '').trim());
}

/** Rôle d'appartenance entité (admin / user) — jamais un rôle plateforme JWT. */
function normalizeMembershipRole(raw) {
  const r = String(raw || '').trim();
  if (!r || r === 'ADMIN_GDRI') return 'user';
  if (r === 'ADMIN_ENTITY' || r === 'admin') return 'admin';
  if (r === 'USER_ENTITY' || r === 'user') return 'user';
  return r.toLowerCase();
}

function isPlatformRoleKey(key) {
  return PLATFORM_GLOBAL_ROLES.has(String(key || '').trim());
}

function isStructuralRoleKey(key) {
  return STRUCTURAL_ROLE_KEYS.has(String(key || '').trim());
}

function mapEntityRoleDoc(roleDoc) {
  return {
    key: String(roleDoc.key || '').trim(),
    label: String(roleDoc.label || roleDoc.key || '').trim(),
    description: String(roleDoc.description || '').trim(),
    isSystem: !!roleDoc.isSystem,
    isActive: roleDoc.isActive !== false,
    roleKind: roleDoc.isSystem ? 'structural' : 'functional'
  };
}

/**
 * Garantit la présence des rôles structurels (admin, user) pour une entité.
 * @param {import('mongodb').Db} db
 * @param {string} entityId
 */
async function ensureEntityStructuralRoles(db, entityId) {
  const entityIdStr = String(entityId);
  const coll = db.collection('entity_roles');
  const now = new Date();

  for (const def of DEFAULT_ENTITY_ROLES) {
    await coll.updateOne(
      { entity_id: entityIdStr, key: def.key },
      {
        $setOnInsert: {
          entity_id: entityIdStr,
          key: def.key,
          label: def.label,
          description: def.description || '',
          isSystem: true,
          isActive: true,
          createdAt: now
        },
        $set: { updatedAt: now }
      },
      { upsert: true }
    );
  }
}

/**
 * Rôles métier actifs définis dans la console entité.
 * @param {import('mongodb').Db} db
 * @param {string} entityId
 */
async function getActiveEntityRoles(db, entityId) {
  await ensureEntityStructuralRoles(db, entityId);
  const roles = await db.collection('entity_roles')
    .find({ entity_id: String(entityId), isActive: { $ne: false } })
    .sort({ isSystem: -1, label: 1 })
    .toArray();

  const mapped = roles
    .map(mapEntityRoleDoc)
    .filter((r) => r.key && !isPlatformRoleKey(r.key));

  if (mapped.length) return mapped;
  return DEFAULT_ENTITY_ROLES.map((r) => ({
    key: r.key,
    label: r.label,
    description: r.description || '',
    isSystem: true,
    isActive: true,
    roleKind: 'structural'
  }));
}

/**
 * Tous les rôles entité (actifs et inactifs), pour la console de gestion.
 * @param {import('mongodb').Db} db
 * @param {string} entityId
 */
async function getAllEntityRoles(db, entityId) {
  await ensureEntityStructuralRoles(db, entityId);
  const roles = await db.collection('entity_roles')
    .find({ entity_id: String(entityId) })
    .sort({ isSystem: -1, label: 1 })
    .toArray();

  return roles
    .map((r) => ({
      ...mapEntityRoleDoc(r),
      _id: r._id
    }))
    .filter((r) => r.key && !isPlatformRoleKey(r.key));
}

function isPlatformGdriAdmin(userDoc) {
  return String(userDoc?.role || '').trim() === 'ADMIN_GDRI';
}

/**
 * @param {import('mongodb').Collection} usersCollection
 * @param {string} entityId
 * @param {{ excludePlatformOperators?: boolean }} [options]
 */
async function findEntityMemberUsers(usersCollection, entityId, options = {}) {
  const { excludePlatformOperators = true } = options;
  const entityOid = new ObjectId(entityId);
  const entityIdStr = String(entityId);

  const users = await usersCollection.find({
    $or: [
      { entreprises: { $elemMatch: { entrepriseId: entityOid } } },
      { entreprises: { $elemMatch: { entrepriseId: entityIdStr } } }
    ]
  }).project({
    email: 1,
    status: 1,
    name: 1,
    firstname: 1,
    role: 1,
    entreprises: 1,
    entity_roles: 1
  }).toArray();

  const members = [];
  for (const userDoc of users) {
    // Ne masquer que les admins plateforme GDRI, pas les membres entité (USER_ENTITY / ADMIN_ENTITY).
    if (excludePlatformOperators && isPlatformGdriAdmin(userDoc)) {
      continue;
    }
    const membership = resolveEntityMembership(userDoc, entityIdStr);
    if (!membership) {
      continue;
    }
    const rawMembershipRole = membership.role;
    if (String(rawMembershipRole || '').trim() === 'ADMIN_GDRI') {
      continue;
    }
    const businessRoles = (Array.isArray(userDoc.entity_roles) ? userDoc.entity_roles : [])
      .map((k) => String(k || '').trim())
      .filter((k) => k && !isPlatformRoleKey(k) && !isStructuralRoleKey(k));

    members.push({
      doc: userDoc,
      userId: String(userDoc._id),
      email: userDoc.email || '',
      name: userDoc.name || userDoc.firstname || '',
      status: userDoc.status || 'active',
      membershipRole: normalizeMembershipRole(rawMembershipRole),
      entity_roles: businessRoles
    });
  }

  members.sort((a, b) => a.email.localeCompare(b.email));
  return members;
}

module.exports = {
  PLATFORM_GLOBAL_ROLES,
  DEFAULT_ENTITY_ROLES,
  STRUCTURAL_ROLE_KEYS,
  ensureEntityStructuralRoles,
  findEntityMemberUsers,
  getActiveEntityRoles,
  getAllEntityRoles,
  isPlatformOperator,
  isPlatformRoleKey,
  isStructuralRoleKey,
  normalizeMembershipRole,
  resolveEntityMembership
};
