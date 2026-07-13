/**
 * FICHIER : modules/gderpi/frontend/assets/js/fournisseurs/bindFournisseursTab.js
 * RÔLE : Onglet fournisseurs — vue LC liste + création (contacts, adresses).
 */

(function initGderpiBindFournisseursTab(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const ADDRESS_TYPES = [
    { value: 'generique', label: 'Générique' },
    { value: 'facturation', label: 'Facturation' },
    { value: 'livraison', label: 'Livraison' },
    { value: 'siege', label: 'Siège' },
    { value: 'autre', label: 'Autre' }
  ];

  let lcApi = null;
  let editingId = '';
  let contactSeq = 0;
  let adresseSeq = 0;
  let formFillGeneration = 0;
  let contactsState = [];
  let adressesState = [];
  let editingContactKey = '';
  let editingAdresseKey = '';
  let contactModal = null;
  let adresseModal = null;
  let isFournisseurFormSubmitting = false;
  let annuaireState = { annuaireInstalled: false };
  let currentAnnuaireOrgId = '';
  const CONTACT_SCOPE = 'externe';
  const canWrite = () => global.GDERPI_CONFIG?.canWrite === true;

  function useAnnuaireContactApi() {
    return global.GderpiAnnuaireBridge?.usesAnnuaireContactApi(
      annuaireState.annuaireInstalled,
      editingId,
      currentAnnuaireOrgId
    ) === true;
  }

  async function reloadFournisseurContacts() {
    if (!editingId) return;
    const res = await global.GderpiApi.apiCall('/fournisseurs/' + encodeURIComponent(editingId));
    setContactsState(buildContactsFromItem(res.data));
    return res.data;
  }

  function updateAnnuaireUi(item) {
    currentAnnuaireOrgId = item?.annuaireOrganisationId || '';
    global.GderpiAnnuaireBridge?.renderAnnuaireNotice(
      document.getElementById('gderpi-fournisseur-annuaire-notice'),
      item,
      annuaireState.annuaireInstalled,
      editingId
    );
  }

  function handleErr(err) {
    global.GderpiStatus.showStatus(err?.message || 'Erreur', 'danger');
  }

  function setFournisseurFormSubmitting(active) {
    isFournisseurFormSubmitting = active;
    const submit = document.getElementById('gderpi-fournisseur-submit');
    const cancel = document.getElementById('gderpi-fournisseur-cancel');
    if (submit) {
      submit.disabled = active;
      submit.setAttribute('aria-busy', active ? 'true' : 'false');
    }
    if (cancel) cancel.disabled = active;
  }

  function val(id) {
    return document.getElementById(id)?.value?.trim() || '';
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
  }

  function fillFournisseurPaiementFields(item) {
    const opts = global.GderpiDevisPaiementOptions;
    if (!opts) return;
    opts.fillSelect(
      document.getElementById('gderpi-fournisseur-paiement-moyen'),
      opts.MOYENS,
      item?.conditionsPaiementMoyen
    );
    opts.fillSelect(
      document.getElementById('gderpi-fournisseur-paiement-echeance'),
      opts.ECHEANCES,
      item?.conditionsPaiementEcheance
    );
    setVal('gderpi-fournisseur-paiement-complement', item?.conditionsPaiementComplement || '');
  }

  function getFournisseurPaiementFromDom() {
    return {
      conditionsPaiementMoyen: val('gderpi-fournisseur-paiement-moyen'),
      conditionsPaiementEcheance: val('gderpi-fournisseur-paiement-echeance'),
      conditionsPaiementComplement: val('gderpi-fournisseur-paiement-complement')
    };
  }

  function addressTypeOptions(selected) {
    const sel = String(selected || 'generique').trim();
    return ADDRESS_TYPES.map((t) =>
      '<option value="' + esc(t.value) + '"' + (t.value === sel ? ' selected' : '') + '>' + esc(t.label) + '</option>'
    ).join('');
  }

  function addressTypeLabel(value) {
    const match = ADDRESS_TYPES.find((t) => t.value === value);
    return match ? match.label : value || '—';
  }

  function contactDisplayName(c) {
    return [c.prenom, c.nom].filter(Boolean).join(' ').trim() || '—';
  }

  function contactRowKey(c, idx) {
    return String(c.id || c._key || ('ct-' + idx));
  }

  function adresseRowKey(a, idx) {
    return String(a.id || a._key || ('ad-' + idx));
  }

  function normalizeContactsState(list) {
    return (Array.isArray(list) ? list : []).map((c, i) => ({
      ...c,
      _key: c.id || c._key || ('ct-' + (++contactSeq) + '-' + i)
    }));
  }

  function normalizeAdressesState(list) {
    return (Array.isArray(list) ? list : []).map((a, i) => ({
      ...a,
      _key: a.id || a._key || ('ad-' + (++adresseSeq) + '-' + i)
    }));
  }

  function setContactsState(list) {
    contactsState = normalizeContactsState(list);
    if (contactsState.length && !contactsState.some((c) => c.principal)) {
      contactsState[0] = { ...contactsState[0], principal: true };
    }
    renderContactsTable();
  }

  function setAdressesState(list) {
    adressesState = normalizeAdressesState(list);
    renderAdressesTable();
  }

  function renderContactsTable() {
    const tbody = document.getElementById('gderpi-fournisseur-contacts-tbody');
    if (!tbody) return;
    if (!contactsState.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Aucun contact. Cliquez sur + Contact.</td></tr>';
      return;
    }
    tbody.innerHTML = contactsState.map((c, idx) => {
      const key = contactRowKey(c, idx);
      const principal = c.principal
        ? '<span class="gderpi-client-sublist__star" title="Contact principal">★</span>'
        : (canWrite()
          ? '<button type="button" class="btn btn-link btn-sm gderpi-fournisseur-contact-principal" data-key="' + esc(key) + '" title="Définir principal">☆</button>'
          : '');
      const del = canWrite()
        ? '<button type="button" class="btn btn-outline-danger btn-sm gderpi-fournisseur-contact-del" data-key="' + esc(key) + '">Suppr.</button>'
        : '';
      return '<tr data-gderpi-fournisseur-contact-row data-key="' + esc(key) + '">' +
        '<td class="text-center text-nowrap">' + principal + '</td>' +
        '<td>' + esc(contactDisplayName(c)) + '</td>' +
        '<td>' + esc(c.fonction || '—') + '</td>' +
        '<td>' + esc(c.email || '—') + '</td>' +
        '<td>' + esc(c.telephone || '—') + '</td>' +
        '<td class="text-nowrap" onclick="event.stopPropagation()">' + del + '</td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-gderpi-fournisseur-contact-row]').forEach((row) => {
      row.addEventListener('dblclick', () => openContactModal(row.getAttribute('data-key')));
    });
    tbody.querySelectorAll('.gderpi-fournisseur-contact-del').forEach((btn) => {
      btn.addEventListener('click', () => deleteContact(btn.getAttribute('data-key')));
    });
    tbody.querySelectorAll('.gderpi-fournisseur-contact-principal').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setPrincipalContact(btn.getAttribute('data-key'));
      });
    });
  }

  function renderAdressesTable() {
    const tbody = document.getElementById('gderpi-fournisseur-adresses-tbody');
    if (!tbody) return;
    if (!adressesState.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Aucune adresse. Cliquez sur + Adresse.</td></tr>';
      return;
    }
    tbody.innerHTML = adressesState.map((a, idx) => {
      const key = adresseRowKey(a, idx);
      const line = [a.adresse, a.complement].filter(Boolean).join(', ') || '—';
      const del = canWrite()
        ? '<button type="button" class="btn btn-outline-danger btn-sm gderpi-fournisseur-adresse-del" data-key="' + esc(key) + '">Suppr.</button>'
        : '';
      return '<tr data-gderpi-fournisseur-adresse-row data-key="' + esc(key) + '">' +
        '<td>' + esc(addressTypeLabel(a.type)) + '</td>' +
        '<td>' + esc(a.libelle || '—') + '</td>' +
        '<td>' + esc(line) + '</td>' +
        '<td>' + esc(a.codePostal || '—') + '</td>' +
        '<td>' + esc(a.ville || '—') + '</td>' +
        '<td class="text-nowrap" onclick="event.stopPropagation()">' + del + '</td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-gderpi-fournisseur-adresse-row]').forEach((row) => {
      row.addEventListener('dblclick', () => openAdresseModal(row.getAttribute('data-key')));
    });
    tbody.querySelectorAll('.gderpi-fournisseur-adresse-del').forEach((btn) => {
      btn.addEventListener('click', () => deleteAdresse(btn.getAttribute('data-key')));
    });
  }

  function fillAddressTypeSelect(selected) {
    const sel = document.getElementById('gderpi-fournisseur-adresse-type');
    if (!sel) return;
    sel.innerHTML = addressTypeOptions(selected || 'generique');
  }

  function ensureContactModal() {
    if (contactModal) return contactModal;
    const el = document.getElementById('gderpi-fournisseur-contact-modal');
    if (!el || !global.GderpiModal) return null;
    contactModal = global.GderpiModal.enhance(el, { title: 'Contact', size: 'md' });
    return contactModal;
  }

  function ensureAdresseModal() {
    if (adresseModal) return adresseModal;
    const el = document.getElementById('gderpi-fournisseur-adresse-modal');
    if (!el || !global.GderpiModal) return null;
    adresseModal = global.GderpiModal.enhance(el, { title: 'Adresse', size: 'md' });
    return adresseModal;
  }

  function resetContactForm() {
    editingContactKey = '';
    setVal('gderpi-fournisseur-contact-prenom', '');
    setVal('gderpi-fournisseur-contact-nom', '');
    setVal('gderpi-fournisseur-contact-fonction', '');
    setVal('gderpi-fournisseur-contact-email', '');
    setVal('gderpi-fournisseur-contact-tel', '');
    const principal = document.getElementById('gderpi-fournisseur-contact-principal');
    if (principal) principal.checked = !contactsState.length;
    const title = document.getElementById('gderpi-fournisseur-contact-modal-title');
    if (title) title.textContent = 'Nouveau contact';
  }

  function resetAdresseForm() {
    editingAdresseKey = '';
    fillAddressTypeSelect(adressesState.length ? 'generique' : 'generique');
    setVal('gderpi-fournisseur-adresse-libelle', '');
    setVal('gderpi-fournisseur-adresse-ligne', '');
    setVal('gderpi-fournisseur-adresse-complement', '');
    setVal('gderpi-fournisseur-adresse-cp', '');
    setVal('gderpi-fournisseur-adresse-ville', '');
    setVal('gderpi-fournisseur-adresse-pays', 'France');
    const title = document.getElementById('gderpi-fournisseur-adresse-modal-title');
    if (title) title.textContent = 'Nouvelle adresse';
  }

  function openContactModal(key) {
    if (!canWrite()) return;
    ensureContactModal();
    if (key) {
      const idx = contactsState.findIndex((c, i) => contactRowKey(c, i) === String(key));
      const c = idx >= 0 ? contactsState[idx] : null;
      if (!c) return;
      editingContactKey = String(key);
      setVal('gderpi-fournisseur-contact-prenom', c.prenom || '');
      setVal('gderpi-fournisseur-contact-nom', c.nom || '');
      setVal('gderpi-fournisseur-contact-fonction', c.fonction || '');
      setVal('gderpi-fournisseur-contact-email', c.email || '');
      setVal('gderpi-fournisseur-contact-tel', c.telephone || '');
      const principal = document.getElementById('gderpi-fournisseur-contact-principal');
      if (principal) principal.checked = c.principal === true;
      const title = document.getElementById('gderpi-fournisseur-contact-modal-title');
      if (title) title.textContent = 'Modifier le contact';
    } else {
      resetContactForm();
    }
    contactModal?.open();
  }

  function openAdresseModal(key) {
    if (!canWrite()) return;
    ensureAdresseModal();
    if (key) {
      const idx = adressesState.findIndex((a, i) => adresseRowKey(a, i) === String(key));
      const a = idx >= 0 ? adressesState[idx] : null;
      if (!a) return;
      editingAdresseKey = String(key);
      fillAddressTypeSelect(a.type || 'generique');
      setVal('gderpi-fournisseur-adresse-libelle', a.libelle || '');
      setVal('gderpi-fournisseur-adresse-ligne', a.adresse || '');
      setVal('gderpi-fournisseur-adresse-complement', a.complement || '');
      setVal('gderpi-fournisseur-adresse-cp', a.codePostal || '');
      setVal('gderpi-fournisseur-adresse-ville', a.ville || '');
      setVal('gderpi-fournisseur-adresse-pays', a.pays || 'France');
      const title = document.getElementById('gderpi-fournisseur-adresse-modal-title');
      if (title) title.textContent = 'Modifier l\'adresse';
    } else {
      resetAdresseForm();
    }
    adresseModal?.open();
  }

  async function saveContactFromModal(ev) {
    ev?.preventDefault?.();
    const draft = {
      prenom: val('gderpi-fournisseur-contact-prenom'),
      nom: val('gderpi-fournisseur-contact-nom'),
      fonction: val('gderpi-fournisseur-contact-fonction'),
      email: val('gderpi-fournisseur-contact-email'),
      telephone: val('gderpi-fournisseur-contact-tel'),
      principal: document.getElementById('gderpi-fournisseur-contact-principal')?.checked === true
    };
    if (!draft.prenom && !draft.nom && !draft.email && !draft.telephone) {
      global.GderpiStatus.showStatus('Indiquez au moins un nom ou un email.', 'warning');
      return;
    }

    if (useAnnuaireContactApi()) {
      try {
        await global.GderpiAnnuaireContactUi.persistContact({
          organisationId: currentAnnuaireOrgId,
          scope: CONTACT_SCOPE,
          draft: draft,
          editingRowKey: editingContactKey,
          contactsState: contactsState,
          contactRowKey: contactRowKey
        });
        await reloadFournisseurContacts();
        contactModal?.close();
        resetContactForm();
        global.GderpiStatus.showStatus('Contact enregistré (Annuaire).', 'success');
      } catch (err) {
        handleErr(err);
      }
      return;
    }

    let list = contactsState.map((c) => ({ ...c }));
    let savedKey = editingContactKey;
    if (editingContactKey) {
      const idx = list.findIndex((c, i) => contactRowKey(c, i) === editingContactKey);
      if (idx >= 0) list[idx] = { ...list[idx], ...draft };
    } else {
      const newKey = 'ct-' + (++contactSeq);
      list.push({ ...draft, _key: newKey });
      savedKey = newKey;
    }
    if (draft.principal) {
      list = list.map((c, i) => ({
        ...c,
        principal: contactRowKey(c, i) === savedKey
      }));
    } else if (!list.some((c) => c.principal) && list.length) {
      list[0] = { ...list[0], principal: true };
    }
    setContactsState(list);
    contactModal?.close();
    resetContactForm();
  }

  function saveAdresseFromModal(ev) {
    ev?.preventDefault?.();
    const draft = {
      type: document.getElementById('gderpi-fournisseur-adresse-type')?.value || 'autre',
      libelle: val('gderpi-fournisseur-adresse-libelle'),
      adresse: val('gderpi-fournisseur-adresse-ligne'),
      complement: val('gderpi-fournisseur-adresse-complement'),
      codePostal: val('gderpi-fournisseur-adresse-cp'),
      ville: val('gderpi-fournisseur-adresse-ville'),
      pays: val('gderpi-fournisseur-adresse-pays') || 'France'
    };
    if (!draft.adresse && !draft.complement && !draft.codePostal && !draft.ville && !draft.libelle) {
      global.GderpiStatus.showStatus('Renseignez au moins une ligne d\'adresse.', 'warning');
      return;
    }
    const list = adressesState.map((a) => ({ ...a }));
    if (editingAdresseKey) {
      const idx = list.findIndex((a, i) => adresseRowKey(a, i) === editingAdresseKey);
      if (idx >= 0) list[idx] = { ...list[idx], ...draft };
    } else {
      list.push({ ...draft, _key: 'ad-' + (++adresseSeq) });
    }
    setAdressesState(list);
    adresseModal?.close();
    resetAdresseForm();
  }

  async function deleteContact(key) {
    if (!key || !canWrite()) return;
    if (!window.confirm('Supprimer ce contact ?')) return;
    if (useAnnuaireContactApi()) {
      try {
        await global.GderpiAnnuaireContactUi.removeContact({
          rowKey: key,
          contactsState: contactsState,
          contactRowKey: contactRowKey
        });
        await reloadFournisseurContacts();
        global.GderpiStatus.showStatus('Contact supprimé (Annuaire).', 'success');
      } catch (err) {
        handleErr(err);
      }
      return;
    }
    const list = contactsState.filter((c, i) => contactRowKey(c, i) !== String(key));
    if (list.length && !list.some((c) => c.principal)) list[0] = { ...list[0], principal: true };
    setContactsState(list);
  }

  function deleteAdresse(key) {
    if (!key || !canWrite()) return;
    if (!window.confirm('Supprimer cette adresse ?')) return;
    setAdressesState(adressesState.filter((a, i) => adresseRowKey(a, i) !== String(key)));
  }

  async function setPrincipalContact(key) {
    if (!key || !canWrite()) return;
    if (useAnnuaireContactApi()) {
      try {
        await global.GderpiAnnuaireContactUi.markPrincipal({
          rowKey: key,
          contactsState: contactsState,
          contactRowKey: contactRowKey
        });
        await reloadFournisseurContacts();
      } catch (err) {
        handleErr(err);
      }
      return;
    }
    setContactsState(contactsState.map((c, i) => ({
      ...c,
      principal: contactRowKey(c, i) === String(key)
    })));
  }

  function collectContacts() {
    return contactsState.map((c) => ({
      id: c.id || '',
      prenom: c.prenom || '',
      nom: c.nom || '',
      fonction: c.fonction || '',
      email: c.email || '',
      telephone: c.telephone || '',
      principal: c.principal === true
    })).filter((c) => c.prenom || c.nom || c.email || c.telephone || c.fonction);
  }

  function collectAdresses() {
    return adressesState.map((a) => ({
      id: a.id || '',
      type: a.type || 'autre',
      libelle: a.libelle || '',
      adresse: a.adresse || '',
      complement: a.complement || '',
      codePostal: a.codePostal || '',
      ville: a.ville || '',
      pays: a.pays || 'France'
    })).filter((a) => a.adresse || a.complement || a.codePostal || a.ville || a.libelle);
  }

  function buildAdressesFromItem(item) {
    if (Array.isArray(item.adresses) && item.adresses.length) return item.adresses;
    const adresses = [];
    const legacy = {
      type: 'generique',
      adresse: item.adresse,
      complement: item.adresseComplement,
      codePostal: item.codePostal,
      ville: item.ville,
      pays: item.pays
    };
    if (legacy.adresse || legacy.complement || legacy.codePostal || legacy.ville) {
      adresses.push(legacy);
    }
    return adresses;
  }

  function buildContactsFromItem(item) {
    let contacts = Array.isArray(item.contacts) ? item.contacts.filter(Boolean) : [];
    if (contacts.length) return contacts;
    if (item.email || item.telephone || item.contactNom) {
      const parts = String(item.contactNom || '').trim().split(/\s+/).filter(Boolean);
      contacts = [{
        prenom: parts.length > 1 ? parts[0] : '',
        nom: parts.length > 1 ? parts.slice(1).join(' ') : (parts[0] || ''),
        fonction: item.contactFonction || '',
        email: item.email || '',
        telephone: item.telephone || '',
        principal: true
      }];
    }
    return contacts;
  }

  function paymentListLabel(item) {
    if (item.conditionsPaiement) return item.conditionsPaiement;
    const opts = global.GderpiDevisPaiementOptions;
    if (!opts) return '—';
    const parts = [];
    const moyen = opts.MOYENS.find((o) => o.value === item.conditionsPaiementMoyen);
    const echeance = opts.ECHEANCES.find((o) => o.value === item.conditionsPaiementEcheance);
    if (moyen) parts.push(moyen.label);
    if (echeance) parts.push(echeance.label);
    if (item.conditionsPaiementComplement) parts.push(item.conditionsPaiementComplement);
    return parts.join(' — ') || '—';
  }

  function fillForm(f, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const generation = opts.generation != null ? opts.generation : ++formFillGeneration;
    if (opts.generation == null) formFillGeneration = generation;

    const item = f || {};
    editingId = String(item.fournisseurId || '').trim();

    setVal('gderpi-fournisseur-rs', item.raisonSociale || '');
    setVal('gderpi-fournisseur-siret', item.siret || '');
    setVal('gderpi-fournisseur-tva', item.tvaIntracommunautaire || '');
    setVal('gderpi-fournisseur-delai', item.delaiLivraisonJours ?? '');
    setVal('gderpi-fournisseur-notes', item.notes || '');
    fillFournisseurPaiementFields(item);

    if (generation !== formFillGeneration) return;

    setContactsState(buildContactsFromItem(item));
    if (generation !== formFillGeneration) return;

    setAdressesState(buildAdressesFromItem(item));
    if (generation !== formFillGeneration) return;

    const submit = document.getElementById('gderpi-fournisseur-submit');
    const title = document.getElementById('gderpi-fournisseur-form-title');
    if (submit) submit.textContent = editingId ? 'Enregistrer' : 'Créer le fournisseur';
    if (title) title.textContent = editingId ? 'Modifier le fournisseur' : 'Nouveau fournisseur';
    global.GderpiTierDocuments?.renderDocuments?.(
      global.GderpiTierDocuments.getConfig('gderpi-fournisseur'),
      item.documents || [],
      editingId
    );
    updateAnnuaireUi(item);
  }

  function resetForm() {
    const generation = ++formFillGeneration;
    editingId = '';
    const form = document.getElementById('gderpi-fournisseur-form');
    if (form) form.reset();
    if (generation !== formFillGeneration) return;
    fillForm({}, { generation });
  }

  function getPayload() {
    const delai = Number(document.getElementById('gderpi-fournisseur-delai')?.value);
    const payload = {
      raisonSociale: val('gderpi-fournisseur-rs'),
      siret: val('gderpi-fournisseur-siret'),
      tvaIntracommunautaire: val('gderpi-fournisseur-tva'),
      delaiLivraisonJours: Number.isFinite(delai) ? delai : null,
      notes: val('gderpi-fournisseur-notes'),
      adresses: collectAdresses(),
      ...getFournisseurPaiementFromDom()
    };
    if (!editingId) payload.contacts = collectContacts();
    return payload;
  }

  async function loadRows(q) {
    const path = '/fournisseurs' + (q ? '?q=' + encodeURIComponent(q) : '');
    const res = await global.GderpiApi.apiCall(path);
    return res.data || [];
  }

  function renderRows(tbody, items, api) {
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Aucun fournisseur.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map((f) => {
      const annBadge = f.annuaireLinked
        ? ' <span class="gderpi-badge gderpi-badge--annuaire" title="Contacts Annuaire">Annuaire</span>'
        : '';
      return '<tr data-gderpi-lc-row data-id="' + esc(f.fournisseurId) + '">' +
      '<td>' + esc(f.displayName) + annBadge + '</td><td>' + esc(f.email || '—') + '</td><td>' + esc(f.telephone || '—') + '</td>' +
      '<td>' + esc(paymentListLabel(f)) + '</td>' +
      '<td onclick="event.stopPropagation()"><button type="button" class="btn btn-outline-danger btn-sm gderpi-fourn-del" data-id="' + esc(f.fournisseurId) + '">Suppr.</button></td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-gderpi-lc-row]').forEach((tr) => {
      tr.addEventListener('dblclick', async () => {
        const id = tr.getAttribute('data-id');
        const res = await global.GderpiApi.apiCall('/fournisseurs/' + encodeURIComponent(id));
        fillForm(res.data);
        api.openCreate();
      });
    });
    tbody.querySelectorAll('.gderpi-fourn-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id || !window.confirm('Supprimer ce fournisseur ?')) return;
        await global.GderpiApi.apiCall('/fournisseurs/' + encodeURIComponent(id), { method: 'DELETE' });
        global.GderpiStatus.showStatus('Fournisseur supprimé.', 'success');
        await api.refresh();
        global.GderpiDashboardTab?.refreshDashboard?.();
      });
    });
  }

  function bindFournisseursTab() {
    global.GderpiApi.apiCall('/integrations/annuaire/status')
      .then((res) => { annuaireState = res.data || annuaireState; })
      .catch(() => {});

    const root = document.querySelector('[data-gderpi-vue-lc="fournisseurs"]');
    const form = document.getElementById('gderpi-fournisseur-form');
    const btnCancel = document.getElementById('gderpi-fournisseur-cancel');
    const btnAddContact = document.getElementById('gderpi-fournisseur-contact-add');
    const btnAddAdresse = document.getElementById('gderpi-fournisseur-adresse-add');
    const contactForm = document.getElementById('gderpi-fournisseur-contact-form');
    const adresseForm = document.getElementById('gderpi-fournisseur-adresse-form');

    ensureContactModal();
    ensureAdresseModal();
    fillAddressTypeSelect('generique');
    renderContactsTable();
    renderAdressesTable();

    if (btnCancel) btnCancel.addEventListener('click', () => { resetForm(); lcApi?.closeCreate(); });
    if (btnAddContact) btnAddContact.addEventListener('click', () => openContactModal());
    if (btnAddAdresse) btnAddAdresse.addEventListener('click', () => openAdresseModal());
    if (contactForm) contactForm.addEventListener('submit', saveContactFromModal);
    if (adresseForm) adresseForm.addEventListener('submit', saveAdresseFromModal);
    document.getElementById('gderpi-fournisseur-contact-cancel')?.addEventListener('click', () => {
      contactModal?.close();
      resetContactForm();
    });
    document.getElementById('gderpi-fournisseur-adresse-cancel')?.addEventListener('click', () => {
      adresseModal?.close();
      resetAdresseForm();
    });

    lcApi = global.GderpiVueLc.bindVueLc({
      key: 'fournisseurs', root, loadRows, renderRows,
      modalSize: 'xl',
      onCreateOpen: () => { if (!editingId) resetForm(); },
      onCreateClose: () => { resetForm(); }
    });

    global.GderpiTierDocuments?.bindDocumentsSection?.({
      prefix: 'gderpi-fournisseur',
      apiBasePath: '/fournisseurs',
      getTierId: () => editingId
    });

    if (form) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (isFournisseurFormSubmitting) return;

        const payload = getPayload();
        if (!payload.raisonSociale) {
          global.GderpiStatus.showStatus('Raison sociale requise.', 'danger');
          return;
        }

        setFournisseurFormSubmitting(true);
        const loadingMessage = editingId ? 'Enregistrement du fournisseur…' : 'Création du fournisseur…';
        try {
          if (editingId) {
            await global.GderpiApi.apiCall('/fournisseurs/' + encodeURIComponent(editingId), {
              method: 'PUT',
              body: JSON.stringify(payload),
              loadingMessage
            });
            global.GderpiStatus.showStatus('Fournisseur mis à jour.', 'success');
          } else {
            await global.GderpiApi.apiCall('/fournisseurs', {
              method: 'POST',
              body: JSON.stringify(payload),
              loadingMessage
            });
            global.GderpiStatus.showStatus('Fournisseur créé.', 'success');
          }
          resetForm();
          lcApi.closeCreate();
          await lcApi.refresh();
          global.GderpiDashboardTab?.refreshDashboard?.();
        } catch (err) {
          handleErr(err);
        } finally {
          setFournisseurFormSubmitting(false);
        }
      });
    }
  }

  global.GderpiFournisseursTab = { bindFournisseursTab, refreshFournisseursList: () => lcApi?.refresh() };
})(window);
