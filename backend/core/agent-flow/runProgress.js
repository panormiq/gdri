/**
 * Vue progression d'un run : ordre des nœuds + statut (pending / running / done…).
 */

const { allOutgoingIds } = require('./flowGraph');
const { namespaceBag, nsOrder } = require('./nodeNamespace');

function canvasNodes(flow) {
  return flow && flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
}

function walkNodeOrder(flow) {
  const nodes = canvasNodes(flow);
  if (!nodes.length) {
    const steps = Array.isArray(flow && flow.steps) ? flow.steps : [];
    return steps.map((s, i) => ({
      id: s.id || `step-${i + 1}`,
      brickId: s.brickId,
      name: s.name || s.brickId,
      kind: s.kind || 'action'
    }));
  }
  const byId = {};
  nodes.forEach((n) => {
    if (n && n.id) byId[n.id] = n;
  });
  const order = [];
  const seen = {};
  const start =
    nodes.find((n) => n.kind === 'trigger' || n.brickId === 'trigger') || nodes[0];

  function walk(id) {
    let guard = 0;
    const stack = id ? [id] : [];
    while (stack.length && guard < 200) {
      guard += 1;
      const cur = stack.shift();
      if (!cur || seen[cur]) continue;
      seen[cur] = true;
      const n = byId[cur];
      if (!n) continue;
      order.push(n);
      allOutgoingIds(n).forEach((next) => {
        if (byId[next] && !seen[next]) stack.push(next);
      });
    }
  }

  if (start) walk(start.id);
  nodes.forEach((n) => {
    if (n && n.id && !seen[n.id]) order.push(n);
  });
  return order;
}

function stepByNodeId(run) {
  const map = {};
  const steps = Array.isArray(run && run.steps) ? run.steps : [];
  steps.forEach((s) => {
    const id = s && (s.stepId || s.id);
    if (id) map[String(id)] = s;
  });
  return map;
}

