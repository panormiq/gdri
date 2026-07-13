/**
 * FICHIER : modules/pm/backend/controllers/cardsController.js
 */

const listCards = require('../services/cards/listCards');
const getCardById = require('../services/cards/getCardById');
const createCard = require('../services/cards/createCard');
const updateCard = require('../services/cards/updateCard');
const moveCard = require('../services/cards/moveCard');

async function list(req, res) {
  try {
    const data = await listCards(req.entrepriseDb, req.entrepriseId, {
      boardId: req.query.boardId,
      columnId: req.query.columnId,
      type: req.query.type,
      search: req.query.q || req.query.search
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getById(req, res) {
  try {
    const item = await getCardById(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Carte introuvable' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function create(req, res) {
  try {
    const item = await createCard(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Erreur création' });
  }
}

async function update(req, res) {
  try {
    const item = await updateCard(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.json({ success: true, data: item });
  } catch (error) {
    const status = error.message === 'Carte introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour' });
  }
}

async function move(req, res) {
  try {
    const columnId = req.body?.columnId || req.body?.column;
    const item = await moveCard(req.entrepriseDb, req.entrepriseId, req.params.id, columnId);
    res.json({ success: true, data: item });
  } catch (error) {
    const status = error.message === 'Carte introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur déplacement' });
  }
}

module.exports = { list, getById, create, update, move };
