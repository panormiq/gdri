/**
 * FICHIER : modules/banque/backend/services/parsing/extractOperationsFromPdfBuffer.js
 * RÔLE : Extrait les opérations bancaires d'un buffer PDF de relevé.
 *
 * ENTRÉES : buffer PDF (upload multer)
 * SORTIES : { operations: [...], metadata: { linesCount, blocksCount, parsedCount } }
 *
 * DÉPEND DE : pdf-parse, normalizeSpaces, detectStatementYear, parseOperationBlock
 * APPELÉ PAR : controllers/banqueController.js (extract)
 */

const pdfParseLib = require('pdf-parse');
const normalizeSpaces = require('./normalizeSpaces');
const detectStatementYear = require('./detectStatementYear');
const parseOperationBlock = require('./parseOperationBlock');

const pdfParse = typeof pdfParseLib === 'function'
  ? pdfParseLib
  : (pdfParseLib.default || pdfParseLib.pdfParse);

async function extractOperationsFromPdfBuffer(buffer) {
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
    .map(line => normalizeSpaces(line))
    .filter(Boolean);

  const statementYear = detectStatementYear(lines);
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
    .map(block => parseOperationBlock(block, statementYear))
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

module.exports = extractOperationsFromPdfBuffer;
