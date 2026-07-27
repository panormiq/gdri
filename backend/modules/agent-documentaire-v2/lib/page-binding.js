/**
 * Binding page (profil "page") — collections, sélection liste ↔ zone détail.
 * Devis (profil "devis") n'utilise pas ces primitives.
 */

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveProfile(template) {
  const t = template && typeof template === 'object' ? template : {};
  const explicit = String(t.profile || '').trim().toLowerCase();
  if (explicit === 'page' || explicit === 'devis') return explicit;
  const scope = String(t.scope || '').toLowerCase();
  const ns = String(t.namespace || '').toLowerCase();
  if (
    scope === 'agent-review'
    || ns.startsWith('agent:review')
    || ns.startsWith('agent-review')
    || ns.includes(':review:')
  ) {
    return 'page';
  }
  return 'devis';
}

function isPageProfile(template) {
  return resolveProfile(template) === 'page';
}

function getWidget(node) {
  if (!node || typeof node !== 'object') return null;
  const w = node.widget;
  if (!w || typeof w !== 'object') return null;
  const type = String(w.type || 'none').toLowerCase();
  if (!['list', 'dropdown', 'detail'].includes(type)) return null;
  return {
    type,
    collection: String(w.collection || 'attachments').trim() || 'attachments',
    displayMode: String(w.displayMode || (type === 'dropdown' ? 'dropdown' : 'nodal')).toLowerCase(),
    labelField: String(w.labelField || 'filename').trim() || 'filename',
    secondaryField: String(w.secondaryField || '').trim(),
    defaultSelection: String(w.defaultSelection || 'first').toLowerCase(),
    emptyText: String(w.emptyText || 'Aucun élément').trim() || 'Aucun élément',
    bindToList: String(w.bindToList || '').trim() || null
  };
}

function getCollections(variables) {
  const v = variables && typeof variables === 'object' ? variables : {};
  if (v.__collections && typeof v.__collections === 'object') {
    return v.__collections;
  }
  const out = {};
  if (Array.isArray(v.attachments)) out.attachments = v.attachments;
  if (Array.isArray(v.mails)) out.mails = v.mails;
  if (Array.isArray(v['ugap:lignes.rows'])) out.lignes = v['ugap:lignes.rows'];
  return out;
}

function getCollectionItems(variables, collectionKey) {
  const key = String(collectionKey || '').trim();
  if (!key) return [];
  const cols = getCollections(variables);
  if (Array.isArray(cols[key])) return cols[key];
  const v = variables || {};
  if (Array.isArray(v[key])) return v[key];
  return [];
}

function getSelections(variables) {
  const v = variables && typeof variables === 'object' ? variables : {};
  return v.__selections && typeof v.__selections === 'object' ? v.__selections : {};
}

function resolveSelectedIndex(widget, listZoneId, items, variables) {
  const n = Array.isArray(items) ? items.length : 0;
  if (!n) return -1;
  const sels = getSelections(variables);
  const raw = listZoneId != null && Object.prototype.hasOwnProperty.call(sels, listZoneId)
    ? sels[listZoneId]
    : undefined;
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    const idx = Number(raw);
    if (Number.isFinite(idx) && idx >= 0 && idx < n) return idx;
  }
  const def = widget?.defaultSelection || 'first';
  if (def === 'none') return -1;
  const asNum = Number(def);
  if (Number.isFinite(asNum) && asNum >= 0 && asNum < n) return asNum;
  return 0;
}

function itemField(item, field) {
  if (!item || typeof item !== 'object') return '';
  const f = String(field || '').trim();
  if (!f) return '';
  if (Object.prototype.hasOwnProperty.call(item, f)) return item[f];
  // aliases
  if (f === 'filename' && item.name) return item.name;
  if (f === 'name' && item.filename) return item.filename;
  if (f === 'label') return item.filename || item.name || item.subject || item.from || '';
  if (f === 'size' && item.size != null) {
    const n = Number(item.size);
    if (Number.isFinite(n)) return `${Math.round(n / 1024)} Ko`;
    return String(item.size);
  }
  return '';
}

