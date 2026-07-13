/**
 * FICHIER : modules/gderpi/backend/controllers/unitesController.js
 */

const listUnites = require('../services/unites/listUnites');
const getUniteById = require('../services/unites/getUniteById');
const createUnite = require('../services/unites/createUnite');
const updateUnite = require('../services/unites/updateUnite');
const deleteUnite = require('../services/unites/deleteUnite');

async function list(req, res) {
  try {
    const data = await listUnites(req.entrepriseDb, req.entrepriseId, {
      search: req.query.q || req.query.search,
      actifOnly: req.query.actifOnly === '1' || req.query.actifOnly === 'true'
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI unites list:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getById(req, res) {
  try {
    const item = await getUniteById(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Unité introuvable' });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI unites getById:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function create(req, res) {
  try {
    const item = await createUnite(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI unites create:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur création unité' });
  }
}

async function update(req, res) {
  try {
    const item = await updateUnite(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI unites update:', error);
    const status = error.message === 'Unité introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour' });
  }
}

async function remove(req, res) {
  try {
    const deleted = await deleteUnite(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Unité introuvable' });
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('GDERPI unites delete:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

module.exports = { list, getById, create, update, remove };
