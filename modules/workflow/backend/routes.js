/**
 * Routes API pour le module Workflow
 * Fichier : modules/workflow/backend/routes.js
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const { useWorkflowEntrepriseDb } = require('./middleware/useWorkflowEntrepriseDb');
const { requireWorkflowRole } = require('./middleware/requireWorkflowRole');
const workflowController = require('./controllers/workflowController');

/**
 * GET /api/workflow/health
 * Vérifie l'état du module
 */
router.get('/health', authenticateJWT, useWorkflowEntrepriseDb, (req, res) => {
  res.json({
    success: true,
    message: 'Module Workflow fonctionnel',
    version: '1.0.0'
  });
});

// ========================================
// ROUTES WORKFLOWS
// ========================================

router.get(
  '/workflows',
  authenticateJWT,
  useWorkflowEntrepriseDb,
  requireWorkflowRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  workflowController.list
);

router.get(
  '/workflows/:id',
  authenticateJWT,
  useWorkflowEntrepriseDb,
  requireWorkflowRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  workflowController.getById
);

router.post(
  '/workflows',
  authenticateJWT,
  useWorkflowEntrepriseDb,
  requireWorkflowRole(['ADMIN_ENTITY']),
  workflowController.create
);

router.put(
  '/workflows/:id',
  authenticateJWT,
  useWorkflowEntrepriseDb,
  requireWorkflowRole(['ADMIN_ENTITY']),
  workflowController.update
);

router.delete(
  '/workflows/:id',
  authenticateJWT,
  useWorkflowEntrepriseDb,
  requireWorkflowRole(['ADMIN_ENTITY']),
  workflowController.remove
);

module.exports = router;
