/**
 * FICHIER : modules/gderpi/frontend/assets/js/configuration/bindClientServicesTab.js
 * RÔLE : Onglet services clients — vue LC dans Configuration.
 */
(function initGderpiBindClientServicesTab(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  let lcApi = null;
  let editingId = '';

  function fillForm(s) {
    const item = s || {};
    editingId = String(item.clientServiceId || '').trim();
    document.getElementById('gderpi-client-service-libelle').value = item.libelle || '';
    document.getElementById('gderpi-client-service-code').value = item.code || '';
    document.getElementById('gderpi-client-service-ordre').value = item.sortOrder ?? 0;
    document.getElementById('gderpi-client-service-actif').checked = item.actif !== false;
    const submit = document.getElementById('gderpi-client-service-submit');
    const title = document.getElementById('gderpi-client-service-form-title');
    if (submit) submit.textContent = editingId ? 'Enregistrer' : 'Créer le service';
    if (title) title.textContent = editingId ? 'Modifier le service' : 'Nouveau service';
  }

  function resetForm() {
    const form = document.getElementById('gderpi-client-service-form');
    if (form) form.reset();
    document.getElementById('gderpi-client-service-ordre').value = '0';
    document.getElementById('gderpi-client-service-actif').checked = true;
    editingId = '';
    fillForm({});
  }

  function getPayload() {
    return {
      libelle: document.getElementById('gderpi-client-service-libelle').value.trim(),
      code: document.getElementById('gderpi-client-service-code').value.trim(),
      sortOrder: Number(document.getElementById('gderpi-client-service-ordre').value) || 0,
      actif: document.getElementById('gderpi-client-service-actif').checked
    };
  }

  async function loadRows(q) {
    const actifOnly = document.getElementById('gderpi-client-service-filter-actif')?.checked;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (actifOnly) params.set('actifOnly', '1');
    const path = '/client-services' + (params.toString() ? '?' + params.toString() : '');
    const res = await global.GderpiApi.apiCall(path);
    return res.data || [];
  }

  function renderRows(tbody, items, api) {
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Aucun service.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map((s) => {
      const st = s.actif !== false
        ? '<span class="gderpi-badge" style="background:#d1fae5;color:#065f46">Actif</span>'
        : '<span class="gderpi-badge">Inactif</span>';
      return '<tr data-gderpi-lc-row data-id="' + esc(s.clientServiceId) + '">' +
        '<td>' + esc(s.libelle) + '</td><td><code>' + esc(s.code) + '</code></td>' +
        '<td>' + esc(s.sortOrder) + '</td><td>' + st + '</td>' +
        '<td class="text-nowrap" onclick="event.stopPropagation()">' +
        '<button type="button" class="btn btn-outline-danger btn-sm gderpi-client-service-del" data-id="' + esc(s.clientServiceId) + '">Désact.</button></td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-gderpi-lc-row]').forEach((tr) => {
      tr.addEventListener('dblclick', async () => {
        const id = tr.getAttribute('data-id');
        const res = await global.GderpiApi.apiCall('/client-services/' + encodeURIComponent(id));
        fillForm(res.data);
        api.openCreate();
      });
    });
    tbody.querySelectorAll('.gderpi-client-service-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id || !window.confirm('Désactiver ce service ?')) return;
        await global.GderpiApi.apiCall('/client-services/' + encodeURIComponent(id), { method: 'DELETE' });
        global.GderpiStatus.showStatus('Service désactivé.', 'success');
        global.GderpiClientServices.invalidateClientServicesCache();
        if (editingId === id) { resetForm(); api.closeCreate(); }
        await api.refresh();
      });
    });
  }

  function bindClientServicesTab() {
    const root = document.querySelector('[data-gderpi-vue-lc="client-services"]');
    const form = document.getElementById('gderpi-client-service-form');
    const btnCancel = document.getElementById('gderpi-client-service-cancel');
    if (!root) return;
    if (btnCancel) btnCancel.addEventListener('click', () => { resetForm(); lcApi?.closeCreate(); });

    lcApi = global.GderpiVueLc.bindVueLc({
      key: 'client-services',
      root,
      loadRows,
      renderRows,
      extraFilterEls: [document.getElementById('gderpi-client-service-filter-actif')],
      onCreateOpen: () => { if (!editingId) resetForm(); },
      onCreateClose: () => { resetForm(); }
    });

    if (form) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const payload = getPayload();
        if (editingId) {
          await global.GderpiApi.apiCall('/client-services/' + encodeURIComponent(editingId), {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
          global.GderpiStatus.showStatus('Service mis à jour.', 'success');
        } else {
          await global.GderpiApi.apiCall('/client-services', { method: 'POST', body: JSON.stringify(payload) });
          global.GderpiStatus.showStatus('Service créé.', 'success');
        }
        global.GderpiClientServices.invalidateClientServicesCache();
        resetForm();
        lcApi.closeCreate();
        await lcApi.refresh();
      });
    }
  }

  global.GderpiClientServicesTab = {
    bindClientServicesTab,
    refreshClientServicesList: () => lcApi?.refresh()
  };
})(window);
