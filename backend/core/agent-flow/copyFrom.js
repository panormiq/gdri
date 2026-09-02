/**
 * Recopie un objet du flux tel quel, puis surcharge uniquement les champs remplis.
 */

const { readFromBag, normalizeNsPath } = require('./nodeNamespace');

const SKIP_MERGE_KEYS = {
  type: 1,
  ok: 1,
  provider: 1,
  passthrough: 1,
  empty: 1,
  items: 1,
  item: 1,
  itemsCount: 1,
  itemIndex: 1,
  json: 1,
  payload: 1,
  debug: 1,
  success: 1,
  channel: 1,
  note: 1,
  error: 1,
  fetched: 1
};

function copyFromPath(config) {
  return String((config && (config.copyFrom || config.sourceObject)) || '').trim();
}

function copyFieldToken(path, key) {
  const p = String(path || '').trim();
  const k = String(key || '').trim();
  if (!p || !k) return '';
  return `{{${p}.${k}}}`;
}

function isCopyFieldToken(raw, path, key) {
  const t = String(raw == null ? '' : raw).trim();
  const wantKey = String(key || '').trim();
  if (!t || !wantKey || !/^\{\{\s*[a-zA-Z0-9_.]+\s*\}\}$/.test(t)) return false;
  const inner = t.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();
  if (inner !== wantKey && !inner.endsWith(`.${wantKey}`)) return false;
  const p = String(path || '').trim();
  if (!p) return true;
  const slug = p.replace(/\.item$/, '');
  return inner === `${p}.${wantKey}`
    || inner === `${slug}.${wantKey}`
    || inner === `${slug}.item.${wantKey}`;
}

function asCopyObject(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === 'object' && !Array.isArray(first) ? first : null;
  }
  if (typeof value !== 'object') return null;
  if (value.item && typeof value.item === 'object' && !Array.isArray(value.item)) return value.item;
  if (Array.isArray(value.items) && value.items.length) {
    const idx = Number(value.itemIndex);
    const i = Number.isFinite(idx) && idx >= 0 ? idx : 0;
    const row = value.items[i] || value.items[0];
    return row && typeof row === 'object' && !Array.isArray(row) ? row : null;
  }
  return value;
}

function readCopySource(executor, context, path) {
  const raw = normalizeNsPath(path) || String(path || '').trim();
  if (!raw || !executor || typeof executor.readContextField !== 'function') return null;
  return asCopyObject(executor.readContextField(context, raw));
}

function valueFromCopySource(source, key) {
  if (!source) return undefined;
  const found = readFromBag(source, key);
  if (found === undefined || found === null || found === '') return undefined;
  return found;
}

function mergeCopySource(source) {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  Object.keys(source).forEach((k) => {
    if (!k || SKIP_MERGE_KEYS[k] || k.indexOf('__') === 0) return;
    if (source[k] === undefined) return;
    out[k] = source[k];
  });
  return out;
}

function applyCopyFrom(executor, config, context, rendered) {
  const path = copyFromPath(config);
  const current = rendered && typeof rendered === 'object' ? { ...rendered } : {};
  if (!path) return current;
  const source = readCopySource(executor, context, path);
  if (!source) return current;
  const merged = { ...mergeCopySource(source) };
  Object.keys(current).forEach((k) => {
    const val = current[k];
    if (val === undefined || val === null || val === '') return;
    if (Array.isArray(val) && !val.length) return;
    merged[k] = val;
  });
  return merged;
}

module.exports = {
  copyFromPath,
  copyFieldToken,
  isCopyFieldToken,
  asCopyObject,
  readCopySource,
  valueFromCopySource,
  mergeCopySource,
  applyCopyFrom
};
