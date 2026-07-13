/**
 * FICHIER : modules/pm/backend/controllers/settingsController.js
 */

const getPmSettings = require('../services/settings/getPmSettings');
const savePmSettings = require('../services/settings/savePmSettings');

async function get(req, res) {
  try {
    const data = await getPmSettings(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur lecture paramètres' });
  }
}

async function save(req, res) {
  try {
    const data = await savePmSettings(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Erreur enregistrement' });
  }
}

module.exports = { get, save };
