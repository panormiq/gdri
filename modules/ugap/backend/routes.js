/**
 * Routes API pour le module UGAP
 * Fichier : modules/ugap/backend/routes.js
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const { useUgapEntrepriseDb } = require('./middleware/useUgapEntrepriseDb');
const { requireUgapRole } = require('./middleware/requireUgapRole');
const ugapController = require('./controllers/ugapController');

// Defensive: ensure all referenced handlers are functions to avoid Express "argument handler must be a function"
Object.keys(ugapController || {}).forEach(key => {
  if (typeof ugapController[key] !== 'function') {
    console.warn(`UGAP controller handler "${key}" is not a function (type=${typeof ugapController[key]}). Replacing with error responder.`);
    ugapController[key] = (req, res) => {
      res.status(500).json({ success: false, message: `Handler "${key}" not implemented on server.` });
    };
  }
});
const pdfUploadDir = path.join(__dirname, 'uploads', 'pdf');
if (!fs.existsSync(pdfUploadDir)) {
  fs.mkdirSync(pdfUploadDir, { recursive: true });
}

const uploadPdf = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, pdfUploadDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const safeName = (file.originalname || 'document')
        .toLowerCase()
        .replace(/[^a-z0-9.]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
      cb(null, `${timestamp}_${safeName}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Multer pour PDF et Excel
const uploadPdfOrExcel = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, pdfUploadDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const safeName = (file.originalname || 'document')
        .toLowerCase()
        .replace(/[^a-z0-9.]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
      cb(null, `${timestamp}_${safeName}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB pour Excel
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname?.toLowerCase().endsWith('.pdf');
    const isExcel = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.mimetype === 'application/vnd.ms-excel' ||
                    file.originalname?.toLowerCase().endsWith('.xlsx') ||
                    file.originalname?.toLowerCase().endsWith('.xls');
    
    if (isPdf || isExcel) {
      cb(null, true);
    } else {
      cb(new Error('Le fichier doit être un PDF ou un Excel'));
    }
  }
});

/**
 * GET /api/ugap/health
 * Vérifie l'état du module
 */
router.get('/health', authenticateJWT, useUgapEntrepriseDb, (req, res) => {
  res.json({
    success: true,
    message: 'Module UGAP fonctionnel',
    version: '2.0.0'
  });
});

/**
 * GET /api/ugap/permissions
 * Retourne les zones d'accès UGAP pour l'utilisateur courant
 */
router.get('/permissions',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  (req, res) => {
    res.json({
      success: true,
      data: {
        zones: {
          use: Boolean(req.ugapPermissions?.use),
          configure: Boolean(req.ugapPermissions?.configure)
        }
      }
    });
  }
);

/**
 * GET /api/ugap/permission-zones
 * Décrit les zones fines de permission supportées par le module.
 */
router.get('/permission-zones', authenticateJWT, useUgapEntrepriseDb, (req, res) => {
  res.json({
    success: true,
    data: {
      zones: [
        { key: 'use', label: 'Utilisation', description: 'Accès au configurateur UGAP (usage métier)' },
        { key: 'configure', label: 'Configurateur', description: 'Accès au paramétrage UGAP (admin)' }
      ]
    }
  });
});

// ========================================
// ROUTES PUBLIQUES (lecture)
// ========================================

/**
 * GET /api/ugap/data
 * Récupère toutes les données configurées
 */
router.get('/data',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.getData
);

/**
 * GET /api/ugap/ui-state
 * Récupère l'état UI persistant (familles/vues métier)
 */
router.get('/ui-state',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.getUiState
);

/**
 * PUT /api/ugap/ui-state
 * Met à jour l'état UI persistant (familles/vues métier)
 */
router.put('/ui-state',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updateUiState
);

/**
 * PUT /api/ugap/liaisons/rules
 * Met à jour optionLinkRules et/ou dependencyRules.
 */
router.put('/liaisons/rules',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updateLiaisonRules
);

/**
 * POST /api/ugap/liaisons/suggest-heuristic
 * Propose des règles requires / variant_fit depuis les libellés.
 */
router.post('/liaisons/suggest-heuristic',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.suggestHeuristicLiaisonRules
);

/**
 * GET /api/ugap/models
 * Récupère la liste des modèles
 */
router.get('/models',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.getModels
);

/**
 * POST /api/ugap/models
 * Crée un modèle manuel dans le catalogue
 */
router.post('/models',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.createModel
);

