/**
 * FICHIER : frontend/pages/modules/document-agent-v2/assets/js/canvas-editor.js
 * RÔLE : Éditeur canvas A4 — drag, resize, snap, guides, propriétés, champs.
 */
(function initAdv2CanvasEditor(global) {
  'use strict';

  const DEFAULT_NS = 'ugap:devis:default';
  const ZONE_LABELS = {
    entreprise: 'Entreprise',
    client: 'Client',
    devis: 'Devis',
    lignes: 'Lignes',
    'total-devis': 'Total devis',
    transport: 'Transport',
    'bon-pour-accord': 'Bon pour accord',
    'pied-de-page': 'Pied de page',
    custom: 'Zone libre'
  };

  const TOTAL_DEVIS_BUDGET5_HTML = '<p style="line-height:1.35"><strong>Budget 5 % HT disponible :</strong> {{ugap:devis.budget5Disponible}} € — <strong>Restant :</strong> {{ugap:devis.budget5Restant}} €</p>';

  const TOTAL_DEVIS_HTML = '<p style="line-height:1.45"><strong>Sous-total HT :</strong> {{ugap:devis.subtotal}} €<br><strong>Options 5 % consommées HT :</strong> {{ugap:devis.budget5}} €<br><strong>Total HT :</strong> {{ugap:devis.total}} €<br><strong>TVA ({{ugap:devis.tauxTva}} %) :</strong> {{ugap:devis.montantTva}} €<br><strong>Total TTC :</strong> {{ugap:devis.totalTtc}} €</p>';

  const TOTAL_DEVIS_ZONE = {
    id: 'zone_total_devis',
    type: 'zone',
    zoneType: 'total-devis',
    label: 'Total devis',
    parentId: null,
    layout: { x: 15, y: 156, width: 180, height: 28, unit: 'mm' },
    zIndex: 5,
    style: { border: '1px dashed #cbd5e1', backgroundColor: 'rgba(248,250,252,0.6)' },
    children: ['tf_budget5_disponible', 'tf_total_devis'],
    collectionNamespace: 'ugap:devis-meta',
    autoFitChildren: true
  };

  const TOTAL_DEVIS_BUDGET5_TEXT = {
    id: 'tf_budget5_disponible',
    type: 'text-frame',
    label: 'Budget 5 % disponible',
    parentId: 'zone_total_devis',
    layout: { x: 3.6, y: 0.4, width: 172.8, height: 6, unit: 'mm' },
    content: { mode: 'flow', html: TOTAL_DEVIS_BUDGET5_HTML },
    style: { fontSize: 9, textAlign: 'right', color: '#475569' }
  };

  const TOTAL_DEVIS_TEXT = {
    id: 'tf_total_devis',
    type: 'text-frame',
    label: 'Totaux',
    parentId: 'zone_total_devis',
    layout: { x: 3.6, y: 7, width: 172.8, height: 19.6, unit: 'mm' },
    content: {
      mode: 'flow',
      html: TOTAL_DEVIS_HTML
    },
    style: { fontSize: 10, fontWeight: 'bold', textAlign: 'right' }
  };

  const state = {
    template: null,
    namespace: DEFAULT_NS,
    selectedId: null,
    textEditingId: null,
    sideTab: 'dim',
    styleScope: 'frame',
    zoom: 0.85,
    drag: null,
    pending: null,
    snapLines: [],
    treeExpanded: new Set(),
    treeCollapsed: new Set(),
    fieldsExpanded: new Set(),
    fieldsCollapsed: new Set(),
    selectedGuide: null,
    guideEditMode: false,
    guideRefZoneId: null,
    view: {
      showMargins: false,
      showZoneFrames: false,
      showGuides: true
    }
  };

  function isGuideEditMode() {
    return !!state.guideEditMode;
  }

  function parseZoneBorderCss(borderStr) {
    const raw = String(borderStr || '').trim();
    if (!raw || raw === 'none') {
      return { enabled: false, width: 1, style: 'solid', color: '#94a3b8' };
    }
    const m = raw.match(/^([\d.]+)px\s+(solid|dashed|dotted)\s+(.+)$/i);
    if (!m) return { enabled: true, width: 1, style: 'solid', color: '#94a3b8' };
    return {
      enabled: true,
      width: Number(m[1]) || 1,
      style: m[2].toLowerCase(),
      color: m[3].trim()
    };
  }

  function buildZoneBorderCss({ enabled, width, style, color }) {
    if (!enabled) return 'none';
    return `${width || 1}px ${style || 'solid'} ${color || '#94a3b8'}`;
  }

  function cssColorToInputValue(color) {
    const raw = String(color || '').trim();
    if (!raw) return '#ffffff';
    if (raw.startsWith('#')) return raw.slice(0, 7);
    const rgba = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgba) {
      const hex = (n) => Number(n).toString(16).padStart(2, '0');
      return `#${hex(rgba[1])}${hex(rgba[2])}${hex(rgba[3])}`;
    }
    return '#ffffff';
  }

  function applyEditorZoneChrome(el, node, zoneSelected) {
    const s = node.style || {};
    const borderMeta = parseZoneBorderCss(s.border);
    const isGuideRef = isGuideEditMode() && state.guideRefZoneId === node.id;
    if (s.backgroundColor) el.style.backgroundColor = s.backgroundColor;
    else el.style.backgroundColor = '';
    const showBorder = state.view.showZoneFrames || zoneSelected || isGuideRef;
    if (isGuideRef && !borderMeta.enabled) {
      el.style.border = '2px solid #0891b2';
    } else if (showBorder && borderMeta.enabled) {
      el.style.border = buildZoneBorderCss(borderMeta);
    } else if (isGuideRef) {
      el.style.border = '2px solid #0891b2';
    } else {
      el.style.border = '1px solid transparent';
    }
  }

  function $(id) { return document.getElementById(id); }

  function catalog() {
    const root = global.Adv2FieldsCatalog;
    if (!root) return { FIELD_GROUPS: [], PLACEHOLDER_DATA: {}, SAMPLE_TABLE_LINES: [] };
    if (typeof root.resolveCatalog === 'function') {
      return root.resolveCatalog({
        namespace: state.namespace || state.template?.namespace || '',
        scope: state.template?.scope || ''
      });
    }
    return root;
  }

  function isUgapDevisTemplate() {
    return catalog().id !== 'agent-review';
  }

  function getFocusedTextFrameId() {
    const active = document.activeElement;
    if (!active?.closest) return null;
    const tf = active.closest('[data-text-frame-id]');
    return tf?.getAttribute('data-text-frame-id') || null;
  }

  function isTextFrameEditMode(nodeId) {
    const node = getNode(nodeId);
    return !!node && node.type === 'text-frame' && state.selectedId === nodeId && state.textEditingId === nodeId;
  }

  function blurActiveTextFrame() {
    state.textEditingId = null;
    const el = getActiveTextFrameEl();
    if (!el) return;
    el.setAttribute('contenteditable', 'false');
    if (el === document.activeElement || el.contains(document.activeElement)) {
      el.blur();
    }
  }

  function placeCaretAtPoint(el, clientX, clientY) {
    if (!el || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    const doc = el.ownerDocument;
    let range = null;
    if (doc.caretRangeFromPoint) {
      range = doc.caretRangeFromPoint(clientX, clientY);
    } else if (doc.caretPositionFromPoint) {
      const pos = doc.caretPositionFromPoint(clientX, clientY);
      if (pos) {
        range = doc.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    if (!range || !el.contains(range.startContainer)) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function enterTextFrameEdit(id, clientX, clientY) {
    const node = getNode(id);
    if (!node || node.type !== 'text-frame') return;
    state.selectedId = id;
    state.textEditingId = id;
    if (!['frame', 'line', 'selection'].includes(state.styleScope)) state.styleScope = 'frame';
    state.sideTab = 'props';
    renderTree();
    renderSidePanel();
    renderCanvas();
    requestAnimationFrame(() => {
      const tf = document.querySelector(`[data-text-frame-id="${id}"]`);
      if (!tf || state.textEditingId !== id) return;
      tf.setAttribute('contenteditable', 'true');
      tf.focus();
      placeCaretAtPoint(tf, clientX, clientY);
    });
  }

  function canDragNode(node) {
    return !!node;
  }

  function isDraggableSelection(id) {
    return canDragNode(getNode(id));
  }

  const RESIZE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  function layoutMinSize(unit) {
    return unit === 'mm' ? { w: 10, h: 8 } : { w: 5, h: 5 };
  }

  function parentMinSizeFromChildren(parentId) {
    const base = layoutMinSize('mm');
    let minW = base.w;
    let minH = base.h;
    childrenOf(parentId).forEach((child) => {
      const l = child.layout || {};
      minW = Math.max(minW, (l.x || 0) + (l.width || 10));
      minH = Math.max(minH, (l.y || 0) + (l.height || 10));
    });
    return { w: minW, h: minH };
  }

  function parentMinSizeWhenScaling(parentOrigLayout, childrenSnap) {
    const base = layoutMinSize('mm');
    const oldW = parentOrigLayout?.width || 10;
    const oldH = parentOrigLayout?.height || 10;
    let minW = base.w;
    let minH = base.h;
    (childrenSnap || []).forEach((snap) => {
      const l = snap.layout || {};
      const cw = Math.max(l.width || 10, 0.001);
      const ch = Math.max(l.height || 10, 0.001);
      minW = Math.max(minW, (base.w * oldW) / cw);
      minH = Math.max(minH, (base.h * oldH) / ch);
    });
    return { w: minW, h: minH };
  }

  function layoutMinSizeForNode(node, resizeContext) {
    const base = layoutMinSize('mm');
    if (!node || node.parentId || !childrenOf(node.id).length) return base;
    if (isZoneScaleChildren(node)) {
      const parentOrig = resizeContext?.parentOrig || node.layout;
      const childrenSnap = resizeContext?.childrenSnap || childrenOf(node.id).map((child) => ({
        id: child.id,
        layout: { ...(child.layout || {}) }
      }));
      return parentMinSizeWhenScaling(parentOrig, childrenSnap);
    }
    const childMins = parentMinSizeFromChildren(node.id);
    return {
      w: Math.max(base.w, childMins.w),
      h: Math.max(base.h, childMins.h)
    };
  }

  function applyResizeLayout(orig, dir, dx, dy, unit, keepRatio, minSize) {
    const defaults = layoutMinSize(unit);
    const minW = minSize?.w ?? defaults.w;
    const minH = minSize?.h ?? defaults.h;
    let x = orig.x || 0;
    let y = orig.y || 0;
    let w = orig.width || 10;
    let h = orig.height || 10;
    const ratio = w / h || 1;

    const affectsWest = dir === 'w' || dir === 'nw' || dir === 'sw';
    const affectsEast = dir === 'e' || dir === 'ne' || dir === 'se';
    const affectsNorth = dir === 'n' || dir === 'ne' || dir === 'nw';
    const affectsSouth = dir === 's' || dir === 'se' || dir === 'sw';
    const isCorner = dir === 'ne' || dir === 'nw' || dir === 'se' || dir === 'sw';

    if (keepRatio && isCorner) {
      let newW = w;
      let newH = h;
      if (dir === 'se') { newW = w + dx; newH = h + dy; }
      else if (dir === 'sw') { newW = w - dx; newH = h + dy; }
      else if (dir === 'ne') { newW = w + dx; newH = h - dy; }
      else if (dir === 'nw') { newW = w - dx; newH = h - dy; }
      const scaleW = newW / w;
      const scaleH = newH / h;
      const scale = Math.abs(scaleW - 1) >= Math.abs(scaleH - 1) ? scaleW : scaleH;
      newW = Math.max(minW, w * scale);
      newH = Math.max(minH, newW / ratio);
      if (affectsWest) x = x + w - newW;
      if (affectsNorth) y = y + h - newH;
      return { x, y, width: newW, height: newH };
    }

    if (keepRatio && (dir === 'e' || dir === 'w')) {
      const newW = Math.max(minW, dir === 'e' ? w + dx : w - dx);
      const newH = Math.max(minH, newW / ratio);
      const nx = dir === 'w' ? x + w - newW : x;
      const ny = y + (h - newH) / 2;
      return { x: nx, y: Math.max(0, ny), width: newW, height: newH };
    }

    if (keepRatio && (dir === 'n' || dir === 's')) {
      const newH = Math.max(minH, dir === 's' ? h + dy : h - dy);
      const newW = Math.max(minW, newH * ratio);
      const ny = dir === 'n' ? y + h - newH : y;
      const nx = x + (w - newW) / 2;
      return { x: Math.max(0, nx), y: Math.max(0, ny), width: newW, height: newH };
    }

    if (affectsEast) w = Math.max(minW, w + dx);
    if (affectsWest) {
      const nextW = w - dx;
      if (nextW >= minW) {
        x = (orig.x || 0) + dx;
        w = nextW;
      } else {
        x = (orig.x || 0) + w - minW;
        w = minW;
      }
    }
    if (affectsSouth) h = Math.max(minH, h + dy);
    if (affectsNorth) {
      const nextH = h - dy;
      if (nextH >= minH) {
        y = (orig.y || 0) + dy;
        h = nextH;
      } else {
        y = (orig.y || 0) + h - minH;
        h = minH;
      }
    }

    return { x: Math.max(0, x), y: Math.max(0, y), width: w, height: h };
  }

  function isZoneAutoFitChildren(zone) {
    return zone?.type === 'zone' && zone.autoFitChildren !== false;
  }

  function isZoneScaleChildren(zone) {
    return zone?.type === 'zone' && zone.scaleChildrenOnResize === true;
  }

  function scaleChildrenWithParent(parentId, oldParentLayout, newParentLayout, childrenSnap) {
    const parent = getNode(parentId);
    if (!parent || !isZoneScaleChildren(parent) || !childrenSnap?.length) return;
    const oldW = oldParentLayout?.width || 10;
    const oldH = oldParentLayout?.height || 10;
    const newW = newParentLayout?.width || 10;
    const newH = newParentLayout?.height || 10;
    if (!oldW || !oldH) return;
    const sx = newW / oldW;
    const sy = newH / oldH;
    const { w: minW, h: minH } = layoutMinSize('mm');
    childrenSnap.forEach((snap) => {
      const child = getNode(snap.id);
      if (!child) return;
      const l = snap.layout || {};
      child.layout = {
        unit: 'mm',
        x: Math.max(0, (l.x || 0) * sx),
        y: Math.max(0, (l.y || 0) * sy),
        width: Math.max(minW, (l.width || 10) * sx),
        height: Math.max(minH, (l.height || 10) * sy)
      };
    });
  }

  function clampChildLayout(layout, parentLayout, autoFitChildren) {
    const { w: minW, h: minH } = layoutMinSize('mm');
    let x = Math.max(0, layout.x || 0);
    let y = Math.max(0, layout.y || 0);
    let w = Math.max(minW, layout.width || 10);
    let h = Math.max(minH, layout.height || 10);
    if (parentLayout && autoFitChildren === false) {
      const maxW = parentLayout.width || 10;
      const maxH = parentLayout.height || 10;
      w = Math.min(w, maxW - x);
      h = Math.min(h, maxH - y);
      if (x + w > maxW) x = Math.max(0, maxW - w);
      if (y + h > maxH) y = Math.max(0, maxH - h);
    }
    return { ...layout, unit: 'mm', x, y, width: w, height: h };
  }

  function fitParentToChildren(parentId) {
    const parent = getNode(parentId);
    if (!parent) return;
    const childMins = parentMinSizeFromChildren(parentId);
    const globalMins = layoutMinSize('mm');
    const pl = parent.layout || {};
    parent.layout = {
      ...pl,
      unit: 'mm',
      width: Math.max(globalMins.w, childMins.w),
      height: Math.max(globalMins.h, childMins.h)
    };
  }

  function finalizeChildLayout(node, layout) {
    const parent = node.parentId ? getNode(node.parentId) : null;
    const autoFit = parent && isZoneAutoFitChildren(parent);
    node.layout = clampChildLayout(layout, parent?.layout, autoFit);
    if (parent && autoFit) fitParentToChildren(parent.id);
  }

  function applyZoneAutoFitFromForm() {
    const node = getNode(state.selectedId);
    if (!node || node.type !== 'zone' || node.parentId) return;
    node.autoFitChildren = !!$('prop-auto-fit-children')?.checked;
    renderSidePanel();
  }

  function applyZoneScaleChildrenFromForm() {
    const node = getNode(state.selectedId);
    if (!node || node.type !== 'zone' || node.parentId) return;
    node.scaleChildrenOnResize = !!$('prop-scale-children')?.checked;
    renderSidePanel();
  }

  function applyFitChildrenNow() {
    const node = getNode(state.selectedId);
    if (!node || node.type !== 'zone' || node.parentId || !childrenOf(node.id).length) return;
    fitParentToChildren(node.id);
    renderCanvas();
    renderSidePanel();
  }

  function normalizeChildLayouts() {
    (state.template?.nodes || []).forEach((node) => {
      if (!node.parentId || !node.layout) return;
      const parent = getNode(node.parentId);
      if (!parent?.layout) return;
      const pl = parent.layout;
      const l = node.layout;
      if (l.unit === '%') {
        node.layout = {
          unit: 'mm',
          x: (pl.width || 10) * (l.x || 0) / 100,
          y: (pl.height || 10) * (l.y || 0) / 100,
          width: (pl.width || 10) * (l.width || 10) / 100,
          height: (pl.height || 10) * (l.height || 10) / 100
        };
      } else {
        node.layout.unit = 'mm';
      }
      node.layout = clampChildLayout(node.layout, pl, isZoneAutoFitChildren(parent));
    });
    rootNodes().forEach((zone) => {
      if (childrenOf(zone.id).length && isZoneAutoFitChildren(zone)) {
        fitParentToChildren(zone.id);
      }
    });
  }

  function placeTotalDevisBelowLignes(zoneLayout) {
    const lignes = (state.template?.nodes || []).find((n) => n.id === 'zone_lignes' || n.zoneType === 'lignes');
    if (!lignes?.layout) return { ...zoneLayout };
    const y = (lignes.layout.y || 0) + (lignes.layout.height || 90) + 2;
    return { ...zoneLayout, y };
  }

  function shiftZonesBelowTotalDevis(totalBottomY) {
    const minY = totalBottomY + 2;
    const shifts = [
      { id: 'zone_transport', y: 186, zIndex: 6 },
      { id: 'zone_bon_accord', y: 206, zIndex: 7 },
      { id: 'zone_pied_page', zIndex: 8 }
    ];
    shifts.forEach(({ id, y, zIndex }) => {
      const node = (state.template?.nodes || []).find((n) => n.id === id);
      if (!node) return;
      node.layout = { ...(node.layout || {}), unit: 'mm' };
      if (Number.isFinite(y) && (node.layout.y || 0) < minY) node.layout.y = Math.max(y, minY);
      if (Number.isFinite(zIndex)) node.zIndex = zIndex;
    });
  }

  function ensureTotalDevisZone() {
    if (!state.template?.nodes) return false;
    const nodes = state.template.nodes;
    const existing = nodes.find((n) => n.id === 'zone_total_devis' || n.zoneType === 'total-devis');
    if (existing) {
      if (!existing.label) existing.label = 'Total devis';
      return false;
    }

    const zoneLayout = placeTotalDevisBelowLignes({ ...TOTAL_DEVIS_ZONE.layout });
    const zone = { ...TOTAL_DEVIS_ZONE, layout: zoneLayout };
    const budgetText = { ...TOTAL_DEVIS_BUDGET5_TEXT };
    const textFrame = { ...TOTAL_DEVIS_TEXT };
    applyFrameTextAlign(budgetText, budgetText.style?.textAlign || 'right');
    applyFrameTextAlign(textFrame, textFrame.style?.textAlign || 'right');
    nodes.push(zone, budgetText, textFrame);
    shiftZonesBelowTotalDevis(zoneLayout.y + zoneLayout.height);
    return true;
  }

  function upgradeTotalDevisTextFrame() {
    const nodes = state.template?.nodes || [];
    const tf = nodes.find((n) => n.id === 'tf_total_devis');
    if (!tf) return false;
    const html = String(tf.content?.html || '');
    const needsBudgetFrame = !nodes.some((n) => n.id === 'tf_budget5_disponible');
    const needsTva = !html.includes('ugap:devis.montantTva') || !html.includes('ugap:devis.totalTtc');
    const needsConsumedLabel = html.includes('Budget 5 %') && !html.includes('Options 5 % consommées HT');
    const budgetTfExisting = nodes.find((n) => n.id === 'tf_budget5_disponible');
    const needsAlignFix = /\btext-align\s*:/i.test(html)
      || (budgetTfExisting && /\btext-align\s*:/i.test(String(budgetTfExisting.content?.html || '')));
    if (!needsBudgetFrame && !needsTva && !needsConsumedLabel && !needsAlignFix) return false;

    const zone = nodes.find((n) => n.id === 'zone_total_devis');
    if (zone) {
      zone.children = ['tf_budget5_disponible', 'tf_total_devis'];
      zone.layout = {
        ...(zone.layout || {}),
        height: Math.max(zone.layout?.height || 0, TOTAL_DEVIS_ZONE.layout.height),
        unit: 'mm'
      };
    }

    if (needsBudgetFrame) {
      const budgetNode = { ...TOTAL_DEVIS_BUDGET5_TEXT };
      applyFrameTextAlign(budgetNode, budgetNode.style?.textAlign || 'right');
      nodes.push(budgetNode);
    } else {
      const budgetTf = nodes.find((n) => n.id === 'tf_budget5_disponible');
      if (budgetTf) {
        budgetTf.content = { mode: 'flow', html: TOTAL_DEVIS_BUDGET5_HTML };
        budgetTf.layout = { ...TOTAL_DEVIS_BUDGET5_TEXT.layout, unit: 'mm' };
        applyFrameTextAlign(budgetTf, budgetTf.style?.textAlign || 'right');
      }
    }

    tf.content = tf.content || { mode: 'flow' };
    tf.content.html = TOTAL_DEVIS_HTML;
    tf.layout = { ...(tf.layout || {}), ...TOTAL_DEVIS_TEXT.layout, unit: 'mm' };
    applyFrameTextAlign(tf, tf.style?.textAlign || 'right');

    if (zone?.layout) {
      shiftZonesBelowTotalDevis((zone.layout.y || 0) + (zone.layout.height || 28));
    }
    return true;
  }

  function fixTextFrameAlignmentsInTemplate() {
    let fixed = false;
    (state.template?.nodes || []).forEach((node) => {
      if (node.type !== 'text-frame') return;
      const html = String(node.content?.html || '');
      if (!/\btext-align\s*:/i.test(html)) return;
      applyFrameTextAlign(node, node.style?.textAlign || 'left');
      fixed = true;
    });
    return fixed;
  }

  function appendResizeHandles(containerEl, nodeId) {
    const wrap = document.createElement('div');
    wrap.className = 'adv2-resize-handles';
    wrap.setAttribute('aria-hidden', 'true');
    RESIZE_DIRS.forEach((dir) => {
      const handle = document.createElement('div');
      handle.className = `adv2-resize-handle is-${dir}`;
      handle.dataset.resize = nodeId;
      handle.dataset.resizeDir = dir;
      wrap.appendChild(handle);
    });
    containerEl.appendChild(wrap);
  }

  function renderZIndex(node, { isRoot, zoneSelected, parentOfSelectedChild, childSelected, fallback }) {
    const base = node.zIndex || fallback || 1;
    if (childSelected) return 9000;
    if (isRoot && (zoneSelected || parentOfSelectedChild)) return 8000 + base;
    return base;
  }

  function escHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function applyPlaceholders(html) {
    const data = catalog().PLACEHOLDER_DATA || {};
    return String(html || '').replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const k = String(key || '').trim();
      if (Object.prototype.hasOwnProperty.call(data, k)) {
        return escHtml(data[k]);
      }
      return `<span class="adv2-var-tag">${escHtml(match)}</span>`;
    });
  }

  function highlightVariables(html) {
    return String(html || '').replace(/\{\{([^}]+)\}\}/g, (match) => {
      return `<span class="adv2-var-tag">${escHtml(match)}</span>`;
    });
  }

  function nodeMap() {
    const map = new Map();
    (state.template?.nodes || []).forEach((n) => map.set(n.id, n));
    return map;
  }

  function generateNodeId(prefix) {
    const base = String(prefix || 'node').replace(/[^a-z0-9_]/gi, '_');
    let id = `${base}_${Date.now().toString(36)}`;
    const map = nodeMap();
    while (map.has(id)) {
      id = `${base}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    }
    return id;
  }

  function nodeDisplayName(node) {
    if (!node) return '';
    if (node.label) return String(node.label);
    if (node.type === 'zone' && node.zoneType) return ZONE_LABELS[node.zoneType] || node.zoneType;
    if (node.type === 'text-frame') return 'Texte';
    if (node.type === 'image') return 'Image';
    if (node.type === 'table') return 'Tableau';
    return node.type;
  }

  function getHostZoneForActions(node) {
    if (!node) return null;
    if (node.type === 'zone' && !node.parentId) return node;
    const parent = node.parentId ? getNode(node.parentId) : null;
    return parent?.type === 'zone' ? parent : null;
  }

  function canDeleteNode(node) {
    if (!node) return false;
    if (node.type === 'table') return false;
    if (node.type === 'zone' && node.zoneType && node.zoneType !== 'custom') return false;
    return node.type === 'text-frame' || node.type === 'image' || (node.type === 'zone' && node.zoneType === 'custom');
  }

  function expandTreePathTo(nodeId) {
    let current = getNode(nodeId);
    while (current?.parentId) {
      state.treeExpanded.add(current.parentId);
      state.treeCollapsed.delete(current.parentId);
      current = getNode(current.parentId);
    }
    if (current?.id) {
      state.treeExpanded.add(current.id);
      state.treeCollapsed.delete(current.id);
    }
  }

  function addZone() {
    if (!state.template) return;
    const margins = state.template.page?.margins || { top: 15, left: 15, right: 15 };
    const pw = state.template.page?.widthMm || 210;
    const contentW = pw - margins.left - margins.right;
    const roots = rootNodes();
    const maxZ = roots.reduce((m, n) => Math.max(m, n.zIndex || 1), 0);
    const maxY = roots.reduce((m, n) => {
      const l = n.layout || {};
      return Math.max(m, (l.y || 0) + (l.height || 0));
    }, margins.top);
    const id = generateNodeId('zone');
    const node = {
      id,
      type: 'zone',
      zoneType: 'custom',
      label: 'Nouvelle zone',
      parentId: null,
      layout: {
        x: margins.left,
        y: Math.min(maxY + 4, (state.template.page?.heightMm || 297) - margins.bottom - 36),
        width: Math.min(contentW, 90),
        height: 28,
        unit: 'mm'
      },
      zIndex: maxZ + 1,
      style: { border: 'none', backgroundColor: 'rgba(248,250,252,0.9)' },
      children: [],
      autoFitChildren: true
    };
    state.template.nodes.push(node);
    expandTreePathTo(id);
    selectNode(id);
    setStatus('Zone ajoutée — renommez-la dans Dim.', 'ok');
  }

  function addTextFrameToZone(zoneId) {
    const zone = getNode(zoneId);
    if (!zone || zone.type !== 'zone') return;
    const id = generateNodeId('tf');
    const zw = zone.layout?.width || 40;
    const child = {
      id,
      type: 'text-frame',
      label: 'Texte',
      parentId: zoneId,
      layout: { x: 2, y: 2, width: Math.max(20, zw - 4), height: 12, unit: 'mm' },
      content: { mode: 'flow', html: '<p>Nouveau texte</p>' },
      style: { fontSize: 10 }
    };
    state.template.nodes.push(child);
    zone.children = [...(Array.isArray(zone.children) ? zone.children : []), id];
    if (isZoneAutoFitChildren(zone)) fitParentToChildren(zoneId);
    expandTreePathTo(id);
    selectNode(id);
    requestAnimationFrame(() => enterTextFrameEdit(id));
    setStatus('Cadre texte ajouté', 'ok');
  }

  function addImageToZone(zoneId) {
    const zone = getNode(zoneId);
    if (!zone || zone.type !== 'zone') return;
    const id = generateNodeId('img');
    const child = {
      id,
      type: 'image',
      label: 'Image',
      parentId: zoneId,
      layout: { x: 2, y: 2, width: 24, height: 20, unit: 'mm' },
      imageConfig: { variable: 'ugap:entreprise.logoUrl', fit: 'contain' }
    };
    state.template.nodes.push(child);
    zone.children = [...(Array.isArray(zone.children) ? zone.children : []), id];
    if (isZoneAutoFitChildren(zone)) fitParentToChildren(zoneId);
    expandTreePathTo(id);
    selectNode(id);
    setStatus('Image ajoutée — choisissez la variable dans Propriétés', 'ok');
  }

  function deleteSelectedNode() {
    const node = getNode(state.selectedId);
    if (!node || !canDeleteNode(node)) return;
    if (!window.confirm(`Supprimer « ${nodeDisplayName(node)} » ?`)) return;
    const parent = node.parentId ? getNode(node.parentId) : null;
    if (parent?.children) {
      parent.children = parent.children.filter((cid) => cid !== node.id);
      if (isZoneAutoFitChildren(parent)) fitParentToChildren(parent.id);
    }
    state.template.nodes = (state.template.nodes || []).filter((n) => n.id !== node.id);
    deselectNode();
    renderTree();
    renderCanvas();
    setStatus('Élément supprimé', 'ok');
  }

  function allCatalogFields() {
    const rows = [];
    (catalog().FIELD_GROUPS || []).forEach((group) => {
      (group.fields || []).forEach((field) => rows.push(field));
    });
    return rows;
  }

  function rootNodes() {
    return (state.template?.nodes || []).filter((n) => !n.parentId);
  }

  function getNode(id) {
    return nodeMap().get(id);
  }

  function childrenOf(parentId) {
    const parent = getNode(parentId);
    const ids = Array.isArray(parent?.children) ? parent.children : [];
    return ids.map((id) => getNode(id)).filter(Boolean);
  }

  function setStatus(msg, type) {
    const el = $('adv2-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'adv2-status' + (type ? ` is-${type}` : '');
  }

  function mmStyle(layout) {
    const l = layout || {};
    return {
      left: `${l.x || 0}mm`,
      top: `${l.y || 0}mm`,
      width: `${l.width || 10}mm`,
      height: `${l.height || 10}mm`
    };
  }

  function getClickNodeChain(ev) {
    if (ev.target.classList?.contains('adv2-resize-handle')) return [];

    if (ev.target.closest?.('.adv2-zone-border-hit')) {
      const zoneEl = ev.target.closest('.adv2-node');
      const zone = zoneEl?.dataset.nodeId ? getNode(zoneEl.dataset.nodeId) : null;
      return zone ? [zone] : [];
    }

    let deepestId = null;
    const textFrameEl = ev.target.closest('[data-text-frame-id]');
    const childEl = ev.target.closest('[data-child-node-id]');

    if (textFrameEl) {
      deepestId = textFrameEl.getAttribute('data-text-frame-id');
    } else if (childEl) {
      deepestId = childEl.dataset.childNodeId;
    } else {
      const nodeEl = ev.target.closest('.adv2-node');
      if (nodeEl?.dataset.nodeId) deepestId = nodeEl.dataset.nodeId;
    }

    if (!deepestId) return [];

    const chain = [];
    let current = getNode(deepestId);
    while (current) {
      chain.unshift(current);
      current = current.parentId ? getNode(current.parentId) : null;
    }
    return chain;
  }

  function isZoneBorderClick(clientX, clientY, zoneId, ev) {
    if (ev?.target?.closest?.('.adv2-zone-border-hit')) return true;
    const zoneEl = document.querySelector(`.adv2-node[data-node-id="${zoneId}"]`);
    if (!zoneEl) return false;
    const rect = zoneEl.getBoundingClientRect();
    const borderPx = 8;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return x < borderPx || y < borderPx || x > rect.width - borderPx || y > rect.height - borderPx;
  }

  function resolveDrillDownSelection(chain, clickX, clickY, ev) {
    if (!chain.length) return null;
    const currentId = state.selectedId;
    if (!currentId) return chain[0].id;

    const currentNode = getNode(currentId);
    const currentIndex = chain.findIndex((n) => n.id === currentId);
    const rootZone = chain[0];

    if (currentNode?.parentId) {
      const currentParent = getNode(currentNode.parentId);

      if (currentIndex === -1) {
        if (rootZone?.id === currentParent?.id) {
          if (isZoneBorderClick(clickX, clickY, rootZone.id, ev)) {
            return rootZone.id;
          }
          const deepest = chain[chain.length - 1];
          if (deepest?.id !== currentId && deepest?.parentId === currentParent.id) {
            return deepest.id;
          }
          return currentId;
        }
        return chain[0].id;
      }

      if (currentIndex < chain.length - 1) {
        return chain[currentIndex + 1].id;
      }
      return currentId;
    }

    if (currentIndex === -1) return chain[0].id;
    if (currentIndex < chain.length - 1) return chain[currentIndex + 1].id;
    return currentId;
  }

  function isOnPathToSelection(nodeId) {
    if (!state.selectedId) return false;
    let current = getNode(state.selectedId);
    while (current) {
      if (current.id === nodeId) return true;
      current = current.parentId ? getNode(current.parentId) : null;
    }
    return false;
  }

  function isTreeNodeExpanded(nodeId, hasChildren) {
    if (!hasChildren) return false;
    if (state.treeCollapsed.has(nodeId)) return false;
    if (state.treeExpanded.has(nodeId)) return true;
    return isOnPathToSelection(nodeId);
  }

  function toggleTreeExpand(nodeId) {
    const n = getNode(nodeId);
    if (!n || !childrenOf(nodeId).length) return;
    const open = isTreeNodeExpanded(nodeId, true);
    if (open) {
      state.treeCollapsed.add(nodeId);
      state.treeExpanded.delete(nodeId);
    } else {
      state.treeCollapsed.delete(nodeId);
      state.treeExpanded.add(nodeId);
    }
    renderTree();
  }

  function isFieldGroupExpanded(groupId) {
    if (state.fieldsCollapsed.has(groupId)) return false;
    if (state.fieldsExpanded.has(groupId)) return true;
    return false;
  }

  function toggleFieldGroup(groupId) {
    const open = isFieldGroupExpanded(groupId);
    if (open) {
      state.fieldsCollapsed.add(groupId);
      state.fieldsExpanded.delete(groupId);
    } else {
      state.fieldsCollapsed.delete(groupId);
      state.fieldsExpanded.add(groupId);
    }
    renderSidePanel();
  }

  function nodeTreeLabel(node) {
    const name = escHtml(nodeDisplayName(node));
    const typeHint = node.type === 'text-frame' ? 'texte' : node.type;
    return `<span class="adv2-tree-name">${name}</span><span class="adv2-tree-type">${typeHint}</span>`;
  }

  function renderTree() {
    const wrap = $('adv2-tree');
    if (!wrap) return;
    const map = nodeMap();
    const lines = [];
    function walk(id, depth) {
      const n = map.get(id);
      if (!n) return;
      const children = Array.isArray(n.children) ? n.children : [];
      const hasChildren = children.length > 0;
      const expanded = isTreeNodeExpanded(n.id, hasChildren);
      const selected = isGuideEditMode()
        ? state.guideRefZoneId === n.id
        : state.selectedId === n.id;
      const guideRef = isGuideEditMode() && state.guideRefZoneId === n.id;
      const chevron = hasChildren
        ? `<span class="adv2-tree-chevron" aria-hidden="true">${expanded ? '▼' : '▶'}</span>`
        : '<span class="adv2-tree-chevron is-leaf" aria-hidden="true"></span>';
      lines.push(
        `<button type="button" class="adv2-tree-item${selected ? ' is-selected' : ''}${guideRef ? ' is-guide-ref' : ''}${n.type === 'text-frame' ? ' is-text-frame' : ''}${hasChildren ? ' has-children' : ''}${expanded ? ' is-expanded' : ''}" data-node-id="${n.id}" style="--adv2-tree-depth:${depth}">`
        + `<span class="adv2-tree-row">${chevron}<span class="adv2-tree-label">${nodeTreeLabel(n)}</span></span>`
        + `<small>${n.id}</small></button>`
      );
      if (expanded) {
        children.forEach((cid) => walk(cid, depth + 1));
      }
    }
    rootNodes().forEach((n) => walk(n.id, 0));
    wrap.innerHTML = lines.join('') || '<p class="text-muted">Aucun nœud</p>';
    wrap.querySelectorAll('.adv2-tree-chevron:not(.is-leaf)').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = el.closest('[data-node-id]')?.getAttribute('data-node-id');
        if (id) toggleTreeExpand(id);
      });
    });
    wrap.querySelectorAll('[data-node-id]').forEach((btn) => {
      btn.addEventListener('click', () => selectNode(btn.getAttribute('data-node-id')));
    });
  }

  function tableLineFields() {
    return catalog().TABLE_LINE_FIELDS || [];
  }

  function tableFieldLabel(key) {
    return tableLineFields().find((f) => f.key === key)?.label || key;
  }

  function getTableNodeForSelection(node) {
    if (!node) return null;
    if (node.type === 'table') return node;
    if (node.type === 'zone' && (node.zoneType === 'lignes' || node.collectionNamespace === 'ugap:ligne-devis')) {
      return childrenOf(node.id).find((c) => c.type === 'table') || null;
    }
    return null;
  }

  function findDevisTableNode() {
    const nodes = state.template?.nodes || [];
    return nodes.find(
      (n) => n.type === 'table' && n.tableConfig?.collectionNamespace === 'ugap:ligne-devis'
    ) || nodes.find((n) => n.type === 'table') || null;
  }

  function normalizeColumnWidths(fieldOrder, columnWidths) {
    const order = Array.isArray(fieldOrder) ? fieldOrder.filter(Boolean) : [];
    if (!order.length) return {};
    const raw = columnWidths && typeof columnWidths === 'object' ? columnWidths : {};
    const values = order.map((key) => {
      const n = Number(raw[key]);
      return Number.isFinite(n) && n > 0 ? n : null;
    });
    const hasCustom = values.some((v) => v != null);
    if (!hasCustom) {
      const equal = Math.round((100 / order.length) * 100) / 100;
      const out = {};
      order.forEach((key, i) => {
        out[key] = i === order.length - 1
          ? Math.round((100 - equal * (order.length - 1)) * 100) / 100
          : equal;
      });
      return out;
    }
    const sum = values.reduce((acc, v) => acc + (v != null ? v : 0), 0);
    const missing = values.filter((v) => v == null).length;
    const remaining = Math.max(0, 100 - sum);
    const fallback = missing ? remaining / missing : 0;
    const out = {};
    order.forEach((key, i) => {
      out[key] = Math.round((values[i] != null ? values[i] : fallback) * 100) / 100;
    });
    const total = Object.values(out).reduce((a, b) => a + b, 0);
    if (total > 0 && Math.abs(total - 100) > 0.01) {
      const lastKey = order[order.length - 1];
      out[lastKey] = Math.round((out[lastKey] + (100 - total)) * 100) / 100;
    }
    return out;
  }

  function buildColgroupHtml(fieldOrder, columnWidths) {
    const order = Array.isArray(fieldOrder) ? fieldOrder : [];
    const widths = normalizeColumnWidths(order, columnWidths);
    if (!order.length) return '';
    return `<colgroup>${order.map((key) => `<col style="width:${widths[key]}%">`).join('')}</colgroup>`;
  }

  function rowsPerPageFromHeight(tableHeightMm) {
    const headerMm = 8;
    const rowMm = 9.5;
    const h = Number(tableHeightMm);
    if (!Number.isFinite(h) || h <= headerMm) return 1;
    return Math.max(1, Math.floor((h - headerMm - 0.5) / rowMm));
  }

  function getPiedPageTopYFromTemplate(template) {
    const nodes = Array.isArray(template?.nodes) ? template.nodes : [];
    const pied = nodes.find((n) => n.type === 'zone' && n.zoneType === 'pied-de-page');
    if (!pied) return null;
    const page = template?.page || {};
    const ph = Number(page.heightMm) || 297;
    const layout = pied.layout || {};
    const h = Number(layout.height) || 32;
    const templateY = Number(layout.y);
    const bottomInset = Number.isFinite(templateY)
      ? Math.max(0, ph - templateY - h)
      : Number(page.margins?.bottom) || 15;
    return Math.round((ph - bottomInset - h) * 10) / 10;
  }

  function estimateFirstPageTableHeightMm(template) {
    const nodes = Array.isArray(template?.nodes) ? template.nodes : [];
    const zone = nodes.find((n) => n.zoneType === 'lignes' || n.id === 'zone_lignes');
    const table = nodes.find((n) => n.type === 'table' && n.parentId === zone?.id);
    const zoneY = Number(zone?.layout?.y) || 64;
    const tableY = Number(table?.layout?.y) || 1.8;
    const piedTop = getPiedPageTopYFromTemplate(template);
    const gapMm = 4;
    if (Number.isFinite(piedTop)) {
      return Math.max(10, piedTop - zoneY - tableY - gapMm - 1);
    }
    return Number(table?.layout?.height) || 86.4;
  }

  function ensureTableConfig(node) {
    if (!node?.tableConfig) node.tableConfig = { collectionNamespace: 'ugap:ligne-devis' };
    const cfg = node.tableConfig;
    if (!Array.isArray(cfg.fieldOrder) || !cfg.fieldOrder.length) {
      cfg.fieldOrder = [...(cfg.visibleFields?.length ? cfg.visibleFields : ['refUgap', 'libelle', 'prix'])];
    }
    cfg.visibleFields = [...cfg.fieldOrder];
    cfg.columnWidths = normalizeColumnWidths(cfg.fieldOrder, cfg.columnWidths);
    return cfg;
  }

  function setTableColumnWidth(tableNodeId, key, nextWidth, partnerKey, partnerNextWidth) {
    const node = getNode(tableNodeId);
    if (!node?.tableConfig) return;
    const cfg = ensureTableConfig(node);
    const width = Math.max(5, Math.min(95, Number(nextWidth) || 0));
    cfg.columnWidths[key] = Math.round(width * 100) / 100;
    if (partnerKey) {
      cfg.columnWidths[partnerKey] = Math.max(5, Math.min(95, Math.round((Number(partnerNextWidth) || 0) * 100) / 100));
    }
    cfg.columnWidths = normalizeColumnWidths(cfg.fieldOrder, cfg.columnWidths);
    renderCanvas();
    renderSidePanel();
  }

  function moveTableColumn(tableNodeId, key, delta) {
    const node = getNode(tableNodeId);
    if (!node?.tableConfig) return;
    const order = ensureTableConfig(node).fieldOrder;
    const i = order.indexOf(key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    node.tableConfig.visibleFields = [...order];
    node.tableConfig.columnWidths = normalizeColumnWidths(order, node.tableConfig.columnWidths);
    renderCanvas();
    renderSidePanel();
  }

  function removeTableColumn(tableNodeId, key) {
    const node = getNode(tableNodeId);
    if (!node?.tableConfig) return;
    const order = ensureTableConfig(node).fieldOrder;
    if (order.length <= 1) return;
    node.tableConfig.fieldOrder = order.filter((k) => k !== key);
    node.tableConfig.visibleFields = [...node.tableConfig.fieldOrder];
    delete node.tableConfig.columnWidths?.[key];
    node.tableConfig.columnWidths = normalizeColumnWidths(node.tableConfig.fieldOrder, node.tableConfig.columnWidths);
    renderCanvas();
    renderSidePanel();
  }

  function addTableColumn(tableNodeId, key) {
    if (!key) return;
    const node = getNode(tableNodeId);
    if (!node?.tableConfig) return;
    const order = ensureTableConfig(node).fieldOrder;
    if (order.includes(key)) return;
    order.push(key);
    node.tableConfig.visibleFields = [...order];
    node.tableConfig.columnWidths = normalizeColumnWidths(order, node.tableConfig.columnWidths);
    renderCanvas();
    renderSidePanel();
  }

  function bindTableColumnEvents(rootEl) {
    const panel = rootEl?.querySelector?.('[data-table-config-id]');
    if (!panel) return;
    const tableId = panel.getAttribute('data-table-config-id');
    panel.querySelectorAll('[data-table-col-up]').forEach((btn) => {
      btn.addEventListener('click', () => moveTableColumn(tableId, btn.getAttribute('data-table-col-up'), -1));
    });
    panel.querySelectorAll('[data-table-col-down]').forEach((btn) => {
      btn.addEventListener('click', () => moveTableColumn(tableId, btn.getAttribute('data-table-col-down'), 1));
    });
    panel.querySelectorAll('[data-table-col-remove]').forEach((btn) => {
      btn.addEventListener('click', () => removeTableColumn(tableId, btn.getAttribute('data-table-col-remove')));
    });
    panel.querySelectorAll('[data-table-col-width]').forEach((input) => {
      input.addEventListener('change', () => {
        setTableColumnWidth(tableId, input.getAttribute('data-table-col-width'), input.value);
      });
    });
    panel.querySelector('.adv2-table-col-add-btn')?.addEventListener('click', () => {
      addTableColumn(tableId, panel.querySelector('.adv2-table-col-add-select')?.value || '');
    });
  }

  function bindTableColumnResizeHandles(tableNodeId) {
    const preview = document.querySelector(`[data-table-preview-id="${tableNodeId}"]`);
    if (!preview) return;
    preview.querySelectorAll('[data-col-resize]').forEach((handle) => {
      handle.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const leftKey = handle.getAttribute('data-col-resize-left');
        const rightKey = handle.getAttribute('data-col-resize-right');
        const table = preview.querySelector('table');
        if (!table || !leftKey || !rightKey) return;
        const node = getNode(tableNodeId);
        const cfg = ensureTableConfig(node);
        const startX = ev.clientX;
        const tableWidth = table.getBoundingClientRect().width || 1;
        const startLeft = cfg.columnWidths[leftKey] || 0;
        const startRight = cfg.columnWidths[rightKey] || 0;

        function onMove(moveEv) {
          const deltaPct = ((moveEv.clientX - startX) / tableWidth) * 100;
          const nextLeft = Math.max(8, Math.min(startLeft + startRight - 8, startLeft + deltaPct));
          const nextRight = startLeft + startRight - nextLeft;
          cfg.columnWidths[leftKey] = Math.round(nextLeft * 100) / 100;
          cfg.columnWidths[rightKey] = Math.round(nextRight * 100) / 100;
          renderCanvas();
        }

        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          renderSidePanel();
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  function renderTableColumnsEditor(tableNode) {
    if (!tableNode) return '';
    const cfg = ensureTableConfig(tableNode);
    const order = cfg.fieldOrder;
    const used = new Set(order);
    const available = tableLineFields().filter((f) => !used.has(f.key));
    const tableHeight = estimateFirstPageTableHeightMm(state.template);
    const rowsPerPage = rowsPerPageFromHeight(tableHeight);
    const sampleCount = (catalog().SAMPLE_TABLE_LINES || []).length;
    const items = order.map((key, i) => `
      <li class="adv2-table-col-item">
        <span class="adv2-table-col-label">${escHtml(tableFieldLabel(key))}</span>
        <label class="adv2-table-col-width-field" title="Largeur en %">
          <input type="number" min="8" max="92" step="1" value="${cfg.columnWidths[key] || ''}" data-table-col-width="${escHtml(key)}" aria-label="Largeur ${escHtml(tableFieldLabel(key))}">
          <span>%</span>
        </label>
        <span class="adv2-table-col-actions">
          <button type="button" class="adv2-icon-btn" data-table-col-up="${escHtml(key)}"${i === 0 ? ' disabled' : ''} title="Monter">↑</button>
          <button type="button" class="adv2-icon-btn" data-table-col-down="${escHtml(key)}"${i === order.length - 1 ? ' disabled' : ''} title="Descendre">↓</button>
          <button type="button" class="adv2-icon-btn is-danger" data-table-col-remove="${escHtml(key)}"${order.length <= 1 ? ' disabled' : ''} title="Retirer">✕</button>
        </span>
      </li>
    `).join('');
    const options = available.map((f) => `<option value="${escHtml(f.key)}">${escHtml(f.label)}</option>`).join('');
    return `
      <section class="adv2-table-columns-panel" data-table-config-id="${escHtml(tableNode.id)}">
        <h4 class="adv2-dim-section-title">Colonnes du tableau</h4>
        <p class="text-muted" style="font-size:0.78rem;margin-bottom:8px;">Données : lignes du devis. Ajustez les colonnes, leur ordre et leur largeur (%). Glissez les séparateurs dans l'en-tête du tableau.</p>
        <p class="adv2-table-pagination-hint">Environ <strong>${rowsPerPage}</strong> lignes sur la 1<sup>re</sup> page (espace jusqu'au pied de page : ${Math.round(tableHeight * 10) / 10} mm, interligne ~9,5 mm). Hauteur du bloc lignes ajustée au contenu à l'export.</p>
        ${sampleCount > rowsPerPage ? `<p class="adv2-table-pagination-hint is-warn">Aperçu : ${sampleCount} lignes exemple — pagination visible à l'export PDF.</p>` : ''}
        <ol class="adv2-table-col-list">${items}</ol>
        <div class="adv2-table-col-add">
          <select class="adv2-table-col-add-select"${available.length ? '' : ' disabled'}>
            <option value="">Ajouter une colonne…</option>
            ${options}
          </select>
          <button type="button" class="adv2-copy-btn adv2-table-col-add-btn"${available.length ? '' : ' disabled'}>Ajouter</button>
        </div>
      </section>
    `;
  }

  function renderTablePreview(tableConfig, preview, tableNodeId, showResizeHandles) {
    const cfg = tableConfig || {};
    const fields = cfg.fieldOrder || cfg.visibleFields || ['refUgap', 'libelle', 'prix'];
    const colgroup = buildColgroupHtml(fields, cfg.columnWidths);
    const rows = preview ? (catalog().SAMPLE_TABLE_LINES || []) : [];

    let html = `<table style="width:100%;table-layout:fixed;border-collapse:collapse;">${colgroup}<thead><tr>`;
    fields.forEach((f, i) => {
      html += `<th>${escHtml(tableFieldLabel(f))}`;
      if (showResizeHandles && i < fields.length - 1) {
        html += `<span class="adv2-col-resize-handle" data-col-resize data-col-resize-left="${escHtml(f)}" data-col-resize-right="${escHtml(fields[i + 1])}" title="Redimensionner"></span>`;
      }
      html += '</th>';
    });
    html += '</tr></thead><tbody>';

    if (!rows.length) {
      html += '<tr>';
      fields.forEach(() => { html += '<td style="color:#94a3b8">…</td>'; });
      html += '</tr>';
    } else {
      rows.forEach((line) => {
        html += '<tr>';
        fields.forEach((f) => {
          html += `<td>${escHtml(line[f] || '')}</td>`;
        });
        html += '</tr>';
      });
    }

    html += '</tbody></table>';
    const wrapAttrs = tableNodeId ? ` data-table-preview-id="${escHtml(tableNodeId)}"` : '';
    return `<div class="adv2-table-preview-inner"${wrapAttrs}>${html}</div>`;
  }

  function renderImageNode(node, preview) {
    const varKey = node.imageConfig?.variable || '';
    const fit = node.imageConfig?.fit || 'contain';
    if (preview) {
      const src = catalog().PLACEHOLDER_DATA?.[varKey] || catalog().LOGO_PLACEHOLDER || '';
      return `<div class="adv2-image-frame"><img src="${src}" alt="" style="object-fit:${fit}"></div>`;
    }
    const label = varKey ? `{{${varKey}}}` : 'Image';
    return `<div class="adv2-image-frame adv2-image-placeholder"><span class="adv2-var-tag">${escHtml(label)}</span></div>`;
  }

  function textFrameInlineStyle(node) {
    const s = node.style || {};
    const parts = [`font-size:${s.fontSize || 10}pt`];
    if (s.textAlign) parts.push(`text-align:${s.textAlign}`);
    if (s.fontWeight) parts.push(`font-weight:${s.fontWeight}`);
    if (s.color) parts.push(`color:${s.color}`);
    return parts.join(';');
  }

  function ensureNodeStyle(node) {
    if (!node.style || typeof node.style !== 'object') node.style = {};
    return node.style;
  }

  function stripInlineTextAlignFromHtml(html) {
    const wrap = document.createElement('div');
    wrap.innerHTML = String(html || '');
    wrap.querySelectorAll('[style]').forEach((el) => {
      el.style.removeProperty('text-align');
      if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
    });
    return wrap.innerHTML;
  }

  function applyFrameTextAlign(node, align) {
    if (!node || node.type !== 'text-frame' || !align) return;
    ensureNodeStyle(node).textAlign = align;
    if (node.content?.html) {
      node.content.html = stripInlineTextAlignFromHtml(node.content.html);
    }
  }

  function renderChildNode(node) {
    if (node.type === 'text-frame') {
      const editMode = isTextFrameEditMode(node.id);
      const raw = node.content?.html || '';
      const html = editMode ? highlightVariables(raw) : applyPlaceholders(raw);
      const selected = state.selectedId === node.id;
      const classes = [
        'adv2-text-frame',
        selected ? 'is-selected' : '',
        editMode ? 'is-editing' : 'is-preview'
      ].filter(Boolean).join(' ');
      return `<div class="${classes}" contenteditable="${editMode ? 'true' : 'false'}" data-text-frame-id="${node.id}" data-node-type="text-frame" style="${textFrameInlineStyle(node)}">${html}</div>`;
    }
    if (node.type === 'table') {
      const showHandles = state.selectedId === node.id
        || state.selectedId === node.parentId
        || getNode(state.selectedId)?.parentId === node.parentId;
      return `<div class="adv2-table-preview is-preview">${renderTablePreview(node.tableConfig, true, node.id, showHandles)}</div>`;
    }
    if (node.type === 'image') {
      return renderImageNode(node, true);
    }
    return '';
  }

  function renderSnapLines() {
    const layer = $('adv2-snap-lines');
    if (!layer) return;
    layer.innerHTML = state.snapLines.map((line) => {
      if (line.type === 'v') {
        return `<div class="adv2-guide-line is-v" style="left:${line.at}mm"></div>`;
      }
      return `<div class="adv2-guide-line is-h" style="top:${line.at}mm"></div>`;
    }).join('');
  }

  function renderRulers() {
    const rulerH = $('adv2-ruler-h');
    const rulerV = $('adv2-ruler-v');
    if (!rulerH || !rulerV || !state.template || !isGuideEditMode()) {
      if (rulerH) rulerH.innerHTML = '';
      if (rulerV) rulerV.innerHTML = '';
      return;
    }
    const pw = state.template.page?.widthMm || 210;
    const ph = state.template.page?.heightMm || 297;
    const tickEvery = 10;
    const labelEvery = 50;
    let hHtml = '';
    for (let mm = 0; mm <= pw; mm += tickEvery) {
      const pct = (mm / pw) * 100;
      const major = mm % labelEvery === 0;
      hHtml += `<span class="adv2-ruler-tick${major ? ' is-major' : ''}" style="left:${pct}%"><i></i>${major ? `<em>${mm}</em>` : ''}</span>`;
    }
    let vHtml = '';
    for (let mm = 0; mm <= ph; mm += tickEvery) {
      const pct = (mm / ph) * 100;
      const major = mm % labelEvery === 0;
      vHtml += `<span class="adv2-ruler-tick${major ? ' is-major' : ''}" style="top:${pct}%"><i></i>${major ? `<em>${mm}</em>` : ''}</span>`;
    }
    rulerH.innerHTML = hHtml;
    rulerV.innerHTML = vHtml;
  }

  function mmFromPageEvent(ev) {
    const page = $('adv2-page');
    if (!page) return { xMm: 0, yMm: 0 };
    return pagePointFromEvent(ev, page);
  }

  function ensureGuides() {
    state.template.guides = state.template.guides || { vertical: [], horizontal: [] };
    state.template.guides.vertical = state.template.guides.vertical || [];
    state.template.guides.horizontal = state.template.guides.horizontal || [];
    ensureGuideOriginArrays(state.template.guides);
    return state.template.guides;
  }

  function pageSizeMm() {
    return {
      w: state.template?.page?.widthMm || 210,
      h: state.template?.page?.heightMm || 297
    };
  }

  function ensureGuideOriginArrays(guides) {
    guides.verticalFrom = guides.verticalFrom || [];
    guides.horizontalFrom = guides.horizontalFrom || [];
    while (guides.verticalFrom.length < guides.vertical.length) guides.verticalFrom.push('left');
    while (guides.horizontalFrom.length < guides.horizontal.length) guides.horizontalFrom.push('top');
    guides.verticalFrom.length = guides.vertical.length;
    guides.horizontalFrom.length = guides.horizontal.length;
  }

  function getGuideOrigin(axis, index) {
    const guides = ensureGuides();
    if (axis === 'v') return guides.verticalFrom[index] === 'right' ? 'right' : 'left';
    return guides.horizontalFrom[index] === 'bottom' ? 'bottom' : 'top';
  }

  function guideOriginLabel(axis, origin) {
    if (axis === 'v') return origin === 'right' ? 'Depuis droite' : 'Depuis gauche';
    return origin === 'bottom' ? 'Depuis bas' : 'Depuis haut';
  }

  function guideOriginShort(axis, origin) {
    if (axis === 'v') return origin === 'right' ? 'Droite' : 'Gauche';
    return origin === 'bottom' ? 'Bas' : 'Haut';
  }

  function absoluteToDisplay(axis, absoluteMm, origin) {
    const { w, h } = pageSizeMm();
    if (axis === 'v') {
      return origin === 'right'
        ? Math.round((w - absoluteMm) * 10) / 10
        : Math.round(absoluteMm * 10) / 10;
    }
    return origin === 'bottom'
      ? Math.round((h - absoluteMm) * 10) / 10
      : Math.round(absoluteMm * 10) / 10;
  }

  function displayToAbsolute(axis, displayMm, origin) {
    const { w, h } = pageSizeMm();
    if (axis === 'v') {
      return snapGuideMm('v', origin === 'right' ? w - displayMm : displayMm);
    }
    return snapGuideMm('h', origin === 'bottom' ? h - displayMm : displayMm);
  }

  function toggleGuideOriginAt(axis, index) {
    const guides = ensureGuides();
    ensureGuideOriginArrays(guides);
    const list = axis === 'v' ? guides.vertical : guides.horizontal;
    const fromList = axis === 'v' ? guides.verticalFrom : guides.horizontalFrom;
    const currentOrigin = getGuideOrigin(axis, index);
    const display = absoluteToDisplay(axis, list[index], currentOrigin);
    const newOrigin = axis === 'v'
      ? (currentOrigin === 'left' ? 'right' : 'left')
      : (currentOrigin === 'top' ? 'bottom' : 'top');
    fromList[index] = newOrigin;
    list[index] = displayToAbsolute(axis, display, newOrigin);
    renderCanvas();
    renderSidePanel();
  }

  function selectGuide(axis, index) {
    if (!isGuideEditMode()) return;
    state.selectedGuide = { axis, index };
    state.selectedId = null;
    state.sideTab = 'dim';
    renderTree();
    renderSidePanel();
    renderCanvas();
  }

  function deselectGuide() {
    if (!state.selectedGuide) return;
    state.selectedGuide = null;
    renderSidePanel();
    renderCanvas();
  }

  function deleteSelectedGuide() {
    const sel = state.selectedGuide;
    if (!sel || !state.template) return;
    const guides = ensureGuides();
    const list = sel.axis === 'v' ? guides.vertical : guides.horizontal;
    if (sel.index < 0 || sel.index >= list.length) return;
    list.splice(sel.index, 1);
    if (sel.axis === 'v') guides.verticalFrom?.splice(sel.index, 1);
    else guides.horizontalFrom?.splice(sel.index, 1);
    state.selectedGuide = null;
    renderCanvas();
    renderSidePanel();
  }

  function addGuideAt(axis, mm) {
    if (!isGuideEditMode()) return;
    const guides = ensureGuides();
    const val = snapGuideMm(axis, mm);
    ensureGuideOriginArrays(guides);
    if (axis === 'v') {
      guides.vertical.push(val);
      guides.verticalFrom.push('left');
    } else {
      guides.horizontal.push(val);
      guides.horizontalFrom.push('top');
    }
    selectGuide(axis, (axis === 'v' ? guides.vertical : guides.horizontal).length - 1);
  }

  function nodePageRect(node) {
    if (!node || !global.Adv2Snap?.nodePageRect) return null;
    const nodeMap = new Map((state.template?.nodes || []).map((n) => [n.id, n]));
    return global.Adv2Snap.nodePageRect(node, nodeMap);
  }

  function captureGuideRefZone() {
    const zone = getHostZoneForActions(getNode(state.selectedId));
    if (zone) state.guideRefZoneId = zone.id;
  }

  function getGuideSymmetryCenter(axis, target) {
    const { w, h } = pageSizeMm();
    if (target !== 'zone') return axis === 'v' ? w / 2 : h / 2;
    const zone = getNode(state.guideRefZoneId);
    const rect = zone ? nodePageRect(zone) : null;
    if (!rect) return axis === 'v' ? w / 2 : h / 2;
    return axis === 'v' ? rect.x + rect.w / 2 : rect.y + rect.h / 2;
  }

  function duplicateSelectedGuide() {
    const sel = state.selectedGuide;
    if (!sel || !isGuideEditMode()) return;
    const offset = Number($('prop-guide-dup-offset')?.value);
    if (!Number.isFinite(offset) || offset <= 0) {
      setStatus('Indiquez un écart de duplication supérieur à 0 mm', 'err');
      return;
    }
    const guides = ensureGuides();
    ensureGuideOriginArrays(guides);
    const list = sel.axis === 'v' ? guides.vertical : guides.horizontal;
    const fromList = sel.axis === 'v' ? guides.verticalFrom : guides.horizontalFrom;
    const abs = list[sel.index];
    if (!Number.isFinite(abs)) return;
    const origin = getGuideOrigin(sel.axis, sel.index);
    const newAbs = snapGuideMm(sel.axis, abs + offset);
    list.push(newAbs);
    fromList.push(origin);
    selectGuide(sel.axis, list.length - 1);
    setStatus(`Guide dupliqué à ${offset} mm du guide source`, 'ok');
  }

  function mirrorSelectedGuide(target) {
    const sel = state.selectedGuide;
    if (!sel || !isGuideEditMode()) return;
    if (target === 'zone' && !state.guideRefZoneId) {
      setStatus('Choisissez une zone dans la liste pour la symétrie zone', 'err');
      return;
    }
    const guides = ensureGuides();
    ensureGuideOriginArrays(guides);
    const list = sel.axis === 'v' ? guides.vertical : guides.horizontal;
    const fromList = sel.axis === 'v' ? guides.verticalFrom : guides.horizontalFrom;
    const abs = list[sel.index];
    if (!Number.isFinite(abs)) return;
    const origin = getGuideOrigin(sel.axis, sel.index);
    const center = getGuideSymmetryCenter(sel.axis, target);
    const mirroredAbs = snapGuideMm(sel.axis, 2 * center - abs);
    const mirroredOrigin = sel.axis === 'v'
      ? (origin === 'left' ? 'right' : 'left')
      : (origin === 'top' ? 'bottom' : 'top');
    list.push(mirroredAbs);
    fromList.push(mirroredOrigin);
    selectGuide(sel.axis, list.length - 1);
    if (target === 'zone') {
      const zone = getNode(state.guideRefZoneId);
      setStatus(`Guide symétrique créé — centre de la zone « ${nodeDisplayName(zone)} »`, 'ok');
    } else {
      setStatus('Guide symétrique créé — centre de la page', 'ok');
    }
  }

  function snapGuideMm(axis, mm) {
    const pw = state.template.page?.widthMm || 210;
    const ph = state.template.page?.heightMm || 297;
    const max = axis === 'v' ? pw : ph;
    const clamped = Math.max(0, Math.min(max, mm));
    return Math.round(clamped * 2) / 2;
  }

  function snapGuidePosition(axis, rawMm, excludeIndex, altKey) {
    if (altKey || !global.Adv2Snap?.applySnapGuide) {
      return { mm: snapGuideMm(axis, rawMm), lines: [] };
    }
    const zone = state.guideRefZoneId ? getNode(state.guideRefZoneId) : null;
    const zoneRect = zone ? nodePageRect(zone) : null;
    const snapPage = {
      widthMm: state.template.page?.widthMm || 210,
      heightMm: state.template.page?.heightMm || 297,
      margins: state.template.page?.margins,
      snap: state.template.snap
    };
    const snapped = global.Adv2Snap.applySnapGuide(
      axis,
      rawMm,
      snapPage,
      ensureGuides(),
      zoneRect,
      excludeIndex
    );
    return {
      mm: snapGuideMm(axis, snapped.mm),
      lines: snapped.lines || []
    };
  }

  function toggleGuideEditMode() {
    state.guideEditMode = !state.guideEditMode;
    if (state.guideEditMode) {
      blurActiveTextFrame();
      captureGuideRefZone();
      state.view.showGuides = true;
      state.selectedId = null;
      state.sideTab = 'dim';
      setStatus('Mode édition guides — glissez depuis la règle ou déplacez les guides', 'ok');
    } else {
      state.selectedGuide = null;
      state.guideRefZoneId = null;
      state.drag = null;
      state.snapLines = [];
      setStatus('Mode édition guides terminé', 'ok');
    }
    renderTree();
    renderSidePanel();
    renderCanvas();
  }

  function toggleGuidesVisibility() {
    state.view.showGuides = !state.view.showGuides;
    if (!state.view.showGuides) {
      if (state.guideEditMode) {
        state.guideEditMode = false;
        state.selectedGuide = null;
        state.drag = null;
      }
      setStatus('Guides masqués', 'ok');
    } else {
      setStatus('Guides affichés', 'ok');
    }
    renderSidePanel();
    renderCanvas();
  }

  function updateGuideModeUi() {
    const grid = document.querySelector('.adv2-stage-grid');
    const wrap = document.querySelector('.adv2-canvas-wrap');
    grid?.classList.toggle('is-guide-edit', isGuideEditMode());
    wrap?.classList.toggle('is-guide-edit-active', isGuideEditMode());

    const editBtn = $('adv2-edit-guides');
    if (editBtn) {
      editBtn.classList.toggle('is-active', isGuideEditMode());
      editBtn.setAttribute('aria-pressed', isGuideEditMode() ? 'true' : 'false');
      editBtn.textContent = isGuideEditMode() ? 'Terminer édition guides' : 'Éditer les guides';
    }

    const hideBtn = $('adv2-toggle-guides');
    if (hideBtn) {
      hideBtn.textContent = state.view.showGuides ? 'Masquer les guides' : 'Afficher les guides';
      hideBtn.classList.toggle('is-muted', !state.view.showGuides);
    }

    const guideTools = $('adv2-guide-tools');
    if (guideTools) {
      const visible = isGuideEditMode();
      guideTools.hidden = !visible;
      guideTools.classList.toggle('is-visible', visible);
    }

    const statusBanner = $('adv2-guide-mode-banner');
    if (statusBanner) statusBanner.hidden = !isGuideEditMode();
  }

  function startGuideDrag(axis, index, ev) {
    state.drag = {
      type: 'guide',
      axis,
      index,
      startX: mmFromPageEvent(ev).xMm,
      startY: mmFromPageEvent(ev).yMm
    };
  }

  function renderStaticGuides() {
    const page = $('adv2-page');
    if (!page || !state.template || !state.view.showGuides) return;
    page.querySelectorAll('.adv2-guide-static').forEach((el) => el.remove());
    const guides = ensureGuides();
    const editable = isGuideEditMode();
    guides.vertical.forEach((at, index) => {
      const el = document.createElement('div');
      const selected = editable && state.selectedGuide?.axis === 'v' && state.selectedGuide?.index === index;
      el.className = 'adv2-guide-static is-v'
        + (selected ? ' is-selected' : '')
        + (editable ? ' is-editable' : ' is-readonly');
      el.style.left = `${at}mm`;
      el.dataset.guideAxis = 'v';
      el.dataset.guideIndex = String(index);
      if (editable && selected) {
        const origin = getGuideOrigin('v', index);
        const display = absoluteToDisplay('v', at, origin);
        const badge = document.createElement('span');
        badge.className = 'adv2-guide-label';
        badge.textContent = `${display} mm · ${guideOriginShort('v', origin)}`;
        el.appendChild(badge);
      }
      page.appendChild(el);
    });
    guides.horizontal.forEach((at, index) => {
      const el = document.createElement('div');
      const selected = editable && state.selectedGuide?.axis === 'h' && state.selectedGuide?.index === index;
      el.className = 'adv2-guide-static is-h'
        + (selected ? ' is-selected' : '')
        + (editable ? ' is-editable' : ' is-readonly');
      el.style.top = `${at}mm`;
      el.dataset.guideAxis = 'h';
      el.dataset.guideIndex = String(index);
      if (editable && selected) {
        const origin = getGuideOrigin('h', index);
        const display = absoluteToDisplay('h', at, origin);
        const badge = document.createElement('span');
        badge.className = 'adv2-guide-label';
        badge.textContent = `${display} mm · ${guideOriginShort('h', origin)}`;
        el.appendChild(badge);
      }
      page.appendChild(el);
    });
  }

  function renderGuidesSection() {
    if (!isGuideEditMode()) {
      return `
        <h4 class="adv2-dim-section-title">Guides</h4>
        <p class="text-muted" style="font-size:0.82rem;">
          Cliquez sur <strong>Éditer les guides</strong> dans la barre d’outils pour afficher la règle mm et placer les guides par glisser-déposer.
        </p>
      `;
    }
    const guides = ensureGuides();
    const sel = state.selectedGuide;
    const rows = [];
    guides.vertical.forEach((at, index) => {
      const active = sel?.axis === 'v' && sel.index === index;
      const origin = getGuideOrigin('v', index);
      const display = absoluteToDisplay('v', at, origin);
      rows.push(`
        <div class="adv2-guide-row${active ? ' is-active' : ''}" data-guide-axis="v" data-guide-index="${index}">
          <button type="button" class="adv2-guide-pick" data-guide-pick="v:${index}">↕</button>
          <span>Vertical</span>
          <button type="button" class="adv2-guide-origin" data-guide-origin="v:${index}" title="Changer le bord de référence">${escHtml(guideOriginShort('v', origin))}</button>
          <input type="number" step="0.5" class="adv2-guide-pos" data-guide-pos="v:${index}" value="${display}">
          <span class="text-muted">mm</span>
          <button type="button" class="adv2-guide-del" data-guide-del="v:${index}" title="Supprimer">×</button>
        </div>
      `);
    });
    guides.horizontal.forEach((at, index) => {
      const active = sel?.axis === 'h' && sel.index === index;
      const origin = getGuideOrigin('h', index);
      const display = absoluteToDisplay('h', at, origin);
      rows.push(`
        <div class="adv2-guide-row${active ? ' is-active' : ''}" data-guide-axis="h" data-guide-index="${index}">
          <button type="button" class="adv2-guide-pick" data-guide-pick="h:${index}">↔</button>
          <span>Horizontal</span>
          <button type="button" class="adv2-guide-origin" data-guide-origin="h:${index}" title="Changer le bord de référence">${escHtml(guideOriginShort('h', origin))}</button>
          <input type="number" step="0.5" class="adv2-guide-pos" data-guide-pos="h:${index}" value="${display}">
          <span class="text-muted">mm</span>
          <button type="button" class="adv2-guide-del" data-guide-del="h:${index}" title="Supprimer">×</button>
        </div>
      `);
    });
    const zoneOptions = rootNodes()
      .filter((n) => n.type === 'zone')
      .map((z) => `<option value="${z.id}"${state.guideRefZoneId === z.id ? ' selected' : ''}>${escHtml(nodeDisplayName(z))}</option>`)
      .join('');
    const selEditor = sel ? `
      <div class="adv2-guide-selected">
        <div class="adv2-guide-dup-block">
          <strong class="adv2-guide-dup-title">Dupliquer</strong>
          <p class="text-muted adv2-guide-block-hint">Crée une copie du guide : écart saisi ou symétrie page / zone.</p>
          <label class="adv2-guide-dup-label">écart depuis le guide source (mm)
            <input type="number" step="0.5" min="0.5" id="prop-guide-dup-offset" value="10">
          </label>
          <button type="button" class="adv2-copy-btn adv2-guide-dup-btn" id="prop-guide-duplicate">Dupliquer</button>
          <div class="adv2-guide-ref-zone">
            <label for="prop-guide-ref-zone">Zone pour symétrie</label>
            <select id="prop-guide-ref-zone">
              <option value="">— Choisir une zone —</option>
              ${zoneOptions}
            </select>
          </div>
          <div class="adv2-guide-actions">
            <button type="button" class="adv2-copy-btn" id="prop-guide-mirror-page">Symétrie page</button>
            <button type="button" class="adv2-copy-btn" id="prop-guide-mirror-zone"${state.guideRefZoneId ? '' : ' disabled'} title="Choisir une zone ci-dessus">Symétrie zone</button>
          </div>
        </div>
        <button type="button" class="adv2-copy-btn is-danger" id="prop-guide-delete">Supprimer le guide</button>
      </div>
    ` : '';
    return `
      <h4 class="adv2-dim-section-title">Édition des guides</h4>
      ${selEditor}
      <div class="adv2-guide-list">${rows.length ? rows.join('') : '<p class="text-muted" style="font-size:0.82rem;">Aucun guide — utilisez les boutons ou les règles.</p>'}</div>
    `;
  }

  function bindGuidesPanelEvents(rootEl) {
    const scope = rootEl || document;
    scope.querySelector('#prop-guide-delete')?.addEventListener('click', deleteSelectedGuide);
    scope.querySelector('#prop-guide-duplicate')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      duplicateSelectedGuide();
    });
    scope.querySelector('#prop-guide-mirror-page')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      mirrorSelectedGuide('page');
    });
    scope.querySelector('#prop-guide-mirror-zone')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      mirrorSelectedGuide('zone');
    });
    scope.querySelector('#prop-guide-ref-zone')?.addEventListener('change', (e) => {
      state.guideRefZoneId = e.target.value || null;
      renderTree();
      renderSidePanel();
      renderCanvas();
    });
    scope.querySelectorAll('[data-guide-origin]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const [axis, index] = btn.getAttribute('data-guide-origin').split(':');
        toggleGuideOriginAt(axis, Number(index));
        selectGuide(axis, Number(index));
      });
    });
    scope.querySelectorAll('[data-guide-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [axis, index] = btn.getAttribute('data-guide-pick').split(':');
        selectGuide(axis, Number(index));
      });
    });
    scope.querySelectorAll('[data-guide-pos]').forEach((input) => {
      input.addEventListener('change', () => {
        const [axis, index] = input.getAttribute('data-guide-pos').split(':');
        const val = Number(input.value);
        if (!Number.isFinite(val)) return;
        const guides = ensureGuides();
        const list = axis === 'v' ? guides.vertical : guides.horizontal;
        const idx = Number(index);
        const origin = getGuideOrigin(axis, idx);
        const abs = displayToAbsolute(axis, val, origin);
        const snapped = snapGuidePosition(axis, abs, idx, false);
        list[idx] = snapped.mm;
        selectGuide(axis, idx);
      });
    });
    scope.querySelectorAll('[data-guide-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [axis, index] = btn.getAttribute('data-guide-del').split(':');
        state.selectedGuide = { axis, index: Number(index) };
        deleteSelectedGuide();
      });
    });
  }

  function renderZoneStyleSection(node) {
    if (!node || node.type !== 'zone' || node.parentId) return '';
    const s = node.style || {};
    const border = parseZoneBorderCss(s.border);
    const bgInput = cssColorToInputValue(s.backgroundColor || '#f8fafc');
    const borderColorInput = cssColorToInputValue(border.color);
    return `
      <h4 class="adv2-dim-section-title">Apparence zone</h4>
      <div class="adv2-zone-style-grid">
        <label>Fond
          <input type="color" id="prop-zone-bg" value="${bgInput}">
        </label>
        <label class="adv2-zone-style-check">
          <input type="checkbox" id="prop-zone-border-enabled"${border.enabled ? ' checked' : ''}>
          Cadre
        </label>
        <label>Style cadre
          <select id="prop-zone-border-style">
            <option value="solid"${border.style === 'solid' ? ' selected' : ''}>Plein</option>
            <option value="dashed"${border.style === 'dashed' ? ' selected' : ''}>Pointillé</option>
            <option value="dotted"${border.style === 'dotted' ? ' selected' : ''}>Points</option>
          </select>
        </label>
        <label>Épaisseur (px)
          <input type="number" min="1" max="8" step="1" id="prop-zone-border-width" value="${border.width || 1}">
        </label>
        <label>Couleur cadre
          <input type="color" id="prop-zone-border-color" value="${borderColorInput}">
        </label>
      </div>
      <p class="text-muted" style="font-size:0.78rem;margin-top:6px;">
        Ce cadre est enregistré dans le PDF. À l’écran, il apparaît quand la zone est sélectionnée
        (ou si « Aperçu des cadres » est activé dans Affichage éditeur, onglet Dim.).
      </p>
    `;
  }

  function renderPageMarginsSection() {
    const m = state.template?.page?.margins || { top: 15, right: 15, bottom: 15, left: 15 };
    return `
      <section class="adv2-page-margins-panel">
        <h4 class="adv2-dim-section-title">Marges de page</h4>
        <p class="text-muted" style="font-size:0.78rem;margin-bottom:8px;">
          Zone utile du document (alignement snap). Modifiable ici sans sélection de bloc.
        </p>
        <div class="adv2-dim-grid">
          <label>Haut (mm)<input type="number" step="0.5" min="0" id="prop-margin-top" value="${m.top ?? 15}"></label>
          <label>Droite (mm)<input type="number" step="0.5" min="0" id="prop-margin-right" value="${m.right ?? 15}"></label>
          <label>Bas (mm)<input type="number" step="0.5" min="0" id="prop-margin-bottom" value="${m.bottom ?? 15}"></label>
          <label>Gauche (mm)<input type="number" step="0.5" min="0" id="prop-margin-left" value="${m.left ?? 15}"></label>
        </div>
      </section>
    `;
  }

  function renderEditorViewSection() {
    return `
      <section class="adv2-editor-view-panel">
        <h4 class="adv2-dim-section-title">Affichage éditeur</h4>
        <p class="text-muted" style="font-size:0.78rem;margin-bottom:8px;">
          Repères visuels à l’écran seulement — n’apparaissent pas dans le PDF exporté.
        </p>
        <label class="adv2-zone-fit-label" for="adv2-view-margins">
          <input type="checkbox" id="adv2-view-margins"${state.view.showMargins ? ' checked' : ''}>
          <span>Afficher le repère des marges de page</span>
        </label>
        <label class="adv2-zone-fit-label" for="adv2-view-frames">
          <input type="checkbox" id="adv2-view-frames"${state.view.showZoneFrames ? ' checked' : ''}>
          <span>Aperçu des cadres de toutes les zones</span>
        </label>
      </section>
    `;
  }

  function applyPageMarginsFromForm() {
    if (!state.template) return;
    state.template.page = state.template.page || {};
    state.template.page.margins = {
      top: Number($('prop-margin-top')?.value) || 0,
      right: Number($('prop-margin-right')?.value) || 0,
      bottom: Number($('prop-margin-bottom')?.value) || 0,
      left: Number($('prop-margin-left')?.value) || 0
    };
    renderCanvas();
  }

  function bindEditorViewEvents(rootEl) {
    const scope = rootEl || document;
    scope.querySelector('#adv2-view-margins')?.addEventListener('change', (e) => {
      state.view.showMargins = !!e.target.checked;
      renderCanvas();
    });
    scope.querySelector('#adv2-view-frames')?.addEventListener('change', (e) => {
      state.view.showZoneFrames = !!e.target.checked;
      renderCanvas();
    });
    ['prop-margin-top', 'prop-margin-right', 'prop-margin-bottom', 'prop-margin-left'].forEach((id) => {
      scope.querySelector(`#${id}`)?.addEventListener('change', applyPageMarginsFromForm);
    });
  }

  function applyZoneStyleFromForm() {
    const node = getNode(state.selectedId);
    if (!node || node.type !== 'zone' || node.parentId) return;
    node.style = node.style || {};
    const bg = $('prop-zone-bg')?.value;
    if (bg) node.style.backgroundColor = bg;
    const border = {
      enabled: !!$('prop-zone-border-enabled')?.checked,
      style: $('prop-zone-border-style')?.value || 'solid',
      width: Number($('prop-zone-border-width')?.value) || 1,
      color: $('prop-zone-border-color')?.value || '#94a3b8'
    };
    node.style.border = buildZoneBorderCss(border);
    renderCanvas();
  }

  function bindZoneStyleEvents(rootEl) {
    const scope = rootEl || document;
    ['prop-zone-bg', 'prop-zone-border-enabled', 'prop-zone-border-style', 'prop-zone-border-width', 'prop-zone-border-color'].forEach((id) => {
      scope.querySelector(`#${id}`)?.addEventListener('change', applyZoneStyleFromForm);
      scope.querySelector(`#${id}`)?.addEventListener('input', applyZoneStyleFromForm);
    });
  }

  function renderCanvas() {
    const page = $('adv2-page');
    const scaler = $('adv2-stage-scaler');
    if (!page || !state.template) return;

    const m = state.template.page?.margins || { top: 15, right: 15, bottom: 15, left: 15 };
    const pw = state.template.page?.widthMm || 210;
    const ph = state.template.page?.heightMm || 297;

    if (scaler) scaler.style.setProperty('--adv2-zoom', state.zoom);
    else page.style.setProperty('--adv2-zoom', state.zoom);

    page.innerHTML = `
      ${state.view.showMargins ? `<div class="adv2-margin-box" style="left:${m.left}mm;top:${m.top}mm;width:${pw - m.left - m.right}mm;height:${ph - m.top - m.bottom}mm"></div>` : ''}
      <div class="adv2-snap-lines" id="adv2-snap-lines"></div>
    `;

    const selectedNode = getNode(state.selectedId);

    const roots = rootNodes().slice().sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));
    roots.forEach((node) => {
      const el = document.createElement('div');
      const zoneSelected = state.selectedId === node.id;
      const isGuideRefZone = isGuideEditMode() && state.guideRefZoneId === node.id;
      const parentOfSelectedChild = selectedNode?.parentId === node.id;
      el.className = 'adv2-node'
        + (zoneSelected ? ' is-selected' : '')
        + (isGuideRefZone ? ' is-guide-ref-zone' : '')
        + (parentOfSelectedChild ? ' is-parent-selected has-child-selected' : '');
      el.dataset.nodeId = node.id;
      Object.assign(el.style, mmStyle(node.layout));
      applyEditorZoneChrome(el, node, zoneSelected || isGuideRefZone);
      el.style.zIndex = String(renderZIndex(node, {
        isRoot: true,
        zoneSelected: zoneSelected || isGuideRefZone,
        parentOfSelectedChild
      }));

      const childIds = Array.isArray(node.children) ? node.children : [];
      childIds.forEach((cid, idx) => {
        const child = getNode(cid);
        if (!child) return;
        const childEl = document.createElement('div');
        const childSelected = state.selectedId === child.id;
        const childEditing = child.type === 'text-frame' && state.textEditingId === child.id;
        childEl.className = 'adv2-node-child'
          + (child.type === 'text-frame' ? ' is-text-frame-child' : '')
          + (childSelected ? ' is-selected' : '')
          + (childEditing ? ' is-editing' : '');
        childEl.dataset.childNodeId = child.id;
        Object.assign(childEl.style, mmStyle(child.layout));
        childEl.style.zIndex = String(renderZIndex(child, { childSelected, fallback: idx + 1 }));
        childEl.innerHTML = renderChildNode(child);
        if (childSelected && canDragNode(child) && !childEditing) {
          appendResizeHandles(childEl, child.id);
        }
        el.appendChild(childEl);
      });

      if (zoneSelected && !node.parentId) {
        appendResizeHandles(el, node.id);
      }

      if (parentOfSelectedChild) {
        const borderHit = document.createElement('div');
        borderHit.className = 'adv2-zone-border-hit';
        borderHit.innerHTML = '<span class="hit-t"></span><span class="hit-r"></span><span class="hit-b"></span><span class="hit-l"></span>';
        el.appendChild(borderHit);
      }

      if (isGuideRefZone) {
        const refBadge = document.createElement('span');
        refBadge.className = 'adv2-guide-ref-zone-label';
        refBadge.textContent = nodeDisplayName(node);
        el.appendChild(refBadge);
      }

      page.appendChild(el);
    });

    renderStaticGuides();
    renderSnapLines();
    renderRulers();
    updateGuideModeUi();
    document.querySelectorAll('.adv2-table-preview').forEach(blockInnerScroll);
    const tableNode = findDevisTableNode();
    if (tableNode) bindTableColumnResizeHandles(tableNode.id);
  }

  function getActiveTextFrameEl() {
    const node = getNode(state.selectedId);
    if (!node || node.type !== 'text-frame') return null;
    return document.querySelector(`[data-text-frame-id="${node.id}"]`);
  }

  function syncTextFrameHtml(el) {
    const id = el.getAttribute('data-text-frame-id');
    const node = getNode(id);
    if (!node) return;
    node.content = node.content || { mode: 'flow' };
    node.content.html = el.innerHTML.replace(/<span class="adv2-var-tag">(\{\{[^}]+\}\})<\/span>/g, '$1');
  }

  function getSelectionInFrame() {
    const el = getActiveTextFrameEl();
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return null;
    return { el, sel, range };
  }

  function applyInlineCommand(cmd, value) {
    const ctx = getSelectionInFrame();
    if (!ctx) {
      setStatus('Sélectionnez du texte dans le cadre', 'err');
      return;
    }
    ctx.el.focus();
    document.execCommand(cmd, false, value || null);
    syncTextFrameHtml(ctx.el);
  }

  function wrapSelectionStyle(styles) {
    const ctx = getSelectionInFrame();
    if (!ctx || ctx.sel.isCollapsed) {
      setStatus('Sélectionnez du texte dans le cadre', 'err');
      return;
    }
    const { range, el } = ctx;
    const span = document.createElement('span');
    Object.assign(span.style, styles);
    try {
      range.surroundContents(span);
    } catch (e) {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }
    ctx.sel.removeAllRanges();
    syncTextFrameHtml(el);
  }

  function getCurrentParagraph() {
    const el = getActiveTextFrameEl();
    const sel = window.getSelection();
    if (!el || !sel?.anchorNode) return null;
    let node = sel.anchorNode;
    if (node.nodeType === 3) node = node.parentElement;
    const p = node?.closest?.('p');
    return p && el.contains(p) ? p : null;
  }

  function applyParagraphAlign(align) {
    const el = getActiveTextFrameEl();
    const p = getCurrentParagraph();
    if (!el) return;
    if (p) {
      p.style.textAlign = align;
      syncTextFrameHtml(el);
      setStatus('Alignement appliqué à la ligne', 'ok');
      return;
    }
    setStatus('Placez le curseur dans un paragraphe', 'err');
  }

  function applyParagraphFontSize(sizePt) {
    const el = getActiveTextFrameEl();
    const p = getCurrentParagraph();
    if (!el || !p) {
      setStatus('Placez le curseur dans un paragraphe', 'err');
      return;
    }
    p.style.fontSize = `${sizePt}pt`;
    syncTextFrameHtml(el);
  }

  function blockInnerScroll(el) {
    if (el.dataset.adv2ScrollBlocked) return;
    el.dataset.adv2ScrollBlocked = '1';
    el.addEventListener('scroll', () => {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    });
  }

  function parentPointFromEvent(ev, nodeId) {
    const childEl = document.querySelector(`[data-child-node-id="${nodeId}"]`);
    const parentEl = childEl?.closest('.adv2-node');
    const node = getNode(nodeId);
    const parent = node?.parentId ? getNode(node.parentId) : null;
    const pw = parent?.layout?.width || 10;
    const ph = parent?.layout?.height || 10;
    if (!parentEl) return { xMm: 0, yMm: 0 };
    const rect = parentEl.getBoundingClientRect();
    return {
      xMm: ((ev.clientX - rect.left) / rect.width) * pw,
      yMm: ((ev.clientY - rect.top) / rect.height) * ph
    };
  }

  function startDragForNode(id, ev) {
    const node = getNode(id);
    const page = $('adv2-page');
    if (!node || !page || !canDragNode(node)) return false;

    if (node.type === 'text-frame') {
      const tf = document.querySelector(`[data-text-frame-id="${id}"]`);
      if (tf) tf.setAttribute('contenteditable', 'false');
    }

    if (!node.parentId) {
      const pt = pagePointFromEvent(ev, page);
      state.drag = {
        type: 'move',
        id,
        unit: 'mm',
        startX: pt.xMm,
        startY: pt.yMm,
        orig: { ...node.layout },
        wasTextEditing: node.type === 'text-frame' && state.textEditingId === id
      };
    } else {
      const pt = parentPointFromEvent(ev, id);
      state.drag = {
        type: 'move',
        id,
        unit: 'mm',
        startX: pt.xMm,
        startY: pt.yMm,
        orig: { ...node.layout },
        wasTextEditing: node.type === 'text-frame' && state.textEditingId === id
      };
    }
    if (node.type === 'text-frame' && state.textEditingId === id) {
      state.textEditingId = null;
    }
    return true;
  }

  function startResizeForNode(id, ev, dir) {
    const node = getNode(id);
    const page = $('adv2-page');
    if (!node || !page || !canDragNode(node)) return;

    if (node.type === 'text-frame') {
      const tf = document.querySelector(`[data-text-frame-id="${id}"]`);
      if (tf) tf.setAttribute('contenteditable', 'false');
    }

    const pt = node.parentId
      ? parentPointFromEvent(ev, id)
      : pagePointFromEvent(ev, page);
    const orig = { ...node.layout };

    state.drag = {
      type: 'resize',
      id,
      unit: 'mm',
      dir: dir || 'se',
      aspectRatio: (orig.width || 10) / (orig.height || 10),
      startX: pt.xMm,
      startY: pt.yMm,
      orig,
      wasTextEditing: node.type === 'text-frame' && state.textEditingId === id
    };
    if (node.type === 'text-frame' && state.textEditingId === id) {
      state.textEditingId = null;
    }
    if (!node.parentId && childrenOf(id).length && isZoneScaleChildren(node)) {
      state.drag.childScaleSnap = childrenOf(id).map((child) => ({
        id: child.id,
        layout: { ...(child.layout || {}) }
      }));
    }
  }

  function onCanvasMouseDown(ev) {
    const page = $('adv2-page');
    if (!page || !page.contains(ev.target)) return;

    if (isGuideEditMode()) {
      if (ev.target === page || ev.target.classList.contains('adv2-margin-box') || ev.target.id === 'adv2-snap-lines') {
        deselectGuide();
        return;
      }
      const guideEl = ev.target.closest?.('.adv2-guide-static');
      if (guideEl) {
        const axis = guideEl.dataset.guideAxis;
        const index = Number(guideEl.dataset.guideIndex);
        selectGuide(axis, index);
        startGuideDrag(axis, index, ev);
        ev.stopPropagation();
        ev.preventDefault();
      }
      return;
    }

    if (ev.target === page || ev.target.classList.contains('adv2-margin-box') || ev.target.id === 'adv2-snap-lines') {
      deselectNode();
      deselectGuide();
      return;
    }

    const guideEl = ev.target.closest?.('.adv2-guide-static');
    if (guideEl) return;

    if (ev.target.closest?.('.adv2-col-resize-handle, [data-col-resize]')) {
      return;
    }

    const resizeHandle = ev.target.closest?.('.adv2-resize-handle');
    if (resizeHandle) {
      const id = resizeHandle.dataset.resize;
      startResizeForNode(id, ev, resizeHandle.dataset.resizeDir);
      ev.stopPropagation();
      ev.preventDefault();
      return;
    }

    const textFrameEl = ev.target.closest('[data-text-frame-id]');
    const textFrameId = textFrameEl?.getAttribute('data-text-frame-id');
    if (textFrameId && state.selectedId === textFrameId) {
      if (state.textEditingId === textFrameId) {
        return;
      }
      state.pending = {
        chain: getClickNodeChain(ev),
        prevId: state.selectedId,
        startX: ev.clientX,
        startY: ev.clientY,
        ev,
        moved: false,
        textFrameClick: true
      };
      return;
    }

    const chain = getClickNodeChain(ev);
    if (!chain.length) return;

    state.pending = {
      chain,
      prevId: state.selectedId,
      startX: ev.clientX,
      startY: ev.clientY,
      ev,
      moved: false
    };
  }

  function onCanvasMouseUp(ev) {
    if (state.drag) {
      const wasGuide = state.drag.type === 'guide';
      const draggedTextFrame = getNode(state.drag.id)?.type === 'text-frame';
      const wasTextEditing = state.drag.wasTextEditing;
      state.drag = null;
      state.snapLines = [];
      renderSnapLines();
      state.pending = null;
      if (wasGuide) {
        renderSidePanel();
        return;
      }
      if (draggedTextFrame && wasTextEditing) {
        requestAnimationFrame(() => enterTextFrameEdit(state.selectedId));
      }
      return;
    }

    const pending = state.pending;
    state.pending = null;
    if (!pending || pending.moved) return;

    const nextId = resolveDrillDownSelection(
      pending.chain,
      pending.startX,
      pending.startY,
      pending.ev
    );
    if (nextId && nextId !== state.selectedId) {
      selectNode(nextId);
      return;
    }

    if (pending.textFrameClick && getNode(state.selectedId)?.type === 'text-frame') {
      const clickEv = pending.ev;
      requestAnimationFrame(() => enterTextFrameEdit(state.selectedId, clickEv?.clientX, clickEv?.clientY));
    }
  }

  function focusTextFrame(id, clientX, clientY) {
    enterTextFrameEdit(id, clientX, clientY);
  }

  function initCanvasInteraction() {
    const page = $('adv2-page');
    if (!page || page.dataset.adv2Bound) return;
    page.dataset.adv2Bound = '1';

    page.addEventListener('mousedown', onCanvasMouseDown);
    page.addEventListener('input', (ev) => {
      const tf = ev.target.closest?.('[data-text-frame-id]');
      if (tf) syncTextFrameHtml(tf);
    });
    page.addEventListener('focusin', (ev) => {
      const tf = ev.target.closest?.('[data-text-frame-id]');
      if (!tf) return;
      const id = tf.getAttribute('data-text-frame-id');
      if (state.selectedId !== id) return;
      state.textEditingId = id;
      if (state.sideTab !== 'props') {
        state.sideTab = 'props';
        renderSidePanel();
      }
    });
    page.addEventListener('focusout', (ev) => {
      const tf = ev.target.closest?.('[data-text-frame-id]');
      if (!tf) return;
      const id = tf.getAttribute('data-text-frame-id');
      requestAnimationFrame(() => {
        const focusedId = getFocusedTextFrameId();
        if (focusedId === id) return;
        if (state.selectedId !== id) return;
        state.textEditingId = null;
        tf.setAttribute('contenteditable', 'false');
        if (document.activeElement?.closest?.('.adv2-panel-side')) return;
        state.sideTab = 'dim';
        renderSidePanel();
        renderCanvas();
      });
    });

    $('adv2-ruler-h')?.addEventListener('mousedown', (ev) => {
      if (!isGuideEditMode()) return;
      const pageEl = $('adv2-page');
      const pw = state.template?.page?.widthMm || 210;
      const rect = pageEl.getBoundingClientRect();
      const xMm = ((ev.clientX - rect.left) / rect.width) * pw;
      addGuideAt('v', xMm);
      startGuideDrag('v', ensureGuides().vertical.length - 1, ev);
      ev.preventDefault();
    });
    $('adv2-ruler-v')?.addEventListener('mousedown', (ev) => {
      if (!isGuideEditMode()) return;
      const pageEl = $('adv2-page');
      const ph = state.template?.page?.heightMm || 297;
      const rect = pageEl.getBoundingClientRect();
      const yMm = ((ev.clientY - rect.top) / rect.height) * ph;
      addGuideAt('h', yMm);
      startGuideDrag('h', ensureGuides().horizontal.length - 1, ev);
      ev.preventDefault();
    });

    if (!document.body.dataset.adv2KeysBound) {
      document.body.dataset.adv2KeysBound = '1';
      document.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
        if (state.textEditingId || getFocusedTextFrameId()) return;
        if (!isGuideEditMode() || !state.selectedGuide) return;
        ev.preventDefault();
        deleteSelectedGuide();
      });
    }
  }

  function selectGuideRefZone(id) {
    if (!isGuideEditMode()) return;
    const zone = getHostZoneForActions(getNode(id));
    if (!zone) {
      setStatus('Choisissez une zone dans l’arbre (symétrie / référence)', 'err');
      return;
    }
    state.guideRefZoneId = zone.id;
    renderTree();
    renderSidePanel();
    renderCanvas();
    setStatus(`Zone de référence : ${nodeDisplayName(zone)}`, 'ok');
  }

  function selectNode(id) {
    if (isGuideEditMode()) {
      selectGuideRefZone(id);
      return;
    }
    blurActiveTextFrame();
    state.selectedGuide = null;
    const node = getNode(id);
    state.selectedId = id;
    if (node?.type === 'text-frame') {
      if (!['frame', 'line', 'selection'].includes(state.styleScope)) state.styleScope = 'frame';
      state.sideTab = 'dim';
    } else if (node?.type === 'image') {
      state.sideTab = 'props';
    } else {
      state.sideTab = 'dim';
    }
    renderTree();
    renderSidePanel();
    renderCanvas();
  }

  function deselectNode() {
    blurActiveTextFrame();
    state.selectedId = null;
    renderTree();
    renderSidePanel();
    renderCanvas();
  }

  function syncViewToggles() {
    updateGuideModeUi();
  }

  function setSideTab(tab) {
    state.sideTab = tab;
    renderSidePanel();
  }

  async function copyFieldKey(key, btn) {
    const token = `{{${key}}}`;
    try {
      await navigator.clipboard.writeText(token);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = token;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    if (btn) {
      btn.classList.add('is-copied');
      btn.textContent = 'Copié';
      setTimeout(() => {
        btn.classList.remove('is-copied');
        btn.textContent = 'Copier';
      }, 1200);
    }
    setStatus(`Copié : ${token}`, 'ok');
  }

  function renderFieldsPanel() {
    const cat = catalog();
    const groups = cat.FIELD_GROUPS || [];
    const catalogLabel = cat.label || cat.id || 'Champs';
    const header = `
      <div class="adv2-field-catalog-banner" style="margin:0 0 10px;padding:8px 10px;border-radius:8px;background:#eff6ff;border:1px solid #bfdbfe;font-size:0.8rem;color:#1e3a8a;">
        Catalogue : <strong>${escHtml(catalogLabel)}</strong>
        <br><span style="color:#64748b;">Template <code>${escHtml(state.namespace || '')}</code></span>
      </div>
    `;
    if (!groups.length) {
      return header + '<p class="text-muted">Aucun champ pour ce type de template.</p>';
    }
    const body = groups.map((group) => {
      const groupId = group.id || group.label;
      const expanded = isFieldGroupExpanded(groupId);
      const chevron = expanded ? '▼' : '▶';
      const rows = (group.fields || []).map((field) => `
        <div class="adv2-field-row">
          <span class="adv2-field-label" title="{{${escHtml(field.key)}}}">${escHtml(field.label)}</span>
          <button type="button" class="adv2-copy-btn" data-copy-field="${escHtml(field.key)}">Copier</button>
        </div>
      `).join('');
      return `
        <div class="adv2-field-group${expanded ? ' is-expanded' : ''}">
          <button type="button" class="adv2-field-group-head" data-field-group="${escHtml(groupId)}">
            <span class="adv2-tree-chevron" aria-hidden="true">${chevron}</span>
            <span class="adv2-field-group-title">${escHtml(group.label)}</span>
            <span class="adv2-field-group-count">${(group.fields || []).length}</span>
          </button>
          <div class="adv2-field-group-body">${rows}</div>
        </div>
      `;
    }).join('');
    return header + body;
  }

  function renderNodeStructurePanel(node) {
    const hostZone = getHostZoneForActions(node);
    const canAdd = hostZone && hostZone.zoneType !== 'lignes';
    const isTextFrame = node.type === 'text-frame';
    const deleteBtn = canDeleteNode(node)
      ? `<button type="button" class="adv2-copy-btn is-danger adv2-delete-node-btn" id="prop-delete-node">Supprimer</button>`
      : '';
    const addBlock = canAdd && !isTextFrame ? `
      <section class="adv2-node-actions">
        <h4 class="adv2-dim-section-title">Contenu de la zone</h4>
        <p class="text-muted" style="font-size:0.78rem;margin-bottom:8px;">Ajoutez des éléments dans <strong>${escHtml(nodeDisplayName(hostZone))}</strong>.</p>
        <div class="adv2-node-actions-row">
          <button type="button" class="adv2-copy-btn" id="prop-add-text">+ Texte</button>
          <button type="button" class="adv2-copy-btn" id="prop-add-image">+ Image</button>
        </div>
      </section>
    ` : '';
    const identification = isTextFrame ? '' : `
      <section class="adv2-node-label-panel">
        <h4 class="adv2-dim-section-title">Identification</h4>
        <label class="adv2-label-field">Nom affiché
          <input type="text" id="prop-label" value="${escHtml(node.label || '')}" placeholder="${escHtml(nodeDisplayName(node))}">
        </label>
        <p class="text-muted" style="font-size:0.75rem;margin-top:4px;">Identifiant technique : <code>${escHtml(node.id)}</code></p>
      </section>
    `;
    const textFrameActions = isTextFrame && deleteBtn
      ? `<div class="adv2-node-delete-row">${deleteBtn}</div>`
      : (!isTextFrame && deleteBtn ? `<div class="adv2-node-delete-row">${deleteBtn}</div>` : '');
    return `
      ${identification}
      ${addBlock}
      ${textFrameActions}
    `;
  }

  function renderImagePropsPanel(node) {
    const cfg = node.imageConfig || {};
    const currentVar = cfg.variable || '';
    const fit = cfg.fit || 'contain';
    const options = allCatalogFields().map((field) => `
      <option value="${escHtml(field.key)}"${field.key === currentVar ? ' selected' : ''}>${escHtml(field.label)} ({{${escHtml(field.key)}}})</option>
    `).join('');
    return `
      <p><strong>Image</strong> <span class="adv2-badge">sélectionnée</span><br><small>${node.id}</small></p>
      <div class="adv2-style-row">
        <label for="prop-image-var">Variable image</label>
        <select id="prop-image-var">
          <option value="">— Choisir —</option>
          ${options}
        </select>
      </div>
      <div class="adv2-style-row">
        <label for="prop-image-fit">Affichage</label>
        <select id="prop-image-fit">
          <option value="contain"${fit === 'contain' ? ' selected' : ''}>Contenir</option>
          <option value="cover"${fit === 'cover' ? ' selected' : ''}>Couvrir</option>
          <option value="fill"${fit === 'fill' ? ' selected' : ''}>Étirer</option>
        </select>
      </div>
      <p class="text-muted" style="font-size:0.8rem;">La variable doit pointer vers une URL d'image (ex. logo entreprise).</p>
    `;
  }

  function renderPropsPanel() {
    const node = getNode(state.selectedId);
    if (!node) {
      return `
        <p class="text-muted">Aucune zone sélectionnée.</p>
        <p class="text-muted" style="font-size:0.8rem;">Aperçu avec données exemple en permanence. Cliquez sur une zone de texte (2e clic) pour éditer les {{variables}}.</p>
      `;
    }

    if (node.type === 'image') {
      return renderImagePropsPanel(node);
    }

    if (node.type !== 'text-frame') {
      const childTf = childrenOf(node.id).find((c) => c.type === 'text-frame');
      const tableNode = getTableNodeForSelection(node);
      return `
        <p><strong>${node.type}</strong>${node.zoneType ? ` — ${ZONE_LABELS[node.zoneType] || node.zoneType}` : ''}</p>
        ${childTf ? `<p class="text-muted" style="font-size:0.8rem;">Style de texte : sélectionnez un <em>text-frame</em> (ex. <button type="button" class="adv2-link-btn" data-select-node="${childTf.id}">${childTf.id}</button>).</p>` : ''}
        ${node.collectionNamespace && !tableNode ? `<p><small>Collection : <code>${node.collectionNamespace}</code></small></p>` : ''}
        ${node.imageConfig?.variable ? `<p><small>Image : <code>{{${node.imageConfig.variable}}}</code></small></p>` : ''}
        ${renderTableColumnsEditor(tableNode)}
      `;
    }

    const s = ensureNodeStyle(node);
    const align = s.textAlign || 'left';
    const weight = s.fontWeight || 'normal';
    const scope = state.styleScope || 'frame';

    const scopeTabs = `
      <div class="adv2-scope-tabs">
        <button type="button" class="adv2-scope-tab${scope === 'frame' ? ' is-active' : ''}" data-style-scope="frame">Cadre entier</button>
        <button type="button" class="adv2-scope-tab${scope === 'line' ? ' is-active' : ''}" data-style-scope="line">Ligne</button>
        <button type="button" class="adv2-scope-tab${scope === 'selection' ? ' is-active' : ''}" data-style-scope="selection">Mot / sélection</button>
      </div>
    `;

    let scopeBody = '';
    if (scope === 'frame') {
      scopeBody = `
        <p class="adv2-scope-hint">S'applique à tout le contenu du cadre.</p>
        <div class="adv2-style-row">
          <label for="prop-font-size">Taille police (pt)</label>
          <input type="number" step="0.5" min="6" max="48" id="prop-font-size" value="${s.fontSize || 10}">
        </div>
        <div class="adv2-style-row">
          <span class="adv2-style-label">Alignement du cadre</span>
          <div class="adv2-align-group">
            <button type="button" class="adv2-align-btn${align === 'left' ? ' is-active' : ''}" data-frame-align="left">Gauche</button>
            <button type="button" class="adv2-align-btn${align === 'center' ? ' is-active' : ''}" data-frame-align="center">Centre</button>
            <button type="button" class="adv2-align-btn${align === 'right' ? ' is-active' : ''}" data-frame-align="right">Droite</button>
            <button type="button" class="adv2-align-btn${align === 'justify' ? ' is-active' : ''}" data-frame-align="justify">Justif.</button>
          </div>
        </div>
        <div class="adv2-style-row">
          <label for="prop-font-weight">Graisse</label>
          <select id="prop-font-weight">
            <option value="normal"${weight === 'normal' ? ' selected' : ''}>Normal</option>
            <option value="bold"${weight === 'bold' ? ' selected' : ''}>Gras</option>
          </select>
        </div>
        <div class="adv2-style-row">
          <label for="prop-color">Couleur</label>
          <input type="color" id="prop-color" value="${s.color || '#000000'}">
        </div>
      `;
    } else if (scope === 'line') {
      scopeBody = `
        <p class="adv2-scope-hint">Placez le curseur dans un paragraphe (ligne), puis appliquez le style à cette ligne seule.</p>
        <div class="adv2-style-row">
          <span class="adv2-style-label">Alignement de la ligne</span>
          <div class="adv2-align-group">
            <button type="button" class="adv2-align-btn" data-line-align="left">Gauche</button>
            <button type="button" class="adv2-align-btn" data-line-align="center">Centre</button>
            <button type="button" class="adv2-align-btn" data-line-align="right">Droite</button>
            <button type="button" class="adv2-align-btn" data-line-align="justify">Justif.</button>
          </div>
        </div>
        <div class="adv2-style-row">
          <label for="prop-line-size">Taille de la ligne (pt)</label>
          <div style="display:flex;gap:6px;">
            <input type="number" step="0.5" min="6" max="48" id="prop-line-size" value="${s.fontSize || 10}" style="flex:1;">
            <button type="button" class="adv2-copy-btn" id="prop-line-size-apply">Appliquer</button>
          </div>
        </div>
      `;
    } else {
      scopeBody = `
        <p class="adv2-scope-hint">Surlignez un ou plusieurs mots dans le cadre, puis :</p>
        <div class="adv2-inline-toolbar">
          <button type="button" class="adv2-inline-btn" data-inline-cmd="bold"><strong>G</strong></button>
          <button type="button" class="adv2-inline-btn" data-inline-cmd="italic"><em>I</em></button>
          <button type="button" class="adv2-inline-btn" data-inline-cmd="underline"><u>S</u></button>
        </div>
        <div class="adv2-style-row">
          <label for="prop-sel-size">Taille sur la sélection (pt)</label>
          <div style="display:flex;gap:6px;">
            <input type="number" step="0.5" min="6" max="48" id="prop-sel-size" value="10" style="flex:1;">
            <button type="button" class="adv2-copy-btn" id="prop-sel-size-apply">Appliquer</button>
          </div>
        </div>
        <div class="adv2-style-row">
          <label for="prop-sel-color">Couleur sur la sélection</label>
          <div style="display:flex;gap:6px;align-items:center;">
            <input type="color" id="prop-sel-color" value="#000000">
            <button type="button" class="adv2-copy-btn" id="prop-sel-color-apply">Appliquer</button>
          </div>
        </div>
      `;
    }

    return `
      ${scopeTabs}
      ${scopeBody}
      <p class="text-muted" style="font-size:0.8rem;margin-top:8px;">Glissez pour déplacer (onglet Dim.). Clic dans le texte pour éditer les {{variables}}.</p>
    `;
  }

  function renderDimPanel() {
    const node = getNode(state.selectedId);

    if (isGuideEditMode()) {
      return renderGuidesSection();
    }

    if (!node) {
      return `
        <p class="text-muted">Sélectionnez un bloc pour ajuster ses dimensions, ou cliquez <strong>+ Zone</strong> dans l'arbre.</p>
        ${renderPageMarginsSection()}
        ${renderEditorViewSection()}
        ${renderGuidesSection()}
      `;
    }
    const l = node.layout || {};
    const unit = 'mm';
    const isRoot = !node.parentId;
    const zoneWithChildren = isRoot && node.type === 'zone' && childrenOf(node.id).length > 0;
    const autoFit = zoneWithChildren && isZoneAutoFitChildren(node);
    const scaleChildren = zoneWithChildren && isZoneScaleChildren(node);
    const hint = isRoot
      ? 'Glissez pour déplacer. Poignées sur les bords et coins pour redimensionner (Ctrl = proportions).'
      : node.type === 'text-frame'
        ? 'Glissez ou poignées pour déplacer/redimensionner. Cliquez dans le texte pour éditer (onglet Propriétés).'
        : 'Position en mm depuis le bord gauche/haut de la zone. Glissez ou poignées pour ajuster.';
    const tableNode = getTableNodeForSelection(node);
    const zoneFitControls = zoneWithChildren ? `
      <div class="adv2-zone-fit-row">
        <label class="adv2-zone-fit-label" for="prop-auto-fit-children">
          <input type="checkbox" id="prop-auto-fit-children"${autoFit ? ' checked' : ''}>
          <span>Adapter la zone quand on modifie un enfant à l'intérieur</span>
        </label>
        <label class="adv2-zone-fit-label" for="prop-scale-children">
          <input type="checkbox" id="prop-scale-children"${scaleChildren ? ' checked' : ''}>
          <span>Garder les proportions des enfants quand la zone est redimensionnée</span>
        </label>
        <button type="button" class="adv2-copy-btn" id="prop-fit-children-now">Recadrer sur les enfants</button>
      </div>
    ` : '';
    return `
      ${node.type !== 'text-frame' ? `<p><strong>${escHtml(nodeDisplayName(node))}</strong> <small class="text-muted">(${node.type})</small></p>` : ''}
      ${renderNodeStructurePanel(node)}
      <h4 class="adv2-dim-section-title">Dimensions</h4>
      <p class="text-muted" style="font-size:0.8rem;margin-bottom:10px;">${hint}</p>
      <div class="adv2-dim-grid">
        <label>X (${unit})<input type="number" step="0.5" id="prop-x" value="${l.x ?? 0}"></label>
        <label>Y (${unit})<input type="number" step="0.5" id="prop-y" value="${l.y ?? 0}"></label>
        <label>Largeur (${unit})<input type="number" step="0.5" id="prop-w" value="${l.width ?? 10}"></label>
        <label>Hauteur (${unit})<input type="number" step="0.5" id="prop-h" value="${l.height ?? 10}"></label>
      </div>
      ${zoneFitControls}
      ${renderZoneStyleSection(node)}
      ${renderTableColumnsEditor(tableNode)}
      ${renderEditorViewSection()}
    `;
  }

  function bindNodeStructureEvents(rootEl) {
    const scope = rootEl || document;
    scope.querySelector('#prop-label')?.addEventListener('change', applyLabelFromForm);
    scope.querySelector('#prop-add-text')?.addEventListener('click', () => {
      const zone = getHostZoneForActions(getNode(state.selectedId));
      if (zone) addTextFrameToZone(zone.id);
    });
    scope.querySelector('#prop-add-image')?.addEventListener('click', () => {
      const zone = getHostZoneForActions(getNode(state.selectedId));
      if (zone) addImageToZone(zone.id);
    });
    scope.querySelector('#prop-delete-node')?.addEventListener('click', deleteSelectedNode);
    scope.querySelector('#prop-image-var')?.addEventListener('change', applyImageConfigFromForm);
    scope.querySelector('#prop-image-fit')?.addEventListener('change', applyImageConfigFromForm);
  }

  function applyLabelFromForm() {
    const node = getNode(state.selectedId);
    if (!node) return;
    const val = $('prop-label')?.value?.trim();
    if (val) node.label = val;
    else delete node.label;
    renderTree();
    renderSidePanel();
  }

  function applyImageConfigFromForm() {
    const node = getNode(state.selectedId);
    if (!node || node.type !== 'image') return;
    node.imageConfig = node.imageConfig || {};
    const variable = $('prop-image-var')?.value?.trim();
    if (variable) node.imageConfig.variable = variable;
    node.imageConfig.fit = $('prop-image-fit')?.value || 'contain';
    renderCanvas();
  }

  function renderSidePanel() {
    const tabs = document.querySelectorAll('.adv2-side-tab');
    tabs.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tab === state.sideTab);
      btn.disabled = false;
      btn.classList.remove('is-disabled');
    });

    const propsEl = $('adv2-props');
    const dimEl = $('adv2-dim');
    const fieldsEl = $('adv2-fields');

    if (propsEl) {
      propsEl.hidden = state.sideTab !== 'props';
      propsEl.innerHTML = renderPropsPanel();
      $('prop-font-size')?.addEventListener('change', applyTextStyleFromForm);
      $('prop-font-size')?.addEventListener('input', applyTextStyleFromForm);
      $('prop-font-weight')?.addEventListener('change', applyTextStyleFromForm);
      $('prop-color')?.addEventListener('input', applyTextStyleFromForm);

      propsEl.querySelectorAll('[data-style-scope]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.styleScope = btn.getAttribute('data-style-scope');
          renderSidePanel();
        });
      });
      propsEl.querySelectorAll('[data-frame-align]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const n = getNode(state.selectedId);
          if (!n || n.type !== 'text-frame') return;
          applyFrameTextAlign(n, btn.getAttribute('data-frame-align'));
          renderSidePanel();
          renderCanvas();
        });
      });
      propsEl.querySelectorAll('[data-line-align]').forEach((btn) => {
        btn.addEventListener('click', () => applyParagraphAlign(btn.getAttribute('data-line-align')));
      });
      $('prop-line-size-apply')?.addEventListener('click', () => {
        const size = Number($('prop-line-size')?.value);
        if (Number.isFinite(size)) applyParagraphFontSize(size);
      });
      propsEl.querySelectorAll('[data-inline-cmd]').forEach((btn) => {
        btn.addEventListener('click', () => applyInlineCommand(btn.getAttribute('data-inline-cmd')));
      });
      $('prop-sel-size-apply')?.addEventListener('click', () => {
        const size = Number($('prop-sel-size')?.value);
        if (Number.isFinite(size)) wrapSelectionStyle({ fontSize: `${size}pt` });
      });
      $('prop-sel-color-apply')?.addEventListener('click', () => {
        const color = $('prop-sel-color')?.value;
        if (color) wrapSelectionStyle({ color });
      });
      propsEl.querySelectorAll('[data-select-node]').forEach((btn) => {
        btn.addEventListener('click', () => selectNode(btn.getAttribute('data-select-node')));
      });
      bindTableColumnEvents(propsEl);
      bindNodeStructureEvents(propsEl);
    }

    if (dimEl) {
      dimEl.hidden = state.sideTab !== 'dim';
      dimEl.innerHTML = renderDimPanel();
      ['prop-x', 'prop-y', 'prop-w', 'prop-h'].forEach((id) => {
        $(id)?.addEventListener('change', applyDimFromForm);
      });
      $('prop-auto-fit-children')?.addEventListener('change', applyZoneAutoFitFromForm);
      $('prop-scale-children')?.addEventListener('change', applyZoneScaleChildrenFromForm);
      $('prop-fit-children-now')?.addEventListener('click', applyFitChildrenNow);
      bindTableColumnEvents(dimEl);
      bindNodeStructureEvents(dimEl);
      bindZoneStyleEvents(dimEl);
      bindGuidesPanelEvents(dimEl);
      bindEditorViewEvents(dimEl);
    }

    if (fieldsEl) {
      fieldsEl.hidden = state.sideTab !== 'fields';
      fieldsEl.innerHTML = renderFieldsPanel();
      fieldsEl.querySelectorAll('[data-field-group]').forEach((btn) => {
        btn.addEventListener('click', () => toggleFieldGroup(btn.getAttribute('data-field-group')));
      });
      fieldsEl.querySelectorAll('[data-copy-field]').forEach((btn) => {
        btn.addEventListener('click', () => copyFieldKey(btn.getAttribute('data-copy-field'), btn));
      });
    }
  }

  function applyTextStyleFromForm() {
    const node = getNode(state.selectedId);
    if (!node || node.type !== 'text-frame') return;
    const s = ensureNodeStyle(node);
    const size = Number($('prop-font-size')?.value);
    if (Number.isFinite(size) && size > 0) s.fontSize = size;
    s.fontWeight = $('prop-font-weight')?.value || 'normal';
    const color = $('prop-color')?.value;
    if (color) s.color = color;
    renderCanvas();
  }

  function applyDimFromForm() {
    const node = getNode(state.selectedId);
    if (!node) return;
    const prevLayout = { ...(node.layout || { unit: 'mm' }) };
    const nextLayout = {
      ...prevLayout,
      x: Number($('prop-x')?.value) || 0,
      y: Number($('prop-y')?.value) || 0,
      width: Number($('prop-w')?.value) || 10,
      height: Number($('prop-h')?.value) || 10,
      unit: 'mm'
    };
    if (node.parentId) {
      finalizeChildLayout(node, nextLayout);
    } else {
      const childSnap = isZoneScaleChildren(node) && childrenOf(node.id).length
        ? childrenOf(node.id).map((child) => ({
          id: child.id,
          layout: { ...(child.layout || {}) }
        }))
        : null;
      const mins = layoutMinSizeForNode(node, {
        parentOrig: prevLayout,
        childrenSnap: childSnap
      });
      const newLayout = {
        ...nextLayout,
        width: Math.max(mins.w, nextLayout.width),
        height: Math.max(mins.h, nextLayout.height)
      };
      if (childSnap?.length) {
        scaleChildrenWithParent(node.id, prevLayout, newLayout, childSnap);
      }
      node.layout = newLayout;
    }
    renderCanvas();
  }

  function pagePointFromEvent(ev, pageEl) {
    const rect = pageEl.getBoundingClientRect();
    const xRatio = (ev.clientX - rect.left) / rect.width;
    const yRatio = (ev.clientY - rect.top) / rect.height;
    return {
      xMm: xRatio * (state.template.page?.widthMm || 210),
      yMm: yRatio * (state.template.page?.heightMm || 297)
    };
  }

  function onMouseMove(ev) {
    const page = $('adv2-page');

    if (state.pending && !state.drag && !isGuideEditMode()) {
      const dx = ev.clientX - state.pending.startX;
      const dy = ev.clientY - state.pending.startY;
      if (!state.pending.textFrameClick && Math.hypot(dx, dy) > 4 && isDraggableSelection(state.pending.prevId)) {
        if (startDragForNode(state.pending.prevId, ev)) {
          state.pending.moved = true;
        }
      }
    }

    if (!state.drag) return;

    if (state.drag.type === 'guide') {
      const pt = mmFromPageEvent(ev);
      const guides = ensureGuides();
      const axis = state.drag.axis === 'v' ? 'v' : 'h';
      const raw = axis === 'v' ? pt.xMm : pt.yMm;
      const snapped = snapGuidePosition(axis, raw, state.drag.index, ev.altKey);
      if (axis === 'v') {
        guides.vertical[state.drag.index] = snapped.mm;
      } else {
        guides.horizontal[state.drag.index] = snapped.mm;
      }
      state.snapLines = snapped.lines;
      renderCanvas();
      const abs = state.drag.axis === 'v'
        ? guides.vertical[state.drag.index]
        : guides.horizontal[state.drag.index];
      const origin = getGuideOrigin(state.drag.axis, state.drag.index);
      const display = absoluteToDisplay(state.drag.axis, abs, origin);
      document.querySelectorAll('.adv2-guide-pos').forEach((input) => {
        const key = input.getAttribute('data-guide-pos');
        const [axis, index] = key.split(':');
        const list = axis === 'v' ? guides.vertical : guides.horizontal;
        const idx = Number(index);
        if (list[idx] == null) return;
        const rowOrigin = getGuideOrigin(axis, idx);
        input.value = absoluteToDisplay(axis, list[idx], rowOrigin);
      });
      return;
    }

    const node = getNode(state.drag.id);
    if (!page || !node) return;

    const unit = 'mm';
    const pt = node.parentId
      ? parentPointFromEvent(ev, state.drag.id)
      : pagePointFromEvent(ev, page);
    const dx = pt.xMm - state.drag.startX;
    const dy = pt.yMm - state.drag.startY;

    const layout = { ...state.drag.orig, unit };

    if (state.drag.type === 'move') {
      layout.x = Math.max(0, (state.drag.orig.x || 0) + dx);
      layout.y = Math.max(0, (state.drag.orig.y || 0) + dy);
      if (!ev.altKey && global.Adv2Snap) {
        const snapPage = {
          ...state.template.page,
          snap: state.template.snap,
          margins: state.template.page.margins,
          widthMm: state.template.page?.widthMm || 210,
          heightMm: state.template.page?.heightMm || 297
        };
        const rect = {
          x: layout.x,
          y: layout.y,
          w: layout.width || 10,
          h: layout.height || 10
        };
        if (!node.parentId) {
          const snapped = global.Adv2Snap.applySnapRect(
            rect,
            snapPage,
            state.template.nodes,
            state.template.guides,
            node.id
          );
          layout.x = snapped.rect.x;
          layout.y = snapped.rect.y;
          state.snapLines = snapped.lines || [];
        } else {
          const parent = getNode(node.parentId);
          const nodeMap = new Map((state.template.nodes || []).map((n) => [n.id, n]));
          const parentPageRect = global.Adv2Snap.nodePageRect(parent, nodeMap);
          const siblings = childrenOf(node.parentId);
          const snapped = global.Adv2Snap.applySnapRectLocal(
            rect,
            parentPageRect,
            siblings,
            state.template.guides,
            snapPage,
            node.id
          );
          layout.x = snapped.rect.x;
          layout.y = snapped.rect.y;
          state.snapLines = snapped.lines || [];
        }
      } else {
        state.snapLines = [];
      }
      if (node.parentId) {
        const parent = getNode(node.parentId);
        const autoFit = parent && isZoneAutoFitChildren(parent);
        Object.assign(layout, clampChildLayout(layout, parent?.layout, autoFit));
      }
    } else {
      const minSize = layoutMinSizeForNode(node, {
        parentOrig: state.drag.orig,
        childrenSnap: state.drag.childScaleSnap
      });
      const resized = applyResizeLayout(
        state.drag.orig,
        state.drag.dir || 'se',
        dx,
        dy,
        unit,
        ev.ctrlKey,
        minSize
      );
      layout.x = resized.x;
      layout.y = resized.y;
      layout.width = resized.width;
      layout.height = resized.height;
      if (!ev.altKey && !ev.ctrlKey && global.Adv2Snap) {
        const snapPage = {
          ...state.template.page,
          snap: state.template.snap,
          margins: state.template.page.margins,
          widthMm: state.template.page?.widthMm || 210,
          heightMm: state.template.page?.heightMm || 297
        };
        const rect = {
          x: layout.x,
          y: layout.y,
          w: layout.width || 10,
          h: layout.height || 10
        };
        const resizeDir = state.drag.dir || 'se';
        let snapped;
        if (!node.parentId) {
          snapped = global.Adv2Snap.applySnapResizeRect(
            rect,
            resizeDir,
            snapPage,
            state.template.nodes,
            state.template.guides,
            node.id,
            minSize
          );
        } else {
          const parent = getNode(node.parentId);
          const nodeMap = new Map((state.template.nodes || []).map((n) => [n.id, n]));
          const parentPageRect = global.Adv2Snap.nodePageRect(parent, nodeMap);
          const siblings = childrenOf(node.parentId);
          snapped = global.Adv2Snap.applySnapResizeRectLocal(
            rect,
            resizeDir,
            parentPageRect,
            siblings,
            state.template.guides,
            snapPage,
            node.id,
            minSize
          );
        }
        layout.x = snapped.rect.x;
        layout.y = snapped.rect.y;
        layout.width = snapped.rect.w;
        layout.height = snapped.rect.h;
        state.snapLines = snapped.lines || [];
      } else {
        state.snapLines = [];
      }
      if (node.parentId) {
        const parent = getNode(node.parentId);
        const autoFit = parent && isZoneAutoFitChildren(parent);
        Object.assign(layout, clampChildLayout(layout, parent?.layout, autoFit));
      }
    }

    node.layout = layout;
    if (node.parentId) {
      const parent = getNode(node.parentId);
      if (parent && isZoneAutoFitChildren(parent)) fitParentToChildren(parent.id);
    } else if (state.drag.type === 'resize' && state.drag.childScaleSnap?.length) {
      scaleChildrenWithParent(node.id, state.drag.orig, layout, state.drag.childScaleSnap);
    }
    renderCanvas();
    renderSidePanel();
  }

  function onMouseUp(ev) {
    onCanvasMouseUp(ev || { clientX: 0, clientY: 0 });
  }

  async function loadTemplate(ns) {
    state.namespace = ns || DEFAULT_NS;
    setStatus('Chargement…');
    const res = await global.Adv2Api.getTemplate(state.namespace);
    state.template = res.data;
    (state.template?.nodes || []).forEach((node) => {
      if (node.type === 'table') ensureTableConfig(node);
    });
    // Migrations devis UGAP uniquement — pas sur les templates revue mail / agent
    let addedTotal = false;
    let upgradedTotal = false;
    let fixedAlign = false;
    if (isUgapDevisTemplate()) {
      addedTotal = ensureTotalDevisZone();
      upgradedTotal = upgradeTotalDevisTextFrame();
      fixedAlign = fixTextFrameAlignmentsInTemplate();
    }
    normalizeChildLayouts();
    state.selectedId = null;
    state.selectedGuide = null;
    state.guideEditMode = false;
    state.fieldsExpanded = new Set();
    state.fieldsCollapsed = new Set();
    renderTree();
    renderSidePanel();
    renderCanvas();
    const catalogLabel = catalog().label || catalog().id || '';
    setStatus(
      addedTotal
        ? `Template ${state.namespace} chargé — zone Total devis ajoutée (enregistrez)`
        : upgradedTotal || fixedAlign
          ? `Template ${state.namespace} chargé — totaux mis à jour (enregistrez)`
          : `Template ${state.namespace} chargé (${catalogLabel})`,
      'ok'
    );
  }

  async function saveTemplate() {
    setStatus('Enregistrement…');
    (state.template?.nodes || []).forEach((node) => {
      if (node.type === 'table') {
        ensureTableConfig(node);
      }
      if (node.type === 'text-frame' && node.content?.html) {
        node.content.html = node.content.html
          .replace(/<span class="adv2-var-tag">(\{\{[^}]+\}\})<\/span>/g, '$1');
      }
    });
    await global.Adv2Api.saveTemplate(state.namespace, state.template);
    setStatus('Modèle enregistré', 'ok');
  }

  async function previewTemplate() {
    blurActiveTextFrame();
    const placeholders = { ...(catalog().PLACEHOLDER_DATA || {}) };
    placeholders['ugap:lignes.rows'] = catalog().SAMPLE_TABLE_LINES || [];
    const res = await global.Adv2Api.previewHtml(state.namespace, {
      variables: placeholders,
      template: state.template
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText.slice(0, 200) || `HTTP ${res.status}`);
    }
    const html = await res.text();
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  function addGuide(axis) {
    if (!isGuideEditMode()) {
      toggleGuideEditMode();
    }
    const pw = state.template.page?.widthMm || 210;
    const ph = state.template.page?.heightMm || 297;
    addGuideAt(axis, axis === 'v' ? pw / 2 : ph / 2);
  }

  function bindCanvasViewport() {
    const wrap = document.querySelector('.adv2-canvas-wrap');
    if (!wrap || wrap.dataset.adv2WheelBound) return;
    wrap.dataset.adv2WheelBound = '1';
    wrap.addEventListener('wheel', (ev) => {
      if (ev.ctrlKey) {
        ev.preventDefault();
        const step = ev.deltaY > 0 ? -0.05 : 0.05;
        state.zoom = Math.round(Math.max(0.5, Math.min(1.5, state.zoom + step)) * 100) / 100;
        renderCanvas();
        return;
      }
      if (ev.target.closest?.('.adv2-table-preview')) {
        wrap.scrollTop += ev.deltaY;
        wrap.scrollLeft += ev.deltaX;
        ev.preventDefault();
      }
    }, { passive: false });
  }

  async function generateTemplateWithAi() {
    if (catalog().id !== 'agent-review') {
      alert('La génération IA est disponible pour les templates de revue mail (agent:review:…).');
      return;
    }
    const brief = window.prompt(
      'Décrivez la page de revue à générer :',
      'Page claire de validation facture : en-tête, expéditeur/sujet, corps du mail, liste des PDF à télécharger.'
    );
    if (brief === null) return;
    if (!window.confirm('Remplacer la mise en page actuelle par une génération IA ?')) return;
    setStatus('Génération IA en cours…');
    const res = await global.Adv2Api.generateAi(state.namespace, {
      brief: String(brief || '').trim(),
      save: true
    });
    state.template = res.data;
    state.selectedId = null;
    state.selectedGuide = null;
    state.fieldsExpanded = new Set();
    state.fieldsCollapsed = new Set();
    renderTree();
    renderSidePanel();
    renderCanvas();
    const src = res.source === 'ia' ? 'IA' : 'secours';
    setStatus((res.message || 'Page générée') + ` (${src})`, res.source === 'ia' ? 'ok' : 'err');
  }

  function bindToolbar() {
    $('adv2-save')?.addEventListener('click', () => saveTemplate().catch((e) => setStatus(e.message, 'err')));
    $('adv2-preview')?.addEventListener('click', () => previewTemplate().catch((e) => setStatus(e.message, 'err')));
    $('adv2-reload')?.addEventListener('click', () => loadTemplate(state.namespace).catch((e) => setStatus(e.message, 'err')));
    $('adv2-generate-ai')?.addEventListener('click', () => generateTemplateWithAi().catch((e) => setStatus(e.message, 'err')));
    $('adv2-edit-guides')?.addEventListener('click', toggleGuideEditMode);
    $('adv2-toggle-guides')?.addEventListener('click', toggleGuidesVisibility);
    $('adv2-guide-v')?.addEventListener('click', () => addGuide('v'));
    $('adv2-guide-h')?.addEventListener('click', () => addGuide('h'));
    $('adv2-add-zone')?.addEventListener('click', addZone);
    syncViewToggles();
    document.querySelectorAll('.adv2-side-tab').forEach((btn) => {
      btn.addEventListener('click', () => setSideTab(btn.dataset.tab));
    });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  async function boot() {
    const params = new URLSearchParams(window.location.search);
    const ns = params.get('template') || DEFAULT_NS;
    bindToolbar();
    bindCanvasViewport();
    initCanvasInteraction();
    try {
      await loadTemplate(ns);
    } catch (e) {
      setStatus(e.message || 'Erreur chargement', 'err');
    }
  }

  global.Adv2CanvasEditor = { boot, loadTemplate, saveTemplate };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}(window));
