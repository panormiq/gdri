/**
 * FICHIER : modules/banque/backend/services/parsing/parseOperationBlock.js
 * RÔLE : Transforme un bloc texte de relevé en opération structurée
 *        { date_operation, date_valeur, libelle_operation, montant_debit, montant_credit }.
 *
 * DÉPEND DE : cleanOperationBlock, normalizeDateToken, normalizeAmount,
 *             normalizeSpaces, normalizeDateWithYear, isCreditLabel, isDebitLabel
 * APPELÉ PAR : extractOperationsFromPdfBuffer
 */

const cleanOperationBlock = require('./cleanOperationBlock');
const normalizeDateToken = require('./normalizeDateToken');
const normalizeAmount = require('./normalizeAmount');
const normalizeSpaces = require('./normalizeSpaces');
const normalizeDateWithYear = require('./normalizeDateWithYear');
const isCreditLabel = require('./isCreditLabel');
const isDebitLabel = require('./isDebitLabel');

function parseOperationBlock(rawBlock, statementYear) {
  const flat = cleanOperationBlock(rawBlock);
  const head = flat.match(/^(\d{2}[./-]\d{2})\s+(\d{2}[./-]\d{2})\s+(.+)$/);
  if (!head) return null;

  let dateOperation = normalizeDateToken(head[1]);
  let dateValeur = normalizeDateToken(head[2]);
  if (!dateOperation || !dateValeur) return null;

  const labelAndAmount = head[3];
  // Bornes strictes pour eviter les collisions du type "3 120,23".
  const amounts = [...labelAndAmount.matchAll(/(?<!\d)(\d{1,3}(?:[ .]\d{3})*,\d{2})(?!\d)/g)].map(m => m[1]);
  if (!amounts.length) return null;

  const pickedAmount = amounts[amounts.length - 1];
  const amountNormalized = normalizeAmount(pickedAmount);
  if (!amountNormalized) return null;

  const amountRegex = new RegExp(`${pickedAmount.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
  const label = normalizeSpaces(labelAndAmount.replace(amountRegex, '').replace(/[¨]+$/g, '').trim());
  if (!label) return null;

  const hasDebitAndCreditColumns = amounts.length >= 2;
  let debit = '0.00';
  let credit = '0.00';

  if (hasDebitAndCreditColumns) {
    debit = normalizeAmount(amounts[0]) || '0.00';
    credit = normalizeAmount(amounts[1]) || '0.00';
  } else {
    // Releve CA: une seule valeur visible -> on deduit debit/credit via le libelle.
    if (isCreditLabel(label) && !isDebitLabel(label)) {
      credit = amountNormalized;
    } else {
      debit = amountNormalized;
    }
  }

  dateOperation = normalizeDateWithYear(dateOperation, statementYear);
  dateValeur = normalizeDateWithYear(dateValeur, statementYear);

  return {
    date_operation: dateOperation,
    date_valeur: dateValeur,
    libelle_operation: label,
    montant_debit: debit,
    montant_credit: credit
  };
}

module.exports = parseOperationBlock;
