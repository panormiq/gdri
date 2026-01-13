// backend/controllers/storageController.js
const { ObjectId } = require('mongodb');
const StorageService = require('../services/StorageService');
const TemplateSnapshotService = require('../services/TemplateSnapshotService');
const CollectionSnapshotService = require('../services/CollectionSnapshotService');

/**
 * 🔹 Récupère les informations de stockage d'une entreprise
 */
const getStorageInfo = async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    const storageInfo = await StorageService.calculateStorage(entrepriseId);

    res.json({
      success: true,
      data: storageInfo
    });

  } catch (error) {
    console.error('❌ getStorageInfo:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
};

/**
 * 🔹 Met à jour le quota d'une entreprise
 */
const updateQuota = async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    const { quota } = req.body;

    if (!quota || quota <= 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Quota invalide'
      });
    }

    await StorageService.setQuota(entrepriseId, quota);
    const storageInfo = await StorageService.calculateStorage(entrepriseId);

    res.json({
      success: true,
      data: storageInfo
    });

  } catch (error) {
    console.error('❌ updateQuota:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
};

/**
 * 🔹 Liste les documents éligibles à la purge
 */
const getDocumentsForPurge = async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    const documents = await StorageService.getDocumentsEligibleForPurge(entrepriseId);

    res.json({
      success: true,
      data: documents
    });

  } catch (error) {
    console.error('❌ getDocumentsForPurge:', error);
    res.status(500).json({
      success: false,
      data: [],
      error: error.message
    });
  }
};

/**
 * 🔹 Exporte un document avant purge
 */
const exportDocumentForPurge = async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;
    const { documentId } = req.params;

    const exportData = await StorageService.exportDocumentForPurge(entrepriseId, documentId);

    res.json({
      success: true,
      data: exportData
    });

  } catch (error) {
    console.error('❌ exportDocumentForPurge:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
};

/**
 * 🔹 Purge les snapshots temporaires expirés
 */
const purgeExpiredSnapshots = async (req, res) => {
  try {
    const entrepriseId = req.user.entrepriseId;

    const templatePurged = await TemplateSnapshotService.purgeExpiredSnapshots(entrepriseId);
    const collectionPurged = await CollectionSnapshotService.purgeExpiredSnapshots(entrepriseId);

    // Recalculer le stockage
    const storageInfo = await StorageService.calculateStorage(entrepriseId);

    res.json({
      success: true,
      data: {
        templateSnapshotsPurged: templatePurged,
        collectionSnapshotsPurged: collectionPurged,
        storageInfo: storageInfo
      }
    });

  } catch (error) {
    console.error('❌ purgeExpiredSnapshots:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
};

/**
 * 🔹 Upload un fichier
 */
const upload = async (req, res) => {
  try {
    // TODO: Implémenter l'upload de fichiers
    res.status(501).json({ success: false, error: 'Upload not yet implemented' });
  } catch (error) {
    console.error('❌ upload:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🔹 Liste les fichiers
 */
const listFiles = async (req, res) => {
  try {
    // TODO: Implémenter la liste des fichiers
    res.status(501).json({ success: false, error: 'List files not yet implemented' });
  } catch (error) {
    console.error('❌ listFiles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🔹 Récupère un fichier
 */
const getFile = async (req, res) => {
  try {
    // TODO: Implémenter la récupération de fichier
    res.status(501).json({ success: false, error: 'Get file not yet implemented' });
  } catch (error) {
    console.error('❌ getFile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🔹 Supprime un fichier
 */
const deleteFile = async (req, res) => {
  try {
    // TODO: Implémenter la suppression de fichier
    res.status(501).json({ success: false, error: 'Delete file not yet implemented' });
  } catch (error) {
    console.error('❌ deleteFile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getStorageInfo,
  updateQuota,
  getDocumentsForPurge,
  exportDocumentForPurge,
  purgeExpiredSnapshots,
  upload,
  listFiles,
  getFile,
  deleteFile
};


