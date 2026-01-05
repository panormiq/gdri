/**
 * Service Model - Gestion des modèles (collections de produits)
 * Fichier : backend/modules/agent-documentaire/services/ModelService.js
 * 
 * Fonction : Gère les modèles = collections de produits avec leurs variantes
 * Exemple : Modèle "Moteur" avec variantes F100T, F115, F150
 */

const { ObjectId } = require('mongodb');

class ModelService {
  constructor(database) {
    this.database = database;
    this.collection = null;
  }

  /**
   * Initialise le service
   */
  async init() {
    this.collection = this.database.getCollection('models');

    // Créer les index
    try {
      await this.collection.createIndex({ name: 1 }, { unique: true });
      await this.collection.createIndex({ namespace: 1 }, { unique: true });
      console.log('  ✅ Index MongoDB créé pour collection models');
    } catch (error) {
      // Index existe déjà, pas d'erreur
    }
  }

  /**
   * ===================================
   * MODÈLES (COLLECTIONS DE PRODUITS)
   * ===================================
   */

  /**
   * Crée un modèle (collection de produits)
   * @param {string} name - Nom du modèle (ex: "Moteur")
   * @param {Array} fields - Champs/variables du modèle
   * @param {Array} variants - Variantes du modèle (lignes du tableau)
   * @returns {Promise<Object>} Modèle créé
   */
  async createModel(name, fields = [], variants = []) {
    // Vérifier si le modèle existe déjà
    const existing = await this.collection.findOne({ name });
    if (existing) {
      const error = new Error(`Modèle "${name}" existe déjà`);
      error.statusCode = 409; // Conflict
      throw error;
    }

    // Générer un namespace
    const namespace = this.normalizeName(name);

    const model = {
      namespace: namespace,
      name: name,
      fields: Array.isArray(fields) ? [...fields] : [],
      variants: Array.isArray(variants) ? [...variants] : [],
      referenceFields: [], // Champs utilisés comme référence pour la sélection dans les templates
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    await this.collection.insertOne(model);
    return model;
  }

  /**
   * Récupère tous les modèles
   * @param {Object} filters - Filtres optionnels
   * @returns {Promise<Array>} Liste des modèles
   */
  async getAllModels(filters = {}) {
    return await this.collection.find(filters).sort({ name: 1 }).toArray();
  }

  /**
   * Récupère un modèle par son namespace ou nom
   * @param {string} identifier - Namespace ou nom du modèle
   * @returns {Promise<Object|null>} Modèle ou null
   */
  async getModel(identifier) {
    // Essayer d'abord par namespace, puis par nom
    let model = await this.collection.findOne({ namespace: identifier });
    if (!model) {
      model = await this.collection.findOne({ name: identifier });
    }
    return model;
  }

  /**
   * Met à jour un modèle
   * @param {string} identifier - Namespace ou nom du modèle
   * @param {Object} updates - Données à mettre à jour
   * @returns {Promise<Object>} Modèle mis à jour
   */
  async updateModel(identifier, updates) {
    const updateDoc = {
      ...updates,
      'metadata.updatedAt': new Date()
    };

    // Chercher le modèle
    const model = await this.getModel(identifier);
    if (!model) {
      throw new Error(`Modèle "${identifier}" non trouvé`);
    }

    await this.collection.updateOne(
      { _id: model._id },
      { $set: updateDoc }
    );

    return await this.getModel(identifier);
  }

  /**
   * Supprime un modèle
   * @param {string} identifier - Namespace ou nom du modèle
   * @returns {Promise<boolean>} true si supprimé
   */
  async deleteModel(identifier) {
    const model = await this.getModel(identifier);
    if (!model) {
      return false;
    }

    const result = await this.collection.deleteOne({ _id: model._id });
    return result.deletedCount > 0;
  }

  /**
   * Met à jour les variants (entrées) d'un modèle
   * @param {string} identifier - Namespace ou nom du modèle
   * @param {Array} variants - Nouveau tableau de variants
   * @returns {Promise<Object>} Modèle mis à jour
   */
  async updateVariants(identifier, variants) {
    if (!Array.isArray(variants)) {
      throw new Error('variants doit être un tableau');
    }

    const model = await this.getModel(identifier);
    if (!model) {
      throw new Error(`Modèle "${identifier}" non trouvé`);
    }

    await this.collection.updateOne(
      { _id: model._id },
      { 
        $set: { 
          variants: variants,
          'metadata.updatedAt': new Date()
        } 
      }
    );

    return await this.getModel(identifier);
  }

  /**
   * Normalise un nom pour créer un namespace
   * @param {string} name - Nom à normaliser
   * @returns {string} Namespace normalisé
   */
  normalizeName(name) {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }
}

module.exports = ModelService;

