/**
 * FICHIER : modules/doc-hub/backend/controllers/slotController.js
 * RÔLE : Contrôleur des types de pièces (slot templates).
 */

const listSlotTemplates = require('../services/slots/listSlotTemplates');

async function list(req, res) {
  try {
    const slots = await listSlotTemplates(req.entrepriseDb);
    res.json({ success: true, data: slots });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { list };
