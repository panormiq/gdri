/**
 * FICHIER : modules/pm/backend/controllers/boardsController.js
 */

const listBoards = require('../services/boards/listBoards');
const getDefaultBoard = require('../services/boards/getDefaultBoard');

async function list(req, res) {
  try {
    const data = await listBoards(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getDefault(req, res) {
  try {
    const data = await getDefaultBoard(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

module.exports = { list, getDefault };
