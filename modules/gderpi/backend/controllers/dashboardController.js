/**
 * FICHIER : modules/gderpi/backend/controllers/dashboardController.js
 * RÔLE : Handler HTTP tableau de bord GDERPI.
 *
 * ENTRÉES : req.entrepriseDb, req.entrepriseId
 * SORTIES : JSON dashboard
 *
 * DÉPEND DE : buildDashboardSummary.js
 * NE PAS : logique inline
 *
 * APPELÉ PAR : routes.js
 */

const buildDashboardSummary = require('../services/dashboard/buildDashboardSummary');

async function getSummary(req, res) {
  try {
    const data = await buildDashboardSummary(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI dashboard:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

module.exports = { getSummary };
