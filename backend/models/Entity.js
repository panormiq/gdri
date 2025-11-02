/**
 * Modèle Entity - MongoDB
 * Fichier : backend/models/Entity.js
 * 
 * Représente une entreprise cliente
 */

const { ObjectId } = require('mongodb');
const database = require('../config/database');

class Entity {
  /**
   * Trouve une entité par ID
   * @param {string} id - ID de l'entité
   * @returns {Promise<Object|null>} L'entité ou null
   */
  static async findById(id) {
    const collection = database.getCollection('entities');
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  /**
   * Crée une nouvelle entité
   * @param {Object} entityData - Données de l'entité
   * @returns {Promise<Object>} L'entité créée
   */
  static async create(entityData) {
    const collection = database.getCollection('entities');
    const entity = {
      ...entityData,
      status: entityData.status || 'active',
      services_authorized: entityData.services_authorized || [],
      created_at: new Date(),
      updated_at: new Date()
    };
    const result = await collection.insertOne(entity);
    return await this.findById(result.insertedId);
  }

  /**
   * Trouve toutes les entités
   * @returns {Promise<Array>} Liste des entités
   */
  static async findAll() {
    const collection = database.getCollection('entities');
    return await collection.find({}).toArray();
  }

  /**
   * Trouve une entité par SIRET
   * @param {string} siret - Numéro SIRET
   * @returns {Promise<Object|null>} L'entité ou null
   */
  static async findBySiret(siret) {
    const collection = database.getCollection('entities');
    return await collection.findOne({ siret });
  }

  /**
   * Autorise un service pour une entité
   * @param {string} entityId - ID de l'entité
   * @param {string} serviceId - ID du service
   * @returns {Promise<Object>} L'entité mise à jour
   */
  static async authorizeService(entityId, serviceId) {
    const collection = database.getCollection('entities');
    await collection.updateOne(
      { _id: new ObjectId(entityId) },
      { $addToSet: { services_authorized: new ObjectId(serviceId) } }
    );
    return await this.findById(entityId);
  }

  /**
   * Met à jour une entité
   * @param {string} id - ID de l'entité
   * @param {Object} updateData - Données à mettre à jour
   * @returns {Promise<Object>} L'entité mise à jour
   */
  static async update(id, updateData) {
    const collection = database.getCollection('entities');
    await collection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: {
          ...updateData,
          updated_at: new Date()
        }
      }
    );
    return await this.findById(id);
  }
}

module.exports = Entity;

