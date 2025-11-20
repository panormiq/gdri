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

module.exports = router;

