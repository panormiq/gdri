/**
 * Routes du module Analyse d'intention
 * Fichier : backend/modules/analyse-intention/routes.js
 */

const express = require('express');
const router = express.Router();

/**
 * Route POST pour analyser un texte
 */
router.post('/api/analyse', async (req, res) => {
  try {
    const { text } = req.body;
    
    // TODO: Implémenter l'analyse d'intention
    res.json({
      success: true,
      result: 'Analyse effectuée (à implémenter)',
      data: { text }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