/**
 * PUT /api/ugap/models/:modelId
 * Met à jour un modèle (ex. assignation template bateau)
 */
router.put('/models/:modelId',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updateModel
);

/**
 * GET /api/ugap/categories
 * Récupère les catégories avec leurs options
 */
router.get('/categories',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.getCategories
);

/**
 * GET /api/ugap/devis-settings
 * Infos entreprise + commerciaux pour les devis
 */
router.get('/devis-settings',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.getDevisSettings
);

router.put('/devis-settings',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updateDevisSettings
);

router.get('/devis-settings/entity-users',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.listDevisEntityUsers
);

router.post('/devis-settings/commerciaux',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.upsertDevisCommercial
);

router.put('/devis-settings/commerciaux/:commercialId',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.upsertDevisCommercial
);

router.delete('/devis-settings/commerciaux/:commercialId',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.deleteDevisCommercial
);

router.get('/devis-context',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.getDevisContext
);

router.get('/clients',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.listUgapClients
);

router.post('/clients',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.createUgapClient
);

router.put('/clients/:clientId',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.updateUgapClient
);

router.delete('/clients/:clientId',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.deleteUgapClient
);

/**
 * POST /api/ugap/devis
 * Génère un devis
 */
router.post('/devis',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.generateDevis
);

/**
 * POST /api/ugap/devis/render
 * Génère et télécharge le PDF devis (agent documentaire)
 */
router.post('/devis/render',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.renderDevis
);

/**
 * GET /api/ugap/devis/template-editor
 * Retourne l'ID document pour éditer le modèle devis UGAP
 */
router.get('/devis/template-editor',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.getDevisTemplateEditor
);

router.get('/devis/templates',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.listDevisTemplates
);

router.post('/devis/templates',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.createDevisTemplate
);

router.post('/devis/templates/:namespace/duplicate',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.duplicateDevisTemplate
);

router.patch('/devis/templates/:namespace/prefs',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.updateDevisTemplatePrefs
);

router.patch('/devis/templates/:namespace',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.renameDevisTemplate
);

router.put('/devis/templates/active',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.setActiveDevisTemplate
);

/**
 * GET /api/ugap/saved-devis
 * Liste les brouillons devis sauvegardés (configurateur)
 */
router.get('/saved-devis',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.listSavedDevis
);

/**
 * POST /api/ugap/saved-devis
 * Enregistre une nouvelle version de brouillon devis
 */
router.post('/saved-devis',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.createSavedDevis
);

/**
 * POST /api/ugap/configurator/five-percent-options
 * Crée une option catalogue 5% devis et la lie au groupe famille (configurateur).
 */
router.post('/configurator/five-percent-options',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.createConfiguratorFivePercentOption
);

/**
 * POST /api/ugap/saved-devis/migrate-local
 * Migration one-shot localStorage → Mongo
 */
router.post('/saved-devis/migrate-local',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  ugapController.migrateSavedDevisLocal
);

// ========================================
// ROUTES ADMIN (écriture)
// ========================================

/**
 * GET /api/ugap/import/detect-excel
 * Aperçu détection modèles / types de lignes (AVANT POST /import)
 */
router.get('/import/detect-excel',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.detectExcelPreview
);

/** Alias court */
router.get('/detect-excel',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.detectExcelPreview
);

/**
 * POST /api/ugap/import
 * Importe un fichier Excel
 */
router.post('/import',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.importExcel
);

router.get('/imports/staging',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.getImportStaging
);

router.get('/imports/staging/list',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.listImportStaging
);

router.patch('/imports/staging/:importId',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.renameImportStaging
);

router.post('/imports/staging/:importId/validate-models',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.validateImportModels
);

router.post('/imports/staging/:importId/validate-options',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.validateImportOptions
);

router.post('/imports/staging/:importId/apply-assignments',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.applyImportAssignments
);

router.post('/imports/staging/:importId/minorations',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updateImportMinorations
);

router.post('/imports/staging/:importId/majorations',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updateImportMajorations
);

router.post('/imports/staging/:importId/options-tri',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updateImportOptionsTri
);

router.post('/imports/staging/:importId/base-products',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updateImportBaseProducts
);

router.post('/imports/staging/:importId/publish',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.publishImport
);

/**
 * GET /api/ugap/import-audit
 * Compare les comptes Excel vs données importées (par modèle)
 */
router.get('/import-audit',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.getImportAudit
);

