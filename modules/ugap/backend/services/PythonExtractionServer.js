/**
 * Serveur Python pour les extractions Tabula et Camelot
 * Évite de relancer Python à chaque fois
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

class PythonExtractionServer extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.isReady = false;
    this.requestQueue = [];
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.pythonPath = null;
  }

  /**
   * Détecte le chemin Python disponible
   */
  async detectPython() {
    // Si déjà détecté, retourner directement
    if (this.pythonPath) {
      return this.pythonPath;
    }

    const isWindows = process.platform === 'win32';
    const pythonCommands = [
      isWindows ? 'py' : 'python3',  // 'py' en premier sur Windows
      isWindows ? 'python' : 'python3',
      isWindows ? 'python.exe' : null
    ].filter(Boolean);

    for (const pyCmd of pythonCommands) {
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execPromise = promisify(exec);
        
        // Tester avec --version d'abord
        const result = await execPromise(`"${pyCmd}" --version`, { 
          timeout: 3000,
          shell: true,
          maxBuffer: 1024 * 1024
        });
        
        // Si on obtient une sortie (même en stderr), Python fonctionne
        if (result.stdout || result.stderr) {
          this.pythonPath = pyCmd;
          console.log(`✅ Python détecté: ${pyCmd}`);
          return pyCmd;
        }
      } catch (e) {
        // Continuer avec le prochain
        continue;
      }
    }
    
    const error = new Error('Python non trouvé. Installez Python 3.x');
    console.error('❌', error.message);
    throw error;
  }

  /**
   * Vérifie si Tabula est disponible
   */
  async checkTabula() {
    if (!this.pythonPath) {
      await this.detectPython();
    }
    
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execPromise = promisify(exec);
      
      const result = await execPromise(`"${this.pythonPath}" -c "import tabula; print('OK')"`, {
        timeout: 3000,
        shell: true
      });
      return result.stdout && result.stdout.includes('OK');
    } catch (e) {
      return false;
    }
  }

  /**
   * Vérifie si Camelot est disponible
   */
  async checkCamelot() {
    if (!this.pythonPath) {
      await this.detectPython();
    }
    
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execPromise = promisify(exec);
      
      const result = await execPromise(`"${this.pythonPath}" -c "import camelot; print('OK')"`, {
        timeout: 3000,
        shell: true
      });
      return result.stdout && result.stdout.includes('OK');
    } catch (e) {
      return false;
    }
  }

  /**
   * Exécute une commande Python directement (sans serveur)
   */
  async executePythonScript(script, timeout = 60000) {
    if (!this.pythonPath) {
      await this.detectPython();
    }

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execPromise = promisify(exec);

    // Créer un script temporaire
    const tempDir = path.join(__dirname, '../uploads/python-temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const scriptPath = path.join(tempDir, `script_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);
    fs.writeFileSync(scriptPath, script);

    try {
      console.log(`🐍 Exécution script Python: ${scriptPath}`);
      console.log(`⏱️ Timeout: ${timeout}ms`);
      
      const result = await execPromise(`"${this.pythonPath}" "${scriptPath}"`, {
        timeout: timeout,
        maxBuffer: 20 * 1024 * 1024, // Augmenter le buffer à 20MB
        shell: true
      });

      console.log(`✅ Script Python terminé:`, {
        stdoutLength: result.stdout?.length || 0,
        stderrLength: result.stderr?.length || 0
      });

      // Nettoyer le script
      try {
        if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
      } catch (e) {}

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        success: true
      };
    } catch (error) {
      console.error(`❌ Erreur exécution script Python:`, {
        message: error.message,
        code: error.code,
        signal: error.signal,
        stdout: error.stdout?.substring(0, 500),
        stderr: error.stderr?.substring(0, 500)
      });
      
      // Nettoyer le script en cas d'erreur
      try {
        if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
      } catch (e) {}

      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extrait avec Tabula
   */
  async extractWithTabula(pdfPath, outputPath) {
    const script = `
import tabula
import sys
import json
import os
import traceback

pdf_path = r'${pdfPath.replace(/\\/g, '\\\\')}'
output_path = r'${outputPath.replace(/\\/g, '\\\\')}'

try:
    # Vérifier que le fichier PDF existe
    if not os.path.exists(pdf_path):
        print(json.dumps({'success': False, 'error': f'Fichier PDF introuvable: {pdf_path}'}))
        sys.exit(1)
    
    # Essayer d'extraire les tableaux
    try:
        tables = tabula.read_pdf(pdf_path, pages='all', multiple_tables=True)
    except Exception as read_error:
        print(json.dumps({'success': False, 'error': f'Erreur lors de la lecture du PDF: {str(read_error)}', 'traceback': traceback.format_exc()}))
        sys.exit(1)
    
    if len(tables) == 0:
        print(json.dumps({'success': False, 'error': 'Aucun tableau trouvé dans le PDF'}))
        sys.exit(1)
    
    # Essayer d'exporter en Excel
    try:
        tables[0].to_excel(output_path, index=False)
        if os.path.exists(output_path):
            print(json.dumps({'success': True, 'tables': len(tables), 'method': 'excel_direct', 'output_file': output_path}))
        else:
            raise Exception('Fichier Excel non créé après export')
    except Exception as excel_error:
        # Fallback sur CSV
        try:
            csv_path = output_path.replace('.xlsx', '.csv')
            tables[0].to_csv(csv_path, index=False)
            if os.path.exists(csv_path):
                print(json.dumps({'success': True, 'tables': len(tables), 'method': 'csv', 'csv_path': csv_path}))
            else:
                raise Exception('Fichier CSV non créé après export')
        except Exception as csv_error:
            print(json.dumps({
                'success': False, 
                'error': f'Erreur export Excel: {str(excel_error)}, Erreur export CSV: {str(csv_error)}',
                'traceback': traceback.format_exc()
            }))
            sys.exit(1)
        
except Exception as e:
    print(json.dumps({
        'success': False, 
        'error': f'Erreur générale: {str(e)}',
        'traceback': traceback.format_exc()
    }))
    sys.exit(1)
`;

    return await this.executePythonScript(script, 120000); // Timeout de 2 minutes
  }

  /**
   * Extrait avec Camelot
   */
  async extractWithCamelot(pdfPath, outputPath) {
    const script = `
import camelot
import sys
import json
import os
import pandas as pd

pdf_path = r'${pdfPath.replace(/\\/g, '\\\\')}'
output_path = r'${outputPath.replace(/\\/g, '\\\\')}'

try:
    print("🔄 Démarrage extraction Camelot...", file=sys.stderr)
    sys.stderr.flush()
    
    method_used = 'lattice'
    tables = None
    
    print("🔄 Tentative extraction avec méthode 'lattice'...", file=sys.stderr)
    sys.stderr.flush()
    
    try:
        tables = camelot.read_pdf(pdf_path, flavor='lattice', pages='all')
        print(f"✅ Lattice: {len(tables) if tables else 0} tableau(x) trouvé(s)", file=sys.stderr)
        sys.stderr.flush()
    except Exception as e1:
        print(f"⚠️ Lattice échoué: {str(e1)}", file=sys.stderr)
        sys.stderr.flush()
        pass
    
    if not tables or len(tables) == 0:
        print("🔄 Tentative extraction avec méthode 'stream'...", file=sys.stderr)
        sys.stderr.flush()
        try:
            tables = camelot.read_pdf(pdf_path, flavor='stream', pages='all')
            method_used = 'stream'
            print(f"✅ Stream: {len(tables) if tables else 0} tableau(x) trouvé(s)", file=sys.stderr)
            sys.stderr.flush()
        except Exception as e2:
            error_msg = f'Lattice failed: {str(e1)}, Stream failed: {str(e2)}'
            print(json.dumps({'success': False, 'error': error_msg}))
            sys.exit(1)
    
    if len(tables) > 0:
        print(f"🔄 Traitement de {len(tables)} tableau(x)...", file=sys.stderr)
        sys.stderr.flush()
        
        all_data = []
        for i, table in enumerate(tables):
            df = table.df
            if i > 0:
                all_data.append([''] * len(df.columns))
            all_data.extend(df.values.tolist())
            if (i + 1) % 5 == 0:
                print(f"✅ {i + 1}/{len(tables)} tableau(x) traité(s)...", file=sys.stderr)
                sys.stderr.flush()
        
        if all_data:
            print(f"🔄 Export vers Excel ({len(all_data)} lignes)...", file=sys.stderr)
            sys.stderr.flush()
            
            combined_df = pd.DataFrame(all_data)
            combined_df.to_excel(output_path, index=False, header=False)
            
            result = {'success': True, 'tables': len(tables), 'method': method_used, 'rows': len(all_data)}
            print(json.dumps(result))
            print("✅ Extraction terminée avec succès", file=sys.stderr)
            sys.stderr.flush()
        else:
            print(json.dumps({'success': False, 'error': 'Aucune donnée extraite'}))
            sys.exit(1)
    else:
        print(json.dumps({'success': False, 'error': 'Aucun tableau trouvé'}))
        sys.exit(1)
except Exception as e:
    import traceback
    error_msg = f'Erreur: {str(e)}\\nTraceback: {traceback.format_exc()}'
    print(json.dumps({'success': False, 'error': error_msg}))
    print(f"❌ Erreur: {error_msg}", file=sys.stderr)
    sys.stderr.flush()
    sys.exit(1)
`;

    console.log('🔄 Démarrage extraction Camelot...');
    const result = await this.executePythonScript(script, 300000); // Timeout de 5 minutes
    console.log('✅ Extraction Camelot terminée, résultat:', {
      success: result.success,
      hasStdout: !!result.stdout,
      hasStderr: !!result.stderr
    });
    return result;
  }

  /**
   * Arrête le serveur (si utilisé)
   */
  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.isReady = false;
    }
  }
}

// Instance singleton
let serverInstance = null;

function getPythonServer() {
  if (!serverInstance) {
    serverInstance = new PythonExtractionServer();
  }
  return serverInstance;
}

module.exports = { PythonExtractionServer, getPythonServer };
