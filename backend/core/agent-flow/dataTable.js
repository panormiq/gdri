/**
 * Contrat unique des données agent : toujours un tableau de lignes.
 * Un mail, un commentaire ou un document simple = 1 ligne.
 * Fichier : backend/core/agent-flow/dataTable.js
 */

const ENVELOPE_KEYS = new Set([
  'type',
  'ok',
  'provider',
  'passthrough',
  'empty',
  'items',
  'item',
  'itemsCount',
  'itemIndex',
  'json',
  'payload',
  'modelFields',
  'modelRows',
  'modelName',
  'collectionId',
  'collectionNamespace',
  'referenceFields',
  'fetched',
  'note',
  'intentions',
  'source',
  'presetId',
  'schemaSlug'
]);

function asRow(raw) {
  if (raw == null) return { text: '' };
  if (typeof raw !== 'object') {
    return { text: String(raw) };
  }
  const author = raw.author && typeof raw.author === 'object' ? raw.author : null;
  const row = {};
  Object.keys(raw).forEach((key) => {
    if (ENVELOPE_KEYS.has(key) || key.startsWith('__')) return;
    row[key] = raw[key];
  });
  if (row.text == null || row.text === '') {
    row.text = raw.text || raw.body || raw.bodyText || '';
  }
  if (row.from == null || row.from === '') {
    row.from = (author && (author.email || author.name)) || raw.from || '';
  }
  if (row.subject == null || row.subject === '') {
    row.subject = raw.subject || (raw.metadata && raw.metadata.subject) || '';
  }
  if (!Array.isArray(row.attachments)) {
    row.attachments = Array.isArray(raw.attachments) ? raw.attachments : [];
  }
  if (Array.isArray(row.attachments) && row.attachments.length) {
    row.attachments = row.attachments.map((att) => {
      if (!att || typeof att !== 'object') return att;
      const next = { ...att };
      delete next.content;
      delete next.raw;
      return next;
    });
  }
  if (author && !row.author) row.author = author;
  if (row.name == null || row.name === '') {
    row.name = displayRowName(raw, row, author);
  }
  if (raw.type && raw.type !== 'data-message' && row.type == null) {
    row.type = raw.type;
  }
  if (raw.resourceType && row.resourceType == null) {
    row.resourceType = raw.resourceType;
  }
  if (raw.channel && row.channel == null) row.channel = raw.channel;
  return row;
}

function displayRowName(raw, row, author) {
  if (raw && raw.name != null && String(raw.name).trim() !== '') return String(raw.name).trim();
  if (author && author.name) return String(author.name).trim();
  const from = String((row && row.from) || (raw && raw.from) || '');
  const angled = from.match(/^\s*"?([^"<]+)"?\s*</);
  if (angled && angled[1].trim()) return angled[1].trim();
  if (row && row.title) return String(row.title).trim();
  if (row && row.label) return String(row.label).trim();
  if (raw && raw.title) return String(raw.title).trim();
  if (raw && raw.label) return String(raw.label).trim();
  return from.trim();
}

function collectItems(source) {
  if (source == null) return [];
  if (Array.isArray(source)) return source.map(asRow);
  if (typeof source !== 'object') {
    const text = String(source);
    return text ? [{ text, from: '', subject: '', attachments: [] }] : [];
  }
  if (Array.isArray(source.items)) return source.items.map(asRow);
  if (Array.isArray(source.rows)) return source.rows.map(asRow);
  if (Array.isArray(source.records)) return source.records.map(asRow);
  return [asRow(source)];
}

function projectCurrent(items, index = 0) {
  const list = Array.isArray(items) ? items : [];
  const safeIndex = list.length ? Math.max(0, Math.min(Number(index) || 0, list.length - 1)) : 0;
  const item = list.length ? list[safeIndex] : null;
  const projected = {};
  if (item && typeof item === 'object') {
    Object.keys(item).forEach((key) => {
      projected[key] = item[key];
    });
  }
  return {
    ...projected,
    items: list,
    item,
    itemIndex: list.length ? safeIndex : 0,
    itemsCount: list.length,
    length: list.length,
    text: (item && (item.text || item.body)) || '',
    from: (item && item.from) || '',
    subject: (item && item.subject) || '',
    attachments: (item && Array.isArray(item.attachments)) ? item.attachments : [],
    empty: !list.length
  };
}

