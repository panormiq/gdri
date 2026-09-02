/**
 * Surfaces user d'un agent (du plus léger au plus lourd) :
 * - Play : déclencheur bouton → Lancer sur la carte agent
 * - Run : page sablier + progression du flux ; validation = modal dans ce run
 * - App : seulement s'il y a plusieurs pages user (pas juste Play + validation)
 */

const PUBLISH_MODES = new Set(['auto', 'yes', 'no']);

function normalizeAppConfig(app) {
  const raw = app && typeof app === 'object' ? app : {};
  const publish = PUBLISH_MODES.has(String(raw.publish || ''))
    ? String(raw.publish)
    : 'auto';
  const buttonLabel = String(raw.buttonLabel != null ? raw.buttonLabel : 'Lancer').trim() || 'Lancer';
  const pages = Array.isArray(raw.pages)
    ? raw.pages
        .filter((p) => p && (p.id || p.title || p.name))
        .map((p, i) => normalizeAppPage(p, i))
    : [];
  return { publish, buttonLabel, pages };
}

function normalizeAppPage(page, index) {
  const raw = page && typeof page === 'object' ? page : {};
  const id = String(raw.id || `page-${index + 1}`).trim();
  const title = String(raw.title || raw.name || `Page ${index + 1}`).trim() || `Page ${index + 1}`;
  const templateNamespace = String(raw.templateNamespace || '').trim();
  const slots = Array.isArray(raw.slots)
    ? raw.slots
        .filter((s) => s && (s.nodeId || s.view))
        .map((s, i) => ({
          id: String(s.id || `slot-${i + 1}`).trim(),
          nodeId: String(s.nodeId || '').trim(),
          view: String(s.view || 'block').trim() || 'block',
          label: String(s.label || s.view || 'Vue').trim()
        }))
    : [];
  return { id, title, templateNamespace, slots };
}

function collectNodes(flow) {
  const nodes = flow && flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
  if (nodes.length) return nodes;
  const out = [];
  const triggers = Array.isArray(flow && flow.triggers) && flow.triggers.length
    ? flow.triggers
    : flow && flow.trigger
      ? [flow.trigger]
      : [];
  triggers.forEach((t) => {
    if (t) out.push({ brickId: t.brickId, kind: 'trigger', config: t.config || {} });
  });
  const steps = Array.isArray(flow && flow.steps) ? flow.steps : [];
  steps.forEach((s) => {
    if (s) out.push({ brickId: s.brickId, kind: s.kind || 'action', config: s.config || {} });
  });
  return out;
}

function isButtonTriggerNode(node) {
  if (!node) return false;
  const id = String(node.brickId || '');
  if (id === 'manual-trigger') return true;
  if (id === 'cron-trigger') return false;
  if (id !== 'trigger' && node.kind !== 'trigger') return false;
  const mode = String((node.config && node.config.mode) || 'button').toLowerCase();
  return mode === 'button' || mode === 'manual';
}

function flowHasButtonTrigger(flow) {
  return collectNodes(flow).some(isButtonTriggerNode);
}

function flowHasValidation(flow) {
  return collectNodes(flow).some((n) => {
    const id = String(n && n.brickId || '');
    return id === 'validation' || id === 'human-doc-review';
  });
}

/** Play / Lancer ou validation — run léger, pas une App. */
function hasUserSurface(flow) {
  return flowHasButtonTrigger(flow) || flowHasValidation(flow);
}

function countAppPages(flow) {
  return normalizeAppConfig(flow && flow.app).pages.length;
}

/** App = plusieurs pages user. Play + validation = run + modal, pas une App. */
function hasAppSurface(flow) {
  return countAppPages(flow) > 1;
}

function resolveAppPublished(flow) {
  const app = normalizeAppConfig(flow && flow.app);
  if (app.publish === 'yes') return true;
  if (app.publish === 'no') return false;
  return hasAppSurface(flow);
}

const PALETTE_FAMILIES = new Set(['action', 'data', 'ia', 'output']);

function normalizePaletteConfig(palette) {
  const raw = palette && typeof palette === 'object' ? palette : {};
  const family = String(raw.parentFamily || 'action').trim();
  return {
    publish: raw.publish === true || raw.publish === 'yes',
    iconEmoji: String(raw.iconEmoji != null ? raw.iconEmoji : '🪝').trim() || '🪝',
    parentFamily: PALETTE_FAMILIES.has(family) ? family : 'action',
    hookSurface: String(raw.hookSurface || 'palette').trim() || 'palette',
    rowId: String(raw.rowId || '').trim(),
    description: String(raw.description || '').trim()
  };
}

function enrichFlowApp(flow) {
  if (!flow) return flow;
  const app = normalizeAppConfig(flow.app);
  const palette = normalizePaletteConfig(flow.palette);
  return {
    ...flow,
    app,
    palette,
    hasUserSurface: hasUserSurface(flow),
    hasAppSurface: hasAppSurface(flow),
    appPageCount: countAppPages({ ...flow, app }),
    hasButtonTrigger: flowHasButtonTrigger(flow),
    hasValidation: flowHasValidation(flow),
    appPublished: resolveAppPublished({ ...flow, app }),
    palettePublished: !!palette.publish
  };
}

module.exports = {
  normalizeAppConfig,
  normalizeAppPage,
  normalizePaletteConfig,
  flowHasButtonTrigger,
  flowHasValidation,
  hasUserSurface,
  hasAppSurface,
  countAppPages,
  resolveAppPublished,
  enrichFlowApp
};