function itemToVariables(item, prefix = 'item') {
  const out = {};
  if (!item || typeof item !== 'object') return out;
  Object.keys(item).forEach((k) => {
    const val = item[k];
    if (val == null || typeof val === 'object') return;
    out[`${prefix}.${k}`] = val;
  });
  // convenience
  if (item.filename != null) out[`${prefix}.filename`] = item.filename;
  if (item.url != null) out[`${prefix}.url`] = item.url;
  if (item.from != null) out[`${prefix}.from`] = item.from;
  if (item.subject != null) out[`${prefix}.subject`] = item.subject;
  if (item.size != null) out[`${prefix}.size`] = item.size;
  out[`${prefix}.label`] = itemField(item, 'label');
  return out;
}

function renderListWidgetHtml(node, widget, variables) {
  const items = getCollectionItems(variables, widget.collection);
  const selected = resolveSelectedIndex(widget, node.id, items, variables);
  const mode = widget.type === 'dropdown' || widget.displayMode === 'dropdown'
    ? 'dropdown'
    : (widget.displayMode === 'list' ? 'list' : 'nodal');

  if (!items.length) {
    return `<div class="adv2-widget adv2-widget-list is-empty" data-list-id="${escapeHtml(node.id)}" data-collection="${escapeHtml(widget.collection)}"><p class="adv2-widget-empty">${escapeHtml(widget.emptyText)}</p></div>`;
  }

  if (mode === 'dropdown') {
    let html = `<div class="adv2-widget adv2-widget-dropdown" data-list-id="${escapeHtml(node.id)}" data-collection="${escapeHtml(widget.collection)}">`;
    html += `<select class="adv2-widget-select" data-adv2-list-select="${escapeHtml(node.id)}">`;
    items.forEach((item, i) => {
      const label = itemField(item, widget.labelField) || `Élément ${i + 1}`;
      const sec = widget.secondaryField ? itemField(item, widget.secondaryField) : '';
      const text = sec ? `${label} — ${sec}` : label;
      html += `<option value="${i}"${i === selected ? ' selected' : ''}>${escapeHtml(text)}</option>`;
    });
    html += '</select></div>';
    return html;
  }

  const listClass = mode === 'list' ? 'is-list' : 'is-nodal';
  let html = `<div class="adv2-widget adv2-widget-list ${listClass}" data-list-id="${escapeHtml(node.id)}" data-collection="${escapeHtml(widget.collection)}">`;
  items.forEach((item, i) => {
    const label = itemField(item, widget.labelField) || `Élément ${i + 1}`;
    const sec = widget.secondaryField ? itemField(item, widget.secondaryField) : '';
    const active = i === selected ? ' is-selected' : '';
    html += `<div class="adv2-widget-item${active}" data-item-index="${i}">`;
    html += `<div class="adv2-widget-item-label">${escapeHtml(label)}</div>`;
    if (sec) html += `<div class="adv2-widget-item-secondary">${escapeHtml(String(sec))}</div>`;
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function resolveDetailItem(node, widget, nodeMap, variables) {
  const listId = widget.bindToList;
  if (!listId) {
    // independent: use first of default collection or __selectedItem
    const v = variables || {};
    if (v.__selectedItem && typeof v.__selectedItem === 'object') return v.__selectedItem;
    const items = getCollectionItems(variables, widget.collection || 'attachments');
    const idx = resolveSelectedIndex(widget, null, items, variables);
    return idx >= 0 ? items[idx] : null;
  }
  const listNode = nodeMap && nodeMap.get ? nodeMap.get(listId) : null;
  const listWidget = getWidget(listNode) || {
    type: 'list',
    collection: widget.collection || 'attachments',
    defaultSelection: 'first'
  };
  const items = getCollectionItems(variables, listWidget.collection || widget.collection);
  const idx = resolveSelectedIndex(listWidget, listId, items, variables);
  return idx >= 0 ? items[idx] : null;
}

function mergeDetailVariables(baseVariables, item) {
  const out = { ...(baseVariables || {}) };
  const itemVars = itemToVariables(item, 'item');
  Object.assign(out, itemVars);
  // also expose without prefix for convenience in simple templates
  if (item && typeof item === 'object') {
    ['filename', 'url', 'from', 'subject', 'size', 'text', 'name'].forEach((k) => {
      if (item[k] != null && typeof item[k] !== 'object') out[k] = item[k];
    });
  }
  return out;
}

module.exports = {
  escapeHtml,
  resolveProfile,
  isPageProfile,
  getWidget,
  getCollections,
  getCollectionItems,
  getSelections,
  resolveSelectedIndex,
  itemField,
  itemToVariables,
  renderListWidgetHtml,
  resolveDetailItem,
  mergeDetailVariables
};
