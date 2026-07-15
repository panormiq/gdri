/**
 * FICHIER : modules/annuaire/backend/controllers/membersController.js
 */

const listEntityMembers = require('../services/members/listEntityMembers');

async function list(req, res) {
  try {
    const data = await listEntityMembers(req.entrepriseId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { list };
