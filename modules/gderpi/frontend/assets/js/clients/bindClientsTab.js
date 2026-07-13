/**
 * FICHIER : modules/gderpi/frontend/assets/js/clients/bindClientsTab.js
 * RÔLE : Onglet clients — vue LC liste + création (contacts, adresses).
 */

(function initGderpiBindClientsTab(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const clientListLabel = (c) => global.GderpiClientSearch?.clientFieldLabel(c) || c.displayName || '—';
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
  let isFillingForm = false;
  let contactsState = [];
  let adressesState = [];
  let editingContactKey = '';
  let editingAdresseKey = '';
  let contactModal = null;
  let adresseModal = null;
  let isClientFormSubmitting = false;
  let annuaireState = { annuaireInstalled: false, annuaireRequired: true };
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

  async function reloadClientContacts() {
    if (!editingId) return;
    const res = await global.GderpiApi.apiCall('/clients/' + encodeURIComponent(editingId));
    renderContacts(buildContactsFromItem(res.data));
    return res.data;
  }

  function updateAnnuaireUi(item) {
    currentAnnuaireOrgId = item?.annuaireOrganisationId || '';
    const notice = document.getElementById('gderpi-client-annuaire-notice');
    global.GderpiAnnuaireBridge?.renderAnnuaireNotice(
      notice, item, annuaireState.annuaireInstalled, editingId
    );
  }

  function setClientFormSubmitting(active) {
    isClientFormSubmitting = active;
    const submit = document.getElementById('gderpi-client-submit');
    const cancel = document.getElementById('gderpi-client-cancel');
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

  function fillClientPaiementFields(item) {
    const opts = global.GderpiDevisPaiementOptions;
    if (!opts) return;
    opts.fillSelect(
      document.getElementById('gderpi-client-paiement-moyen'),
      opts.MOYENS,
      item?.conditionsPaiementMoyen
    );
    opts.fillSelect(
      document.getElementById('gderpi-client-paiement-echeance'),
      opts.ECHEANCES,
      item?.conditionsPaiementEcheance
    );
    setVal('gderpi-client-paiement-complement', item?.conditionsPaiementComplement || '');
  }

  function getClientPaiementFromDom() {
    return {
      conditionsPaiementMoyen: val('gderpi-client-paiement-moyen'),
      conditionsPaiementEcheance: val('gderpi-client-paiement-echeance'),
      conditionsPaiementComplement: val('gderpi-client-paiement-complement')
    };
  }

  function getClientDevisDefaultsFromDom() {
    return {
      afficherBonPourAccordParDefaut: document.getElementById('gderpi-client-afficher-bon-pour-accord-par-defaut')?.checked === true
    };
  }

  function fillClientDevisDefaults(item) {
    const el = document.getElementById('gderpi-client-afficher-bon-pour-accord-par-defaut');
    if (el) el.checked = item?.afficherBonPourAccordParDefaut === true;
  }

  function syncTypeFields() {
    const type = document.getElementById('gderpi-client-type')?.value || 'entreprise';
    const isEntreprise = type === 'entreprise';
    document.querySelectorAll('.gderpi-field--entreprise').forEach((el) => {
      el.hidden = !isEntreprise;
    });
    document.querySelectorAll('.gderpi-field--particulier').forEach((el) => {
      el.hidden = isEntreprise;
    });
    const contactsSection = document.getElementById('gderpi-client-contacts-section');
    if (contactsSection) contactsSection.hidden = !isEntreprise;
  }

  function onClientTypeChange() {
    if (isFillingForm) return;
    const typeSel = document.getElementById('gderpi-client-type');
    const isEntreprise = typeSel?.value === 'entreprise';

    if (isEntreprise) {
      const prenom = val('gderpi-client-prenom');
      const nom = val('gderpi-client-nom');
      const email = val('gderpi-client-email');
      const tel = val('gderpi-client-tel');
      const hasParticulierData = prenom || nom || email || tel;
      const existingContacts = collectContacts();

      if (hasParticulierData && !existingContacts.length) {
        setContactsState([{
          prenom, nom, email, telephone: tel, principal: true
        }]);
      } else if (!contactsState.length) {
        setContactsState([]);
      }

      setVal('gderpi-client-prenom', '');
      setVal('gderpi-client-nom', '');
      setVal('gderpi-client-email', '');
      setVal('gderpi-client-tel', '');
    } else {
      const contacts = collectContacts();
      const principal = contacts.find((c) => c.principal) || contacts[0];
      if (principal) {
        setVal('gderpi-client-prenom', principal.prenom || '');
        setVal('gderpi-client-nom', principal.nom || '');
        setVal('gderpi-client-email', principal.email || '');
        setVal('gderpi-client-tel', principal.telephone || '');
      }
      setVal('gderpi-client-rs', '');
      setVal('gderpi-client-siret', '');
      setVal('gderpi-client-tva', '');
      setVal('gderpi-client-web', '');
      setContactsState([]);
    }

    syncTypeFields();
  }

  function addressTypeOptions(selected) {
    const sel = String(selected || 'facturation').trim();
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
    const tbody = document.getElementById('gderpi-client-contacts-tbody');
    if (!tbody) return;
    if (!contactsState.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Aucun contact. Cliquez sur + Contact.</td></tr>';
      return;
    }
    tbody.innerHTML = contactsState.map((c, idx) => {
      const key = contactRowKey(c, idx);
      const principal = c.principal
        ? '<span class="gderpi-client-sublist__star" title="Contact principal">★</span>'
        : (canWrite()
          ? '<button type="button" class="btn btn-link btn-sm gderpi-client-contact-principal" data-key="' + esc(key) + '" title="Définir principal">☆</button>'
          : '');
      const del = canWrite()
        ? '<button type="button" class="btn btn-outline-danger btn-sm gderpi-client-contact-del" data-key="' + esc(key) + '">Suppr.</button>'
        : '';
      return '<tr data-gderpi-client-contact-row data-key="' + esc(key) + '">' +
        '<td class="text-center text-nowrap">' + principal + '</td>' +
        '<td>' + esc(contactDisplayName(c)) + '</td>' +
        '<td>' + esc(c.service || '—') + '</td>' +
        '<td>' + esc(c.fonction || '—') + '</td>' +
        '<td>' + esc(c.email || '—') + '</td>' +
        '<td>' + esc(c.telephone || '—') + '</td>' +
        '<td class="text-nowrap" onclick="event.stopPropagation()">' + del + '</td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-gderpi-client-contact-row]').forEach((row) => {
      row.addEventListener('dblclick', () => openContactModal(row.getAttribute('data-key')).catch(handleErr));
    });
    tbody.querySelectorAll('.gderpi-client-contact-del').forEach((btn) => {
      btn.addEventListener('click', () => deleteContact(btn.getAttribute('data-key')));
    });
    tbody.querySelectorAll('.gderpi-client-contact-principal').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setPrincipalContact(btn.getAttribute('data-key'));
      });
    });
  }

  function renderAdressesTable() {
    const tbody = document.getElementById('gderpi-client-adresses-tbody');
    if (!tbody) return;
    if (!adressesState.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Aucune adresse. Cliquez sur + Adresse.</td></tr>';
      return;
    }
    tbody.innerHTML = adressesState.map((a, idx) => {
      const key = adresseRowKey(a, idx);
      const line = [a.adresse, a.complement].filter(Boolean).join(', ') || '—';
      const del = canWrite()
        ? '<button type="button" class="btn btn-outline-danger btn-sm gderpi-client-adresse-del" data-key="' + esc(key) + '">Suppr.</button>'
        : '';
      return '<tr data-gderpi-client-adresse-row data-key="' + esc(key) + '">' +
        '<td>' + esc(addressTypeLabel(a.type)) + '</td>' +
        '<td>' + esc(a.libelle || '—') + '</td>' +
        '<td>' + esc(line) + '</td>' +
        '<td>' + esc(a.codePostal || '—') + '</td>' +
        '<td>' + esc(a.ville || '—') + '</td>' +
        '<td class="text-nowrap" onclick="event.stopPropagation()">' + del + '</td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-gderpi-client-adresse-row]').forEach((row) => {
      row.addEventListener('dblclick', () => openAdresseModal(row.getAttribute('data-key')));
    });
    tbody.querySelectorAll('.gderpi-client-adresse-del').forEach((btn) => {
      btn.addEventListener('click', () => deleteAdresse(btn.getAttribute('data-key')));
    });
  }

  function fillAddressTypeSelect(selected) {
    const sel = document.getElementById('gderpi-client-adresse-type');
    if (!sel) return;
    sel.innerHTML = addressTypeOptions(selected || 'facturation');
  }

  function ensureContactModal() {
    if (contactModal) return contactModal;
    const el = document.getElementById('gderpi-client-contact-modal');
    if (!el || !global.GderpiModal) return null;
    contactModal = global.GderpiModal.enhance(el, { title: 'Contact', size: 'md' });
    return contactModal;
  }

  function ensureAdresseModal() {
    if (adresseModal) return adresseModal;
    const el = document.getElementById('gderpi-client-adresse-modal');
    if (!el || !global.GderpiModal) return null;
    adresseModal = global.GderpiModal.enhance(el, { title: 'Adresse', size: 'md' });
    return adresseModal;
  }

  async function populateContactServiceSelect(selectedLibelle) {
    const sel = document.getElementById('gderpi-client-contact-service');
    if (!sel || !global.GderpiClientServices) return;
    await global.GderpiClientServices.populateServiceSelect(sel, selectedLibelle || '', {
      placeholder: '— Sélectionner —',
      extraLabels: selectedLibelle ? [selectedLibelle] : []
    });
  }

  function resetContactForm() {
    editingContactKey = '';
    setVal('gderpi-client-contact-prenom', '');
    setVal('gderpi-client-contact-nom', '');
    setVal('gderpi-client-contact-fonction', '');
    setVal('gderpi-client-contact-email', '');
    setVal('gderpi-client-contact-tel', '');
    populateContactServiceSelect('').catch(handleErr);
    const principal = document.getElementById('gderpi-client-contact-principal');
    if (principal) principal.checked = !contactsState.length;
    const title = document.getElementById('gderpi-client-contact-modal-title');
    if (title) title.textContent = 'Nouveau contact';
  }

  function resetAdresseForm() {
    editingAdresseKey = '';
    fillAddressTypeSelect(adressesState.length ? 'facturation' : 'generique');
    setVal('gderpi-client-adresse-libelle', '');
    setVal('gderpi-client-adresse-ligne', '');
    setVal('gderpi-client-adresse-complement', '');
    setVal('gderpi-client-adresse-cp', '');
    setVal('gderpi-client-adresse-ville', '');
    setVal('gderpi-client-adresse-pays', 'France');
    const title = document.getElementById('gderpi-client-adresse-modal-title');
    if (title) title.textContent = 'Nouvelle adresse';
  }

  function handleErr(err) {
    global.GderpiStatus.showStatus(err?.message || 'Erreur', 'danger');
  }

  async function openContactModal(key) {
    if (!canWrite()) return;
    ensureContactModal();
    if (key) {
      const idx = contactsState.findIndex((c, i) => contactRowKey(c, i) === String(key));
      const c = idx >= 0 ? contactsState[idx] : null;
      if (!c) return;
      editingContactKey = String(key);
      setVal('gderpi-client-contact-prenom', c.prenom || '');
      setVal('gderpi-client-contact-nom', c.nom || '');
      await populateContactServiceSelect(c.service || '');
      setVal('gderpi-client-contact-fonction', c.fonction || '');
      setVal('gderpi-client-contact-email', c.email || '');
      setVal('gderpi-client-contact-tel', c.telephone || '');
      const principal = document.getElementById('gderpi-client-contact-principal');
      if (principal) principal.checked = c.principal === true;
      const title = document.getElementById('gderpi-client-contact-modal-title');
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
      fillAddressTypeSelect(a.type || 'facturation');
      setVal('gderpi-client-adresse-libelle', a.libelle || '');
      setVal('gderpi-client-adresse-ligne', a.adresse || '');
      setVal('gderpi-client-adresse-complement', a.complement || '');
      setVal('gderpi-client-adresse-cp', a.codePostal || '');
      setVal('gderpi-client-adresse-ville', a.ville || '');
      setVal('gderpi-client-adresse-pays', a.pays || 'France');
      const title = document.getElementById('gderpi-client-adresse-modal-title');
      if (title) title.textContent = 'Modifier l\'adresse';
    } else {
      resetAdresseForm();
    }
    adresseModal?.open();
  }

  async function saveContactFromModal(ev) {
    ev?.preventDefault?.();
    const draft = {
      prenom: val('gderpi-client-contact-prenom'),
      nom: val('gderpi-client-contact-nom'),
      service: val('gderpi-client-contact-service'),
      fonction: val('gderpi-client-contact-fonction'),
      email: val('gderpi-client-contact-email'),
      telephone: val('gderpi-client-contact-tel'),
      principal: document.getElementById('gderpi-client-contact-principal')?.checked === true
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
        await reloadClientContacts();
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
      type: document.getElementById('gderpi-client-adresse-type')?.value || 'autre',
      libelle: val('gderpi-client-adresse-libelle'),
      adresse: val('gderpi-client-adresse-ligne'),
      complement: val('gderpi-client-adresse-complement'),
      codePostal: val('gderpi-client-adresse-cp'),
      ville: val('gderpi-client-adresse-ville'),
      pays: val('gderpi-client-adresse-pays') || 'France'
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
        await reloadClientContacts();
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
        await reloadClientContacts();
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

  function renderContacts(contacts) {
    setContactsState(Array.isArray(contacts) && contacts.length ? contacts : []);
  }

  function renderAdresses(adresses) {
    setAdressesState(Array.isArray(adresses) && adresses.length ? adresses : []);
  }

  function collectContacts() {
    return contactsState.map((c) => ({
      id: c.id || '',
      prenom: c.prenom || '',
      nom: c.nom || '',
      service: c.service || '',
      fonction: c.fonction || '',
      email: c.email || '',
      telephone: c.telephone || '',
      principal: c.principal === true
    })).filter((c) => c.prenom || c.nom || c.email || c.telephone || c.fonction || c.service);
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
    const fact = item.adresseFacturation || {
      type: 'facturation',
      adresse: item.adresse,
      complement: item.adresseComplement,
      codePostal: item.codePostal,
      ville: item.ville,
      pays: item.pays
    };
    if (fact.adresse || fact.complement || fact.codePostal || fact.ville || fact.libelle) {
      adresses.push({ type: 'facturation', ...fact });
    }
    const livraison = item.adresseLivraison;
    if (item.livraisonIdentiqueFacturation === false && livraison
      && (livraison.adresse || livraison.complement || livraison.codePostal || livraison.ville || livraison.libelle)) {
      adresses.push({ type: 'livraison', ...livraison });
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

  async function fillForm(c, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const generation = opts.generation != null ? opts.generation : ++formFillGeneration;
    if (opts.generation == null) formFillGeneration = generation;

    const item = c || {};
    isFillingForm = true;
    editingId = String(item.clientId || '').trim();
    const isEntreprise = (item.type || 'entreprise') === 'entreprise';

    setVal('gderpi-client-type', item.type || 'entreprise');
    setVal('gderpi-client-rs', item.raisonSociale || '');
    setVal('gderpi-client-siret', item.siret || '');
    setVal('gderpi-client-tva', item.tvaIntracommunautaire || '');
    setVal('gderpi-client-web', item.siteWeb || '');
    setVal('gderpi-client-notes', item.notes || '');
    fillClientPaiementFields(item);
    fillClientDevisDefaults(item);
    if (generation !== formFillGeneration) {
      isFillingForm = false;
      return;
    }

    if (isEntreprise) {
      setVal('gderpi-client-prenom', '');
      setVal('gderpi-client-nom', '');
      setVal('gderpi-client-email', '');
      setVal('gderpi-client-tel', '');
      const contacts = buildContactsFromItem(item);
      renderContacts(contacts);
    } else {
      setVal('gderpi-client-prenom', item.prenom || '');
      setVal('gderpi-client-nom', item.nom || '');
      setVal('gderpi-client-email', item.email || '');
      setVal('gderpi-client-tel', item.telephone || '');
      const contacts = buildContactsFromItem(item);
      const principal = contacts.find((ct) => ct.principal) || contacts[0];
      if (!item.email && principal?.email) setVal('gderpi-client-email', principal.email);
      if (!item.telephone && principal?.telephone) setVal('gderpi-client-tel', principal.telephone);
      renderContacts([]);
    }
    if (generation !== formFillGeneration) {
      isFillingForm = false;
      return;
    }

    renderAdresses(buildAdressesFromItem(item));
    if (generation !== formFillGeneration) {
      isFillingForm = false;
      return;
    }

    const submit = document.getElementById('gderpi-client-submit');
    const title = document.getElementById('gderpi-client-form-title');
    if (submit) submit.textContent = editingId ? 'Enregistrer' : 'Créer le client';
    if (title) title.textContent = editingId ? 'Modifier le client' : 'Nouveau client';
    syncTypeFields();
    updateAnnuaireUi(item);
    global.GderpiTierDocuments?.renderDocuments?.(
      global.GderpiTierDocuments.getConfig('gderpi-client'),
      item.documents || [],
      editingId
    );
    isFillingForm = false;
  }

  async function resetForm() {
    const generation = ++formFillGeneration;
    editingId = '';
    if (generation !== formFillGeneration) return;
    const form = document.getElementById('gderpi-client-form');
    if (form) form.reset();
    if (generation !== formFillGeneration) return;
    await fillForm({}, { generation });
  }

  function getPayload() {
    const type = document.getElementById('gderpi-client-type').value;
    const payload = {
      type,
      adresses: collectAdresses(),
      notes: val('gderpi-client-notes'),
      ...getClientPaiementFromDom(),
      ...getClientDevisDefaultsFromDom()
    };
    if (type === 'entreprise') {
      payload.raisonSociale = val('gderpi-client-rs');
      payload.siret = val('gderpi-client-siret');
      payload.tvaIntracommunautaire = val('gderpi-client-tva');
      payload.siteWeb = val('gderpi-client-web');
      if (!editingId) {
        payload.contacts = collectContacts();
      }
      payload.prenom = '';
      payload.nom = '';
    } else {
      payload.raisonSociale = '';
      payload.siret = '';
      payload.tvaIntracommunautaire = '';
      payload.siteWeb = '';
      payload.prenom = val('gderpi-client-prenom');
      payload.nom = val('gderpi-client-nom');
      payload.email = val('gderpi-client-email');
      payload.telephone = val('gderpi-client-tel');
      payload.contacts = [];
    }
    return payload;
  }

  async function loadRows(q) {
    const path = '/clients' + (q ? '?q=' + encodeURIComponent(q) : '');
    const res = await global.GderpiApi.apiCall(path);
    return res.data || [];
  }

  function renderRows(tbody, items, api) {
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Aucun client.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map((c) => {
      const annBadge = c.annuaireLinked
        ? ' <span class="gderpi-badge gderpi-badge--annuaire" title="Synchronisé Annuaire">Annuaire</span>'
        : '';
      return '<tr data-gderpi-lc-row data-id="' + esc(c.clientId) + '">' +
      '<td>' + esc(clientListLabel(c)) + annBadge + '</td><td>' + esc(c.type) + '</td><td>' + esc(c.email || '—') + '</td>' +
      '<td>' + esc(c.telephone || '—') + '</td>' +
      '<td onclick="event.stopPropagation()"><button type="button" class="btn btn-outline-danger btn-sm gderpi-client-del" data-id="' + esc(c.clientId) + '">Suppr.</button></td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-gderpi-lc-row]').forEach((tr) => {
      tr.addEventListener('dblclick', async () => {
        const id = tr.getAttribute('data-id');
        const res = await global.GderpiApi.apiCall('/clients/' + encodeURIComponent(id));
        await fillForm(res.data);
        api.openCreate();
      });
    });
    tbody.querySelectorAll('.gderpi-client-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id || !window.confirm('Supprimer ce client ?')) return;
        await global.GderpiApi.apiCall('/clients/' + encodeURIComponent(id), { method: 'DELETE' });
        global.GderpiStatus.showStatus('Client supprimé.', 'success');
        await api.refresh();
        global.GderpiDashboardTab?.refreshDashboard?.();
      });
    });
  }

  function bindClientsTab() {
    global.GderpiApi.apiCall('/integrations/annuaire/status')
      .then((res) => { annuaireState = res.data || annuaireState; })
      .catch(() => {});

    const root = document.querySelector('[data-gderpi-vue-lc="clients"]');
    const form = document.getElementById('gderpi-client-form');
    const btnCancel = document.getElementById('gderpi-client-cancel');
    const typeSel = document.getElementById('gderpi-client-type');
    const btnAddContact = document.getElementById('gderpi-client-contact-add');
    const btnAddAdresse = document.getElementById('gderpi-client-adresse-add');
    const contactForm = document.getElementById('gderpi-client-contact-form');
    const adresseForm = document.getElementById('gderpi-client-adresse-form');

    ensureContactModal();
    ensureAdresseModal();
    fillAddressTypeSelect('facturation');
    renderContactsTable();
    renderAdressesTable();

    if (btnCancel) btnCancel.addEventListener('click', () => { resetForm(); lcApi?.closeCreate(); });
    if (typeSel) typeSel.addEventListener('change', onClientTypeChange);
    if (btnAddContact) btnAddContact.addEventListener('click', () => openContactModal().catch(handleErr));
    if (btnAddAdresse) btnAddAdresse.addEventListener('click', () => openAdresseModal());
    if (contactForm) contactForm.addEventListener('submit', saveContactFromModal);
    if (adresseForm) adresseForm.addEventListener('submit', saveAdresseFromModal);
    document.getElementById('gderpi-client-contact-cancel')?.addEventListener('click', () => {
      contactModal?.close();
      resetContactForm();
    });
    document.getElementById('gderpi-client-adresse-cancel')?.addEventListener('click', () => {
      adresseModal?.close();
      resetAdresseForm();
    });

    lcApi = global.GderpiVueLc.bindVueLc({
      key: 'clients', root, loadRows, renderRows,
      modalSize: 'xl',
      onCreateOpen: async () => { if (!editingId) await resetForm(); },
      onCreateClose: () => { resetForm(); }
    });

    global.GderpiTierDocuments?.bindDocumentsSection?.({
      prefix: 'gderpi-client',
      apiBasePath: '/clients',
      getTierId: () => editingId
    });

    if (form) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (isClientFormSubmitting) return;

        const payload = getPayload();
        if (payload.type === 'entreprise' && !payload.raisonSociale) {
          global.GderpiStatus.showStatus('Raison sociale requise pour une entreprise.', 'danger');
          return;
        }
        if (payload.type === 'particulier' && !payload.prenom && !payload.nom) {
          global.GderpiStatus.showStatus('Prénom ou nom requis pour un particulier.', 'danger');
          return;
        }

        setClientFormSubmitting(true);
        const loadingMessage = editingId ? 'Enregistrement du client…' : 'Création du client…';
        try {
          if (editingId) {
            await global.GderpiApi.apiCall('/clients/' + encodeURIComponent(editingId), {
              method: 'PUT',
              body: JSON.stringify(payload),
              loadingMessage
            });
            global.GderpiStatus.showStatus('Client mis à jour.', 'success');
          } else {
            await global.GderpiApi.apiCall('/clients', {
              method: 'POST',
              body: JSON.stringify(payload),
              loadingMessage
            });
            global.GderpiStatus.showStatus('Client créé.', 'success');
          }
          resetForm();
          lcApi.closeCreate();
          await lcApi.refresh();
          global.GderpiDashboardTab?.refreshDashboard?.();
        } catch (err) {
          handleErr(err);
        } finally {
          setClientFormSubmitting(false);
        }
      });
    }
  }

  global.GderpiClientsTab = { bindClientsTab, refreshClientsList: () => lcApi?.refresh() };
})(window);
