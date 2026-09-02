/**
 * Catalogue des CRUD d’app exposés aux agents.
 * Découvre modules/<app>/backend/agent-crud.json et backend/modules/<app>/agent-crud.json.
 * Fichier : backend/core/agent-flow/app-crud/appCrudRegistry.js
 */

const fs = require('fs');
const path = require('path');

const OPS = new Set(['read', 'create', 'update']);
const BACKEND_ROOT = path.resolve(__dirname, '../../..');
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');

let cache = null;

function asOps(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((op) => String(op || '').toLowerCase().trim())
    .filter((op) => OPS.has(op));
}

function asFields(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => {
      if (!f || typeof f !== 'object') return null;
      const key = String(f.key || f.name || '').trim();
      if (!key) return null;
      return {
        key,
        label: String(f.label || f.key || f.name || key),
        type: String(f.type || 'text'),
        required: !!f.required
      };
    })
    .filter(Boolean);
}

function normalizeCollection(raw, appId) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  if (!id) return null;
  const ops = asOps(raw.ops);
  if (!ops.length) return null;
  return {
    id,
    appId,
    ref: `${appId}.${id}`,
    label: String(raw.label || id),
    ops,
    writeVia: 'service',
    wired: raw.wired === true,
    key: String(raw.key || raw.keyField || 'id').trim() || 'id',
    serviceRef: String(raw.serviceRef || '').trim(),
    fields: asFields(raw.fields)
  };
}

function normalizeApp(raw, fallbackId) {
  if (!raw || typeof raw !== 'object') return null;
  const appId = String(raw.appId || fallbackId || '').trim();
  if (!appId) return null;
  const collections = (Array.isArray(raw.collections) ? raw.collections : [])
    .map((c) => normalizeCollection(c, appId))
    .filter(Boolean);
  return {
    appId,
    label: String(raw.label || appId),
    enabled: raw.enabled !== false,
    collections
  };
}

function readManifest(filePath, fallbackId) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return normalizeApp(raw, fallbackId);
  } catch (err) {
    console.warn('agent-crud.json:', filePath, err.message);
    return null;
  }
}

function scanDir(root, relativeBackend) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  fs.readdirSync(root).forEach((name) => {
    const dir = path.join(root, name, relativeBackend);
    const file = path.join(dir, 'agent-crud.json');
    if (!fs.existsSync(file)) return;
    const app = readManifest(file, name);
    if (app) out.push(app);
  });
  return out;
}

function loadApps() {
  const byId = {};
  scanDir(path.join(PROJECT_ROOT, 'modules'), 'backend').forEach((app) => {
    byId[app.appId] = app;
  });
  scanDir(path.join(BACKEND_ROOT, 'modules'), '').forEach((app) => {
    if (!byId[app.appId]) byId[app.appId] = app;
  });
  return Object.keys(byId).sort().map((id) => byId[id]);
}

function listApps() {
  if (!cache) cache = loadApps();
  return cache;
}

function reload() {
  cache = null;
  return listApps();
}

function listCollections({ op, wired } = {}) {
  const wantOp = op ? String(op).toLowerCase() : '';
  const out = [];
  listApps().forEach((app) => {
    if (!app.enabled) return;
    app.collections.forEach((col) => {
      if (wantOp && col.ops.indexOf(wantOp) < 0) return;
      if (wired === true && !col.wired) return;
      if (wired === false && col.wired) return;
      out.push({
        ...col,
        appLabel: app.label
      });
    });
  });
  return out;
}

function getCollection(appId, collectionId) {
  const app = listApps().find((a) => a.appId === String(appId || ''));
  if (!app || !app.enabled) return null;
  return app.collections.find((c) => c.id === String(collectionId || '')) || null;
}

function parseRef(ref) {
  const raw = String(ref || '').trim();
  const dot = raw.indexOf('.');
  if (dot <= 0) return { appId: '', collectionId: raw };
  return { appId: raw.slice(0, dot), collectionId: raw.slice(dot + 1) };
}

function getByRef(ref) {
  const { appId, collectionId } = parseRef(ref);
  return getCollection(appId, collectionId);
}

function catalogPayload() {
  const apps = listApps().filter((a) => a.enabled);
  return {
    version: '0.1.0',
    wired: false,
    apps: apps.map((a) => ({
      appId: a.appId,
      label: a.label,
      collectionCount: a.collections.length
    })),
    collections: listCollections()
  };
}

module.exports = {
  OPS: Array.from(OPS),
  listApps,
  reload,
  listCollections,
  getCollection,
  getByRef,
  parseRef,
  catalogPayload
};
