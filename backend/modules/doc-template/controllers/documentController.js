// backend/controllers/documentController.js
const { ObjectId } = require('mongodb');
const Document = require('../models/document_model');
const Template = require('../models/template_model');
const Collection = require('../models/collection_model');
const puppeteer = require('puppeteer');
const TemplateSnapshotService = require('../services/TemplateSnapshotService');
const CollectionSnapshotService = require('../services/CollectionSnapshotService');
const DocumentGenerationService = require('../services/DocumentGenerationService');

const DEFAULT_HEADING_SIZES = { h1: 24, h2: 20, h3: 18 };

const getTemplatePageSizeCm = (pagination = {}) => {
  const PAGE_SIZES = {
    A0: { width: 84.1, height: 118.9 },
    A1: { width: 59.4, height: 84.1 },
    A2: { width: 42, height: 59.4 },
    A3: { width: 29.7, height: 42 },
    A4: { width: 21, height: 29.7 },
    A5: { width: 14.8, height: 21 },
    A6: { width: 10.5, height: 14.8 }
  };

  const pageSize = pagination.pageSize || 'A4';
  const orientation = pagination.orientation || 'portrait';
  let size = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
  if (pageSize === 'custom') {
    size = {
      width: pagination.customWidth || 21,
      height: pagination.customHeight || 29.7
    };
  }

  if (orientation === 'landscape') {
    return { width: size.height, height: size.width };
  }

  return size;
};

const normalizeMargin = value => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return `${value}px`;
  return String(value);
};

const buildTemplateCss = (template = {}) => {
  const defaultStyles = template.generalStyles?.default || {};
  const headings = template.generalStyles?.headings || {};

  const baseFontFamily = defaultStyles.fontFamily || 'Arial';
  const baseFontSize = defaultStyles.fontSize || 12;
  const baseColor = defaultStyles.color || '#000000';
  const baseLineHeight = defaultStyles.lineHeight || 1.5;
  const baseTextAlign = defaultStyles.textAlign || 'left';

  const h1Size = headings.h1?.fontSize || DEFAULT_HEADING_SIZES.h1;
  const h2Size = headings.h2?.fontSize || DEFAULT_HEADING_SIZES.h2;
  const h3Size = headings.h3?.fontSize || DEFAULT_HEADING_SIZES.h3;
  const h1Weight = headings.h1?.fontWeight || 600;
  const h2Weight = headings.h2?.fontWeight || 600;
  const h3Weight = headings.h3?.fontWeight || 600;

  const headingCss = `
.doc-title-level-1,
.doc-title-level-2,
.doc-title-level-3 {
  display: block;
  margin-top: calc(var(--spacing-md, 24px) * var(--scale-ratio, 1) * 0.7) !important;
  margin-bottom: calc(var(--spacing-sm, 16px) * var(--scale-ratio, 1) * 0.7) !important;
  font-weight: 600 !important;
  font-family: inherit !important;
  line-height: inherit !important;
  color: inherit !important;
  text-align: inherit !important;
  text-transform: none !important;
  letter-spacing: normal !important;
}

.doc-title-level-1 { font-size: calc(var(--doc-font-size-h1, ${h1Size}px) * var(--scale-ratio, 1)) !important; font-weight: ${h1Weight} !important; }
.doc-title-level-2 { font-size: calc(var(--doc-font-size-h2, ${h2Size}px) * var(--scale-ratio, 1)) !important; font-weight: ${h2Weight} !important; }
.doc-title-level-3 { font-size: calc(var(--doc-font-size-h3, ${h3Size}px) * var(--scale-ratio, 1)) !important; font-weight: ${h3Weight} !important; }

h1, h2, h3 {
  margin-top: calc(var(--spacing-md, 24px) * var(--scale-ratio, 1)) !important;
  margin-bottom: calc(var(--spacing-sm, 16px) * var(--scale-ratio, 1)) !important;
  font-weight: 600 !important;
  font-family: inherit !important;
  line-height: inherit !important;
  color: inherit !important;
  text-align: inherit !important;
  text-transform: none !important;
  letter-spacing: normal !important;
}
h1 { font-size: calc(var(--doc-font-size-h1, ${h1Size}px) * var(--scale-ratio, 1)) !important; font-weight: ${h1Weight} !important; }
h2 { font-size: calc(var(--doc-font-size-h2, ${h2Size}px) * var(--scale-ratio, 1)) !important; font-weight: ${h2Weight} !important; }
h3 { font-size: calc(var(--doc-font-size-h3, ${h3Size}px) * var(--scale-ratio, 1)) !important; font-weight: ${h3Weight} !important; }
`.trim();

  const imageCss = `
.image-container-wrapper {
  display: block;
  margin: calc(var(--spacing-sm, 16px) * var(--scale-ratio, 1) * 0.7) 0 !important;
  margin-bottom: calc(0.84cm * var(--scale-ratio, 1)) !important;
  text-align: center;
}

.template-image-container {
  position: relative;
  display: inline-block;
  max-width: 100%;
  margin: 0 auto;
  line-height: 0;
}

.template-image-container img.template-image,
img.collection-image {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
  vertical-align: top;
  margin-bottom: 0.84cm !important;
}

.image-container-wrapper + * {
  margin-top: 0.84cm !important;
}

img.collection-image + * {
  margin-top: 0.84cm !important;
}

.pdf-image-spacing {
  height: 0.84cm;
}

img.collection-image {
  page-break-inside: avoid;
}

.image-placeholder,
.image-placeholder::before,
.image-placeholder::after {
  display: none !important;
  content: none !important;
}

.image-delete-button,
.resize-handle,
.image-crop-overlay,
.image-crop-box,
.lock-button {
  display: none !important;
}
`.trim();

  return `
:root {
  --scale-ratio: 1;
  --spacing-sm: 16px;
  --spacing-md: 24px;
  --doc-font-size-h1: ${h1Size}px;
  --doc-font-size-h2: ${h2Size}px;
  --doc-font-size-h3: ${h3Size}px;
}
body {
  margin: 0;
  font-family: ${baseFontFamily};
  font-size: ${baseFontSize}px;
  color: ${baseColor};
  line-height: ${baseLineHeight};
  text-align: ${baseTextAlign};
}
${headingCss}
${imageCss}
`.trim();
};