function asDataTable(source, extra = {}) {
  const itemIndex = extra.itemIndex != null ? extra.itemIndex : 0;
  const table = projectCurrent(collectItems(source), itemIndex);
  const rest = { ...extra };
  delete rest.items;
  delete rest.item;
  delete rest.itemIndex;
  delete rest.itemsCount;
  delete rest.type;
  return {
    ...table,
    ...rest,
    type: 'data-message',
    items: table.items,
    item: table.item,
    itemIndex: table.itemIndex,
    itemsCount: table.itemsCount,
    length: table.items.length,
    text: rest.text != null ? rest.text : table.text,
    from: rest.from != null ? rest.from : table.from,
    subject: rest.subject != null ? rest.subject : table.subject,
    attachments: Array.isArray(rest.attachments) ? rest.attachments : table.attachments,
    empty: rest.empty != null ? !!rest.empty : table.empty
  };
}

function emptyDataTable(extra = {}) {
  return asDataTable([], { empty: true, ...extra });
}

function readPath(obj, pathStr) {
  const key = String(pathStr || '').trim();
  if (!key || obj == null || typeof obj !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) return obj[key];
  const parts = key.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length; i += 1) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

function formatMessageItem(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
  const author = obj.author && typeof obj.author === 'object' ? obj.author : null;
  const from = String(
    obj.from || obj.expediteur || (author && (author.email || author.name)) || ''
  ).trim();
  const subject = String(obj.subject || obj.sujet || '').trim();
  const text = String(obj.text || obj.body || obj.texte || obj.message || '').trim().slice(0, 2000);
  const lines = [];
  if (from) lines.push(`De: ${from}`);
  if (subject) lines.push(`Sujet: ${subject}`);
  if (text) lines.push(`Texte: ${text}`);
  return lines.join('\n');
}

function looksLikeMessageItem(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (value.from || value.subject || value.expediteur || value.sujet) return true;
  const ch = String(value.channel || '').toLowerCase();
  return ch === 'mail' || ch === 'email' || ch === 'facebook';
}

function looksLikeMessageList(value) {
  const list = Array.isArray(value) ? value : (value && Array.isArray(value.items) ? value.items : null);
  if (list && list.length) return looksLikeMessageItem(list[0]);
  return looksLikeMessageItem(value);
}

function looksLikeIntentionCatalogPath(path) {
  const s = String(path || '').toLowerCase();
  if (!s) return false;
  const parts = s.split('.');
  const last = parts[parts.length - 1];
  if (last === 'intention' || last === 'intention_principale') return false;
  if (last === 'response' || last === 'rendered' || last === 'prompt' || last === 'model') return false;
  const root = parts[0];
  if (last === 'intentions' || root === 'intentions') return true;
  return root.indexOf('intention') >= 0;
}

function formatScalar(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    if (looksLikeIntentionList(value)) return formatIntentionCatalog(value);
    if (value.length && looksLikeMessageItem(value[0])) {
      return value.map((row, i) => {
        const body = formatMessageItem(row) || '';
        if (!body) return '';
        return value.length > 1 ? `${i + 1}. ${body.replace(/\n/g, ' | ')}` : body;
      }).filter(Boolean).join('\n');
    }
    try { return JSON.stringify(value); } catch (_) { return ''; }
  }
  if (typeof value === 'object') {
    if (looksLikeIntentionList(value)) return formatIntentionCatalog(value);
    if (looksLikeMessageItem(value)) {
      const body = formatMessageItem(value);
      if (body) return body;
    }
    try { return JSON.stringify(value); } catch (_) { return ''; }
  }
  return String(value);
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Array.isArray(value.items)) return value.items;
  return null;
}

function looksLikeMongoId(value) {
  return /^[a-fA-F0-9]{24}$/.test(String(value || '').trim());
}

function firstHumanCode(...vals) {
  for (let i = 0; i < vals.length; i += 1) {
    const s = String(vals[i] == null ? '' : vals[i]).trim();
    if (s && !looksLikeMongoId(s)) return s;
  }
  return '';
}

