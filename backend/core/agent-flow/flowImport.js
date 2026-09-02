/**
 * Entrées flux : lit le flux parent (sous-bloc importé) ou le previous local.
 * Miroir de Sortie flux (flowExport).
 */

function firstNonEmpty(src, keys) {
  const bag = src && typeof src === 'object' ? src : {};
  for (let i = 0; i < keys.length; i += 1) {
    const v = bag[keys[i]];
    if (v == null || v === '') continue;
    if (typeof v === 'object' && !Array.isArray(v)) continue;
    return v;
  }
  return '';
}

function flattenPrevious(prev) {
  if (!prev || typeof prev !== 'object') return {};
  const out = { ...prev };
  const ns = prev.__ns && typeof prev.__ns === 'object' ? prev.__ns : {};
  Object.keys(ns).forEach((slug) => {
    const bag = ns[slug];
    if (!bag || typeof bag !== 'object') return;
    Object.keys(bag).forEach((key) => {
      if (out[key] == null || out[key] === '') out[key] = bag[key];
    });
  });
  return out;
}

function parentPrevious(context) {
  const payload = (context && context.trigger && context.trigger.payload) || {};
  if (payload.previous && typeof payload.previous === 'object') return payload.previous;
  if (context && context.previous && typeof context.previous === 'object') return context.previous;
  return {};
}

function pickFlowInputData(context) {
  const flat = flattenPrevious(parentPrevious(context));
  return {
    html: String(firstNonEmpty(flat, ['html', 'HTML']) || ''),
    css: String(firstNonEmpty(flat, ['css', 'CSS', 'style']) || ''),
    surface: String(firstNonEmpty(flat, ['surface']) || ''),
    label: String(firstNonEmpty(flat, ['label']) || ''),
    response: String(firstNonEmpty(flat, ['response']) || ''),
    text: String(firstNonEmpty(flat, ['text', 'body', 'response']) || '')
  };
}

function readFlowInput(context, config) {
  const { asDataTable } = require('./dataTable');
  const data = pickFlowInputData(context);
  const name = String((config && (config.importName || config.name)) || 'flux').trim() || 'flux';
  return asDataTable([data], {
    provider: 'flow',
    channel: 'flow',
    resourceType: 'flow',
    name,
    html: data.html,
    css: data.css,
    surface: data.surface,
    label: data.label,
    response: data.response,
    text: data.text || data.html
  });
}

module.exports = {
  parentPrevious,
  pickFlowInputData,
  readFlowInput
};
