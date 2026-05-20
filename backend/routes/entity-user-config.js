const express = require('express');
const { ObjectId } = require('mongodb');
const { authenticateJWT } = require('../config/jwt');
const database = require('../config/database');

const router = express.Router();

function parseUgapPermissionList(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => String(x || '').trim().toLowerCase())
    .filter((x) => x === 'use' || x === 'configure');
}

function sanitizeZoneKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

function sanitizeModuleSlug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function parseModuleZonePermissionsMap(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  Object.keys(raw).forEach((slugRaw) => {
    const slug = sanitizeModuleSlug(slugRaw);
    if (!slug) return;
    const zonesRaw = Array.isArray(raw[slugRaw]) ? raw[slugRaw] : [];
    const zones = zonesRaw.map(sanitizeZoneKey).filter(Boolean);
    if (zones.length > 0) out[slug] = Array.from(new Set(zones));
  });
  return out;
}

function resolveEntityId(req, res) {
  if (req.user.role !== 'ADMIN_GDRI' && req.user.role !== 'ADMIN_ENTITY') {
    res.status(403).json({ success: false, message: 'Acces refuse' });
    return null;
  }
  const entityId = req.query.entity_id || req.user.currentEntrepriseId || req.user.entrepriseId;
  if (!entityId || !/^[a-f0-9]{24}$/i.test(String(entityId))) {
    res.status(400).json({ success: false, message: 'Entite invalide' });
    return null;
  }
  return String(entityId);
}

