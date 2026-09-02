/**
 * Catalogue d’actions : contrat de champs (défaut) ou fonctions connecteur (flux existants).
 * L’appel modèle est le bloc famille `ia`, pas ce catalogue.
 * Fichier : backend/core/agent-flow/actionContracts.js
 */

const { migrateComposeConfig } = require('./zoneContracts');
const path = require('path');
const fs = require('fs');

const CONTRACTS_PATH = path.join(__dirname, 'action-contracts.json');

const ALIASES = {
  'analyse-intention': 'ia.compose',
  'analyse.run': 'ia.compose',
  'ia.analyse': 'ia.compose',
  'ia.intention': 'ia.compose',
  'ia.generate': 'ia.compose',
  generate: 'ia.compose',
  'mail-delete': 'mail.delete',
  delete: 'mail.delete',
  'mail-save-attachments': 'mail.save-attachments',
  saveAttachments: 'mail.save-attachments',
  'mark-seen': 'mail.mark-seen',
  'mail.seen': 'mail.mark-seen',
  'mark-unseen': 'mail.mark-unseen',
  'mail.unseen': 'mail.mark-unseen'
};

let cached = null;
let cachedMtime = 0;

function loadActionContracts() {
  const stat = fs.statSync(CONTRACTS_PATH);
  if (cached && stat.mtimeMs === cachedMtime) return cached;
  cached = JSON.parse(fs.readFileSync(CONTRACTS_PATH, 'utf8'));
  cachedMtime = stat.mtimeMs;
  return cached;
}

function normalizeActionId(raw) {
  const id = String(raw || '').trim();
  if (!id) return '';
  return ALIASES[id] || id;
}

function listIaActions() {
  const contracts = loadActionContracts();
  return Array.isArray(contracts.ia) ? contracts.ia.slice() : [];
}

function listSurfaceActions() {
  const contracts = loadActionContracts();
  return Array.isArray(contracts.surfaces) ? contracts.surfaces.slice() : [];
}

function getConnectorActions(providerOrConnectorId) {
  const contracts = loadActionContracts();
  const key = String(providerOrConnectorId || '').toLowerCase();
  const map = contracts.connectors || {};
  if (map[key]) return map[key];
  return Object.values(map).find((c) => {
    return String(c.connectorId || '').toLowerCase() === key
      || String(c.provider || '').toLowerCase() === key;
  }) || null;
}

function listConnectorActions(providerOrConnectorId) {
  const group = getConnectorActions(providerOrConnectorId);
  return group && Array.isArray(group.actions) ? group.actions.slice() : [];
}

function getAction(actionId) {
  const id = normalizeActionId(actionId);
  if (!id) return null;
  const ia = listIaActions().find((a) => a.id === id);
  if (ia) return { ...ia, family: 'ia' };
  const surface = listSurfaceActions().find((a) => a.id === id);
  if (surface) return { ...surface, family: 'surface' };
  const contracts = loadActionContracts();
  const map = contracts.connectors || {};
  for (const group of Object.values(map)) {
    const found = (group.actions || []).find((a) => a.id === id);
    if (found) {
      return {
        ...found,
        family: 'function',
        provider: group.provider,
        connectorId: group.connectorId
      };
    }
  }
  return null;
}

function writesForAction(actionId) {
  const def = getAction(actionId);
  return def && Array.isArray(def.writes) ? def.writes : [];
}

function inferKind(actionId) {
  const id = normalizeActionId(actionId);
  if (!id || id.startsWith('ia.')) return 'fields';
  if (id.startsWith('surface.')) return 'function';
  return 'function';
}

function normalizeActionConfig(config = {}) {
  const raw = config.actionId || config.operation || 'ia.compose';
  const actionId = normalizeActionId(raw) || 'ia.compose';
  const kind = config.kind === 'function' || inferKind(actionId) === 'function'
    ? 'function'
    : 'fields';
  const writeMode = String(config.writeMode || 'merge').toLowerCase() === 'replace'
    ? 'replace'
    : 'merge';
  const base = {
    ...config,
    kind,
    actionId: kind === 'function' ? actionId : 'ia.compose',
    operation: kind === 'function' ? actionId : 'ia.compose',
    writeMode
  };
  if (kind === 'function') return base;
  return migrateComposeConfig(base);
}

module.exports = {
  loadActionContracts,
  normalizeActionId,
  listIaActions,
  listSurfaceActions,
  getConnectorActions,
  listConnectorActions,
  getAction,
  writesForAction,
  inferKind,
  normalizeActionConfig,
  ALIASES
};
