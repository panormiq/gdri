/**
 * FICHIER : modules/annuaire/backend/routes.js
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const { useAnnuaireEntrepriseDb } = require('./middleware/useAnnuaireEntrepriseDb');
const { requireAnnuaireRole } = require('./middleware/requireAnnuaireRole');
const organisationsController = require('./controllers/organisationsController');
const servicesController = require('./controllers/servicesController');
const contactsController = require('./controllers/contactsController');
const integrationsController = require('./controllers/integrationsController');
const membersController = require('./controllers/membersController');

const readRoles = ['USER_ENTITY', 'ADMIN_ENTITY'];
const writeRoles = ['USER_ENTITY', 'ADMIN_ENTITY'];
const auth = [authenticateJWT, useAnnuaireEntrepriseDb];

router.get('/health', (req, res) => {
  res.json({ success: true, module: 'annuaire', version: '0.1.0' });
});

router.get('/organisations', ...auth, requireAnnuaireRole(readRoles), organisationsController.list);
router.get('/organisations/own', ...auth, requireAnnuaireRole(readRoles), organisationsController.getCompany);
router.get('/organisations/:id', ...auth, requireAnnuaireRole(readRoles), organisationsController.getById);
router.post('/organisations', ...auth, requireAnnuaireRole(writeRoles), organisationsController.create);
router.put('/organisations/:id', ...auth, requireAnnuaireRole(writeRoles), organisationsController.update);
router.delete('/organisations/:id', ...auth, requireAnnuaireRole(writeRoles), organisationsController.remove);

router.get('/services', ...auth, requireAnnuaireRole(readRoles), servicesController.list);
router.post('/services', ...auth, requireAnnuaireRole(writeRoles), servicesController.create);
router.put('/services/:id', ...auth, requireAnnuaireRole(writeRoles), servicesController.update);
router.delete('/services/:id', ...auth, requireAnnuaireRole(writeRoles), servicesController.remove);

router.get('/members', ...auth, requireAnnuaireRole(readRoles), membersController.list);

router.get('/contacts', ...auth, requireAnnuaireRole(readRoles), contactsController.list);
router.get('/contacts/by-email', ...auth, requireAnnuaireRole(readRoles), contactsController.findByEmail);
router.get('/contacts/:id', ...auth, requireAnnuaireRole(readRoles), contactsController.getById);
router.post('/contacts', ...auth, requireAnnuaireRole(writeRoles), contactsController.create);
router.post('/contacts/from-email', ...auth, requireAnnuaireRole(writeRoles), contactsController.createFromEmail);
router.put('/contacts/:id', ...auth, requireAnnuaireRole(writeRoles), contactsController.update);
router.delete('/contacts/:id', ...auth, requireAnnuaireRole(writeRoles), contactsController.remove);

router.get('/integrations/gderpi/status', ...auth, requireAnnuaireRole(readRoles), integrationsController.gderpiStatus);
router.post('/integrations/gderpi/import', ...auth, requireAnnuaireRole(writeRoles), integrationsController.gderpiImport);
router.post('/integrations/gderpi/organisations/:organisationId/create-client', ...auth, requireAnnuaireRole(writeRoles), integrationsController.gderpiCreateClient);
router.post('/integrations/gderpi/organisations/:organisationId/create-fournisseur', ...auth, requireAnnuaireRole(writeRoles), integrationsController.gderpiCreateFournisseur);

router.get('/integrations/connectors/status', ...auth, requireAnnuaireRole(readRoles), integrationsController.connectorsStatus);

module.exports = router;
