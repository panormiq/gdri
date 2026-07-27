/**
 * FICHIER : modules/doc-hub/backend/controllers/diffusionController.js
 * RÔLE : Contrôleur des diffusions (envoi mail + liens, liste, révocation).
 */

const createAndSendDiffusion = require('../services/diffusions/createAndSendDiffusion');
const listDiffusionsByProject = require('../services/diffusions/listDiffusionsByProject');
const revokeDiffusion = require('../services/diffusions/revokeDiffusion');

async function list(req, res) {
  try {
    const items = await listDiffusionsByProject(req.entrepriseDb, req.params.id);
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function create(req, res) {
  try {
    const result = await createAndSendDiffusion(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req.body || {},
      req.userId
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Doc-Hub diffusion:', error);
    res.status(400).json({ success: false, message: error.message });
  }
}

async function revoke(req, res) {
  try {
    const ok = await revokeDiffusion(req.entrepriseDb, req.params.diffusionId);
    if (!ok) return res.status(404).json({ success: false, message: 'Diffusion introuvable' });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = { list, create, revoke };
