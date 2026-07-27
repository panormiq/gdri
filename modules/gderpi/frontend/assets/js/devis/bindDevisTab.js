/**
 * FICHIER : modules/gderpi/frontend/assets/js/devis/bindDevisTab.js
 * RÔLE : Onglet devis — liste, éditeur lignes avec recherche article.
 */

(function initGderpiBindDevisTab(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const fmt = (v) => global.GderpiFormat.formatMoney(v);
  const fmtDate = (v) => global.GderpiFormat.formatDate(v);
  const bindSearch = (input, opts) => global.GderpiBindArticleSearch.bindArticleSearchField(input, opts);
  const bindClientSearch = (input, opts) => global.GderpiBindClientSearch?.bindClientSearchField(input, opts);
  const clientFieldLabel = (c) => global.GderpiClientSearch?.clientFieldLabel(c) || '';
  const canWrite = () => global.GDERPI_CONFIG?.canWrite === true;

  let boutiques = [];
  let clients = [];
  let clientDetails = new Map();
  let articles = [];
  let devisList = [];
  let editingId = '';
  let currentDevis = null;
  let lines = [];
  let lineSearchBindings = [];
  let clientSearchBinding = null;
  let isLocalDraft = false;
  let isDirty = false;
  let editorModal = null;
  let previewModal = null;
  let newContactModal = null;
  let selectedContactClientId = '';
  let selectedDevisService = '';
  let selectedEmetteurContactId = '';
  let boutiqueDetails = new Map();
  let devisSort = { key: 'date', dir: 'desc' };
  let pmCompat = null;
  let pmPickerModal = null;

  const PARTICULIER_CONTACT_ID = '__particulier__';

  const STATUT_LABELS = {
    brouillon: 'Brouillon',
    envoye: 'Envoyé',
    accepte: 'Accepté',
    refuse: 'Refusé',
    expire: 'Expiré'
  };

  const STATUT_ORDER = ['brouillon', 'envoye', 'accepte', 'refuse', 'expire'];

  function emptyLine() {
    return {
      articleId: null,
      articleType: '',
      reference: '',
      referenceClient: '',
      libelle: '',
      description: '',
      commentaire: '',
      unite: 'piece',
      quantite: 1,
      prixHt: 0,
      remisePct: 0,
      tauxTva: 20,
      fournisseurId: null,
      prixSurDevis: false
    };
  }

  function getDevisClientId() {
    return document.getElementById('gderpi-devis-client')?.value?.trim() || '';
  }

  function setDevisClientId(clientId, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const hidden = document.getElementById('gderpi-devis-client');
    const id = clientId ? String(clientId).trim() : '';
    if (hidden) hidden.value = id;
    const client = getClientById(id);
    const label = client ? clientFieldLabel(client) : '';
    if (clientSearchBinding) clientSearchBinding.setDisplayValue(label);
    else {
      const search = document.getElementById('gderpi-devis-client-search');
      if (search) search.value = label;
    }
  }

  function syncLineRefClientsForDevisClient() {
    let changed = false;
    lines.forEach((line, idx) => {
      if (!line.articleId) return;
      const article = articles.find((a) => String(a.articleId || a.id) === String(line.articleId));
      if (!article) return;
      const refClient = resolveRefClientForArticle(article);
      if (refClient !== (line.referenceClient || '')) {
        lines[idx] = { ...line, referenceClient: refClient };
        changed = true;
      }
    });
    if (changed && isEditable()) {
      markDirty();
      renderLines();
    }
  }

  function mergeClientIntoList(client) {
    if (!client) return;
    const id = String(client.clientId || client.id || '').trim();
    if (!id) return;
    clientDetails.set(id, client);
    const idx = clients.findIndex((c) => String(c.clientId || c.id) === id);
    if (idx >= 0) clients[idx] = { ...clients[idx], ...client };
    else clients.push(client);
  }

  async function ensureClientLoaded(clientId) {
    const id = String(clientId || '').trim();
    if (!id) return null;
    const cached = clientDetails.get(id);
    if (cached && (Array.isArray(cached.contacts) || cached.type === 'particulier')) return cached;
    const res = await global.GderpiApi.apiCall('/clients/' + encodeURIComponent(id));
    mergeClientIntoList(res.data);
    return res.data;
  }

  function onDevisClientSelected(clientId) {
    const id = String(clientId || '').trim();
    setDevisClientId(id);
    ensureClientLoaded(id).then(async (client) => {
      if (String(getDevisClientId()) !== id) return;
      await applyClientToDevisForm(id, { applyDefaultContact: true });
      markDirty();
      syncLineRefClientsForDevisClient();
      if (client && isClientEntreprise(client)) {
        const hint = document.getElementById('gderpi-devis-contact-hint');
        if (hint) hint.textContent = 'Choisissez le service, puis le contact.';
      }
      applyClientPaiementDefaults(client);
      applyClientBonPourAccordDefault(client);
      refreshDevisCgvPanel().catch(handleErr);
    }).catch(handleErr);
  }

  function ensureClientSearch() {
    const input = document.getElementById('gderpi-devis-client-search');
    if (!input || !bindClientSearch || clientSearchBinding) return;
    clientSearchBinding = bindClientSearch(input, {
      getClients: () => clients,
      onSelect: (client) => {
        onDevisClientSelected(String(client.clientId || client.id));
      },
      onClear: () => {
        setDevisClientId('');
        selectedDevisService = '';
        refreshServiceSelect('', '');
        refreshContactSelect('', '', null, '');
        setDevisContactFields({
          contactClientId: '',
          contactNom: '',
          contactService: '',
          contactFonction: '',
          contactEmail: '',
          contactTelephone: ''
        });
        markDirty();
      }
    });
  }

  function getClientById(clientId) {
    const id = String(clientId || '').trim();
    if (!id) return null;
    if (clientDetails.has(id)) return clientDetails.get(id);
    return clients.find((c) => String(c.clientId || c.id) === id) || null;
  }

  function isClientEntreprise(client) {
    return Boolean(client && client.type !== 'particulier');
  }

  function contactServiceOf(ct) {
    return String(ct?.service || '').trim() || global.GderpiClientServices?.SANS_SERVICE || 'Sans service';
  }

  async function buildDevisServiceLabels(client) {
    const contacts = getClientContactsList(client);
    const extra = new Set();
    contacts.forEach((ct) => extra.add(contactServiceOf(ct)));
    const services = await global.GderpiClientServices.fetchClientServices();
    return global.GderpiClientServices.buildServiceLabels(services, [...extra]);
  }

  function filterContactsByService(contacts, service) {
    if (!service) return [];
    return contacts.filter((ct) => contactServiceOf(ct) === service);
  }

  function contactOptionLabel(ct) {
    const name = [ct.prenom, ct.nom].filter(Boolean).join(' ').trim() || 'Sans nom';
    const extra = ct.fonction ? ' — ' + ct.fonction : (ct.email ? ' — ' + ct.email : '');
    const star = ct.principal ? ' ★' : '';
    return name + extra + star;
  }

  function buildContactOptionsHtml(contacts) {
    let html = '<option value="">— Contact —</option>';
    contacts.forEach((ct) => {
      const id = String(ct.id || ct.contactId || '');
      html += '<option value="' + esc(id) + '">' + esc(contactOptionLabel(ct)) + '</option>';
    });
    return html;
  }

  async function refreshServiceSelect(clientId, preferredService, savedContact) {
    const svcSel = document.getElementById('gderpi-devis-service-select');
    const hint = document.getElementById('gderpi-devis-contact-hint');
    const editable = isEditable();
    const client = getClientById(clientId);
    const saved = savedContact && typeof savedContact === 'object' ? savedContact : null;
    const sansService = global.GderpiClientServices?.SANS_SERVICE || 'Sans service';

    if (!svcSel) return;

    if (!clientId || !client) {
      svcSel.innerHTML = '<option value="">— Client requis —</option>';
      svcSel.disabled = true;
      selectedDevisService = '';
      return;
    }

    if (!isClientEntreprise(client)) {
      svcSel.innerHTML = '<option value="">—</option>';
      svcSel.disabled = true;
      selectedDevisService = '';
      if (hint) hint.textContent = 'Contact issu de la fiche client particulier.';
      return;
    }

    const services = await buildDevisServiceLabels(client);
    if (!services.length) {
      svcSel.innerHTML = '<option value="">— Aucun service —</option>';
      svcSel.disabled = true;
      selectedDevisService = '';
      return;
    }

    svcSel.innerHTML = '<option value="">— Service —</option>' +
      services.map((s) => '<option value="' + esc(s) + '">' + esc(s) + '</option>').join('');

    let pick = String(preferredService || saved?.contactService || selectedDevisService || '').trim();
    if (pick === sansService) pick = sansService;
    if (!pick || !services.includes(pick)) {
      const contacts = getClientContactsList(client);
      const fromContact = saved?.contactClientId
        ? contacts.find((ct) => String(ct.id || ct.contactId) === String(saved.contactClientId))
        : null;
      if (fromContact) pick = contactServiceOf(fromContact);
      else {
        const principal = contacts.find((ct) => ct.principal) || contacts[0];
        if (principal) pick = contactServiceOf(principal);
      }
    }

    if (!pick && saved?.contactService === '') pick = sansService;

    if (pick && services.includes(pick)) {
      svcSel.value = pick;
      selectedDevisService = pick;
    } else {
      svcSel.value = '';
      selectedDevisService = '';
    }
    svcSel.disabled = !editable;
    if (hint) hint.textContent = 'Choisissez le service, puis le contact.';
  }

  function applyServiceFromSelect(service) {
    selectedDevisService = String(service || '').trim();
    const clientId = getDevisClientId();
    refreshContactSelect(clientId, '', null, selectedDevisService);
    if (!selectedDevisService) {
      clearContactPickerSelection();
      setDevisContactFields({
        contactNom: '', contactService: '', contactFonction: '', contactEmail: '', contactTelephone: ''
      });
      markDirty();
      return;
    }
    const client = getClientById(clientId);
    const list = filterContactsByService(getClientContactsList(client), selectedDevisService);
    const ct = list.find((c) => c.principal) || list[0];
    if (ct) applyContactFromSelect(String(ct.id || ct.contactId || ''));
    else {
      clearContactPickerSelection();
      setDevisContactFields({
        contactNom: '', contactService: selectedDevisService === 'Sans service' ? '' : selectedDevisService,
        contactFonction: '', contactEmail: '', contactTelephone: ''
      });
    }
    markDirty();
  }

  function getClientContactsList(client) {
    if (!client) return [];
    if (client.type === 'particulier') {
      return [{
        id: PARTICULIER_CONTACT_ID,
        prenom: client.prenom,
        nom: client.nom,
        fonction: client.contactFonction || '',
        email: client.email || '',
        telephone: client.telephone || '',
        principal: true
      }];
    }
    const list = Array.isArray(client.contacts) ? client.contacts.filter(Boolean) : [];
    if (list.length) return list;
    if (client.contactNom || client.email || client.telephone) {
      return [{
        id: 'legacy',
        prenom: '',
        nom: client.contactNom || '',
        fonction: client.contactFonction || '',
        email: client.email || '',
        telephone: client.telephone || '',
        principal: true
      }];
    }
    return [];
  }

  function contactToDevisFields(ct) {
    const id = String(ct?.id || ct?.contactId || '').trim();
    const service = String(ct?.service || '').trim();
    return {
      contactClientId: id && id !== 'legacy' ? id : '',
      contactNom: [ct?.prenom, ct?.nom].filter(Boolean).join(' ').trim(),
      contactService: service && service !== 'Sans service' ? service : (service || ''),
      contactFonction: ct?.fonction || '',
      contactEmail: ct?.email || '',
      contactTelephone: ct?.telephone || ''
    };
  }

  function resolveClientContactForDevis(client) {
    const contacts = getClientContactsList(client);
    const ct = contacts.find((c) => c.principal) || contacts[0];
    return ct ? contactToDevisFields(ct) : {
      contactClientId: '',
      contactNom: '',
      contactService: '',
      contactFonction: '',
      contactEmail: '',
      contactTelephone: ''
    };
  }

  function hasSelectOption(sel, value) {
    if (!sel || value == null) return false;
    return Array.from(sel.options).some((o) => o.value === String(value));
  }

  function savedContactOptionLabel(saved) {
    const nom = String(saved?.contactNom || '').trim();
    if (!nom) return 'Contact enregistré';
    const extra = [saved?.contactFonction, saved?.contactEmail].filter(Boolean).join(' — ');
    return extra ? nom + ' (' + extra + ')' : nom;
  }

  function refreshContactSelect(clientId, preferredContactId, savedContact, serviceFilter) {
    const sel = document.getElementById('gderpi-devis-contact-select');
    const addBtn = document.getElementById('gderpi-devis-contact-add');
    const hint = document.getElementById('gderpi-devis-contact-hint');
    const editable = isEditable();
    const client = getClientById(clientId);
    const saved = savedContact && typeof savedContact === 'object' ? savedContact : null;
    const service = String(serviceFilter != null ? serviceFilter : selectedDevisService || '').trim();

    if (!sel) return;

    if (!clientId || !client) {
      sel.innerHTML = '<option value="">— Service requis —</option>';
      sel.disabled = true;
      if (addBtn) addBtn.disabled = true;
      selectedContactClientId = '';
      return;
    }

    const allContacts = getClientContactsList(client);
    const isEnt = isClientEntreprise(client);

    if (!isEnt) {
      const contacts = allContacts;
      if (!contacts.length) {
        sel.innerHTML = '<option value="">— Aucun contact —</option>';
        sel.disabled = true;
        if (addBtn) addBtn.disabled = true;
        selectedContactClientId = '';
        if (hint) hint.textContent = 'Le contact est repris automatiquement de la fiche client particulier.';
        return;
      }
      sel.innerHTML = buildContactOptionsHtml(contacts);
      const principal = contacts.find((ct) => ct.principal) || contacts[0];
      const id = String(principal?.id || principal?.contactId || '');
      sel.value = id;
      selectedContactClientId = id;
      sel.disabled = !editable;
      if (addBtn) addBtn.disabled = true;
      if (hint) hint.textContent = 'Contact issu de la fiche client particulier.';
      return;
    }

    if (!service) {
      sel.innerHTML = '<option value="">— Service requis —</option>';
      sel.disabled = true;
      if (addBtn) addBtn.disabled = !editable;
      selectedContactClientId = '';
      if (hint) hint.textContent = 'Choisissez le service, puis le contact.';
      return;
    }

    const contacts = filterContactsByService(allContacts, service);

    if (!contacts.length) {
      if (saved?.contactNom && saved?.contactService === service) {
        const orphanId = String(saved.contactClientId || '__devis_saved__').trim() || '__devis_saved__';
        sel.innerHTML = '<option value="' + esc(orphanId) + '">' + esc(savedContactOptionLabel(saved)) + '</option>';
        sel.value = orphanId;
        selectedContactClientId = orphanId;
        sel.disabled = !editable;
        if (addBtn) addBtn.disabled = !editable;
        return;
      }
      sel.innerHTML = '<option value="">— Aucun contact pour ce service —</option>';
      sel.disabled = !editable;
      if (addBtn) addBtn.disabled = !editable;
      selectedContactClientId = '';
      if (hint) hint.textContent = 'Aucun contact pour ce service — utilisez + pour en ajouter un.';
      return;
    }

    sel.innerHTML = buildContactOptionsHtml(contacts);

    let pick = preferredContactId != null && preferredContactId !== ''
      ? String(preferredContactId)
      : (selectedContactClientId || saved?.contactClientId || '');

    if (pick && !contacts.some((ct) => String(ct.id || ct.contactId) === pick)) {
      if (saved?.contactNom) {
        sel.insertAdjacentHTML('beforeend',
          '<option value="' + esc(pick) + '">' + esc(savedContactOptionLabel(saved)) + '</option>');
      } else {
        pick = '';
      }
    }

    if (pick && hasSelectOption(sel, pick)) {
      sel.value = pick;
      selectedContactClientId = pick;
    } else if (saved?.contactNom && saved?.contactService === service) {
      const orphanId = String(saved.contactClientId || '__devis_saved__').trim() || '__devis_saved__';
      if (!hasSelectOption(sel, orphanId)) {
        sel.insertAdjacentHTML('beforeend',
          '<option value="' + esc(orphanId) + '">' + esc(savedContactOptionLabel(saved)) + '</option>');
      }
      sel.value = orphanId;
      selectedContactClientId = orphanId;
    } else if ((preferredContactId === '' || preferredContactId === null) && !pick) {
      sel.value = '';
      selectedContactClientId = '';
    } else {
      const principal = contacts.find((ct) => ct.principal) || contacts[0];
      const id = String(principal?.id || principal?.contactId || '');
      sel.value = id;
      selectedContactClientId = id;
    }

    sel.disabled = !editable;
    if (addBtn) addBtn.disabled = !editable;
    if (hint) hint.textContent = 'Choisissez le contact pour le service « ' + service + ' ».';
  }

  function applyContactFromSelect(contactId) {
    const clientId = getDevisClientId();
    const client = getClientById(clientId);
    if (!contactId) {
      selectedContactClientId = '';
      setDevisContactFields({
        contactNom: '',
        contactService: '',
        contactFonction: '',
        contactEmail: '',
        contactTelephone: ''
      });
      return;
    }
    const contacts = getClientContactsList(client);
    const ct = contacts.find((c) => String(c.id || c.contactId) === String(contactId));
    if (!ct) return;
    selectedContactClientId = String(contactId);
    setDevisContactFields(contactToDevisFields(ct));
    markDirty();
  }

  function clearContactPickerSelection() {
    selectedContactClientId = '';
    const sel = document.getElementById('gderpi-devis-contact-select');
    if (sel) sel.value = '';
  }

  function setDevisContactFields(contact) {
    const c = contact && typeof contact === 'object' ? contact : {};
    const nom = document.getElementById('gderpi-devis-contact-nom');
    const fct = document.getElementById('gderpi-devis-contact-fonction');
    const mail = document.getElementById('gderpi-devis-contact-email');
    const tel = document.getElementById('gderpi-devis-contact-tel');
    if (nom) nom.value = c.contactNom || '';
    if (fct) fct.value = c.contactFonction || '';
    if (mail) mail.value = c.contactEmail || '';
    if (tel) tel.value = c.contactTelephone || '';
  }

  function getDevisContactFromDom() {
    const sel = document.getElementById('gderpi-devis-contact-select');
    let fromSelect = sel?.value?.trim() || selectedContactClientId || '';
    if (fromSelect === '__devis_saved__') fromSelect = '';

    let fields = {
      contactClientId: fromSelect,
      contactNom: document.getElementById('gderpi-devis-contact-nom')?.value?.trim() || '',
      contactService: '',
      contactFonction: document.getElementById('gderpi-devis-contact-fonction')?.value?.trim() || '',
      contactEmail: document.getElementById('gderpi-devis-contact-email')?.value?.trim() || '',
      contactTelephone: document.getElementById('gderpi-devis-contact-tel')?.value?.trim() || ''
    };

    const svcSel = document.getElementById('gderpi-devis-service-select');
    const svc = String(svcSel?.value || selectedDevisService || '').trim();
    if (svc) fields.contactService = svc === 'Sans service' ? '' : svc;

    const client = getClientById(getDevisClientId());
    const contacts = getClientContactsList(client);
    const fromList = fromSelect
      ? contacts.find((c) => String(c.id || c.contactId) === fromSelect)
      : null;
    if (fromList) {
      const resolved = contactToDevisFields(fromList);
      fields = {
        contactClientId: resolved.contactClientId,
        contactNom: fields.contactNom || resolved.contactNom,
        contactService: fields.contactService || resolved.contactService,
        contactFonction: fields.contactFonction || resolved.contactFonction,
        contactEmail: fields.contactEmail || resolved.contactEmail,
        contactTelephone: fields.contactTelephone || resolved.contactTelephone
      };
    }

    return fields;
  }

  async function loadBoutiqueForDevis(boutiqueId) {
    const id = String(boutiqueId || '').trim();
    if (!id) return null;
    const cached = boutiqueDetails.get(id);
    if (cached && Array.isArray(cached.contacts) && cached.slug) return cached;
    const fromList = boutiques.find((b) => String(b.boutiqueId || b.id) === id);
    if (fromList && Array.isArray(fromList.contacts) && fromList.slug) {
      boutiqueDetails.set(id, fromList);
      return fromList;
    }
    const res = await global.GderpiApi.apiCall('/boutiques/' + encodeURIComponent(id));
    boutiqueDetails.set(id, res.data);
    return res.data;
  }

  function getBoutiqueForDevis(boutiqueId) {
    const id = String(boutiqueId || '').trim();
    if (!id) return null;
    if (boutiqueDetails.has(id)) return boutiqueDetails.get(id);
    return boutiques.find((b) => String(b.boutiqueId || b.id) === id) || null;
  }

  function resolveDevisCgvProfilUi() {
    const raw = document.getElementById('gderpi-devis-cgv-profil')?.value || 'auto';
    if (raw === 'b2b' || raw === 'b2c') return raw;
    const client = getClientById(getDevisClientId());
    return client && client.type === 'particulier' ? 'b2c' : 'b2b';
  }

  function buildCgvPublicUrl(boutique, profilUi) {
    const cfg = global.GDERPI_CONFIG || {};
    const eid = String(cfg.entrepriseId || '').trim();
    const slug = String(boutique?.slug || '').trim();
    if (!eid || !slug) return '';
    const base = String(cfg.apiBase || '').replace(/\/$/, '');
    const p = profilUi === 'b2c' ? 'b2c' : 'b2b';
    return base + '/gderpi/public/cgv/' + encodeURIComponent(eid) + '/' + encodeURIComponent(slug) + '?profil=' + p;
  }

  function getDevisCgvFromDom() {
    return {
      cgvProfil: document.getElementById('gderpi-devis-cgv-profil')?.value || 'auto',
      joindreCgvAnnexe: document.getElementById('gderpi-devis-joindre-cgv-annexe')?.checked === true
    };
  }

  function getDevisPaiementFromDom() {
    return {
      conditionsPaiementMoyen: document.getElementById('gderpi-devis-paiement-moyen')?.value || '',
      conditionsPaiementEcheance: document.getElementById('gderpi-devis-paiement-echeance')?.value || '',
      conditionsPaiementComplement: document.getElementById('gderpi-devis-paiement-complement')?.value?.trim() || ''
    };
  }

  function fillDevisPaiementFields(devis) {
    const opts = global.GderpiDevisPaiementOptions;
    if (!opts) return;
    opts.fillSelect(
      document.getElementById('gderpi-devis-paiement-moyen'),
      opts.MOYENS,
      devis?.conditionsPaiementMoyen
    );
    opts.fillSelect(
      document.getElementById('gderpi-devis-paiement-echeance'),
      opts.ECHEANCES,
      devis?.conditionsPaiementEcheance
    );
    const complementEl = document.getElementById('gderpi-devis-paiement-complement');
    if (complementEl) complementEl.value = devis?.conditionsPaiementComplement || '';
    refreshDevisConditionsPreview();
  }

  function applyClientPaiementDefaults(client) {
    if (!client) return;
    const hasDefault = client.conditionsPaiementMoyen || client.conditionsPaiementEcheance
      || client.conditionsPaiementComplement;
    if (!hasDefault) return;
    fillDevisPaiementFields({
      conditionsPaiementMoyen: client.conditionsPaiementMoyen,
      conditionsPaiementEcheance: client.conditionsPaiementEcheance,
      conditionsPaiementComplement: client.conditionsPaiementComplement
    });
  }

  function applyClientBonPourAccordDefault(client) {
    const el = document.getElementById('gderpi-devis-afficher-bon-pour-accord');
    if (!el || !client) return;
    el.checked = client.afficherBonPourAccordParDefaut === true;
  }

  function getDevisAffichageFromDom() {
    return {
      afficherBonPourAccord: document.getElementById('gderpi-devis-afficher-bon-pour-accord')?.checked === true
    };
  }

  function labelPaiementOption(options, value) {
    const pick = String(value || '').trim();
    if (!pick) return '';
    const found = (options || []).find((o) => o.value === pick);
    return found ? found.label : pick;
  }

  function refreshDevisConditionsPreview() {
    const preview = document.getElementById('gderpi-devis-conditions-preview');
    if (!preview) return;
    const opts = global.GderpiDevisPaiementOptions;
    const moyen = labelPaiementOption(opts?.MOYENS, document.getElementById('gderpi-devis-paiement-moyen')?.value);
    const echeance = labelPaiementOption(opts?.ECHEANCES, document.getElementById('gderpi-devis-paiement-echeance')?.value);
    const complement = document.getElementById('gderpi-devis-paiement-complement')?.value?.trim() || '';
    const profilRaw = document.getElementById('gderpi-devis-cgv-profil')?.value || 'auto';
    const profilLabel = profilRaw === 'b2c' ? 'B2C' : profilRaw === 'b2b' ? 'B2B' : 'Auto';
    const annexe = document.getElementById('gderpi-devis-joindre-cgv-annexe')?.checked === true;
    const bpa = document.getElementById('gderpi-devis-afficher-bon-pour-accord')?.checked === true;

    const paiementParts = [];
    if (moyen) paiementParts.push(moyen);
    if (echeance) paiementParts.push(echeance);
    if (complement) paiementParts.push(complement);
    const paiementText = paiementParts.length ? paiementParts.join(' · ') : 'Non précisé';

    const cgvParts = ['CGV ' + profilLabel];
    if (annexe) cgvParts.push('annexe');
    if (bpa) cgvParts.push('bon pour accord');

    preview.textContent = 'Paiement : ' + paiementText + ' — ' + cgvParts.join(', ');
  }

  async function refreshDevisCgvPanel() {
    const hint = document.getElementById('gderpi-devis-cgv-hint');
    const linkWrap = document.getElementById('gderpi-devis-cgv-link-wrap');
    const linkEl = document.getElementById('gderpi-devis-cgv-link');
    const linkMissing = document.getElementById('gderpi-devis-cgv-link-missing');
    const boutiqueId = document.getElementById('gderpi-devis-boutique')?.value || '';
    await loadBoutiqueForDevis(boutiqueId);
    const boutique = getBoutiqueForDevis(boutiqueId);
    const profilUi = resolveDevisCgvProfilUi();
    const profilLabel = profilUi === 'b2c' ? 'B2C — Particuliers' : 'B2B — Professionnels';
    const url = buildCgvPublicUrl(boutique, profilUi);
    const annexe = document.getElementById('gderpi-devis-joindre-cgv-annexe')?.checked === true;

    if (hint) {
      hint.textContent = annexe
        ? 'Pied de page + annexe (' + profilLabel + ').'
        : 'Lien en pied de page (' + profilLabel + ').';
    }
    if (linkWrap && linkEl) {
      if (url) {
        linkEl.href = url;
        linkEl.textContent = 'Consulter les CGV (' + profilLabel + ')';
        linkEl.hidden = false;
        if (linkMissing) linkMissing.hidden = true;
        linkWrap.classList.remove('gderpi-devis-cgv-link-wrap--missing');
      } else {
        linkEl.hidden = true;
        linkEl.removeAttribute('href');
        linkWrap.classList.add('gderpi-devis-cgv-link-wrap--missing');
        if (linkMissing) {
          linkMissing.hidden = false;
          linkMissing.textContent = !boutique
            ? 'Sélectionnez une boutique pour générer le lien CGV.'
            : !String(boutique.slug || '').trim()
              ? 'La boutique n\'a pas d\'identifiant public (slug) — enregistrez-la à nouveau.'
              : 'Impossible de générer le lien CGV (entreprise non identifiée).';
        }
      }
    }
    refreshDevisConditionsPreview();
  }

  function isPlaceholderEmetteurName(nom) {
    const value = String(nom || '').trim().toLowerCase();
    return !value || value === 'contact';
  }

  function getBoutiqueContactsList(boutique) {
    const list = Array.isArray(boutique?.contacts) ? boutique.contacts.filter(Boolean) : [];
    if (list.length) return list;
    if (boutique?.email || boutique?.telephone) {
      return [{
        id: 'legacy',
        nom: '',
        email: boutique.email || '',
        telephone: boutique.telephone || '',
        principal: true
      }];
    }
    return [];
  }

  function emetteurOptionLabel(ct) {
    const name = [ct.prenom, ct.nom].filter(Boolean).join(' ').trim() || ct.nom || 'Contact';
    const extra = [ct.fonction, ct.email].filter(Boolean).join(' — ');
    return extra ? name + ' (' + extra + ')' : name;
  }

  function contactToEmetteurFields(ct) {
    const id = String(ct?.id || ct?.contactId || '').trim();
    return {
      emetteurContactId: id && id !== 'legacy' ? id : '',
      emetteurContactNom: [ct?.prenom, ct?.nom].filter(Boolean).join(' ').trim() || ct?.nom || '',
      emetteurContactFonction: ct?.fonction || '',
      emetteurContactEmail: ct?.email || '',
      emetteurContactTelephone: ct?.telephone || ''
    };
  }

  function setDevisEmetteurFields(fields) {
    const c = fields && typeof fields === 'object' ? fields : {};
    const map = {
      'gderpi-devis-emetteur-contact-id': c.emetteurContactId || '',
      'gderpi-devis-emetteur-contact-nom': c.emetteurContactNom || '',
      'gderpi-devis-emetteur-contact-fonction': c.emetteurContactFonction || '',
      'gderpi-devis-emetteur-contact-email': c.emetteurContactEmail || '',
      'gderpi-devis-emetteur-contact-tel': c.emetteurContactTelephone || ''
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });
  }

  function getDevisEmetteurFromDom() {
    const sel = document.getElementById('gderpi-devis-emetteur-select');
    let fromSelect = sel?.value?.trim() || selectedEmetteurContactId || '';
    if (fromSelect === 'legacy') fromSelect = '';

    let fields = {
      emetteurContactId: fromSelect,
      emetteurContactNom: document.getElementById('gderpi-devis-emetteur-contact-nom')?.value?.trim() || '',
      emetteurContactFonction: document.getElementById('gderpi-devis-emetteur-contact-fonction')?.value?.trim() || '',
      emetteurContactEmail: document.getElementById('gderpi-devis-emetteur-contact-email')?.value?.trim() || '',
      emetteurContactTelephone: document.getElementById('gderpi-devis-emetteur-contact-tel')?.value?.trim() || ''
    };

    const boutiqueId = document.getElementById('gderpi-devis-boutique')?.value || '';
    const contacts = getBoutiqueContactsList(getBoutiqueForDevis(boutiqueId));
    const fromList = fromSelect
      ? contacts.find((c) => String(c.id || c.contactId) === fromSelect)
      : null;
    if (fromList) {
      const resolved = contactToEmetteurFields(fromList);
      fields = {
        emetteurContactId: resolved.emetteurContactId,
        emetteurContactNom: resolved.emetteurContactNom || fields.emetteurContactNom,
        emetteurContactFonction: resolved.emetteurContactFonction || fields.emetteurContactFonction,
        emetteurContactEmail: resolved.emetteurContactEmail || fields.emetteurContactEmail,
        emetteurContactTelephone: resolved.emetteurContactTelephone || fields.emetteurContactTelephone
      };
    }
    return fields;
  }

  function refreshEmetteurSelect(boutiqueId, preferredId, savedFields) {
    const sel = document.getElementById('gderpi-devis-emetteur-select');
    if (!sel) return;
    const contacts = getBoutiqueContactsList(getBoutiqueForDevis(boutiqueId));
    if (!boutiqueId || !contacts.length) {
      sel.innerHTML = '<option value="">' + (boutiqueId ? '— Aucun contact —' : '— Boutique requise —') + '</option>';
      sel.disabled = true;
      return;
    }
    sel.disabled = !isEditable();
    sel.innerHTML = contacts.map((ct) => {
      const id = String(ct.id || ct.contactId || '');
      return '<option value="' + esc(id) + '">' + esc(emetteurOptionLabel(ct)) + '</option>';
    }).join('');
    const pick = String(preferredId || savedFields?.emetteurContactId || selectedEmetteurContactId || '').trim();
    if (pick && contacts.some((ct) => String(ct.id || ct.contactId) === pick)) {
      sel.value = pick;
      selectedEmetteurContactId = pick;
      return;
    }
    const principal = contacts.find((ct) => ct.principal) || contacts[0];
    const id = String(principal?.id || principal?.contactId || '');
    sel.value = id;
    selectedEmetteurContactId = id;
    if (!savedFields?.emetteurContactNom || isPlaceholderEmetteurName(savedFields.emetteurContactNom)) {
      applyEmetteurFromSelect(id);
    }
  }

  function applyEmetteurFromSelect(contactId) {
    const boutiqueId = document.getElementById('gderpi-devis-boutique')?.value || '';
    const contacts = getBoutiqueContactsList(getBoutiqueForDevis(boutiqueId));
    if (!contactId) {
      selectedEmetteurContactId = '';
      setDevisEmetteurFields({
        emetteurContactId: '',
        emetteurContactNom: '',
        emetteurContactFonction: '',
        emetteurContactEmail: '',
        emetteurContactTelephone: ''
      });
      return;
    }
    const ct = contacts.find((c) => String(c.id || c.contactId) === String(contactId));
    selectedEmetteurContactId = String(contactId);
    if (!ct) return;
    setDevisEmetteurFields(contactToEmetteurFields(ct));
    const sel = document.getElementById('gderpi-devis-emetteur-select');
    if (sel) sel.value = String(contactId);
  }

  async function applyBoutiqueToDevisForm(boutiqueId, options) {
    const opts = options && typeof options === 'object' ? options : {};
    await loadBoutiqueForDevis(boutiqueId);
    refreshEmetteurSelect(boutiqueId, opts.emetteurContactId, opts.savedEmetteur);
    if (opts.savedEmetteur?.emetteurContactNom && !isPlaceholderEmetteurName(opts.savedEmetteur.emetteurContactNom)) {
      setDevisEmetteurFields(opts.savedEmetteur);
    } else if (opts.applyDefaultContact !== false) {
      applyEmetteurFromSelect(document.getElementById('gderpi-devis-emetteur-select')?.value || '');
    }
  }

  async function applyClientToDevisForm(clientId, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const applyDefaultContact = opts.applyDefaultContact !== false;
    const contactClientId = opts.contactClientId;
    const savedContact = opts.savedContact;
    const preferredService = opts.contactService != null
      ? opts.contactService
      : savedContact?.contactService;

    await refreshServiceSelect(clientId, preferredService, savedContact);
    refreshContactSelect(
      clientId,
      contactClientId != null ? contactClientId : undefined,
      savedContact,
      selectedDevisService
    );

    if (!applyDefaultContact) return;

    const client = getClientById(clientId);
    const contacts = getClientContactsList(client);
    if (!contacts.length) {
      setDevisContactFields({
        contactClientId: '',
        contactNom: '',
        contactService: '',
        contactFonction: '',
        contactEmail: '',
        contactTelephone: ''
      });
      return;
    }

    let ct = null;
    if (contactClientId) {
      ct = contacts.find((c) => String(c.id || c.contactId) === String(contactClientId));
    }
    if (!ct && isClientEntreprise(client) && selectedDevisService) {
      const scoped = filterContactsByService(contacts, selectedDevisService);
      ct = scoped.find((c) => c.principal) || scoped[0];
    }
    if (!ct) ct = contacts.find((c) => c.principal) || contacts[0];
    if (!ct) return;

    const fields = contactToDevisFields(ct);
    if (isClientEntreprise(client) && selectedDevisService) {
      fields.contactService = selectedDevisService === 'Sans service' ? '' : selectedDevisService;
    }
    selectedContactClientId = fields.contactClientId || String(ct.id || ct.contactId || '');
    const sel = document.getElementById('gderpi-devis-contact-select');
    if (sel && selectedContactClientId) sel.value = selectedContactClientId;
    setDevisContactFields(fields);
  }

  function clientLabel(id) {
    const c = clients.find((x) => String(x.clientId || x.id) === String(id));
    if (!c) return id || '—';
    return global.GderpiClientSearch?.clientFieldLabel(c) || c.displayName || id;
  }

  function devisSortColumn(key) {
    const cols = {
      numero: { type: 'string', get: (d) => d.numero || '' },
      date: { type: 'date', get: (d) => d.createdAt || d.updatedAt || '' },
      client: { type: 'string', get: (d) => clientLabel(d.clientId) },
      referenceClient: { type: 'string', get: (d) => d.documentClient || d.referenceClient || '' },
      documentClient: { type: 'string', get: (d) => d.documentClient || d.referenceClient || '' },
      commande: { type: 'string', get: (d) => d.commandeClientNumero || '' },
      objet: { type: 'string', get: (d) => d.objet || '' },
      statut: { type: 'string', get: (d) => d.statut || '' },
      totalTtc: { type: 'number', get: (d) => Number(d.totaux?.totalTtc) || 0 }
    };
    return cols[key] || null;
  }

  function compareDevisRows(a, b) {
    const col = devisSortColumn(devisSort.key);
    if (!col) return 0;
    const dir = devisSort.dir === 'asc' ? 1 : -1;
    const va = col.get(a);
    const vb = col.get(b);
    if (col.type === 'number') {
      return (Number(va) - Number(vb)) * dir;
    }
    if (col.type === 'date') {
      const da = va ? new Date(va).getTime() : 0;
      const db = vb ? new Date(vb).getTime() : 0;
      return (da - db) * dir;
    }
    return String(va || '').localeCompare(String(vb || ''), 'fr', { sensitivity: 'base', numeric: true }) * dir;
  }

  function sortDevisRows(list) {
    return [...list].sort(compareDevisRows);
  }

  function filterDevisRowsLocal(list, q) {
    const query = String(q || '').trim().toLowerCase();
    if (!query) return list;
    return list.filter((d) => {
      const hay = [
        d.numero, d.objet, d.notes, d.documentClient, d.referenceClient, d.commandeClientNumero,
        d.contactNom, clientLabel(d.clientId), d.statut
      ].join(' ').toLowerCase();
      return hay.includes(query);
    });
  }

  function updateDevisSortHeaderUi() {
    document.querySelectorAll('[data-devis-sort]').forEach((btn) => {
      const key = btn.getAttribute('data-devis-sort');
      const active = key === devisSort.key;
      btn.classList.toggle('is-active', active);
      btn.classList.toggle('is-asc', active && devisSort.dir === 'asc');
      btn.classList.toggle('is-desc', active && devisSort.dir === 'desc');
    });
  }

  function bindDevisSortHeaders() {
    document.querySelectorAll('[data-devis-sort]').forEach((btn) => {
      if (btn.dataset.gderpiDevisSortBound) return;
      btn.dataset.gderpiDevisSortBound = '1';
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const key = btn.getAttribute('data-devis-sort');
        if (!key) return;
        if (devisSort.key === key) {
          devisSort.dir = devisSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          devisSort.key = key;
          const col = devisSortColumn(key);
          devisSort.dir = col?.type === 'number' || col?.type === 'date' ? 'desc' : 'asc';
        }
        updateDevisSortHeaderUi();
        renderDevisTable();
      });
    });
    updateDevisSortHeaderUi();
  }

  function confirmStatusChange(fromStatut, toStatut) {
    const toLabel = STATUT_LABELS[toStatut] || toStatut;
    const fromLabel = STATUT_LABELS[fromStatut] || fromStatut;
    if (fromStatut === toStatut) return false;
    if (toStatut === 'accepte') {
      return confirm(
        'Valider ce devis et le transférer vers une commande client ?' +
        (fromLabel ? '\n\nStatut actuel : ' + fromLabel : '') +
        '\n\nÊtes-vous sûr ?'
      );
    }
    return confirm(
      'Vous allez passer ce devis au statut « ' + toLabel + ' »' +
      (fromLabel ? ' (actuellement : ' + fromLabel + ')' : '') +
      '.\n\nÊtes-vous sûr ?'
    );
  }

  function renderStatutControl(d) {
    const id = d.devisId || d.id;
    const s = String(d.statut || 'brouillon');
    if (!canWrite()) return statutBadge(s);
    const opts = STATUT_ORDER.map((st) =>
      '<option value="' + esc(st) + '"' + (st === s ? ' selected' : '') + '>' + esc(STATUT_LABELS[st] || st) + '</option>'
    ).join('');
    return '<select class="form-control form-control-sm gderpi-devis-statut-select gderpi-devis-statut-select--' + esc(s) + '" ' +
      'data-devis-id="' + esc(id) + '" data-current-statut="' + esc(s) + '" title="Changer le statut">' + opts + '</select>';
  }

  function renderDevisListActions(d) {
    const id = d.devisId || d.id;
    const s = String(d.statut || 'brouillon');
    let html = '';
    if (!canWrite()) return html;
    if (s === 'brouillon' || s === 'envoye') {
      html += '<button type="button" class="btn btn-outline btn-sm gderpi-devis-list-email" data-devis-id="' + esc(id) + '">' +
        (s === 'envoye' ? 'Renvoyer' : 'E-mail') + '</button> ';
    }
    if (s === 'accepte' && !d.commandeClientId) {
      html += '<button type="button" class="btn btn-primary btn-sm gderpi-devis-list-cmd" data-devis-id="' + esc(id) + '">→ Cmd</button> ';
    }
    if (d.commandeClientId) {
      html += '<button type="button" class="btn btn-outline btn-sm gderpi-devis-list-view-cmd" data-cmd-id="' + esc(d.commandeClientId) + '">Cmd</button> ';
    }
    if (s === 'brouillon') {
      html += '<button type="button" class="btn btn-outline-danger btn-sm gderpi-devis-delete">Suppr.</button>';
    }
    return html;
  }

  function renderDevisTable() {
    const tbody = document.getElementById('gderpi-devis-tbody');
    const count = document.getElementById('gderpi-devis-count');
    const rows = sortDevisRows(devisList);
    if (count) count.textContent = rows.length + ' élément(s)';
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-muted">Aucun devis.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((d) => {
      const id = d.devisId || d.id;
      return '<tr data-gderpi-lc-row data-devis-id="' + esc(id) + '">' +
        '<td><strong>' + esc(d.numero) + '</strong></td>' +
        '<td class="text-nowrap">' + esc(fmtDate(d.createdAt || d.updatedAt)) + '</td>' +
        '<td>' + esc(clientLabel(d.clientId)) + '</td>' +
        '<td>' + esc(d.documentClient || d.referenceClient || '—') + '</td>' +
        '<td>' + (d.pmCardId
          ? '<span class="gderpi-devis-pm-badge" title="Carte PM liée">PM</span> '
          : '') + esc(d.objet || '—') + '</td>' +
        '<td class="gderpi-devis-statut-cell" onclick="event.stopPropagation()">' + renderStatutControl(d) + '</td>' +
        '<td>' + (d.commandeClientId
          ? '<button type="button" class="btn btn-link btn-sm p-0 gderpi-devis-list-view-cmd" data-cmd-id="' + esc(d.commandeClientId) + '">' +
            esc(d.commandeClientNumero || 'Voir') + '</button>'
          : '—') + '</td>' +
        '<td class="text-end">' + fmt(d.totaux?.totalTtc) + '</td>' +
        '<td class="text-nowrap gderpi-devis-list-actions" onclick="event.stopPropagation()">' +
          renderDevisListActions(d) +
        '</td></tr>';
    }).join('');
    tbody.querySelectorAll('tr[data-devis-id]').forEach((row) => {
      const id = row.getAttribute('data-devis-id');
      const devis = devisList.find((d) => String(d.devisId || d.id) === String(id));
      const open = () => openDevis(id);
      row.addEventListener('dblclick', open);
      row.querySelector('.gderpi-devis-delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteDevisById(id).catch(handleErr);
      });
      row.querySelector('.gderpi-devis-list-email')?.addEventListener('click', (e) => {
        e.stopPropagation();
        sendDevisEmailById(id, devis).catch(handleErr);
      });
      row.querySelector('.gderpi-devis-list-cmd')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toCommandeClientById(id).catch(handleErr);
      });
      row.querySelector('.gderpi-devis-list-view-cmd')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const cmdId = row.querySelector('.gderpi-devis-list-view-cmd')?.getAttribute('data-cmd-id');
        if (cmdId) global.GderpiCommandeClientEditor?.openCommande?.(cmdId).catch(handleErr);
      });
      const statutSel = row.querySelector('.gderpi-devis-statut-select');
      if (statutSel) {
        statutSel.addEventListener('change', () => {
          const prev = statutSel.getAttribute('data-current-statut') || statutSel.value;
          const next = statutSel.value;
          if (next === prev) return;
          changeDevisStatusById(id, next, { fromList: true })
            .then((updated) => {
              if (!updated) statutSel.value = prev;
            })
            .catch((err) => {
              statutSel.value = prev;
              handleErr(err);
            });
        });
      }
    });
  }

  function isLineEmpty(line) {
    return !String(line?.libelle || '').trim() &&
      !String(line?.reference || '').trim() &&
      !String(line?.description || '').trim();
  }

  function resolveRefClientForArticle(article) {
    const clientId = getDevisClientId();
    if (global.GderpiArticleTarif?.resolveArticleTarifClient) {
      return global.GderpiArticleTarif.resolveArticleTarifClient(article, clientId).reference;
    }
    if (!clientId || !article) return '';
    const list = Array.isArray(article.refsClient) ? article.refsClient : [];
    const match = list.find((r) => String(r.clientId || '').trim() === clientId);
    return match ? String(match.reference || '').trim() : '';
  }

  function buildLineDescription(article) {
    const parts = [];
    if (article?.description) parts.push(String(article.description).trim());
    if (article?.commentaire) parts.push(String(article.commentaire).trim());
    return parts.join('\n\n');
  }

  function isDevLine(line) {
    return String(line?.articleType || '').toLowerCase() === 'developpement';
  }

  function isEditable() {
    return canWrite() && (isLocalDraft || currentDevis?.statut === 'brouillon');
  }

  function markDirty() {
    if (isEditable()) isDirty = true;
  }

  function ensureEditorModal() {
    if (editorModal) return editorModal;
    const el = document.getElementById('gderpi-devis-editor');
    if (!el || !global.GderpiModal) return null;
    editorModal = global.GderpiModal.enhance(el, {
      size: 'xl',
      variant: 'devis',
      hideHeader: true,
      onBackdrop: () => { goBackToList().catch(handleErr); }
    });
    return editorModal;
  }

  function ensurePreviewModal() {
    if (previewModal) return previewModal;
    const el = document.getElementById('gderpi-devis-preview-modal');
    if (!el || !global.GderpiModal) return null;
    previewModal = global.GderpiModal.enhance(el, {
      title: 'Aperçu devis',
      onClose: () => {
        const iframe = document.getElementById('gderpi-devis-preview-iframe');
        if (iframe) iframe.srcdoc = '';
      }
    });
    return previewModal;
  }

  function showList() {
    destroyLineBindings();
    ensureEditorModal()?.close();
    editingId = '';
    currentDevis = null;
    lines = [];
    isLocalDraft = false;
    isDirty = false;
  }

  async function goBackToList() {
    if (isLocalDraft) {
      showList();
      await refreshDevisList();
      return;
    }
    if (isDirty && isEditable()) {
      if (!confirm('Modifications non enregistrées. Quitter sans enregistrer ?')) return;
    }
    showList();
    await refreshDevisList();
  }

  function showEditor() {
    ensureEditorModal()?.open();
  }

  function destroyLineBindings() {
    lineSearchBindings.forEach((b) => b?.destroy?.());
    lineSearchBindings = [];
  }

  function calcLineTotals(line) {
    const qty = Number(line.quantite) || 0;
    const prix = Number(line.prixHt) || 0;
    const rem = Number(line.remisePct) || 0;
    const ht = Math.round(qty * prix * (1 - rem / 100) * 100) / 100;
    return { ...line, montantHt: ht };
  }

  function getFraisPortFromDom() {
    const ht = Number(document.getElementById('gderpi-devis-frais-port-ht')?.value) || 0;
    const tva = Number(document.getElementById('gderpi-devis-frais-port-tva')?.value);
    return {
      fraisPortHt: ht > 0 ? Math.round(ht * 100) / 100 : 0,
      fraisPortTauxTva: ht > 0 && Number.isFinite(tva) ? tva : 20
    };
  }

  function calcDocTotals() {
    let lignesHt = 0;
    let totalTva = 0;
    lines.filter((l) => !isLineEmpty(l)).forEach((l) => {
      const line = calcLineTotals(l);
      lignesHt += line.montantHt;
      totalTva += line.montantHt * (Number(line.tauxTva) || 0) / 100;
    });
    const frais = getFraisPortFromDom();
    if (frais.fraisPortHt > 0) {
      lignesHt += frais.fraisPortHt;
      totalTva += frais.fraisPortHt * frais.fraisPortTauxTva / 100;
    }
    const totalHt = Math.round(lignesHt * 100) / 100;
    totalTva = Math.round(totalTva * 100) / 100;
    return { totalHt, totalTva, totalTtc: Math.round((totalHt + totalTva) * 100) / 100 };
  }

  function renderFraisPortRow() {
    const row = document.getElementById('gderpi-devis-frais-port-row');
    const frais = getFraisPortFromDom();
    const showDisplay = !isEditable() && frais.fraisPortHt > 0;
    if (row) row.hidden = !showDisplay;
    const cell = document.getElementById('gderpi-devis-frais-port-display');
    if (cell && frais.fraisPortHt > 0) cell.textContent = fmt(frais.fraisPortHt);
  }

  function renderTotals() {
    const t = calcDocTotals();
    renderFraisPortRow();
    const ht = document.getElementById('gderpi-devis-total-ht');
    const tva = document.getElementById('gderpi-devis-total-tva');
    const ttc = document.getElementById('gderpi-devis-total-ttc');
    if (ht) ht.textContent = fmt(t.totalHt);
    if (tva) tva.textContent = fmt(t.totalTva);
    if (ttc) ttc.textContent = fmt(t.totalTtc);
  }

  function articleFromCatalog(a) {
    const clientId = getDevisClientId();
    const tarif = global.GderpiArticleTarif?.resolveArticleTarifClient
      ? global.GderpiArticleTarif.resolveArticleTarifClient(a, clientId)
      : { reference: resolveRefClientForArticle(a), prixHt: Number(a.prixHt) || 0, prixSurDevis: a.prixSurDevis === true };
    return calcLineTotals({
      articleId: a.articleId || a.id,
      articleType: a.type || '',
      reference: a.reference || '',
      referenceClient: tarif.reference || resolveRefClientForArticle(a),
      libelle: a.libelle || '',
      description: buildLineDescription(a),
      commentaire: a.commentaire || '',
      unite: a.unite || 'piece',
      quantite: 1,
      prixHt: tarif.prixSurDevis ? 0 : (Number(tarif.prixHt) || 0),
      remisePct: 0,
      tauxTva: a.tauxTva ?? 20,
      fournisseurId: a.fournisseurId || null,
      boutiqueFournisseurId: a.boutiqueFournisseurId || null,
      prixSurDevis: tarif.prixSurDevis === true
    });
  }

  function ensureTrailingEmptyLine() {
    if (!isEditable()) return false;
    if (!lines.length || !isLineEmpty(lines[lines.length - 1])) {
      lines.push(emptyLine());
      return true;
    }
    return false;
  }

  function readLineFromDom(idx, row) {
    const detailRow = row.nextElementSibling?.matches('[data-line-detail-idx]')
      ? row.nextElementSibling
      : document.querySelector('[data-line-detail-idx="' + idx + '"]');
    return calcLineTotals({
      ...lines[idx],
      reference: row.querySelector('.gderpi-devis-line-ref')?.value?.trim() || '',
      referenceClient: row.querySelector('.gderpi-devis-line-ref-client')?.value?.trim() || '',
      libelle: row.querySelector('.gderpi-devis-line-libelle')?.value?.trim() || '',
      description: detailRow?.querySelector('.gderpi-devis-line-description')?.value?.trim() || '',
      unite: row.querySelector('.gderpi-devis-line-unite')?.value?.trim() || 'piece',
      quantite: row.querySelector('.gderpi-devis-line-qty')?.value,
      prixHt: row.querySelector('.gderpi-devis-line-prix')?.value,
      remisePct: row.querySelector('.gderpi-devis-line-rem')?.value,
      tauxTva: row.querySelector('.gderpi-devis-line-tva')?.value
    });
  }

  function syncAllLinesFromDom() {
    const tbody = document.getElementById('gderpi-devis-lines-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('[data-line-idx]').forEach((row) => {
      const idx = Number(row.getAttribute('data-line-idx'));
      if (!Number.isFinite(idx) || idx < 0 || idx >= lines.length) return;
      lines[idx] = readLineFromDom(idx, row);
    });
  }

  function syncLineFromRow(idx, row) {
    const wasEmpty = isLineEmpty(lines[idx]);
    lines[idx] = readLineFromDom(idx, row);
    markDirty();
    if (ensureTrailingEmptyLine()) {
      renderLines();
      return;
    }
    if (wasEmpty && !isLineEmpty(lines[idx])) {
      renderLines();
      return;
    }
    updateRowAmount(row, lines[idx]);
    renderTotals();
  }

  function updateRowAmount(row, line) {
    const cell = row.querySelector('.gderpi-devis-line-amount');
    if (cell) cell.textContent = fmt(calcLineTotals(line).montantHt);
  }

  function applyArticleToLine(idx, article, focusQty) {
    lines[idx] = articleFromCatalog(article);
    markDirty();
    ensureTrailingEmptyLine();
    renderLines();
    const isDev = String(article?.type || '').toLowerCase() === 'developpement';
    const row = document.querySelector('[data-line-idx="' + idx + '"]');
    if (isDev) {
      const desc = document.querySelector('[data-line-detail-idx="' + idx + '"] .gderpi-devis-line-description');
      if (desc) { desc.focus(); return; }
    }
    if (focusQty) {
      const qty = row?.querySelector('.gderpi-devis-line-qty');
      if (qty) { qty.focus(); qty.select(); }
    }
  }

  function renderLineDescriptionBlock(l, idx, editable) {
    if (editable && isLineEmpty(l)) return '';
    const text = String(l.description || '').trim();
    if (!editable && !text) return '';
    const dev = isDevLine(l);
    const label = dev ? 'Description / précisions (développement)' : 'Description';
    const rows = dev ? 4 : 2;
    const placeholder = dev
      ? 'Détaillez la prestation : périmètre, livrables, hypothèses…'
      : 'Description affichée sur le devis (optionnel)';
    if (!editable) {
      return '<tr class="gderpi-devis-line-detail"><td colspan="10">' +
        '<div class="gderpi-devis-line-desc-read">' + esc(text).replace(/\n/g, '<br>') + '</div></td></tr>';
    }
    return '<tr data-line-detail-idx="' + idx + '" class="gderpi-devis-line-detail' + (dev ? ' gderpi-devis-line-detail--dev' : '') + '">' +
      '<td colspan="10">' +
      '<label class="gderpi-devis-line-desc-label">' + esc(label) + '</label>' +
      '<textarea class="form-control gderpi-devis-line-description" rows="' + rows + '" placeholder="' + esc(placeholder) + '">' + esc(l.description || '') + '</textarea>' +
      '</td></tr>';
  }

  function renderReadonlyLine(l, idx) {
    return '<tr>' +
      '<td>' + esc(l.reference || '—') + '</td>' +
      '<td>' + esc(l.referenceClient || '—') + '</td>' +
      '<td>' + esc(l.libelle) + '</td>' +
      '<td>' + esc(l.unite) + '</td>' +
      '<td class="text-end">' + esc(l.quantite) + '</td>' +
      '<td class="text-end">' + fmt(l.prixHt) + '</td>' +
      '<td class="text-end">' + esc(l.remisePct) + '</td>' +
      '<td class="text-end">' + esc(l.tauxTva) + '%</td>' +
      '<td class="text-end">' + fmt(l.montantHt) + '</td>' +
      '<td></td></tr>' +
      renderLineDescriptionBlock(l, idx, false);
  }

  function renderEditableLine(l, idx) {
    if (isLineEmpty(l)) {
      return '<tr data-line-idx="' + idx + '" class="gderpi-devis-line-main gderpi-devis-line--draft">' +
        '<td><input class="form-control gderpi-devis-line-ref" type="text" value="' + esc(l.reference) + '" placeholder="Réf. interne" autocomplete="off"></td>' +
        '<td><input class="form-control gderpi-devis-line-ref-client" type="text" value="' + esc(l.referenceClient) + '" placeholder="Réf. client" autocomplete="off"></td>' +
        '<td colspan="7"><input class="form-control gderpi-devis-line-libelle gderpi-devis-line-libelle--draft" type="text" value="' + esc(l.libelle) + '" placeholder="Libellé — tapez pour chercher" autocomplete="off"></td>' +
        '</tr>';
    }
    const prixRequired = l.prixSurDevis ? ' required' : '';
    const prixPlaceholder = l.prixSurDevis ? 'Prix obligatoire' : '';
    const devClass = isDevLine(l) ? ' gderpi-devis-line--dev' : '';
    return '<tr data-line-idx="' + idx + '" class="gderpi-devis-line-main' + devClass + '">' +
      '<td><input class="form-control gderpi-devis-line-ref" type="text" value="' + esc(l.reference) + '" placeholder="Réf. interne" autocomplete="off"></td>' +
      '<td><input class="form-control gderpi-devis-line-ref-client" type="text" value="' + esc(l.referenceClient) + '" placeholder="Réf. client" autocomplete="off"></td>' +
      '<td><input class="form-control gderpi-devis-line-libelle" type="text" value="' + esc(l.libelle) + '" placeholder="Libellé — tapez pour chercher" autocomplete="off"></td>' +
      '<td><input class="form-control gderpi-devis-line-unite" type="text" value="' + esc(l.unite) + '" title="Unité"></td>' +
      '<td><input class="form-control gderpi-devis-line-qty text-end" type="number" min="0.01" step="0.01" value="' + esc(l.quantite) + '"></td>' +
      '<td><input class="form-control gderpi-devis-line-prix text-end" type="number" min="0" step="0.01" value="' + esc(l.prixHt) + '" placeholder="' + esc(prixPlaceholder) + '"' + prixRequired + '></td>' +
      '<td><input class="form-control gderpi-devis-line-rem text-end" type="number" min="0" max="100" step="0.1" value="' + esc(l.remisePct) + '"></td>' +
      '<td><input class="form-control gderpi-devis-line-tva text-end" type="number" min="0" step="0.1" value="' + esc(l.tauxTva) + '"></td>' +
      '<td class="text-end gderpi-devis-line-amount">' + fmt(l.montantHt) + '</td>' +
      '<td>' + (isLineEmpty(l) ? '' : '<button type="button" class="btn btn-outline-danger btn-sm gderpi-devis-line-remove" title="Supprimer">×</button>') + '</td>' +
      '</tr>' +
      renderLineDescriptionBlock(l, idx, true);
  }

  function bindEditableRows() {
    destroyLineBindings();
    const tbody = document.getElementById('gderpi-devis-lines-tbody');
    if (!tbody) return;

    tbody.querySelectorAll('[data-line-idx]').forEach((row) => {
      const idx = Number(row.getAttribute('data-line-idx'));

      const refInput = row.querySelector('.gderpi-devis-line-ref');
      const libInput = row.querySelector('.gderpi-devis-line-libelle');

      const searchOpts = {
        getArticles: () => articles,
        onSelect: (article) => applyArticleToLine(idx, article, true),
        onInput: (value) => {
          const merged = readLineFromDom(idx, row);
          lines[idx] = {
            ...merged,
            reference: refInput === document.activeElement ? value : merged.reference,
            libelle: libInput === document.activeElement ? value : merged.libelle,
            articleId: null,
            articleType: ''
          };
        }
      };

      if (refInput) lineSearchBindings.push(bindSearch(refInput, searchOpts));
      if (libInput) lineSearchBindings.push(bindSearch(libInput, searchOpts));

      row.querySelectorAll('.gderpi-devis-line-qty, .gderpi-devis-line-prix, .gderpi-devis-line-rem, .gderpi-devis-line-tva, .gderpi-devis-line-unite, .gderpi-devis-line-ref-client').forEach((inp) => {
        inp.addEventListener('input', () => syncLineFromRow(idx, row));
      });

      const detailRow = row.nextElementSibling?.matches('[data-line-detail-idx]') ? row.nextElementSibling : null;
      const descInput = detailRow?.querySelector('.gderpi-devis-line-description');
      descInput?.addEventListener('input', () => syncLineFromRow(idx, row));
      descInput?.addEventListener('blur', () => syncLineFromRow(idx, row));

      refInput?.addEventListener('change', () => syncLineFromRow(idx, row));
      libInput?.addEventListener('change', () => {
        syncLineFromRow(idx, row);
        if (!isLineEmpty(lines[idx])) renderLines();
      });

      row.querySelector('.gderpi-devis-line-remove')?.addEventListener('click', () => {
        lines.splice(idx, 1);
        markDirty();
        ensureTrailingEmptyLine();
        renderLines();
      });
    });

    tbody.querySelectorAll('[data-line-detail-idx]').forEach((detailRow) => {
      const idx = Number(detailRow.getAttribute('data-line-detail-idx'));
      const mainRow = tbody.querySelector('[data-line-idx="' + idx + '"]');
      if (!mainRow) return;
      const descInput = detailRow.querySelector('.gderpi-devis-line-description');
      descInput?.addEventListener('input', () => syncLineFromRow(idx, mainRow));
      descInput?.addEventListener('blur', () => syncLineFromRow(idx, mainRow));
    });
  }

  function renderLines() {
    const tbody = document.getElementById('gderpi-devis-lines-tbody');
    if (!tbody) return;
    const editable = isEditable();
    const displayLines = editable ? lines : lines.filter((l) => !isLineEmpty(l));

    if (!displayLines.length) {
      tbody.innerHTML = '<tr><td colspan="10" class="text-muted">Aucune ligne.</td></tr>';
      renderTotals();
      return;
    }

    tbody.innerHTML = displayLines.map((line, idx) => {
      const l = calcLineTotals(line);
      return editable ? renderEditableLine(l, idx) : renderReadonlyLine(l, idx);
    }).join('');

    if (editable) bindEditableRows();
    renderTotals();
  }

  async function populateSelects(opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    const skipDevisForm = options.skipDevisForm === true;

    const bSel = document.getElementById('gderpi-devis-boutique');
    const bFilter = document.getElementById('gderpi-devis-filter-boutique');

    const savedBoutique = bSel?.value || '';
    const savedClient = getDevisClientId();
    const savedContactFields = skipDevisForm ? null : getDevisContactFromDom();
    const savedEmetteurFields = skipDevisForm ? null : getDevisEmetteurFromDom();

    if (bSel) {
      bSel.innerHTML = boutiques.map((b) =>
        '<option value="' + esc(b.boutiqueId || b.id) + '">' + esc(b.nom) + '</option>'
      ).join('');
    }
    if (bFilter) {
      bFilter.innerHTML = '<option value="">Toutes boutiques</option>' + boutiques.map((b) =>
        '<option value="' + esc(b.boutiqueId || b.id) + '">' + esc(b.nom) + '</option>'
      ).join('');
    }

    if (bSel && savedBoutique) bSel.value = savedBoutique;
    if (!skipDevisForm && savedBoutique) {
      await loadBoutiqueForDevis(savedBoutique);
      refreshEmetteurSelect(savedBoutique, selectedEmetteurContactId, savedEmetteurFields);
      if (savedEmetteurFields?.emetteurContactNom) {
        setDevisEmetteurFields(savedEmetteurFields);
      }
    }
    if (savedClient && !skipDevisForm) {
      setDevisClientId(savedClient);
      const contactId = savedContactFields?.contactClientId
        || document.getElementById('gderpi-devis-contact-select')?.value
        || selectedContactClientId
        || '';
      const service = savedContactFields?.contactService
        || document.getElementById('gderpi-devis-service-select')?.value
        || selectedDevisService
        || '';
      await refreshServiceSelect(savedClient, service, savedContactFields);
      refreshContactSelect(savedClient, contactId, savedContactFields, selectedDevisService);
      if (savedContactFields?.contactNom) {
        setDevisContactFields(savedContactFields);
      }
    }
  }

  async function ensureRefs(opts) {
    const [bRes, cRes, aRes] = await Promise.all([
      global.GderpiApi.apiCall('/boutiques'),
      global.GderpiApi.apiCall('/clients?lite=1'),
      global.GderpiApi.apiCall('/articles')
    ]);
    boutiques = bRes.data || [];
    clients = cRes.data || [];
    articles = aRes.data || [];
    populateSelects(opts);
  }

  function statutBadge(statut) {
    const s = String(statut || 'brouillon');
    return '<span class="gderpi-badge-statut gderpi-badge-statut--' + esc(s) + '">' + esc(STATUT_LABELS[s] || s) + '</span>';
  }

  function renderActions() {
    const wrap = document.getElementById('gderpi-devis-editor-actions');
    if (!wrap || !currentDevis) { if (wrap) wrap.innerHTML = ''; return; }
    const s = currentDevis.statut;
    let html = '';
    if (canWrite()) {
      if (s === 'brouillon') {
        html += '<button type="button" class="btn btn-primary btn-sm" id="gderpi-devis-save">' +
          (isLocalDraft ? 'Enregistrer le devis' : 'Enregistrer') + '</button>';
        if (!isLocalDraft && editingId) {
          html += '<button type="button" class="btn btn-success btn-sm" id="gderpi-devis-email-client">Envoyer au client</button>';
          html += '<button type="button" class="btn btn-outline btn-sm" id="gderpi-devis-send">Marquer envoyé</button>';
          html += '<button type="button" class="btn btn-outline-danger btn-sm" id="gderpi-devis-delete">Supprimer</button>';
        }
        if (isLocalDraft) {
          html += '<button type="button" class="btn btn-outline btn-sm" id="gderpi-devis-cancel-draft">Annuler</button>';
        }
      }
      if (s === 'envoye') {
        html += '<button type="button" class="btn btn-outline btn-sm" id="gderpi-devis-email-client">Renvoyer au client</button>';
        html += '<button type="button" class="btn btn-success btn-sm" id="gderpi-devis-accept">Accepter</button>';
        html += '<button type="button" class="btn btn-outline-danger btn-sm" id="gderpi-devis-refuse">Refuser</button>';
        html += '<button type="button" class="btn btn-outline btn-sm" id="gderpi-devis-expire">Expiré</button>';
      }
      if (s === 'accepte' && !currentDevis.commandeClientId) {
        html += '<button type="button" class="btn btn-primary btn-sm" id="gderpi-devis-to-cmd">→ Commande client</button>';
      }
      if (currentDevis.commandeClientId) {
        html += '<button type="button" class="btn btn-outline btn-sm" id="gderpi-devis-view-cmd">Voir commande</button>';
      }
    }
    if (editingId && !isLocalDraft) {
      html += '<button type="button" class="btn btn-outline btn-sm" id="gderpi-devis-download-pdf">Télécharger PDF</button>';
      html += '<button type="button" class="btn btn-outline btn-sm" id="gderpi-devis-preview-html">Aperçu HTML</button>';
    }
    wrap.innerHTML = html;
    wrap.querySelector('#gderpi-devis-save')?.addEventListener('click', saveDevis);
    wrap.querySelector('#gderpi-devis-email-client')?.addEventListener('click', () => sendDevisToClient().catch(handleErr));
    wrap.querySelector('#gderpi-devis-send')?.addEventListener('click', () => changeStatus('envoye'));
    wrap.querySelector('#gderpi-devis-delete')?.addEventListener('click', deleteCurrentDevis);
    wrap.querySelector('#gderpi-devis-cancel-draft')?.addEventListener('click', () => goBackToList().catch(handleErr));
    wrap.querySelector('#gderpi-devis-accept')?.addEventListener('click', () => changeStatus('accepte'));
    wrap.querySelector('#gderpi-devis-refuse')?.addEventListener('click', () => changeStatus('refuse'));
    wrap.querySelector('#gderpi-devis-expire')?.addEventListener('click', () => changeStatus('expire'));
    wrap.querySelector('#gderpi-devis-to-cmd')?.addEventListener('click', toCommandeClient);
    wrap.querySelector('#gderpi-devis-view-cmd')?.addEventListener('click', () => {
      const cmdId = currentDevis?.commandeClientId;
      if (cmdId) global.GderpiCommandeClientEditor?.openCommande?.(cmdId).catch(handleErr);
    });
    wrap.querySelector('#gderpi-devis-preview-html')?.addEventListener('click', () => previewDevisHtml().catch(handleErr));
    wrap.querySelector('#gderpi-devis-download-pdf')?.addEventListener('click', () => downloadDevisPdf().catch(handleErr));
  }

  function bindFraisPortFields() {
    ['gderpi-devis-frais-port-ht', 'gderpi-devis-frais-port-tva'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.gderpiFraisBound) return;
      el.dataset.gderpiFraisBound = '1';
      el.addEventListener('input', () => {
        markDirty();
        renderTotals();
      });
    });
  }

  function ensureNewContactModal() {
    if (newContactModal) return newContactModal;
    const el = document.getElementById('gderpi-devis-new-contact-modal');
    if (!el || !global.GderpiModal) return null;
    newContactModal = global.GderpiModal.enhance(el, { title: 'Nouveau contact client', size: 'md' });
    return newContactModal;
  }

  function resetNewContactForm() {
    const form = document.getElementById('gderpi-devis-new-contact-form');
    form?.reset();
    const principal = document.getElementById('gderpi-devis-new-contact-principal');
    if (principal) principal.checked = false;
  }

  async function openNewContactModal() {
    const clientId = getDevisClientId();
    const client = getClientById(clientId);
    if (!clientId || !isClientEntreprise(client)) {
      global.GderpiStatus.showStatus('Sélectionnez un client entreprise.', 'warning');
      return;
    }
    resetNewContactForm();
    const svcSel = document.getElementById('gderpi-devis-new-contact-service');
    const prefill = selectedDevisService && selectedDevisService !== (global.GderpiClientServices?.SANS_SERVICE || 'Sans service')
      ? selectedDevisService
      : '';
    if (svcSel) {
      await global.GderpiClientServices.populateServiceSelect(svcSel, prefill, {
        placeholder: '— Sélectionner —',
        extraLabels: prefill ? [prefill] : []
      });
    }
    ensureNewContactModal()?.open();
  }

  async function saveNewClientContact(event) {
    event?.preventDefault?.();
    const clientId = getDevisClientId();
    const client = getClientById(clientId);
    if (!clientId || !isClientEntreprise(client)) return;

    const newContact = {
      prenom: document.getElementById('gderpi-devis-new-contact-prenom')?.value?.trim() || '',
      nom: document.getElementById('gderpi-devis-new-contact-nom')?.value?.trim() || '',
      service: document.getElementById('gderpi-devis-new-contact-service')?.value?.trim() || '',
      fonction: document.getElementById('gderpi-devis-new-contact-fonction')?.value?.trim() || '',
      email: document.getElementById('gderpi-devis-new-contact-email')?.value?.trim() || '',
      telephone: document.getElementById('gderpi-devis-new-contact-tel')?.value?.trim() || '',
      principal: document.getElementById('gderpi-devis-new-contact-principal')?.checked === true
    };

    if (!newContact.prenom && !newContact.nom && !newContact.email) {
      global.GderpiStatus.showStatus('Indiquez au moins un nom ou un email.', 'warning');
      return;
    }

    const orgId = client.annuaireOrganisationId;
    if (!orgId) {
      global.GderpiStatus.showStatus('Client non lié à l\'Annuaire.', 'danger');
      return;
    }

    const created = await global.GderpiAnnuaireBridge.createContact(orgId, newContact, 'externe');
    const res = await global.GderpiApi.apiCall('/clients/' + encodeURIComponent(clientId));
    const updated = res.data;
    mergeClientIntoList(updated);

    const updatedContacts = getClientContactsList(updated);
    const createdId = created?.data?.contactId;
    let newId = createdId ? String(createdId) : '';
    if (!newId && newContact.principal) {
      const principal = updatedContacts.find((ct) => ct.principal);
      newId = principal ? String(principal.id || principal.contactId) : '';
    } else if (!newId) {
      const match = updatedContacts.find((ct) =>
        (newContact.email && ct.email === newContact.email)
        || (ct.prenom === newContact.prenom && ct.nom === newContact.nom)
      );
      newId = match ? String(match.id || match.contactId) : '';
    }

    const newService = contactServiceOf(newContact);
    await refreshServiceSelect(clientId, newService);
    refreshContactSelect(clientId, newId, null, selectedDevisService);
    applyContactFromSelect(newId);
    newContactModal?.close();
    global.GderpiStatus.showStatus('Contact ajouté dans l\'Annuaire.', 'success');
  }

  function bindContactPicker() {
    const svcSel = document.getElementById('gderpi-devis-service-select');
    if (svcSel && !svcSel.dataset.gderpiServiceBound) {
      svcSel.dataset.gderpiServiceBound = '1';
      svcSel.addEventListener('change', () => applyServiceFromSelect(svcSel.value));
    }

    const sel = document.getElementById('gderpi-devis-contact-select');
    if (sel && !sel.dataset.gderpiContactBound) {
      sel.dataset.gderpiContactBound = '1';
      sel.addEventListener('change', () => applyContactFromSelect(sel.value));
    }

    const addBtn = document.getElementById('gderpi-devis-contact-add');
    if (addBtn && !addBtn.dataset.gderpiContactBound) {
      addBtn.dataset.gderpiContactBound = '1';
      addBtn.addEventListener('click', () => openNewContactModal().catch(handleErr));
    }

    const form = document.getElementById('gderpi-devis-new-contact-form');
    if (form && !form.dataset.gderpiContactBound) {
      form.dataset.gderpiContactBound = '1';
      form.addEventListener('submit', (e) => saveNewClientContact(e).catch(handleErr));
    }
    document.getElementById('gderpi-devis-new-contact-cancel')?.addEventListener('click', () => {
      newContactModal?.close();
    });

    const bSel = document.getElementById('gderpi-devis-boutique');
    if (bSel && !bSel.dataset.gderpiEmetteurBound) {
      bSel.dataset.gderpiEmetteurBound = '1';
      bSel.addEventListener('change', () => {
        applyBoutiqueToDevisForm(bSel.value).then(() => {
          refreshDevisCgvPanel().catch(handleErr);
          markDirty();
        }).catch(handleErr);
      });
    }

    const cgvProfilSel = document.getElementById('gderpi-devis-cgv-profil');
    const joindreAnnexeCb = document.getElementById('gderpi-devis-joindre-cgv-annexe');
    const bpaCb = document.getElementById('gderpi-devis-afficher-bon-pour-accord');
    [cgvProfilSel, joindreAnnexeCb, bpaCb].forEach((el) => {
      if (!el || el.dataset.gderpiCgvBound) return;
      el.dataset.gderpiCgvBound = '1';
      el.addEventListener('change', () => {
        refreshDevisCgvPanel().catch(handleErr);
        markDirty();
      });
    });

    const paiementMoyenSel = document.getElementById('gderpi-devis-paiement-moyen');
    const paiementEcheanceSel = document.getElementById('gderpi-devis-paiement-echeance');
    const paiementComplementEl = document.getElementById('gderpi-devis-paiement-complement');
    [paiementMoyenSel, paiementEcheanceSel].forEach((el) => {
      if (!el || el.dataset.gderpiPaiementBound) return;
      el.dataset.gderpiPaiementBound = '1';
      el.addEventListener('change', () => {
        refreshDevisConditionsPreview();
        markDirty();
      });
    });
    if (paiementComplementEl && !paiementComplementEl.dataset.gderpiPaiementBound) {
      paiementComplementEl.dataset.gderpiPaiementBound = '1';
      paiementComplementEl.addEventListener('input', () => {
        refreshDevisConditionsPreview();
        markDirty();
      });
    }

    const emSel = document.getElementById('gderpi-devis-emetteur-select');
    if (emSel && !emSel.dataset.gderpiEmetteurBound) {
      emSel.dataset.gderpiEmetteurBound = '1';
      emSel.addEventListener('change', () => applyEmetteurFromSelect(emSel.value));
    }
  }

  const PREVIEW_LOADING_HTML = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Aperçu devis</title></head><body style="font-family:sans-serif;padding:2rem;color:#334155">Chargement de l\'aperçu…</body></html>';

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename || 'document.pdf';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadDevisPdf() {
    if (!editingId) {
      global.GderpiStatus.showStatus('Enregistrez le devis avant le PDF.', 'warning');
      return;
    }
    try {
      if (isDirty && isEditable()) {
        global.GderpiStatus.showStatus('Enregistrement avant PDF…', 'secondary');
        await saveDevis();
      }
      global.GderpiStatus.showStatus('Génération du PDF…', 'secondary');
      const file = await global.GderpiApi.apiDownload('/devis/' + encodeURIComponent(editingId) + '/pdf');
      triggerBlobDownload(file.blob, file.filename);
      global.GderpiStatus.showStatus('PDF téléchargé.', 'success');
    } catch (err) {
      handleErr(err);
    }
  }

  async function previewDevisHtml() {
    if (!editingId) {
      global.GderpiStatus.showStatus('Enregistrez le devis avant l\'aperçu.', 'warning');
      return;
    }

    const modal = ensurePreviewModal();
    const iframe = document.getElementById('gderpi-devis-preview-iframe');
    if (!modal || !iframe) {
      global.GderpiStatus.showStatus('Impossible d\'ouvrir l\'aperçu.', 'danger');
      return;
    }

    modal.open();
    iframe.srcdoc = PREVIEW_LOADING_HTML;

    try {
      if (isDirty && isEditable()) {
        global.GderpiStatus.showStatus('Enregistrement avant aperçu…', 'secondary');
        await saveDevis();
      }
      const res = await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(editingId) + '/html');
      const html = res?.data?.html;
      if (!html) throw new Error('Réponse HTML vide');
      iframe.srcdoc = html;
      global.GderpiStatus.showStatus('Aperçu affiché.', 'success');
    } catch (err) {
      modal.close();
      iframe.srcdoc = '';
      throw err;
    }
  }

  async function loadPmCompat() {
    try {
      const res = await global.GderpiApi.apiCall('/integrations/pm/status', { silent: true });
      pmCompat = res.data || null;
    } catch (_) {
      pmCompat = { pmInstalled: false };
    }
  }

  async function linkPmCard(cardId) {
    if (!editingId) return;
    const res = await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(editingId) + '/pm-link', {
      method: 'PATCH',
      body: JSON.stringify({ pmCardId: cardId })
    });
    fillEditor(res.data);
    global.GderpiStatus.showStatus('Carte PM liée.', 'success');
  }

  async function ensurePmCard() {
    if (!editingId) return;
    const res = await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(editingId) + '/pm-ensure-card', {
      method: 'POST',
      body: '{}'
    });
    fillEditor(res.data);
    global.GderpiStatus.showStatus('Carte PM créée et liée.', 'success');
  }

  async function unlinkPmCard() {
    if (!editingId || !confirm('Retirer la liaison avec la carte PM ?')) return;
    const res = await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(editingId) + '/pm-link', {
      method: 'PATCH',
      body: JSON.stringify({ pmCardId: null })
    });
    fillEditor(res.data);
    global.GderpiStatus.showStatus('Liaison PM retirée.', 'success');
  }

  function ensurePmPickerModal() {
    if (pmPickerModal) return pmPickerModal;
    let el = document.getElementById('gderpi-pm-picker-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gderpi-pm-picker-modal';
      el.hidden = true;
      el.innerHTML =
        '<div class="gderpi-pm-picker">' +
        '<input type="search" id="gderpi-pm-picker-search" class="form-control mb-2" placeholder="Rechercher une carte (titre, e-mail)…">' +
        '<ul id="gderpi-pm-picker-list" class="list-unstyled gderpi-pm-picker-list mb-0"></ul>' +
        '</div>';
      document.body.appendChild(el);
    }
    if (global.GderpiModal) {
      pmPickerModal = global.GderpiModal.enhance(el, { title: 'Lier une carte PM', size: 'md' });
    } else {
      pmPickerModal = {
        open: () => { el.hidden = false; },
        close: () => { el.hidden = true; },
        body: el
      };
    }
    const search = el.querySelector('#gderpi-pm-picker-search');
    let timer;
    search?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => refreshPmPickerList(search.value.trim()).catch(handleErr), 200);
    });
    return pmPickerModal;
  }

  async function refreshPmPickerList(q) {
    const list = document.getElementById('gderpi-pm-picker-list');
    if (!list) return;
    list.innerHTML = '<li class="text-muted">Chargement…</li>';
    const params = new URLSearchParams({ unlinkedOnly: '1' });
    if (q) params.set('q', q);
    const res = await global.GderpiApi.apiCall('/integrations/pm/cards?' + params.toString());
    const cards = res.data || [];
    if (!cards.length) {
      list.innerHTML = '<li class="text-muted">Aucune carte disponible</li>';
      return;
    }
    list.innerHTML = cards.map((c) =>
      '<li><button type="button" class="btn btn-link btn-sm gderpi-pm-pick-item" data-card-id="' + esc(c.cardId) + '">' +
      esc(c.title || c.cardId) +
      (c.contactEmail ? ' <span class="text-muted">— ' + esc(c.contactEmail) + '</span>' : '') +
      '</button></li>'
    ).join('');
    list.querySelectorAll('.gderpi-pm-pick-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        linkPmCard(btn.getAttribute('data-card-id')).catch(handleErr);
        pmPickerModal?.close?.();
      });
    });
  }

  async function openPmCardLinkPicker() {
    if (!editingId) return;
    ensurePmPickerModal();
    await refreshPmPickerList('');
    pmPickerModal?.open?.();
    document.getElementById('gderpi-pm-picker-search')?.focus();
  }

  async function renderDevisPmLink(devis) {
    const row = document.getElementById('gderpi-devis-pm-row');
    const wrap = document.getElementById('gderpi-devis-pm-link');
    if (!row || !wrap) return;

    if (!pmCompat?.pmInstalled) {
      row.hidden = true;
      return;
    }

    row.hidden = false;
    const cardId = devis?.pmCardId;
    if (!cardId) {
      wrap.innerHTML = canWrite() && editingId
        ? '<button type="button" class="btn btn-primary btn-sm" id="gderpi-devis-pm-create-btn">Créer une carte PM</button> ' +
          '<button type="button" class="btn btn-outline btn-sm" id="gderpi-devis-pm-link-btn">Lier une carte existante</button>'
        : '<span class="text-muted">Aucune carte liée</span>';
      wrap.querySelector('#gderpi-devis-pm-create-btn')?.addEventListener('click', () => {
        ensurePmCard().catch(handleErr);
      });
      wrap.querySelector('#gderpi-devis-pm-link-btn')?.addEventListener('click', () => {
        openPmCardLinkPicker().catch(handleErr);
      });
      return;
    }

    let label = cardId;
    try {
      const res = await global.GderpiApi.apiCall('/integrations/pm/cards/' + encodeURIComponent(cardId), { silent: true });
      if (res.data?.title) label = res.data.title;
    } catch (_) {}

    const pmUrl = (global.GDERPI_CONFIG?.pmUrl || '#') + '?card=' + encodeURIComponent(cardId);
    wrap.innerHTML =
      '<a class="btn btn-link btn-sm p-0" href="' + esc(pmUrl) + '" target="_blank" rel="noopener">' + esc(label) + '</a>' +
      (canWrite()
        ? ' <button type="button" class="btn btn-outline btn-sm" id="gderpi-devis-pm-unlink-btn">Délier</button>'
        : '');
    wrap.querySelector('#gderpi-devis-pm-unlink-btn')?.addEventListener('click', () => {
      unlinkPmCard().catch(handleErr);
    });
  }

  function renderDevisCommandeLink(devis) {
    const traceRow = document.getElementById('gderpi-devis-trace-row');
    const wrap = document.getElementById('gderpi-devis-commande-link');
    const cmdId = devis?.commandeClientId;
    const cmdNumero = devis?.commandeClientNumero;
    if (!traceRow || !wrap) return;
    if (!cmdId) {
      traceRow.hidden = true;
      wrap.textContent = '—';
      return;
    }
    traceRow.hidden = false;
    wrap.innerHTML = '<button type="button" class="btn btn-link btn-sm p-0 gderpi-devis-open-cmd" data-cmd-id="' +
      esc(cmdId) + '">' + esc(cmdNumero || 'Voir la commande') + '</button>';
    wrap.querySelector('.gderpi-devis-open-cmd')?.addEventListener('click', () => {
      global.GderpiCommandeClientEditor?.openCommande?.(cmdId).catch(handleErr);
    });
  }

  function fillEditor(devis) {
    currentDevis = devis;
    editingId = isLocalDraft ? '' : (devis?.devisId || devis?.id || '');
    lines = Array.isArray(devis?.lignes) ? devis.lignes.map((l) => ({ ...l })) : [];
    if (isEditable()) ensureTrailingEmptyLine();

    const titleEl = document.getElementById('gderpi-devis-editor-title');
    if (titleEl) {
      titleEl.textContent = isLocalDraft
        ? 'Nouveau devis'
        : (devis?.numero ? 'Devis ' + devis.numero : 'Devis');
    }
    const subtitleEl = document.getElementById('gderpi-devis-editor-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = isLocalDraft
        ? 'Brouillon local — non enregistré'
        : ((devis?.statut ? STATUT_LABELS[devis.statut] || devis.statut : 'Brouillon') +
          (devis?.clientId ? ' — ' + clientLabel(devis.clientId) : ''));
    }

    const bSel = document.getElementById('gderpi-devis-boutique');
    if (bSel) {
      bSel.value = devis?.boutiqueId || boutiques[0]?.boutiqueId || '';
      bSel.disabled = Boolean(editingId);
    }
    ensureClientSearch();
    setDevisClientId(devis?.clientId || '');
    document.getElementById('gderpi-devis-objet').value = devis?.objet || '';
    document.getElementById('gderpi-devis-notes').value = devis?.notes || '';
    const docClientEl = document.getElementById('gderpi-devis-document-client');
    if (docClientEl) {
      docClientEl.value = devis?.documentClient || devis?.referenceClient || '';
      docClientEl.disabled = !isEditable();
    }
    renderDevisCommandeLink(devis);
    renderDevisPmLink(devis).catch(handleErr);

    const cgvProfilEl = document.getElementById('gderpi-devis-cgv-profil');
    const joindreAnnexeEl = document.getElementById('gderpi-devis-joindre-cgv-annexe');
    if (cgvProfilEl) cgvProfilEl.value = devis?.cgvProfil || 'auto';
    if (joindreAnnexeEl) joindreAnnexeEl.checked = devis?.joindreCgvAnnexe === true;
    const bpaEl = document.getElementById('gderpi-devis-afficher-bon-pour-accord');
    if (bpaEl) bpaEl.checked = devis?.afficherBonPourAccord === true;
    fillDevisPaiementFields(devis);

    const savedContact = {
      contactClientId: devis?.contactClientId || '',
      contactNom: devis?.contactNom || '',
      contactService: devis?.contactService || '',
      contactFonction: devis?.contactFonction || '',
      contactEmail: devis?.contactEmail || '',
      contactTelephone: devis?.contactTelephone || ''
    };

    const savedEmetteur = {
      emetteurContactId: devis?.emetteurContactId || '',
      emetteurContactNom: devis?.emetteurContactNom || '',
      emetteurContactFonction: devis?.emetteurContactFonction || '',
      emetteurContactEmail: devis?.emetteurContactEmail || '',
      emetteurContactTelephone: devis?.emetteurContactTelephone || ''
    };

    selectedEmetteurContactId = savedEmetteur.emetteurContactId;
    applyBoutiqueToDevisForm(bSel?.value || '', {
      savedEmetteur,
      emetteurContactId: savedEmetteur.emetteurContactId,
      applyDefaultContact: !savedEmetteur.emetteurContactNom
        || isPlaceholderEmetteurName(savedEmetteur.emetteurContactNom)
    }).catch(handleErr);

    const applyContactUi = async () => {
      selectedContactClientId = savedContact.contactClientId;
      selectedDevisService = savedContact.contactService || '';
      await refreshServiceSelect(devis?.clientId || '', savedContact.contactService, savedContact);
      refreshContactSelect(devis?.clientId || '', savedContact.contactClientId, savedContact, selectedDevisService);
      setDevisContactFields(savedContact);
      bindContactPicker();
    };

    if (devis?.clientId) {
      ensureClientLoaded(devis.clientId).then(() => applyContactUi()).catch(() => applyContactUi());
    } else {
      applyContactUi().catch(handleErr);
    }

    const editable = isEditable();
    const fraisHtEl = document.getElementById('gderpi-devis-frais-port-ht');
    const fraisTvaEl = document.getElementById('gderpi-devis-frais-port-tva');
    const fraisEditRow = document.getElementById('gderpi-devis-frais-port-edit-row');
    if (fraisHtEl) fraisHtEl.value = Number(devis?.fraisPortHt) > 0 ? devis.fraisPortHt : '';
    if (fraisTvaEl) {
      fraisTvaEl.value = Number(devis?.fraisPortHt) > 0 && Number.isFinite(Number(devis?.fraisPortTauxTva))
        ? devis.fraisPortTauxTva
        : 20;
    }
    if (fraisEditRow) fraisEditRow.hidden = !editable;
    if (fraisHtEl) fraisHtEl.disabled = !editable;
    if (fraisTvaEl) fraisTvaEl.disabled = !editable;
    bindFraisPortFields();
    ['gderpi-devis-client-search', 'gderpi-devis-objet', 'gderpi-devis-notes', 'gderpi-devis-boutique',
      'gderpi-devis-emetteur-select', 'gderpi-devis-document-client', 'gderpi-devis-service-select', 'gderpi-devis-contact-select',
      'gderpi-devis-cgv-profil', 'gderpi-devis-joindre-cgv-annexe', 'gderpi-devis-afficher-bon-pour-accord',
      'gderpi-devis-paiement-moyen', 'gderpi-devis-paiement-echeance', 'gderpi-devis-paiement-complement'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.disabled = !editable || (id === 'gderpi-devis-boutique' && Boolean(editingId));
      if (!el.dataset.gderpiDirtyBound) {
        el.dataset.gderpiDirtyBound = '1';
        el.addEventListener('input', markDirty);
        el.addEventListener('change', markDirty);
      }
    });

    renderLines();
    renderActions();
    refreshDevisCgvPanel().catch(handleErr);

    if (editable) {
      setTimeout(() => {
        const firstRef = document.querySelector('#gderpi-devis-lines-tbody .gderpi-devis-line-ref');
        if (firstRef && isLineEmpty(lines[0])) firstRef.focus();
      }, 50);
    }
  }

  async function openDevis(id) {
    isLocalDraft = false;
    isDirty = false;
    const res = await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(id));
    fillEditor(res.data);
    showEditor();
  }

  async function newDevis() {
    await ensureRefs();
    if (!boutiques.length) {
      global.GderpiStatus.showStatus('Créez d\'abord une boutique.', 'warning');
      return;
    }
    isLocalDraft = true;
    isDirty = false;
    editingId = '';
    const boutiqueId = boutiques.find((b) => b.actif !== false)?.boutiqueId || boutiques[0].boutiqueId;
    currentDevis = { statut: 'brouillon', boutiqueId, lignes: [] };
    lines = [];
    ensureTrailingEmptyLine();
    fillEditor(currentDevis);
    showEditor();
  }

  function collectPayload() {
    syncAllLinesFromDom();
    const filledLines = lines.filter((l) => !isLineEmpty(l)).map(calcLineTotals);
    return {
      boutiqueId: document.getElementById('gderpi-devis-boutique')?.value || '',
      clientId: getDevisClientId() || null,
      objet: document.getElementById('gderpi-devis-objet')?.value?.trim() || '',
      notes: document.getElementById('gderpi-devis-notes')?.value?.trim() || '',
      documentClient: document.getElementById('gderpi-devis-document-client')?.value?.trim() || '',
      referenceClient: document.getElementById('gderpi-devis-document-client')?.value?.trim() || '',
      ...getDevisContactFromDom(),
      ...getDevisEmetteurFromDom(),
      ...getFraisPortFromDom(),
      ...getDevisCgvFromDom(),
      ...getDevisPaiementFromDom(),
      ...getDevisAffichageFromDom(),
      lignes: filledLines
    };
  }

  async function saveDevis() {
    const payload = collectPayload();
    if (!payload.boutiqueId) {
      global.GderpiStatus.showStatus('Sélectionnez une boutique.', 'warning');
      return;
    }
    if (!payload.lignes.length) {
      global.GderpiStatus.showStatus('Ajoutez au moins une ligne au devis.', 'warning');
      return;
    }

    let res;
    if (isLocalDraft || !editingId) {
      res = await global.GderpiApi.apiCall('/devis', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      isLocalDraft = false;
    } else {
      res = await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(editingId), {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    }

    isDirty = false;
    fillEditor(res.data);
    global.GderpiStatus.showStatus('Devis enregistré.', 'success');
    await refreshDevisList();
  }

  async function deleteCurrentDevis() {
    if (!editingId || isLocalDraft) return;
    if (!confirm('Supprimer ce devis brouillon ?')) return;
    await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(editingId), { method: 'DELETE' });
    global.GderpiStatus.showStatus('Devis supprimé.', 'success');
    showList();
    await refreshDevisList();
  }

  async function deleteDevisById(id) {
    if (!confirm('Supprimer ce devis brouillon ?')) return;
    await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(id), { method: 'DELETE' });
    global.GderpiStatus.showStatus('Devis supprimé.', 'success');
    await refreshDevisList();
  }

  async function changeDevisStatusById(id, statut, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const devisId = String(id || '').trim();
    if (!devisId) throw new Error('Devis introuvable');
    const fromList = devisList.find((d) => String(d.devisId || d.id) === devisId);
    const fromStatut = opts.fromStatut || fromList?.statut || currentDevis?.statut || 'brouillon';
    if (fromStatut === statut) return null;
    if (!confirmStatusChange(fromStatut, statut)) return null;

    if (!opts.fromList && statut === 'envoye' && editingId === devisId && isEditable()) {
      await saveDevis().catch(() => {});
    }

    const res = await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(devisId) + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ statut })
    });

    let updatedDevis = res.data;

    if (statut === 'accepte' && updatedDevis && !updatedDevis.commandeClientId) {
      try {
        global.GderpiStatus.showStatus('Création de la commande client…', 'secondary');
        const cmd = await global.GderpiCommandeClientEditor?.autoCreateFromDevis?.(devisId, updatedDevis);
        if (cmd) {
          updatedDevis = {
            ...updatedDevis,
            commandeClientId: cmd.commandeClientId || cmd.id,
            commandeClientNumero: cmd.numero || ''
          };
        }
      } catch (cmdErr) {
        global.GderpiStatus.showStatus(
          'Devis accepté, mais la commande client n\'a pas pu être créée : ' + (cmdErr.message || 'erreur'),
          'warning'
        );
        if (!opts.fromList && editingId === devisId) {
          fillEditor(updatedDevis);
          isDirty = false;
        }
        await refreshDevisList();
        return updatedDevis;
      }
    }

    if (!opts.fromList && editingId === devisId) {
      fillEditor(updatedDevis);
      isDirty = false;
    }

    if (statut === 'accepte' && updatedDevis?.commandeClientId) {
      let msg = 'Devis accepté';
      if (updatedDevis.commandeClientNumero) {
        msg += ' et commande client ' + updatedDevis.commandeClientNumero + ' créée';
      } else {
        msg += ' et commande client créée';
      }
      global.GderpiStatus.showStatus(msg + '.', 'success');
      global.GderpiCommandesClientTab?.refreshCommandesList?.();
    } else {
      global.GderpiStatus.showStatus('Statut mis à jour : ' + (STATUT_LABELS[statut] || statut), 'success');
    }
    await refreshDevisList();
    return updatedDevis;
  }

  async function changeStatus(statut) {
    if (isLocalDraft || !editingId) {
      global.GderpiStatus.showStatus('Enregistrez le devis avant de changer le statut.', 'warning');
      return;
    }
    await changeDevisStatusById(editingId, statut);
  }

  async function sendDevisEmailById(id, devis) {
    const devisId = String(id || '').trim();
    if (!devisId) return;

    const email = String(devis?.contactEmail || '').trim();

    const modalResult = await global.GderpiSendEmail?.prompt?.({
      title: 'Envoyer le devis',
      description: 'Le client recevra un lien pour consulter, télécharger et éventuellement confirmer sa commande.',
      to: email,
      toLabel: devis?.contactNom || '',
      recipientContext: { type: 'devis', id: devisId }
    });
    if (!modalResult) return;
    const payload = global.GderpiSendEmail.buildPayload(modalResult) || {};

    try {
      global.GderpiStatus.showStatus('Envoi du devis en cours…', 'secondary');
      const res = await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(devisId) + '/send', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (editingId === devisId) {
        fillEditor(res.data?.devis || res.data);
        isDirty = false;
      }
      global.GderpiStatus.showStatus('Devis envoyé à ' + (res.data?.sentTo || email) + '.', 'success');
      await refreshDevisList();
    } catch (err) {
      const msg = err.message || 'Erreur envoi';
      if (/mail non configuré|serveur mail/i.test(msg)) {
        global.GderpiStatus.showStatus(msg + ' — Configuration → Mail.', 'danger');
      } else {
        throw err;
      }
    }
  }

  async function toCommandeClientById(id) {
    const devisId = String(id || '').trim();
    if (!devisId) return;
    await global.GderpiCommandeClientEditor?.openFromDevis?.(devisId);
  }

  async function sendDevisToClient() {
    if (isLocalDraft || !editingId) {
      global.GderpiStatus.showStatus('Enregistrez le devis avant l\'envoi.', 'warning');
      return;
    }

    const email = document.getElementById('gderpi-devis-contact-email')?.value?.trim()
      || currentDevis?.contactEmail
      || '';

    const modalResult = await global.GderpiSendEmail?.prompt?.({
      title: 'Envoyer le devis',
      description: 'Le client recevra un lien pour consulter, télécharger et éventuellement confirmer sa commande.',
      to: email,
      toLabel: currentDevis?.contactNom || '',
      recipientContext: { type: 'devis', id: editingId }
    });
    if (!modalResult) return;
    const payload = global.GderpiSendEmail.buildPayload(modalResult) || {};

    try {
      if (isDirty && isEditable()) {
        global.GderpiStatus.showStatus('Enregistrement avant envoi…', 'secondary');
        await saveDevis();
      }
      global.GderpiStatus.showStatus('Envoi du devis en cours…', 'secondary');
      const res = await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(editingId) + '/send', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      fillEditor(res.data?.devis || res.data);
      isDirty = false;
      global.GderpiStatus.showStatus('Devis envoyé à ' + (res.data?.sentTo || email) + '.', 'success');
      await refreshDevisList();
    } catch (err) {
      const msg = err.message || 'Erreur envoi';
      if (/mail non configuré|serveur mail/i.test(msg)) {
        global.GderpiStatus.showStatus(msg + ' — Configuration → Mail.', 'danger');
      } else {
        handleErr(err);
      }
    }
  }

  async function toCommandeClient() {
    if (!editingId) return;
    await toCommandeClientById(editingId);
  }

  async function refreshDevisList() {
    const editorOpen = Boolean(editorModal?.isOpen?.());
    await ensureRefs({ skipDevisForm: editorOpen });
    const q = document.getElementById('gderpi-devis-search')?.value?.trim() || '';
    const statut = document.getElementById('gderpi-devis-filter-statut')?.value || '';
    const boutiqueId = document.getElementById('gderpi-devis-filter-boutique')?.value || '';
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (statut) params.set('statut', statut);
    if (boutiqueId) params.set('boutiqueId', boutiqueId);
    const path = '/devis' + (params.toString() ? '?' + params.toString() : '');
    const res = await global.GderpiApi.apiCall(path);
    devisList = filterDevisRowsLocal(res.data || [], q);
    renderDevisTable();
    bindDevisSortHeaders();
  }

  function bindDevisTab() {
    ensureEditorModal();
    ensurePreviewModal();
    ensureNewContactModal();
    loadPmCompat().catch(() => {});
    ensureClientSearch();
    bindContactPicker();
    bindDevisSortHeaders();
    document.getElementById('gderpi-devis-new')?.addEventListener('click', () => newDevis().catch(handleErr));
    document.getElementById('gderpi-devis-back')?.addEventListener('click', () => goBackToList().catch(handleErr));
    ['gderpi-devis-search', 'gderpi-devis-filter-statut', 'gderpi-devis-filter-boutique'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => refreshDevisList().catch(handleErr));
      if (el.type === 'search' || el.type === 'text') {
        let t;
        el.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => refreshDevisList().catch(handleErr), 200); });
      }
    });
  }

  function handleErr(err) {
    global.GderpiStatus.showStatus(err.message || 'Erreur devis', 'danger');
  }

  global.GderpiDevisTab = { bindDevisTab, refreshDevisList, showList, openDevis };
})(window);
