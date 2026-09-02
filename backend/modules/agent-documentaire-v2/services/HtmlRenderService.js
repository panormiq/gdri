/**

 * FICHIER : backend/modules/agent-documentaire-v2/services/HtmlRenderService.js

 * RÔLE : Rendu HTML statique depuis un template canvas (aperçu / base PDF).

 */



const {

  normalizeColumnWidths,

  buildColgroupHtml,

  paginateLines,

  findLignesLayout,

  tableHeightForRows,

  tableHeightForBodyMm,

  computeRowHeightsMm,

  zoneHeightForRows,

  clampZoneHeightForRows,

  maxLignesZoneHeightMm,
  ROW_HEIGHT_MM,
  HEADER_ROW_HEIGHT_MM,
  LIGNES_TO_FOOTER_GAP_MM,
  CLOSING_FOOTER_ZONE_TYPES,
  RUNNING_FOOTER_ZONE_TYPES,
  HEADER_ZONE_TYPES
} = require('../lib/devis-table-utils');



const FOOTER_ZONE_TYPES = new Set([...CLOSING_FOOTER_ZONE_TYPES, ...RUNNING_FOOTER_ZONE_TYPES]);



function escapeHtml(value) {

  return String(value ?? '')

    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;');

}



function stripInlineTextAlignFromHtml(html) {

  return String(html || '').replace(

    /(<[a-z][a-z0-9]*\b[^>]*\sstyle=")([^"]*)(")/gi,

    (match, start, styleContent, end) => {

      const cleaned = styleContent

        .replace(/\btext-align\s*:\s*(left|right|center|justify)\s*;?/gi, '')

        .replace(/;\s*;+/g, ';')

        .replace(/^\s*;|;\s*$/g, '')

        .trim();

      if (!cleaned) return match.replace(/\sstyle="[^"]*"/i, '');

      return `${start}${cleaned}${end}`;

    }

  );

}



function styleToCss(style) {

  const s = style && typeof style === 'object' ? style : {};

  const parts = [];

  if (s.fontSize) parts.push(`font-size:${Number(s.fontSize)}pt`);

  if (s.fontWeight) parts.push(`font-weight:${s.fontWeight}`);

  if (s.textAlign) parts.push(`text-align:${s.textAlign}`);

  if (s.color) parts.push(`color:${s.color}`);

  if (s.backgroundColor) parts.push(`background-color:${s.backgroundColor}`);

  if (s.border) parts.push(`border:${s.border}`);

  if (s.borderRadius) parts.push(`border-radius:${s.borderRadius}`);

  if (s.padding) parts.push(`padding:${s.padding}`);

  return parts.join(';');

}



function layoutToCss(layout, parentMm) {

  const l = layout && typeof layout === 'object' ? layout : {};

  const unit = l.unit === '%' && parentMm ? '%' : 'mm';

  const x = l.x ?? 0;

  const y = l.y ?? 0;

  const w = l.width ?? 20;

  const h = l.height ?? 10;

  return [

    'position:absolute',

    `left:${x}${unit}`,

    `top:${y}${unit}`,

    `width:${w}${unit}`,

    `height:${h}${unit}`,

    'box-sizing:border-box'

  ].join(';');

}



function normalizeVariableHtml(html) {

  return String(html || '')

    .replace(/<span class="adv2-var-tag">(\{\{[^}]+\}\})<\/span>/gi, '$1')

    .replace(/&#123;&#123;/g, '{{')

    .replace(/&#125;&#125;/g, '}}');

}



function replaceVariables(html, variables) {

  const source = normalizeVariableHtml(html);

  if (!source) return '';

  return source.replace(/\{\{([^}]+)\}\}/g, (match, key) => {

    const k = String(key || '').trim();

    if (variables && Object.prototype.hasOwnProperty.call(variables, k)) {

      const value = variables[k];

      // HTML déjà préparé (stats, sections, PJ…)
      if (/_html$/.test(k) || k === 'confiance_pct') return String(value ?? '');
      if (k === 'ugap:lignes.table') return String(value ?? '');

      return escapeHtml(value);

    }

    return match;

  });

}



