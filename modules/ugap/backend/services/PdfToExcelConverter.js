/**
 * Service de conversion PDF vers Excel avec Camelot
 * Fichier : modules/ugap/backend/services/PdfToExcelConverter.js
 */

const path = require('path');
const fs = require('fs');
const { getPythonServer } = require('./PythonExtractionServer');

class PdfToExcelConverter {
  /**
   * Convertit un PDF en Excel en utilisant Camelot
   * @param {string} pdfPath - Chemin vers le fichier PDF
   * @param {string} outputDir - Répertoire de sortie (optionnel)
   * @returns {Promise<Object>} { success, excelPath, fileName, stats }
   */
  static async convert(pdfPath, outputDir = null) {
    try {
      // Vérifier que le PDF existe
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`Fichier PDF introuvable: ${pdfPath}`);
      }

      // Déterminer le répertoire de sortie
      const finalOutputDir = outputDir || path.join(__dirname, '../uploads/pdf-to-excel');
      if (!fs.existsSync(finalOutputDir)) {
        fs.mkdirSync(finalOutputDir, { recursive: true });
      }

      // Générer le nom du fichier Excel
      const pdfName = path.basename(pdfPath, path.extname(pdfPath));
      const timestamp = Date.now();
      const excelFileName = `${pdfName}_${timestamp}.xlsx`;
      const excelPath = path.join(finalOutputDir, excelFileName);

      // Vérifier que Camelot est disponible
      const pythonServer = getPythonServer();
      const camelotAvailable = await pythonServer.checkCamelot();
      
      if (!camelotAvailable) {
        throw new Error('Camelot n\'est pas installé. Installez-le avec: pip install camelot-py[cv]');
      }

      // Extraire avec Camelot
      console.log(`🔄 Conversion PDF vers Excel: ${pdfPath}`);
      console.log(`📁 Fichier de sortie: ${excelPath}`);

      const result = await pythonServer.extractWithCamelot(pdfPath, excelPath);

      // Parser la réponse JSON du script Python
      let camelotResult = { success: false };
      try {
        if (result.stdout) {
          const jsonMatch = result.stdout.match(/\{[\s\S]*"success"[\s\S]*\}/);
          if (jsonMatch) {
            camelotResult = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (parseError) {
        console.warn('⚠️ Erreur parsing réponse Camelot:', parseError);
      }

      // Vérifier si le fichier existe
      const fileExists = fs.existsSync(excelPath);
      
      if (!camelotResult.success || !fileExists) {
        throw new Error(
          camelotResult.error || 
          result.error || 
          result.stderr || 
          'Erreur lors de la conversion PDF vers Excel'
        );
      }

      const stats = fs.statSync(excelPath);
      
      console.log(`✅ Conversion réussie: ${excelFileName} (${stats.size} bytes)`);

      return {
        success: true,
        excelPath,
        fileName: excelFileName,
        stats: {
          tables: camelotResult.tables || 0,
          method: camelotResult.method || 'lattice',
          rows: camelotResult.rows || 0,
          fileSize: stats.size
        }
      };
    } catch (error) {
      console.error('❌ Erreur conversion PDF vers Excel:', error);
      throw error;
    }
  }

  /**
   * Vérifie si Camelot est disponible
   * @returns {Promise<boolean>}
   */
  static async isAvailable() {
    try {
      const pythonServer = getPythonServer();
      return await pythonServer.checkCamelot();
    } catch (error) {
      return false;
    }
  }
}

module.exports = PdfToExcelConverter;
