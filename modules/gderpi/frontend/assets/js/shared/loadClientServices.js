/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/loadClientServices.js
 * RÔLE : Charge les services clients actifs pour les listes déroulantes.
 */
(function initGderpiLoadClientServices(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const SANS_SERVICE = 'Sans service';
  let cache = [];

  async function fetchClientServices(force) {
    if (cache.length && !force) return cache;
    const res = await global.GderpiApi.apiCall('/client-services?actifOnly=1');
    cache = res.data || [];
    return cache;
  }

  function sortServiceLabels(labels) {
    return [...labels].sort((a, b) => {
      if (a === SANS_SERVICE) return 1;
      if (b === SANS_SERVICE) return -1;
      return a.localeCompare(b, 'fr');
    });
  }

  function buildServiceLabels(services, extraLabels) {
    const set = new Set((services || []).map((s) => String(s.libelle || '').trim()).filter(Boolean));
    (extraLabels || []).forEach((label) => {
      const v = String(label || '').trim();
      if (v) set.add(v);
    });
    return sortServiceLabels(set);
  }

  async function populateServiceSelect(selectEl, selectedLibelle, options) {
    if (!selectEl) return;
    const opts = options && typeof options === 'object' ? options : {};
    const services = await fetchClientServices(opts.force);
    const selected = String(selectedLibelle || '').trim();
    const labels = buildServiceLabels(services, opts.extraLabels);
    const placeholder = opts.placeholder || '— Service —';
    let html = '<option value="">' + esc(placeholder) + '</option>';
    labels.forEach((label) => {
      html += '<option value="' + esc(label) + '">' + esc(label) + '</option>';
    });
    selectEl.innerHTML = html;
    if (selected) {
      if (!labels.includes(selected)) {
        selectEl.insertAdjacentHTML('beforeend',
          '<option value="' + esc(selected) + '">' + esc(selected) + ' (hors liste)</option>');
      }
      selectEl.value = selected;
    }
  }

  function invalidateClientServicesCache() {
    cache = [];
  }

  global.GderpiClientServices = {
    SANS_SERVICE,
    fetchClientServices,
    buildServiceLabels,
    populateServiceSelect,
    invalidateClientServicesCache
  };
})(window);