/**
 * 🔹 Documents CRUD
 */

/**
 * Récupère tous les documents
 */
const getAllDocuments = async (req, res) => {
  try {
    const documents = await Document.find(req.entrepriseDb, {});
    
    res.json({
      success: true,
      data: documents.map(doc => doc.toJSON()),
      error: null
    });
  } catch (error) {
    console.error('❌ Erreur getAllDocuments:', error);
    res.status(500).json({
      success: false,
      data: [],
      error: error.message
    });
  }
};

/**
 * Récupère un document par ID
 */
const getDocumentById = async (req, res) => {
  try {
    const document = await Document.findById(req.entrepriseDb, req.params.id);

    if (!document) {
      return res.status(404).json({ 
        success: false, 
        data: null,
        error: 'Document non trouvé' 
      });
    }

    res.json({ 
      success: true, 
      data: document.toJSON() 
    });
  } catch (error) {
    console.error('❌ Erreur getDocumentById:', error);
    res.status(500).json({ 
      success: false, 
      data: null,
      error: error.message 
    });
  }
};

/**
 * Capture les versions utilisées dans un document
 */
const captureVersions = async (entrepriseId, templateId, variables) => {
  const versions = {
    template: null,
    collections: {},
    childTemplates: {}
  };

  // Version du template principal
  const template = await Template.findById(entrepriseId, templateId);
  if (template) {
    versions.template = {
      templateId: template._id.toString(),
      version: template.version
    };
  }

  // Versions des collections utilisées
  if (variables && variables.collections) {
    for (const [alias, collectionData] of Object.entries(variables.collections)) {
      if (collectionData.collectionId) {
        const collection = await Collection.findById(entrepriseId, collectionData.collectionId);
        if (collection) {
          versions.collections[alias] = {
            collectionId: collection._id.toString(),
            version: collection.version,
            elementId: collectionData.elementId ? collectionData.elementId.toString() : null,
            values: collectionData.values || {}
          };
        }
      }
    }
  }

  // TODO: Détecter les templates enfants dans le contenu HTML
  // Pour l'instant, on laisse vide

  return versions;
};

