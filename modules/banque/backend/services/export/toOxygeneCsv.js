/**
 * FICHIER : modules/banque/backend/services/export/toOxygeneCsv.js
 * RÔLE : Convertit une liste d'opérations en CSV importable dans Oxygène (séparateur ";").
 *
 * ENTRÉES : tableau d'opérations { date_operation, date_valeur, libelle_operation, montant_debit, montant_credit }
 * SORTIES : chaîne CSV avec en-tête
 *
 * APPELÉ PAR : controllers/banqueController.js (extract preview + export-csv)
 */

const normalizeCsvAmount = require('./normalizeCsvAmount');
const escapeCsvLabel = require('./escapeCsvLabel');

function toOxygeneCsv(operations) {
  const rows = Array.isArray(operations) ? operations : [];
  const header = 'Date operation;Date Valeur;Libelle operation;Montant debit;Montant credit';
  const body = rows.map(row => {
    const dateOperation = String(row.date_operation || '').trim();
    const dateValeur = String(row.date_valeur || '').trim();
    const libelle = escapeCsvLabel(row.libelle_operation || '');
    const debit = ` ${normalizeCsvAmount(row.montant_debit)} `;
    const credit = ` ${normalizeCsvAmount(row.montant_credit)} `;
    return `${dateOperation};${dateValeur};${libelle};${debit};${credit}`;
  });
  return [header, ...body].join('\n');
}

module.exports = toOxygeneCsv;
