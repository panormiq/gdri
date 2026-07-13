/**
 * FICHIER : modules/gderpi/frontend/assets/js/configuration/bindUnitesTab.js
 * RÔLE : Onglet unités — vue LC dans Configuration.
 */
(function initGderpiBindUnitesTab(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  let lcApi = null;
  let editingId = '';

  function fillForm(u) {
    const item = u || {};
    editingId = String(item.uniteId || '').trim();
    document.getElementById('gderpi-unite-libelle').value = item.libelle || '';
    document.getElementById('gderpi-unite-code').value = item.code || '';
    document.getElementById('gderpi-unite-ordre').value = item.sortOrder ?? 0;
    document.getElementById('gderpi-unite-actif').checked = item.actif !== false;
    const submit = document.getElementById('gderpi-unite-submit');
    const title = document.getElementById('gderpi-unite-form-title');
    if (submit) submit.textContent = editingId ? 'Enregistrer' : 'Créer l\'unité';
    if (title) title.textContent = editingId ? 'Modifier l\'unité' : 'Nouvelle unité';
  }

  function resetForm() {
    const form = document.getElementById('gderpi-unite-form');
    if (form) form.reset();
    document.getElementById('gderpi-unite-ordre').value = '0';
    document.getElementById('gderpi-unite-actif').checked = true;
    editingId = '';
    fillForm({});
  }

  function getPayload() {
    return {
      libelle: document.getElementById('gderpi-unite-libelle').value.trim(),
      code: document.getElementById('gderpi-unite-code').value.trim(),
      sortOrder: Number(document.getElementById('gderpi-unite-ordre').value) || 0,
      actif: document.getElementById('gderpi-unite-actif').checked
    };
  }

  async function loadRows(q) {
    const actifOnly = document.getElementById('gderpi-unite-filter-actif')?.checked;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (actifOnly) params.set('actifOnly', '1');
    const path = '/unites' + (params.toString() ? '?' + params.toString() : '');
    const res = await global.GderpiApi.apiCall(path);
    return res.data || [];
  }

  function renderRows(tbody, items, api) {
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Aucune unité.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map((u) => {
      const st = u.actif !== false
        ? '<span class="gderpi-badge" style="background:#d1fae5;color:#065f46">Active</span>'
        : '<span class="gderpi-badge">Inactive</span>';
      return '<tr data-gderpi-lc-row data-id="' + esc(u.uniteId) + '">' +
        '<td>' + esc(u.libelle) + '</td><td><code>' + esc(u.code) + '</code></td>' +
        '<td>' + esc(u.sortOrder) + '</td><td>' + st + '</td>' +
        '<td class="text-nowrap" onclick="event.stopPropagation()">' +
        '<button type="button" class="btn btn-outline-danger btn-sm gderpi-unite-del" data-id="' + esc(u.uniteId) + '">Désact.</button></td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-gderpi-lc-row]').forEach((tr) => {
      tr.addEventListener('dblclick', async () => {
        const id = tr.getAttribute('data-id');
        const res = await global.GderpiApi.apiCall('/unites/' + encodeURIComponent(id));
        fillForm(res.data);
        api.openCreate();
      });
    });
    tbody.querySelectorAll('.gderpi-unite-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id || !window.confirm('Désactiver cette unité ?')) return;
        await global.GderpiApi.apiCall('/unites/' + encodeURIComponent(id), { method: 'DELETE' });
        global.GderpiStatus.showStatus('Unité désactivée.', 'success');
        global.GderpiUnites.invalidateUnitesCache();
        if (editingId === id) { resetForm(); api.closeCreate(); }
        await api.refresh();
      });
    });
  }

  function bindUnitesTab() {
    const root = document.querySelector('[data-gderpi-vue-lc="unites"]');
    const form = document.getElementById('gderpi-unite-form');
    const btnCancel = document.getElementById('gderpi-unite-cancel');
    if (!root) return;
    if (btnCancel) btnCancel.addEventListener('click', () => { resetForm(); lcApi?.closeCreate(); });

    lcApi = global.GderpiVueLc.bindVueLc({
      key: 'unites',
      root,
      loadRows,
      renderRows,
      extraFilterEls: [document.getElementById('gderpi-unite-filter-actif')],
      onCreateOpen: () => { if (!editingId) resetForm(); },
      onCreateClose: () => { resetForm(); }
    });

    if (form) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const payload = getPayload();
        if (editingId) {
          await global.GderpiApi.apiCall('/unites/' + encodeURIComponent(editingId), { method: 'PUT', body: JSON.stringify(payload) });
          global.GderpiStatus.showStatus('Unité mise à jour.', 'success');
        } else {
          await global.GderpiApi.apiCall('/unites', { method: 'POST', body: JSON.stringify(payload) });
          global.GderpiStatus.showStatus('Unité créée.', 'success');
        }
        global.GderpiUnites.invalidateUnitesCache();
        resetForm();
        lcApi.closeCreate();
        await lcApi.refresh();
      });
    }
  }

  global.GderpiUnitesTab = {
    bindUnitesTab,
    refreshUnitesList: () => lcApi?.refresh()
  };
})(window);