function clip(value, max) {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const n = Number(max) || 160;
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

const ITEM_CELL_KEYS = [
  'from', 'subject', 'intention', 'intention_principale', 'confiance', 'confidence',
  'resume', 'text', 'body', 'name', 'id', 'label', 'definition', 'to',
  'condition', 'field', 'op', 'value', 'actual', 'success', 'rendered'
];

function cellValue(rec, key) {
  if (!rec || typeof rec !== 'object') return undefined;
  if (key === 'from' && rec.from == null && rec.author) {
    return rec.author.email || rec.author.name;
  }
  return rec[key];
}

function itemCells(rec) {
  const cells = {};
  ITEM_CELL_KEYS.forEach((key) => {
    const raw = cellValue(rec, key);
    if (raw == null || raw === '') return;
    if (typeof raw === 'object') return;
    cells[key] = clip(raw, key === 'text' || key === 'body' || key === 'resume' || key === 'definition' || key === 'rendered' ? 180 : 80);
  });
  return cells;
}

function syntheticOutputRows(output) {
  if (!output || typeof output !== 'object') return [];
  const row = {};
  let any = false;
  ITEM_CELL_KEYS.forEach((key) => {
    const raw = output[key];
    if (raw == null || raw === '' || typeof raw === 'object') return;
    row[key] = raw;
    any = true;
  });
  return any ? [row] : [];
}

function summarizeItems(output) {
  const items = Array.isArray(output && output.items) && output.items.length
    ? output.items
    : syntheticOutputRows(output);
  return items.slice(0, 20).map((row, index) => {
    const rec = row && typeof row === 'object' ? row : { text: row };
    const cells = itemCells(rec);
    return {
      index,
      name: cells.name || cells.label || cells.id || '',
      from: cells.from || '',
      subject: cells.subject || '',
      text: cells.text || cells.body || cells.resume || '',
      intention: cells.intention || cells.intention_principale || '',
      confiance: (cells.confiance != null && cells.confiance !== '')
        ? cells.confiance
        : (cells.confidence != null && cells.confidence !== '' ? cells.confidence : ''),
      resume: cells.resume || '',
      cells
    };
  });
}

function snapshotIncomingTables(previous, allowedSlugs) {
  const ns = namespaceBag(previous);
  const order = nsOrder(previous);
  const allow = Array.isArray(allowedSlugs)
    ? new Set(allowedSlugs.map((s) => String(s || '').trim()).filter(Boolean))
    : null;
  const tables = [];
  order.forEach((slug) => {
    if (allow && !allow.has(slug)) return;
    const bag = ns[slug];
    if (!bag || typeof bag !== 'object') return;
    const items = Array.isArray(bag.items) ? bag.items : [];
    const count = bag.itemsCount != null ? Number(bag.itemsCount) : items.length;
    const hasTable = bag.type === 'data-message'
      || items.length > 0
      || (Number.isFinite(count) && count > 0);
    if (!hasTable) return;
    tables.push({
      slug,
      itemsCount: Number.isFinite(count) ? count : items.length,
      body: clip(bag.rendered || bag.body || '', 220) || null,
      items: summarizeItems(bag)
    });
  });
  return tables;
}

function extractOutputError(output) {
  if (!output || typeof output !== 'object') return null;
  const bits = [
    output.error,
    output.debug && output.debug.response && output.debug.response.error,
    output.cursor && output.cursor.error
  ];
  for (let i = 0; i < bits.length; i += 1) {
    const text = bits[i] != null ? String(bits[i]).trim() : '';
    if (text) return text;
  }
  return null;
}

function clipJson(value, max) {
  try {
    const text = JSON.stringify(value, (key, val) => {
      const k = String(key || '').toLowerCase();
      if (k.includes('pass') || k.includes('secret') || k.includes('token') || k.includes('credential')) {
        return val ? '***' : val;
      }
      if (typeof val === 'string' && val.length > 1500) return `${val.slice(0, 1500)}…`;
      return val;
    }, 2);
    const n = Number(max) || 4000;
    return text && text.length > n ? `${text.slice(0, n)}\n…` : text;
  } catch {
    return '';
  }
}

function summarizeMapped(mapped) {
  if (!mapped || typeof mapped !== 'object') return null;
  const out = {};
  Object.keys(mapped).slice(0, 24).forEach((key) => {
    const slot = mapped[key];
    if (slot && typeof slot === 'object') {
      out[key] = {
        from: clip(slot.from, 80),
        value: clip(slot.value, 500)
      };
      return;
    }
    out[key] = { from: '', value: clip(slot, 500) };
  });
  return Object.keys(out).length ? out : null;
}

function compactDebugItems(items) {
  return (Array.isArray(items) ? items : []).slice(0, 20).map((row, index) => {
    const rec = row && typeof row === 'object' ? row : { text: row };
    return { index, ...itemCells(rec) };
  });
}

function buildBlockIoDebug(output, brickId, mapped) {
  if (!output || typeof output !== 'object') return null;
  const id = String(brickId || '');
  if (id === 'ia') {
    return {
      request: {
        mapping: mapped || null,
        prompt: output.prompt || null,
        rendered: output.rendered || null,
        sourceItems: output.metadata && output.metadata.sourceItems
      },
      response: {
        model: output.model || null,
        raw: output.response || null,
        items: compactDebugItems(output.items),
        intention: output.intention || output.intention_principale || null,
        confiance: output.confiance != null ? output.confiance : (output.confidence != null ? output.confidence : null)
      }
    };
  }
  if (id === 'condition') {
    return {
      request: { field: output.field, op: output.op, value: output.value, mapping: mapped || null },
      response: { condition: output.condition, actual: output.actual }
    };
  }
  if (id === 'output') {
    return {
      request: {
        mapping: mapped || null,
        to: output.to || null,
        subject: output.subject || null,
        provider: output.provider || null
      },
      response: { success: output.success, email_id: output.email_id || null }
    };
  }
  if (id === 'loop') {
    return {
      request: { mode: output.mode, loopIteration: output.loopIteration, mapping: mapped || null },
      response: {
        loopContinue: output.loopContinue,
        loopDone: output.loopDone,
        itemsCount: output.itemsCount
      }
    };
  }
  if (id === 'validation') {
    return {
      request: {
        mapping: mapped || null,
        title: output.title || null,
        from: output.from || null,
        subject: output.subject || null,
        itemsCount: Array.isArray(output.items) ? output.items.length : 0
      },
      response: { waiting: true }
    };
  }
  if (id === 'trigger') {
    return {
      request: { mode: output.mode || null },
      response: { type: output.type || null }
    };
  }
  if (id === 'action') {
    return {
      request: { mapping: mapped || null, templates: output.debug && output.debug.request && output.debug.request.templates },
      response: { mode: output.mode || null, rendered: output.rendered || null, zones: output.zones || null }
    };
  }
  if (mapped) {
    return {
      request: { mapping: mapped },
      response: {
        itemsCount: Array.isArray(output.items) ? output.items.length : output.itemsCount,
        intention: output.intention || null,
        confiance: output.confiance != null ? output.confiance : output.confidence
      }
    };
  }
  return null;
}

function summarizeOutput(output, meta = {}) {
  if (!output || typeof output !== 'object') return null;
  const items = Array.isArray(output.items) ? output.items : [];
  const summarized = summarizeItems(output);
  const many = items.length > 1;
  const body = clip(
    many
      ? (output.body || output.rendered || output.response)
      : (output.body || output.rendered || output.response || output.text),
    220
  );
  const error = clip(extractOutputError(output), 240) || null;
  let count = output.itemsCount != null ? Number(output.itemsCount) : items.length;
  if (!Number.isFinite(count)) count = items.length;
  if (!count && summarized.length) count = summarized.length;
  if (!count && !items.length && body) count = 1;
  const zones = output.zones && typeof output.zones === 'object'
    ? Object.keys(output.zones).reduce((acc, key) => {
      acc[key] = clip(output.zones[key], 220);
      return acc;
    }, {})
    : null;
  const debug = output.debug && typeof output.debug === 'object'
    ? {
      request: output.debug.request || null,
      response: output.debug.response || null,
      requestText: clipJson(output.debug.request),
      responseText: clipJson(output.debug.response)
    }
    : null;
  const empty = !error && (output.empty === true || (!count && !items.length && !body && !summarized.length));
  const incoming = Array.isArray(output.__incomingTables) ? output.__incomingTables : [];
  const tables = incoming.map((t) => ({
    slug: t.slug || '',
    name: t.name || t.slug || '',
    role: 'in',
    itemsCount: t.itemsCount != null ? Number(t.itemsCount) : (Array.isArray(t.items) ? t.items.length : 0),
    body: t.body || null,
    items: Array.isArray(t.items) ? t.items : []
  }));
  tables.push({
    slug: meta.slug || '',
    name: meta.name || meta.slug || 'Sortie',
    role: 'out',
    itemsCount: count,
    body: body || null,
    items: summarized
  });
  return {
    type: output.type || null,
    empty,
    error,
    note: clip(output.note, 240) || null,
    itemsCount: count,
    from: clip(output.from, 80) || null,
    subject: clip(output.subject, 80) || null,
    to: clip(output.to, 80) || null,
    body: body || null,
    success: output.success,
    items: summarized,
    tables,
    zones,
    mapped: summarizeMapped(output.__mapped),
    debug
  };
}

function nodeStatus(node, run, byStep) {
  const step = byStep[String(node.id)];
  if (step && extractOutputError(step.output) && step.status !== 'waiting_human') return 'failed';
  if (step && step.status) return String(step.status);
  if (run && String(run.currentNodeId || '') === String(node.id)) return 'running';
  if (run && (run.status === 'completed' || run.status === 'rejected' || run.status === 'failed')) {
    return 'skipped';
  }
  return 'pending';
}

function humanOutputFromRun(run) {
  if (run && run.humanOutput && typeof run.humanOutput === 'object') return run.humanOutput;
  const steps = Array.isArray(run && run.steps) ? run.steps : [];
  const waiting = steps.find((s) => s && s.status === 'waiting_human' && s.output);
  return (waiting && waiting.output) || null;
}

function buildRunProgress(flow, run) {
  const byStep = stepByNodeId(run);
  const nodes = walkNodeOrder(flow || {});
  const nameBySlug = {};
  nodes.forEach((n) => {
    const slug = n && String(n.slug || '').trim();
    if (slug) nameBySlug[slug] = n.name || n.brickId || slug;
  });
  const items = nodes.map((n) => {
    const step = byStep[String(n.id)];
    const preview = summarizeOutput(step && step.output, {
      slug: n.slug || '',
      name: n.name || n.brickId
    });
    if (preview && Array.isArray(preview.tables)) {
      preview.tables.forEach((t) => {
        if (t.slug && nameBySlug[t.slug]) t.name = nameBySlug[t.slug];
      });
    }
    return {
      id: n.id,
      brickId: n.brickId,
      name: n.name || n.brickId,
      kind: n.kind || null,
      status: nodeStatus(n, run, byStep),
      error: (step && step.error) || extractOutputError(step && step.output) || null,
      preview
    };
  });
  const current = items.find((i) => i.status === 'running' || i.status === 'waiting_human') || null;
  return {
    items,
    currentNodeId: (run && run.currentNodeId) || (current && current.id) || null,
    humanOutput: humanOutputFromRun(run)
  };
}

function flowSnapshot(flow) {
  if (!flow) return null;
  return {
    _id: flow._id,
    name: flow.name || 'Agent',
    description: flow.description || '',
    imageUrl: flow.imageUrl || null,
    app: flow.app || null
  };
}

module.exports = {
  walkNodeOrder,
  buildRunProgress,
  humanOutputFromRun,
  flowSnapshot,
  summarizeOutput,
  extractOutputError,
  snapshotIncomingTables,
  buildBlockIoDebug
};
