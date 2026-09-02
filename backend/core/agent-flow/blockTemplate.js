/**
 * Template lié à un bloc (IA / Sortie / Validation) : mapping + rendu.
 * Pas une étape du graphe — config.templateId sur le bloc.
 */

const { ObjectId } = require('mongodb');
const { resolveSlot, resolveSlotString } = require('./inputMapping');

const USAGE_KINDS = {
  ia: ['prompt'],
  output: ['html', 'word', 'canvas'],
  validation: ['html', 'word', 'canvas']
};

function normalizeKind(raw) {
  const kind = String(raw || '').trim().toLowerCase();
  if (kind === 'prompt' || kind === 'prompt-ia' || kind === 'prompt_ia' || kind === 'prompt ia') {
    return 'prompt';
  }
  if (kind === 'html') return 'html';
  if (kind === 'canvas' || kind === 'a4') return 'canvas';
  if (kind === 'word') return 'word';
  return '';
}

function kindOfTemplateDoc(doc) {
  if (!doc || typeof doc !== 'object') return '';
  const raw = normalizeKind(doc.kind || doc.type);
  const name = String(doc.name || '').trim().toLowerCase();
  const content = String(doc.content || '');

  if (doc.promptConfig && typeof doc.promptConfig === 'object') return 'prompt';
  if (doc.documentMode === 'canvas'
    || Array.isArray(doc.nodes)
    || (doc.page && (doc.page.format || doc.page.widthMm))) {
    return 'canvas';
  }
  if (raw === 'prompt' || raw === 'html' || raw === 'canvas') return raw;

  if (name.includes('prompt')) return 'prompt';
  if (name.includes('a4') || name.includes('canvas') || name.includes('mise en page')) return 'canvas';

  if (raw === 'word') return 'word';
  if (doc.structure && (Array.isArray(doc.structure.sections) || Array.isArray(doc.structure.blocks))) {
    return 'word';
  }
  if (content && /<\/[a-z][\w:-]*>/i.test(content)) return 'html';
  return '';
}

function kindsForUsage(usage, provider) {
  const u = String(usage || '').toLowerCase();
  const p = String(provider || '').toLowerCase();
  if (u === 'ia') return ['prompt'];
  if (u === 'page') return ['html'];
  if (u === 'output' && (p === 'mail' || p === 'email')) return ['html'];
  if (u === 'output' || u === 'validation') return ['html', 'word', 'canvas'];
  return null;
}

function templateIdOf(doc) {
  if (!doc) return '';
  const id = doc._id || doc.id;
  if (id && typeof id === 'object') return String(id.$oid || id);
  return String(id || '');
}

function extractPlaceholders(content) {
  const found = [];
  const seen = {};
  String(content || '').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    const k = String(key || '').trim();
    if (!k || seen[k]) return '';
    seen[k] = true;
    found.push(k);
    return '';
  });
  return found;
}

