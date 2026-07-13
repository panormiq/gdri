/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/formatMoney.js
 * RÔLE : Formate un montant en euros (fr-FR).
 */

(function initGderpiFormatMoney(global) {
  'use strict';

  function formatMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0,00 €';
    return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }

  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-FR');
  }

  global.GderpiFormat = { formatMoney, formatDate };
})(window);
