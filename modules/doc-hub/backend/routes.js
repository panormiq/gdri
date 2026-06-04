/**
 * Routes API Doc-Hub
 */

const express = require('express');
const path = require('path');
const multer = require('multer');
const os = require('os');
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const { useDocHubEntrepriseDb } = require('./middleware/useDocHubEntrepriseDb');
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

router.get('/slot-templates', ...auth, slotController.list);

router.get('/tags', ...auth, tagController.list);
router.post('/tags', ...auth, tagController.create);
router.put('/tags/:id', ...auth, tagController.update);
router.delete('/tags/:id', ...auth, tagController.remove);

router.get('/projects', ...auth, projectController.list);
router.post('/projects', ...auth, projectController.create);
router.get('/projects/:id', ...auth, projectController.getById);
router.put('/projects/:id', ...auth, projectController.update);
router.delete('/projects/:id', ...auth, projectController.remove);

router.get('/projects/:id/documents', ...auth, documentController.list);
router.post(
  '/projects/:id/documents',
  ...auth,
  upload.array('files', maxFilesPerRequest),
  documentController.upload
);

router.patch('/documents/:id/tags', ...auth, documentController.updateTags);
router.delete('/documents/:id', ...auth, documentController.remove);
router.post('/projects/:id/documents/bulk-delete', ...auth, documentController.bulkRemove);

router.get('/projects/:id/diffusions', ...auth, diffusionController.list);
router.post('/projects/:id/diffusions', ...auth, diffusionController.create);
router.post('/diffusions/:diffusionId/revoke', ...auth, diffusionController.revoke);

router.get('/public/download', publicController.download);
router.get('/public/download/:token', publicController.download);

module.exports = router;
