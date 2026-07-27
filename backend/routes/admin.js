/**
 * Routes admin : rechargement modules, sync services, deploiement TEST console.
 * Réservé aux ADMIN_GDRI. PROD = scripts locaux uniquement.
 * Fichier : backend/routes/admin.js
 */

const express = require('express');
const path = require('path');
const { spawn, execFile } = require('child_process');
const moduleRegistry = require('../core/module-registry');
const { loadNewModules } = require('../core/module-loader');
const { syncServicesCatalogFromModules } = require('../core/services-catalog-sync');
const { authenticateJWT } = require('../config/jwt');

const projectRoot = path.resolve(__dirname, '../..');
const updateScriptPath = path.join(projectRoot, 'demarrage', 'Update-From-Git.ps1');

let deployState = {
  running: false,
  action: null,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  log: '',
  triggeredBy: null,
  error: null
};

function getDeployState() {
  return { ...deployState };
}

function runGit(args) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd: projectRoot, windowsHide: true }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim(),
        error: err ? (err.message || String(err)) : null
      });
    });
  });
}

async function readGitStatus() {
  const [branch, head, status, remote] = await Promise.all([
    runGit(['rev-parse', '--abbrev-ref', 'HEAD']),
    runGit(['log', '-1', '--oneline']),
    runGit(['status', '-sb']),
    runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
  ]);
  return {
    branch: branch.stdout || null,
    head: head.stdout || null,
    status: status.stdout || null,
    upstream: remote.ok ? remote.stdout : null,
    projectRoot
  };
}

function runUpdateScript({ target, restartBackend, force, triggeredBy }) {
  return new Promise((resolve, reject) => {
    if (deployState.running) {
      return reject(new Error('Un deploiement est deja en cours'));
    }

    const args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', updateScriptPath,
      '-Target', target
    ];
    if (restartBackend) args.push('-RestartBackend');
    if (force) args.push('-Force');

    deployState = {
      running: true,
      action: `update-${String(target).toLowerCase()}`,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      exitCode: null,
      log: '',
      triggeredBy: triggeredBy || null,
      error: null
    };

    console.log('Deploy console: powershell ' + args.join(' '));
    const child = spawn('powershell.exe', args, {
      cwd: projectRoot,
      windowsHide: true,
      env: process.env
    });

    const append = (chunk) => {
      deployState.log = (deployState.log + chunk.toString()).slice(-20000);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);

    child.on('error', (err) => {
      deployState.running = false;
      deployState.finishedAt = new Date().toISOString();
      deployState.error = err.message;
      deployState.exitCode = 1;
      reject(err);
    });

    child.on('close', (code) => {
      deployState.running = false;
      deployState.finishedAt = new Date().toISOString();
      deployState.exitCode = code == null ? 1 : code;
      resolve(getDeployState());
    });
  });
}

function requireAdminGdri(req, res, next) {
  if (req.user && req.user.role === 'ADMIN_GDRI') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Accès refusé. Réservé aux administrateurs GDRI.'
  });
}

function createAdminRouter(app, db) {
  const router = express.Router();

  router.post('/modules/reload', authenticateJWT, requireAdminGdri, async (req, res) => {
    try {
      moduleRegistry.rediscover();
      const catalog = await syncServicesCatalogFromModules();
      const newlyLoaded = await loadNewModules(app, db);
      res.json({
        success: true,
        message: newlyLoaded.length > 0
          ? newlyLoaded.length + ' module(s) chargé(s) à chaud.'
          : 'Aucun nouveau module à charger.',
        newlyLoaded,
        servicesCatalog: catalog
      });
    } catch (error) {
      console.error('Erreur reload modules:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors du rechargement des modules.'
      });
    }
  });

  router.post('/services/sync', authenticateJWT, requireAdminGdri, async (req, res) => {
    try {
      moduleRegistry.rediscover();
      const catalog = await syncServicesCatalogFromModules();
      res.json({
        success: true,
        message: 'Catalogue services synchronisé (' + catalog.synced + ' module(s)).',
        data: catalog
      });
    } catch (error) {
      console.error('Erreur sync services:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur synchronisation catalogue services.'
      });
    }
  });

  router.get('/modules/status', authenticateJWT, requireAdminGdri, (req, res) => {
    const modules = moduleRegistry.getModules().map(m => ({
      name: m.name,
      displayName: m.displayName || m.name,
      loaded: m.loaded,
      enabled: m.enabled,
      routes: m.routes || []
    }));
    res.json({ success: true, modules });
  });

  router.get('/deploy/status', authenticateJWT, requireAdminGdri, async (req, res) => {
    try {
      const git = await readGitStatus();
      res.json({
        success: true,
        data: {
          git,
          deploy: getDeployState(),
          availableActions: [
            {
              id: 'update-test',
              label: 'Mettre a jour TEST (develop)',
              description: 'git pull branche develop + restart backend :3001',
              allowedFromConsole: true
            },
            {
              id: 'update-prod',
              label: 'Mettre a jour PROD (master)',
              description: 'Reserve au lancement local (demarrage\\11-update-prod.bat)',
              allowedFromConsole: false
            }
          ]
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message || 'Erreur status deploy' });
    }
  });

  router.post('/deploy/update-test', authenticateJWT, requireAdminGdri, async (req, res) => {
    if (getDeployState().running) {
      return res.status(409).json({
        success: false,
        message: 'Un deploiement est deja en cours.',
        data: getDeployState()
      });
    }

    const restartBackend = req.body?.restartBackend !== false;
    const force = req.body?.force === true;
    const triggeredBy = {
      userId: req.user.id || req.user._id || null,
      email: req.user.email || null,
      role: req.user.role
    };

    try {
      const result = await runUpdateScript({
        target: 'Test',
        restartBackend,
        force,
        triggeredBy
      });
      res.json({
        success: result.exitCode === 0,
        message: result.exitCode === 0
          ? 'Mise a jour TEST terminee.'
          : 'Mise a jour TEST terminee avec erreur (code ' + result.exitCode + ').',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message || 'Echec lancement mise a jour TEST'
      });
    }
  });

  router.post('/deploy/update-prod', authenticateJWT, requireAdminGdri, (req, res) => {
    return res.status(403).json({
      success: false,
      message: 'La mise a jour PROD est desactivee depuis la console. Utilisez demarrage\\11-update-prod.bat en local sur le serveur.'
    });
  });

  router.post('/restart', authenticateJWT, requireAdminGdri, (req, res) => {
    if (process.env.ALLOW_ADMIN_RESTART !== 'true' && process.env.ALLOW_ADMIN_RESTART !== '1') {
      return res.status(403).json({
        success: false,
        message: 'Redémarrage désactivé. Définir ALLOW_ADMIN_RESTART=true pour l\'activer.'
      });
    }
    res.json({
      success: true,
      message: 'Redémarrage demandé. Le processus va s\'arrêter ; le gestionnaire (PM2, systemd) le relancera.'
    });
    setTimeout(() => {
      console.log('Arret demande par l admin (redemarrage)...');
      process.exit(0);
    }, 500);
  });

  return router;
}

module.exports = createAdminRouter;
