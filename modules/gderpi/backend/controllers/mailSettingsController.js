/**
 * FICHIER : modules/gderpi/backend/controllers/mailSettingsController.js
 * RÔLE : Paramètres e-mail devis GDERPI.
 */

const getDevisMailSettings = require('../services/mail/getDevisMailSettings');
const saveDevisMailSettings = require('../services/mail/saveDevisMailSettings');
const getGderpiMailAccounts = require('../services/mail/getGderpiMailAccounts');
const saveGderpiMailAccountMappings = require('../services/mail/saveGderpiMailAccountMappings');
const resolveGderpiSendRecipient = require('../services/mail/resolveGderpiSendRecipient');
const searchMailContacts = require('../services/mail/searchMailContacts');
const previewGderpiMailTemplate = require('../services/mail/previewGderpiMailTemplate');

async function get(req, res) {
  try {
    const data = await getDevisMailSettings(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI mail settings get:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function save(req, res) {
  try {
    const data = await saveDevisMailSettings(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI mail settings save:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur enregistrement' });
  }
}

async function getAccounts(req, res) {
  try {
    const data = await getGderpiMailAccounts(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI mail accounts get:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function saveAccounts(req, res) {
  try {
    const data = await saveGderpiMailAccountMappings(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI mail accounts save:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur enregistrement' });
  }
}

async function getSendRecipient(req, res) {
  const type = req.query.type;
  const id = req.query.id;
  try {
    const data = await resolveGderpiSendRecipient(
      req.entrepriseDb,
      req.entrepriseId,
      { type, id },
      req
    );
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI mail send recipient:', {
      type,
      id,
      entrepriseId: req.entrepriseId,
      message: error.message
    });
    const status = /introuvable/i.test(error.message) ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function searchContacts(req, res) {
  try {
    const data = await searchMailContacts(req.entrepriseDb, req.entrepriseId, {
      q: req.query.q || req.query.search || '',
      limit: req.query.limit
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI mail contacts search:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function preview(req, res) {
  try {
    const data = previewGderpiMailTemplate(req.body || {});
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI mail settings preview:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur aperçu' });
  }
}

module.exports = { get, save, getAccounts, saveAccounts, getSendRecipient, searchContacts, preview };
