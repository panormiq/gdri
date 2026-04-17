const express = require('express');
const { ObjectId } = require('mongodb');
const { authenticateJWT } = require('../config/jwt');
const database = require('../config/database');

const router = express.Router();

function parseDate(value) {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function serializeLog(doc) {
  return {
    id: doc._id ? String(doc._id) : null,
    user_id: doc.user_id ? String(doc.user_id) : null,
    user_email: doc.user_email || null,
    user_role: doc.user_role || null,
    entreprise_id: doc.entreprise_id ? String(doc.entreprise_id) : null,
    event_type: doc.event_type || null,
    event_data: doc.event_data || null,
    ip_address: doc.ip_address || null,
    user_agent: doc.user_agent || null,
    created_at: doc.created_at ? new Date(doc.created_at).toISOString() : null
  };
}

router.post('/user', authenticateJWT, async (req, res) => {
  try {
    const { eventType, eventData } = req.body || {};
    if (!eventType || typeof eventType !== 'string') {
      return res.status(400).json({ success: false, message: 'eventType requis' });
    }

    const db = await database.connect();
    await db.collection('user_activity_logs').insertOne({
      user_id: req.user.user_id || null,
      user_email: req.user.email || null,
      user_role: req.user.role || null,
      entreprise_id: req.user.currentEntrepriseId || req.user.entrepriseId || null,
      event_type: eventType,
      event_data: eventData && typeof eventData === 'object' ? eventData : {},
      ip_address: req.ip || req.headers['x-forwarded-for'] || null,
      user_agent: req.headers['user-agent'] || null,
      created_at: new Date()
    });

    return res.json({ success: true, message: 'Log utilisateur enregistré' });
  } catch (error) {
    console.error('Erreur route POST /api/activity-logs/user:', error);
    return res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

router.post('/admin', authenticateJWT, async (req, res) => {
  try {
    const { eventType, eventData } = req.body || {};
    if (!eventType || typeof eventType !== 'string') {
      return res.status(400).json({ success: false, message: 'eventType requis' });
    }
    if (req.user.role !== 'ADMIN_GDRI' && req.user.role !== 'ADMIN_ENTITY') {
      return res.status(403).json({ success: false, message: 'Accès interdit' });
    }

    const db = await database.connect();
    await db.collection('admin_activity_logs').insertOne({
      user_id: req.user.user_id || null,
      user_email: req.user.email || null,
      user_role: req.user.role || null,
      entreprise_id: req.user.currentEntrepriseId || req.user.entrepriseId || null,
      event_type: eventType,
      event_data: eventData && typeof eventData === 'object' ? eventData : {},
      ip_address: req.ip || req.headers['x-forwarded-for'] || null,
      user_agent: req.headers['user-agent'] || null,
      created_at: new Date()
    });

    return res.json({ success: true, message: 'Log admin enregistré' });
  } catch (error) {
    console.error('Erreur route POST /api/activity-logs/admin:', error);
    return res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

router.get('/user', authenticateJWT, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN_GDRI') {
      return res.status(403).json({ success: false, message: 'Accès interdit' });
    }

    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 200));
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filters = {};
    if (req.query.event_type) filters.event_type = String(req.query.event_type);
    if (req.query.user_email) {
      const escaped = String(req.query.user_email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filters.user_email = new RegExp(escaped, 'i');
    }
    if (req.query.entreprise_id) filters.entreprise_id = String(req.query.entreprise_id);

    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (from || to) {
      filters.created_at = {};
      if (from) filters.created_at.$gte = from;
      if (to) filters.created_at.$lte = to;
    }

    const db = await database.connect();
    const collection = db.collection('user_activity_logs');
    const total = await collection.countDocuments(filters);
    const logs = await collection.find(filters).sort({ created_at: -1 }).skip(skip).limit(limit).toArray();

    return res.json({
      success: true,
      message: 'Logs chargés',
      logs: logs.map(serializeLog),
      total,
      page,
      limit
    });
  } catch (error) {
    console.error('Erreur route GET /api/activity-logs/user:', error);
    return res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

router.get('/admin', authenticateJWT, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN_GDRI' && req.user.role !== 'ADMIN_ENTITY') {
      return res.status(403).json({ success: false, message: 'Accès interdit' });
    }

    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 200));
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filters = {};
    if (req.query.event_type) filters.event_type = String(req.query.event_type);
    if (req.query.user_email) {
      const escaped = String(req.query.user_email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filters.user_email = new RegExp(escaped, 'i');
    }
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (from || to) {
      filters.created_at = {};
      if (from) filters.created_at.$gte = from;
      if (to) filters.created_at.$lte = to;
    }

    const db = await database.connect();
    const collection = db.collection('admin_activity_logs');
    const total = await collection.countDocuments(filters);
    const logs = await collection.find(filters).sort({ created_at: -1 }).skip(skip).limit(limit).toArray();

    return res.json({
      success: true,
      message: 'Logs chargés',
      logs: logs.map(serializeLog),
      total,
      page,
      limit
    });
  } catch (error) {
    console.error('Erreur route GET /api/activity-logs/admin:', error);
    return res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

module.exports = router;
