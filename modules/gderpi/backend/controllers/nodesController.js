/**
 * FICHIER : modules/gderpi/backend/controllers/nodesController.js
 * RÔLE : Handlers HTTP pour les nœuds catalogue (catégories).
 *
 * ENTRÉES : req.entrepriseDb, req.entrepriseId
 * SORTIES : réponses JSON
 *
 * DÉPEND DE : services/nodes/*
 * NE PAS : logique normalisation inline
 *
 * APPELÉ PAR : routes.js
 */

const listNodes = require('../services/nodes/listNodes');
const createNode = require('../services/nodes/createNode');
const updateNode = require('../services/nodes/updateNode');
const deleteNode = require('../services/nodes/deleteNode');
const reorderNodes = require('../services/nodes/reorderNodes');
const buildNodesTree = require('../services/nodes/buildNodesTree');

async function list(req, res) {
  try {
    const data = await listNodes(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI nodes list:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function create(req, res) {
  try {
    const result = await createNode(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.status(201).json({
      success: true,
      data: {
        node: result.node,
        tree: buildNodesTree(result.state.nodes)
      }
    });
  } catch (error) {
    console.error('GDERPI nodes create:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur création nœud' });
  }
}

async function update(req, res) {
  try {
    const result = await updateNode(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.json({
      success: true,
      data: {
        node: result.node,
        tree: buildNodesTree(result.state.nodes)
      }
    });
  } catch (error) {
    console.error('GDERPI nodes update:', error);
    const status = error.message === 'Nœud introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour nœud' });
  }
}

async function remove(req, res) {
  try {
    const result = await deleteNode(req.entrepriseDb, req.entrepriseId, req.params.id);
    res.json({
      success: true,
      data: { tree: buildNodesTree(result.state.nodes) }
    });
  } catch (error) {
    console.error('GDERPI nodes delete:', error);
    const status = error.message === 'Nœud introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur suppression nœud' });
  }
}

async function reorder(req, res) {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const state = await reorderNodes(req.entrepriseDb, req.entrepriseId, items);
    res.json({
      success: true,
      data: { tree: buildNodesTree(state.nodes) }
    });
  } catch (error) {
    console.error('GDERPI nodes reorder:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur réordonnancement' });
  }
}

module.exports = { list, create, update, remove, reorder };