function findDevisTableNode(nodes) {

  const list = Array.isArray(nodes) ? nodes : [];

  return list.find(

    (n) => n.type === 'table' && n.tableConfig?.collectionNamespace === 'ugap:ligne-devis'

  ) || list.find((n) => n.type === 'table' && n.tableConfig) || null;

}



function tableFieldLabels() {

  return {

    refUgap: 'Réf. UGAP',

    refFournisseur: 'Réf. fournisseur',

    libelle: 'Libellé UGAP',

    libelleApp: 'Libellé',

    categorie: 'Catégorie',

    prix: 'Prix UGAP HT',

    prixPublic: 'Prix public HT'

  };

}

function isDevisPriceColumnKey(key) {
  return key === 'prix' || key === 'prixPublic';
}



function renderTableHtmlFromLines(lines, tableConfig) {

  const cfg = tableConfig && typeof tableConfig === 'object' ? tableConfig : {};

  const fieldOrder = Array.isArray(cfg.fieldOrder) && cfg.fieldOrder.length

    ? cfg.fieldOrder

    : (Array.isArray(cfg.visibleFields) && cfg.visibleFields.length ? cfg.visibleFields : ['refUgap', 'libelle', 'prix']);

  const labels = tableFieldLabels();

  const colgroup = buildColgroupHtml(fieldOrder, normalizeColumnWidths(fieldOrder, cfg.columnWidths));

  const rows = Array.isArray(lines) ? lines : [];



  let html = '<table class="ugap-devis-lines" style="width:100%;border-collapse:collapse;margin:0;font-size:9pt;table-layout:fixed;">';

  html += colgroup;

  html += '<thead><tr>';

  fieldOrder.forEach((key) => {

    html += `<th style="border:1px solid #ccc;padding:6px 8px;background:#f3f4f6;text-align:left;">${escapeHtml(labels[key] || key)}</th>`;

  });

  html += '</tr></thead><tbody>';



  if (!rows.length) {

    html += `<tr><td colspan="${fieldOrder.length}" style="border:1px solid #ccc;padding:8px;color:#666;">Aucune ligne</td></tr>`;

  } else {

    rows.forEach((line) => {

      html += '<tr>';

      fieldOrder.forEach((key) => {

        const raw = line?.[key];

        const display = isDevisPriceColumnKey(key)
          && raw != null && raw !== ''
          && !String(raw).includes('€')
          ? `${raw} €`
          : (raw ?? '');

        html += `<td style="border:1px solid #ccc;padding:6px 8px;vertical-align:top;">${escapeHtml(display)}</td>`;

      });

      html += '</tr>';

    });

  }

  html += '</tbody></table>';

  return html;

}



function renderTablePlaceholder(tableConfig) {

  return renderTableHtmlFromLines([], tableConfig);

}



function renderTableNode(node, variables) {

  const ns = String(node.tableConfig?.collectionNamespace || '').trim();

  const tableHtml = variables['ugap:lignes.table'];

  if (ns.includes('ligne-devis') && tableHtml) {

    return String(tableHtml);

  }

  return renderTablePlaceholder(node.tableConfig);

}



function shouldIncludeNode(node, pageContext) {

  if (!node || node.visible === false) return false;

  const { isFirst, isLast, isMultiPage } = pageContext;

  if (node.type !== 'zone') return true;

  const zt = node.zoneType;

  if (zt === 'lignes') return true;

  if (!isMultiPage) return true;

  if (HEADER_ZONE_TYPES.has(zt)) return true;

  if (RUNNING_FOOTER_ZONE_TYPES.has(zt)) return true;

  if (CLOSING_FOOTER_ZONE_TYPES.has(zt)) return isLast;

  return isFirst;

}



function isLignesDevisTableNode(node) {
  const ns = String(node?.tableConfig?.collectionNamespace || '').trim();
  return ns.includes('ligne-devis');
}

function layoutAnchoredFromPageBottom(node, page) {
  const ph = Number(page?.heightMm) || 297;
  const layout = node.layout || {};
  const h = Number(layout.height) || 10;
  const templateY = Number(layout.y);
  if (!Number.isFinite(templateY)) return { ...layout, unit: 'mm' };
  const bottomInset = Math.max(0, ph - templateY - h);
  return {
    ...layout,
    y: Math.round((ph - bottomInset - h) * 10) / 10,
    unit: 'mm'
  };
}

