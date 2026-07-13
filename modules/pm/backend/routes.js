/**
 * FICHIER : modules/pm/backend/routes.js
 * RÔLE : Routes API PM.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const { usePmEntrepriseDb } = require('./middleware/usePmEntrepriseDb');
const { requirePmRole } = require('./middleware/requirePmRole');
const boardsController = require('./controllers/boardsController');
const cardsController = require('./controllers/cardsController');
const inboxController = require('./controllers/inboxController');
const integrationsController = require('./controllers/integrationsController');
const settingsController = require('./controllers/settingsController');

const readRoles = ['USER_ENTITY', 'ADMIN_ENTITY'];
const writeRoles = ['USER_ENTITY', 'ADMIN_ENTITY'];

const auth = [authenticateJWT, usePmEntrepriseDb];

router.get('/health', (req, res) => {
  res.json({ success: true, module: 'pm', version: '0.1.0' });
});

router.get('/boards', ...auth, requirePmRole(readRoles), boardsController.list);
router.get('/boards/default', ...auth, requirePmRole(readRoles), boardsController.getDefault);

router.get('/cards', ...auth, requirePmRole(readRoles), cardsController.list);
router.get('/cards/:id', ...auth, requirePmRole(readRoles), cardsController.getById);
router.post('/cards', ...auth, requirePmRole(writeRoles), cardsController.create);
router.put('/cards/:id', ...auth, requirePmRole(writeRoles), cardsController.update);
router.patch('/cards/:id/move', ...auth, requirePmRole(writeRoles), cardsController.move);

router.post('/inbox/poll', ...auth, requirePmRole(writeRoles), inboxController.poll);
router.get('/inbox/mail-status', ...auth, requirePmRole(readRoles), inboxController.mailStatus);

router.get('/integrations/gderpi/status', ...auth, requirePmRole(readRoles), integrationsController.gderpiStatus);
router.get('/integrations/gderpi/devis', ...auth, requirePmRole(readRoles), integrationsController.listGderpiDevis);
router.get('/integrations/gderpi/boutiques', ...auth, requirePmRole(readRoles), integrationsController.gderpiBoutiques);
router.get('/integrations/annuaire/status', ...auth, requirePmRole(readRoles), integrationsController.annuaireStatus);
router.post('/cards/:id/gderpi/link-devis', ...auth, requirePmRole(writeRoles), integrationsController.linkDevis);
router.post('/cards/:id/gderpi/create-devis', ...auth, requirePmRole(writeRoles), integrationsController.createDevis);
router.post('/cards/:id/gderpi/sync-devis/:devisId', ...auth, requirePmRole(writeRoles), integrationsController.syncDevis);
router.post('/cards/:id/gderpi/sync-commande/:commandeId', ...auth, requirePmRole(writeRoles), integrationsController.syncCommande);

router.get('/settings', ...auth, requirePmRole(readRoles), settingsController.get);
router.put('/settings', ...auth, requirePmRole(writeRoles), settingsController.save);

module.exports = router;
