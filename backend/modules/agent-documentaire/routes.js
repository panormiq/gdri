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
 * - GET /document/:documentId/image/:imageId - Récupérer une image
 */

const express = require('express');
const router = express.Router();
const { getDocumentService } = require('./service-container');

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

module.exports = router;