function layoutOverridesForLignesZone(node, pageContext, template) {
  const { isFirst, isMultiPage, lineCount, linesBodyHeightMm } = pageContext;
  const lignesInfo = findLignesLayout(template);
  const rows = Math.max(0, Number(lineCount) || 0);
  const bodyMm = Number(linesBodyHeightMm);
  const maxZoneH = maxLignesZoneHeightMm(template, template.page || {}, pageContext);
  const zoneHeightForBody = (Number(lignesInfo.tableYInZone) || 1.8)
    + tableHeightForBodyMm(bodyMm) + 1;
  const dynamicHeight = rows > 0
    ? (Number.isFinite(bodyMm) && bodyMm > 0
      ? Math.min(zoneHeightForBody, maxZoneH)
      : clampZoneHeightForRows(rows, lignesInfo.tableYInZone, maxZoneH))
    : Math.min(Number(node.layout?.height) || 90, maxZoneH);

  if (!isMultiPage || isFirst) {
    return {
      ...(node.layout || {}),
      height: dynamicHeight,
      unit: 'mm'
    };
  }

  return {
    ...(node.layout || {}),
    x: node.layout?.x ?? 15,
    y: lignesInfo.zoneY ?? 64,
    width: node.layout?.width ?? 180,
    height: dynamicHeight,
    unit: 'mm'
  };
}

function layoutOverridesForClosingZone(node, pageContext, template) {
  if (!pageContext.isLast || node.type !== 'zone' || !CLOSING_FOOTER_ZONE_TYPES.has(node.zoneType)) {
    return node.layout || {};
  }

  const nodes = Array.isArray(template.nodes) ? template.nodes : [];
  const lignesZone = nodes.find((n) => n.zoneType === 'lignes');
  if (!lignesZone) return node.layout || {};

  const lignesLayout = layoutOverridesForLignesZone(lignesZone, pageContext, template);
  const lignesBottomY = (Number(lignesLayout.y) || 0) + (Number(lignesLayout.height) || 0);
  const baseY = lignesBottomY + LIGNES_TO_FOOTER_GAP_MM;

  const closingZones = nodes
    .filter((n) => n.type === 'zone' && CLOSING_FOOTER_ZONE_TYPES.has(n.zoneType))
    .sort((a, b) => (Number(a.layout?.y) || 0) - (Number(b.layout?.y) || 0));
  const firstTemplateY = Number(closingZones[0]?.layout?.y) || baseY;
  const nodeTemplateY = Number(node.layout?.y) || firstTemplateY;
  const deltaFromFirst = nodeTemplateY - firstTemplateY;

  return {
    ...(node.layout || {}),
    y: Math.round((baseY + deltaFromFirst) * 10) / 10,
    unit: 'mm'
  };
}

function layoutOverridesForPage(node, pageContext, template) {

  const page = template.page || {};

  if (node.type === 'zone' && node.zoneType === 'pied-de-page') {
    return layoutAnchoredFromPageBottom(node, page);
  }

  if (node.type === 'zone' && CLOSING_FOOTER_ZONE_TYPES.has(node.zoneType)) {
    return layoutOverridesForClosingZone(node, pageContext, template);
  }

  if (node.type === 'zone' && node.zoneType === 'lignes') {
    return layoutOverridesForLignesZone(node, pageContext, template);
  }

  return node.layout || {};
}



class HtmlRenderService {

  static buildNodeMap(nodes) {

    const map = new Map();

    (Array.isArray(nodes) ? nodes : []).forEach((n) => map.set(n.id, n));

    return map;

  }



  static computeFooterBlockHeight(nodes) {

    const list = Array.isArray(nodes) ? nodes : [];

    const zones = list.filter((n) => n.type === 'zone' && FOOTER_ZONE_TYPES.has(n.zoneType));

    if (!zones.length) return 0;

    let minY = Infinity;

    let maxBottom = 0;

    zones.forEach((z) => {

      const y = Number(z.layout?.y) || 0;

      const h = Number(z.layout?.height) || 0;

      minY = Math.min(minY, y);

      maxBottom = Math.max(maxBottom, y + h);

    });

    return maxBottom - minY + 4;

  }



