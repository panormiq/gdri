/**
 * Routes API pour la gestion des configurations de services
 * Fichier : backend/routes/service-config.js
 */

const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { authenticateJWT } = require('../config/jwt');
const ServiceConfigService = require('../services/ServiceConfigService');

// Service singleton
let serviceConfigService = null;

function getServiceConfigService() {
  if (!serviceConfigService) {
    serviceConfigService = new ServiceConfigService(database);
  }
  return serviceConfigService;
}

/**
 * GET /api/services/unconfigured
 * Récupère la liste des services non configurés pour l'entité de l'utilisateur
 */
router.get('/unconfigured', authenticateJWT, async (req, res) => {
  try {
    const entityId = req.user.entity_id;
    
    if (!entityId) {
      return res.status(400).json({
        success: false,
        message: 'Aucune entité associée à cet utilisateur'
      });
    }

    const service = getServiceConfigService();
    await service.init();
    
    const unconfiguredServices = await service.getUnconfiguredServices(entityId);

    res.json({
      success: true,
      data: unconfiguredServices
    });
  } catch (error) {
    console.error('Erreur route /api/services/unconfigured:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/services/:serviceId/config
 * Sauvegarde la configuration par défaut d'un service
 */
router.post('/:serviceId/config', authenticateJWT, async (req, res) => {
  try {
    const entityId = req.user.entity_id;
    const { serviceId } = req.params;
    const config = req.body;

    if (!entityId) {
      return res.status(400).json({
        success: false,
        message: 'Aucune entité associée à cet utilisateur'
      });
    }

    const service = getServiceConfigService();
    await service.init();
    
    const result = await service.saveServiceConfig(entityId, serviceId, config);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Erreur route POST /api/services/:serviceId/config:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/services/:serviceId/config/later
 * Marque un service comme "configuré plus tard"
 */
router.post('/:serviceId/config/later', authenticateJWT, async (req, res) => {
  try {
    const entityId = req.user.entity_id;
    const { serviceId } = req.params;

    if (!entityId) {
      return res.status(400).json({
        success: false,
        message: 'Aucune entité associée à cet utilisateur'
      });
    }

    const service = getServiceConfigService();
    await service.init();
    
    const result = await service.markAsConfiguredLater(entityId, serviceId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Erreur route POST /api/services/:serviceId/config/later:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;

