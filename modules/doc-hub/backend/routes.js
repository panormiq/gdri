/**
 * FICHIER : modules/doc-hub/backend/routes.js
 * RÔLE : Routes /api/doc-hub — projets, documents, tags, diffusions,
 *        téléchargement public par token (sans auth).
 */

const express = require('express');
const path = require('path');
const multer = require('multer');
const os = require('os');
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const { useDocHubEntrepriseDb } = require('./middleware/useDocHubEntrepriseDb');
const { requireDocHubRole } = require('./middleware/requireDocHubRole');
const projectController = require('./controllers/projectController');
const slotController = require('./controllers/slotController');
const documentController = require('./controllers/documentController');
const diffusionController = require('./controllers/diffusionController');
const tagController = require('./controllers/tagController');
const publicController = require('./controllers/publicController');
const config = require('./config.json');
const { getPublicApiBaseUrl } = require('./utils/publicUrl');

const router = express.Router();

const maxMb = config.maxUploadSizeMb || 25;
const maxFilesPerRequest = config.maxFilesPerRequest || 50;
const upload = multer({
  dest: path.join(os.tmpdir(), 'doc-hub-uploads'),
  limits: { fileSize: maxMb * 1024 * 1024, files: maxFilesPerRequest }
});

const readRoles = ['USER_ENTITY', 'ADMIN_ENTITY'];
const writeRoles = ['USER_ENTITY', 'ADMIN_ENTITY'];
const auth = [authenticateJWT, useDocHubEntrepriseDb];

router.get('/health', ...auth, (req, res) => {
  res.json({
    success: true,
    message: 'Module Doc-Hub opérationnel',
    version: '1.1.1',
    entrepriseId: req.entrepriseId,
    publicDownloadBase: getPublicApiBaseUrl(),
    linkFormat: 'query-t-base64url'
  });
});

router.get('/slot-templates', ...auth, requireDocHubRole(readRoles), slotController.list);

router.get('/tags', ...auth, requireDocHubRole(readRoles), tagController.list);
router.post('/tags', ...auth, requireDocHubRole(writeRoles), tagController.create);
router.put('/tags/:id', ...auth, requireDocHubRole(writeRoles), tagController.update);
router.delete('/tags/:id', ...auth, requireDocHubRole(writeRoles), tagController.remove);

router.get('/projects', ...auth, requireDocHubRole(readRoles), projectController.list);
router.post('/projects', ...auth, requireDocHubRole(writeRoles), projectController.create);
router.get('/projects/:id', ...auth, requireDocHubRole(readRoles), projectController.getById);
router.put('/projects/:id', ...auth, requireDocHubRole(writeRoles), projectController.update);
router.delete('/projects/:id', ...auth, requireDocHubRole(writeRoles), projectController.remove);

router.get('/projects/:id/documents', ...auth, requireDocHubRole(readRoles), documentController.list);
router.post(
  '/projects/:id/documents',
  ...auth,
  requireDocHubRole(writeRoles),
  upload.array('files', maxFilesPerRequest),
  documentController.upload
);

router.patch('/documents/:id/tags', ...auth, requireDocHubRole(writeRoles), documentController.updateTags);
router.delete('/documents/:id', ...auth, requireDocHubRole(writeRoles), documentController.remove);
router.post('/projects/:id/documents/bulk-delete', ...auth, requireDocHubRole(writeRoles), documentController.bulkRemove);

router.get('/projects/:id/diffusions', ...auth, requireDocHubRole(readRoles), diffusionController.list);
router.post('/projects/:id/diffusions', ...auth, requireDocHubRole(writeRoles), diffusionController.create);
router.post('/diffusions/:diffusionId/revoke', ...auth, requireDocHubRole(writeRoles), diffusionController.revoke);

// Téléchargement public par token signé — pas d'authentification
router.get('/public/download', publicController.download);
router.get('/public/download/:token', publicController.download);

module.exports = router;
