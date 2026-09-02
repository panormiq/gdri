/**
 * Contrat de champs du bloc Action, comme les champs d’une collection. Un prompt n’est qu’un champ possible.
 * Fichier : backend/core/agent-flow/zoneContracts.js
 */

const path = require('path');
const fs = require('fs');

const CONTRACTS_PATH = path.join(__dirname, 'zone-contracts.json');
const ALLOWED_TYPES = new Set(['text', 'textarea', 'number', 'file', 'array']);
const TYPE_ALIASES = {
  int: 'number',
  integer: 'number',
  float: 'number',
  currency: 'number',
  nombre: 'number',
  chiffre: 'number'
};

let cached = null;
let cachedMtime = 0;

function loadZoneContracts() {
  const stat = fs.statSync(CONTRACTS_PATH);
  if (cached && stat.mtimeMs === cachedMtime) return cached;
  cached = JSON.parse(fs.readFileSync(CONTRACTS_PATH, 'utf8'));
  cachedMtime = stat.mtimeMs;
  return cached;
}

function slugKey(raw, fallback) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return s || fallback || '';
}

function normalizeVariable(raw, index) {
  if (!raw || typeof raw !== 'object') return null;
  const key = slugKey(raw.key || raw.name || raw.id, `zone_${(index || 0) + 1}`);
  if (!key) return null;
  const rawType = TYPE_ALIASES[String(raw.type || '').toLowerCase()] || String(raw.type || '');
  const type = ALLOWED_TYPES.has(rawType) ? rawType : 'textarea';
  return {
    key,
    label: String(raw.label || raw.title || key),
    type,
    required: raw.required === true,
    description: String(raw.description || raw.hint || ''),
    placeholder: String(raw.placeholder || '')
  };
}

function normalizeVariables(list) {
  const seen = {};
  const out = [];
  (Array.isArray(list) ? list : []).forEach((raw, i) => {
    const v = normalizeVariable(raw, i);
    if (!v || seen[v.key]) return;
    seen[v.key] = true;
    out.push(v);
  });
  return out;
}

function listPresets() {
  const map = (loadZoneContracts().presets) || {};
  return Object.keys(map).map((id) => ({ id, ...map[id] }));
}

function getPreset(presetId) {
  const map = (loadZoneContracts().presets) || {};
  const id = String(presetId || '').trim();
  if (map[id]) return { id, ...map[id], variables: normalizeVariables(map[id].variables) };
  return null;
}

function suggestPresetId(nextNode) {
  if (!nextNode) return null;
  const brickId = String(nextNode.brickId || '');
  const provider = String((nextNode.config && nextNode.config.provider) || '').toLowerCase();
  if (brickId === 'ia') return 'ia';
  if (brickId === 'output' && provider === 'facebook') return 'output.facebook';
  if (brickId === 'output') return 'output.mail';
  return null;
}

function mergePresetVariables(existing, presetVars) {
  const current = normalizeVariables(existing);
  const seen = {};
  current.forEach((v) => { seen[v.key] = true; });
  const added = [];
  (presetVars || []).forEach((raw, i) => {
    const v = normalizeVariable(raw, i);
    if (!v || seen[v.key]) return;
    seen[v.key] = true;
    current.push(v);
    added.push(v);
  });
  return { variables: current, added };
}

function migrateComposeConfig(config = {}) {
  const out = { ...(config || {}) };
  if (!out.values || typeof out.values !== 'object') out.values = {};
  let variables = normalizeVariables(out.variables);

  const legacyPrompt = String(out.prompt || '').trim();
  if (legacyPrompt && !String(out.values.prompt || '').trim()) {
    out.values.prompt = String(out.prompt);
  }
  if ((legacyPrompt || out.values.prompt) && !variables.some((v) => v.key === 'prompt')) {
    variables.unshift({
      key: 'prompt',
      label: 'Prompt',
      type: 'textarea',
      required: false,
      description: 'Instruction envoyée au modèle (si un bloc IA suit)',
      placeholder: ''
    });
  }

  out.variables = variables;
  return out;
}

module.exports = {
  loadZoneContracts,
  slugKey,
  normalizeVariable,
  normalizeVariables,
  listPresets,
  getPreset,
  suggestPresetId,
  mergePresetVariables,
  migrateComposeConfig
};
