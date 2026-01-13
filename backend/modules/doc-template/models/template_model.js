// backend/modules/doc-template/models/template_model.js
const { ObjectId } = require('mongodb');
const database = require('../../../config/database');

class Template {
  constructor(data) {
    this.name = data.name;
    this.generalStyles = data.generalStyles || {};
    this.structure = data.structure || {};
    this.content = data.content || '';
    
    // Collection par défaut (peut être null pour les templates virtuels)
    this.defaultCollection = data.defaultCollection || null;
    
    // Collections additionnelles
    this.additionalCollections = data.additionalCollections || [];
    
    // ✅ IMPORTANT : entrepriseId pour savoir à quelle entreprise appartient ce template
    this.entrepriseId = data.entrepriseId;
    
    // ✅ NOUVEAU : Versioning
    this.version = data.version || '1.0.0';
    this.versionHistory = data.versionHistory || [];
    this.lastModifiedBy = data.lastModifiedBy || null; // ID utilisateur
    
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    
    if (data._id) {
      this._id = data._id;
    }
  }

  /**
   * Incrémente automatiquement la version (patch: 1.0.0 -> 1.0.1)
   */
  incrementVersion() {
    const parts = this.version.split('.');
    const patch = parseInt(parts[2] || 0) + 1;
    this.version = `${parts[0]}.${parts[1]}.${patch}`;
  }

  /**
   * Met à jour la version manuellement (pour changements structurels)
   * @param {string} newVersion - Nouvelle version (ex: "1.1.0" ou "2.0.0")
   * @param {string} changes - Description des changements
   */
  setVersion(newVersion, changes = '') {
    // Ajouter l'ancienne version à l'historique
    this.versionHistory.push({
      version: this.version,
      date: this.updatedAt,
      changes: changes || 'Mise à jour automatique'
    });
    
    this.version = newVersion;
  }

  // Sauvegarder le template dans la DB de l'entreprise
  async save(entrepriseId, options = {}) {
    if (!entrepriseId && !this.entrepriseId) {
      throw new Error('entrepriseId est requis pour sauvegarder un template');
    }
    
    const entId = entrepriseId || this.entrepriseId;
    this.entrepriseId = entId;
    
    const entrepriseDb = await database.getEntrepriseDb(entId);
    const collection = entrepriseDb.collection('templates');
    
    console.log('💾 Sauvegarde template dans:', `GDR-ENTREPRISE-${entId}`);
    
    const wasNew = !this._id;
    const previousVersion = this.version;
    
    // Si mise à jour et version auto activée (par défaut)
    if (!wasNew && options.autoVersion !== false) {
      this.incrementVersion();
    }
    
    this.updatedAt = new Date();
    
    if (this._id) {
      // Mise à jour
      const { _id, ...updateData } = this;
      await collection.updateOne(
        { _id: new ObjectId(_id) },
        { $set: updateData }
      );
      
      // Si version a changé, ajouter à l'historique
      if (previousVersion !== this.version) {
        await collection.updateOne(
          { _id: new ObjectId(_id) },
          { 
            $push: { 
              versionHistory: {
                version: previousVersion,
                date: this.updatedAt,
                changes: options.changes || 'Mise à jour automatique'
              }
            }
          }
        );
      }
      
      return this;
    } else {
      // Création
      const result = await collection.insertOne(this);
      this._id = result.insertedId;
      return this;
    }
  }

  // Méthodes statiques
  static async findOne(entrepriseId, query) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const collection = entrepriseDb.collection('templates');
    
    console.log('🔍 Recherche template dans:', `GDR-ENTREPRISE-${entrepriseId}`);
    const templateData = await collection.findOne(query);
    
    return templateData ? new Template(templateData) : null;
  }

  static async findById(entrepriseId, id) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const collection = entrepriseDb.collection('templates');
    
    const templateData = await collection.findOne({ _id: new ObjectId(id) });
    return templateData ? new Template(templateData) : null;
  }

  static async find(entrepriseId, query = {}) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const collection = entrepriseDb.collection('templates');
    
    const templates = await collection.find(query).toArray();
    return templates.map(templateData => new Template(templateData));
  }

  static async deleteOne(entrepriseId, filter) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const collection = entrepriseDb.collection('templates');
    
    return collection.deleteOne(filter);
  }

  static async countDocuments(entrepriseId, query = {}) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const collection = entrepriseDb.collection('templates');
    
    return collection.countDocuments(query);
  }

  // Créer les index pour une entreprise
  static async createIndexes(entrepriseId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const collection = entrepriseDb.collection('templates');
    
    // Index sur name pour cette entreprise
    await collection.createIndex({ name: 1 });
    await collection.createIndex({ entrepriseId: 1 });
    
    console.log(`✅ Index créés sur templates pour l'entreprise ${entrepriseId}`);
  }

  // Convertir en objet simple
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      generalStyles: this.generalStyles,
      structure: this.structure,
      content: this.content,
      defaultCollection: this.defaultCollection,
      additionalCollections: this.additionalCollections,
      version: this.version,
      versionHistory: this.versionHistory,
      lastModifiedBy: this.lastModifiedBy,
      entrepriseId: this.entrepriseId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Template;
