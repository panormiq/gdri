/**
 * Middleware de contrôle d'accès UGAP
 * Fichier : modules/ugap/backend/middleware/requireUgapRole.js
 */

const path = require('path');
const database = require(path.join(__dirname, '../../../../backend/config/database'));
const { ObjectId } = require('mongodb');

function parseZoneList(raw) {
  if (Array.isArray(raw)) return raw.map((x) => String(x || '').trim()).filter(Boolean);
  if (raw && typeof raw === 'object') {
    return Object.keys(raw).filter((k) => Boolean(raw[k]));
  }
  return [];
}

function parseModuleZonePermissionsMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  Object.keys(raw).forEach((k) => {
    const key = String(k || '').trim().toLowerCase();
    if (!key) return;
    const arr = Array.isArray(raw[k]) ? raw[k].map((z) => String(z || '').trim().toLowerCase()).filter(Boolean) : [];
    if (arr.length > 0) out[key] = arr;
  });
  return out;
}

async function resolveUgapPermissions(req) {
  const user = req.user || {};
  if (user.role === 'ADMIN_GDRI' || user.role === 'superadmin') {
    return { use: true, configure: true };
  }

  const entityId = String(req.entrepriseId || user.currentEntrepriseId || user.entrepriseId || '').trim();
  const roleKey = user.role === 'ADMIN_ENTITY' ? 'admin' : 'user';
  let zones = roleKey === 'admin' ? ['use', 'configure'] : ['use'];

  if (/^[a-f0-9]{24}$/i.test(entityId)) {
    try {
      const db = await database.connect();
      const entity = await db.collection('entities').findOne({ _id: new ObjectId(entityId) });
      const defaults = entity?.default_ugap_permissions?.[roleKey];
      const parsedDefaults = parseZoneList(defaults);
      if (parsedDefaults.length > 0) zones = parsedDefaults;

      // Nouveau modèle dynamique par module: default_module_zone_permissions.{role}.ugap
      const defaultModuleZones = parseModuleZonePermissionsMap(entity?.default_module_zone_permissions?.[roleKey]);
      const ugapDefaultZones = parseZoneList(defaultModuleZones.ugap);
      if (ugapDefaultZones.length > 0) zones = ugapDefaultZones;
    } catch (_) {}
  }

  // Override utilisateur en base entreprise (si défini, remplace le défaut rôle)
  try {
    if (/^[a-f0-9]{24}$/i.test(entityId) && /^[a-f0-9]{24}$/i.test(String(user.user_id || ''))) {
      const entrepriseDb = await database.getEntrepriseDb(entityId);
      const userRef = await entrepriseDb.collection('users').findOne({ userId: new ObjectId(String(user.user_id)) });
      const userOverride = parseZoneList(userRef?.ugap_permissions);
      if (userOverride.length > 0) zones = userOverride;

      const userModuleZones = parseModuleZonePermissionsMap(userRef?.module_zone_permissions);
      const ugapUserZones = parseZoneList(userModuleZones.ugap);
      if (ugapUserZones.length > 0) zones = ugapUserZones;
    }
  } catch (_) {}

  const zoneSet = new Set(zones.map((z) => z.toLowerCase()));
  return {
    use: zoneSet.has('use'),
    configure: zoneSet.has('configure')
  };
}

function requireUgapRole(roles = []) {
  return async (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    const technicalAllowed = new Set(['USER_ENTITY', 'ADMIN_ENTITY', 'ADMIN_GDRI', 'superadmin']);
    if (!technicalAllowed.has(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé pour ce module'
      });
    }

    const needsConfigure = roles.includes('ADMIN_ENTITY') && !roles.includes('USER_ENTITY');
    const permissions = await resolveUgapPermissions(req);
    req.ugapPermissions = permissions;

    if (needsConfigure && !permissions.configure) {
      return res.status(403).json({
        success: false,
        message: 'Permission UGAP "configure" requise'
      });
    }

    if (!needsConfigure && !permissions.use) {
      return res.status(403).json({
        success: false,
        message: 'Permission UGAP "use" requise'
      });
    }

    next();
  };
}

module.exports = { requireUgapRole };