router.post('/import-audit/reintegrate',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.reintegrateImportAuditLine
);

/**
 * POST /api/ugap/familles/suggest-ia
 * Regroupe options + minorations en familles (IA — heuristique côté client avant appel).
 */
router.post('/familles/suggest-ia',
  express.json({ limit: '2mb' }),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.suggestFamiliesByAI
);

/**
 * POST /api/ugap/familles/assign-views-ia
 * Assigne les familles aux vues métier via IA (famille par famille).
 */
router.post('/familles/assign-views-ia',
  express.json({ limit: '2mb' }),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.assignFamiliesToBusinessViewsAI
);

/**
 * POST /api/ugap/base-options/complete-ia
 * Complète les options de base (produit initial/final) via IA
 */
router.post('/base-options/complete-ia',
  express.json({ limit: '1mb' }),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.completeBaseOptionsWithAI
);

/**
 * POST /api/ugap/base-options/complete-ia-line
 * Complète une seule ligne option de base via IA (progression front ligne par ligne)
 */
router.post('/base-options/complete-ia-line',
  express.json({ limit: '512kb' }),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.completeBaseOptionLineWithAI
);

// ========================================
// ROUTES CATÉGORIES (ORDRE IMPORTANT : routes spécifiques AVANT routes générales)
// ========================================

/**
 * POST /api/ugap/categories
 * Crée une nouvelle catégorie
 */
router.post('/categories',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.createCategory
);

/**
 * POST /api/ugap/categories/:categoryId/detect-subcategories
 * Détecte automatiquement les sous-catégories via IA
 * IMPORTANT: Cette route doit être AVANT /categories/:categoryId pour éviter les conflits
 */
router.post('/categories/:categoryId/detect-subcategories',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.detectSubCategories
);

/**
 * POST /api/ugap/categories/:categoryId/subcategories
 * Crée une sous-catégorie
 */
router.post('/categories/:categoryId/subcategories',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.createSubCategory
);

/**
 * PUT /api/ugap/categories/:categoryId/subcategories/:subCategoryId
 * Met à jour une sous-catégorie
 */
router.put('/categories/:categoryId/subcategories/:subCategoryId',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updateSubCategory
);

/**
 * DELETE /api/ugap/categories/:categoryId/subcategories/:subCategoryId
 * Supprime une sous-catégorie
 */
router.delete('/categories/:categoryId/subcategories/:subCategoryId',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.deleteSubCategory
);

/**
 * POST /api/ugap/categories/:fromCategoryId/options/:optionId/move
 * Déplace une option vers une autre catégorie/sous-catégorie
 */
router.post('/categories/:fromCategoryId/options/:optionId/move',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.moveOptionToCategory
);

/**
 * PUT /api/ugap/categories/reorder
 * Met à jour l'ordre des catégories
 * IMPORTANT: Cette route spécifique doit être AVANT /categories/:categoryId
 */
router.put('/categories/reorder',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.reorderCategories
);

/**
 * POST /api/ugap/categories/clear
 * Réinitialise toutes les catégories (regroupe toutes les options dans "Non classées")
 * IMPORTANT: Cette route spécifique doit être AVANT /categories/:categoryId
 */
router.post('/categories/clear',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.clearAllCategories
);

router.post('/data/purge',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.purgePublishedData
);

router.post('/data/reset-from-extract',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.resetCatalogFromExtract
);

router.post('/imports/staging/:importId/reopen',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.reopenImportStaging
);

/**
 * PUT /api/ugap/categories/:categoryId
 * Met à jour une catégorie
 * IMPORTANT: Cette route générale doit être APRÈS les routes spécifiques
 */
router.put('/categories/:categoryId',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updateCategory
);

/**
 * DELETE /api/ugap/categories/:categoryId
 * Supprime une catégorie
 */
router.delete('/categories/:categoryId',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.deleteCategory
);

/**
 * POST /api/ugap/options
 * Crée une nouvelle option
 */
router.post('/options',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.createOption
);

/**
 * DELETE /api/ugap/options/:optionId
 * Supprime une option
 */
router.delete('/options/:optionId',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.deleteOption
);

/**
 * POST /api/ugap/options/delete-bulk
 * Supprime plusieurs options catalogue
 */
router.post('/options/delete-bulk',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.deleteOptionsBulk
);

/**
 * POST /api/ugap/options/merge-base
 * Fusionne deux options de base (conserve les alias pour le ré-import).
 */
