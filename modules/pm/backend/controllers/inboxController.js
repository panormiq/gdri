/**
 * FICHIER : modules/pm/backend/controllers/inboxController.js
 */

const pollInboxEmails = require('../services/inbox/pollInboxEmails');
const loadPmMailConfig = require('../services/inbox/loadPmMailConfig');

async function poll(req, res) {
  try {
    const data = await pollInboxEmails(req.entrepriseDb, req.entrepriseId, {
      limit: req.body?.limit || req.query?.limit
    });
    const status = data.success ? 200 : 400;
    res.status(status).json({ success: data.success, data, message: data.message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur polling inbox' });
  }
}

async function mailStatus(req, res) {
  try {
    const mail = await loadPmMailConfig(req.entrepriseId);
    res.json({
      success: true,
      data: {
        configured: Boolean(mail.imap),
        inheritedFrom: mail.inheritedFrom
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur statut mail' });
  }
}

module.exports = { poll, mailStatus };
