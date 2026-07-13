/**
 * FICHIER : modules/annuaire/backend/controllers/integrationsController.js
 */

const importFromGderpi = require('../services/integrations/gderpi/importFromGderpi');
const createGderpiClientFromOrganisation = require('../services/integrations/gderpi/createGderpiClientFromOrganisation');
const createGderpiFournisseurFromOrganisation = require('../services/integrations/gderpi/createGderpiFournisseurFromOrganisation');
const getGderpiCompatStatus = require('../services/integrations/gderpi/getGderpiCompatStatus');

async function gderpiStatus(req, res) {
  try {
    const data = await getGderpiCompatStatus(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function gderpiImport(req, res) {
  try {
    const data = await importFromGderpi(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function gderpiCreateClient(req, res) {
  try {
    const data = await createGderpiClientFromOrganisation(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.organisationId
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function gderpiCreateFournisseur(req, res) {
  try {
    const data = await createGderpiFournisseurFromOrganisation(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.organisationId
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = { gderpiStatus, gderpiImport, gderpiCreateClient, gderpiCreateFournisseur };
