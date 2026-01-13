// backend/controllers/documentGenerationController.js
const { ObjectId } = require('mongodb');
const DocumentGenerationService = require('../services/DocumentGenerationService');
const puppeteer = require('puppeteer');

/**
 * 🔹 Génère un document à la volée (mode dynamique) sans stockage
 */
const generateDocumentOnTheFly = async (req, res) => {
  try {
    const entrepriseId = req.user.currentEntrepriseId;
    const { templateId, variables, format = 'html' } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'templateId est obligatoire'
      });
    }

    // Générer le contenu HTML
    const { content, name } = await DocumentGenerationService.generateOnTheFly(
      entrepriseId,
      templateId,
      variables || { simple: {}, collections: {} }
    );

    // Si format PDF demandé
    if (format === 'pdf') {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(content, {
        waitUntil: 'networkidle0'
      });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });
      
      await browser.close();
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${name}.pdf"`);
      res.send(pdfBuffer);
    } else {
      // Retourner le HTML
      res.json({
        success: true,
        data: {
          content,
          name,
          format: 'html'
        }
      });
    }

  } catch (error) {
    console.error('❌ generateDocumentOnTheFly:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
};

module.exports = {
  generateDocumentOnTheFly
};


