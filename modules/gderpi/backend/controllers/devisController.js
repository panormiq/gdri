/**
 * FICHIER : modules/gderpi/backend/controllers/devisController.js
 * RÔLE : Handlers HTTP pour les devis.
 *
 * ENTRÉES : req.entrepriseDb, req.entrepriseId
 * SORTIES : réponses JSON
 *
 * DÉPEND DE : services/devis/*
 * NE PAS : logique métier inline
 *
 * APPELÉ PAR : routes.js
 */

const listDevis = require('../services/devis/listDevis');
const getDevisById = require('../services/devis/getDevisById');
const createDevis = require('../services/devis/createDevis');
const updateDevis = require('../services/devis/updateDevis');
const changeDevisStatus = require('../services/devis/changeDevisStatus');
const getDevisHtml = require('../services/devis/getDevisHtml');
const deleteDevis = require('../services/devis/deleteDevis');
const generateDevisPdf = require('../services/devis/generateDevisPdf');
const sendDevisToClient = require('../services/devis/sendDevisToClient');
const linkDevisPmCard = require('../services/devis/linkDevisPmCard');
const ensureDevisPmCard = require('../services/devis/ensureDevisPmCard');

async function list(req, res) {
  try {
    const data = await listDevis(req.entrepriseDb, req.entrepriseId, {
      boutiqueId: req.query.boutiqueId,
      statut: req.query.statut,
      search: req.query.q || req.query.search
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI devis list:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getById(req, res) {
  try {
    const item = await getDevisById(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Devis introuvable' });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI devis getById:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function create(req, res) {
  try {
    const item = await createDevis(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI devis create:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur création devis' });
  }
}

async function update(req, res) {
  try {
    const item = await updateDevis(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI devis update:', error);
    const status = error.message === 'Devis introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour devis' });
  }
}

async function changeStatus(req, res) {
  try {
    const statut = req.body?.statut || req.body?.status;
    const item = await changeDevisStatus(req.entrepriseDb, req.entrepriseId, req.params.id, statut);
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI devis changeStatus:', error);
    const status = error.message === 'Devis introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur changement statut' });
  }
}

async function renderHtml(req, res) {
  try {
    const html = await getDevisHtml(req.entrepriseDb, req.entrepriseId, req.params.id, req);
    res.json({ success: true, data: { html } });
  } catch (error) {
    console.error('GDERPI devis renderHtml:', error);
    const status = error.message === 'Devis introuvable' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message || 'Erreur génération HTML' });
  }
}

async function downloadPdf(req, res) {
  try {
    const inline = String(req.query.disposition || '').trim().toLowerCase() === 'inline';
    const { buffer, filename, contentType } = await generateDevisPdf(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req
    );
    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${filename}"`
    );
    res.send(buffer);
  } catch (error) {
    console.error('GDERPI devis downloadPdf:', error);
    const status = error.message === 'Devis introuvable' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message || 'Erreur génération PDF' });
  }
}

async function remove(req, res) {
  try {
    const deleted = await deleteDevis(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Devis introuvable' });
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('GDERPI devis delete:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur suppression' });
  }
}

async function sendToClient(req, res) {
  try {
    const data = await sendDevisToClient(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req.body || {},
      req
    );
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI devis sendToClient:', error);
    const status = error.message === 'Devis introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur envoi devis' });
  }
}

async function linkPmCard(req, res) {
  try {
    const pmCardId = req.body?.pmCardId || req.body?.cardId || null;
    const item = await linkDevisPmCard(req.entrepriseDb, req.entrepriseId, req.params.id, pmCardId);
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI devis linkPmCard:', error);
    const status = error.message === 'Devis introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur liaison PM' });
  }
}

async function ensurePmCard(req, res) {
  try {
    const item = await ensureDevisPmCard(req.entrepriseDb, req.entrepriseId, req.params.id);
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI devis ensurePmCard:', error);
    const status = error.message === 'Devis introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur création carte PM' });
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  changeStatus,
  renderHtml,
  downloadPdf,
  remove,
  sendToClient,
  linkPmCard,
  ensurePmCard
};
