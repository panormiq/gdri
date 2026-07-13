/**
 * FICHIER : modules/gderpi/backend/services/pdf/escapeHtmlText.js
 * RÔLE : Échappe le texte pour inclusion dans un document HTML.
 *
 * ENTRÉES : valeur quelconque
 * SORTIES : string échappée
 *
 * DÉPEND DE : —
 * NE PAS : formatage monétaire, dates
 *
 * APPELÉ PAR : renderDevisHtml.js
 */

function escapeHtmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = escapeHtmlText;
