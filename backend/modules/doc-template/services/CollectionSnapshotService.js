// backend/services/CollectionSnapshotService.js
const { ObjectId } = require('mongodb');
const database = require('../../../config/database');

/**
 * 🔹 Service de gestion des snapshots de collections
 * 
 * Gère la création, récupération et purge des snapshots de versions de collections
 */
class CollectionSnapshotService {
  /**
   * Crée un snapshot d'une collection
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {Object} collection - Collection à snapshoter
   * @param {string} type - 'permanent' ou 'temporary'
   * @param {Date} expiresAt - Date d'expiration (null si permanent)
   * @returns {Promise<Object>} Snapshot créé
   */
  static async createSnapshot(entrepriseId, collection, type = 'permanent', expiresAt = null) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const snapshotCollection = entrepriseDb.collection('collection_snapshots');
    
    // Calculer la taille approximative du snapshot
    const snapshotData = {
      name: collection.name,
      referenceField: collection.referenceField,
      fields: collection.fields // Schéma des champs uniquement (pas les éléments)
    };
    
    const taille = Buffer.byteLength(JSON.stringify(snapshotData), 'utf8');
    
    const snapshot = {
      collectionId: new ObjectId(collection._id),
      version: collection.version,
      snapshot: snapshotData,
      type: type,
      expiresAt: expiresAt,
      usedBy: [], // Sera mis à jour quand un document utilise ce snapshot
      taille: taille,
      createdAt: new Date()
    };
    
    const result = await snapshotCollection.insertOne(snapshot);
    snapshot._id = result.insertedId;
    
    console.log(`✅ Snapshot créé pour collection ${collection._id} version ${collection.version} (${type})`);
    
    return snapshot;
  }

  /**
   * Récupère un snapshot par collectionId et version
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} collectionId - ID de la collection
   * @param {string} version - Version à récupérer
   * @returns {Promise<Object|null>} Snapshot ou null
   */
  static async getSnapshot(entrepriseId, collectionId, version) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const snapshotCollection = entrepriseDb.collection('collection_snapshots');
    
    const snapshot = await snapshotCollection.findOne({
      collectionId: new ObjectId(collectionId),
      version: version
    });
    
    // Vérifier si le snapshot temporaire a expiré
    if (snapshot && snapshot.type === 'temporary' && snapshot.expiresAt) {
      if (new Date() > snapshot.expiresAt) {
        console.log(`⚠️ Snapshot temporaire expiré pour collection ${collectionId} version ${version}`);
        return null;
      }
    }
    
    return snapshot;
  }

  /**
   * Récupère le snapshot "latest" (dernière version) d'une collection
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} collectionId - ID de la collection
   * @returns {Promise<Object|null>} Snapshot latest ou null
   */
  static async getLatestSnapshot(entrepriseId, collectionId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const collectionsCollection = entrepriseDb.collection('collections');
    
    const collection = await collectionsCollection.findOne({
      _id: new ObjectId(collectionId)
    });
    
    if (!collection) {
      return null;
    }
    
    // Le "latest" est toujours la collection actuelle (pas besoin de snapshot)
    return {
      collectionId: collection._id,
      version: collection.version,
      snapshot: {
        name: collection.name,
        referenceField: collection.referenceField,
        fields: collection.fields
      },
      type: 'latest',
      createdAt: collection.updatedAt
    };
  }

  /**
   * Lie un document à un snapshot (pour tracking)
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} collectionId - ID de la collection
   * @param {string} version - Version du snapshot
   * @param {string} documentId - ID du document qui utilise ce snapshot
   */
  static async linkDocument(entrepriseId, collectionId, version, documentId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const snapshotCollection = entrepriseDb.collection('collection_snapshots');
    
    await snapshotCollection.updateOne(
      {
        collectionId: new ObjectId(collectionId),
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
   * @param {string} collectionId - ID de la collection
   * @param {string} version - Version du snapshot
   * @param {string} documentId - ID du document à retirer
   */
  static async unlinkDocument(entrepriseId, collectionId, version, documentId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const snapshotCollection = entrepriseDb.collection('collection_snapshots');
    
    await snapshotCollection.updateOne(
      {
        collectionId: new ObjectId(collectionId),
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
    const snapshotCollection = entrepriseDb.collection('collection_snapshots');
    
    const result = await snapshotCollection.deleteMany({
      type: 'temporary',
      expiresAt: { $lt: new Date() }
    });
    
    console.log(`🗑️ ${result.deletedCount} snapshots temporaires expirés purgés pour entreprise ${entrepriseId}`);
    
    return result.deletedCount;
  }

  /**
   * Liste tous les snapshots d'une collection
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} collectionId - ID de la collection
   * @returns {Promise<Array>} Liste des snapshots
   */
  static async listSnapshots(entrepriseId, collectionId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const snapshotCollection = entrepriseDb.collection('collection_snapshots');
    
    const snapshots = await snapshotCollection
      .find({ collectionId: new ObjectId(collectionId) })
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
    const snapshotCollection = entrepriseDb.collection('collection_snapshots');
    
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

module.exports = CollectionSnapshotService;


