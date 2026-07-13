/**
 * Routes API — module data-backup
 * Fichier : modules/data-backup/backend/routes.js
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { authenticateJWT } = require('../../../backend/config/jwt');
const backupModule = require('./index');

function requireAdminGdri(req, res, next) {
  if (req.user && req.user.role === 'ADMIN_GDRI') return next();
  return res.status(403).json({ success: false, message: 'Réservé à l\'administrateur GDRI' });
}

function requireAdminEntity(req, res, next) {
  const role = req.user && req.user.role;
  if (role === 'ADMIN_GDRI' || role === 'ADMIN_ENTITY') return next();
  return res.status(403).json({ success: false, message: 'Accès refusé' });
}

function resolveEntrepriseId(req, { allowOverride = false } = {}) {
  const fromQuery = req.query.entrepriseId || req.query.entityId;
  const fromBody = req.body && (req.body.entrepriseId || req.body.entityId);
  const userEntreprise = req.user.currentEntrepriseId || req.user.entrepriseId;

  if (req.user.role === 'ADMIN_GDRI' && allowOverride) {
    return String(fromBody || fromQuery || userEntreprise || '').trim() || null;
  }
  return String(userEntreprise || '').trim() || null;
}

function getService() {
  return backupModule.getBackupService();
}

router.get('/health', (req, res) => {
  res.json({ success: true, module: 'data-backup', version: '1.0.0' });
});

router.get('/platform/config', authenticateJWT, requireAdminGdri, async (req, res) => {
  try {
    const service = getService();
    const config = await service.getPlatformConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/platform/config', authenticateJWT, requireAdminGdri, async (req, res) => {
  try {
    const service = getService();
    const allowed = ['enabled', 'storagePath', 'defaultRetentionDays', 'defaultSchedule', 'encryptBackups'];
    const patch = {};
    allowed.forEach((key) => {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, key)) {
        patch[key] = req.body[key];
      }
    });
    const config = await service.savePlatformConfig(patch);
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/platform/overview', authenticateJWT, requireAdminGdri, async (req, res) => {
  try {
    const service = getService();
    const overview = await service.getPlatformOverview();
    res.json({ success: true, overview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/entity/config', authenticateJWT, requireAdminEntity, async (req, res) => {
  try {
    const entrepriseId = resolveEntrepriseId(req, { allowOverride: req.user.role === 'ADMIN_GDRI' });
    if (!entrepriseId) {
      return res.status(400).json({ success: false, message: 'Entité non définie' });
    }
    const service = getService();
    const [config, collections] = await Promise.all([
      service.getEntityConfig(entrepriseId),
      service.listEntityCollections(entrepriseId)
    ]);
    res.json({ success: true, config, collections });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/entity/config', authenticateJWT, requireAdminEntity, async (req, res) => {
  try {
    const entrepriseId = resolveEntrepriseId(req, { allowOverride: req.user.role === 'ADMIN_GDRI' });
    if (!entrepriseId) {
      return res.status(400).json({ success: false, message: 'Entité non définie' });
    }
    const service = getService();
    const allowed = ['enabled', 'schedule', 'scope', 'collections', 'retentionDays'];
    const patch = {};
    allowed.forEach((key) => {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, key)) {
        patch[key] = req.body[key];
      }
    });
    const config = await service.saveEntityConfig(entrepriseId, patch);
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/run', authenticateJWT, requireAdminEntity, async (req, res) => {
  try {
    const entrepriseId = resolveEntrepriseId(req, { allowOverride: req.user.role === 'ADMIN_GDRI' });
    if (!entrepriseId) {
      return res.status(400).json({ success: false, message: 'Entité non définie' });
    }
    const service = getService();
    const run = await service.runBackup(entrepriseId, {
      trigger: 'manual',
      requestedBy: req.user.user_id || req.user.email || null
    });
    res.json({ success: true, run });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/runs', authenticateJWT, requireAdminEntity, async (req, res) => {
  try {
    const entrepriseId = resolveEntrepriseId(req, { allowOverride: req.user.role === 'ADMIN_GDRI' });
    if (!entrepriseId && req.user.role !== 'ADMIN_GDRI') {
      return res.status(400).json({ success: false, message: 'Entité non définie' });
    }
    const service = getService();
    const runs = await service.listRuns({
      entrepriseId: entrepriseId || null,
      limit: req.query.limit
    });
    res.json({ success: true, runs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/runs/:id', authenticateJWT, requireAdminEntity, async (req, res) => {
  try {
    const service = getService();
    const run = await service.getRunById(req.params.id);
    if (!run) {
      return res.status(404).json({ success: false, message: 'Sauvegarde introuvable' });
    }
    const entrepriseId = resolveEntrepriseId(req, { allowOverride: false });
    if (req.user.role !== 'ADMIN_GDRI' && String(run.entrepriseId) !== String(entrepriseId)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    await service.deleteRun(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/runs/:id/download', authenticateJWT, requireAdminEntity, async (req, res) => {
  try {
    const service = getService();
    const run = await service.getRunById(req.params.id);
    if (!run) {
      return res.status(404).json({ success: false, message: 'Sauvegarde introuvable' });
    }
    const entrepriseId = resolveEntrepriseId(req, { allowOverride: false });
    if (req.user.role !== 'ADMIN_GDRI' && String(run.entrepriseId) !== String(entrepriseId)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    if (!run.filePath || !fs.existsSync(run.filePath)) {
      return res.status(404).json({ success: false, message: 'Fichier de sauvegarde introuvable sur le serveur' });
    }
    res.download(path.resolve(run.filePath), run.fileName || 'backup.json.gz');
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
