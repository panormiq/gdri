/**
 * FICHIER : modules/gderpi/backend/controllers/fournisseursController.js
 * RÔLE : Handlers HTTP pour les fournisseurs.
 *
 * ENTRÉES : req.entrepriseDb, req.entrepriseId
 * SORTIES : réponses JSON
 *
 * DÉPEND DE : services/fournisseurs/*
 * NE PAS : logique normalisation inline
 *
 * APPELÉ PAR : routes.js
 */

const listFournisseurs = require('../services/fournisseurs/listFournisseurs');
const getFournisseurById = require('../services/fournisseurs/getFournisseurById');
const createFournisseur = require('../services/fournisseurs/createFournisseur');
const updateFournisseur = require('../services/fournisseurs/updateFournisseur');
const deleteFournisseur = require('../services/fournisseurs/deleteFournisseur');
const addFournisseurDocument = require('../services/fournisseurs/addFournisseurDocument');
const deleteFournisseurDocument = require('../services/fournisseurs/deleteFournisseurDocument');

async function list(req, res) {
  try {
    const data = await listFournisseurs(req.entrepriseDb, req.entrepriseId, {
      search: req.query.q || req.query.search,
      actifOnly: req.query.actifOnly === '1' || req.query.actifOnly === 'true'
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI fournisseurs list:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getById(req, res) {
  try {
    const item = await getFournisseurById(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Fournisseur introuvable' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI fournisseurs getById:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function create(req, res) {
  try {
    const item = await createFournisseur(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI fournisseurs create:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur création fournisseur' });
  }
}

async function update(req, res) {
  try {
    const item = await updateFournisseur(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI fournisseurs update:', error);
    const status = error.message === 'Fournisseur introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour fournisseur' });
  }
}

async function remove(req, res) {
  try {
    const deleted = await deleteFournisseur(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Fournisseur introuvable' });
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('GDERPI fournisseurs delete:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function addDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
    }
    const result = await addFournisseurDocument(req.entrepriseDb, req.entrepriseId, req.params.id, req.file, {
      label: req.body?.label,
      type: req.body?.type
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('GDERPI fournisseurs addDocument:', error);
    const status = error.message === 'Fournisseur introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur upload document' });
  }
}

async function removeDocument(req, res) {
  try {
    const item = await deleteFournisseurDocument(req.entrepriseDb, req.entrepriseId, req.params.id, req.params.docId);
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI fournisseurs removeDocument:', error);
    const status = error.message === 'Fournisseur introuvable' || error.message === 'Document introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur suppression document' });
  }
}

module.exports = { list, getById, create, update, remove, addDocument, removeDocument };
