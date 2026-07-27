/**
 * FICHIER : modules/chat/backend/routes.js
 * RÔLE : Routes /api/chat — middlewares + controllers (logique métier dans services/).
 */

const express = require('express');
const path = require('path');
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const { requireChatRole } = require('./middleware/requireChatRole');
const { ensureIaModuleLoaded } = require('./middleware/ensureIaModuleLoaded');
const healthController = require('./controllers/healthController');
const settingsController = require('./controllers/settingsController');
const conversationsController = require('./controllers/conversationsController');

const router = express.Router();

const userRoles = ['USER_ENTITY', 'ADMIN_ENTITY'];
const entityAdminRoles = ['ADMIN_ENTITY'];
const adminGdriRoles = []; // requireChatRole always adds ADMIN_GDRI

const authUser = [authenticateJWT, ensureIaModuleLoaded, requireChatRole(userRoles)];
const authEntityAdmin = [authenticateJWT, ensureIaModuleLoaded, requireChatRole(entityAdminRoles)];
const authAdminGdri = [authenticateJWT, ensureIaModuleLoaded, requireChatRole(adminGdriRoles)];

router.get('/health', ...authUser, healthController.health);
router.get('/bootstrap', ...authUser, healthController.bootstrap);

router.get('/settings/global', ...authAdminGdri, settingsController.getGlobal);
router.put('/settings/global', ...authAdminGdri, settingsController.putGlobal);

router.get('/settings/entity', ...authEntityAdmin, settingsController.getEntity);
router.put('/settings/entity', ...authEntityAdmin, settingsController.putEntity);

router.get('/settings/user', ...authUser, settingsController.getUser);
router.put('/settings/user', ...authUser, settingsController.putUser);

router.get('/settings/entity-user-access', ...authEntityAdmin, settingsController.getEntityUserAccess);
router.put('/settings/entity-user-access/:userId', ...authEntityAdmin, settingsController.putEntityUserAccess);

router.post('/conversations', ...authUser, conversationsController.create);
router.get('/conversations/:id', ...authUser, conversationsController.getById);
router.post('/conversations/:id/messages', ...authUser, conversationsController.sendMessage);
router.post('/conversations/:id/messages/stream', ...authUser, conversationsController.sendMessageStream);

router.post('/message', ...authUser, conversationsController.legacyMessage);

module.exports = router;
