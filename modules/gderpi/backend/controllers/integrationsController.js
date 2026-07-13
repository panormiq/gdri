/**
 * FICHIER : modules/gderpi/backend/controllers/integrationsController.js
 * RÔLE : Handlers HTTP pour les intégrations optionnelles (PM, etc.).
 */

const getPmCompatStatus = require('../integrations/pm-bridge/getPmCompatStatus');
const listPmCardsForLink = require('../integrations/pm-bridge/listPmCardsForLink');
const getPmCardForLink = require('../integrations/pm-bridge/getPmCardForLink');
const getAnnuaireCompatStatus = require('../integrations/annuaire-bridge/getAnnuaireCompatStatus');

async function pmStatus(req, res) {
  try {
    const data = await getPmCompatStatus();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur compatibilité PM' });
  }
}

async function listPmCards(req, res) {
  try {
    const data = await listPmCardsForLink(req.entrepriseDb, req.entrepriseId, {
      search: req.query.q || req.query.search || '',
      unlinkedOnly: req.query.unlinkedOnly !== '0' && req.query.unlinkedOnly !== 'false',
      limit: req.query.limit
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur liste cartes PM' });
  }
}

async function getPmCard(req, res) {
  try {
    const data = await getPmCardForLink(req.entrepriseDb, req.entrepriseId, req.params.cardId);
    if (!data) return res.status(404).json({ success: false, message: 'Carte PM introuvable' });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur carte PM' });
  }
}

async function annuaireStatus(req, res) {
  try {
    const data = await getAnnuaireCompatStatus(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur compatibilité Annuaire' });
  }
}

module.exports = { pmStatus, listPmCards, getPmCard, annuaireStatus };