  static renderNode(node, nodeMap, variables, parentType, pageContext, template) {

    if (!shouldIncludeNode(node, pageContext)) return '';



    const type = node.type;

    const style = styleToCss(node.style);

    const effectiveLayout = layoutOverridesForPage(node, pageContext, template);

    const layoutCss = layoutToCss(effectiveLayout, parentType !== 'page');



    if (type === 'text-frame') {

      const rawHtml = stripInlineTextAlignFromHtml(node.content?.html || '');

      const html = replaceVariables(rawHtml, variables);

      return `<div class="adv2-text-frame" style="${layoutCss};${style};overflow:hidden;padding:2mm;">${html}</div>`;

    }



    if (type === 'table') {

      const inner = renderTableNode(node, variables);

      const lignesTable = isLignesDevisTableNode(node);
      const rows = Math.max(0, Number(pageContext.lineCount) || 0);
      const lignesInfo = findLignesLayout(template);
      const parentZone = node.parentId ? nodeMap.get(node.parentId) : null;
      const parentLayout = parentZone
        ? layoutOverridesForPage(parentZone, pageContext, template)
        : effectiveLayout;

      let tableLayout = { ...(node.layout || {}) };
      if (lignesTable && rows > 0) {
        const maxZoneH = maxLignesZoneHeightMm(template, template.page || {}, pageContext);
        const bodyMm = Number(pageContext.linesBodyHeightMm);
        const idealTableH = Number.isFinite(bodyMm) && bodyMm > 0
          ? tableHeightForBodyMm(bodyMm)
          : tableHeightForRows(rows);
        const tableH = Math.min(
          idealTableH,
          Math.max(10, maxZoneH - (tableLayout.y ?? lignesInfo.tableYInZone) - 1)
        );
        tableLayout = {
          ...tableLayout,
          x: tableLayout.x ?? 3.6,
          y: tableLayout.y ?? lignesInfo.tableYInZone,
          width: tableLayout.width ?? 172.8,
          height: tableH,
          unit: 'mm'
        };
      }

      const tableCss = layoutToCss(tableLayout, parentType !== 'page');
      const overflowStyle = lignesTable ? 'overflow:hidden' : 'overflow:hidden';

      return `<div class="adv2-table${lignesTable ? ' adv2-table--lignes' : ''}" style="${tableCss};${style};${overflowStyle}">${inner}</div>`;

    }



    if (type === 'image') {

      const varKey = node.imageConfig?.variable || node.srcVariable || '';

      const src = varKey && variables[varKey] ? String(variables[varKey]).trim() : '';

      const fit = node.imageConfig?.fit || 'contain';

      if (!src) return '';

      return `<img class="adv2-image" alt="" src="${escapeHtml(src)}" style="${layoutCss};${style};object-fit:${fit};">`;

    }



    const isZone = type === 'zone' || type === 'group';

    const childIds = Array.isArray(node.children) ? [...node.children] : [];

    childIds.sort((a, b) => {

      const za = nodeMap.get(a)?.zIndex ?? 0;

      const zb = nodeMap.get(b)?.zIndex ?? 0;

      return za - zb;

    });

    let inner = '';

    childIds.forEach((childId) => {

      const child = nodeMap.get(childId);

      if (child) {

        inner += HtmlRenderService.renderNode(child, nodeMap, variables, type, pageContext, template);

      }

    });



    if (isZone) {

      const zoneOverflow = node.zoneType === 'lignes' ? 'overflow:hidden;' : '';

      return `<div class="adv2-node adv2-${type}" data-id="${escapeHtml(node.id)}" style="${layoutCss};${style};position:absolute;${zoneOverflow}">${inner || ''}</div>`;

    }



    return `<div style="${layoutCss};${style}">${inner}</div>`;

  }



  static renderPageBody(template, variables, pageContext) {

    const nodeMap = HtmlRenderService.buildNodeMap(template.nodes);

    const roots = (template.nodes || []).filter((n) => !n.parentId);

    roots.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    let body = '';

    roots.forEach((node) => {

      body += HtmlRenderService.renderNode(node, nodeMap, variables, 'page', pageContext, template);

    });

    return body;

  }



