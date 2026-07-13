/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/loadArticleUnites.js
 * RÔLE : Charge les unités actives pour les listes déroulantes articles.
 */
(function initGderpiLoadArticleUnites(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  let cache = [];

  async function fetchUnites(force) {
    if (cache.length && !force) return cache;
    const res = await global.GderpiApi.apiCall('/unites?actifOnly=1');
    cache = res.data || [];
    return cache;
  }

  async function populateUniteSelect(selectEl, selectedCode, force) {
    if (!selectEl) return;
    const units = await fetchUnites(force);
    const selected = String(selectedCode || '').trim().toLowerCase();
    let html = '<option value="">— Sélectionner —</option>';
    units.forEach((u) => {
      html += '<option value="' + esc(u.code) + '">' + esc(u.libelle) + '</option>';
    });
    if (selected && !units.some((u) => String(u.code || '').toLowerCase() === selected)) {
      html += '<option value="' + esc(selectedCode) + '">' + esc(selectedCode) + '</option>';
    }
    selectEl.innerHTML = html;
    if (selected) {
      const match = units.find((u) => String(u.code || '').toLowerCase() === selected);
      selectEl.value = match ? match.code : selectedCode;
    }
  }

  function invalidateUnitesCache() {
    cache = [];
  }

  global.GderpiUnites = {
    fetchUnites,
    populateUniteSelect,
    invalidateUnitesCache
  };
})(window);
