/**
 * FICHIER : modules/annuaire/backend/controllers/organisationsController.js
 */

const listOrganisations = require('../services/organisations/listOrganisations');
const getOrganisationById = require('../services/organisations/getOrganisationById');
const { getCompanyOrganisation } = require('../services/organisations/getCompanyOrganisation');
const createOrganisation = require('../services/organisations/createOrganisation');
const updateOrganisation = require('../services/organisations/updateOrganisation');
const deleteOrganisation = require('../services/organisations/deleteOrganisation');

async function list(req, res) {
  try {
    const data = await listOrganisations(req.entrepriseDb, req.entrepriseId, {
      scope: req.query.scope,
      role: req.query.role,
      search: req.query.q || req.query.search
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getCompany(req, res) {
  try {
    const item = await getCompanyOrganisation(req.entrepriseDb, req.entrepriseId);
    if (!item) return res.status(404).json({ success: false, message: 'Organisation entreprise introuvable' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getById(req, res) {
  try {
    const item = await getOrganisationById(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Organisation introuvable' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function create(req, res) {
  try {
    const item = await createOrganisation(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function update(req, res) {
  try {
    const item = await updateOrganisation(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.json({ success: true, data: item });
  } catch (error) {
    const status = error.message === 'Organisation introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
}

async function remove(req, res) {
  try {
    const deleted = await deleteOrganisation(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Organisation introuvable' });
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = { list, getCompany, getById, create, update, remove };