  static renderTemplate(template, variables = {}) {

    const t = template && typeof template === 'object' ? template : {};
    const renderTemplate = JSON.parse(JSON.stringify(t));

    const page = renderTemplate.page || {};

    const w = page.widthMm || 210;

    const h = page.heightMm || 297;

    const m = page.margins || { top: 15, right: 15, bottom: 15, left: 15 };

    const tableNode = findDevisTableNode(renderTemplate.nodes);

    const tableConfig = tableNode?.tableConfig || null;

    const lines = variables['ugap:lignes.rows'];

    const hasLinePagination = Array.isArray(lines) && lines.length > 0 && tableConfig;



    let pageChunks = [null];

    if (hasLinePagination) {

      pageChunks = paginateLines(lines, renderTemplate, page);

    }



    const isMultiPage = pageChunks.length > 1;

    const pagesHtml = pageChunks.map((chunkLines, pageIndex) => {

      const pageVars = { ...variables };

      if (chunkLines) {

        pageVars['ugap:lignes.table'] = renderTableHtmlFromLines(chunkLines, tableConfig);

      }

      const chunkHeights = Array.isArray(chunkLines)
        ? computeRowHeightsMm(chunkLines, renderTemplate)
        : [];

      const pageContext = {

        isFirst: pageIndex === 0,

        isLast: pageIndex === pageChunks.length - 1,

        isMultiPage,

        pageIndex,

        totalPages: pageChunks.length,

        lineCount: Array.isArray(chunkLines) ? chunkLines.length : 0,

        linesBodyHeightMm: chunkHeights.reduce((a, b) => a + b, 0)

      };

      const pageTemplate = JSON.parse(JSON.stringify(renderTemplate));

      const body = HtmlRenderService.renderPageBody(pageTemplate, pageVars, pageContext);

      const pageLabel = isMultiPage

        ? `<div class="adv2-page-number">Page ${pageIndex + 1} / ${pageChunks.length}</div>`

        : '';

      return `<div class="adv2-page${pageIndex > 0 ? ' adv2-page-break' : ''}">

  <div class="adv2-margin"></div>

  <div class="adv2-content">${body}${pageLabel}</div>

</div>`;

    }).join('\n');



    return `<!DOCTYPE html>

<html lang="fr"><head><meta charset="UTF-8">

<style>

  * { box-sizing: border-box; }

  body { margin:0; padding:20px; background:#e2e8f0; font-family: Arial, sans-serif; }

  .adv2-page { position:relative; width:${w}mm; height:${h}mm; background:#fff; margin:0 auto 16px; box-shadow:0 4px 20px rgba(0,0,0,.12); overflow:hidden; page-break-after:always; }

  .adv2-page:last-child { page-break-after:auto; margin-bottom:0; }

  .adv2-margin { position:absolute; border:1px dashed #e2e8f0; pointer-events:none; left:${m.left}mm; top:${m.top}mm; right:${m.right}mm; bottom:${m.bottom}mm; }

  .adv2-content { position:absolute; left:0; top:0; width:100%; height:100%; }

  .adv2-page-number { position:absolute; right:${m.right || 15}mm; bottom:${Math.max(4, (m.bottom || 15) - 10)}mm; font-size:8pt; color:#64748b; }

  .adv2-table table,

  .adv2-table .ugap-devis-lines { width:100%; border-collapse:collapse; margin:0; font-size:9pt; table-layout:fixed; }

  .adv2-table th, .adv2-table td { word-wrap:break-word; overflow-wrap:break-word; }

  .adv2-table--lignes table { table-layout:fixed; border-collapse:collapse; }

  .adv2-table--lignes thead tr { height:${HEADER_ROW_HEIGHT_MM}mm; }

  .adv2-table--lignes tbody tr { height:${ROW_HEIGHT_MM}mm; page-break-inside:avoid; break-inside:avoid; }

  .adv2-table--lignes th, .adv2-table--lignes td { overflow:hidden; }

  p { margin:0 0 2mm; }

  .adv2-text-frame { color:#0f172a; line-height:1.45; }

  .adv2-text-frame h1, .adv2-text-frame h2 { margin:0 0 1.5mm; }

  .adv2-text-frame a { color:#2563eb; }

  @media print {

    body { padding:0; background:#fff; }

    .adv2-page { box-shadow:none; margin:0; }

  }

</style></head><body>

${pagesHtml}

</body></html>`;

  }

}



module.exports = HtmlRenderService;

