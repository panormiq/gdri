/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/bindServiceSelectField.js
 * RÔLE : Select service + bouton + (création rapide via modale).
 */
(function initGderpiBindServiceSelectField(global) {
  'use strict';

  let quickModal = null;
  let pendingSelectId = '';

  function ensureQuickModal() {
    if (quickModal) return quickModal;
    const el = document.getElementById('gderpi-service-quick-modal');
    if (!el || !global.GderpiModal) return null;
    quickModal = global.GderpiModal.enhance(el, { title: 'Nouveau service', size: 'sm' });
    return quickModal;
  }

  function resetQuickForm() {
    const form = document.getElementById('gderpi-service-quick-form');
    form?.reset();
  }

  async function openQuickAdd(selectId) {
    if (!global.GDERPI_CONFIG?.canWrite) {
      global.GderpiStatus.showStatus('Droits insuffisants pour créer un service.', 'warning');
      return;
    }
    pendingSelectId = String(selectId || '').trim();
    resetQuickForm();
    ensureQuickModal()?.open();
  }

  async function saveQuickService(event) {
    event?.preventDefault?.();
    const libelle = document.getElementById('gderpi-service-quick-libelle')?.value?.trim() || '';
    if (!libelle) {
      global.GderpiStatus.showStatus('Indiquez un libellé de service.', 'warning');
      return;
    }
    const res = await global.GderpiApi.apiCall('/client-services', {
      method: 'POST',
      body: JSON.stringify({ libelle })
    });
    global.GderpiClientServices.invalidateClientServicesCache();
    const created = res.data;
    const select = document.getElementById(pendingSelectId);
    if (select) {
      await global.GderpiClientServices.populateServiceSelect(select, created?.libelle || libelle, { force: true });
    }
    quickModal?.close();
    pendingSelectId = '';
    global.GderpiClientServicesTab?.refreshClientServicesList?.();
    global.GderpiStatus.showStatus('Service créé.', 'success');
  }

  function bindServicePicker(selectId, addBtnId) {
    const addBtn = document.getElementById(addBtnId);
    if (addBtn && !addBtn.dataset.gderpiServiceBound) {
      addBtn.dataset.gderpiServiceBound = '1';
      addBtn.addEventListener('click', () => openQuickAdd(selectId));
    }
  }

  function bindServiceQuickModal() {
    const form = document.getElementById('gderpi-service-quick-form');
    if (form && !form.dataset.gderpiServiceBound) {
      form.dataset.gderpiServiceBound = '1';
      form.addEventListener('submit', (e) => saveQuickService(e).catch((err) => {
        global.GderpiStatus.showStatus(err.message || 'Erreur création service', 'danger');
      }));
    }
    document.getElementById('gderpi-service-quick-cancel')?.addEventListener('click', () => {
      quickModal?.close();
      pendingSelectId = '';
    });
  }

  global.GderpiServiceSelect = {
    bindServicePicker,
    bindServiceQuickModal,
    populateServiceSelect: (selectEl, selected, options) =>
      global.GderpiClientServices.populateServiceSelect(selectEl, selected, options)
  };
})(window);
