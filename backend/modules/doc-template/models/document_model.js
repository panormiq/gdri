// backend/modules/doc-template/models/document_model.js
const { ObjectId } = require('mongodb');

/**
 * 🔹 Modèle Document (MongoDB natif)
 * 
 * Structure :
 * - templateId : Référence au template utilisé
 * - name : Nom du document
 * - content : HTML final avec variables remplacées
 * - variables : Objet contenant les variables utilisées
 *   - simple : Variables simples (non liées à une collection)
 *   - collections : Variables liées à des collections (alias → collectionId, elementId, values)
 * - entrepriseId : Entreprise propriétaire
 */
class Document {
  constructor(data) {
    this.templateId = data.templateId ? new ObjectId(data.templateId) : null;
    this.name = data.name || '';
    this.content = data.content || '';
    
    // Variables utilisées pour générer le document
    this.variables = {
      simple: data.variables?.simple || {},
      collections: data.variables?.collections || {}
    };
    
    // ✅ NOUVEAU : Statut d'utilisation et versions figées
    this.utilisé = data.utilisé || false;
    this.utiliséAt = data.utiliséAt || null;
    
    // Versions figées au moment de la création/finalisation
    this.versions = data.versions || {
      template: null,  // { templateId, version }
      collections: {}, // { alias: { collectionId, version, elementId, values } }
      childTemplates: {} // { templateId: { templateId, version } }
    };
    
    // Mode de régénération (original = avec versions figées, latest = dernière version)
    this.regenerationMode = data.regenerationMode || 'original';
    
    this.entrepriseId = data.entrepriseId ? new ObjectId(data.entrepriseId) : null;
    
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    
    if (data._id) {
      this._id = data._id;
    }
  }

  /**
   * Marque le document comme utilisé (finalisé)
   */
  markAsUsed() {
    if (!this.utilisé) {
      this.utilisé = true;
      this.utiliséAt = new Date();
    }
  }

  /**
   * Sauvegarder le document dans la DB de l'entreprise
   */
  async save(entrepriseDb) {
    if (!this.entrepriseId) {
      throw new Error('entrepriseId est requis pour sauvegarder un document');
    }
    
    this.updatedAt = new Date();
    
    const collection = entrepriseDb.collection('documents');
    
    if (this._id) {
      // Mise à jour
      const { _id, ...updateData } = this;
      await collection.updateOne(
        { _id: new ObjectId(_id) },
        { $set: updateData }
      );
      return this;
    } else {
      // Création
      this.createdAt = new Date();
      const result = await collection.insertOne(this);
      this._id = result.insertedId;
      return this;
    }
  }

  /**
   * Méthodes statiques
   */
  static async findOne(entrepriseDb, query) {
    const collection = entrepriseDb.collection('documents');
    const doc = await collection.findOne(query);
    return doc ? new Document(doc) : null;
  }

  static async findById(entrepriseDb, id) {
    return this.findOne(entrepriseDb, { _id: new ObjectId(id) });
  }

  static async find(entrepriseDb, query = {}) {
    const collection = entrepriseDb.collection('documents');
    const docs = await collection.find(query).sort({ createdAt: -1 }).toArray();
    return docs.map(doc => new Document(doc));
  }

  static async delete(entrepriseDb, id) {
    const collection = entrepriseDb.collection('documents');
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  /**
   * Convertir en objet simple
   */
  toJSON() {
    return {
      _id: this._id,
      templateId: this.templateId,
      name: this.name,
      content: this.content,
      variables: this.variables,
      utilisé: this.utilisé,
      utiliséAt: this.utiliséAt,
      versions: this.versions,
      regenerationMode: this.regenerationMode,
      entrepriseId: this.entrepriseId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Document;
