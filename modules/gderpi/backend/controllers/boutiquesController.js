/**
 * FICHIER : modules/gderpi/backend/controllers/boutiquesController.js
 * RÔLE : Handlers HTTP pour les boutiques (paramétrage backoffice).
 *
 * ENTRÉES : req.entrepriseDb, req.entrepriseId
 * SORTIES : réponses JSON
 *
 * DÉPEND DE : services/boutiques/*
 * NE PAS : logique normalisation inline
 *
 * APPELÉ PAR : routes.js
 */

const listBoutiques = require('../services/boutiques/listBoutiques');
const getBoutiqueById = require('../services/boutiques/getBoutiqueById');
const createBoutique = require('../services/boutiques/createBoutique');
const updateBoutique = require('../services/boutiques/updateBoutique');
const deleteBoutique = require('../services/boutiques/deleteBoutique');
const defaultConditionsVenteBlocks = require('../services/boutiques/defaultConditionsVenteBlocks');

async function list(req, res) {
  try {
    const data = await listBoutiques(req.entrepriseDb, req.entrepriseId, {
      search: req.query.q || req.query.search,
      actifOnly: req.query.actifOnly === '1' || req.query.actifOnly === 'true'
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI boutiques list:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getById(req, res) {
  try {
    const item = await getBoutiqueById(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Boutique introuvable' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI boutiques getById:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function create(req, res) {
  try {
    const item = await createBoutique(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI boutiques create:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur création boutique' });
  }
}

async function update(req, res) {
  try {
    const item = await updateBoutique(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI boutiques update:', error);
    const status = error.message === 'Boutique introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour boutique' });
  }
}

async function getConditionsTemplates(req, res) {
  try {
    res.json({ success: true, data: defaultConditionsVenteBlocks() });
  } catch (error) {
    console.error('GDERPI boutiques getConditionsTemplates:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function remove(req, res) {
  try {
    const deleted = await deleteBoutique(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Boutique introuvable' });
    }
    res.json({ success: true, data: { deleted: true, actif: false } });
  } catch (error) {
    console.error('GDERPI boutiques delete:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

module.exports = { list, getById, create, update, remove, getConditionsTemplates };
