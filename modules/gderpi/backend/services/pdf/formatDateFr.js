/**
 * FICHIER : modules/gderpi/backend/services/pdf/formatDateFr.js
 * RÔLE : Formate une date ISO en affichage français.
 *
 * ENTRÉES : Date | string ISO
 * SORTIES : string « jj/mm/aaaa » ou vide
 *
 * DÉPEND DE : —
 * NE PAS : échappement HTML
 *
 * APPELÉ PAR : renderDevisHtml.js
 */

function formatDateFr(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

module.exports = formatDateFr;
