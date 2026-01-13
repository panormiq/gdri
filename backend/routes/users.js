/**
 * Routes API pour la gestion des utilisateurs
 * Fichier : backend/routes/users.js
 */

const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { authenticateJWT } = require('../config/jwt');
const Entity = require('../models/Entity');
const { ObjectId } = require('mongodb');

/**
 * GET /api/users/available
 * Récupère la liste des utilisateurs disponibles (pas déjà dans l'entité spécifiée)
 */
router.get('/available', authenticateJWT, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est ADMIN_GDRI ou ADMIN_ENTITY
    if (req.user.role !== 'ADMIN_GDRI' && req.user.role !== 'ADMIN_ENTITY') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    const { entityId } = req.query;
    
    const db = await database.connect();
    const usersCollection = db.collection('users');

    console.log('🔍 GET /api/users/available - entityId:', entityId);
    
    // D'abord, récupérer TOUS les utilisateurs pour voir ce qu'on a
    const allUsers = await usersCollection.find({}).toArray();
    console.log('📦 Total utilisateurs dans la base:', allUsers.length);
    
    // Afficher la structure des premiers utilisateurs pour debug
    if (allUsers.length > 0) {
      console.log('📋 Structure du premier utilisateur:', JSON.stringify({
        _id: allUsers[0]._id.toString(),
        email: allUsers[0].email,
        entreprises: allUsers[0].entreprises,
        entity_id: allUsers[0].entity_id ? allUsers[0].entity_id.toString() : null,
        currentEntrepriseId: allUsers[0].currentEntrepriseId ? allUsers[0].currentEntrepriseId.toString() : null
      }, null, 2));
    } else {
      console.warn('⚠️ Aucun utilisateur trouvé dans la base de données');
    }

    // Filtrer manuellement : exclure ceux qui sont déjà dans cette entité
    let filteredUsers = allUsers;
    
    if (entityId) {
      console.log('🔍 Filtrage pour entityId:', entityId);
      
      filteredUsers = allUsers.filter(user => {
        // Utilisateurs qui n'ont pas de entreprises ou entreprises vide -> disponibles
        const entreprises = user.entreprises || [];
        if (!entreprises || entreprises.length === 0) {
          console.log('✅ Utilisateur disponible (pas d\'entreprises):', user.email);
          return true;
        }
        
        // Vérifier si l'utilisateur a cette entité dans son tableau entreprises
        const hasEntity = entreprises.some(e => {
          if (!e || !e.entrepriseId) return false;
          
          // Convertir en string pour comparaison
          const eId = typeof e.entrepriseId === 'string' 
            ? e.entrepriseId 
            : e.entrepriseId.toString();
          const entityIdStr = typeof entityId === 'string' 
            ? entityId 
            : entityId.toString();
          
          const match = eId === entityIdStr;
          if (match) {
            console.log('⚠️ Utilisateur exclu (déjà dans l\'entité):', user.email, 'eId:', eId, 'entityId:', entityIdStr);
          }
          return match;
        });
        
        return !hasEntity;
      });
      
      console.log('✅ Utilisateurs après filtrage:', filteredUsers.length, 'sur', allUsers.length);
    } else {
      console.log('ℹ️ Pas de entityId fourni, retour de tous les utilisateurs');
    }

    // Formater la réponse (sans le mot de passe)
    const formattedUsers = filteredUsers.map(user => ({
      _id: user._id,
      email: user.email,
      username: user.username || null,
      role: user.role || 'USER_ENTITY',
      status: user.status || 'active'
    }));

    res.json({
      success: true,
      data: formattedUsers
    });

  } catch (error) {
    console.error('Erreur route GET /api/users/available:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * GET /api/users/me/entreprises
 * Récupère les entreprises de l'utilisateur connecté avec vérification
 */
router.get('/me/entreprises', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const db = await database.connect();
    const usersCollection = db.collection('users');
    const entitiesCollection = db.collection('entities');
    
    // Récupérer l'utilisateur
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    // Récupérer les entreprises de l'utilisateur
    const userEntreprises = user.entreprises || [];
    const currentEntrepriseId = user.currentEntrepriseId 
      ? user.currentEntrepriseId.toString() 
      : null;
    
    // Vérifier chaque entreprise et récupérer ses infos
    const entreprisesValides = [];
    
    for (const userEntreprise of userEntreprises) {
      const entrepriseId = userEntreprise.entrepriseId 
        ? (typeof userEntreprise.entrepriseId === 'string' 
            ? userEntreprise.entrepriseId 
            : userEntreprise.entrepriseId.toString())
        : null;
      
      if (!entrepriseId) continue;
      
      // Vérifier que l'entreprise existe et est active
      const entreprise = await entitiesCollection.findOne({ 
        _id: new ObjectId(entrepriseId),
        status: 'active' // Uniquement les entreprises actives
      });
      
      if (entreprise) {
        entreprisesValides.push({
          _id: entreprise._id.toString(),
          name: entreprise.name,
          siret: entreprise.siret,
          logo: entreprise.logo || null, // Logo de l'entreprise
          address: entreprise.address,
          role: userEntreprise.role, // Rôle de l'utilisateur dans cette entreprise
          joinedAt: userEntreprise.joinedAt,
          isCurrent: entrepriseId === currentEntrepriseId
        });
      } else {
        console.warn(`⚠️ Entreprise ${entrepriseId} non trouvée ou inactive pour l'utilisateur ${userId}`);
      }
    }
    
    res.json({
      success: true,
      data: entreprisesValides,
      currentEntrepriseId: currentEntrepriseId
    });
    
  } catch (error) {
    console.error('Erreur route GET /api/users/me/entreprises:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * PUT /api/users/me/current-entreprise
 * Change l'entreprise active de l'utilisateur
 */
router.put('/me/current-entreprise', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { entrepriseId } = req.body;
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId est requis'
      });
    }
    
    const db = await database.connect();
    const usersCollection = db.collection('users');
    
    // Récupérer l'utilisateur
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    // Vérifier que l'entreprise est dans la liste des entreprises de l'utilisateur
    const userEntreprises = user.entreprises || [];
    const entrepriseIdStr = typeof entrepriseId === 'string' ? entrepriseId : entrepriseId.toString();
    
    const hasEntreprise = userEntreprises.some(e => {
      const eId = e.entrepriseId 
        ? (typeof e.entrepriseId === 'string' ? e.entrepriseId : e.entrepriseId.toString())
        : null;
      return eId === entrepriseIdStr;
    });
    
    if (!hasEntreprise) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas accès à cette entreprise'
      });
    }
    
    // Vérifier que l'entreprise existe et est active
    const entitiesCollection = db.collection('entities');
    const entreprise = await entitiesCollection.findOne({
      _id: new ObjectId(entrepriseId),
      status: 'active'
    });
    
    if (!entreprise) {
      return res.status(404).json({
        success: false,
        message: 'Entreprise non trouvée ou inactive'
      });
    }
    
    // Mettre à jour currentEntrepriseId dans MongoDB
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          currentEntrepriseId: new ObjectId(entrepriseId),
          updated_at: new Date()
        }
      }
    );
    
    // ⚠️ NOTE : La session PHP sera mise à jour lors du prochain rechargement de page
    // car le JWT sera régénéré avec le nouveau currentEntrepriseId depuis MongoDB
    
    res.json({
      success: true,
      message: 'Entreprise active mise à jour',
      data: {
        currentEntrepriseId: entrepriseId,
        entreprise: {
          _id: entreprise._id.toString(),
          name: entreprise.name,
          logo: entreprise.logo || null
        }
      }
    });
    
  } catch (error) {
    console.error('Erreur route PUT /api/users/me/current-entreprise:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

module.exports = router;
