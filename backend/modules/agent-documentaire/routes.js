/**
 * Routes API - Agent Documentaire
 * Fichier : backend/modules/agent-documentaire/routes.js
 * 
 * Routes disponibles :
 * - POST /upload - Upload d'un fichier Word
 * - POST /extract/:documentId - Extraire Word → JSON
 * - GET /document/:documentId - Récupérer le JSON
 * - PUT /document/:documentId - Mettre à jour le JSON
 * - PUT /document/:documentId/sections - Réorganiser sections (drag & drop)
 * - GET /document/:documentId/html - Générer HTML depuis JSON
 * - POST /document/:documentId/image - Upload d'une image
 * - GET /document/:documentId/image/:imageId - Récupérer une image
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { getDocumentService, getTemplateService, getModelService } = require('./service-container');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

/**
 * POST /upload
 * Upload d'un fichier Word
 */
router.post('/upload', async (req, res) => {
  try {
    const documentService = getDocumentService();
    const result = await documentService.uploadWordDocument(req);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erreur upload document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /extract/:documentId
 * Extraire Word → JSON
 */
router.post('/extract/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { filename } = req.body; // Optionnel : nom de fichier à utiliser
    const documentService = getDocumentService();
    const result = await documentService.extractWordToJson(documentId, filename);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erreur extraction document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /document/:documentId
 * Récupérer le JSON du document
 */
router.get('/document/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const documentService = getDocumentService();
    const document = await documentService.getDocument(documentId);
    res.json({ success: true, data: document });
  } catch (error) {
    console.error('Erreur récupération document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /document/:documentId
 * Mettre à jour le JSON du document
 */
router.put('/document/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { json_content } = req.body;
    const documentService = getDocumentService();
    const result = await documentService.updateDocument(documentId, json_content);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erreur mise à jour document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /document/:documentId/sections
 * Réorganiser sections (drag & drop)
 */
router.put('/document/:documentId/sections', async (req, res) => {
  try {
    const { documentId } = req.params;
    const payload = req.body || {};
    const documentService = getDocumentService();
    const result = await documentService.reorganizeSections(documentId, payload);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erreur réorganisation sections:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /document/:documentId/html
 * Générer HTML depuis JSON
 */
router.get('/document/:documentId/html', async (req, res) => {
  try {
    const { documentId } = req.params;
    const documentService = getDocumentService();
    const html = await documentService.generateHtmlFromJson(documentId);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Erreur génération HTML:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /document/:documentId/image/:imageId
 * Récupérer une image
 */
router.get('/document/:documentId/image/:imageId', async (req, res) => {
  try {
    const { documentId, imageId } = req.params;
    const documentService = getDocumentService();
    const imagePath = await documentService.getImagePath(documentId, imageId);
    res.sendFile(imagePath);
  } catch (error) {
    console.error('Erreur récupération image:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /document/:documentId/image/temp
 * Upload d'une image temporaire (drag & drop frontend)
 */
router.post('/document/:documentId/image/temp', upload.single('image'), async (req, res) => {
  try {
    const { documentId } = req.params;
    const { sessionId } = req.body || {};
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Aucune image reçue.' });
    }
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session d\'upload manquante.' });
    }

    const documentService = getDocumentService();
    const data = await documentService.saveTempImage(documentId, sessionId, req.file);

    res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur upload image:', error);
    const status = /format|Aucun fichier/i.test(error.message || '') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

/**
 * GET /document/:documentId/temp-image/:sessionId/:imageId
 * Récupère une image temporaire pour prévisualisation
 */
router.get('/document/:documentId/temp-image/:sessionId/:imageId', async (req, res) => {
  try {
    const { sessionId, imageId } = req.params;
    const documentService = getDocumentService();
    const imagePath = await documentService.getTempImagePath(sessionId, imageId);
    res.sendFile(imagePath);
  } catch (error) {
    console.error('Erreur récupération image temporaire:', error);
    res.status(404).json({ success: false, error: error.message });
  }
});

/**
 * POST /document/:documentId/images/promote
 * Promeut les images temporaires après sauvegarde
 */
router.post('/document/:documentId/images/promote', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { sessionId, images } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session d\'upload manquante.' });
    }

    const documentService = getDocumentService();
    const result = await documentService.promoteTempImages(documentId, sessionId, images);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erreur promotion images:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /document/:documentId/canvas
 * Récupérer le canevas d'un document
 */
router.get('/document/:documentId/canvas', async (req, res) => {
  try {
    const { documentId } = req.params;
    const documentService = getDocumentService();
    const canvas = await documentService.getCanvas(documentId);
    res.json({ success: true, data: canvas });
  } catch (error) {
    console.error('Erreur récupération canevas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /document/:documentId/canvas/initialize
 * Initialiser le canevas (automatique ou avec preset)
 * Query param: ?preset=standard|compact|large (optionnel)
 */
router.post('/document/:documentId/canvas/initialize', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { preset } = req.query;
    const documentService = getDocumentService();
    const document = await documentService.initializeCanvas(documentId, preset);
    res.json({ success: true, data: document.json_content.canvas });
  } catch (error) {
    console.error('Erreur initialisation canevas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /document/:documentId/canvas
 * Mettre à jour le canevas
 */
router.put('/document/:documentId/canvas', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { canvas } = req.body;
    const documentService = getDocumentService();
    const document = await documentService.updateCanvas(documentId, canvas);
    res.json({ success: true, data: document.json_content.canvas });
  } catch (error) {
    console.error('Erreur mise à jour canevas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /document/:documentId/pdf-from-html
 * Générer un PDF depuis le HTML fourni par le frontend (pixel perfect)
 * Le HTML contient déjà tous les styles inline et les images en base64
 */
router.post('/document/:documentId/pdf-from-html', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({ success: false, error: 'HTML requis' });
    }
    
    const documentService = getDocumentService();
    const pdfBuffer = await documentService.generatePdfFromHtmlString(html, documentId);
    
    // Récupérer le titre du document pour le nom du fichier
    const document = await documentService.getDocument(documentId);
    const filename = `${document.title || 'document'}.pdf`.replace(/[^a-z0-9.-]/gi, '_');
    
    // Envoyer le PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Erreur génération PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /document/:documentId/pdf
 * Générer et télécharger un PDF depuis le HTML (pixel perfect)
 * 
 * Query params optionnels :
 * - format: Format de page (A4, Letter, etc.) - défaut: A4
 * - scale: Échelle de rendu (0.1 à 2.0) - défaut: 1.0
 * - margin: Marges personnalisées (JSON string) - défaut: marges du document Word
 */
router.get('/document/:documentId/pdf', async (req, res) => {
  try {
    const { documentId } = req.params;
    const documentService = getDocumentService();
    
    // Options PDF depuis les query params (optionnel)
    const options = {
      format: req.query.format || 'A4',
      scale: req.query.scale ? parseFloat(req.query.scale) : 1.0,
      margin: req.query.margin ? JSON.parse(req.query.margin) : undefined
    };
    
    // Validation de l'échelle
    if (options.scale < 0.1 || options.scale > 2.0) {
      options.scale = 1.0;
    }
    
    const pdfBuffer = await documentService.generatePdfFromHtml(documentId, options);
    
    // Récupérer le titre du document pour le nom du fichier
    const document = await documentService.getDocument(documentId);
    const filename = `${document.title || 'document'}.pdf`.replace(/[^a-z0-9.-]/gi, '_');
    
    // Envoyer le PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Erreur génération PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /document/:documentId/sections/:sectionId/migrate
 * Migre les sections pour ajouter les champs structure/actif/parent
 */
router.post('/document/:documentId/sections/migrate', async (req, res) => {
  try {
    const { documentId } = req.params;
    const documentService = getDocumentService();
    const document = await documentService.migrateSectionsToStructure(documentId);
    res.json({ success: true, data: document });
  } catch (error) {
    console.error('Erreur migration sections:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /document/:documentId/sections/:sectionId/structure
 * Change le type structure/optionnel d'une section
 * Body: { structure: 'structural'|'optional', parentId?: string, category?: string }
 */
router.put('/document/:documentId/sections/:sectionId/structure', async (req, res) => {
  try {
    const { documentId, sectionId } = req.params;
    const { structure, parentId, category } = req.body;
    
    if (!structure) {
      return res.status(400).json({ success: false, error: 'structure est requis' });
    }
    
    const documentService = getDocumentService();
    const document = await documentService.changeSectionStructure(
      documentId,
      sectionId,
      structure,
      parentId || null,
      category || null
    );
    res.json({ success: true, data: document });
  } catch (error) {
    console.error('Erreur changement structure section:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /document/:documentId/sections/:sectionId/active
 * Active ou désactive une section optionnelle
 * Body: { active: true|false }
 */
router.put('/document/:documentId/sections/:sectionId/active', async (req, res) => {
  try {
    const { documentId, sectionId } = req.params;
    const { active } = req.body;
    
    if (typeof active !== 'boolean') {
      return res.status(400).json({ success: false, error: 'active doit être un boolean' });
    }
    
    const documentService = getDocumentService();
    const document = await documentService.toggleSectionActive(documentId, sectionId, active);
    res.json({ success: true, data: document });
  } catch (error) {
    console.error('Erreur activation/désactivation section:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /document/:documentId/sections/:sectionId/category
 * Met à jour la catégorie d'une section optionnelle
 * Body: { category: string|Array<string> }
 */
router.put('/document/:documentId/sections/:sectionId/category', async (req, res) => {
  try {
    const { documentId, sectionId } = req.params;
    const { category } = req.body;
    
    if (!category) {
      return res.status(400).json({ success: false, error: 'category est requis' });
    }
    
    const documentService = getDocumentService();
    const document = await documentService.updateSectionCategory(documentId, sectionId, category);
    res.json({ success: true, data: document });
  } catch (error) {
    console.error('Erreur mise à jour catégorie section:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /document/:documentId/sections/recover-optional
 * Récupère les sections optionnelles perdues
 */
router.post('/document/:documentId/sections/recover-optional', async (req, res) => {
  try {
    const { documentId } = req.params;
    const documentService = getDocumentService();
    const result = await documentService.recoverLostOptionalSections(documentId);
    res.json({ 
      success: true, 
      data: result.document,
      recoveredCount: result.recoveredCount,
      totalOptional: result.totalOptional
    });
  } catch (error) {
    console.error('Erreur récupération sections optionnelles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ===================================
 * ROUTES TEMPLATES
 * ===================================
 */

/**
 * GET /templates
 * Récupère tous les templates (avec filtres optionnels)
 * Query params: ?scope=nom_template (filtrer par scope)
 */
router.get('/templates', async (req, res) => {
  try {
    const { scope } = req.query;
    const templateService = getTemplateService();
    
    const filters = {};
    if (scope) {
      // Filtrer les templates qui commencent par scope: (sections) ou qui sont égaux à scope (document)
      filters.namespace = scope.includes(':') ? scope : new RegExp(`^${scope}:`);
    }
    
    const templates = await templateService.getAllTemplates(filters);
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('Erreur récupération templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /templates/:namespace
 * Récupère un template par son namespace
 */
router.get('/templates/:namespace', async (req, res) => {
  try {
    const { namespace } = req.params;
    const templateService = getTemplateService();
    
    const template = await templateService.getTemplate(namespace);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template non trouvé' });
    }
    
    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Erreur récupération template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /templates
 * Crée un nouveau template
 * Body: { namespace, data, options }
 */
router.post('/templates', async (req, res) => {
  try {
    const { namespace, data, options } = req.body;
    
    if (!namespace) {
      return res.status(400).json({ success: false, error: 'namespace est requis' });
    }
    
    const templateService = getTemplateService();
    const template = await templateService.createTemplate(namespace, data || {}, options || {});
    
    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Erreur création template:', error);
    
    // Si le template existe déjà, retourner 409
    if (error.statusCode === 409 || error.message?.includes('existe déjà')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /templates/:namespace
 * Met à jour un template
 * Body: { updates }
 */
router.put('/templates/:namespace', async (req, res) => {
  try {
    const { namespace } = req.params;
    const { updates } = req.body;
    
    if (!updates) {
      return res.status(400).json({ success: false, error: 'updates est requis' });
    }
    
    const templateService = getTemplateService();
    const template = await templateService.updateTemplate(namespace, updates);
    
    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Erreur mise à jour template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /templates/:namespace
 * Supprime un template
 */
router.delete('/templates/:namespace', async (req, res) => {
  try {
    const { namespace } = req.params;
    const templateService = getTemplateService();
    
    const deleted = await templateService.deleteTemplate(namespace);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Template non trouvé' });
    }
    
    res.json({ success: true, message: 'Template supprimé' });
  } catch (error) {
    console.error('Erreur suppression template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /templates/document
 * Crée un template document depuis un document existant
 * Body: { namespace, documentId, jsonContent? }
 */
router.post('/templates/document', async (req, res) => {
  try {
    const { namespace, documentId, jsonContent } = req.body;
    
    if (!namespace) {
      return res.status(400).json({ success: false, error: 'namespace est requis' });
    }
    
    const templateService = getTemplateService();
    let content = jsonContent;
    
    // Si documentId fourni, récupérer le document
    if (documentId && !content) {
      const documentService = getDocumentService();
      const document = await documentService.getDocument(documentId);
      content = document.json_content;
    }
    
    const template = await templateService.createDocumentTemplate(namespace, content, documentId);
    
    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Erreur création template document:', error);
    
    // Si le template existe déjà, retourner 409 (seulement si vraiment une erreur)
    if (error.statusCode === 409 || error.message?.includes('existe déjà')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /document/new
 * Crée un nouveau document vide
 * Body: { title?, json_content? }
 */
router.post('/document/new', async (req, res) => {
  try {
    const { title, json_content } = req.body;
    const documentService = getDocumentService();
    
    const document = await documentService.createEmptyDocument({
      title: title || 'Nouveau modèle',
      json_content: json_content || {
        sections: [],
        toc: [],
        images: []
      }
    });
    
    res.json({ success: true, data: document });
  } catch (error) {
    console.error('Erreur création document vide:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /document/from-template
 * Crée un nouveau document à partir d'un template document
 * Body: { templateNamespace, title? }
 */
router.post('/document/from-template', async (req, res) => {
  try {
    const { templateNamespace, title } = req.body;
    
    if (!templateNamespace) {
      return res.status(400).json({ success: false, error: 'templateNamespace est requis' });
    }
    
    const documentService = getDocumentService();
    const document = await documentService.createDocumentFromTemplate(templateNamespace, title);
    
    res.json({ success: true, data: document });
  } catch (error) {
    console.error('Erreur création document depuis template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ===================================
 * ROUTES MODÈLES (COLLECTIONS DE PRODUITS)
 * ===================================
 */

/**
 * GET /models
 * Récupère tous les modèles
 */
router.get('/models', async (req, res) => {
  try {
    const modelService = getModelService();
    const models = await modelService.getAllModels();
    res.json({ success: true, data: models });
  } catch (error) {
    console.error('Erreur récupération modèles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /models/:identifier
 * Récupère un modèle par son namespace ou nom
 */
router.get('/models/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const modelService = getModelService();
    
    const model = await modelService.getModel(identifier);
    if (!model) {
      return res.status(404).json({ success: false, error: 'Modèle non trouvé' });
    }
    
    res.json({ success: true, data: model });
  } catch (error) {
    console.error('Erreur récupération modèle:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /models
 * Crée un nouveau modèle
 * Body: { name, fields, variants }
 */
router.post('/models', async (req, res) => {
  try {
    const { name, fields, variants } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'name est requis' });
    }
    
    const modelService = getModelService();
    const model = await modelService.createModel(name, fields || [], variants || []);
    
    res.json({ success: true, data: model });
  } catch (error) {
    console.error('Erreur création modèle:', error);
    
    if (error.statusCode === 409 || error.message?.includes('existe déjà')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /models/:identifier
 * Met à jour un modèle
 * Body: { updates }
 */
router.put('/models/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const updates = req.body;
    
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'updates est requis' });
    }
    
    const modelService = getModelService();
    const model = await modelService.updateModel(identifier, updates);
    
    res.json({ success: true, data: model });
  } catch (error) {
    console.error('Erreur mise à jour modèle:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /models/:identifier
 * Supprime un modèle
 */
router.delete('/models/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const modelService = getModelService();
    
    const deleted = await modelService.deleteModel(identifier);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Modèle non trouvé' });
    }
    
    res.json({ success: true, message: 'Modèle supprimé' });
  } catch (error) {
    console.error('Erreur suppression modèle:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

