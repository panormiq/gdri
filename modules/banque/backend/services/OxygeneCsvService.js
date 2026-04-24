class OxygeneCsvService {
  static normalizeAmount(value) {
    const num = Number(String(value ?? '0').replace(',', '.'));
    if (!Number.isFinite(num)) return '0.00';
    return num.toFixed(2);
  }

  static escapeLabel(value) {
    const label = String(value || '').replace(/\s+/g, ' ').trim();
    return `"${label.replace(/"/g, '""')}"`;
  }

  static toCsv(operations) {
    const rows = Array.isArray(operations) ? operations : [];
    const header = 'Date operation;Date Valeur;Libelle operation;Montant debit;Montant credit';
    const body = rows.map(row => {
      const dateOperation = String(row.date_operation || '').trim();
      const dateValeur = String(row.date_valeur || '').trim();
      const libelle = this.escapeLabel(row.libelle_operation || '');
      const debit = ` ${this.normalizeAmount(row.montant_debit)} `;
      const credit = ` ${this.normalizeAmount(row.montant_credit)} `;
      return `${dateOperation};${dateValeur};${libelle};${debit};${credit}`;
    });
    return [header, ...body].join('\n');
  }
}

module.exports = OxygeneCsvService;
