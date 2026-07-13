/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/loadingFeedback.js
 * RÔLE : Sablier / overlay de chargement + toast « enregistrement terminé ».
 *
 * ENTRÉES : show / hide / showSaveSuccess
 * SORTIES : DOM overlay
 *
 * DÉPEND DE : aucun
 * NE PAS : appels API
 *
 * APPELÉ PAR : apiCall.js, initGderpiApp.js, showStatus.js
 */
(function initGderpiLoadingFeedback(global) {
  'use strict';

  const SHOW_DELAY_MS = 280;
  const SAVE_TOAST_MS = 2200;

  let loadingCount = 0;
  let showTimer = null;
  let overlayVisible = false;
  let saveToastTimer = null;

  let overlayEl = null;
  let overlayMsgEl = null;
  let saveToastEl = null;
  let saveToastMsgEl = null;

  function ensureDom() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'gderpi-loading-overlay';
    overlayEl.className = 'gderpi-loading-overlay';
    overlayEl.setAttribute('hidden', '');
    overlayEl.setAttribute('aria-live', 'polite');
    overlayEl.setAttribute('aria-busy', 'true');
    overlayEl.innerHTML =
      '<div class="gderpi-loading-card" role="status">' +
        '<div class="gderpi-hourglass" aria-hidden="true">⏳</div>' +
        '<p class="gderpi-loading-message">Chargement…</p>' +
      '</div>';
    overlayMsgEl = overlayEl.querySelector('.gderpi-loading-message');

    saveToastEl = document.createElement('div');
    saveToastEl.id = 'gderpi-save-toast';
    saveToastEl.className = 'gderpi-save-toast';
    saveToastEl.setAttribute('hidden', '');
    saveToastEl.setAttribute('role', 'alert');
    saveToastEl.innerHTML =
      '<div class="gderpi-save-toast__card">' +
        '<span class="gderpi-save-toast__icon" aria-hidden="true">✓</span>' +
        '<span class="gderpi-save-toast__message">Enregistrement terminé</span>' +
      '</div>';
    saveToastMsgEl = saveToastEl.querySelector('.gderpi-save-toast__message');

    document.body.appendChild(overlayEl);
    document.body.appendChild(saveToastEl);
  }

  function setOverlayMessage(message) {
    ensureDom();
    if (overlayMsgEl) {
      overlayMsgEl.textContent = String(message || 'Chargement…').trim() || 'Chargement…';
    }
  }

  function revealOverlay() {
    ensureDom();
    overlayEl.removeAttribute('hidden');
    overlayVisible = true;
  }

  function hideOverlay() {
    if (!overlayEl || !overlayVisible) return;
    overlayEl.setAttribute('hidden', '');
    overlayVisible = false;
  }

  function clearShowTimer() {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
  }

  function showLoading(options) {
    const opts = options && typeof options === 'object' ? options : {};
    loadingCount += 1;
    setOverlayMessage(opts.message || 'Chargement…');

    if (opts.immediate) {
      clearShowTimer();
      revealOverlay();
      return;
    }

    if (loadingCount === 1 && !overlayVisible && !showTimer) {
      showTimer = setTimeout(() => {
        showTimer = null;
        if (loadingCount > 0) revealOverlay();
      }, SHOW_DELAY_MS);
    }
  }

  function hideLoading() {
    loadingCount = Math.max(0, loadingCount - 1);
    if (loadingCount > 0) return;

    clearShowTimer();
    hideOverlay();
  }

  function showSaveSuccess(message) {
    ensureDom();
    const text = String(message || 'Enregistrement terminé').trim() || 'Enregistrement terminé';
    if (saveToastMsgEl) saveToastMsgEl.textContent = text;

    saveToastEl.removeAttribute('hidden');
    saveToastEl.classList.remove('gderpi-save-toast--visible');
    void saveToastEl.offsetWidth;
    saveToastEl.classList.add('gderpi-save-toast--visible');

    if (saveToastTimer) clearTimeout(saveToastTimer);
    saveToastTimer = setTimeout(() => {
      saveToastEl.classList.remove('gderpi-save-toast--visible');
      saveToastTimer = setTimeout(() => {
        saveToastEl.setAttribute('hidden', '');
        saveToastTimer = null;
      }, 220);
    }, SAVE_TOAST_MS);
  }

  global.GderpiLoading = {
    show: showLoading,
    hide: hideLoading,
    showSaveSuccess
  };
})(window);
