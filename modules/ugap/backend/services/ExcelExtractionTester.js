/**
 * Service de test de différentes méthodes d'extraction Excel
 * Compare plusieurs bibliothèques pour trouver la plus fidèle
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { execFile, exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);
const { getPythonServer } = require('./PythonExtractionServer');

class ExcelExtractionTester {
  /**
   * Test avec XLSX (méthode actuelle)
   */
  static async testXLSX(filePath) {
    const results = {
      method: 'XLSX (actuel)',
      success: false,
      data: null,
      colors: [],
      errors: [],
      stats: {},
      debug: {}
    };

    try {
      // Essayer plusieurs combinaisons d'options
      let wb;
      let optionsUsed = {};
      
      try {
        wb = XLSX.readFile(filePath, { 
          cellStyles: true, 
          cellNF: true,
          cellHTML: false,
          sheetStubs: false
        });
        optionsUsed = { cellStyles: true, cellNF: true };
      } catch (e1) {
        try {
          wb = XLSX.readFile(filePath, { cellStyles: true });
          optionsUsed = { cellStyles: true };
        } catch (e2) {
          wb = XLSX.readFile(filePath);
          optionsUsed = { default: true };
          results.errors.push(`Fallback to default options: ${e2.message}`);
        }
      }

      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');

      // Extraire les données
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

      // Extraire les couleurs avec logging détaillé
      // ✅ IMPORTANT: Cette méthode lit directement Excel, donc les couleurs de fond SONT préservées
      const colors = this.extractColorsXLSX(ws, range, wb);
      console.log(`🎨 XLSX: ${colors.length} couleurs de fond détectées`);

      // Debug: inspecter quelques cellules
      const debugCells = [];
      for (let r = range.s.r; r <= Math.min(range.s.r + 5, range.e.r); r++) {
        for (let c = 0; c <= Math.min(2, range.e.c); c++) {
          const cellAddr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[cellAddr];
          if (cell) {
            debugCells.push({
              address: cellAddr,
              hasStyle: !!cell.s,
              styleKeys: cell.s ? Object.keys(cell.s) : [],
              fill: cell.s?.fill ? JSON.stringify(cell.s.fill).substring(0, 200) : null
            });
          }
        }
      }

      results.success = true;
      results.data = data;
      results.colors = colors;
      results.stats = {
        totalRows: data.length,
        totalCells: (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1),
        colorsFound: colors.length,
        hasStyles: !!wb.Styles,
        fillsCount: wb.Styles?.Fills?.length || 0,
        cellXfCount: wb.Styles?.CellXf?.length || 0,
        optionsUsed: optionsUsed
      };
      results.debug = {
        sampleCells: debugCells.slice(0, 10),
        workbookKeys: Object.keys(wb).filter(k => !k.startsWith('Sheet')),
        stylesKeys: wb.Styles ? Object.keys(wb.Styles) : []
      };
    } catch (error) {
      results.errors.push(error.message);
      results.error = error.message;
    }

    return results;
  }

  /**
   * Test avec XLSX en mode raw (sans conversion)
   */
  static async testXLSXRaw(filePath) {
    const results = {
      method: 'XLSX Raw (sans conversion)',
      success: false,
      data: null,
      colors: [],
      errors: [],
      stats: {}
    };

    try {
      const wb = XLSX.readFile(filePath, { cellStyles: true, raw: true });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');

      // Extraire les données en mode raw
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

      // Extraire les couleurs
      // ✅ IMPORTANT: Cette méthode lit directement Excel, donc les couleurs de fond SONT préservées
      const colors = this.extractColorsXLSX(ws, range, wb);
      console.log(`🎨 XLSX Raw: ${colors.length} couleurs de fond détectées`);

      results.success = true;
      results.data = data;
      results.colors = colors;
      results.stats = {
        totalRows: data.length,
        totalCells: (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1),
        colorsFound: colors.length
      };
    } catch (error) {
      results.errors.push(error.message);
      results.error = error.message;
    }

    return results;
  }

  /**
   * Test avec ExcelJS (si disponible)
   */
  static async testExcelJS(filePath) {
    const results = {
      method: 'ExcelJS',
      success: false,
      data: null,
      colors: [],
      errors: [],
      stats: {},
      available: false
    };

    // Vérifier si ExcelJS est disponible
    try {
      require.resolve('exceljs');
    } catch (e) {
      results.errors.push('ExcelJS n\'est pas installé. Installez-le avec: npm install exceljs');
      results.available = false;
      return results;
    }

    try {
      const ExcelJS = require('exceljs');
      results.available = true;

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const worksheet = workbook.worksheets[0];
      const data = [];
      const colors = [];

      worksheet.eachRow((row, rowNumber) => {
        const rowData = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          rowData[colNumber - 1] = cell.value || null;

          // Extraire la couleur
          if (cell.fill && cell.fill.fgColor) {
            const color = this.getExcelJSColor(cell.fill.fgColor);
            if (color) {
              colors.push({
                row: rowNumber - 1,
                col: colNumber - 1,
                color: color,
                value: cell.value
              });
            }
          }
        });
        data.push(rowData);
      });

      results.success = true;
      results.data = data;
      results.colors = this.groupColors(colors);
      results.stats = {
        totalRows: data.length,
        totalCells: worksheet.columnCount * data.length,
        colorsFound: results.colors.length
      };
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        results.errors.push('ExcelJS n\'est pas installé. Installez-le avec: npm install exceljs');
        results.available = false;
      } else {
        results.errors.push(error.message);
        results.error = error.message;
      }
    }

    return results;
  }

  /**
   * Test avec lecture directe du fichier XML (pour .xlsx)
   */
  static async testXMLDirect(filePath) {
    const results = {
      method: 'XML Direct (lecture brute)',
      success: false,
      data: null,
      colors: [],
      errors: [],
      stats: {}
    };

    try {
      // Un fichier .xlsx est en fait un ZIP contenant des fichiers XML
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();

      // Chercher le fichier sharedStrings.xml et styles.xml
      let stylesXML = null;
      let sharedStringsXML = null;
      let worksheetXML = null;

      zipEntries.forEach(entry => {
        if (entry.entryName.includes('styles.xml')) {
          stylesXML = zip.readAsText(entry);
        }
        if (entry.entryName.includes('sharedStrings.xml')) {
          sharedStringsXML = zip.readAsText(entry);
        }
        if (entry.entryName.includes('xl/worksheets/sheet1.xml') || entry.entryName.match(/xl\/worksheets\/sheet\d+\.xml/)) {
          worksheetXML = zip.readAsText(entry);
        }
      });

      // Parser les couleurs depuis styles.xml
      const colors = this.extractColorsFromStylesXML(stylesXML);

      results.success = true;
      results.colors = colors;
      results.stats = {
        hasStylesXML: !!stylesXML,
        hasWorksheetXML: !!worksheetXML,
        hasSharedStrings: !!sharedStringsXML,
        colorsFound: colors.length
      };
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        results.errors.push('adm-zip n\'est pas installé. Installez-le avec: npm install adm-zip');
      } else {
        results.errors.push(error.message);
        results.error = error.message;
      }
    }

    return results;
  }

  /**
   * Extrait les couleurs avec XLSX (méthode exhaustive)
   */
  static extractColorsXLSX(ws, range, wb) {
    const colorCounts = {};
    let cellsChecked = 0;
    let cellsWithStyle = 0;
    let cellsWithFill = 0;
    let cellsWithColor = 0;

    // Parcourir toutes les cellules
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[cellAddr];
        if (!cell) continue;

        cellsChecked++;

        // Vérifier si la cellule a un style
        if (cell.s) {
          cellsWithStyle++;
          if (cell.s.fill) {
            cellsWithFill++;
          }
        }

        // Essayer d'extraire la couleur
        const color = this.getCellColorXLSX(cell, wb);
        if (color) {
          const normalized = this.normalizeColor(color);
          if (normalized) {
            cellsWithColor++;
            if (!colorCounts[normalized]) {
              colorCounts[normalized] = {
                color: normalized,
                count: 0,
                cells: []
              };
            }
            colorCounts[normalized].count++;
            if (colorCounts[normalized].cells.length < 5) {
              colorCounts[normalized].cells.push({
                address: cellAddr,
                row: r,
                col: c,
                value: cell.v
              });
            }
          }
        }
      }
    }

    // Log pour debug
    console.log(`📊 XLSX Color Extraction Stats:`);
    console.log(`   Cells checked: ${cellsChecked}`);
    console.log(`   Cells with style: ${cellsWithStyle}`);
    console.log(`   Cells with fill: ${cellsWithFill}`);
    console.log(`   Cells with color: ${cellsWithColor}`);
    console.log(`   Unique colors found: ${Object.keys(colorCounts).length}`);

    return Object.values(colorCounts)
      .sort((a, b) => b.count - a.count)
      .map(c => ({
        color: c.color,
        count: c.count,
        sampleCells: c.cells
      }));
  }

  /**
   * Récupère la couleur d'une cellule avec XLSX (méthode exhaustive)
   */
  static getCellColorXLSX(cell, wb) {
    try {
      if (!cell) return null;

      // Méthode 1: Styles directs de la cellule (cell.s.fill)
      const s = cell.s;
      if (s) {
        // Essayer s.fill directement
        if (s.fill) {
          const fill = s.fill;
          
          // fgColor (foreground color - couleur de remplissage)
          if (fill.fgColor) {
            const color = fill.fgColor.rgb || fill.fgColor.RGB || fill.fgColor.argb || fill.fgColor.ARGB;
            if (color) return color;
          }
          
          // bgColor (background color)
          if (fill.bgColor) {
            const color = fill.bgColor.rgb || fill.bgColor.RGB || fill.bgColor.argb || fill.bgColor.ARGB;
            if (color) return color;
          }
          
          // rgb direct
          if (fill.rgb) {
            return fill.rgb;
          }
          
          // patternFill (format Office Open XML)
          if (fill.patternFill) {
            const patternFill = fill.patternFill;
            if (patternFill.fgColor) {
              const color = patternFill.fgColor.rgb || patternFill.fgColor.RGB || patternFill.fgColor.argb || patternFill.fgColor.ARGB;
              if (color) return color;
            }
            if (patternFill.bgColor) {
              const color = patternFill.bgColor.rgb || patternFill.bgColor.RGB || patternFill.bgColor.argb || patternFill.bgColor.ARGB;
              if (color) return color;
            }
          }
        }

        // Méthode 2: Via l'index de style (styles partagés du workbook)
        if (wb && wb.Styles && s.style !== undefined) {
          const styleIndex = s.style;
          
          // CellXf contient les références aux styles
          if (wb.Styles.CellXf && wb.Styles.CellXf[styleIndex]) {
            const cellXf = wb.Styles.CellXf[styleIndex];
            
            // fillId référence un fill dans wb.Styles.Fills
            if (cellXf.fillId !== undefined && wb.Styles.Fills) {
              const fill = wb.Styles.Fills[cellXf.fillId];
              
              if (fill) {
                // Essayer patternFill
                if (fill.patternFill) {
                  const patternFill = fill.patternFill;
                  if (patternFill.fgColor) {
                    const color = patternFill.fgColor.rgb || patternFill.fgColor.RGB || patternFill.fgColor.argb || patternFill.fgColor.ARGB;
                    if (color) return color;
                  }
                  if (patternFill.bgColor) {
                    const color = patternFill.bgColor.rgb || patternFill.bgColor.RGB || patternFill.bgColor.argb || patternFill.bgColor.ARGB;
                    if (color) return color;
                  }
                }
                
                // Essayer directement dans fill
                if (fill.fgColor) {
                  const color = fill.fgColor.rgb || fill.fgColor.RGB || fill.fgColor.argb || fill.fgColor.ARGB;
                  if (color) return color;
                }
                if (fill.bgColor) {
                  const color = fill.bgColor.rgb || fill.bgColor.RGB || fill.bgColor.argb || fill.bgColor.ARGB;
                  if (color) return color;
                }
              }
            }
          }
        }
      }

      // Méthode 3: Essayer directement dans la cellule (format alternatif)
      if (cell.fill) {
        const fill = cell.fill;
        const color = fill.rgb || fill.RGB || fill.argb || fill.ARGB || fill.fgColor?.rgb || fill.bgColor?.rgb;
        if (color) return color;
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Récupère la couleur avec ExcelJS (format ARGB ou RGB)
   */
  static getExcelJSColor(colorObj) {
    if (!colorObj) return null;

    // Format ARGB (8 caractères avec alpha)
    if (colorObj.argb) {
      const argb = colorObj.argb.toString().toUpperCase();
      // Enlever le préfixe alpha FF si présent
      if (argb.length === 8 && argb.startsWith('FF')) {
        return argb.substring(2);
      }
      return argb;
    }

    // Format RGB (6 caractères)
    if (colorObj.rgb) {
      return colorObj.rgb.toString().toUpperCase();
    }

    // Essayer directement la valeur si c'est une string
    if (typeof colorObj === 'string') {
      const normalized = this.normalizeColor(colorObj);
      return normalized;
    }

    return null;
  }

  /**
   * Normalise une couleur
   */
  static normalizeColor(c) {
    if (!c) return null;
    let colorStr = c.toString().trim();
    if (/^[0-9A-Fa-f]{6}$/.test(colorStr)) {
      return colorStr.toUpperCase();
    }
    if (/^[0-9A-Fa-f]{8}$/.test(colorStr)) {
      colorStr = colorStr.replace(/^FF/i, '');
      return colorStr.toUpperCase();
    }
    colorStr = colorStr.replace(/^FF/i, '').replace(/^#/i, '');
    if (/^[0-9A-Fa-f]{6}$/.test(colorStr)) {
      return colorStr.toUpperCase();
    }
    return null;
  }

  /**
   * Groupe les couleurs par code
   */
  static groupColors(colors) {
    const grouped = {};
    colors.forEach(c => {
      const color = this.normalizeColor(c.color);
      if (color) {
        if (!grouped[color]) {
          grouped[color] = {
            color: color,
            count: 0,
            sampleCells: []
          };
        }
        grouped[color].count++;
        if (grouped[color].sampleCells.length < 5) {
          grouped[color].sampleCells.push({
            row: c.row,
            col: c.col,
            value: c.value
          });
        }
      }
    });

    return Object.values(grouped).sort((a, b) => b.count - a.count);
  }

  /**
   * Extrait les couleurs depuis le XML de styles
   */
  static extractColorsFromStylesXML(stylesXML) {
    if (!stylesXML) return [];

    const colors = [];
    // Parser le XML pour extraire les couleurs
    // Format: <fill><patternFill><fgColor rgb="FF000000"/></patternFill></fill>
    const fillMatches = stylesXML.matchAll(/<fill[^>]*>[\s\S]*?<\/fill>/gi);
    
    for (const match of fillMatches) {
      const fillContent = match[0];
      const rgbMatch = fillContent.match(/rgb="([^"]+)"/i) || fillContent.match(/rgb='([^']+)'/i);
      if (rgbMatch) {
        const color = this.normalizeColor(rgbMatch[1]);
        if (color) {
          colors.push(color);
        }
      }
    }

    // Compter les occurrences
    const colorCounts = {};
    colors.forEach(c => {
      colorCounts[c] = (colorCounts[c] || 0) + 1;
    });

    return Object.entries(colorCounts)
      .map(([color, count]) => ({ color, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Test avec Tabula (extraction depuis PDF si disponible)
   */
  static async testTabula(pdfPath, excelPath) {
    const results = {
      method: 'Tabula (PDF → Excel)',
      success: false,
      data: null,
      colors: [],
      errors: [],
      stats: {},
      available: false
    };

    // Tabula nécessite le PDF original, pas l'Excel
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      results.errors.push('Fichier PDF original requis pour Tabula');
      return results;
    }

    try {
      // Utiliser le serveur Python pour Tabula
      const pythonServer = getPythonServer();
      const tabulaAvailable = await pythonServer.checkTabula();
      
      if (!tabulaAvailable) {
        results.errors.push('Tabula (tabula-py) n\'est pas installé. Installez-le avec: pip install tabula-py');
        results.available = false;
        return results;
      }
      
      results.available = true;

      // Créer un répertoire temporaire pour les résultats
      const tempDir = path.join(__dirname, '../uploads/tabula-temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const outputPath = path.join(tempDir, `tabula_${Date.now()}.xlsx`);
      
      // Utiliser le serveur Python pour extraire avec Tabula (réutiliser la variable existante)
      const result = await pythonServer.extractWithTabula(pdfPath, outputPath);
      
      let tabulaSuccess = false;
      let format = 'excel';
      
      if (result.success) {
        try {
          // Parser la réponse JSON
          const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const response = JSON.parse(jsonMatch[0]);
            if (response.success) {
              if (response.method === 'csv' && response.csv_path) {
                // Convertir CSV en Excel
                format = 'csv';
                const csvContent = fs.readFileSync(response.csv_path, 'utf-8');
                const lines = csvContent.split('\n').filter(l => l.trim());
                const data = lines.map(line => {
                  const cols = [];
                  let current = '';
                  let inQuotes = false;
                  for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') {
                      inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                      cols.push(current.trim());
                      current = '';
                    } else {
                      current += char;
                    }
                  }
                  cols.push(current.trim());
                  return cols;
                });
                const ws = XLSX.utils.aoa_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Tabula');
                XLSX.writeFile(wb, outputPath);
                fs.unlinkSync(response.csv_path);
              }
              tabulaSuccess = fs.existsSync(outputPath);
            } else {
              throw new Error(response.error || 'Tabula a échoué');
            }
          } else if (fs.existsSync(outputPath)) {
            tabulaSuccess = true;
          } else {
            throw new Error(`Tabula n'a pas généré de fichier`);
          }
        } catch (parseError) {
          if (fs.existsSync(outputPath)) {
            tabulaSuccess = true;
          } else {
            results.errors.push(`Erreur parsing Tabula: ${parseError.message}`);
            return results;
          }
        }
       } else {
         // Améliorer le message d'erreur
         let errorMsg = result.error || result.stderr || 'Erreur inconnue';
         
         // Essayer de parser le JSON d'erreur depuis stdout
         try {
           const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
           if (jsonMatch) {
             const errorResponse = JSON.parse(jsonMatch[0]);
             if (errorResponse.error) {
               errorMsg = errorResponse.error;
               if (errorResponse.traceback) {
                 console.error('Traceback Python:', errorResponse.traceback);
               }
             }
           }
         } catch (e) {
           // Ignorer si pas de JSON
         }
         
         results.errors.push(`Erreur Tabula: ${errorMsg}`);
         if (result.code) {
           results.errors.push(`Code d'erreur: ${result.code}`);
         }
         return results;
       }
      
      // Note: L'erreur jpype est normale - Tabula utilise subprocess si jpype n'est pas disponible
      if (result.stderr && !result.stderr.includes('INFO') && !result.stderr.includes('WARN') && !result.stderr.includes('jpype') && !result.stderr.includes('subprocess')) {
        console.warn('Tabula stderr:', result.stderr);
      }
      
      // IMPORTANT: Tabula extrait depuis PDF, donc les couleurs de fond ne sont PAS préservées
      // Les couleurs seront vides pour cette méthode (PDF n'a pas d'info de couleur de fond)

      // Si Tabula a généré un fichier, le traiter
      if (tabulaSuccess && fs.existsSync(outputPath)) {
        // Lire l'Excel généré
        const wb = XLSX.readFile(outputPath, { cellStyles: true });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
        
        // Extraire les couleurs depuis l'Excel généré
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
        const colors = this.extractColorsXLSX(ws, range, wb);

        results.success = true;
        results.data = data;
        results.colors = colors;
        results.stats = {
          totalRows: data.length,
          totalCells: data.reduce((sum, row) => sum + row.length, 0),
          colorsFound: colors.length,
          source: 'PDF via Tabula (Python)',
          format: format === 'excel' ? 'Excel (direct)' : 'CSV converted to Excel',
          note: format === 'csv' ? 'Tabula CSV ne préserve pas les couleurs' : 'Tabula Excel peut préserver certains styles',
          pythonPath: pythonServer.pythonPath
        };

        // Nettoyer le fichier temporaire
        try {
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (e) {
          // Ignorer les erreurs de nettoyage
        }
      } else {
        results.errors.push('Tabula n\'a pas généré de fichier de sortie');
      }

    } catch (error) {
      results.errors.push(error.message);
      results.error = error.message;
      console.error('❌ Tabula error:', error);
    }

    return results;
  }

  /**
   * Test avec Camelot (extraction depuis PDF si disponible)
   */
  static async testCamelot(pdfPath, excelPath) {
    const results = {
      method: 'Camelot (PDF → Excel)',
      success: false,
      data: null,
      colors: [],
      errors: [],
      stats: {},
      available: false
    };

    // Camelot nécessite le PDF original
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      results.errors.push('Fichier PDF original requis pour Camelot');
      return results;
    }

    try {
      // Utiliser le serveur Python pour Camelot
      const pythonServer = getPythonServer();
      const camelotAvailable = await pythonServer.checkCamelot();
      
      if (!camelotAvailable) {
        results.errors.push('Camelot (camelot-py) n\'est pas installé. Installez-le avec: pip install camelot-py[cv]');
        results.available = false;
        return results;
      }
      
      results.available = true;

      // Créer un répertoire temporaire pour les résultats
      const tempDir = path.join(__dirname, '../uploads/camelot-temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const outputPath = path.join(tempDir, `camelot_${Date.now()}.xlsx`);

      // Utiliser le serveur Python pour extraire avec Camelot (réutiliser la variable existante)
      const result = await pythonServer.extractWithCamelot(pdfPath, outputPath);
      
      let camelotSuccess = false;
      let method = 'lattice';
      
      if (result.success) {
        try {
          // Parser la réponse JSON
          const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const response = JSON.parse(jsonMatch[0]);
            if (response.success) {
              method = response.method || 'lattice';
              camelotSuccess = fs.existsSync(outputPath);
              
              if (!camelotSuccess) {
                // Chercher les fichiers Excel générés par Camelot
                try {
                  const files = fs.readdirSync(tempDir);
                  const excelFiles = files.filter(f => f.includes('camelot_') && f.endsWith('.xlsx'));
                  if (excelFiles.length > 0) {
                    const actualPath = path.join(tempDir, excelFiles.sort().reverse()[0]);
                    if (actualPath !== outputPath) {
                      if (fs.existsSync(outputPath)) {
                        fs.unlinkSync(outputPath);
                      }
                      fs.renameSync(actualPath, outputPath);
                    }
                    camelotSuccess = fs.existsSync(outputPath);
                  }
                } catch (dirError) {
                  console.warn('Erreur lors de la recherche de fichiers Camelot:', dirError);
                }
              }
              
              if (!camelotSuccess) {
                throw new Error('Camelot n\'a pas généré de fichier Excel');
              }
            } else {
              throw new Error(response.error || 'Camelot a échoué');
            }
          } else if (fs.existsSync(outputPath)) {
            camelotSuccess = true;
            console.log('⚠️ Camelot: Fichier trouvé mais réponse JSON invalide');
          } else {
            throw new Error(`Camelot n'a pas généré de fichier`);
          }
        } catch (parseError) {
          if (fs.existsSync(outputPath)) {
            camelotSuccess = true;
          } else {
            results.errors.push(`Erreur parsing Camelot: ${parseError.message}`);
            return results;
          }
        }
      } else {
        results.errors.push(`Erreur Camelot: ${result.error || result.stderr}`);
        return results;
      }
      
      if (result.stderr && !result.stderr.includes('INFO') && !result.stderr.includes('WARN')) {
        console.warn('Camelot stderr:', result.stderr);
      }

      // Si Camelot a généré un fichier Excel, le traiter
      if (camelotSuccess && fs.existsSync(outputPath)) {
        // Lire l'Excel généré par Camelot
        const wb = XLSX.readFile(outputPath, { cellStyles: true });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
        
        // Extraire les couleurs depuis l'Excel généré
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
        const colors = this.extractColorsXLSX(ws, range, wb);

        results.success = true;
        results.data = data;
        results.colors = colors;
        results.stats = {
          totalRows: data.length,
          totalCells: data.reduce((sum, row) => sum + row.length, 0),
          colorsFound: colors.length,
          source: 'PDF via Camelot (Python)',
          format: 'Excel (direct)',
          method: method,
          note: 'Camelot peut préserver certains styles selon le PDF',
          pythonPath: pythonServer.pythonPath
        };

        // Nettoyer le fichier temporaire
        try {
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (e) {
          // Ignorer les erreurs de nettoyage
        }
      } else {
        results.errors.push('Camelot n\'a pas généré de fichier de sortie');
      }

    } catch (error) {
      results.errors.push(error.message);
      results.error = error.message;
      console.error('❌ Camelot error:', error);
    }

    return results;
  }

  /**
   * Lance tous les tests
   */
  static async runAllTests(filePath, pdfPath = null) {
    const results = [];

    // Test 1: XLSX standard
    results.push(await this.testXLSX(filePath));

    // Test 2: XLSX Raw
    results.push(await this.testXLSXRaw(filePath));

    // Test 3: ExcelJS (si disponible)
    results.push(await this.testExcelJS(filePath));

    // Test 4: XML Direct (si disponible)
    results.push(await this.testXMLDirect(filePath));

    // Test 5: Tabula (si PDF disponible)
    if (pdfPath) {
      results.push(await this.testTabula(pdfPath, filePath));
    }

    // Test 6: Camelot (si PDF disponible)
    if (pdfPath) {
      results.push(await this.testCamelot(pdfPath, filePath));
    }

    return results;
  }
}

module.exports = ExcelExtractionTester;
