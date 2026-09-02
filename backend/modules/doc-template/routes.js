/**
 * Routes API pour le module Doc-Template
 * Fichier : backend/modules/doc-template/routes.js
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticateJWT } = require('../../config/jwt');

// Middlewares
const { useCurrentEntrepriseDb } = require('./middleware/entreprise/db/useCurrentEntrepriseDb');
const { checkEntrepriseAccess } = require('./middleware/entreprise/access/checkEntrepriseAccess');

// Configuration multer pour upload d'images
const os = require('os');
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      // Utiliser le dossier temporaire du système (compatible Windows/Linux)
      const tmpDir = os.tmpdir();
      cb(null, tmpDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: function (req, file, cb) {
    // Accepter uniquement les images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers image sont autorisés'), false);
    }
  }
});

// Controllers
const collectionController = require('./controllers/collectionController');
const templateController = require('./controllers/template_controller');
const templateImageController = require('./controllers/templateImageController');
const documentController = require('./controllers/documentController');
const storageController = require('./controllers/storageController');
const documentGenerationController = require('./controllers/documentGenerationController');

/**
 * GET /api/doc-template/health
 * Vérifie l'état du module
 */
router.get('/health', authenticateJWT, (req, res) => {
  res.json({
    success: true,
    message: 'Module Doc-Template fonctionnel',
    version: '3.0.0'
  });
});

// ========================================
// ROUTES COLLECTIONS
// ========================================

// Route pour obtenir les core fields (schéma de base pour les collections)
router.get('/collections/core', authenticateJWT, (req, res) => {
  res.json({
    success: true,
    data: {
      core: {
        name: {
          type: 'text',
          label: 'Nom de la collection',
          required: true,
          placeholder: 'Ex: Clients, Produits, etc.'
        },
        description: {
          type: 'textarea',
          label: 'Description',
          required: false,
          placeholder: 'Description de la collection'
        },
        tags: {
          type: 'text',
          label: 'Tags (séparés par des virgules)',
          required: false,
          placeholder: 'tag1, tag2, tag3'
        }
      }
    }
  });
});

// Route pour obtenir les types de champs disponibles
router.get('/collections/fieldTypes', authenticateJWT, collectionController.getFieldTypes);

router.get('/collections', authenticateJWT, useCurrentEntrepriseDb, collectionController.getAll);
router.post('/collections/migrate-from-v1', authenticateJWT, useCurrentEntrepriseDb, collectionController.migrateFromV1);
router.get('/collections/:id', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, collectionController.getById);
router.post('/collections', authenticateJWT, useCurrentEntrepriseDb, collectionController.create);
router.put('/collections/:id', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, collectionController.update);
router.delete('/collections/:id', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, collectionController.delete);

// Routes éléments
router.get('/collections/:id/elements', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, collectionController.getElements);
router.post('/collections/:id/elements', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, collectionController.addElement);
router.put('/collections/:id/elements/:elementId', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, collectionController.updateElement);
router.delete('/collections/:id/elements/:elementId', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, collectionController.deleteElement);

// Routes images
router.post('/collections/:id/images', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, collectionController.uploadImage);
router.get('/collections/:id/images/:imageId', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, collectionController.getImage);

// ========================================
// ROUTES TEMPLATES
// ========================================

router.get('/templates', authenticateJWT, useCurrentEntrepriseDb, templateController.getAll);
router.get('/templates/:id', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, templateController.getById);
router.post('/templates', authenticateJWT, useCurrentEntrepriseDb, templateController.create);
router.put('/templates/:id', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, templateController.update);
router.delete('/templates/:id', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, templateController.delete);

// Routes images de template
router.post('/templates/:id/images', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, upload.single('image'), templateImageController.uploadTemplateImage);
router.get('/templates/:id/images/:imageId', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, templateImageController.getTemplateImage);
router.delete('/templates/:id/images/:imageId', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, templateImageController.deleteTemplateImage);

// ========================================
// ROUTES DOCUMENTS
// ========================================

// Route export PDF depuis HTML fourni
router.post('/documents/pdf-from-html', authenticateJWT, useCurrentEntrepriseDb, documentController.exportHtmlToPdf);

router.get('/documents', authenticateJWT, useCurrentEntrepriseDb, documentController.getAll);
router.get('/documents/:id', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, documentController.getById);
router.post('/documents', authenticateJWT, useCurrentEntrepriseDb, documentController.create);
router.put('/documents/:id', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, documentController.update);
router.delete('/documents/:id', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, documentController.delete);

// Route export PDF
router.get('/documents/:id/pdf', authenticateJWT, useCurrentEntrepriseDb, checkEntrepriseAccess, documentController.exportDocumentToPdf);

// Route génération document
router.post('/documents/generate', authenticateJWT, useCurrentEntrepriseDb, documentGenerationController.generateDocumentOnTheFly);

// ========================================
// ROUTES STORAGE
// ========================================

router.post('/storage/upload', authenticateJWT, useCurrentEntrepriseDb, storageController.upload);
router.get('/storage/files', authenticateJWT, useCurrentEntrepriseDb, storageController.listFiles);
router.get('/storage/files/:filename', authenticateJWT, useCurrentEntrepriseDb, storageController.getFile);
router.delete('/storage/files/:filename', authenticateJWT, useCurrentEntrepriseDb, storageController.deleteFile);

module.exports = router;
