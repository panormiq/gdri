/**
 * FICHIER : modules/doc-hub/backend/controllers/projectController.js
 * RÔLE : Contrôleur des projets Doc-Hub (validation entrée + appel services/projects).
 */

const listProjects = require('../services/projects/listProjects');
const getProjectById = require('../services/projects/getProjectById');
const createProject = require('../services/projects/createProject');
const updateProject = require('../services/projects/updateProject');
const removeProject = require('../services/projects/removeProject');

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

    const result = await listProjects(req.entrepriseDb, { limit, skip, search, status });
    res.json({ success: true, data: result.items, meta: { total: result.total, limit, skip } });
  } catch (error) {
    console.error('Doc-Hub projects list:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getById(req, res) {
  try {
    const project = await getProjectById(req.entrepriseDb, req.params.id);
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
    const project = await createProject(
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
    const project = await updateProject(req.entrepriseDb, req.params.id, req.body || {});
    if (!project) return res.status(404).json({ success: false, message: 'Projet introuvable' });
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function remove(req, res) {
  try {
    const ok = await removeProject(req.entrepriseDb, req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: 'Projet introuvable' });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = { list, getById, create, update, remove };
