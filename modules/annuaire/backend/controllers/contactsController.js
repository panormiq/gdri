/**
 * FICHIER : modules/annuaire/backend/controllers/contactsController.js
 */

const listContacts = require('../services/contacts/listContacts');
const getContactById = require('../services/contacts/getContactById');
const findContactByEmail = require('../services/contacts/findContactByEmail');
const createContact = require('../services/contacts/createContact');
const updateContact = require('../services/contacts/updateContact');
const deleteContact = require('../services/contacts/deleteContact');
const createContactFromEmail = require('../services/contacts/createContactFromEmail');

async function list(req, res) {
  try {
    const data = await listContacts(req.entrepriseDb, req.entrepriseId, {
      organisationId: req.query.organisationId,
      scope: req.query.scope,
      serviceId: req.query.serviceId,
      ownerUserId: req.query.ownerUserId,
      search: req.query.q || req.query.search
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getById(req, res) {
  try {
    const item = await getContactById(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Contact introuvable' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function findByEmail(req, res) {
  try {
    const email = req.query.email || req.query.q;
    const item = await findContactByEmail(req.entrepriseDb, req.entrepriseId, email);
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function create(req, res) {
  try {
    const actorUserId = req.user?.id || req.user?._id || req.user?.userId || null;
    const item = await createContact(req.entrepriseDb, req.entrepriseId, req.body || {}, { actorUserId });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function createFromEmail(req, res) {
  try {
    const actorUserId = req.user?.id || req.user?._id || req.user?.userId || null;
    const data = await createContactFromEmail(req.entrepriseDb, req.entrepriseId, req.body || {}, { actorUserId });
    res.status(data.created ? 201 : 200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function update(req, res) {
  try {
    const item = await updateContact(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.json({ success: true, data: item });
  } catch (error) {
    const status = error.message === 'Contact introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
}

async function remove(req, res) {
  try {
    const deleted = await deleteContact(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Contact introuvable' });
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = { list, getById, findByEmail, create, createFromEmail, update, remove };
