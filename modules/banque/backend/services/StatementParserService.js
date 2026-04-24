const pdfParseLib = require('pdf-parse');
const pdfParse = typeof pdfParseLib === 'function'
  ? pdfParseLib
  : (pdfParseLib.default || pdfParseLib.pdfParse);

class StatementParserService {
  static normalizeSpaces(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  static normalizeDateToken(token) {
    const match = String(token || '').match(/^(\d{2})[./-](\d{2})(?:[./-](\d{2,4}))?$/);
    if (!match) return null;
    const day = match[1];
    const month = match[2];
    let year = match[3] || '';
    if (!year) return `${day}/${month}`;
    if (year.length === 2) year = `20${year}`;
    return `${day}/${month}/${year}`;
  }

  static normalizeAmount(raw) {
    let source = String(raw || '').trim();

    // Cas OCR observé: "3 120,23" au lieu de "120,23" (le "3" vient du "20/03").
    // On supprime ce prefixe parasite pour éviter 3120.23.
    if (/^\d\s\d{3},\d{2}$/.test(source)) {
      source = source.replace(/^\d\s/, '');
    }

    const cleaned = source
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');
    const num = Number(cleaned);
    if (!Number.isFinite(num)) return null;
    return num.toFixed(2);
  }

  static normalizeDateWithYear(dateNoYear, statementYear) {
    const m = String(dateNoYear || '').match(/^(\d{2})\/(\d{2})$/);
    if (!m) return dateNoYear;
    return `${m[1]}/${m[2]}/${statementYear}`;
  }

  static detectStatementYear(lines) {
    for (const line of lines) {
      const m = line.match(/Date d[' ]arr[êe]t[ée]\s*:\s*.*?(\d{4})/i);
      if (m) return m[1];
    }
    return String(new Date().getFullYear());
  }

  static isCreditLabel(label) {
    const text = String(label || '').toLowerCase();
    if (/virement\s+frais/i.test(text)) return false;
    if (/remise|versement|virement\s+recu|virement\s+reçu|virement\s+ebay|virement/i.test(text)) return true;
    return false;
  }

  static isDebitLabel(label) {
    const text = String(label || '').toLowerCase();
    if (/^carte\b|^prlv\b|^cheque\b|^ch[eè]que\b|cotisation|frais|commission|delivengo|trade\s+/i.test(text)) return true;
    return false;
  }

  static parseOperationBlock(rawBlock, statementYear) {
    const flat = this.cleanOperationBlock(rawBlock);
    const head = flat.match(/^(\d{2}[./-]\d{2})\s+(\d{2}[./-]\d{2})\s+(.+)$/);
    if (!head) return null;

    let dateOperation = this.normalizeDateToken(head[1]);
    let dateValeur = this.normalizeDateToken(head[2]);
    if (!dateOperation || !dateValeur) return null;

    const labelAndAmount = head[3];
    // Bornes strictes pour eviter les collisions du type "3 120,23".
    const amounts = [...labelAndAmount.matchAll(/(?<!\d)(\d{1,3}(?:[ .]\d{3})*,\d{2})(?!\d)/g)].map(m => m[1]);
    if (!amounts.length) return null;

    const pickedAmount = amounts[amounts.length - 1];
    const amountNormalized = this.normalizeAmount(pickedAmount);
    if (!amountNormalized) return null;

    const amountRegex = new RegExp(`${pickedAmount.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    const label = this.normalizeSpaces(labelAndAmount.replace(amountRegex, '').replace(/[¨]+$/g, '').trim());
    if (!label) return null;

    const hasDebitAndCreditColumns = amounts.length >= 2;
    let debit = '0.00';
    let credit = '0.00';

    if (hasDebitAndCreditColumns) {
      debit = this.normalizeAmount(amounts[0]) || '0.00';
      credit = this.normalizeAmount(amounts[1]) || '0.00';
    } else {
      // Releve CA: une seule valeur visible -> on deduit debit/credit via le libelle.
      if (this.isCreditLabel(label) && !this.isDebitLabel(label)) {
        credit = amountNormalized;
      } else {
        debit = amountNormalized;
      }
    }

    dateOperation = this.normalizeDateWithYear(dateOperation, statementYear);
    dateValeur = this.normalizeDateWithYear(dateValeur, statementYear);

    return {
      date_operation: dateOperation,
      date_valeur: dateValeur,
      libelle_operation: label,
      montant_debit: debit,
      montant_credit: credit
    };
  }

  static cleanOperationBlock(rawBlock) {
    let flat = this.normalizeSpaces(rawBlock);

    // Couper les artefacts de pagination/entete qui polluent parfois la fin d'une ligne.
    const cutMarkers = [
      /\bop[ée]\.\s*date\b/i,
      /\bRELEVE DE COMPTES EN EUROS\b/i,
      /\bDate d[' ]arr[êe]t[ée]\b/i,
      /\(suite\)/i,
      /\bPage\s+\d+\b/i
    ];

    for (const marker of cutMarkers) {
      const match = flat.match(marker);
      if (match && typeof match.index === 'number') {
        flat = flat.slice(0, match.index).trim();
      }
    }

    // Nettoyage ponctuel de symboles bruit.
    flat = flat.replace(/[þ¨]+/g, ' ');
    return this.normalizeSpaces(flat);
  }

  static async extractOperationsFromPdfBuffer(buffer) {
    if (!buffer || !buffer.length) {
      throw new Error('Fichier PDF vide');
    }
    let extractedText = '';
    if (typeof pdfParse === 'function') {
      const data = await pdfParse(buffer);
      extractedText = String(data?.text || '');
    } else if (pdfParseLib && typeof pdfParseLib.PDFParse === 'function') {
      const parser = new pdfParseLib.PDFParse({ data: buffer });
      const result = await parser.getText({});
      extractedText = String(result?.text || '');
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
    } else {
      throw new Error('pdf-parse indisponible: export non compatible');
    }

    const lines = extractedText
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line => this.normalizeSpaces(line))
      .filter(Boolean);

    const statementYear = this.detectStatementYear(lines);
    const blocks = [];
    let currentBlock = [];
    const startPattern = /^(\d{2}[./-]\d{2})\s+(\d{2}[./-]\d{2})\s+/;

    for (const line of lines) {
      // Ignorer les lignes de structure du releve
      if (
        /^date$/i.test(line) ||
        /^op[ée]\.?$/i.test(line) ||
        /^valeur\b/i.test(line) ||
        /^libell[ée]\b/i.test(line) ||
        /^d[ée]bit\b/i.test(line) ||
        /^cr[ée]dit\b/i.test(line) ||
        /^page\s+\d+/i.test(line) ||
        /^--\s+\d+\s+of\s+\d+\s+--$/i.test(line)
      ) {
        continue;
      }

      if (/^total des op[eé]rations/i.test(line) || /^nouveau solde/i.test(line)) {
        if (currentBlock.length) {
          blocks.push(currentBlock.join(' '));
          currentBlock = [];
        }
        break;
      }

      if (startPattern.test(line)) {
        if (currentBlock.length) {
          blocks.push(currentBlock.join(' '));
        }
        currentBlock = [line];
      } else if (currentBlock.length) {
        currentBlock.push(line);
      }
    }

    if (currentBlock.length) blocks.push(currentBlock.join(' '));

    const operations = blocks
      .map(block => this.parseOperationBlock(block, statementYear))
      .filter(Boolean);

    return {
      operations,
      metadata: {
        linesCount: lines.length,
        blocksCount: blocks.length,
        parsedCount: operations.length
      }
    };
  }
}

module.exports = StatementParserService;
