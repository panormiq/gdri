/**
 * Méthode d'extraction : Tableau
 * Fichier : backend/modules/agent-documentaire/extractors/methodes/extract-table.js
 * 
 * Fonction : Extrait un tableau Word et ses propriétés
 * - Structure (lignes, colonnes, cellules)
 * - Contenu des cellules
 * - Styles (bordures, couleurs, alignement)
 * - Ligne d'en-tête
 */

const WordParser = require('../word-parser');

class ExtractTable {
  /**
   * Extrait un tableau depuis le XML Word
   * @param {Object} tableXml - Élément XML du tableau (w:tbl)
   * @param {Object} documentStyles - Styles généraux du document (optionnel)
   * @returns {Object} Tableau extrait
   */
  static extract(tableXml, documentStyles = {}) {
    if (!tableXml || typeof tableXml !== 'object') {
      return ExtractTable.getDefaultTable();
    }

    const result = {
      type: 'table',
      id: `tbl_${Date.now()}_${Math.random()}`,
      rows: [],
      columns: 0,
      styles: {
        borders: {
          enabled: true,
          width: 0.5,
          color: '#000000',
          style: 'solid'
        },
        headerRow: false,
        alternatingRows: false
      }
    };

    // Extraire les lignes (w:tr)
    const rows = tableXml['w:tr'];
    if (!rows) {
      return result;
    }

    const rowsArray = Array.isArray(rows) ? rows : [rows];
    let maxColumns = 0;

    for (let rowIndex = 0; rowIndex < rowsArray.length; rowIndex++) {
      const row = rowsArray[rowIndex];
      const extractedRow = ExtractTable.extractRow(row, rowIndex, documentStyles);
      
      // Mettre à jour le nombre maximum de colonnes
      maxColumns = Math.max(maxColumns, extractedRow.cells.length);
      
      result.rows.push(extractedRow);
    }

    result.columns = maxColumns;
    
    // Détecter la ligne d'en-tête (première ligne avec style spécial ou formatage différent)
    if (result.rows.length > 0) {
      const firstRow = result.rows[0];
      // Vérifier si la première ligne a un style différent ou est formatée comme en-tête
      if (firstRow.isHeader !== undefined) {
        result.styles.headerRow = firstRow.isHeader;
      } else {
        // Par défaut, considérer la première ligne comme en-tête si elle a un formatage spécial
        result.styles.headerRow = firstRow.styles?.bold || firstRow.styles?.backgroundColor !== undefined;
      }
    }

    return result;
  }

  /**
   * Extrait une ligne de tableau (w:tr)
   */
  static extractRow(rowXml, rowIndex, documentStyles) {
    const row = {
      index: rowIndex,
      cells: [],
      styles: {
        backgroundColor: null,
        height: null
      }
    };

    // Propriétés de ligne (w:trPr)
    const trPr = rowXml['w:trPr'];
    if (trPr) {
      const trPrArray = Array.isArray(trPr) ? trPr : [trPr];
      for (const tr of trPrArray) {
        // Hauteur de ligne (w:trHeight)
        const trHeight = tr['w:trHeight'];
        if (trHeight) {
          const heightArray = Array.isArray(trHeight) ? trHeight : [trHeight];
          for (const h of heightArray) {
            const attrs = h['$'] || {};
            if (attrs['w:val']) {
              // w:val est en twips, convertir en points
              row.styles.height = parseInt(attrs['w:val']) / 20;
            }
          }
        }

        // Style de ligne (w:tblStyle)
        const tblStyle = tr['w:tblStyle'];
        if (tblStyle) {
          const styleArray = Array.isArray(tblStyle) ? tblStyle : [tblStyle];
          for (const s of styleArray) {
            const attrs = s['$'] || {};
            if (attrs['w:val']) {
              const styleName = attrs['w:val'];
              const style = documentStyles[styleName];
              if (style && style.paragraph) {
                if (style.paragraph.backgroundColor) {
                  row.styles.backgroundColor = style.paragraph.backgroundColor;
                }
              }
            }
          }
        }
      }
    }

    // Extraire les cellules (w:tc)
    const cells = rowXml['w:tc'];
    if (cells) {
      const cellsArray = Array.isArray(cells) ? cells : [cells];
      for (let cellIndex = 0; cellIndex < cellsArray.length; cellIndex++) {
        const cell = cellsArray[cellIndex];
        const extractedCell = ExtractTable.extractCell(cell, rowIndex, cellIndex, documentStyles);
        row.cells.push(extractedCell);
      }
    }

    return row;
  }

  /**
   * Extrait une cellule de tableau (w:tc)
   */
  static extractCell(cellXml, rowIndex, cellIndex, documentStyles) {
    const cell = {
      row: rowIndex,
      column: cellIndex,
      content: [],
      styles: {
        backgroundColor: null,
        borders: {
          top: { width: 0.5, color: '#000000', style: 'solid' },
          right: { width: 0.5, color: '#000000', style: 'solid' },
          bottom: { width: 0.5, color: '#000000', style: 'solid' },
          left: { width: 0.5, color: '#000000', style: 'solid' }
        },
        alignment: {
          vertical: 'top',
          horizontal: 'left'
        },
        padding: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        }
      },
      colspan: 1,
      rowspan: 1
    };