router.post('/options/merge-base',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.mergeBaseCatalogOptions
);

/**
 * POST /api/ugap/options/assign-families-bulk
 * Assigne des familles a un lot d'options
 */
router.post('/options/assign-families-bulk',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.assignOptionsFamiliesBulk
);

/**
 * POST /api/ugap/options/assign-catalog-bulk
 * Lie plusieurs options à des nœuds catalogue en une seule écriture
 */
router.post('/options/assign-catalog-bulk',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.assignOptionsCatalogBulk
);

/**
 * POST /api/ugap/options/reset-family-assignments
 * Réinitialise les assignations famille/groupe (catalogue + ui-state), sans supprimer les options.
 */
router.post('/options/reset-family-assignments',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.resetOptionsFamilyAssignments
);

/**
 * POST /api/ugap/base-products/:catalogOptionId/adj-links
 * Lie la ligne mino/majo source (déduction Excel) à une option de base publiée (opt_ibp_*).
 */
router.post('/base-products/:catalogOptionId/adj-links',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updateBaseProductAdjLinks
);

/**
 * PUT /api/ugap/options/:optionId
 * Met à jour une option
 */
router.put('/options/:optionId',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updateOption
);

/**
 * POST /api/ugap/improve-categorization
 * Améliore la catégorisation des options via IA
 */
router.post('/improve-categorization',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.improveCategorization
);

// ========================================
// ROUTES PROMPTS IA
// ========================================

/**
 * GET /api/ugap/prompts
 * Récupère les prompts IA configurés
 */
router.get('/prompts',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.getPrompts
);

/**
 * PUT /api/ugap/prompts
 * Met à jour les prompts IA
 */
router.put('/prompts',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updatePrompts
);

/**
 * POST /api/ugap/prompts/reset
 * Réinitialise les prompts aux valeurs par défaut
 */
router.post('/prompts/reset',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.resetPrompts
);

/**
 * GET /api/ugap/ia-context
 * Serveur / provider / modèle effectifs pour les appels IA UGAP (+ référence LLM entité)
 */
router.get('/ia-context',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.getIaContext
);

// ========================================
// ROUTES CONFIGURATIONS ET ENRICHISSEMENT
// ========================================

/**
 * POST /api/ugap/models/:modelId/configurations
 * Ajoute une configuration à un modèle
 */
router.post('/models/:modelId/configurations',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.addModelConfiguration
);

/**
 * PUT /api/ugap/models/:modelId/configurations/:configId
 * Met à jour une configuration
 */
router.put('/models/:modelId/configurations/:configId',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updateModelConfiguration
);

/**
 * DELETE /api/ugap/models/:modelId/configurations/:configId
 * Supprime une configuration
 */
router.delete('/models/:modelId/configurations/:configId',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.deleteModelConfiguration
);

/**
 * POST /api/ugap/models/:modelId/configurations/:configId/import-file
 * Importe un fichier (PDF ou Excel) dans une configuration
 * IMPORTANT: Cette route doit être AVANT /import-pdf pour éviter les conflits
 */
router.post('/models/:modelId/configurations/:configId/import-file',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  uploadPdfOrExcel.single('file'),
  ugapController.importConfigurationFile
);

/**
 * POST /api/ugap/models/:modelId/configurations/:configId/import-pdf
 * Importe un PDF pour extraire les lignes et matcher les options
 */
router.post('/models/:modelId/configurations/:configId/import-pdf',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  uploadPdf.single('file'),
  ugapController.importConfigurationPdf
);

/**
 * GET /api/ugap/models/:modelId/configurations/:configId/pdf
 * Récupère le PDF d'origine importé
 */
router.get('/models/:modelId/configurations/:configId/pdf',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.getConfigurationPdf
);

/**
 * POST /api/ugap/models/:modelId/configurations/:configId/upload-pdf
 * Upload un PDF et le sauvegarde sans lancer d'analyse
 */
router.post('/models/:modelId/configurations/:configId/upload-pdf',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  uploadPdf.single('file'),
  ugapController.uploadConfigurationPdf
);

/**
 * POST /api/ugap/models/:modelId/configurations/:configId/extract-text
 * Extrait le texte du PDF précédemment uploadé et sauvegarde extractedLines
 */
router.post('/models/:modelId/configurations/:configId/extract-text',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.extractConfigurationText
);

