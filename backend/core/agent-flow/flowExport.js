/**
 * Sortie flux : un nom + le résultat du run (pas la collection).
 * Design page web → { html, css } sous le nom « chrome ».
 */

function sanitizeExportName(raw) {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return k || 'resultat';
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

function pickFlowExportData(executor, context) {
  let html = executor.readContextField(context, 'html');
  let css = executor.readContextField(context, 'css');
  const response = executor.readContextField(context, 'response')
    || executor.readContextField(context, 'body')
    || executor.readContextField(context, 'text')
    || '';
  const parsed = tryParseResult(response)
    || (html && typeof html === 'object' ? html : null);
  if (parsed) {
    if (html == null || html === '') html = parsed.html || parsed.HTML || '';
    if (css == null || css === '') css = parsed.css || parsed.CSS || parsed.style || '';
  }
  html = html == null ? '' : String(html);
  css = css == null ? '' : String(css);
  if (!html && response && !parsed) html = String(response);
  return { html, css };
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
  const data = pickFlowExportData(executor, context);
  const payload = {
    html: data.html,
    css: data.css,
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
  return {
    type: 'output-flow-result',
    success: true,
    provider: 'flow',
    exportName: name,
    html: payload.html,
    css: payload.css,
    preview: combinePreview(payload)
  };
}

module.exports = {
  sanitizeExportName,
  pickFlowExportData,
  combinePreview,
  writeFlowExport
};
