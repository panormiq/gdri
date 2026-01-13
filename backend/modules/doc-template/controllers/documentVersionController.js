// backend/controllers/documentVersionController.js
const { ObjectId } = require('mongodb');
const Document = require('../models/document_model');
const Template = require('../models/template_model');
const Collection = require('../models/collection_model');
const TemplateSnapshotService = require('../services/TemplateSnapshotService');
const CollectionSnapshotService = require('../services/CollectionSnapshotService');

/**
 * 🔹 Vérifie si les versions utilisées dans un document ont changé
 */
const checkVersions = async (req, res) => {
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

    const changes = {
      template: null,
      collections: {},
      childTemplates: {},
      hasChanges: false
    };

    // Vérifier le template principal
    if (document.versions.template) {
      const currentTemplate = await Template.findById(
        entrepriseId,
        document.versions.template.templateId
      );

      if (currentTemplate) {
        const originalVersion = document.versions.template.version;
        const currentVersion = currentTemplate.version;

        if (originalVersion !== currentVersion) {
          changes.template = {
            templateId: document.versions.template.templateId,
            originalVersion: originalVersion,
            currentVersion: currentVersion,
            hasChanged: true
          };
          changes.hasChanges = true;
        } else {
          changes.template = {
            templateId: document.versions.template.templateId,
            originalVersion: originalVersion,
            currentVersion: currentVersion,
            hasChanged: false
          };
        }
      }
    }

    // Vérifier les collections
    for (const [alias, collectionData] of Object.entries(document.versions.collections || {})) {
      if (collectionData.collectionId) {
        const currentCollection = await Collection.findById(
          entrepriseId,
          collectionData.collectionId
        );

        if (currentCollection) {
          const originalVersion = collectionData.version;
          const currentVersion = currentCollection.version;

          if (originalVersion !== currentVersion) {
            changes.collections[alias] = {
              collectionId: collectionData.collectionId,
              alias: alias,
              originalVersion: originalVersion,
              currentVersion: currentVersion,
              hasChanged: true
            };
            changes.hasChanges = true;
          } else {
            changes.collections[alias] = {
              collectionId: collectionData.collectionId,
              alias: alias,
              originalVersion: originalVersion,
              currentVersion: currentVersion,
              hasChanged: false
            };
          }
        }
      }
    }

    res.json({
      success: true,
      data: changes
    });

  } catch (error) {
    console.error('❌ checkVersions:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
};

/**
 * 🔹 Régénère un document avec choix de version (originale ou latest)
 */
const regenerateDocument = async (req, res) => {
  try {
    const entrepriseId = req.user.currentEntrepriseId;
    const { mode } = req.body; // 'original' ou 'latest'
    const document = await Document.findById(req.entrepriseDb, req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Document non trouvé'
      });
    }

    const regenerationMode = mode || document.regenerationMode || 'original';

    // TODO: Implémenter la régénération complète avec remplacement des variables
    // Pour l'instant, on met juste à jour le mode de régénération
    document.regenerationMode = regenerationMode;
    await document.save(req.entrepriseDb);

    res.json({
      success: true,
      data: {
        document: document.toJSON(),
        mode: regenerationMode,
        message: regenerationMode === 'original' 
          ? 'Document configuré pour utiliser les versions originales'
          : 'Document configuré pour utiliser les dernières versions'
      }
    });

  } catch (error) {
    console.error('❌ regenerateDocument:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
};

module.exports = {
  checkVersions,
  regenerateDocument
};


