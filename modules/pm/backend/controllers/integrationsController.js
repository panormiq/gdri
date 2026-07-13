/**
 * FICHIER : modules/pm/backend/controllers/integrationsController.js
 */

const linkCardToDevis = require('../services/integrations/gderpi/linkCardToDevis');
const createDevisFromCard = require('../services/integrations/gderpi/createDevisFromCard');
const syncCardFromDevis = require('../services/integrations/gderpi/syncCardFromDevis');
const syncCardFromCommande = require('../services/integrations/gderpi/syncCardFromCommande');
const getGderpiCompatStatus = require('../services/integrations/gderpi/getGderpiCompatStatus');
const listGderpiDevisForLink = require('../services/integrations/gderpi/listGderpiDevisForLink');
const listGderpiBoutiques = require('../services/integrations/gderpi/listGderpiBoutiques');
const getAnnuaireCompatStatus = require('../services/integrations/annuaire/getAnnuaireCompatStatus');
const isGderpiAvailable = require('../services/integrations/isGderpiAvailable');
const path = require('path');

async function gderpiStatus(req, res) {
  try {
    const data = await getGderpiCompatStatus(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur compatibilité' });
  }
}

async function linkDevis(req, res) {
  try {
    const devisId = req.body?.devisId || req.body?.id;
    const data = await linkCardToDevis(req.entrepriseDb, req.entrepriseId, req.params.id, devisId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Erreur liaison devis' });
  }
}

async function createDevis(req, res) {
  try {
    const data = await createDevisFromCard(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Erreur création devis' });
  }
}

async function syncDevis(req, res) {
  try {
    if (!isGderpiAvailable()) {
      return res.status(400).json({ success: false, message: 'GDERPI non installé' });
    }
    const getDevisById = require(path.join(
      __dirname,
      '../../../gderpi/backend/services/devis/getDevisById.js'
    ));
    const devis = await getDevisById(req.entrepriseDb, req.entrepriseId, req.params.devisId);
    if (!devis) return res.status(404).json({ success: false, message: 'Devis introuvable' });
    const data = await syncCardFromDevis(req.entrepriseDb, req.entrepriseId, devis, {
      cardId: req.body?.cardId || req.params.id
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Erreur sync devis' });
  }
}

async function syncCommande(req, res) {
  try {
    if (!isGderpiAvailable()) {
      return res.status(400).json({ success: false, message: 'GDERPI non installé' });
    }
    const getCommandeClientById = require(path.join(
      __dirname,
      '../../../gderpi/backend/services/commande-client/getCommandeClientById.js'
    ));
    const commande = await getCommandeClientById(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.commandeId
    );
    if (!commande) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    const data = await syncCardFromCommande(
      req.entrepriseDb,
      req.entrepriseId,
      commande,
      req.body?.cardId || req.params.id
    );
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Erreur sync commande' });
  }
}

async function listGderpiDevis(req, res) {
  try {
    const data = await listGderpiDevisForLink(req.entrepriseDb, req.entrepriseId, {
      search: req.query.q || req.query.search || '',
      unlinkedOnly: req.query.unlinkedOnly !== '0' && req.query.unlinkedOnly !== 'false',
      limit: req.query.limit
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur liste devis GDERPI' });
  }
}

async function gderpiBoutiques(req, res) {
  try {
    const data = await listGderpiBoutiques(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur liste boutiques GDERPI' });
  }
}

async function annuaireStatus(req, res) {
  try {
    const data = await getAnnuaireCompatStatus(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur compatibilité annuaire' });
  }
}

module.exports = {
  gderpiStatus,
  listGderpiDevis,
  gderpiBoutiques,
  annuaireStatus,
  linkDevis,
  createDevis,
  syncDevis,
  syncCommande
};
