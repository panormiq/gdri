/**
 * FICHIER : modules/annuaire/backend/controllers/servicesController.js
 */

const listServices = require('../services/services/listServices');
const createService = require('../services/services/createService');
const updateService = require('../services/services/updateService');
const deleteService = require('../services/services/deleteService');

async function list(req, res) {
  try {
    const data = await listServices(req.entrepriseDb, req.entrepriseId, {
      organisationId: req.query.organisationId,
      search: req.query.q || req.query.search
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function create(req, res) {
  try {
    const item = await createService(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function update(req, res) {
  try {
    const item = await updateService(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.json({ success: true, data: item });
  } catch (error) {
    const status = error.message === 'Service introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
}

async function remove(req, res) {
  try {
    const deleted = await deleteService(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Service introuvable' });
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = { list, create, update, remove };