function intentionEntry(row) {
  if (row == null || typeof row !== 'object') return null;
  const mongoId = [row._id, row.id].map((v) => String(v == null ? '' : v).trim()).find(looksLikeMongoId) || '';
  const name = firstHumanCode(row.name, row.label, row.key, row.slug, row.code);
  const id = name || firstHumanCode(row.id, row.key) || mongoId;
  if (!id && !name) return null;
  return {
    id: id || name,
    name: name || id,
    mongoId,
    definition: String(row.definition || row.description || row.text || '').trim(),
    priority: row.priority
  };
}

function looksLikeIntentionList(value) {
  const list = Array.isArray(value) ? value : (value && Array.isArray(value.items) ? value.items : null);
  if (!list || !list.length) return false;
  const row = list[0] && typeof list[0] === 'object' ? list[0] : null;
  if (!row) return false;
  if (row.from || row.subject || row.expediteur || row.sujet) return false;
  return !!(row.name || row.id || row.definition || row.label || row.priority);
}

function formatIntentionCatalog(value) {
  const list = Array.isArray(value) ? value : (value && Array.isArray(value.items) ? value.items : []);
  return list.map(intentionEntry).filter(Boolean).map((it) => (
    it.definition ? `- ${it.id} : ${it.definition}` : `- ${it.id}`
  )).join('\n');
}

function snapIntentionToCatalog(raw, catalog) {
  const allowed = (catalog || []).map(intentionEntry).filter(Boolean);
  const generic = allowed.find((c) => String(c.id).toLowerCase() === 'generic' || String(c.name).toLowerCase() === 'generic')
    || { id: 'generic' };
  const text = String(raw == null ? '' : raw).trim();
  if (!allowed.length) return { intention: text, resumeExtra: null, matched: !!text };
  if (!text) return { intention: generic.id, resumeExtra: null, matched: false };
  const lower = text.toLowerCase();
  const exact = allowed.find((c) => (
    c.id.toLowerCase() === lower
    || c.name.toLowerCase() === lower
    || (c.mongoId && c.mongoId.toLowerCase() === lower)
  ));
  if (exact) return { intention: exact.id, resumeExtra: null, matched: true };
  const wordy = text.length > 40 || text.split(/\s+/).length > 4;
  if (!wordy) {
    const hit = allowed.find((c) => {
      const id = String(c.id || '').toLowerCase();
      const name = String(c.name || '').toLowerCase();
      if (looksLikeMongoId(id) || looksLikeMongoId(name)) return false;
      if (id.length < 2 && name.length < 2) return false;
      return (id && lower.indexOf(id) >= 0) || (name && lower.indexOf(name) >= 0);
    });
    if (hit) return { intention: hit.id, resumeExtra: null, matched: true };
    return { intention: generic.id, resumeExtra: null, matched: false };
  }
  return { intention: generic.id, resumeExtra: text, matched: false };
}

function parseConfiance(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'boolean') return raw ? 1 : 0;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  let value = n;
  if (value > 1 && value <= 100) value = value / 100;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Math.round(value * 1000) / 1000;
}

function applyIaConfiance(row, opts) {
  if (!row || typeof row !== 'object') return row;
  let n = parseConfiance(row.confiance != null ? row.confiance : row.confidence);
  if (n == null) n = 0;
  if (opts && opts.penalize) n = Math.min(n, 0.25);
  row.confiance = n;
  row.confidence = n;
  return row;
}

function applyCatalogToIaRow(row, catalog) {
  if (!row || typeof row !== 'object') return row;
  if (!catalog || !catalog.length) {
    applyIaConfiance(row);
    return row;
  }
  const snapped = snapIntentionToCatalog(row.intention || row.intention_principale, catalog);
  row.intention = snapped.intention;
  row.intention_principale = snapped.intention;
  const entry = (catalog || []).map(intentionEntry).filter(Boolean)
    .find((c) => c.id === snapped.intention || c.name === snapped.intention);
  if (entry) {
    row.intentionName = entry.name;
    row.intentionLabel = entry.name;
  }
  if (snapped.resumeExtra && !(row.resume || row.résumé || row.summary)) {
    row.resume = snapped.resumeExtra;
  }
  applyIaConfiance(row, {
    penalize: snapped.matched === false && String(snapped.intention || '').toLowerCase() === 'generic'
  });
  return row;
}

