/**
 * FICHIER : modules/gderpi/backend/controllers/clientsController.js
 * RÔLE : Handlers HTTP pour les clients.
 *
 * ENTRÉES : req.entrepriseDb, req.entrepriseId
 * SORTIES : réponses JSON
 *
 * DÉPEND DE : services/clients/*
 * NE PAS : logique normalisation inline
 *
 * APPELÉ PAR : routes.js
 */

const listClients = require('../services/clients/listClients');
const getClientById = require('../services/clients/getClientById');
const createClient = require('../services/clients/createClient');
const updateClient = require('../services/clients/updateClient');
const deleteClient = require('../services/clients/deleteClient');
const addClientDocument = require('../services/clients/addClientDocument');
const deleteClientDocument = require('../services/clients/deleteClientDocument');

async function list(req, res) {
  try {
    const data = await listClients(req.entrepriseDb, req.entrepriseId, {
      search: req.query.q || req.query.search,
      lite: req.query.lite === '1' || req.query.summary === '1'
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI clients list:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getById(req, res) {
  try {
    const item = await getClientById(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Client introuvable' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI clients getById:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function create(req, res) {
  try {
    const item = await createClient(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI clients create:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur création client' });
  }
}

async function update(req, res) {
  try {
    const item = await updateClient(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI clients update:', error);
    const status = error.message === 'Client introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour client' });
  }
}

async function remove(req, res) {
  try {
    const deleted = await deleteClient(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Client introuvable' });
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('GDERPI clients delete:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function addDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
    }
    const result = await addClientDocument(req.entrepriseDb, req.entrepriseId, req.params.id, req.file, {
      label: req.body?.label,
      type: req.body?.type
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('GDERPI clients addDocument:', error);
    const status = error.message === 'Client introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur upload document' });
  }
}

async function removeDocument(req, res) {
  try {
    const item = await deleteClientDocument(req.entrepriseDb, req.entrepriseId, req.params.id, req.params.docId);
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI clients removeDocument:', error);
    const status = error.message === 'Client introuvable' || error.message === 'Document introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur suppression document' });
  }
}

module.exports = { list, getById, create, update, remove, addDocument, removeDocument };
