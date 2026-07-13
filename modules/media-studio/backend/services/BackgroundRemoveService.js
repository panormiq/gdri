/**
 * Détourage IA via rembg (Python) — U2-Net, fonctionne sur damier, blanc, photo…
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

class BackgroundRemoveService {
  constructor(config = {}) {
    this.python = config.python || process.env.REMBG_PYTHON || this.resolvePython();
    this.model = config.model || 'u2net';
    this.timeoutMs = config.timeoutMs || 120000;
    this.scriptPath = path.join(__dirname, '../scripts/rembg_remove.py');
  }

  resolvePython() {
    if (process.platform === 'win32') {
      return process.env.REMBG_PYTHON || 'py';
    }
    return 'python3';
  }

  async checkAvailable() {
    if (!fs.existsSync(this.scriptPath)) return false;
    try {
      await execFileAsync(this.python, ['-c', 'import rembg'], {
        timeout: 15000,
        windowsHide: true,
      });
      return true;
    } catch {
      return false;
    }
  }

  async removeBackground(inputBuffer) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdri-rembg-'));
    const inPath = path.join(tmpDir, 'in.png');
    const outPath = path.join(tmpDir, 'out.png');
    try {
      fs.writeFileSync(inPath, inputBuffer);
      await execFileAsync(
        this.python,
        [this.scriptPath, inPath, outPath, this.model],
        {
          timeout: this.timeoutMs,
          maxBuffer: 24 * 1024 * 1024,
          windowsHide: true,
        }
      );
      if (!fs.existsSync(outPath)) {
        throw new Error('rembg n\'a produit aucune image.');
      }
      return fs.readFileSync(outPath);
    } finally {
      try { fs.unlinkSync(inPath); } catch { /* ignore */ }
      try { fs.unlinkSync(outPath); } catch { /* ignore */ }
      try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
    }
  }
}

module.exports = BackgroundRemoveService;