router.get('/', authenticateJWT, async (req, res) => {
  try {
    const entityId = resolveEntityId(req, res);
    if (!entityId) return;

    const db = await database.connect();
    const entitiesCollection = db.collection('entities');
    const servicesCollection = db.collection('services');
    const usersCollection = db.collection('users');
    const rolesCollection = db.collection('entity_roles');

    const entity = await entitiesCollection.findOne({ _id: new ObjectId(entityId), status: 'active' });
    if (!entity) return res.status(404).json({ success: false, message: 'Entite introuvable ou inactive' });

    const authorizedIds = Array.isArray(entity.services_authorized) ? entity.services_authorized : [];
    const services = authorizedIds.length
      ? await servicesCollection.find({ _id: { $in: authorizedIds } }).toArray()
      : [];

    const users = await usersCollection.find({
      entreprises: { $elemMatch: { entrepriseId: new ObjectId(entityId) } }
    }).project({ email: 1, status: 1, entreprises: 1, entity_roles: 1 }).toArray();

    let entrepriseUsersDocs = [];
    try {
      const entrepriseDb = await database.getEntrepriseDb(entityId);
      entrepriseUsersDocs = await entrepriseDb.collection('users').find({}).toArray();
    } catch (e) {
      // Keep working without enterprise users document details.
      entrepriseUsersDocs = [];
    }
    const servicesByUserId = new Map();
    const ugapPermissionsByUserId = new Map();
    entrepriseUsersDocs.forEach((doc) => {
      if (!doc || !doc.userId) return;
      const uid = String(doc.userId);
      const arr = Array.isArray(doc.services_authorized) ? doc.services_authorized.map((x) => String(x)) : [];
      servicesByUserId.set(uid, arr);
      const ugap = parseUgapPermissionList(doc.ugap_permissions);
      if (ugap.length > 0) ugapPermissionsByUserId.set(uid, ugap);
    });

    const roles = await rolesCollection
      .find({ entity_id: entityId, isActive: { $ne: false } })
      .sort({ isSystem: -1, label: 1 })
      .toArray();

    const ownerUserId = entity?.ownerUserId ? String(entity.ownerUserId) : '';
    const roleDefaults = entity?.default_module_permissions || {};
    const defaultAdmin = Array.isArray(roleDefaults.admin) ? roleDefaults.admin.map((x) => String(x)) : [];
    const defaultUser = Array.isArray(roleDefaults.user) ? roleDefaults.user.map((x) => String(x)) : [];
    const ugapDefaults = entity?.default_ugap_permissions || {};
    const defaultUgapAdmin = parseUgapPermissionList(ugapDefaults.admin);
    const defaultUgapUser = parseUgapPermissionList(ugapDefaults.user);
    const zoneDefaults = entity?.default_module_zone_permissions || {};
    const defaultZoneAdmin = parseModuleZonePermissionsMap(zoneDefaults.admin);
    const defaultZoneUser = parseModuleZonePermissionsMap(zoneDefaults.user);
    const dataUsers = users.map((u) => {
      const ent = (u.entreprises || []).find((e) => String(e.entrepriseId) === entityId);
      return {
        id: String(u._id),
        email: u.email || '',
        status: u.status || 'active',
        role: (ent && ent.role) || 'user',
        isOwner: ownerUserId && String(u._id) === ownerUserId,
        services_authorized: servicesByUserId.get(String(u._id)) || [],
        ugap_permissions: ugapPermissionsByUserId.get(String(u._id)) || [],
        module_zone_permissions: parseModuleZonePermissionsMap(u?.module_zone_permissions),
        entity_roles: Array.isArray(u.entity_roles) ? u.entity_roles : []
      };
    }).sort((a, b) => a.email.localeCompare(b.email));

    res.json({
      success: true,
      data: {
        entity: {
          id: String(entity._id),
          name: entity.name || '',
          ownerUserId: ownerUserId || null,
          defaultModulePermissions: {
            admin: defaultAdmin,
            user: defaultUser
          },
          defaultUgapPermissions: {
            admin: defaultUgapAdmin,
            user: defaultUgapUser
          },
          defaultModuleZonePermissions: {
            admin: defaultZoneAdmin,
            user: defaultZoneUser
          }
        },
        services: services.map((s) => ({
          id: String(s._id),
          name: s.name || 'Module',
          slug: s.slug || '',
          icon: s.icon || '🧩',
          description: s.description || ''
        })),
        users: dataUsers,
        roles: roles.map((r) => ({
          key: String(r.key || ''),
          label: String(r.label || r.key || ''),
          isSystem: !!r.isSystem
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

router.put('/user/:userId', authenticateJWT, async (req, res) => {
  try {
    const entityId = resolveEntityId(req, res);
    if (!entityId) return;
    const userId = String(req.params.userId || '');
    if (!/^[a-f0-9]{24}$/i.test(userId)) {
      return res.status(400).json({ success: false, message: 'Utilisateur invalide' });
    }

    const body = req.body || {};
    const postedServices = Array.isArray(body.services_authorized) ? body.services_authorized : [];
    const hasPostedRoles = Object.prototype.hasOwnProperty.call(body, 'entity_roles');
    const postedRoles = hasPostedRoles && Array.isArray(body.entity_roles) ? body.entity_roles : null;
    const hasUgapPermissions = Object.prototype.hasOwnProperty.call(body, 'ugap_permissions');
    const postedUgapPermissions = hasUgapPermissions ? parseUgapPermissionList(body.ugap_permissions) : null;
    const hasModuleZonePermissions = Object.prototype.hasOwnProperty.call(body, 'module_zone_permissions');
    const postedModuleZonePermissions = hasModuleZonePermissions ? parseModuleZonePermissionsMap(body.module_zone_permissions) : null;

    const db = await database.connect();
    const usersCollection = db.collection('users');
    const entitiesCollection = db.collection('entities');
    const rolesCollection = db.collection('entity_roles');

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    const inEntity = (user.entreprises || []).some((e) => String(e.entrepriseId) === entityId);
    if (!inEntity) return res.status(400).json({ success: false, message: 'Utilisateur hors entite' });

    const entity = await entitiesCollection.findOne({ _id: new ObjectId(entityId) });
    const allowedServiceIds = new Set((entity?.services_authorized || []).map((x) => String(x)));
    const validServiceObjectIds = postedServices
      .filter((id) => /^[a-f0-9]{24}$/i.test(String(id)) && allowedServiceIds.has(String(id)))
      .map((id) => new ObjectId(String(id)));

    const availableRoles = await rolesCollection.find({ entity_id: entityId }).toArray();
    const allowedRoleKeys = new Set(availableRoles.map((r) => String(r.key || '')));
    const validRoleKeys = Array.isArray(postedRoles)
      ? postedRoles
        .map((r) => String(r || '').trim())
        .filter((r) => r && allowedRoleKeys.has(r))
      : (Array.isArray(user.entity_roles) ? user.entity_roles : []);

    try {
      const entrepriseDb = await database.getEntrepriseDb(entityId);
      const setPayload = {
        userId: new ObjectId(userId),
        email: user.email || '',
        role: ((user.entreprises || []).find((e) => String(e.entrepriseId) === entityId)?.role) || 'user',
        services_authorized: validServiceObjectIds,
        updatedAt: new Date()
      };
      if (Array.isArray(postedUgapPermissions)) {
        setPayload.ugap_permissions = postedUgapPermissions;
      }
      await entrepriseDb.collection('users').updateOne(
        { userId: new ObjectId(userId) },
        {
          $set: setPayload
        },
        { upsert: true }
      );
    } catch (e) {
      return res.status(500).json({ success: false, message: "Base entreprise indisponible." });
    }

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          entity_roles: validRoleKeys,
          ...(postedModuleZonePermissions ? { module_zone_permissions: postedModuleZonePermissions } : {}),
          updated_at: new Date()
        }
      }
    );

    res.json({ success: true, message: 'Permissions mises a jour.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

router.put('/defaults', authenticateJWT, async (req, res) => {
  try {
    const entityId = resolveEntityId(req, res);
    if (!entityId) return;

    const postedAdmin = Array.isArray(req.body?.admin) ? req.body.admin : [];
    const postedUser = Array.isArray(req.body?.user) ? req.body.user : [];
    const postedUgapAdmin = parseUgapPermissionList(req.body?.ugap_admin);
    const postedUgapUser = parseUgapPermissionList(req.body?.ugap_user);
    const postedModuleZoneAdmin = parseModuleZonePermissionsMap(req.body?.module_zone_admin);
    const postedModuleZoneUser = parseModuleZonePermissionsMap(req.body?.module_zone_user);

    const db = await database.connect();
    const entitiesCollection = db.collection('entities');
    const entity = await entitiesCollection.findOne({ _id: new ObjectId(entityId), status: 'active' });
    if (!entity) return res.status(404).json({ success: false, message: 'Entite introuvable ou inactive' });

    const allowedServiceIds = new Set((entity.services_authorized || []).map((x) => String(x)));
    const normalize = (arr) => arr
      .map((id) => String(id || '').trim())
      .filter((id) => /^[a-f0-9]{24}$/i.test(id) && allowedServiceIds.has(id));

    const admin = normalize(postedAdmin);
    const user = normalize(postedUser);

    await entitiesCollection.updateOne(
      { _id: new ObjectId(entityId) },
      {
        $set: {
          default_module_permissions: {
            admin: admin.map((id) => new ObjectId(id)),
            user: user.map((id) => new ObjectId(id))
          },
          default_ugap_permissions: {
            admin: postedUgapAdmin,
            user: postedUgapUser
          },
          default_module_zone_permissions: {
            admin: postedModuleZoneAdmin,
            user: postedModuleZoneUser
          },
          updated_at: new Date()
        }
      }
    );

    return res.json({
      success: true,
      message: 'Permissions par defaut mises a jour',
      data: {
        admin,
        user,
        ugap_admin: postedUgapAdmin,
        ugap_user: postedUgapUser,
        module_zone_admin: postedModuleZoneAdmin,
        module_zone_user: postedModuleZoneUser
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

router.post('/owner/transfer', authenticateJWT, async (req, res) => {
  try {
    const entityId = resolveEntityId(req, res);
    if (!entityId) return;

    const targetUserId = String(req.body?.targetUserId || '');
    if (!/^[a-f0-9]{24}$/i.test(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Utilisateur cible invalide' });
    }

    const db = await database.connect();
    const entitiesCollection = db.collection('entities');
    const usersCollection = db.collection('users');

    const entity = await entitiesCollection.findOne({ _id: new ObjectId(entityId), status: 'active' });
    if (!entity) return res.status(404).json({ success: false, message: 'Entite introuvable ou inactive' });

    const ownerUserId = entity?.ownerUserId ? String(entity.ownerUserId) : '';
    const requesterUserId = String(req.user.user_id || '');
    const isAdminGdri = req.user.role === 'ADMIN_GDRI';
    const isCurrentOwner = ownerUserId && ownerUserId === requesterUserId;

    if (!isAdminGdri && !isCurrentOwner) {
      return res.status(403).json({ success: false, message: 'Seul le owner ou un ADMIN_GDRI peut transferer la couronne' });
    }

    const targetUser = await usersCollection.findOne({ _id: new ObjectId(targetUserId) });
    if (!targetUser) return res.status(404).json({ success: false, message: 'Utilisateur cible introuvable' });

    const targetEntityMembership = (targetUser.entreprises || []).find((e) => String(e.entrepriseId) === entityId);
    if (!targetEntityMembership) {
      return res.status(400).json({ success: false, message: 'Utilisateur cible hors entite' });
    }
    if (String(targetEntityMembership.role || 'user') !== 'admin') {
      return res.status(400).json({ success: false, message: 'La couronne ne peut etre transferee qu\'a un administrateur' });
    }

    await entitiesCollection.updateOne(
      { _id: new ObjectId(entityId) },
      { $set: { ownerUserId: new ObjectId(targetUserId), updated_at: new Date() } }
    );

    return res.json({
      success: true,
      message: 'Owner transfere avec succes',
      data: { ownerUserId: targetUserId }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

module.exports = router;