function normLoopKey(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function dataAliasNorm(n) {
  return n === 'donnees' || n === 'donnee' || n === 'data' || n === 'items'
    || n === 'entrees' || n === 'entree';
}

function isDataTableAlias(key) {
  return dataAliasNorm(normLoopKey(key));
}

function loopKeysMatch(a, b) {
  const na = normLoopKey(a);
  const nb = normLoopKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na + 's' === nb || nb + 's' === na) return true;
  if (na + 'es' === nb || nb + 'es' === na) return true;
  if (dataAliasNorm(na) && (nb.indexOf('donnees') === 0 || nb.indexOf('donnee') === 0 || nb.indexOf('entrees') === 0)) return true;
  if (dataAliasNorm(nb) && (na.indexOf('donnees') === 0 || na.indexOf('donnee') === 0 || na.indexOf('entrees') === 0)) return true;
  return false;
}

const FIELD_ALIAS_KEYS = {
  from: ['from', 'expediteur', 'auteur'],
  expediteur: ['from', 'expediteur', 'auteur'],
  auteur: ['from', 'auteur', 'expediteur'],
  subject: ['subject', 'sujet'],
  sujet: ['subject', 'sujet'],
  text: ['text', 'body', 'texte', 'corps', 'message'],
  texte: ['text', 'texte', 'body', 'corps'],
  body: ['body', 'text', 'texte', 'corps'],
  to: ['to', 'destinataire'],
  destinataire: ['to', 'destinataire'],
  name: ['name', 'nom', 'title', 'label'],
  nom: ['name', 'nom', 'title', 'label'],
  intention: ['intention', 'intention_principale'],
  intention_principale: ['intention_principale', 'intention'],
  confiance: ['confiance', 'confidence'],
  confidence: ['confidence', 'confiance'],
  resume: ['resume', 'résumé', 'summary'],
  résumé: ['resume', 'résumé', 'summary'],
  summary: ['summary', 'resume', 'résumé']
};

const FIELD_LABELS = {
  from: 'Expéditeur',
  expediteur: 'Expéditeur',
  auteur: 'Auteur',
  subject: 'Sujet',
  sujet: 'Sujet',
  text: 'Texte',
  texte: 'Texte',
  body: 'Texte',
  to: 'Destinataire',
  destinataire: 'Destinataire',
  name: 'Nom',
  nom: 'Nom',
  title: 'Titre',
  label: 'Libellé',
  attachments: 'Pièces jointes'
};

function aliasFieldNames(field) {
  const raw = String(field || '').trim();
  if (!raw) return [];
  const lower = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const mapped = FIELD_ALIAS_KEYS[lower] || FIELD_ALIAS_KEYS[raw];
  const list = mapped ? mapped.slice() : [raw];
  if (list.indexOf(raw) === -1) list.unshift(raw);
  return list;
}

function fieldLabel(field, rowLocals) {
  const key = String(field || '').trim();
  if (!key) return '';
  const labels = (rowLocals && rowLocals.__fieldLabels) || {};
  if (labels[key]) return labels[key];
  const lower = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (labels[lower]) return labels[lower];
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  if (FIELD_LABELS[lower]) return FIELD_LABELS[lower];
  return key;
}

function collectFieldLabels(source, previous) {
  const labels = { ...(previous || {}), ...FIELD_LABELS };
  const fields = source && typeof source === 'object'
    ? (source.modelFields || source.referenceFields)
    : null;
  if (Array.isArray(fields)) {
    fields.forEach((f) => {
      const key = String((f && (f.key || f.name)) || '').trim();
      const label = String((f && (f.label || f.name || f.key)) || '').trim();
      if (key && label) labels[key] = label;
    });
  }
  return labels;
}

