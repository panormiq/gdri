/**
 * FICHIER : modules/gderpi/backend/controllers/clientServicesController.js
 */

const listClientServices = require('../services/clientServices/listClientServices');
const getClientServiceById = require('../services/clientServices/getClientServiceById');
const createClientService = require('../services/clientServices/createClientService');
const updateClientService = require('../services/clientServices/updateClientService');
const deleteClientService = require('../services/clientServices/deleteClientService');

async function list(req, res) {
  try {
    const data = await listClientServices(req.entrepriseDb, req.entrepriseId, {
      search: req.query.q || req.query.search,
      actifOnly: req.query.actifOnly === '1' || req.query.actifOnly === 'true'
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI client-services list:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getById(req, res) {
  try {
    const item = await getClientServiceById(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Service introuvable' });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI client-services getById:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function create(req, res) {
  try {
    const item = await createClientService(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI client-services create:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur création service' });
  }
}

async function update(req, res) {
  try {
    const item = await updateClientService(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI client-services update:', error);
    const status = error.message === 'Service introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour' });
  }
}

async function remove(req, res) {
  try {
    const deleted = await deleteClientService(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Service introuvable' });
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('GDERPI client-services delete:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

module.exports = { list, getById, create, update, remove };
