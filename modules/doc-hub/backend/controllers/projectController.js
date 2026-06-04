const ProjectService = require('../services/ProjectService');

function parseIntQuery(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function list(req, res) {
  try {
    const limit = parseIntQuery(req.query.limit, 50, 1, 100);
    const skip = parseIntQuery(req.query.skip, 0, 0, 10000);
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = req.query.status || null;

    const result = await ProjectService.list(req.entrepriseDb, { limit, skip, search, status });
    res.json({ success: true, data: result.items, meta: { total: result.total, limit, skip } });
  } catch (error) {
    console.error('Doc-Hub projects list:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getById(req, res) {
  try {
    const project = await ProjectService.getById(req.entrepriseDb, req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Projet introuvable' });
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function create(req, res) {
  try {
    const { title, reference, metadata, metadataCollectionId } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Le titre est requis' });
    }
    const project = await ProjectService.create(
      req.entrepriseDb,
      { title, reference, metadata, metadataCollectionId },
      req.userId
    );
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function update(req, res) {
  try {
    const project = await ProjectService.update(req.entrepriseDb, req.params.id, req.body || {});
    if (!project) return res.status(404).json({ success: false, message: 'Projet introuvable' });
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function remove(req, res) {
  try {
    const ok = await ProjectService.remove(req.entrepriseDb, req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: 'Projet introuvable' });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = { list, getById, create, update, remove };