/**
 * POST /api/ugap/models/:modelId/configurations/:configId/analyze-image
 * Rend la première page en image et appelle l'IA vision pour structuration
 */
router.post('/models/:modelId/configurations/:configId/analyze-image',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.analyzeConfigurationImage
);

/**
 * POST /api/ugap/models/:modelId/configurations/:configId/convert-pdf-to-excel
 * Convertit le PDF associé en fichier Excel (XLSX)
 */
router.post('/models/:modelId/configurations/:configId/convert-pdf-to-excel',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.convertConfigurationPdfToExcel
);

/**
 * GET /api/ugap/models/:modelId/configurations/:configId/excel
 * Récupère le fichier Excel généré
 */
router.get('/models/:modelId/configurations/:configId/excel',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.getConfigurationExcel
);

/**
 * GET /api/ugap/models/:modelId/configurations/:configId/detect-colors
 * Détecte toutes les couleurs de fond dans le fichier Excel
 */
router.get('/models/:modelId/configurations/:configId/detect-colors',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.detectExcelColors
);

/**
 * GET /api/ugap/models/:modelId/configurations/:configId/test-extraction
 * Teste différentes méthodes d'extraction Excel pour comparer les résultats
 */
router.get('/models/:modelId/configurations/:configId/test-extraction',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.testExcelExtraction
);

/**
 * GET /api/ugap/test-extraction-page
 * Affiche la page de test d'extraction
 */
router.get('/test-extraction-page',
  authenticateJWT,
  (req, res) => {
    const testPagePath = path.join(__dirname, '../frontend/test-extraction.html');
    res.sendFile(testPagePath);
  }
);

/**
 * POST /api/ugap/models/:modelId/configurations/:configId/map-excel
 * Mappe le XLSX généré en JSON/YAML selon couleurs/colonnes et sauvegarde le mapping
 */
router.post('/models/:modelId/configurations/:configId/map-excel',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.mapConfigurationExcel
);

/**
 * POST /api/ugap/models/:modelId/configurations/:configId/clear-mapped-categories
 * Réinitialise les catégories détectées (mapping) pour une configuration (vue "Voir résultats")
 */
router.post('/models/:modelId/configurations/:configId/clear-mapped-categories',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.clearConfigurationMappedCategories
);

/**
 * GET /api/ugap/models/:modelId/configurations/:configId/download-camelot-excel
 * Télécharge le fichier Excel généré par Camelot
 */
router.get('/models/:modelId/configurations/:configId/download-camelot-excel',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.downloadCamelotExcel
);

/**
 * PUT /api/ugap/models/:modelId/image
 * Met à jour l'image d'un modèle
 */
router.put('/models/:modelId/image',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updateModelImage
);

/**
 * PUT /api/ugap/options/:optionId/doc-template
 * Met à jour le lien doc-template d'une option
 */
router.put('/options/:optionId/doc-template',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.updateOptionDocTemplate
);

/**
 * GET /api/ugap/categories/:categoryId/subcategories/:subCategoryId/search-collections
 * Recherche des collections existantes similaires
 */
router.get('/categories/:categoryId/subcategories/:subCategoryId/search-collections',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.searchSimilarCollections
);

/**
 * POST /api/ugap/categories/:categoryId/subcategories/:subCategoryId/generate-collection
 * Génère une structure de collection via IA avec recherche web optionnelle
 */
router.post('/categories/:categoryId/subcategories/:subCategoryId/generate-collection',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.generateCollectionWithAI
);

/**
 * POST /api/ugap/ai/verify-option
 * Vérifie si une option appartient à la bonne sous-catégorie
 */
router.post('/ai/verify-option',
  express.json(),
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.verifyOptionWithAI
);

/**
 * POST /api/ugap/convert-pdf-to-excel
 * Convertit un PDF en Excel (outil standalone)
 */
router.post('/convert-pdf-to-excel',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  uploadPdf.single('file'),
  ugapController.convertPdfToExcel
);

/**
 * GET /api/ugap/download-excel/:fileName
 * Télécharge un fichier Excel converti
 */
router.get('/download-excel/:fileName',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.downloadExcel
);

/**
 * GET /api/ugap/view-excel/:fileName
 * Affiche un fichier Excel en HTML dans le navigateur
 */
router.get('/view-excel/:fileName',
  authenticateJWT,
  useUgapEntrepriseDb,
  requireUgapRole(['ADMIN_ENTITY']),
  ugapController.viewExcelAsHtml
);

module.exports = router;
