/**
 * Service d'extraction et de correspondance PDF UGAP
 * Fichier : modules/ugap/backend/services/UgapPdfService.js
 */

const pdfParse = require('pdf-parse');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

class UgapPdfService {
  static normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  static async extractLinesFromPdf(buffer) {
    if (!buffer || !buffer.length) {
      throw new Error('Fichier PDF vide');
    }

    const data = await pdfParse(buffer);
    const text = String(data.text || '').replace(/\r/g, '\n');
    const lines = text
      .split('\n')
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    return lines;
  }

  static resolvePdftoppmPath() {
    const isWin = process.platform === 'win32';
    const exeName = isWin ? 'pdftoppm.exe' : 'pdftoppm';

    // 1) If POPPLER_PATH env var set and points to exe or folder
    const envPath = process.env.POPPLER_PATH;
    if (envPath) {
      const candidate = envPath.toString().endsWith(exeName) ? envPath.toString() : path.join(envPath.toString(), exeName);
      if (fs.existsSync(candidate)) return candidate;
    }

    // 2) Search PATH environment variable entries
    const envPathVar = process.env.Path || process.env.PATH || '';
    const pathEntries = envPathVar.split(path.delimiter).filter(Boolean);
    for (const entry of pathEntries) {
      try {
        const candidate = path.join(entry, exeName);
        if (fs.existsSync(candidate)) return candidate;
      } catch (e) {
        // ignore malformed PATH entries
      }
    }

    // 3) Common installation locations on Windows (search subfolders)
    if (isWin) {
      const rootCandidates = [
        'C:\\poppler',
        'C:\\Program Files\\poppler',
        'C:\\Program Files (x86)\\poppler'
      ];
      for (const root of rootCandidates) {
        try {
          if (!fs.existsSync(root)) continue;
          const subs = fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
          for (const sub of subs) {
            const candidate = path.join(root, sub, 'Library', 'bin', exeName);
            if (fs.existsSync(candidate)) return candidate;
          }
          // also try root/bin
          const candidateRootBin = path.join(root, 'bin', exeName);
          if (fs.existsSync(candidateRootBin)) return candidateRootBin;
        } catch (e) {
          // ignore permission errors
        }
      }
    }

    // 4) As a last resort, return exe name and rely on system PATH resolution (may still fail)
    return exeName;
  }

  static async renderFirstPageToPng(pdfPath, outputDir) {
    if (!pdfPath) {
      throw new Error('Chemin PDF manquant');
    }
    const targetDir = outputDir || path.join(__dirname, '../uploads/pdf-images');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const outputPrefix = path.join(
      targetDir,
      `pdf_${Date.now()}_${Math.floor(Math.random() * 10000)}`
    );
    const pdftoppmPath = this.resolvePdftoppmPath();

    await new Promise((resolve, reject) => {
      execFile(
        pdftoppmPath,
        ['-f', '1', '-l', '1', '-png', '-r', '150', pdfPath, outputPrefix],
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }
          resolve();
        }
      );
    });

    const outputFile = `${outputPrefix}-1.png`;
    if (!fs.existsSync(outputFile)) {
      throw new Error('Image PDF non générée');
    }

    const imageBuffer = await fs.promises.readFile(outputFile);
    return {
      imagePath: outputFile,
      imageBase64: imageBuffer.toString('base64')
    };
  }

  static matchLinesToOptions(lines, options) {
    const normalizedOptions = options
      .map(option => ({
        id: option.id,
        name: option.name || '',
        normalized: this.normalizeText(option.name)
      }))
      .filter(option => option.normalized.length > 0);

    const matches = [];
    const matchedOptionIds = new Set();
    const unmatchedLines = [];

    lines.forEach(line => {
      const normalizedLine = this.normalizeText(line);
      if (!normalizedLine) return;

      const optionIds = [];

      normalizedOptions.forEach(option => {
        const optionText = option.normalized;
        const minLength = 6;

        if (optionText.length >= minLength && normalizedLine.includes(optionText)) {
          optionIds.push(option.id);
          return;
        }

        if (normalizedLine.length >= minLength && optionText.includes(normalizedLine)) {
          optionIds.push(option.id);
        }
      });

      if (optionIds.length > 0) {
        optionIds.forEach(id => matchedOptionIds.add(id));
        matches.push({
          line,
          optionIds
        });
      } else {
        unmatchedLines.push(line);
      }
    });

    return {
      matches,
      matchedOptionIds: Array.from(matchedOptionIds),
      unmatchedLines
    };
  }

  static isSectionTitle(line, nextLine, nextNextLine) {
    if (!line) return false;
    const hasDigits = /\d/.test(line);
    if (hasDigits) return false;
    const wordCount = line.split(' ').filter(Boolean).length;
    const longTitle = line.length >= 20 || wordCount >= 3;
    const nextHasDigits = /\d/.test(nextLine || '') || /\d/.test(nextNextLine || '');
    return longTitle || nextHasDigits;
  }

  static isValueLine(line) {
    if (!line) return false;
    if (/\d/.test(line)) return true;
    if (/classe|division|cat[eé]gorie/i.test(line)) return true;
    return false;
  }

  static buildStructuredSections(lines) {
    const sections = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (!this.isSectionTitle(line, lines[i + 1], lines[i + 2])) {
        i += 1;
        continue;
      }

      const titleLines = [line];
      i += 1;
      while (i < lines.length) {
        const candidate = lines[i];
        if (this.isSectionTitle(candidate, lines[i + 1], lines[i + 2]) && !this.isValueLine(candidate)) {
          titleLines.push(candidate);
          i += 1;
          continue;
        }
        break;
      }

      const title = titleLines.join(' ');
      const labels = [];
      const values = [];

      while (i < lines.length && !this.isSectionTitle(lines[i], lines[i + 1], lines[i + 2])) {
        const current = lines[i];
        if (this.isValueLine(current)) {
          values.push(current);
        } else if (values.length > 0) {
          values.push(current);
        } else {
          labels.push(current);
        }
        i += 1;
      }

      const fields = [];
      if (labels.length > 0 && values.length >= labels.length) {
        labels.forEach((label, idx) => {
          fields.push({ label, value: values[idx] || '' });
        });
        if (values.length > labels.length) {
          values.slice(labels.length).forEach(value => {
            fields.push({ label: '', value });
          });
        }
      } else if (values.length > 0) {
        values.forEach(value => fields.push({ label: '', value }));
      } else if (labels.length > 0) {
        labels.forEach(label => fields.push({ label, value: '' }));
      }

      sections.push({
        title,
        fields,
        raw: {
          labels,
          values
        }
      });
    }

    return sections;
  }
}

module.exports = UgapPdfService;