function resolveNameToken(key, rowLocals, lookup) {
  const rawKey = String(key || '').trim();
  if (rawKey === 'name' || rawKey === 'nom') {
    const row = (rowLocals && rowLocals.item) || rowLocals;
    if (row && row.name) return row.name;
    return lookup('name', rowLocals);
  }
  if (!/\.name$/.test(rawKey) || /\.length$/.test(rawKey)) return undefined;
  const base = rawKey.replace(/\.name$/, '');
  const parts = base.split('.').filter(Boolean);
  const loopSlug = rowLocals && rowLocals.__loopSlug;
  const currentRow = (rowLocals && rowLocals.item) || rowLocals;

  if (parts.length === 1) {
    const root = parts[0];
    if (loopKeysMatch(root, loopSlug) || root === 'item' || root === 'items') {
      return (currentRow && currentRow.name) || lookup('name', rowLocals) || '';
    }
    const nested = resolveField(currentRow, root);
    if (nested && typeof nested === 'object' && !Array.isArray(nested) && nested.name != null) {
      return nested.name;
    }
    return fieldLabel(root, rowLocals);
  }

  const field = parts[parts.length - 1];
  const root = parts[0];
  if ((loopKeysMatch(root, loopSlug) || root === 'item') && parts.length === 2) {
    const nested = resolveField(currentRow, field);
    if (nested && typeof nested === 'object' && !Array.isArray(nested) && nested.name != null) {
      return nested.name;
    }
    return fieldLabel(field, rowLocals);
  }
  const parent = lookup(base, rowLocals);
  if (parent && typeof parent === 'object' && !Array.isArray(parent) && parent.name != null) {
    return parent.name;
  }
  return fieldLabel(field, rowLocals);
}

function resolveField(obj, field) {
  const names = aliasFieldNames(field);
  for (let i = 0; i < names.length; i += 1) {
    const val = readPath(obj, names[i]);
    if (val !== undefined && val !== null && val !== '') return val;
  }
  for (let i = 0; i < names.length; i += 1) {
    const val = readPath(obj, names[i]);
    if (val !== undefined && val !== null) return val;
  }
  return undefined;
}

function loopItemIndex(rowLocals) {
  if (!rowLocals || rowLocals.itemIndex == null || rowLocals.itemIndex === '') return null;
  const i = Number(rowLocals.itemIndex);
  if (!Number.isFinite(i) || i < 0) return null;
  return i;
}

