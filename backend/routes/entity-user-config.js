const express = require('express');
const { ObjectId } = require('mongodb');
const { authenticateJWT } = require('../config/jwt');
const database = require('../config/database');

const router = express.Router();

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
    entrepriseUsersDocs.forEach((doc) => {
      if (!doc || !doc.userId) return;
      const uid = String(doc.userId);
      const arr = Array.isArray(doc.services_authorized) ? doc.services_authorized.map((x) => String(x)) : [];
      servicesByUserId.set(uid, arr);
    });

    const roles = await rolesCollection
      .find({ entity_id: entityId, isActive: { $ne: false } })
      .sort({ isSystem: -1, label: 1 })
      .toArray();

    const dataUsers = users.map((u) => {
      const ent = (u.entreprises || []).find((e) => String(e.entrepriseId) === entityId);
      return {
        id: String(u._id),
        email: u.email || '',
        status: u.status || 'active',
        role: (ent && ent.role) || 'user',
        services_authorized: servicesByUserId.get(String(u._id)) || [],
        entity_roles: Array.isArray(u.entity_roles) ? u.entity_roles : []
      };
    }).sort((a, b) => a.email.localeCompare(b.email));

    res.json({
      success: true,
      data: {
        entity: { id: String(entity._id), name: entity.name || '' },
        services: services.map((s) => ({
          id: String(s._id),
          name: s.name || 'Module',
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
    const postedRoles = Array.isArray(body.entity_roles) ? body.entity_roles : [];

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
    const validRoleKeys = postedRoles
      .map((r) => String(r || '').trim())
      .filter((r) => r && allowedRoleKeys.has(r));

    try {
      const entrepriseDb = await database.getEntrepriseDb(entityId);
      await entrepriseDb.collection('users').updateOne(
        { userId: new ObjectId(userId) },
        {
          $set: {
            userId: new ObjectId(userId),
            email: user.email || '',
            role: ((user.entreprises || []).find((e) => String(e.entrepriseId) === entityId)?.role) || 'user',
            services_authorized: validServiceObjectIds,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
    } catch (e) {
      return res.status(500).json({ success: false, message: "Base entreprise indisponible." });
    }

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { entity_roles: validRoleKeys, updated_at: new Date() } }
    );

    res.json({ success: true, message: 'Permissions mises a jour.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

module.exports = router;
