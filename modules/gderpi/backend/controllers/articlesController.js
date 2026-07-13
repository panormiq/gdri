/**
 * FICHIER : modules/gderpi/backend/controllers/articlesController.js
 * RÔLE : Handlers HTTP pour les articles (produits et services).
 *
 * ENTRÉES : req.entrepriseDb, req.entrepriseId
 * SORTIES : réponses JSON
 *
 * DÉPEND DE : services/articles/*
 * NE PAS : logique normalisation inline
 *
 * APPELÉ PAR : routes.js
 */

const listArticles = require('../services/articles/listArticles');
const getArticleById = require('../services/articles/getArticleById');
const createArticle = require('../services/articles/createArticle');
const updateArticle = require('../services/articles/updateArticle');
const deleteArticle = require('../services/articles/deleteArticle');

async function list(req, res) {
  try {
    const data = await listArticles(req.entrepriseDb, req.entrepriseId, {
      nodeId: req.query.nodeId,
      type: req.query.type,
      search: req.query.q || req.query.search,
      actifOnly: req.query.actifOnly === '1' || req.query.actifOnly === 'true'
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI articles list:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getById(req, res) {
  try {
    const item = await getArticleById(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Article introuvable' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI articles getById:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function create(req, res) {
  try {
    const item = await createArticle(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI articles create:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur création article' });
  }
}

async function update(req, res) {
  try {
    const item = await updateArticle(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI articles update:', error);
    const status = error.message === 'Article introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour article' });
  }
}

async function remove(req, res) {
  try {
    const deleted = await deleteArticle(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Article introuvable' });
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('GDERPI articles delete:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

module.exports = { list, getById, create, update, remove };
