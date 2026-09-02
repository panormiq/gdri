/**
 * Sortie flux : un nom + des champs choisis dans le run (pas un contrat HTML/CSS).
 * Les clés html / css restent en tête de payload pour l’aperçu chrome / hook.
 */

const RESERVED_EXPORT_KEYS = {
  updatedAt: 1,
  type: 1,
  success: 1,
  provider: 1,
  exportName: 1,
  preview: 1,
  debug: 1,
  __ns: 1,
  __nsOrder: 1,
  __durable: 1,
  __writeMode: 1
};

function sanitizeExportName(raw) {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return k || 'resultat';
}

function uniquePaths(list) {
  const seen = {};
  const out = [];
  (list || []).forEach((raw) => {
    const k = String(raw || '').trim();
    if (!k || seen[k]) return;
    seen[k] = true;
    out.push(k);
  });
  return out;
}

function localExportKey(path) {
  const p = String(path || '').trim();
  if (!p) return '';
  const i = p.lastIndexOf('.');
  return i >= 0 ? p.slice(i + 1) : p;
}

function mappingSourcePaths(config) {
  const mapping = config && config.mapping && typeof config.mapping === 'object'
    ? config.mapping
    : {};
  const out = [];
  Object.keys(mapping).forEach((slot) => {
    const from = String(mapping[slot] || '').trim();
    if (!from || from === '__literal__' || from.indexOf('__llm__:') === 0) return;
    out.push(from);
  });
  return uniquePaths(out);
}

function listedExportFields(config) {
  const listed = Array.isArray(config && config.exportFields) ? config.exportFields : null;
  if (listed) return uniquePaths(listed);
  return mappingSourcePaths(config);
}

function tryParseResult(raw) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const src = fence ? String(fence[1] || '').trim() : text;
  const start = src.indexOf('{');
  const end = src.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(src.slice(start, end + 1));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
  } catch {
    return null;
  }
}

function readPath(executor, context, path) {
  if (!executor || !path) return undefined;
  if (typeof executor.readContextField === 'function') {
    return executor.readContextField(context, path);
  }
  return undefined;
}

function assignExportValue(data, key, value) {
  const k = String(key || '').trim();
  if (!k || RESERVED_EXPORT_KEYS[k] || value === undefined) return;
  data[k] = value;
}

function pickSelectedFields(executor, context, config) {
  const data = {};
  listedExportFields(config).forEach((path) => {
    const val = readPath(executor, context, path);
    assignExportValue(data, localExportKey(path), val);
  });
  return data;
}

function overlayMappedSlots(executor, context, config, data) {
  const { resolveSlot } = require('./inputMapping');
  ['html', 'css', 'surface', 'label'].forEach((slot) => {
    const resolved = resolveSlot(executor, config || {}, slot, context);
    if (!resolved.mapped || resolved.value === undefined || resolved.value === '') return;
    data[slot] = resolved.value;
  });
}

function fallbackHtmlCss(executor, context, data) {
  let html = data.html;
  let css = data.css;
  if (html == null || html === '') html = readPath(executor, context, 'html');
  if (css == null || css === '') css = readPath(executor, context, 'css');
  const response = readPath(executor, context, 'response')
    || readPath(executor, context, 'body')
    || readPath(executor, context, 'text')
    || '';
  const parsed = tryParseResult(response)
    || (html && typeof html === 'object' ? html : null);
  if (parsed) {
    if (html == null || html === '') html = parsed.html || parsed.HTML || '';
    if (css == null || css === '') css = parsed.css || parsed.CSS || parsed.style || '';
  }
  if ((html == null || html === '') && response && !parsed) html = String(response);
  if (html != null && html !== '') data.html = html;
  if (css != null && css !== '') data.css = css;
}

function pickFlowExportData(executor, context, config) {
  const data = pickSelectedFields(executor, context, config);
  overlayMappedSlots(executor, context, config, data);
  const selected = listedExportFields(config);
  const explicit = Array.isArray(config && config.exportFields);
  if (!explicit && !selected.length) fallbackHtmlCss(executor, context, data);
  if (!explicit) {
    if (data.surface == null || data.surface === '') {
      const surface = readPath(executor, context, 'surface');
      if (surface != null && surface !== '') data.surface = surface;
    }
    if (data.label == null || data.label === '') {
      const label = readPath(executor, context, 'label');
      if (label != null && label !== '') data.label = label;
    }
  }
  return {
    html: data.html == null ? '' : String(data.html),
    css: data.css == null ? '' : String(data.css),
    surface: data.surface == null ? '' : String(data.surface),
    label: data.label == null ? '' : String(data.label),
    fields: data
  };
}

function combinePreview(data) {
  const html = String((data && data.html) || '');
  const css = String((data && data.css) || '');
  if (!css.trim()) return html;
  if (/<style[\s>]/i.test(html)) return html;
  return `<style>${css}</style>\n${html}`;
}

async function writeFlowExport(executor, flow, config, context) {
  const name = sanitizeExportName(config && (config.exportName || config.name));
  const picked = pickFlowExportData(executor, context, config);
  const payload = {
    ...(picked.fields || {}),
    html: picked.html,
    css: picked.css,
    surface: picked.surface,
    label: picked.label,
    updatedAt: new Date().toISOString()
  };
  if (flow && flow._id && executor && executor.database) {
    const { AgentFlowService } = require('../AgentFlowService');
    const svc = new AgentFlowService(executor.database);
    const current = await svc.getFlowById(flow._id);
    const prev = (current && current.exports && typeof current.exports === 'object')
      ? current.exports
      : {};
    const exportsMap = { ...prev, [name]: payload };
    await svc.updateFlow(flow._id, { exports: exportsMap });
    flow.exports = exportsMap;
  }
  const result = {
    type: 'output-flow-result',
    success: true,
    provider: 'flow',
    exportName: name,
    html: payload.html,
    css: payload.css,
    surface: payload.surface,
    label: payload.label,
    preview: combinePreview(payload)
  };
  Object.keys(picked.fields || {}).forEach((k) => {
    if (result[k] === undefined) result[k] = picked.fields[k];
  });
  return result;
}

module.exports = {
  sanitizeExportName,
  listedExportFields,
  pickFlowExportData,
  combinePreview,
  writeFlowExport
};
