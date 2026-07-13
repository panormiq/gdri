/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/escapeHtml.js
 * RÔLE : Échappe le HTML pour affichage sûr.
 *
 * ENTRÉES : valeur quelconque
 * SORTIES : string échappée
 *
 * DÉPEND DE : aucun
 * NE PAS : appels API
 *
 * APPELÉ PAR : render* GDERPI
 */
(function initGderpiEscapeHtml(global) {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  global.GderpiEscape = { escapeHtml };
})(window);
