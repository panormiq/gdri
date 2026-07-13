/**
 * FICHIER : modules/gderpi/frontend/assets/js/boutiques/bindBoutiquesTab.js
 * RÔLE : Onglet boutiques — vue LC liste + création.
 */

(function initGderpiBindBoutiquesTab(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  let lcApi = null;
  let editingId = '';
  let contactSeq = 0;
  let contactsState = [];
  let editingContactKey = '';
  let contactModal = null;
  let selectedBoutiqueId = '';
  let annuaireState = { annuaireInstalled: false };
  let currentAnnuaireOrgId = '';
  const CONTACT_SCOPE = 'interne';

  function useAnnuaireContactApi() {
    return global.GderpiAnnuaireBridge?.usesAnnuaireContactApi(
      annuaireState.annuaireInstalled,
      editingId,
      currentAnnuaireOrgId
    ) === true;
  }

  async function reloadBoutiqueContacts() {
    if (!editingId) return;
    const res = await global.GderpiApi.apiCall('/boutiques/' + encodeURIComponent(editingId));
    setContactsState(buildContactsFromItem(res.data));
    return res.data;
  }

  function updateAnnuaireUi(item) {
    currentAnnuaireOrgId = item?.annuaireOrganisationId || '';
    global.GderpiAnnuaireBridge?.renderAnnuaireNotice(
      document.getElementById('gderpi-boutique-annuaire-notice'),
      item,
      annuaireState.annuaireInstalled,
      editingId
    );
  }

  function contactDisplayName(c) {
    return [c.prenom, c.nom].filter(Boolean).join(' ').trim() || '—';
  }

  function contactRowKey(c, idx) {
    return c.id || c._key || ('bt-' + idx);
  }

  function normalizeContactsState(list) {
    return (Array.isArray(list) ? list : []).map((c, i) => ({
      id: c.id || c.contactId || '',
      prenom: c.prenom || '',
      nom: c.nom || '',
      fonction: c.fonction || '',
      email: c.email || '',
      telephone: c.telephone || '',
      principal: c.principal === true,
      _key: c.id || c._key || ('bt-' + (++contactSeq) + '-' + i)
    }));
  }

  function setContactsState(list) {
    contactsState = normalizeContactsState(list);
    if (contactsState.length && !contactsState.some((c) => c.principal)) {
      contactsState[0] = { ...contactsState[0], principal: true };
    }
    renderContactsTable();
  }

  function renderContactsTable() {
    const tbody = document.getElementById('gderpi-boutique-contacts-tbody');
    if (!tbody) return;
    if (!contactsState.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Aucun contact. Cliquez sur + Contact.</td></tr>';
      return;
    }
    tbody.innerHTML = contactsState.map((c, idx) => {
      const key = contactRowKey(c, idx);
      const star = c.principal
        ? '<span class="gderpi-client-contact-principal is-active" title="Contact principal">★</span>'
        : '<button type="button" class="btn btn-link btn-sm gderpi-boutique-contact-principal" data-key="' + esc(key) + '" title="Définir principal">☆</button>';
      const del = '<button type="button" class="btn btn-outline-danger btn-sm gderpi-boutique-contact-del" data-key="' + esc(key) + '">Suppr.</button>';
      return '<tr data-gderpi-boutique-contact-row data-key="' + esc(key) + '">' +
        '<td>' + star + '</td>' +
        '<td>' + esc(contactDisplayName(c)) + '</td>' +
        '<td>' + esc(c.fonction || '—') + '</td>' +
        '<td>' + esc(c.email || '—') + '</td>' +
        '<td>' + esc(c.telephone || '—') + '</td>' +
        '<td>' + del + '</td></tr>';
    }).join('');
    tbody.querySelectorAll('[data-gderpi-boutique-contact-row]').forEach((row) => {
      row.addEventListener('dblclick', () => openContactModal(row.getAttribute('data-key')));
    });
    tbody.querySelectorAll('.gderpi-boutique-contact-del').forEach((btn) => {
      btn.addEventListener('click', () => deleteContact(btn.getAttribute('data-key')));
    });
    tbody.querySelectorAll('.gderpi-boutique-contact-principal').forEach((btn) => {
      btn.addEventListener('click', () => setPrincipalContact(btn.getAttribute('data-key')));
    });
  }

  function collectContacts() {
    return contactsState.map((c) => ({
      id: c.id || undefined,
      prenom: c.prenom || '',
      nom: c.nom || '',
      fonction: c.fonction || '',
      email: c.email || '',
      telephone: c.telephone || '',
      principal: c.principal === true
    }));
  }

  function buildContactsFromItem(item) {
    const list = Array.isArray(item.contacts) ? item.contacts.filter(Boolean) : [];
    if (list.length) return list;
    if (item.email || item.telephone) {
      return [{
        nom: 'Contact',
        email: item.email || '',
        telephone: item.telephone || '',
        principal: true
      }];
    }
    return [];
  }

  function ensureContactModal() {
    if (contactModal) return contactModal;
    const el = document.getElementById('gderpi-boutique-contact-modal');
    if (!el || !global.GderpiModal) return null;
    contactModal = global.GderpiModal.enhance(el, { title: 'Contact', size: 'md', stacked: true });
    return contactModal;
  }

  function openContactModal(key) {
    const modal = ensureContactModal();
    if (!modal) {
      global.GderpiStatus.showStatus('Formulaire contact indisponible.', 'danger');
      return;
    }
    editingContactKey = key ? String(key) : '';
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v || '';
    };
    if (!editingContactKey) {
      setVal('gderpi-boutique-contact-prenom', '');
      setVal('gderpi-boutique-contact-nom', '');
      setVal('gderpi-boutique-contact-fonction', '');
      setVal('gderpi-boutique-contact-email', '');
      setVal('gderpi-boutique-contact-tel', '');
      const principal = document.getElementById('gderpi-boutique-contact-principal');
      if (principal) principal.checked = !contactsState.length;
      const title = document.getElementById('gderpi-boutique-contact-modal-title');
      if (title) title.textContent = 'Nouveau contact';
    } else {
      const idx = contactsState.findIndex((c, i) => contactRowKey(c, i) === editingContactKey);
      const c = idx >= 0 ? contactsState[idx] : null;
      if (!c) return;
      setVal('gderpi-boutique-contact-prenom', c.prenom);
      setVal('gderpi-boutique-contact-nom', c.nom);
      setVal('gderpi-boutique-contact-fonction', c.fonction);
      setVal('gderpi-boutique-contact-email', c.email);
      setVal('gderpi-boutique-contact-tel', c.telephone);
      const principal = document.getElementById('gderpi-boutique-contact-principal');
      if (principal) principal.checked = c.principal === true;
      const title = document.getElementById('gderpi-boutique-contact-modal-title');
      if (title) title.textContent = 'Modifier le contact';
    }
    modal.open();
  }

  async function saveContactFromModal(ev) {
    if (ev) ev.preventDefault();
    const val = (id) => document.getElementById(id)?.value?.trim() || '';
    const saved = {
      prenom: val('gderpi-boutique-contact-prenom'),
      nom: val('gderpi-boutique-contact-nom'),
      fonction: val('gderpi-boutique-contact-fonction'),
      email: val('gderpi-boutique-contact-email'),
      telephone: val('gderpi-boutique-contact-tel'),
      principal: document.getElementById('gderpi-boutique-contact-principal')?.checked === true
    };
    if (!saved.prenom && !saved.nom && !saved.email && !saved.telephone) {
      global.GderpiStatus.showStatus('Renseignez au moins un nom ou un moyen de contact.', 'warning');
      return;
    }

    if (useAnnuaireContactApi()) {
      try {
        await global.GderpiAnnuaireContactUi.persistContact({
          organisationId: currentAnnuaireOrgId,
          scope: CONTACT_SCOPE,
          draft: saved,
          editingRowKey: editingContactKey,
          contactsState: contactsState,
          contactRowKey: contactRowKey
        });
        await reloadBoutiqueContacts();
        contactModal?.close();
        editingContactKey = '';
        global.GderpiStatus.showStatus('Contact enregistré (Annuaire).', 'success');
      } catch (err) {
        global.GderpiStatus.showStatus(err?.message || 'Erreur', 'danger');
      }
      return;
    }

    let list = contactsState.map((c) => ({ ...c }));
    let savedKey = editingContactKey;
    if (editingContactKey) {
      const idx = list.findIndex((c, i) => contactRowKey(c, i) === editingContactKey);
      if (idx >= 0) list[idx] = { ...list[idx], ...saved };
    } else {
      savedKey = 'bt-' + (++contactSeq);
      list.push({ ...saved, _key: savedKey });
    }
    if (saved.principal) {
      list = list.map((c, i) => ({
        ...c,
        principal: contactRowKey(c, i) === savedKey
      }));
    }
    setContactsState(list);
    contactModal?.close();
    editingContactKey = '';
  }

  async function deleteContact(key) {
    if (!window.confirm('Supprimer ce contact ?')) return;
    if (useAnnuaireContactApi()) {
      try {
        await global.GderpiAnnuaireContactUi.removeContact({
          rowKey: key,
          contactsState: contactsState,
          contactRowKey: contactRowKey
        });
        await reloadBoutiqueContacts();
        global.GderpiStatus.showStatus('Contact supprimé (Annuaire).', 'success');
      } catch (err) {
        global.GderpiStatus.showStatus(err?.message || 'Erreur', 'danger');
      }
      return;
    }
    const list = contactsState.filter((c, i) => contactRowKey(c, i) !== String(key));
    setContactsState(list);
  }

  async function setPrincipalContact(key) {
    if (useAnnuaireContactApi()) {
      try {
        await global.GderpiAnnuaireContactUi.markPrincipal({
          rowKey: key,
          contactsState: contactsState,
          contactRowKey: contactRowKey
        });
        await reloadBoutiqueContacts();
      } catch (err) {
        global.GderpiStatus.showStatus(err?.message || 'Erreur', 'danger');
      }
      return;
    }
    setContactsState(contactsState.map((c, i) => ({
      ...c,
      principal: contactRowKey(c, i) === String(key)
    })));
  }

  function getPayload() {
    const payload = {
      nom: document.getElementById('gderpi-boutique-nom').value.trim(),
      actif: document.getElementById('gderpi-boutique-actif').checked,
      isPrincipale: document.getElementById('gderpi-boutique-principale').checked,
      raisonSociale: document.getElementById('gderpi-boutique-rs').value.trim(),
      siret: document.getElementById('gderpi-boutique-siret').value.trim(),
      tvaIntracommunautaire: document.getElementById('gderpi-boutique-tva').value.trim(),
      rcs: document.getElementById('gderpi-boutique-rcs').value.trim(),
      capital: document.getElementById('gderpi-boutique-capital').value.trim(),
      formeJuridique: document.getElementById('gderpi-boutique-forme').value.trim(),
      devise: document.getElementById('gderpi-boutique-devise').value || 'EUR',
      adresse: document.getElementById('gderpi-boutique-adresse').value.trim(),
      codePostal: document.getElementById('gderpi-boutique-cp').value.trim(),
      ville: document.getElementById('gderpi-boutique-ville').value.trim(),
      pays: document.getElementById('gderpi-boutique-pays').value.trim(),
      email: document.getElementById('gderpi-boutique-email').value.trim(),
      telephone: document.getElementById('gderpi-boutique-tel').value.trim(),
      siteWeb: document.getElementById('gderpi-boutique-web').value.trim(),
      logoUrl: global.GderpiImages.getImageValue(
        document.getElementById('gderpi-boutique-logo'),
        document.getElementById('gderpi-boutique-logo-url')
      ),
      piedDePage: document.getElementById('gderpi-boutique-pied').value.trim(),
      validiteDevisJours: Number(document.getElementById('gderpi-boutique-validite').value) || 30
    };
    if (!editingId) payload.contacts = collectContacts();
    return payload;
  }

  function fillForm(b) {
    const item = b || {};
    editingId = String(item.boutiqueId || '').trim();
    document.getElementById('gderpi-boutique-nom').value = item.nom || '';
    document.getElementById('gderpi-boutique-actif').checked = item.actif !== false;
    const principaleEl = document.getElementById('gderpi-boutique-principale');
    if (principaleEl) principaleEl.checked = item.isPrincipale === true;
    document.getElementById('gderpi-boutique-rs').value = item.raisonSociale || '';
    document.getElementById('gderpi-boutique-siret').value = item.siret || '';
    document.getElementById('gderpi-boutique-tva').value = item.tvaIntracommunautaire || '';
    document.getElementById('gderpi-boutique-rcs').value = item.rcs || '';
    document.getElementById('gderpi-boutique-capital').value = item.capital || '';
    document.getElementById('gderpi-boutique-forme').value = item.formeJuridique || '';
    document.getElementById('gderpi-boutique-devise').value = item.devise || 'EUR';
    document.getElementById('gderpi-boutique-adresse').value = item.adresse || '';
    document.getElementById('gderpi-boutique-cp').value = item.codePostal || '';
    document.getElementById('gderpi-boutique-ville').value = item.ville || '';
    document.getElementById('gderpi-boutique-pays').value = item.pays || 'France';
    document.getElementById('gderpi-boutique-email').value = item.email || '';
    document.getElementById('gderpi-boutique-tel').value = item.telephone || '';
    document.getElementById('gderpi-boutique-web').value = item.siteWeb || '';
    document.getElementById('gderpi-boutique-pied').value = item.piedDePage || '';
    document.getElementById('gderpi-boutique-validite').value = item.validiteDevisJours || 30;
    global.GderpiImages.setImageValue(
      document.getElementById('gderpi-boutique-logo'),
      document.getElementById('gderpi-boutique-logo-url'),
      item.logoUrl || ''
    );
    global.GderpiImages.setImagePreview(
      document.getElementById('gderpi-boutique-logo-preview'),
      item.logoUrl || ''
    );
    const logoFn = document.getElementById('gderpi-boutique-logo-filename');
    if (logoFn) {
      const logoPath = String(item.logoUrl || '');
      if (/^https?:\/\//i.test(logoPath)) {
        logoFn.textContent = '';
        logoFn.classList.add('is-empty');
      } else {
        logoFn.textContent = logoPath ? logoPath.split('/').pop() : '';
        logoFn.classList.toggle('is-empty', !logoFn.textContent);
      }
    }
    const submit = document.getElementById('gderpi-boutique-submit');
    const title = document.getElementById('gderpi-boutique-form-title');
    if (submit) submit.textContent = editingId ? 'Enregistrer' : 'Créer la boutique';
    if (title) title.textContent = editingId ? 'Modifier la boutique' : 'Nouvelle boutique';
    setContactsState(buildContactsFromItem(item));
    updateAnnuaireUi(item);
  }

  function resetForm() {
    const form = document.getElementById('gderpi-boutique-form');
    if (form) form.reset();
    document.getElementById('gderpi-boutique-pays').value = 'France';
    document.getElementById('gderpi-boutique-validite').value = '30';
    document.getElementById('gderpi-boutique-actif').checked = true;
    const principaleEl = document.getElementById('gderpi-boutique-principale');
    if (principaleEl) principaleEl.checked = false;
    editingId = '';
    currentAnnuaireOrgId = '';
    global.GderpiImages.setImagePreview(document.getElementById('gderpi-boutique-logo-preview'), '');
    const logoFn = document.getElementById('gderpi-boutique-logo-filename');
    if (logoFn) { logoFn.textContent = ''; logoFn.classList.add('is-empty'); }
    setContactsState([]);
    fillForm({});
  }

  async function loadRows(q) {
    const actifOnly = document.getElementById('gderpi-boutique-filter-actif')?.checked;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (actifOnly) params.set('actifOnly', '1');
    const path = '/boutiques' + (params.toString() ? '?' + params.toString() : '');
    const res = await global.GderpiApi.apiCall(path);
    return res.data || [];
  }

  function setSelectedBoutiqueId(id) {
    selectedBoutiqueId = String(id || '').trim();
    document.querySelectorAll('[data-gderpi-lc-tbody="boutiques"] [data-gderpi-lc-row]').forEach((tr) => {
      tr.classList.toggle('gderpi-lc-row--selected', tr.getAttribute('data-id') === selectedBoutiqueId);
    });
    global.GderpiBoutiqueConfig?.syncCgvSelect?.(selectedBoutiqueId);
  }

  function getSelectedBoutiqueId() {
    return selectedBoutiqueId;
  }

  function renderRows(tbody, items, api) {
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Aucune boutique.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map((b) => {
      const id = String(b.boutiqueId || '').trim();
      const rowClass = id === selectedBoutiqueId ? ' class="gderpi-lc-row--selected"' : '';
      const st = b.actif !== false ? '<span class="gderpi-badge" style="background:#d1fae5;color:#065f46">Active</span>' : '<span class="gderpi-badge">Inactive</span>';
      const primary = b.isPrincipale ? ' <span class="gderpi-badge" style="background:#dbeafe;color:#1d4ed8" title="Boutique principale">Principale</span>' : '';
      return '<tr data-gderpi-lc-row data-id="' + esc(id) + '"' + rowClass + '>' +
        '<td>' + esc(b.nom) + primary + '</td><td>' + esc(b.raisonSociale || '—') + '</td>' +
        '<td>' + esc(b.ville || '—') + '</td><td>' + st + '</td>' +
        '<td class="text-nowrap" onclick="event.stopPropagation()">' +
        '<button type="button" class="btn btn-outline-danger btn-sm gderpi-boutique-del" data-id="' + esc(id) + '">Désact.</button></td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-gderpi-lc-row]').forEach((tr) => {
      tr.addEventListener('click', () => {
        setSelectedBoutiqueId(tr.getAttribute('data-id'));
      });
      tr.addEventListener('dblclick', async (ev) => {
        ev.preventDefault();
        const id = tr.getAttribute('data-id');
        const res = await global.GderpiApi.apiCall('/boutiques/' + encodeURIComponent(id));
        fillForm(res.data);
        api.openCreate();
      });
    });
    tbody.querySelectorAll('.gderpi-boutique-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id || !window.confirm('Désactiver cette boutique ?')) return;
        await global.GderpiApi.apiCall('/boutiques/' + encodeURIComponent(id), { method: 'DELETE' });
        global.GderpiStatus.showStatus('Boutique désactivée.', 'success');
        if (editingId === id) { resetForm(); api.closeCreate(); }
        if (selectedBoutiqueId === id) setSelectedBoutiqueId('');
        await api.refresh();
        global.GderpiDashboardTab?.refreshDashboard?.();
      });
    });
  }

  function bindBoutiquesTab() {
    global.GderpiApi.apiCall('/integrations/annuaire/status')
      .then((res) => { annuaireState = res.data || annuaireState; })
      .catch(() => {});

    const root = document.querySelector('[data-gderpi-vue-lc="boutiques"]');
    const form = document.getElementById('gderpi-boutique-form');
    const btnCancel = document.getElementById('gderpi-boutique-cancel');
    if (btnCancel) btnCancel.addEventListener('click', () => { resetForm(); lcApi?.closeCreate(); });

    global.GderpiImages.bindImageUploadField({
      fileInputId: 'gderpi-boutique-logo-file',
      storageInputId: 'gderpi-boutique-logo',
      externalUrlInputId: 'gderpi-boutique-logo-url',
      previewId: 'gderpi-boutique-logo-preview',
      clearBtnId: 'gderpi-boutique-logo-clear',
      scope: 'boutique-logo'
    });

    ensureContactModal();
    const contactAddBtn = document.getElementById('gderpi-boutique-contact-add');
    if (contactAddBtn && !contactAddBtn.dataset.gderpiContactBound) {
      contactAddBtn.dataset.gderpiContactBound = '1';
      contactAddBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openContactModal('');
      });
    }
    document.getElementById('gderpi-boutique-contact-form')?.addEventListener('submit', saveContactFromModal);
    document.getElementById('gderpi-boutique-contact-cancel')?.addEventListener('click', () => contactModal?.close());

    lcApi = global.GderpiVueLc.bindVueLc({
      key: 'boutiques',
      root,
      loadRows,
      renderRows,
      modalSize: 'xl',
      extraFilterEls: [document.getElementById('gderpi-boutique-filter-actif')],
      onCreateOpen: () => {
        ensureContactModal();
        if (!editingId) resetForm();
      },
      onCreateClose: () => { resetForm(); }
    });

    if (form) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const payload = getPayload();
        if (editingId) {
          await global.GderpiApi.apiCall('/boutiques/' + encodeURIComponent(editingId), { method: 'PUT', body: JSON.stringify(payload) });
          global.GderpiStatus.showStatus('Boutique mise à jour.', 'success');
        } else {
          await global.GderpiApi.apiCall('/boutiques', { method: 'POST', body: JSON.stringify(payload) });
          global.GderpiStatus.showStatus('Boutique créée.', 'success');
        }
        resetForm();
        lcApi.closeCreate();
        await lcApi.refresh();
        global.GderpiDashboardTab?.refreshDashboard?.();
      });
    }
  }

  global.GderpiBoutiquesTab = {
    bindBoutiquesTab,
    getSelectedBoutiqueId,
    setSelectedBoutiqueId,
    refreshBoutiquesList: () => lcApi?.refresh()
  };
})(window);
