/**
 * Controller Workflow
 * Fichier : backend/modules/workflow/controllers/workflowController.js
 */

const WorkflowService = require('../services/WorkflowService');

function parseNumber(value, fallback, { min, max } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (min !== undefined && parsed < min) return min;
  if (max !== undefined && parsed > max) return max;
  return parsed;
}

function isValidName(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

async function list(req, res) {
  try {
    const limit = parseNumber(req.query.limit, 50, { min: 1, max: 100 });
    const skip = parseNumber(req.query.skip, 0, { min: 0 });
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const result = await WorkflowService.listWorkflows(req.entrepriseDb, {
      limit,
      skip,
      search
    });

    res.json({
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        limit,
        skip
      }
    });
  } catch (error) {
    console.error('Erreur Workflow list:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
}

async function getById(req, res) {
  try {
    const workflow = await WorkflowService.getWorkflowById(req.entrepriseDb, req.params.id);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow introuvable'
      });
    }

    res.json({ success: true, data: workflow });
  } catch (error) {
    console.error('Erreur Workflow getById:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'ID workflow invalide'
    });
  }
}

async function create(req, res) {
  try {
    const { name, description, status, tags, payload, metadata } = req.body || {};

    if (!isValidName(name)) {
      return res.status(400).json({
        success: false,
        message: 'Le champ name est requis'
      });
    }

    const workflow = await WorkflowService.createWorkflow(
      req.entrepriseDb,
      { name: name.trim(), description, status, tags, payload, metadata },
      req.user,
      req.entrepriseId
    );

    res.status(201).json({
      success: true,
      message: 'Workflow créé',
      data: workflow
    });
  } catch (error) {
    console.error('Erreur Workflow create:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
}

async function update(req, res) {
  try {
    const { name, description, status, tags, payload, metadata } = req.body || {};
    if (name !== undefined && !isValidName(name)) {
      return res.status(400).json({
        success: false,
        message: 'Le champ name ne peut pas être vide'
      });
    }

    const workflow = await WorkflowService.updateWorkflow(
      req.entrepriseDb,
      req.params.id,
      { name: name?.trim(), description, status, tags, payload, metadata },
      req.user
    );

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow introuvable'
      });
    }

    res.json({
      success: true,
      message: 'Workflow mis à jour',
      data: workflow
    });
  } catch (error) {
    console.error('Erreur Workflow update:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'ID workflow invalide'
    });
  }
}

async function remove(req, res) {
  try {
    const deleted = await WorkflowService.deleteWorkflow(req.entrepriseDb, req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Workflow introuvable'
      });
    }

    res.json({
      success: true,
      message: 'Workflow supprimé'
    });
  } catch (error) {
    console.error('Erreur Workflow remove:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'ID workflow invalide'
    });
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove
};
