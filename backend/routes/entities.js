/**
 * Routes API pour la gestion des entités
 * Fichier : backend/routes/entities.js
 */

const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { authenticateJWT } = require('../config/jwt');
const Entity = require('../models/Entity');
const { ObjectId } = require('mongodb');

/**
 * PUT /api/entities/:entityId/services
 * Met à jour les services autorisés d'une entité
 */
router.put('/:entityId/services', authenticateJWT, async (req, res) => {
  try {
    const { entityId } = req.params;
    const { services_authorized } = req.body;

    // Vérifier que l'utilisateur est ADMIN_GDRI
    if (req.user.role !== 'ADMIN_GDRI') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs GDRI peuvent modifier les entités.'
      });
    }

    // Valider les IDs de services
    if (!Array.isArray(services_authorized)) {
      return res.status(400).json({
        success: false,
        message: 'services_authorized doit être un tableau'
      });
    }

    // Convertir les IDs en ObjectId
    const serviceIds = services_authorized
      .filter(id => id && id.trim() !== '')
      .map(id => new ObjectId(id));

    // Mettre à jour l'entité
    const entity = await Entity.update(entityId, {
      services_authorized: serviceIds
    });

    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entité non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Modules mis à jour avec succès',
      data: entity
    });

  } catch (error) {
    console.error('Erreur route PUT /api/entities/:entityId/services:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * POST /api/entities
 * Crée une nouvelle entité
 */
router.post('/', authenticateJWT, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est ADMIN_GDRI
    if (req.user.role !== 'ADMIN_GDRI') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs GDRI peuvent créer des entités.'
      });
    }

    const { name, siret, address, services_authorized } = req.body;

    // Validation
    if (!name || !siret || !address) {
      return res.status(400).json({
        success: false,
        message: 'Les champs name, siret et address sont requis'
      });
    }

    // Convertir les IDs de services en ObjectId
    const serviceIds = (services_authorized || [])
      .filter(id => id && id.trim() !== '')
      .map(id => new ObjectId(id));

    // Créer l'entité
    const entity = await Entity.create({
      name,
      siret,
      address,
      services_authorized: serviceIds
    });

    res.json({
      success: true,
      message: 'Entité créée avec succès',
      data: entity
    });

  } catch (error) {
    console.error('Erreur route POST /api/entities:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * GET /api/entities
 * Récupère toutes les entités
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est ADMIN_GDRI
    if (req.user.role !== 'ADMIN_GDRI') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    const entities = await Entity.findAll();

    res.json({
      success: true,
      data: entities
    });

  } catch (error) {
    console.error('Erreur route GET /api/entities:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * GET /api/entities/:entityId
 * Récupère une entité par ID
 */
router.get('/:entityId', authenticateJWT, async (req, res) => {
  try {
    const { entityId } = req.params;

    const entity = await Entity.findById(entityId);

    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entité non trouvée'
      });
    }

    res.json({
      success: true,
      data: entity
    });

  } catch (error) {
    console.error('Erreur route GET /api/entities/:entityId:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

module.exports = router;

