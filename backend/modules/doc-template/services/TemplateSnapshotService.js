// backend/services/TemplateSnapshotService.js
const { ObjectId } = require('mongodb');
const database = require('../../../config/database');

/**
 * 🔹 Service de gestion des snapshots de templates
 * 
 * Gère la création, récupération et purge des snapshots de versions de templates
 */
class TemplateSnapshotService {
  /**
   * Crée un snapshot d'un template
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {Object} template - Template à snapshoter
   * @param {string} type - 'permanent' ou 'temporary'
   * @param {Date} expiresAt - Date d'expiration (null si permanent)
   * @returns {Promise<Object>} Snapshot créé
   */
  static async createSnapshot(entrepriseId, template, type = 'permanent', expiresAt = null) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const snapshotCollection = entrepriseDb.collection('template_snapshots');
    
    // Calculer la taille approximative du snapshot
    const snapshotData = {
      name: template.name,
      generalStyles: template.generalStyles,
      structure: template.structure,
      content: template.content,
      defaultCollection: template.defaultCollection,
      additionalCollections: template.additionalCollections
    };
    
    const taille = Buffer.byteLength(JSON.stringify(snapshotData), 'utf8');
    
    const snapshot = {
      templateId: new ObjectId(template._id),
      version: template.version,
      snapshot: snapshotData,
      type: type,
      expiresAt: expiresAt,
      usedBy: [], // Sera mis à jour quand un document utilise ce snapshot
      taille: taille,
      createdAt: new Date()
    };
    
    const result = await snapshotCollection.insertOne(snapshot);
    snapshot._id = result.insertedId;
    
    console.log(`✅ Snapshot créé pour template ${template._id} version ${template.version} (${type})`);
    
    return snapshot;
  }

  /**
   * Récupère un snapshot par templateId et version
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} templateId - ID du template
   * @param {string} version - Version à récupérer
   * @returns {Promise<Object|null>} Snapshot ou null
   */
  static async getSnapshot(entrepriseId, templateId, version) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const snapshotCollection = entrepriseDb.collection('template_snapshots');
    
    const snapshot = await snapshotCollection.findOne({
      templateId: new ObjectId(templateId),
      version: version
    });
    
    // Vérifier si le snapshot temporaire a expiré
    if (snapshot && snapshot.type === 'temporary' && snapshot.expiresAt) {
      if (new Date() > snapshot.expiresAt) {
        console.log(`⚠️ Snapshot temporaire expiré pour template ${templateId} version ${version}`);
        return null;
      }
    }
    
    return snapshot;
  }

  /**
   * Récupère le snapshot "latest" (dernière version) d'un template
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} templateId - ID du template
   * @returns {Promise<Object|null>} Snapshot latest ou null
   */
  static async getLatestSnapshot(entrepriseId, templateId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const templatesCollection = entrepriseDb.collection('templates');
    
    const template = await templatesCollection.findOne({
      _id: new ObjectId(templateId)
    });
    
    if (!template) {
      return null;
    }
    
    // Le "latest" est toujours le template actuel (pas besoin de snapshot)
    return {
      templateId: template._id,
      version: template.version,
      snapshot: {
        name: template.name,
        generalStyles: template.generalStyles,
        structure: template.structure,
        content: template.content,
        defaultCollection: template.defaultCollection,
        additionalCollections: template.additionalCollections
      },
      type: 'latest',
      createdAt: template.updatedAt
    };
  }

  /**
   * Lie un document à un snapshot (pour tracking)
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} templateId - ID du template
   * @param {string} version - Version du snapshot
   * @param {string} documentId - ID du document qui utilise ce snapshot
   */
  static async linkDocument(entrepriseId, templateId, version, documentId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const snapshotCollection = entrepriseDb.collection('template_snapshots');
    
    await snapshotCollection.updateOne(
      {
        templateId: new ObjectId(templateId),
        version: version
      },
      {
        $addToSet: { usedBy: new ObjectId(documentId) }
      }
    );
  }

  /**
   * Retire un document d'un snapshot (quand document supprimé)
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} templateId - ID du template
   * @param {string} version - Version du snapshot
   * @param {string} documentId - ID du document à retirer
   */
  static async unlinkDocument(entrepriseId, templateId, version, documentId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const snapshotCollection = entrepriseDb.collection('template_snapshots');
    
    await snapshotCollection.updateOne(
      {
        templateId: new ObjectId(templateId),
        version: version
      },
      {
        $pull: { usedBy: new ObjectId(documentId) }
      }
    );
  }

  /**
   * Purge les snapshots temporaires expirés
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<number>} Nombre de snapshots purgés
   */
  static async purgeExpiredSnapshots(entrepriseId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const snapshotCollection = entrepriseDb.collection('template_snapshots');
    
    const result = await snapshotCollection.deleteMany({
      type: 'temporary',
      expiresAt: { $lt: new Date() }
    });
    
    console.log(`🗑️ ${result.deletedCount} snapshots temporaires expirés purgés pour entreprise ${entrepriseId}`);
    
    return result.deletedCount;
  }

  /**
   * Liste tous les snapshots d'un template
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} templateId - ID du template
   * @returns {Promise<Array>} Liste des snapshots
   */
  static async listSnapshots(entrepriseId, templateId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const snapshotCollection = entrepriseDb.collection('template_snapshots');
    
    const snapshots = await snapshotCollection
      .find({ templateId: new ObjectId(templateId) })
      .sort({ createdAt: -1 })
      .toArray();
    
    return snapshots;
  }

  /**
   * Calcule la taille totale des snapshots pour une entreprise
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<number>} Taille en bytes
   */
  static async getTotalSize(entrepriseId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const snapshotCollection = entrepriseDb.collection('template_snapshots');
    
    const result = await snapshotCollection.aggregate([
      {
        $group: {
          _id: null,
          totalSize: { $sum: '$taille' }
        }
      }
    ]).toArray();
    
    return result.length > 0 ? result[0].totalSize : 0;
  }
}

module.exports = TemplateSnapshotService;


