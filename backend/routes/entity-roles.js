const express = require('express');
const { ObjectId } = require('mongodb');
const { authenticateJWT } = require('../config/jwt');
const database = require('../config/database');

const router = express.Router();

function ensureEntityScope(req, res) {
  const isAdminGdri = req.user.role === 'ADMIN_GDRI';
  const isAdminEntity = req.user.role === 'ADMIN_ENTITY';
  if (!isAdminGdri && !isAdminEntity) {
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
    const entityId = ensureEntityScope(req, res);
    if (!entityId) return;
    const db = await database.connect();
    const roles = await db.collection('entity_roles')
      .find({ entity_id: entityId })
      .sort({ isSystem: -1, label: 1 })
      .toArray();
    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

router.post('/', authenticateJWT, async (req, res) => {
  try {
    const entityId = ensureEntityScope(req, res);
    if (!entityId) return;
    const label = String(req.body.label || '').trim();
    const description = String(req.body.description || '').trim();
    const key = String(req.body.key || '').trim();
    if (!label || !key) return res.status(400).json({ success: false, message: 'Donnees invalides' });
    const db = await database.connect();
    const coll = db.collection('entity_roles');
    const exists = await coll.findOne({ entity_id: entityId, key });
    if (exists) return res.status(409).json({ success: false, message: 'Role deja existant' });
    const doc = {
      entity_id: entityId,
      key,
      label,
      description,
      isSystem: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await coll.insertOne(doc);
    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

router.put('/:key/toggle', authenticateJWT, async (req, res) => {
  try {
    const entityId = ensureEntityScope(req, res);
    if (!entityId) return;
    const key = String(req.params.key || '').trim();
    const db = await database.connect();
    const coll = db.collection('entity_roles');
    const role = await coll.findOne({ entity_id: entityId, key });
    if (!role) return res.status(404).json({ success: false, message: 'Role introuvable' });
    const next = !(role.isActive !== false);
    await coll.updateOne({ entity_id: entityId, key }, { $set: { isActive: next, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

router.delete('/:key', authenticateJWT, async (req, res) => {
  try {
    const entityId = ensureEntityScope(req, res);
    if (!entityId) return;
    const key = String(req.params.key || '').trim();
    const db = await database.connect();
    const coll = db.collection('entity_roles');
    const role = await coll.findOne({ entity_id: entityId, key });
    if (!role) return res.status(404).json({ success: false, message: 'Role introuvable' });
    if (role.isSystem) return res.status(400).json({ success: false, message: 'Role systeme non supprimable' });
    await coll.deleteOne({ entity_id: entityId, key });
    await db.collection('users').updateMany(
      { 'entreprises.entrepriseId': new ObjectId(entityId), entity_roles: key },
      { $pull: { entity_roles: key } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

router.get('/ugap/users', authenticateJWT, async (req, res) => {
  try {
    const entityId = ensureEntityScope(req, res);
    if (!entityId) return;
    const db = await database.connect();
    const users = await db.collection('users').find({
      entreprises: { $elemMatch: { entrepriseId: new ObjectId(entityId) } }
    }).project({ email: 1, status: 1, role: 1, entreprises: 1 }).toArray();
    const roleDocs = await db.collection('ugap_module_user_roles').find({ entity_id: entityId }).toArray();
    const roleByUser = new Map(roleDocs.map(r => [String(r.user_id), String(r.role || 'user')]));
    const data = users.map(u => {
      const ent = (u.entreprises || []).find(e => String(e.entrepriseId) === entityId);
      const entityRole = String((ent && ent.role) || 'user');
      const globalRole = String(u.role || 'USER_ENTITY');
      const defaultRole = (globalRole === 'ADMIN_GDRI' || globalRole === 'ADMIN_ENTITY' || entityRole === 'admin') ? 'admin' : 'user';
      return {
        id: String(u._id),
        email: u.email || '',
        status: u.status || 'active',
        entity_role: entityRole,
        module_role: roleByUser.get(String(u._id)) || defaultRole
      };
    }).sort((a, b) => a.email.localeCompare(b.email));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

router.put('/ugap/users', authenticateJWT, async (req, res) => {
  try {
    const entityId = ensureEntityScope(req, res);
    if (!entityId) return;
    const roles = req.body.roles && typeof req.body.roles === 'object' ? req.body.roles : {};
    const docs = [];
    Object.keys(roles).forEach((userId) => {
      if (!/^[a-f0-9]{24}$/i.test(String(userId))) return;
      const role = String(roles[userId] || 'user').toLowerCase() === 'admin' ? 'admin' : 'user';
      docs.push({
        entity_id: entityId,
        user_id: String(userId),
        role,
        updatedAt: new Date()
      });
    });
    const coll = (await database.connect()).collection('ugap_module_user_roles');
    for (const d of docs) {
      await coll.updateOne(
        { entity_id: d.entity_id, user_id: d.user_id },
        { $set: d, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      );
    }
    res.json({ success: true, updated: docs.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

module.exports = router;
