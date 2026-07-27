/**
 * FICHIER : modules/chat/backend/controllers/settingsController.js
 * RÔLE : CRUD settings global / entité / user / accès utilisateurs.
 */

const path = require('path');
const database = require(path.join(__dirname, '../../../../backend/config/database'));
const getEntityId = require('../services/access/getEntityId');
const getUserId = require('../services/access/getUserId');
const getGlobalSettings = require('../services/settings/getGlobalSettings');
const updateGlobalSettings = require('../services/settings/updateGlobalSettings');
const getEntitySettings = require('../services/settings/getEntitySettings');
const updateEntitySettings = require('../services/settings/updateEntitySettings');
const getUserSettings = require('../services/settings/getUserSettings');
const updateUserSettings = require('../services/settings/updateUserSettings');
const listEntityUserAccess = require('../services/settings/listEntityUserAccess');
const updateEntityUserAccess = require('../services/settings/updateEntityUserAccess');

async function getGlobal(req, res) {
  try {
    const doc = await getGlobalSettings(database);
    return res.json({ success: true, data: doc || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function putGlobal(req, res) {
  try {
    const defaultServerId = req.body && req.body.default_server_id
      ? String(req.body.default_server_id).trim()
      : '';
    const defaultModel = req.body && req.body.default_model
      ? String(req.body.default_model).trim()
      : '';
    if (!defaultServerId) {
      return res.status(400).json({ success: false, message: 'default_server_id requis.' });
    }
    await updateGlobalSettings(database, {
      defaultServerId,
      defaultModel,
      updatedBy: req.user.user_id
    });
    return res.json({ success: true, message: 'Configuration globale chat mise à jour.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getEntity(req, res) {
  try {
    const entityId = getEntityId(req);
    if (!entityId) {
      return res.status(400).json({ success: false, message: 'entity_id introuvable.' });
    }
    const doc = await getEntitySettings(database, entityId);
    return res.json({ success: true, data: doc });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function putEntity(req, res) {
  try {
    const entityId = getEntityId(req);
    if (!entityId) {
      return res.status(400).json({ success: false, message: 'entity_id introuvable.' });
    }
    await updateEntitySettings(database, entityId, req.body || {}, req.user.user_id);
    return res.json({ success: true, message: 'Configuration entité chat mise à jour.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getUser(req, res) {
  try {
    const entityId = getEntityId(req);
    const userId = getUserId(req);
    if (!entityId || !userId) {
      return res.status(400).json({ success: false, message: 'Contexte utilisateur invalide.' });
    }
    const doc = await getUserSettings(database, entityId, userId);
    return res.json({ success: true, data: doc });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function putUser(req, res) {
  try {
    const entityId = getEntityId(req);
    const userId = getUserId(req);
    if (!entityId || !userId) {
      return res.status(400).json({ success: false, message: 'Contexte utilisateur invalide.' });
    }
    await updateUserSettings(database, entityId, userId, req.body || {});
    return res.json({ success: true, message: 'Configuration utilisateur chat mise à jour.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getEntityUserAccess(req, res) {
  try {
    const entityId = getEntityId(req);
    if (!entityId) {
      return res.status(400).json({ success: false, message: 'entity_id introuvable.' });
    }
    const result = await listEntityUserAccess(database, entityId);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }
    return res.json({ success: true, data: result.data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function putEntityUserAccess(req, res) {
  try {
    const entityId = getEntityId(req);
    const targetUserId = String(req.params.userId || '').trim();
    if (!entityId || !targetUserId) {
      return res.status(400).json({ success: false, message: 'Paramètres invalides.' });
    }
    const enabled = req.body && req.body.enabled === false ? false : true;
    await updateEntityUserAccess(database, entityId, targetUserId, enabled);
    return res.json({ success: true, message: 'Accès utilisateur mis à jour.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getGlobal,
  putGlobal,
  getEntity,
  putEntity,
  getUser,
  putUser,
  getEntityUserAccess,
  putEntityUserAccess
};
