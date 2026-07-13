/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/bindVueLc.js
 * RÔLE : Pattern vue LC (liste + panneau création) inspiré UGAP — version GDERPI.
 *
 * ENTRÉES : config { key, root, createBtn, createPanel, searchInput, tableBody, loadRows, renderRows }
 * SORTIES : API refresh + toggle création
 *
 * DÉPEND DE : GderpiEscape
 * NE PAS : logique métier entités
 *
 * APPELÉ PAR : bind*BoutiquesTab, bindArticlesTab, etc.
 */
(function initGderpiBindVueLc(global) {
  'use strict';

  function bindVueLc(config) {
    const key = String(config.key || '').trim();
    const root = config.root;
    if (!key || !root) return null;

    const createBtn = config.createBtn || root.querySelector('[data-gderpi-lc-create="' + key + '"]');
    const createPanel = config.createPanel || root.querySelector('[data-gderpi-lc-create-panel="' + key + '"]');
    const searchInput = config.searchInput || root.querySelector('[data-gderpi-lc-search="' + key + '"]');
    const countEl = root.querySelector('[data-gderpi-lc-count="' + key + '"]');
    const tableBody = config.tableBody || root.querySelector('[data-gderpi-lc-tbody="' + key + '"]');

    let modalApi = null;

    function ensureModal() {
      if (!createPanel || modalApi) return modalApi;
      modalApi = global.GderpiModal?.enhance(createPanel, {
        size: config.modalSize || 'lg',
        onOpen: () => {
          if (createBtn) createBtn.setAttribute('aria-expanded', 'true');
          if (typeof config.onCreateOpen === 'function') config.onCreateOpen();
        },
        onClose: () => {
          if (createBtn) createBtn.setAttribute('aria-expanded', 'false');
          if (typeof config.onCreateClose === 'function') config.onCreateClose();
        }
      });
      return modalApi;
    }

    function setCreateOpen(open) {
      if (!createPanel || !createBtn) return;
      const modal = ensureModal();
      if (!modal) {
        if (open) {
          createPanel.removeAttribute('hidden');
          createBtn.setAttribute('aria-expanded', 'true');
          if (typeof config.onCreateOpen === 'function') config.onCreateOpen();
        } else {
          createPanel.setAttribute('hidden', '');
          createBtn.setAttribute('aria-expanded', 'false');
          if (typeof config.onCreateClose === 'function') config.onCreateClose();
        }
        return;
      }
      if (open) modal.open();
      else modal.close();
    }

    if (createBtn && createPanel && !createBtn.dataset.gderpiLcBound) {
      createBtn.dataset.gderpiLcBound = '1';
      createBtn.addEventListener('click', () => {
        const isHidden = createPanel.hasAttribute('hidden');
        setCreateOpen(isHidden);
      });
    }

    if (searchInput && !searchInput.dataset.gderpiLcBound) {
      searchInput.dataset.gderpiLcBound = '1';
      let timer = null;
      searchInput.addEventListener('input', () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => api.refresh(), 180);
      });
    }

    const extraFilters = Array.isArray(config.extraFilterEls) ? config.extraFilterEls : [];
    extraFilters.forEach((el) => {
      if (!el || el.dataset.gderpiLcBound) return;
      el.dataset.gderpiLcBound = '1';
      el.addEventListener('change', () => api.refresh());
      el.addEventListener('click', () => api.refresh());
    });

    async function refresh() {
      if (!tableBody || typeof config.loadRows !== 'function') return;
      const q = searchInput ? String(searchInput.value || '').trim() : '';
      const rows = await config.loadRows(q);
      if (countEl) {
        countEl.textContent = rows.length + ' élément(s)';
      }
      if (typeof config.renderRows === 'function') {
        config.renderRows(tableBody, rows, api);
      }
    }

    const api = {
      key,
      root,
      refresh,
      openCreate: () => setCreateOpen(true),
      closeCreate: () => setCreateOpen(false),
      getSearch: () => (searchInput ? searchInput.value : '')
    };

    return api;
  }

  global.GderpiVueLc = { bindVueLc };
})(window);