/**
 * Crée les snapshots nécessaires pour un document utilisé
 */
const createSnapshotsForDocument = async (entrepriseId, document) => {
  if (!document.utilisé) {
    return; // Pas de snapshot si document non utilisé
  }

  const versions = document.versions;

  // Snapshot du template principal
  if (versions.template) {
    const template = await Template.findById(entrepriseId, versions.template.templateId);
    if (template) {
      // Vérifier si snapshot existe déjà
      let snapshot = await TemplateSnapshotService.getSnapshot(
        entrepriseId,
        versions.template.templateId,
        versions.template.version
      );

      if (!snapshot) {
        // Créer snapshot permanent
        snapshot = await TemplateSnapshotService.createSnapshot(
          entrepriseId,
          template,
          'permanent',
          null
        );
      }

      // Lier le document au snapshot
      await TemplateSnapshotService.linkDocument(
        entrepriseId,
        versions.template.templateId,
        versions.template.version,
        document._id.toString()
      );
    }
  }

  // Snapshots des collections
  for (const [alias, collectionData] of Object.entries(versions.collections || {})) {
    if (collectionData.collectionId) {
      const collection = await Collection.findById(entrepriseId, collectionData.collectionId);
      if (collection) {
        // Vérifier si snapshot existe déjà
        let snapshot = await CollectionSnapshotService.getSnapshot(
          entrepriseId,
          collectionData.collectionId,
          collectionData.version
        );

        if (!snapshot) {
          // Créer snapshot permanent
          snapshot = await CollectionSnapshotService.createSnapshot(
            entrepriseId,
            collection,
            'permanent',
            null
          );
        }

        // Lier le document au snapshot
        await CollectionSnapshotService.linkDocument(
          entrepriseId,
          collectionData.collectionId,
          collectionData.version,
          document._id.toString()
        );
      }
    }
  }
};

/**
 * Crée un nouveau document
 */
const createDocument = async (req, res) => {
  try {
    const { templateId, name, content, variables } = req.body;
    const entrepriseId = req.user.currentEntrepriseId;

    // 🔒 Validation
    if (!templateId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: "templateId est obligatoire"
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        data: null,
        error: "Le nom est obligatoire"
      });
    }

    // 🔹 Vérifier que le template existe
    const template = await req.entrepriseDb
      .collection('templates')
      .findOne({ _id: new ObjectId(templateId) });

    if (!template) {
      return res.status(404).json({
        success: false,
        data: null,
        error: "Template non trouvé"
      });
    }

    // 🔹 Capturer les versions actuelles
    const versions = await captureVersions(entrepriseId, templateId, variables);

    // 🔹 Créer le document
    const document = new Document({
      templateId,
      name,
      content: content || '',
      variables: variables || { simple: {}, collections: {} },
      versions: versions,
      entrepriseId
    });

    await document.save(req.entrepriseDb);

    res.status(201).json({
      success: true,
      data: document.toJSON()
    });

  } catch (error) {
    console.error("❌ createDocument:", error);
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
};

/**
 * Met à jour un document
 */
const updateDocument = async (req, res) => {
  try {
    const { name, content, variables, utilisé } = req.body;
    const entrepriseId = req.user.currentEntrepriseId;
    
    const document = await Document.findById(req.entrepriseDb, req.params.id);
    
    if (!document) {
      return res.status(404).json({ 
        success: false, 
        data: null,
        error: 'Document non trouvé' 
      });
    }

    const wasUsed = document.utilisé;

    // 🔹 Mettre à jour les champs
    if (name !== undefined) document.name = name;
    if (content !== undefined) document.content = content;
    if (variables !== undefined) {
      document.variables = variables;
      // Re-capturer les versions si variables changent
      const versions = await captureVersions(entrepriseId, document.templateId.toString(), variables);
      document.versions = versions;
    }
    if (utilisé !== undefined && utilisé === true && !document.utilisé) {
      document.markAsUsed();
    }

    await document.save(req.entrepriseDb);

    // 🔹 Si document vient d'être marqué comme utilisé, créer les snapshots
    if (!wasUsed && document.utilisé) {
      await createSnapshotsForDocument(entrepriseId, document);
    }

    res.json({ 
      success: true, 
      data: document.toJSON() 
    });

  } catch (error) {
    console.error("❌ updateDocument:", error);
    res.status(500).json({ 
      success: false, 
      data: null,
      error: error.message 
    });
  }
};

