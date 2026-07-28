/**
 * Routes admin : modules, sync services, deploiement TEST + sync données.
 * Déploiement / sync : ADMIN_GDRI ou DEV.
 * Reload modules : ADMIN_GDRI uniquement.
 * Pas de mise à jour PROD depuis la console (manuel).
 * Fichier : backend/routes/admin.js
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
const moduleRegistry = require('../core/module-registry');
const { loadNewModules } = require('../core/module-loader');
const { syncServicesCatalogFromModules } = require('../core/services-catalog-sync');
const { authenticateJWT } = require('../config/jwt');

const projectRoot = path.resolve(__dirname, '../..');
const htdocsRoot = path.resolve(projectRoot, '..');
const gdriDevRoot = path.join(htdocsRoot, 'gdri-dev');
const gdriProdRoot = path.join(htdocsRoot, 'gdri');

function resolveTestRoot() {
  if (fs.existsSync(path.join(gdriDevRoot, '.git'))) return gdriDevRoot;
  if (path.basename(projectRoot).toLowerCase() === 'gdri-dev') return projectRoot;
  return projectRoot;
}

function resolveUpdateScript() {
  const candidates = [
    path.join(resolveTestRoot(), 'demarrage', 'Update-From-Git.ps1'),
    path.join(projectRoot, 'demarrage', 'Update-From-Git.ps1'),
    path.join(gdriProdRoot, 'demarrage', 'Update-From-Git.ps1')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function resolveCloneScript() {
  const candidates = [
    path.join(resolveTestRoot(), 'backend', 'scripts', 'clone-mongo-to-test.js'),
    path.join(projectRoot, 'backend', 'scripts', 'clone-mongo-to-test.js'),
    path.join(gdriProdRoot, 'backend', 'scripts', 'clone-mongo-to-test.js')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

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

function runGit(args, cwd) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd: cwd || projectRoot, windowsHide: true }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim(),
        error: err ? (err.message || String(err)) : null
      });
    });
  });
}

async function readGitStatus(cwd) {
  const root = cwd || resolveTestRoot();
  const [branch, head, status, remote] = await Promise.all([
    runGit(['rev-parse', '--abbrev-ref', 'HEAD'], root),
    runGit(['log', '-1', '--oneline'], root),
    runGit(['status', '-sb'], root),
    runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], root)
  ]);
  return {
    branch: branch.stdout || null,
    head: head.stdout || null,
    status: status.stdout || null,
    upstream: remote.ok ? remote.stdout : null,
    projectRoot: root
  };
}

function beginDeployState(action, triggeredBy) {
  deployState = {
    running: true,
    action,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    log: '',
    triggeredBy: triggeredBy || null,
    error: null
  };
}

function appendDeployLog(chunk) {
  deployState.log = (deployState.log + chunk.toString()).slice(-30000);
}

function finishDeployState(code, errorMessage) {
  deployState.running = false;
  deployState.finishedAt = new Date().toISOString();
  deployState.exitCode = code == null ? 1 : code;
  if (errorMessage) deployState.error = errorMessage;
}

function runUpdateScript({ target, restartBackend, force, triggeredBy }) {
  return new Promise((resolve, reject) => {
    if (deployState.running) {
      return reject(new Error('Une operation est deja en cours'));
    }

    const updateScriptPath = resolveUpdateScript();
    if (!fs.existsSync(updateScriptPath)) {
      return reject(new Error('Script introuvable: ' + updateScriptPath));
    }

    const args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', updateScriptPath,
      '-Target', target
    ];
    if (restartBackend) args.push('-RestartBackend');
    if (force) args.push('-Force');

    beginDeployState(`update-${String(target).toLowerCase()}`, triggeredBy);
    appendDeployLog('powershell ' + args.join(' ') + '\n');

    const child = spawn('powershell.exe', args, {
      cwd: path.dirname(updateScriptPath),
      windowsHide: true,
      env: process.env
    });

    child.stdout.on('data', appendDeployLog);
    child.stderr.on('data', appendDeployLog);

    child.on('error', (err) => {
      finishDeployState(1, err.message);
      reject(err);
    });

    child.on('close', (code) => {
      finishDeployState(code);
      resolve(getDeployState());
    });
  });
}

function runCloneMongoScript({ drop, triggeredBy }) {
  return new Promise((resolve, reject) => {
    if (deployState.running) {
      return reject(new Error('Une operation est deja en cours'));
    }

    const scriptPath = resolveCloneScript();
    if (!fs.existsSync(scriptPath)) {
      return reject(new Error('Script introuvable: ' + scriptPath));
    }

    const backendDir = path.dirname(path.dirname(scriptPath));
    const args = [scriptPath];
    if (drop) args.push('--drop');

    beginDeployState('sync-test-data', triggeredBy);
    appendDeployLog('node ' + args.join(' ') + '\n');
    appendDeployLog('cwd: ' + backendDir + '\n');

    const child = spawn(process.execPath, args, {
      cwd: backendDir,
      windowsHide: true,
      env: {
        ...process.env,
        // Force lecture du .env prod (source) depuis le backend qui lance le script
        GDRI_ENV_FILE: process.env.GDRI_ENV_FILE || '.env'
      }
    });

    child.stdout.on('data', appendDeployLog);
    child.stderr.on('data', appendDeployLog);

    child.on('error', (err) => {
      finishDeployState(1, err.message);
      reject(err);
    });

    child.on('close', (code) => {
      finishDeployState(code);
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

function requireDeployAccess(req, res, next) {
  const role = req.user && req.user.role;
  if (role === 'ADMIN_GDRI' || role === 'DEV') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Accès refusé. Réservé aux rôles ADMIN_GDRI ou DEV.'
  });
}

function triggeredByFromReq(req) {
  return {
    userId: req.user.id || req.user._id || null,
    email: req.user.email || null,
    role: req.user.role
  };
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

  router.get('/deploy/status', authenticateJWT, requireDeployAccess, async (req, res) => {
    try {
      const git = await readGitStatus(resolveTestRoot());
      res.json({
        success: true,
        data: {
          git,
          deploy: getDeployState(),
          availableActions: [
            {
              id: 'update-test',
              label: 'Mettre a jour TEST (develop)',
              description: 'git pull develop dans gdri-dev + restart backend :3001',
              allowedFromConsole: true
            },
            {
              id: 'sync-test-data',
              label: 'Sync donnees prod → test',
              description: 'Clone GDR-INNOVATION vers GDR-INNOVATION-TEST',
              allowedFromConsole: true
            }
          ]
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message || 'Erreur status deploy' });
    }
  });

  router.post('/deploy/update-test', authenticateJWT, requireDeployAccess, async (req, res) => {
    if (getDeployState().running) {
      return res.status(409).json({
        success: false,
        message: 'Une operation est deja en cours.',
        data: getDeployState()
      });
    }

    const restartBackend = req.body?.restartBackend !== false;
    const force = req.body?.force === true;

    try {
      const result = await runUpdateScript({
        target: 'Test',
        restartBackend,
        force,
        triggeredBy: triggeredByFromReq(req)
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

  router.post('/deploy/sync-test-data', authenticateJWT, requireDeployAccess, async (req, res) => {
    if (getDeployState().running) {
      return res.status(409).json({
        success: false,
        message: 'Une operation est deja en cours.',
        data: getDeployState()
      });
    }

    const drop = req.body?.drop !== false;

    try {
      const result = await runCloneMongoScript({
        drop,
        triggeredBy: triggeredByFromReq(req)
      });
      res.json({
        success: result.exitCode === 0,
        message: result.exitCode === 0
          ? 'Synchronisation donnees TEST terminee.'
          : 'Synchronisation terminee avec erreur (code ' + result.exitCode + ').',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message || 'Echec sync donnees TEST'
      });
    }
  });

  // PROD : volontairement absent de la console (manuel uniquement)
  router.post('/deploy/update-prod', authenticateJWT, requireDeployAccess, (req, res) => {
    return res.status(403).json({
      success: false,
      message: 'Mise a jour PROD desactivee. Faites un merge develop→master puis git pull manuel dans htdocs/gdri.'
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
