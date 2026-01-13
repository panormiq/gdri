// backend/services/StorageService.js
const { ObjectId } = require('mongodb');
const database = require('../../../config/database');
const TemplateSnapshotService = require('./TemplateSnapshotService');
const CollectionSnapshotService = require('./CollectionSnapshotService');

/**
 * 🔹 Service de gestion du stockage par entreprise
 * 
 * Gère les quotas, calcul de l'espace utilisé, et purge
 */
class StorageService {
  // Quota par défaut : 10 GB (10737418240 bytes)
  static DEFAULT_QUOTA = 10 * 1024 * 1024 * 1024;

  /**
   * Initialise ou récupère les informations de stockage d'une entreprise
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<Object>} Informations de stockage
   */
  static async getStorageInfo(entrepriseId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const storageCollection = entrepriseDb.collection('entreprise_storage');
    
    let storageInfo = await storageCollection.findOne({ entrepriseId: new ObjectId(entrepriseId) });
    
    if (!storageInfo) {
      // Initialiser avec quota par défaut
      storageInfo = {
        entrepriseId: new ObjectId(entrepriseId),
        quota: this.DEFAULT_QUOTA,
        utilisé: 0,
        documents: {
          total: 0,
          utilisés: 0,
          brouillons: 0
        },
        snapshots: {
          total: 0,
          taille: 0
        },
        dernièrePurge: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await storageCollection.insertOne(storageInfo);
    }
    
    return storageInfo;
  }

  /**
   * Met à jour le quota d'une entreprise
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {number} quota - Nouveau quota en bytes
   */
  static async setQuota(entrepriseId, quota) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const storageCollection = entrepriseDb.collection('entreprise_storage');
    
    await storageCollection.updateOne(
      { entrepriseId: new ObjectId(entrepriseId) },
      {
        $set: {
          quota: quota,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  /**
   * Calcule et met à jour l'espace utilisé
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<Object>} Informations de stockage mises à jour
   */
  static async calculateStorage(entrepriseId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const storageCollection = entrepriseDb.collection('entreprise_storage');
    const documentsCollection = entrepriseDb.collection('documents');
    
    // Compter les documents
    const totalDocs = await documentsCollection.countDocuments({ entrepriseId: new ObjectId(entrepriseId) });
    const utilisésDocs = await documentsCollection.countDocuments({ 
      entrepriseId: new ObjectId(entrepriseId),
      utilisé: true
    });
    const brouillonsDocs = totalDocs - utilisésDocs;
    
    // Calculer la taille des documents (approximatif)
    const documents = await documentsCollection.find({ entrepriseId: new ObjectId(entrepriseId) }).toArray();
    let documentsSize = 0;
    documents.forEach(doc => {
      documentsSize += Buffer.byteLength(doc.content || '', 'utf8');
      documentsSize += Buffer.byteLength(JSON.stringify(doc.variables || {}), 'utf8');
    });
    
    // Taille des snapshots
    const templateSnapshotsSize = await TemplateSnapshotService.getTotalSize(entrepriseId);
    const collectionSnapshotsSize = await CollectionSnapshotService.getTotalSize(entrepriseId);
    const snapshotsSize = templateSnapshotsSize + collectionSnapshotsSize;
    
    // Compter les snapshots
    const templateSnapshots = await entrepriseDb.collection('template_snapshots').countDocuments({});
    const collectionSnapshots = await entrepriseDb.collection('collection_snapshots').countDocuments({});
    const totalSnapshots = templateSnapshots + collectionSnapshots;
    
    const totalUsed = documentsSize + snapshotsSize;
    
    // Mettre à jour
    await storageCollection.updateOne(
      { entrepriseId: new ObjectId(entrepriseId) },
      {
        $set: {
          utilisé: totalUsed,
          documents: {
            total: totalDocs,
            utilisés: utilisésDocs,
            brouillons: brouillonsDocs
          },
          snapshots: {
            total: totalSnapshots,
            taille: snapshotsSize
          },
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    const storageInfo = await this.getStorageInfo(entrepriseId);
    storageInfo.utilisé = totalUsed;
    storageInfo.documents = {
      total: totalDocs,
      utilisés: utilisésDocs,
      brouillons: brouillonsDocs
    };
    storageInfo.snapshots = {
      total: totalSnapshots,
      taille: snapshotsSize
    };
    
    return storageInfo;
  }

  /**
   * Vérifie si l'entreprise a assez d'espace
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {number} additionalSize - Taille supplémentaire en bytes
   * @returns {Promise<{allowed: boolean, used: number, quota: number, available: number}>}
   */
  static async checkQuota(entrepriseId, additionalSize = 0) {
    const storageInfo = await this.calculateStorage(entrepriseId);
    const available = storageInfo.quota - storageInfo.utilisé;
    const allowed = (storageInfo.utilisé + additionalSize) <= storageInfo.quota;
    
    return {
      allowed,
      used: storageInfo.utilisé,
      quota: storageInfo.quota,
      available,
      percentage: (storageInfo.utilisé / storageInfo.quota) * 100
    };
  }

  /**
   * Liste les documents éligibles à la purge (> 6 mois, non utilisés)
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<Array>} Liste des documents éligibles
   */
  static async getDocumentsEligibleForPurge(entrepriseId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const documentsCollection = entrepriseDb.collection('documents');
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const documents = await documentsCollection.find({
      entrepriseId: new ObjectId(entrepriseId),
      utilisé: false,
      updatedAt: { $lt: sixMonthsAgo }
    }).sort({ updatedAt: 1 }).toArray();
    
    return documents;
  }

  /**
   * Exporte un document avant purge (PDF, HTML, JSON)
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} documentId - ID du document
   * @returns {Promise<Object>} Données d'export
   */
  static async exportDocumentForPurge(entrepriseId, documentId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const documentsCollection = entrepriseDb.collection('documents');
    
    const document = await documentsCollection.findOne({
      _id: new ObjectId(documentId),
      entrepriseId: new ObjectId(entrepriseId)
    });
    
    if (!document) {
      throw new Error('Document non trouvé');
    }
    
    return {
      document: {
        _id: document._id,
        name: document.name,
        content: document.content,
        variables: document.variables,
        versions: document.versions,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
      },
      metadata: {
        exportedAt: new Date(),
        exportedBy: 'system',
        format: 'json'
      }
    };
  }
}

module.exports = StorageService;


