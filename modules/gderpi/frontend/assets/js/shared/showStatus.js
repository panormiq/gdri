/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/showStatus.js
 * RÔLE : Affiche un message de statut global GDERPI.
 *
 * ENTRÉES : message, type alert Bootstrap
 * SORTIES : DOM mis à jour
 *
 * DÉPEND DE : #gderpi-status, GderpiLoading
 * NE PAS : appels API
 *
 * APPELÉ PAR : tous les onglets
 */
(function initGderpiShowStatus(global) {
  'use strict';

  const SAVE_SUCCESS_RE = /enregistr|créé|crée|mise à jour|mis à jour|ajouté|supprimé|désactivé/i;

  function isSaveSuccessMessage(message) {
    const text = String(message || '').trim();
    if (!text || text === 'GDERPI prêt.') return false;
    return SAVE_SUCCESS_RE.test(text);
  }

  function showStatus(message, type, action) {
    const el = document.getElementById('gderpi-status');
    if (!el) return;
    el.className = 'alert alert-' + (type || 'secondary') + ' gderpi-status-inline';
    el.textContent = '';
    el.appendChild(document.createTextNode(message || ''));

    if (action && action.label && typeof action.onClick === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-outline btn-sm gderpi-status-action';
      btn.textContent = action.label;
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        action.onClick();
      });
      el.appendChild(document.createTextNode(' '));
      el.appendChild(btn);
    }

    if (type === 'success' && isSaveSuccessMessage(message)) {
      global.GderpiLoading?.showSaveSuccess?.(message);
    }
  }

  function showSaveSuccess(message) {
    showStatus(message || 'Enregistrement terminé.', 'success');
  }

  global.GderpiStatus = { showStatus, showSaveSuccess };
})(window);
