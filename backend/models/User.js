/**
 * Modèle User - MongoDB
 * Fichier : backend/models/User.js
 * 
 * Rôles : ADMIN_GDRI, ADMIN_ENTITY, USER_ENTITY
 */

const { ObjectId } = require('mongodb');
const database = require('../config/database');

class User {
  /**
   * Trouve un utilisateur par email
   * @param {string} email - Email de l'utilisateur
   * @returns {Promise<Object|null>} L'utilisateur ou null
   */
  static async findByEmail(email) {
    const collection = database.getCollection('users');
    return await collection.findOne({ email });
  }

  /**
   * Trouve un utilisateur par ID
   * @param {string} id - ID de l'utilisateur
   * @returns {Promise<Object|null>} L'utilisateur ou null
   */
  static async findById(id) {
    const collection = database.getCollection('users');
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  /**
   * Crée un nouvel utilisateur
   * @param {Object} userData - Données de l'utilisateur
   * @returns {Promise<Object>} L'utilisateur créé
   */
  static async create(userData) {
    const collection = database.getCollection('users');
    const user = {
      ...userData,
      created_at: new Date(),
      updated_at: new Date()
    };
    const result = await collection.insertOne(user);
    return await this.findById(result.insertedId);
  }

  /**
   * Met à jour un utilisateur
   * @param {string} id - ID de l'utilisateur
   * @param {Object} updateData - Données à mettre à jour
   * @returns {Promise<Object>} L'utilisateur mis à jour
   */
  static async update(id, updateData) {
    const collection = database.getCollection('users');
    const updated = {
      ...updateData,
      updated_at: new Date()
    };
    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updated }
    );
    return await this.findById(id);
  }

  /**
   * Trouve tous les utilisateurs d'une entité
   * @param {string} entityId - ID de l'entité
   * @returns {Promise<Array>} Liste des utilisateurs
   */
  static async findByEntity(entityId) {
    const collection = database.getCollection('users');
    return await collection.find({ entity_id: new ObjectId(entityId) }).toArray();
  }

  /**
   * Vérifie les permissions d'un utilisateur
   * @param {Object} user - L'utilisateur
   * @param {string} requiredRole - Rôle requis
   * @returns {boolean} True si l'utilisateur a les permissions
   */
  static hasPermission(user, requiredRole) {
    // ADMIN_GDRI a tous les droits
    if (user.role === 'ADMIN_GDRI') return true;
    
    // ADMIN_ENTITY peut gérer son entité
    if (requiredRole === 'ADMIN_ENTITY' && user.role === 'ADMIN_ENTITY') return true;
    
    // USER_ENTITY accès limité
    if (requiredRole === 'USER_ENTITY' && user.role === 'USER_ENTITY') return true;
    
    return false;
  }
}

module.exports = User;