/**
 * Supprime un document
 */
const deleteDocument = async (req, res) => {
  try {
    const deleted = await Document.delete(req.entrepriseDb, req.params.id);

    if (!deleted) {
      return res.status(404).json({ 
        success: false, 
        data: null,
        error: 'Document non trouvé' 
      });
    }

    res.json({ 
      success: true, 
      data: {},
      error: null 
    });
  } catch (error) {
    console.error("❌ deleteDocument:", error);
    res.status(500).json({ 
      success: false, 
      data: null,
      error: error.message 
    });
  }
};

/**
 * Exporte un document en PDF
 */
const exportDocumentToPdf = async (req, res) => {
  try {
    const entrepriseId = req.user.currentEntrepriseId;
    const document = await Document.findById(req.entrepriseDb, req.params.id);
    
    if (!document) {
      return res.status(404).json({ 
        success: false, 
        data: null,
        error: 'Document non trouvé' 
      });
    }

    // 🔹 Marquer le document comme utilisé si pas déjà fait
    if (!document.utilisé) {
      document.markAsUsed();
      
      // Re-capturer les versions si nécessaire
      if (!document.versions.template) {
        document.versions = await captureVersions(
          entrepriseId,
          document.templateId.toString(),
          document.variables
        );
      }
      
      await document.save(req.entrepriseDb);
      
      // Créer les snapshots
      await createSnapshotsForDocument(entrepriseId, document);
    }

    // 🔹 Préparer les métadonnées de versions pour le PDF
    const metadata = {
      title: document.name,
      author: 'Document Template System',
      subject: 'Document généré',
      keywords: 'document, template',
      creator: 'Document Template System',
      producer: 'Document Template System',
      creationDate: document.createdAt,
      modDate: document.updatedAt,
      custom: {
        templateVersion: document.versions.template?.version || 'unknown',
        templateId: document.versions.template?.templateId || '',
        collectionVersions: Object.entries(document.versions.collections || {}).reduce((acc, [alias, data]) => {
          acc[alias] = {
            version: data.version,
            collectionId: data.collectionId
          };
          return acc;
        }, {})
      }
    };

    // 🔹 Convertir les images en base64 pour que Puppeteer puisse les charger
    let htmlContent = document.content || '';
    let templateForPdf = null;
    // Utiliser le contenu édité du document (source de vérité) + variables
    if (document.templateId) {
      const template = await Template.findById(entrepriseId, document.templateId.toString());
      if (template) {
        templateForPdf = template;
      }
    }
    if (htmlContent && document.variables) {
      htmlContent = DocumentGenerationService.generateContent(
        { content: htmlContent },
        document.variables || { simple: {}, collections: {} }
      );
    } else if (!htmlContent && templateForPdf) {
      htmlContent = DocumentGenerationService.generateContent(
        templateForPdf,
        document.variables || { simple: {}, collections: {} }
      );
    }
    const fs = require('fs');
    const path = require('path');
    
    // Trouver toutes les images avec des URLs API
    const imageUrlRegex = /src=["']([^"']*\/api\/doc-template\/collections\/([^\/]+)\/images\/([^"']+))["']/gi;
    const imageMatches = [...htmlContent.matchAll(imageUrlRegex)];
    
    console.log(`🖼️ ${imageMatches.length} image(s) trouvée(s) dans le document`);
    
    // Convertir chaque image en base64
    for (const match of imageMatches) {
      const fullUrl = match[1];
      const collectionId = match[2];
      const imageId = decodeURIComponent(match[3]);
      
      try {
        // Construire le chemin du fichier image
        const imagePath = path.join(
          process.cwd(),
          'uploads',
          `entreprise_${entrepriseId}`,
          `collection_${collectionId}`,
          'previews',
          imageId
        );
        
        if (fs.existsSync(imagePath)) {
          // Lire le fichier et le convertir en base64
          const imageBuffer = fs.readFileSync(imagePath);
          const ext = path.extname(imageId).toLowerCase();
          const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.svg': 'image/svg+xml'
          };
          const mimeType = mimeTypes[ext] || 'image/jpeg';
          const base64 = imageBuffer.toString('base64');
          const dataUrl = `data:${mimeType};base64,${base64}`;
          
          // Remplacer l'URL par le data URL
          htmlContent = htmlContent.replace(fullUrl, dataUrl);
          console.log(`✅ Image convertie en base64: ${imageId}`);
        } else {
          console.warn(`⚠️ Image non trouvée: ${imagePath}`);
        }
      } catch (error) {
        console.error(`❌ Erreur lors de la conversion de l'image ${imageId}:`, error);
      }
    }
    
    // 🔹 Lancer Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // 🔹 Nettoyer les contrôles d'édition (croix, handles, overlays)
    htmlContent = htmlContent
      // Supprimer UNIQUEMENT le bouton de suppression d'image
      .replace(/<button\b[^>]*class=(["'])[^"']*\bimage-delete-button\b[^"']*\1[^>]*>[\s\S]*?<\/button>/gis, '')
      .replace(/<button\b[^>]*title=(["'])Supprimer l'image\1[^>]*>[\s\S]*?<\/button>/gis, '');

    htmlContent = htmlContent
      .replace(/<div[^>]*class="[^"]*image-placeholder[^"]*"[^>]*>.*?<\/div>/gis, '')
      .replace(/<img[^>]*class="[^"]*image-placeholder[^"]*"[^>]*>/gis, '')
      .replace(/<img[^>]*src="data:image\/svg\+xml[^"]*"[^>]*>/gis, '');
    htmlContent = htmlContent
      .replace(/<img[^>]*\sdata-variable-path=(["']).*?\1[^>]*>/gis, '')
      .replace(/<img[^>]*\sdata-image-type=(["'])variable\1[^>]*>/gis, '')
      .replace(/<img[^>]*\ssrc=(["'])(?:\s*|about:blank|undefined|null)\1[^>]*>/gis, '')
      .replace(/<img[^>]*\ssrc=(["'])blob:[^"']*\1[^>]*>/gis, '');

    // Ajouter un spacer après les images (garantit l'écart dans le PDF)
    htmlContent = htmlContent
      .replace(/(<div[^>]*class="[^"]*image-container-wrapper[^"]*"[^>]*>[\s\S]*?<\/div>)/gis, '$1<div class="pdf-image-spacing"></div>')
      .replace(/(<img[^>]*class="[^"]*collection-image[^"]*"[^>]*>)/gis, '$1<div class="pdf-image-spacing"></div>');

    // 🔹 Appliquer les styles template dans le HTML
    const templateCss = buildTemplateCss(templateForPdf || {});
    const defaultStylesForPdf = templateForPdf?.generalStyles?.default || {};
    const headingsForPdf = templateForPdf?.generalStyles?.headings || {};
    const h1Size = headingsForPdf.h1?.fontSize || DEFAULT_HEADING_SIZES.h1;
    const h2Size = headingsForPdf.h2?.fontSize || DEFAULT_HEADING_SIZES.h2;
    const h3Size = headingsForPdf.h3?.fontSize || DEFAULT_HEADING_SIZES.h3;
    const h1Weight = headingsForPdf.h1?.fontWeight || 600;
    const h2Weight = headingsForPdf.h2?.fontWeight || 600;
    const h3Weight = headingsForPdf.h3?.fontWeight || 600;
    const baseFontFamily = defaultStylesForPdf.fontFamily || 'Arial';
    const baseFontSize = defaultStylesForPdf.fontSize || 12;
    const baseColor = defaultStylesForPdf.color || '#000000';
    const baseLineHeight = defaultStylesForPdf.lineHeight || 1.5;
    const baseTextAlign = defaultStylesForPdf.textAlign || 'left';
    const pdfStyleCss = `
:root {
  --scale-ratio: 1;
  --spacing-sm: 16px;
  --spacing-md: 24px;
  --doc-font-size-h1: ${h1Size}px;
  --doc-font-size-h2: ${h2Size}px;
  --doc-font-size-h3: ${h3Size}px;
}
body {
  margin: 0;
  font-family: ${baseFontFamily};
  font-size: ${baseFontSize}px;
  color: ${baseColor};
  line-height: ${baseLineHeight};
  text-align: ${baseTextAlign};
}
.doc-title-level-1,
.doc-title-level-2,
.doc-title-level-3 {
  display: block;
  margin-top: calc(var(--spacing-md, 24px) * var(--scale-ratio, 1) * 0.7) !important;
  margin-bottom: calc(var(--spacing-sm, 16px) * var(--scale-ratio, 1) * 0.7) !important;
  font-weight: 600 !important;
  font-family: inherit !important;
  line-height: inherit !important;
  color: inherit !important;
  text-align: inherit !important;
  text-transform: none !important;
  letter-spacing: normal !important;
}
.doc-title-level-1 { font-size: calc(var(--doc-font-size-h1, ${h1Size}px) * var(--scale-ratio, 1)) !important; font-weight: ${h1Weight} !important; }
.doc-title-level-2 { font-size: calc(var(--doc-font-size-h2, ${h2Size}px) * var(--scale-ratio, 1)) !important; font-weight: ${h2Weight} !important; }
.doc-title-level-3 { font-size: calc(var(--doc-font-size-h3, ${h3Size}px) * var(--scale-ratio, 1)) !important; font-weight: ${h3Weight} !important; }
.image-container-wrapper {
  display: block;
  margin: calc(var(--spacing-sm, 16px) * var(--scale-ratio, 1) * 0.7) 0 !important;
  margin-bottom: calc(0.84cm * var(--scale-ratio, 1)) !important;
  text-align: center;
}
.template-image-container {
  position: relative;
  display: inline-block;
  max-width: 100%;
  margin: 0 auto;
  line-height: 0;
}
.template-image-container img.template-image,
img.collection-image {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
  vertical-align: top;
}
`.trim();
    const pdfOverrideCss = `
.image-delete-button {
  display: none !important;
}
`.trim();
    const htmlWithStyles = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>${templateCss}\n${pdfStyleCss}${pdfOverrideCss ? `\n${pdfOverrideCss}` : ''}</style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `;

    // 🔹 Charger le HTML du document avec les images en base64
    await page.setContent(htmlWithStyles, {
      waitUntil: 'networkidle0'
    });

    // 🔹 Forcer les styles clés en inline (fiabilise le rendu PDF)
    const inlineDefaults = {
      h1Size,
      h2Size,
      h3Size,
      h1Weight,
      h2Weight,
      h3Weight,
      lineHeight: baseLineHeight,
      textAlign: baseTextAlign
    };

    await page.evaluate((defaults) => {
      const scaleRatio = 1;
      const marginTop = '0.7em';
      const marginBottom = '0.5em';

      const applyHeading = (selector, size, weight) => {
        document.querySelectorAll(selector).forEach(el => {
          el.style.fontSize = `${size * scaleRatio}px`;
          el.style.fontWeight = `${weight}`;
          el.style.lineHeight = String(defaults.lineHeight);
          el.style.textAlign = defaults.textAlign;
          el.style.marginTop = marginTop;
          el.style.marginBottom = marginBottom;
        });
      };

      applyHeading('.doc-title-level-1', defaults.h1Size, defaults.h1Weight);
      applyHeading('.doc-title-level-2', defaults.h2Size, defaults.h2Weight);
      applyHeading('.doc-title-level-3', defaults.h3Size, defaults.h3Weight);
      applyHeading('h1', defaults.h1Size, defaults.h1Weight);
      applyHeading('h2', defaults.h2Size, defaults.h2Weight);
      applyHeading('h3', defaults.h3Size, defaults.h3Weight);

      document.querySelectorAll('.image-container-wrapper').forEach(el => {
        el.style.display = 'block';
        el.style.textAlign = 'center';
        el.style.marginTop = '0.5em';
        el.style.marginBottom = '0.84cm';
      });
    }, inlineDefaults);

    
    // 🔹 Générer le PDF avec métadonnées
    const pagination = templateForPdf?.generalStyles?.default?.pagination || {};
    const pageSize = getTemplatePageSizeCm(pagination);
    const margins = templateForPdf?.generalStyles?.default?.margin || {};

    const pdfBuffer = await page.pdf({
      width: `${pageSize.width}cm`,
      height: `${pageSize.height}cm`,
      printBackground: true,
      margin: {
        top: normalizeMargin(margins.top) || '0cm',
        right: normalizeMargin(margins.right) || '0cm',
        bottom: normalizeMargin(margins.bottom) || '0cm',
        left: normalizeMargin(margins.left) || '0cm'
      },
      // Métadonnées PDF
      displayHeaderFooter: false,
      // Les métadonnées seront ajoutées via PDFKit si nécessaire
    });
    
    await browser.close();
    
    // 🔹 Envoyer le PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.name}.pdf"`);
    // Ajouter les métadonnées dans les headers (pour référence)
    res.setHeader('X-Document-Template-Version', document.versions.template?.version || 'unknown');
    res.setHeader('X-Document-Created-At', document.createdAt.toISOString());
    res.send(pdfBuffer);

  } catch (error) {
    console.error("❌ exportDocumentToPdf:", error);
    res.status(500).json({ 
      success: false, 
      data: null,
      error: error.message 
    });
  }
};

/**
 * Exporte un PDF depuis un HTML fourni (viewer)
 */
const exportHtmlToPdf = async (req, res) => {
  try {
    const html = String(req.body?.html || '');
    if (!html || html.length < 10) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'HTML manquant'
      });
    }

    if (html.length > 2_000_000) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'HTML trop volumineux'
      });
    }

    // Convertir les images API en base64 si possible
    const entrepriseId = req.user.currentEntrepriseId;
    let htmlContent = html;
    const fs = require('fs');
    const path = require('path');
    const imageUrlRegex = /src=["']([^"']*\/api\/doc-template\/collections\/([^\/]+)\/images\/([^"']+))["']/gi;
    const imageMatches = [...htmlContent.matchAll(imageUrlRegex)];
    for (const match of imageMatches) {
      const fullUrl = match[1];
      const collectionId = match[2];
      const imageId = decodeURIComponent(match[3]);
      try {
        const imagePath = path.join(
          process.cwd(),
          'uploads',
          `entreprise_${entrepriseId}`,
          `collection_${collectionId}`,
          'previews',
          imageId
        );
        if (fs.existsSync(imagePath)) {
          const imageBuffer = fs.readFileSync(imagePath);
          const ext = path.extname(imageId).toLowerCase();
          const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.svg': 'image/svg+xml'
          };
          const mimeType = mimeTypes[ext] || 'image/jpeg';
          const base64 = imageBuffer.toString('base64');
          const dataUrl = `data:${mimeType};base64,${base64}`;
          htmlContent = htmlContent.replace(fullUrl, dataUrl);
        }
      } catch (error) {
        console.error(`❌ exportHtmlToPdf image convert error:`, error);
      }
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

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
    res.setHeader('Content-Disposition', 'attachment; filename="viewer-export.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('❌ exportHtmlToPdf:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
};

/**
 * Récupère le HTML d'un document
 */
const getDocumentHtml = async (req, res) => {
  try {
    const document = await Document.findById(req.entrepriseDb, req.params.id);
    
    if (!document) {
      return res.status(404).json({ 
        success: false, 
        data: null,
        error: 'Document non trouvé' 
      });
    }

    res.json({
      success: true,
      data: {
        html: document.content,
        name: document.name
      }
    });

  } catch (error) {
    console.error("❌ getDocumentHtml:", error);
    res.status(500).json({ 
      success: false, 
      data: null,
      error: error.message 
    });
  }
};

module.exports = {
  getAll: getAllDocuments,
  getById: getDocumentById,
  create: createDocument,
  update: updateDocument,
  delete: deleteDocument,
  exportDocumentToPdf,
  exportHtmlToPdf,
  getDocumentHtml
};