    // Propriétés de cellule (w:tcPr)
    const tcPr = cellXml['w:tcPr'];
    if (tcPr) {
      const tcPrArray = Array.isArray(tcPr) ? tcPr : [tcPr];
      for (const tc of tcPrArray) {
        // Fusion de cellules (w:gridSpan, w:vMerge)
        const gridSpan = tc['w:gridSpan'];
        if (gridSpan) {
          const spanArray = Array.isArray(gridSpan) ? gridSpan : [gridSpan];
          for (const span of spanArray) {
            const attrs = span['$'] || {};
            if (attrs['w:val']) {
              cell.colspan = parseInt(attrs['w:val']) || 1;
            }
          }
        }

        const vMerge = tc['w:vMerge'];
        if (vMerge) {
          const mergeArray = Array.isArray(vMerge) ? vMerge : [vMerge];
          for (const merge of mergeArray) {
            const attrs = merge['$'] || {};
            // Si w:val n'existe pas ou est "restart", c'est le début d'une fusion
            // Si w:val existe et n'est pas "restart", c'est une continuation
            if (!attrs['w:val'] || attrs['w:val'] === 'restart') {
              cell.rowspan = 1; // À calculer depuis les cellules suivantes
            } else {
              cell.rowspan = 0; // Cellule fusionnée (masquée)
            }
          }
        }

        // Bordures (w:tcBorders)
        const tcBorders = tc['w:tcBorders'];
        if (tcBorders) {
          const bordersArray = Array.isArray(tcBorders) ? tcBorders : [tcBorders];
          for (const borders of bordersArray) {
            // Bordures individuelles : w:top, w:right, w:bottom, w:left
            ['top', 'right', 'bottom', 'left'].forEach(side => {
              const borderTag = `w:${side}`;
              const border = borders[borderTag];
              if (border) {
                const borderArray = Array.isArray(border) ? border : [border];
                for (const b of borderArray) {
                  const attrs = b['$'] || {};
                  if (attrs['w:val'] && attrs['w:val'] !== 'nil') {
                    cell.styles.borders[side].style = attrs['w:val']; // single, double, etc.
                  }
                  if (attrs['w:sz']) {
                    // w:sz est en 8èmes de point
                    cell.styles.borders[side].width = parseInt(attrs['w:sz']) / 8;
                  }
                  if (attrs['w:color']) {
                    const color = attrs['w:color'];
                    if (color.length === 6) {
                      cell.styles.borders[side].color = '#' + color;
                    } else if (color.startsWith('#')) {
                      cell.styles.borders[side].color = color;
                    }
                  }
                }
              }
            });
          }
        }

        // Fond de couleur (w:shd)
        const shd = tc['w:shd'];
        if (shd) {
          const shdArray = Array.isArray(shd) ? shd : [shd];
          for (const s of shdArray) {
            const attrs = s['$'] || {};
            if (attrs['w:fill']) {
              const fill = attrs['w:fill'];
              if (fill.length === 6) {
                cell.styles.backgroundColor = '#' + fill;
              } else if (fill.startsWith('#')) {
                cell.styles.backgroundColor = fill;
              }
            }
          }
        }

        // Alignement vertical (w:vAlign)
        const vAlign = tc['w:vAlign'];
        if (vAlign) {
          const alignArray = Array.isArray(vAlign) ? vAlign : [vAlign];
          for (const align of alignArray) {
            const attrs = align['$'] || {};
            if (attrs['w:val']) {
              const val = attrs['w:val'];
              const alignMap = {
                'top': 'top',
                'center': 'middle',
                'bottom': 'bottom'
              };
              cell.styles.alignment.vertical = alignMap[val] || 'top';
            }
          }
        }

        // Marges (w:tcMar)
        const tcMar = tc['w:tcMar'];
        if (tcMar) {
          const marArray = Array.isArray(tcMar) ? tcMar : [tcMar];
          for (const mar of marArray) {
            ['top', 'right', 'bottom', 'left'].forEach(side => {
              const marTag = `w:${side}`;
              const margin = mar[marTag];
              if (margin) {
                const marginArray = Array.isArray(margin) ? margin : [margin];
                for (const m of marginArray) {
                  const attrs = m['$'] || {};
                  if (attrs['w:w']) {
                    // w:w est en twips
                    cell.styles.padding[side] = parseInt(attrs['w:w']) / 20;
                  }
                }
              }
            });
          }
        }
      }
    }

    // Extraire le contenu de la cellule (paragraphes, etc.)
    const paragraphs = cellXml['w:p'];
    if (paragraphs) {
      const pArray = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
      for (const p of pArray) {
        // Extraire le texte du paragraphe
        const text = WordParser.extractText(p);
        if (text && text.trim().length > 0) {
          cell.content.push({
            type: 'text',
            text: text.trim()
          });
        }
      }
    }

    return cell;
  }

  /**
   * Retourne un tableau par défaut
   */
  static getDefaultTable() {
    return {
      type: 'table',
      id: `tbl_${Date.now()}_${Math.random()}`,
      rows: [],
      columns: 0,
      styles: {
        borders: {
          enabled: true,
          width: 0.5,
          color: '#000000',
          style: 'solid'
        },
        headerRow: false,
        alternatingRows: false
      }
    };
  }
}

module.exports = ExtractTable;
