/**
 * FICHIER : modules/ugap/backend/services/devis/buildDevisLinesTable.js
 * RÔLE : Construit un bloc table agent documentaire pour les lignes de devis.
 *
 * ENTRÉES : lignes normalisées (optionToLine)
 * SORTIES : objet content type table
 *
 * DÉPEND DE : renderDevisTableHtml (colonnes par défaut)
 * NE PAS : rendu PDF
 *
 * APPELÉ PAR : UgapDevisRenderService
 */

const { DEFAULT_COLUMNS } = require('./renderDevisTableHtml');

function buildDevisLinesTable(lines, columns = DEFAULT_COLUMNS) {
  const rows = Array.isArray(lines) ? lines : [];
  const cols = Array.isArray(columns) && columns.length ? columns : DEFAULT_COLUMNS;

  const headerRow = {
    cells: cols.map((col) => ({ text: col.label, styles: { fontWeight: 'bold' } }))
  };

  const dataRows = rows.map((line, index) => ({
    cells: cols.map((col) => {
      const raw = line?.[col.key];
      const text = col.key === 'prix' && raw ? `${raw} €` : String(raw || '');
      return { text, styles: {} };
    }),
    styles: index % 2 === 1 ? { backgroundColor: '#fafafa' } : {}
  }));

  if (!dataRows.length) {
    dataRows.push({
      cells: [{ text: 'Aucune ligne sélectionnée', styles: { fontStyle: 'italic' } }],
      styles: {}
    });
  }

  return {
    type: 'table',
    id: `ugap_lines_table_${Date.now()}`,
    headerRow: true,
    rows: [headerRow, ...dataRows],
    styles: {
      borders: { enabled: true, width: 0.5, color: '#cccccc', style: 'solid' }
    }
  };
}

function injectLinesTableIntoSections(sections, lines) {
  const table = buildDevisLinesTable(lines);
  const walk = (list) => {
    (Array.isArray(list) ? list : []).forEach((section) => {
      if (section?.id === 'ugap_zone_lignes' && Array.isArray(section.content)) {
        const idx = section.content.findIndex((c) => c?.id === 'ugap_zone_lignes_p1');
        if (idx >= 0) {
          section.content[idx] = table;
        }
      }
      if (Array.isArray(section.children) && section.children.length) {
        walk(section.children);
      }
    });
  };
  walk(sections);
  return sections;
}

module.exports = {
  buildDevisLinesTable,
  injectLinesTableIntoSections
};