/** Zones interchangeables : `{{>data}}` dans un template de base. */
function includeRe() {
  return /\{\{\s*>\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;
}

function extractIncludeHoles(content) {
  const found = [];
  const seen = {};
  const add = (name) => {
    const k = String(name || '').trim();
    if (!k || seen[k]) return;
    seen[k] = true;
    found.push(k);
  };
  String(content || '').replace(includeRe(), (_, name) => {
    add(name);
    return '';
  });
  String(content || '').replace(/\bdata-zone=["']([a-zA-Z][a-zA-Z0-9_]*)["']/g, (_, name) => {
    add(name);
    return '';
  });
  return found;
}

function injectIncludes(html, renderedByHole) {
  const map = renderedByHole && typeof renderedByHole === 'object' ? renderedByHole : {};
  let out = String(html || '').replace(includeRe(), (_, name) => {
    const k = String(name || '').trim();
    if (Object.prototype.hasOwnProperty.call(map, k)) {
      const chunk = String(map[k] == null ? '' : map[k]).trim();
      if (chunk) return chunk;
    }
    return '';
  });
  Object.keys(map).forEach((k) => {
    const chunk = String(map[k] == null ? '' : map[k]).trim();
    if (!chunk) return;
    const re = new RegExp(
      '(<section[^>]*data-zone="' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>)([\\s\\S]*?)(<\\/section>)',
      'i'
    );
    if (re.test(out)) {
      out = out.replace(re, `$1\n${chunk}\n    $3`);
    }
  });
  if (out.indexOf('{{>') < 0) {
    const leftovers = Object.keys(map)
      .map((k) => map[k])
      .filter((chunk) => String(chunk || '').trim());
    if (leftovers.length && !extractIncludeHoles(html).length) {
      out += leftovers.join('');
    }
  }
  return out;
}

function contentForIncludes(doc) {
  if (!doc) return '';
  const parts = [doc.content];
  if (doc.nodes) parts.push(JSON.stringify(doc.nodes));
  if (doc.html) parts.push(doc.html);
  return parts.filter(Boolean).join('\n');
}

function extractLoopKeys(content) {
  const found = [];
  const seen = {};
  const push = (key) => {
    const k = String(key || '').trim();
    if (!k || seen[k]) return;
    seen[k] = true;
    found.push(k);
  };
  String(content || '').replace(/\{\{\s*#(?:each\s+)?([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    push(key);
    return '';
  });
  String(content || '').replace(/\{\{\s*\/\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    push(key);
    return '';
  });
  return found;
}

const ITEM_ENVELOPE_KEYS = new Set(['items', 'item', 'itemsCount', 'itemIndex']);

function isEnvelopeMetaKey(key) {
  const local = String(key || '').split('.').pop();
  return local === 'itemsCount' || local === 'itemIndex';
}

function isEnvelopeKey(key) {
  const local = String(key || '').split('.').pop();
  return ITEM_ENVELOPE_KEYS.has(local);
}

function slugFieldKey(raw, fallback) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return s || fallback || '';
}

function sourceSlugOf(src, fallback) {
  if (src && src.slug) return slugFieldKey(src.slug, fallback) || fallback || 'items';
  if (src && src.provider) return slugFieldKey(src.provider, fallback) || fallback || 'items';
  if (src && src.label) return slugFieldKey(src.label, fallback) || fallback || 'items';
  if (src && src.id && String(src.id).indexOf('col:') !== 0) {
    return slugFieldKey(src.id, fallback) || fallback || 'items';
  }
  return slugFieldKey(fallback, 'items') || 'items';
}

function rowFieldsOfSource(src) {
  const raw = (src && Array.isArray(src.fields) ? src.fields : []) || [];
  const seen = {};
  const out = [];
  raw.forEach((field) => {
    const key = String((field && (field.key || field.name)) || '').trim();
    if (!key || isEnvelopeKey(key) || seen[key]) return;
    seen[key] = true;
    const insertKey = String(field.insertKey || key.split('.').pop() || key).trim();
    out.push({
      key,
      insertKey,
      label: (field && (field.label || field.key || field.name)) || key,
      premap: String((field && (field.premap || field.premapKey)) || key.split('.').pop())
    });
  });
  return out;
}

function slotLabel(key) {
  const parts = String(key || '').split('.');
  const last = parts[parts.length - 1] || key;
  const known = {
    intention: 'Intention',
    intention_principale: 'Intention',
    confiance: 'Confiance',
    confidence: 'Confiance',
    resume: 'Résumé',
    résumé: 'Résumé',
    summary: 'Résumé'
  };
  if (known[last] || known[String(last).toLowerCase()]) {
    return known[last] || known[String(last).toLowerCase()];
  }
  return last.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const OUTPUT_SKIP_KEYS = new Set([
  'prompt', 'context', 'rag', 'llmId', 'llm', 'model', 'temperature', 'maxTokens', 'max_tokens',
  'response', 'rendered', 'success', 'type', 'mode', 'item', 'items', 'itemsCount', 'itemIndex'
]);

function jsonObjectSlice(text) {
  const s = String(text || '');
  const iArr = s.indexOf('[');
  const iObj = s.indexOf('{');
  if (iArr >= 0 && (iObj < 0 || iArr < iObj)) {
    const end = s.lastIndexOf(']');
    if (end > iArr) return s.slice(iArr, end + 1);
  }
  const start = s.lastIndexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return '';
  return s.slice(start, end + 1);
}

function outputFieldsFromHint(hint) {
  const text = String(hint || '').trim();
  if (!text) return [];
  const slice = jsonObjectSlice(text) || text;
  let obj = null;
  try {
    const parsed = JSON.parse(slice);
    if (Array.isArray(parsed)) {
      obj = parsed.find((row) => row && typeof row === 'object' && !Array.isArray(row)) || null;
    } else if (parsed && typeof parsed === 'object') {
      obj = parsed;
    }
  } catch (_) {
    obj = null;
  }
  const keys = [];
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    Object.keys(obj).forEach((key) => keys.push(key));
  } else {
    const re = /["“”']([a-zA-Z_][a-zA-Z0-9_]*)["“”']\s*:/g;
    let m = re.exec(slice);
    while (m) {
      keys.push(m[1]);
      m = re.exec(slice);
    }
  }
  const seen = {};
  const out = [];
  keys.forEach((key) => {
    const k = String(key || '').trim();
    if (!k || seen[k] || OUTPUT_SKIP_KEYS.has(k)) return;
    seen[k] = true;
    const sample = obj && Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : undefined;
    let type = 'text';
    if (typeof sample === 'number') type = 'number';
    else if (typeof sample === 'boolean') type = 'boolean';
    else if (sample && typeof sample === 'object') type = Array.isArray(sample) ? 'array' : 'object';
    out.push({
      key: k,
      label: slotLabel(k),
      type,
      example: sample
    });
  });
  return out;
}

function pushSlot(out, seen, key, extra) {
  const k = String(key || '').trim();
  if (!k || seen[k]) return;
  seen[k] = true;
  out.push({
    key: k,
    label: extra && extra.label ? extra.label : slotLabel(k),
    group: extra && extra.group ? extra.group : (k.indexOf('.') >= 0 ? k.split('.')[0] : 'Template'),
    premap: extra && extra.premap ? extra.premap : '',
    type: extra && extra.type ? extra.type : '',
    completeItem: !!(extra && extra.completeItem),
    provider: extra && extra.provider ? String(extra.provider) : '',
    sourceSlug: extra && extra.sourceSlug ? String(extra.sourceSlug) : ''
  });
}

function collectionAlias(entry, fallback) {
  if (!entry || typeof entry !== 'object') return fallback || 'item';
  return String(entry.alias || entry.name || fallback || 'item').trim() || fallback || 'item';
}

function fieldsOfCollection(entry, loaded) {
  if (Array.isArray(entry && entry.fields) && entry.fields.length) return entry.fields;
  if (loaded && Array.isArray(loaded.fields)) return loaded.fields;
  return [];
}

async function loadCollectionsById(entrepriseDb, ids) {
  const uniq = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const map = {};
  if (!uniq.length) return map;
  const objectIds = uniq.filter((id) => ObjectId.isValid(id) && String(id).length === 24)
    .map((id) => new ObjectId(id));
  if (!objectIds.length) return map;
  const rows = await entrepriseDb.collection('collections')
    .find({ _id: { $in: objectIds } })
    .project({ name: 1, slug: 1, fields: 1 })
    .toArray();
  rows.forEach((row) => {
    map[String(row._id)] = row;
  });
  return map;
}

function collectionIdOf(entry) {
  if (!entry) return '';
  const id = entry.collectionId || entry._id || entry.id;
  return id ? String(id) : '';
}

const IA_CONTRACT_KEYS = new Set(['prompt', 'context', 'rag', 'llmId', 'llm', 'model', 'temperature', 'maxTokens', 'max_tokens']);

async function slotsFromTemplate(entrepriseDb, template) {
  const slots = [];
  const seen = {};
  const kind = kindOfTemplateDoc(template);
  const promptLike = kind === 'prompt';
  const values = promptValuesOf(template);
  const nodeHtml = (Array.isArray(template && template.nodes) ? template.nodes : [])
    .map((n) => (n && n.content && n.content.html) || '')
    .join('\n');
  const contentText = `${template && template.content}\n${nodeHtml}\n${values.prompt}\n${values.context}\n${values.rag}\n${values.outputHint}`;
  const placeholders = extractPlaceholders(contentText);
  const loops = extractLoopKeys(contentText);
  const sources = Array.isArray(template && template.inputSources) ? template.inputSources : [];

  if (promptLike) {
    sources.forEach((src) => {
      const slug = sourceSlugOf(src, src && src.id);
      const fields = rowFieldsOfSource(src);
      const prefix = slug + '.';
      const usedFields = [];
      const usedComplete = placeholders.indexOf(slug) >= 0;
      const usedLoop = loops.indexOf(slug) >= 0;
      placeholders.forEach((key) => {
        if (key === slug || isEnvelopeMetaKey(key)) return;
        if (key.indexOf(prefix) !== 0) return;
        const local = key.slice(prefix.length);
        if (local === 'length' || local === 'name') return;
        const match = fields.find((f) => f.insertKey === local || f.key === local || f.key.split('.').pop() === local);
        usedFields.push({
          key,
          label: match ? match.label : local,
          premap: match ? match.premap : local
        });
      });
      if (!usedComplete && !usedLoop && !usedFields.length) return;
      const groupLabel = (src && src.label) || slug;
      if (usedComplete || usedLoop) {
        pushSlot(slots, seen, slug, {
          label: `${groupLabel} (item complet)`,
          group: groupLabel,
          premap: 'item',
          type: 'object',
          completeItem: true,
          provider: src && src.provider,
          sourceSlug: slug
        });
      }
      usedFields.forEach((f) => {
        if (IA_CONTRACT_KEYS.has(f.key)) return;
        pushSlot(slots, seen, f.key, {
          label: f.label,
          group: groupLabel,
          premap: f.premap,
          provider: src && src.provider,
          sourceSlug: slug
        });
      });
    });
    placeholders.forEach((key) => {
      if (!key || IA_CONTRACT_KEYS.has(key) || isEnvelopeMetaKey(key) || seen[key]) return;
      if (key === 'today' || key === 'date') return;
      if (/\.length$/.test(key) || /\.name$/.test(key)) return;
      const isItem = key === 'item' || key.split('.').pop() === 'item';
      const isTable = key === 'items' || key.split('.').pop() === 'items';
      const prefix = key.indexOf('.') >= 0 ? key.split('.')[0] : '';
      const matchedSrc = sources.find((s) => sourceSlugOf(s, s && s.id) === prefix)
        || ((isItem || isTable) && sources.length === 1 ? sources[0] : null);
      pushSlot(slots, seen, key, {
        label: isItem ? 'Item (ligne courante)' : (isTable ? 'Tableau (toutes les lignes)' : slotLabel(key)),
        group: prefix || ((matchedSrc && matchedSrc.label) || 'Template'),
        premap: isItem ? 'item' : (isTable ? 'items' : key.split('.').pop()),
        type: isTable ? 'array' : (isItem ? 'object' : ''),
        completeItem: isItem || isTable,
        provider: matchedSrc && matchedSrc.provider,
        sourceSlug: matchedSrc ? sourceSlugOf(matchedSrc, matchedSrc.id) : prefix
      });
    });
    loops.forEach((key) => {
      if (!key || IA_CONTRACT_KEYS.has(key) || isEnvelopeMetaKey(key) || seen[key]) return;
      const matchedSrc = sources.find((s) => sourceSlugOf(s, s && s.id) === key)
        || (sources.length === 1 ? sources[0] : null);
      pushSlot(slots, seen, key, {
        label: `${slotLabel(key)} (item complet)`,
        group: key,
        premap: 'item',
        type: 'object',
        completeItem: true,
        provider: matchedSrc && matchedSrc.provider,
        sourceSlug: matchedSrc ? sourceSlugOf(matchedSrc, matchedSrc.id) : key
      });
    });
    return slots;
  }

  const bound = [];
  if (template && template.defaultCollection) bound.push({ entry: template.defaultCollection, isDefault: true });
  if (template && Array.isArray(template.additionalCollections)) {
    template.additionalCollections.forEach((c) => bound.push({ entry: c, isDefault: false }));
  }
  const colMap = await loadCollectionsById(
    entrepriseDb,
    bound.map((row) => collectionIdOf(row.entry))
  );

  bound.forEach((row) => {
    const entry = row.entry;
    const loaded = colMap[collectionIdOf(entry)] || null;
    const alias = collectionAlias(entry, row.isDefault && promptLike ? '' : 'item');
    fieldsOfCollection(entry, loaded).forEach((field) => {
      const name = String((field && (field.name || field.id || field.key)) || '').trim();
      if (!name || IA_CONTRACT_KEYS.has(name) || isEnvelopeKey(name)) return;
      const key = (promptLike && row.isDefault) || !alias ? name : `${alias}.${name}`;
      pushSlot(slots, seen, key, {
        label: field.label || slotLabel(name),
        group: alias || 'Template',
        premap: field.premap || field.premapKey || name
      });
    });
  });

  const legacyVars = template && template.promptConfig && Array.isArray(template.promptConfig.variables)
    ? template.promptConfig.variables
    : [];
  legacyVars.forEach((raw) => {
    const key = String(raw || '').trim();
    if (!key || IA_CONTRACT_KEYS.has(key) || isEnvelopeKey(key)) return;
    pushSlot(slots, seen, key, { group: 'Template' });
  });

  placeholders.forEach((key) => {
    if (IA_CONTRACT_KEYS.has(key) || isEnvelopeMetaKey(key)) return;
    const isItem = key === 'item' || key.split('.').pop() === 'item';
    const isTable = key === 'items' || key.split('.').pop() === 'items';
    pushSlot(slots, seen, key, {
      label: isItem ? 'Item (ligne courante)' : (isTable ? 'Tableau (toutes les lignes)' : slotLabel(key)),
      group: key.indexOf('.') >= 0 ? key.split('.')[0] : 'Template',
      premap: isItem ? 'item' : (isTable ? 'items' : ''),
      type: isTable ? 'array' : (isItem ? 'object' : ''),
      completeItem: isItem || isTable
    });
  });
  loops.forEach((key) => {
    if (IA_CONTRACT_KEYS.has(key) || isEnvelopeMetaKey(key) || seen[key]) return;
    pushSlot(slots, seen, key, {
      label: `${slotLabel(key)} (item complet)`,
      group: key,
      premap: 'item',
      type: 'object',
      completeItem: true
    });
  });

  return slots;
}

function promptValuesOf(doc) {
  const cfg = (doc && doc.promptConfig && typeof doc.promptConfig === 'object')
    ? doc.promptConfig
    : {};
  const values = cfg.values && typeof cfg.values === 'object' ? cfg.values : {};
  const hint = String(
    cfg.outputHint
    || values.outputHint
    || ''
  ).trim();
  const content = String((doc && doc.content) || '');
  return {
    prompt: String(values.prompt != null ? values.prompt : (cfg.instruction || '')),
    context: String(values.context != null ? values.context : (cfg.role || cfg.context || '')),
    rag: String(values.rag != null ? values.rag : ''),
    outputHint: hint || jsonObjectSlice(content),
    outputFormat: cfg.outputFormat === 'json'
      || values.outputFormat === 'json'
      || /Réponds uniquement en JSON/i.test(content)
      || !!jsonObjectSlice(hint || content)
      ? 'json'
      : 'text'
  };
}

function hasDocumentBody(doc) {
  if (!doc || typeof doc !== 'object') return false;
  if (String(doc.content || '').trim()) return true;
  if (Array.isArray(doc.nodes) && doc.nodes.length) return true;
  if (doc.structure && (Array.isArray(doc.structure.sections) || Array.isArray(doc.structure.blocks))) {
    return (doc.structure.sections || doc.structure.blocks || []).length > 0;
  }
  return false;
}

function contractOverlayFromTemplate(doc) {
  const cfg = (doc && doc.promptConfig && typeof doc.promptConfig === 'object')
    ? doc.promptConfig
    : {};
  const explicit = (cfg.fills && typeof cfg.fills === 'object')
    ? cfg.fills
    : ((doc && doc.fills && typeof doc.fills === 'object') ? doc.fills : null);
  const kind = kindOfTemplateDoc(doc);
  const bool = (explicitVal, inferred) => (explicitVal == null ? inferred : !!explicitVal);
  if (kind === 'prompt') {
    const values = promptValuesOf(doc);
    const content = String((doc && doc.content) || '').trim();
    const inferredPrompt = !!(values.prompt.trim() || (!cfg.values && content));
    return {
      prompt: inferredPrompt,
      context: !!values.context.trim(),
      rag: !!values.rag.trim()
    };
  }
  const hasBody = hasDocumentBody(doc);
  return {
    body: bool(explicit && explicit.body, hasBody),
    message: bool(explicit && explicit.message, hasBody)
  };
}

function serializeTemplate(doc, slots) {
  if (!doc) return null;
  const kind = kindOfTemplateDoc(doc);
  const cfg = (doc.promptConfig && typeof doc.promptConfig === 'object') ? doc.promptConfig : {};
  const fromCfg = cfg.contract && typeof cfg.contract === 'object' ? cfg.contract : {};
  const fromDoc = doc.blockContract && typeof doc.blockContract === 'object' ? doc.blockContract : {};
  const defaultBrick = kind === 'prompt' ? 'ia' : 'output';
  const values = kind === 'prompt' ? promptValuesOf(doc) : null;
  const outputs = values ? outputFieldsFromHint(values.outputHint) : [];
  return {
    id: templateIdOf(doc),
    name: String(doc.name || 'Sans nom'),
    kind,
    content: String(doc.content || ''),
    contract: {
      brickId: String(fromCfg.brickId || fromDoc.brickId || defaultBrick),
      version: String(fromCfg.version || fromDoc.version || '1.0.0')
    },
    fills: contractOverlayFromTemplate(doc, slots || []),
    outputFormat: values ? values.outputFormat : '',
    outputHint: values ? values.outputHint : '',
    outputs,
    includes: extractIncludeHoles(contentForIncludes(doc))
  };
}

async function getEntrepriseDb(database, entrepriseId) {
  if (!database || typeof database.getEntrepriseDb !== 'function') {
    throw new Error('Base entreprise indisponible');
  }
  const eid = String(entrepriseId || '').trim();
  if (!eid) throw new Error('Entité non définie');
  return database.getEntrepriseDb(eid);
}

async function listTemplates(database, entrepriseId, usage, provider) {
  const kinds = kindsForUsage(usage, provider);
  if (!kinds || !kinds.length) return [];
  const entrepriseDb = await getEntrepriseDb(database, entrepriseId);
  const rows = await entrepriseDb.collection('templates')
    .find({})
    .project({
      name: 1,
      kind: 1,
      type: 1,
      promptConfig: 1,
      blockContract: 1,
      fills: 1,
      documentMode: 1,
      page: 1,
      nodes: 1,
      structure: 1,
      content: 1,
      updatedAt: 1
    })
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray();
  return rows.map((doc) => {
    const packed = serializeTemplate(doc);
    if (!packed || !packed.kind || !kinds.includes(packed.kind)) return null;
    return {
      id: packed.id,
      name: packed.name,
      kind: packed.kind,
      contract: packed.contract,
      fills: packed.fills
    };
  }).filter(Boolean);
}

async function loadTemplateDoc(entrepriseDb, templateId) {
  const id = String(templateId || '').trim();
  if (!id || !ObjectId.isValid(id) || String(id).length !== 24) return null;
  return entrepriseDb.collection('templates').findOne({ _id: new ObjectId(id) });
}

async function getTemplateWithSlots(database, entrepriseId, templateId) {
  const entrepriseDb = await getEntrepriseDb(database, entrepriseId);
  const doc = await loadTemplateDoc(entrepriseDb, templateId);
  if (!doc) return null;
  const slots = await slotsFromTemplate(entrepriseDb, doc);
  return { template: serializeTemplate(doc, slots), slots, raw: doc };
}

function readMappedValue(executor, config, context, slotKey) {
  const mapped = resolveSlotString(executor, config, slotKey, context);
  if (mapped !== undefined) return mapped;
  const fromContext = executor.readContextField(context, slotKey);
  if (fromContext != null && fromContext !== '') {
    if (typeof fromContext === 'object') {
      try { return JSON.stringify(fromContext); } catch (_) { return ''; }
    }
    return String(fromContext);
  }
  if (slotKey.indexOf('.') >= 0) {
    const last = slotKey.split('.').pop();
    const local = executor.readContextField(context, last);
    if (local != null && local !== '') {
      if (typeof local === 'object') {
        try { return JSON.stringify(local); } catch (_) { return ''; }
      }
      return String(local);
    }
  }
  return '';
}

function buildVariables(executor, config, context, slots) {
  const simple = {};
  const collections = {};
  (slots || []).forEach((slot) => {
    const key = slot.key;
    const value = readMappedValue(executor, config, context, key);
    if (key.indexOf('.') >= 0) {
      const parts = key.split('.');
      const alias = parts.shift();
      const field = parts.join('.');
      if (!collections[alias]) collections[alias] = { values: {} };
      collections[alias].values[field] = value;
    } else {
      simple[key] = value;
    }
  });
  return { simple, collections };
}

function readMappedRaw(executor, config, context, slotKey) {
  const resolved = resolveSlot(executor, config, slotKey, context);
  if (resolved.mapped && resolved.value !== undefined && resolved.value !== '') {
    return resolved.value;
  }
  const fromContext = executor.readContextField(context, slotKey);
  if (fromContext != null && fromContext !== '') return fromContext;
  if (slotKey.indexOf('.') >= 0) {
    const last = slotKey.split('.').pop();
    const local = executor.readContextField(context, last);
    if (local != null && local !== '') return local;
  }
  return undefined;
}

function interpolationLocals(executor, config, context, slots) {
  const locals = {};
  (slots || []).forEach((slot) => {
    if (!slot || !slot.key) return;
    const val = readMappedRaw(executor, config, context, slot.key);
    if (val === undefined) return;
    if (slot.completeItem || slot.type === 'array' || slot.type === 'object') {
      locals[slot.key] = val;
      return;
    }
    if (slot.key.indexOf('.') >= 0) {
      const parts = slot.key.split('.');
      const alias = parts.shift();
      const field = parts.join('.');
      if (!locals[alias] || typeof locals[alias] !== 'object' || Array.isArray(locals[alias])) {
        locals[alias] = {};
      }
      locals[alias][field] = val;
      return;
    }
    locals[slot.key] = val;
  });
  return locals;
}

function interpolatePrompt(content, variables) {
  let out = String(content || '');
  const simple = (variables && variables.simple) || {};
  Object.keys(simple).forEach((key) => {
    out = out.replace(new RegExp('\\{\\{\\s*' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\}\\}', 'g'), String(simple[key] ?? ''));
  });
  const collections = (variables && variables.collections) || {};
  Object.keys(collections).forEach((alias) => {
    const values = collections[alias] && collections[alias].values ? collections[alias].values : {};
    Object.keys(values).forEach((field) => {
      const token = `${alias}.${field}`;
      out = out.replace(new RegExp('\\{\\{\\s*' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\}\\}', 'g'), String(values[field] ?? ''));
    });
  });
  out = out.replace(/\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/g, '');
  return out;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function renderCanvasHtml(templateId, variables) {
  const path = require('path');
  let HtmlRenderService;
  let svc;
  try {
    HtmlRenderService = require(path.resolve(
      __dirname,
      '../../modules/agent-documentaire-v2/services/HtmlRenderService.js'
    ));
    const { getTemplateService } = require(path.resolve(
      __dirname,
      '../../modules/agent-documentaire-v2/service-container.js'
    ));
    svc = getTemplateService();
  } catch (err) {
    throw new Error('Template canvas indisponible : ' + err.message);
  }
  if (svc && typeof svc.init === 'function' && !svc.collection) {
    await svc.init();
  }
  const ns = `v3:${String(templateId)}`;
  const canvas = await svc.getByNamespace(ns);
  if (!canvas) {
    throw new Error(`Template canvas « ${ns} » introuvable — ouvrez-le une fois dans l’éditeur A4`);
  }
  const flat = { ...((variables && variables.simple) || {}) };
  const collections = (variables && variables.collections) || {};
  Object.keys(collections).forEach((alias) => {
    const values = collections[alias] && collections[alias].values ? collections[alias].values : {};
    Object.keys(values).forEach((field) => {
      flat[`${alias}.${field}`] = values[field];
      if (flat[field] == null) flat[field] = values[field];
    });
  });
  return HtmlRenderService.renderTemplate(canvas, flat);
}

async function renderBound(executor, flow, config, context) {
  const templateId = String((config && config.templateId) || '').trim();
  if (!templateId) return null;
  const entrepriseId = flow && flow.entrepriseId;
  const packed = await getTemplateWithSlots(executor.database, entrepriseId, templateId);
  if (!packed || !packed.raw) {
    throw new Error(`Template « ${templateId} » introuvable`);
  }
  const kind = kindOfTemplateDoc(packed.raw);
  const variables = buildVariables(executor, config, context, packed.slots);
  const locals = interpolationLocals(executor, config, context, packed.slots);
  let html = '';
  let text = '';
  let iaParts = null;
  if (kind === 'prompt') {
    const values = promptValuesOf(packed.raw);
    const fills = contractOverlayFromTemplate(packed.raw);
    const interp = (chunk) => {
      if (executor.interpolateCompose) {
        return executor.interpolateCompose(chunk, context, locals);
      }
      return interpolatePrompt(chunk, variables);
    };
    const promptSrc = String(values.prompt || '').trim()
      ? values.prompt
      : String((packed.raw && packed.raw.content) || '');
    iaParts = {
      fills,
      prompt: fills.prompt ? interp(promptSrc) : '',
      context: fills.context ? interp(values.context) : '',
      rag: fills.rag ? interp(values.rag) : '',
      outputHint: interp(values.outputHint),
      outputFormat: values.outputFormat
    };
    text = interp(packed.raw.content);
  } else if (kind === 'canvas') {
    html = await renderCanvasHtml(packed.template.id, variables);
    text = stripHtml(html);
  } else {
    const DocumentGenerationService = require('../../modules/doc-template/services/DocumentGenerationService');
    html = DocumentGenerationService.generateContent(packed.raw, variables);
    if (executor.interpolateCompose) {
      html = executor.interpolateCompose(html, context);
    }
    text = stripHtml(html);
  }
  const depth = Number((config && config._includeDepth) || 0);
  const subMap = (config && config.subTemplates && typeof config.subTemplates === 'object')
    ? config.subTemplates
    : {};
  const holes = packed.template.includes && packed.template.includes.length
    ? packed.template.includes
    : Object.keys(subMap);
  if (kind !== 'prompt' && depth < 3 && holes.length) {
    const renderedByHole = {};
    for (const hole of holes) {
      const subId = String(subMap[hole] || '').trim();
      if (!subId || subId === templateId) {
        renderedByHole[hole] = '';
        continue;
      }
      const nested = await renderBound(executor, flow, {
        ...config,
        templateId: subId,
        subTemplates: {},
        _includeDepth: depth + 1
      }, context);
      renderedByHole[hole] = String((nested && (nested.html || nested.text)) || '');
    }
    html = injectIncludes(html, renderedByHole);
    text = stripHtml(html);
  }
  const design = (flow && flow.vizDesign)
    || (config && config.design)
    || null;
  if (design && html) {
    const { applyDesignTokens } = require('./vizDesign');
    html = applyDesignTokens(html, design);
  }
  return {
    templateId: packed.template.id,
    name: packed.template.name,
    kind,
    html,
    text,
    fills: packed.template.fills || null,
    iaParts,
    includes: packed.template.includes || [],
    subject: String((variables.simple && variables.simple.subject) || ''),
    fields: variables
  };
}

module.exports = {
  USAGE_KINDS,
  normalizeKind,
  kindOfTemplateDoc,
  kindsForUsage,
  listTemplates,
  getTemplateWithSlots,
  renderBound,
  contractOverlayFromTemplate,
  extractPlaceholders,
  extractIncludeHoles,
  outputFieldsFromHint
};
