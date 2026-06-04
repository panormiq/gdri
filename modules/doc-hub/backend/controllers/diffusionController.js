const DiffusionService = require('../services/DiffusionService');

async function list(req, res) {
  try {
    const items = await DiffusionService.listByProject(req.entrepriseDb, req.params.id);
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function create(req, res) {
  try {
    const result = await DiffusionService.createAndSend(
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
    const ok = await DiffusionService.revoke(req.entrepriseDb, req.params.diffusionId);
    if (!ok) return res.status(404).json({ success: false, message: 'Diffusion introuvable' });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = { list, create, revoke };