function resolveIndexToken(token, rowLocals, fallbackIdx) {
  const t = String(token || '').trim();
  if (!t) return fallbackIdx;
  if (/^\d+$/.test(t)) return Number(t);
  if (rowLocals && rowLocals[t] != null && rowLocals[t] !== '') {
    const n = Number(rowLocals[t]);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  if (t === 'i' || t === 'index' || t === 'itemIndex' || t === '$i') {
    return fallbackIdx != null ? fallbackIdx : 0;
  }
  return fallbackIdx;
}

function expandIndexTokens(key, idx, rowLocals) {
  let out = String(key || '');
  out = out.replace(/\[(\d+)\]/g, '.$1');
  out = out.replace(/\[([a-zA-Z_$][a-zA-Z0-9_]*)\]/g, (_, name) => {
    const resolved = resolveIndexToken(name, rowLocals, idx);
    if (resolved == null) return '[' + name + ']';
    return '.' + resolved;
  });
  if (idx != null) {
    const n = String(idx);
    out = out.replace(/\$index\b/g, n).replace(/\$i\b/g, n);
  }
  out = out.replace(/^item\.(\d+)/, 'items.$1');
  out = out.replace(/\.item\.(\d+)/g, '.items.$1');
  return out;
}

/**
 * Dans {{#donnees}}, {{analyse.intention}} = analyse.items[itemIndex].intention
 * (même n° de ligne). {{analyse.items}} reste le tableau entier.
 */
function readPeerAtIndex(root, rest, idx) {
  if (idx == null) return undefined;
  const list = asList(root);
  if (!list || !list.length) return undefined;
  const row = list[idx];
  if (row == null) return undefined;
  const r = String(rest || '');
  if (!r) return undefined;
  if (r === 'items' || r === 'length' || r === 'lenght' || r === 'itemsCount' || r === 'empty') {
    return undefined;
  }
  if (r.indexOf('items.') === 0) return undefined;
  if (r === 'itemIndex') return idx;
  if (r === 'itemNumber') return idx + 1;
  if (r === 'item') return row;
  const field = r.indexOf('item.') === 0 ? r.slice(5) : r;
  if (!field) return row;
  const aliased = resolveField(row, field);
  if (aliased !== undefined) return aliased;
  return readPath(row, field);
}

function normalizeItemRest(rest) {
  let r = String(rest || '');
  if (/^item\.\d+/.test(r)) r = 'items.' + r.slice(5);
  return r;
}

/** {{slug.items.0.champ}} / {{slug.item[i].champ}} une fois [i] étendu. */
function readIndexedField(root, rest, rowLocals) {
  const r = normalizeItemRest(rest);
  const m = r.match(/^items\.(\d+)(?:\.(.*))?$/);
  if (!m) return undefined;
  const list = asList(root) || (rowLocals && asList(rowLocals.items));
  if (!list || !list.length) return undefined;
  const row = list[Number(m[1])];
  if (row == null) return undefined;
  if (!m[2]) return row;
  const aliased = resolveField(row, m[2]);
  if (aliased !== undefined) return aliased;
  return readPath(row, m[2]);
}

function scoreDataTableBag(bag, slug, want) {
  if (!bag || typeof bag !== 'object') return -Infinity;
  const list = asList(bag);
  if (!list && bag.type !== 'data-message') return -Infinity;
  const row = (list && list[0] && typeof list[0] === 'object') ? list[0] : {};
  const type = String(bag.type || '');
  const slugN = normLoopKey(slug);
  let s = 2;
  if (type === 'ia-result' || type === 'ia' || type === 'analyse-result') s -= 25;
  if (type === 'data-message') s += 4;
  if (bag.resourceType === 'intentions' || slugN.indexOf('intention') >= 0) s -= 18;
  if (row.from || row.subject || row.text || row.body || row.expediteur || row.sujet) s += 10;
  if ((row.intention || row.intention_principale) && !row.from && !row.subject) s -= 8;
  if (want && (slug === want || loopKeysMatch(want, slug))) s += 8;
  if (isDataTableAlias(want)
    && (slugN.indexOf('mail') === 0 || slugN.indexOf('facebook') === 0
      || slugN.indexOf('message') === 0 || slugN.indexOf('donnees') === 0)) {
    s += 5;
  }
  return s;
}

/**
 * Alias {{#donnees}} → tableau messages (mails), pas le dernier items (IA / intentions).
 */
function pickDataTable(ns, order, wantSlug) {
  const bagNs = ns && typeof ns === 'object' ? ns : {};
  const bags = Array.isArray(order) && order.length ? order : Object.keys(bagNs);
  const want = String(wantSlug || '').trim();
  if (want && !isDataTableAlias(want)) {
    for (let i = 0; i < bags.length; i += 1) {
      const slug = bags[i];
      if (slug === want || loopKeysMatch(want, slug)) {
        const bag = bagNs[slug];
        if (bag && (asList(bag) || bag.type === 'data-message' || bag.type === 'ia-result')) return bag;
      }
    }
    if (bagNs[want] && asList(bagNs[want])) return bagNs[want];
    return null;
  }
  let best = null;
  let bestScore = -Infinity;
  bags.forEach((slug) => {
    const bag = bagNs[slug];
    const score = scoreDataTableBag(bag, slug, want);
    if (score > bestScore) {
      best = bag;
      bestScore = score;
    }
  });
  return bestScore > 0 ? best : null;
}

function normalizeMustaches(tpl) {
  return String(tpl == null ? '' : tpl)
    .replace(/\uFF5B\uFF5B/g, '{{')
    .replace(/\uFF5D\uFF5D/g, '}}')
    .replace(/\{\{\{\s*/g, '{{')
    .replace(/\s*\}\}\}/g, '}}');
}

function findLoop(out, fromIndex) {
  const start = Number(fromIndex) || 0;
  const slice = out.slice(start);
  const openRe = /\{\{\s*(?:#\s*each\s+|#\s*)?([a-zA-Z0-9_À-ÿ]+)(?:\s*\[\s*([a-zA-Z0-9_]+)\s*\])?\s*\}\}/g;
  let open;
  while ((open = openRe.exec(slice))) {
    const token = open[0];
    const key = open[1];
    const indexSpec = open[2] || '';
    if (!key) continue;
    if (/^(today|date)$/i.test(key)) continue;
    const isHash = token.indexOf('#') >= 0;
    const isEach = /\{\{\s*#\s*each\s/i.test(token);
    const absIndex = start + open.index;
    const after = out.slice(absIndex + token.length);
    const closeRe = /\{\{\s*\/\s*([a-zA-Z0-9_À-ÿ]+)(?:\s*\[[a-zA-Z0-9_]+\s*\])?\s*\}\}/g;
    let close;
    while ((close = closeRe.exec(after))) {
      if (!loopKeysMatch(key, close[1])) continue;
      return {
        key,
        indexSpec,
        inner: after.slice(0, close.index),
        index: absIndex,
        length: token.length + close.index + close[0].length,
        requireList: !isHash && !isEach
      };
    }
  }
  return null;
}

/**
 * Interpolate {{champ}} et boucles de tableau.
 * Le nom affiché du bloc Entrées est le tableau. Le slug reste donnees :
 *   {{#donnees}}- {{donnees.expediteur}}, {{donnees.sujet}}{{/donnees}}
 *   {{donnees}} … {{/donnees}}  (même chose, sans #)
 * items / item restent des alias de la table courante.
 */
function interpolateTable(template, resolve) {
  const lookup = typeof resolve === 'function' ? resolve : () => undefined;

  function resolveTable(key, rowLocals) {
    let raw = lookup(key, rowLocals);
    if (asList(raw)) return raw;
    if (isDataTableAlias(key)) {
      const items = lookup('items', rowLocals);
      if (asList(items)) return items;
      if (items && typeof items === 'object') return items;
    }
    return raw;
  }

  function expand(tpl, rowLocals) {
    let out = rowLocals ? String(tpl == null ? '' : tpl) : normalizeMustaches(tpl);
    let guard = 0;
    let searchFrom = 0;
    while (guard < 40) {
      guard += 1;
      const found = findLoop(out, searchFrom);
      if (!found) break;
      if (found.requireList && !asList(resolveTable(found.key, rowLocals))) {
        searchFrom = found.index + 2;
        continue;
      }
      const rendered = renderSection(found.key, found.inner, rowLocals, found.indexSpec);
      out = out.slice(0, found.index) + rendered + out.slice(found.index + found.length);
      searchFrom = found.index + String(rendered).length;
    }
    return interpolateScalars(out, rowLocals);
  }

  function renderSection(key, inner, rowLocals, indexSpec) {
    const raw = resolveTable(key, rowLocals);
    const list = asList(raw);
    if (list) {
      if (!list.length) return '';
      const spec = String(indexSpec || '').trim();
      const bindName = spec && !/^\d+$/.test(spec) ? spec : 'i';
      let indices = list.map((_, i) => i);
      if (spec && /^\d+$/.test(spec)) {
        const only = Number(spec);
        indices = (only >= 0 && only < list.length) ? [only] : [];
      }
      return indices.map((i) => {
        const row = list[i];
        const rowObj = row && typeof row === 'object' ? row : { text: row };
        const locals = {
          ...(rowLocals || {}),
          ...(rowObj || {}),
          item: rowObj,
          items: list,
          itemIndex: i,
          itemNumber: i + 1,
          itemsCount: list.length,
          i,
          __indexName: bindName,
          __loopSlug: key,
          __fieldLabels: collectFieldLabels(raw, rowLocals && rowLocals.__fieldLabels)
        };
        locals[bindName] = i;
        locals[key] = rowObj;
        return expand(inner, locals);
      }).join('');
    }
    if (raw) return expand(inner, rowLocals);
    return '';
  }

  function lengthOf(key, rowLocals) {
    const root = String(key || '').replace(/\.lenght$/i, '.length');
    if (root === 'items' || root === 'item' || isDataTableAlias(root)) {
      const raw = resolveTable(root, rowLocals);
      const list = asList(raw);
      if (list) return list.length;
      const count = (raw && raw.itemsCount != null)
        ? raw.itemsCount
        : ((rowLocals && rowLocals.itemsCount != null)
          ? rowLocals.itemsCount
          : lookup('itemsCount', rowLocals));
      if (count != null && count !== '') return Number(count);
      return 0;
    }
    const raw = resolveTable(root, rowLocals);
    const list = asList(raw);
    if (list) return list.length;
    if (raw && typeof raw === 'object' && raw.itemsCount != null && raw.itemsCount !== '') {
      return Number(raw.itemsCount);
    }
    return 0;
  }

  function interpolateScalars(tpl, rowLocals) {
    const today = new Date().toISOString().slice(0, 10);
    const date = new Date().toLocaleString('fr-FR');
    const loopSlug = rowLocals && rowLocals.__loopSlug;
    const currentRow = (rowLocals && rowLocals.item) || rowLocals;
    const idx = loopItemIndex(rowLocals);
    return String(tpl || '').replace(/\{\{\s*([a-zA-Z0-9_.À-ÿ$\[\]]+)\s*\}\}/g, (_, rawKey) => {
      if (rawKey === 'today') return today;
      if (rawKey === 'date') return date;
      if (rawKey === '$i' || rawKey === '$index' || rawKey === 'itemIndex' || rawKey === 'i') {
        if (idx != null) return String(idx);
        if (rowLocals && rowLocals.i != null) return String(rowLocals.i);
      }
      if (rawKey === '$n' || rawKey === 'itemNumber') {
        if (idx != null) return String(idx + 1);
      }
      const key = expandIndexTokens(rawKey, idx, rowLocals);
      if (key === 'items.length' || key === 'item.length' || /\.length$/.test(key) || /\.lenght$/.test(key)) {
        const root = key === 'item.length' || key === 'item.lenght'
          ? 'items'
          : key.replace(/\.length$/i, '').replace(/\.lenght$/i, '');
        return String(lengthOf(root, rowLocals));
      }
      if (key === 'name' || key === 'nom' || /\.name$/.test(key)) {
        const named = resolveNameToken(key, rowLocals, lookup);
        if (named !== undefined && named !== null) return formatScalar(named);
      }
      if (loopSlug && key.indexOf('.') >= 0) {
        const root = key.split('.')[0];
        const rest = key.slice(root.length + 1);
        if (loopKeysMatch(root, loopSlug) || root === 'item') {
          const indexed = readIndexedField(null, rest, rowLocals);
          if (indexed !== undefined && indexed !== null) return formatScalar(indexed);
          const aliased = resolveField(currentRow, rest);
          if (aliased !== undefined) return formatScalar(aliased);
        }
      }
      const fromRow = rowLocals ? resolveField(rowLocals, key) : undefined;
      if (fromRow !== undefined && fromRow !== null && fromRow !== '') {
        return formatScalar(fromRow);
      }
      if (rowLocals && readPath(rowLocals, key) !== undefined) {
        return formatScalar(readPath(rowLocals, key));
      }
      if (key.indexOf('.') >= 0) {
        const rootKey = key.split('.')[0];
        let rest = key.slice(rootKey.length + 1);
        if (/^item\.\d+/.test(rest)) rest = 'items.' + rest.slice(5);
        if (/^\d+/.test(rest)) rest = 'items.' + rest;
        const root = lookup(rootKey, rowLocals);
        const indexed = readIndexedField(root, rest, rowLocals);
        if (indexed !== undefined && indexed !== null) return formatScalar(indexed);
        const zipped = readPeerAtIndex(root, rest, idx);
        if (zipped !== undefined && zipped !== null) return formatScalar(zipped);
        const nested = rest ? (resolveField(root, rest) !== undefined ? resolveField(root, rest) : readPath(root, rest)) : root;
        if (nested !== undefined && nested !== null) return formatScalar(nested);
      }
      const aliased = resolveField(currentRow, key);
      if (aliased !== undefined && aliased !== null && aliased !== '') return formatScalar(aliased);
      return formatScalar(lookup(key, rowLocals));
    });
  }

  return expand(template, null);
}

module.exports = {
  asRow,
  collectItems,
  projectCurrent,
  asDataTable,
  emptyDataTable,
  readPath,
  interpolateTable,
  loopKeysMatch,
  isDataTableAlias,
  pickDataTable,
  readIndexedField,
  expandIndexTokens,
  loopItemIndex,
  looksLikeMongoId,
  looksLikeIntentionList,
  looksLikeIntentionCatalogPath,
  looksLikeMessageItem,
  looksLikeMessageList,
  intentionEntry,
  formatIntentionCatalog,
  formatMessageItem,
  formatScalar,
  parseConfiance,
  applyIaConfiance,
  snapIntentionToCatalog,
  applyCatalogToIaRow
};
