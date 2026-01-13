// backend/controllers/documentController.js
const { ObjectId } = require('mongodb');
const Document = require('../models/document_model');
const Template = require('../models/template_model');
const Collection = require('../models/collection_model');
const puppeteer = require('puppeteer');
const TemplateSnapshotService = require('../services/TemplateSnapshotService');
const CollectionSnapshotService = require('../services/CollectionSnapshotService');

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

    // 🔹 Lancer Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // 🔹 Charger le HTML du document
    await page.setContent(document.content, {
      waitUntil: 'networkidle0'
    });
    
    // 🔹 Générer le PDF avec métadonnées
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
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
  getDocumentHtml
};

