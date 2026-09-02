/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/bindDocPartyFields.js
 * RÔLE : Boutique / émetteur / client / service / interlocuteur — même logique que le devis.
 */

(function initGderpiBindDocPartyFields(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const SANS_SERVICE = () => global.GderpiClientServices?.SANS_SERVICE || 'Sans service';

  function contactServiceOf(ct) {
    return String(ct?.service || '').trim() || SANS_SERVICE();
  }

  function isClientEntreprise(client) {
    return Boolean(client && client.type !== 'particulier');
  }

  function getClientContactsList(client) {
    const list = Array.isArray(client?.contacts) ? client.contacts.filter(Boolean) : [];
    if (list.length) return list;
    if (client?.type === 'particulier') {
      return [{
        id: '__particulier__',
        prenom: client.prenom || '',
        nom: client.nom || '',
        email: client.email || '',
        telephone: client.telephone || '',
        principal: true
      }];
    }
    if (client?.contactNom || client?.email || client?.telephone) {
      return [{
        id: 'legacy',
        nom: client.contactNom || '',
        fonction: client.contactFonction || '',
        email: client.email || '',
        telephone: client.telephone || '',
        principal: true
      }];
    }
    return [];
  }

  function contactOptionLabel(ct) {
    const name = [ct.prenom, ct.nom].filter(Boolean).join(' ').trim() || ct.nom || 'Sans nom';
    const extra = ct.fonction ? ' — ' + ct.fonction : (ct.email ? ' — ' + ct.email : '');
    const star = ct.principal ? ' ★' : '';
    return name + extra + star;
  }

  function contactToFields(ct) {
    const id = String(ct?.id || ct?.contactId || '').trim();
    const service = contactServiceOf(ct);
    return {
      contactClientId: id && id !== 'legacy' ? id : '',
      contactNom: [ct?.prenom, ct?.nom].filter(Boolean).join(' ').trim() || ct?.nom || '',
      contactService: service && service !== SANS_SERVICE() ? service : (service === SANS_SERVICE() ? '' : service),
      contactFonction: ct?.fonction || '',
      contactEmail: ct?.email || '',
      contactTelephone: ct?.telephone || ''
    };
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

  function createDocPartyFields(prefix) {
    const id = (suffix) => prefix + '-' + suffix;
    const el = (suffix) => document.getElementById(id(suffix));

    let boutiques = [];
    let clients = [];
    const clientDetails = new Map();
    let selectedService = '';
    let selectedContactId = '';
    let selectedEmetteurId = '';
    let clientSearchBinding = null;
    let onDirty = () => {};
    let onClientChange = () => {};
    let getCanEdit = () => true;

    function markDirty() {
      onDirty();
    }

    function mergeClient(client) {
      if (!client) return;
      const cid = String(client.clientId || client.id || '').trim();
      if (!cid) return;
      clientDetails.set(cid, client);
      const idx = clients.findIndex((c) => String(c.clientId || c.id) === cid);
      if (idx >= 0) clients[idx] = { ...clients[idx], ...client };
      else clients.push(client);
    }

    async function ensureClientLoaded(clientId) {
      const cid = String(clientId || '').trim();
      if (!cid) return null;
      const cached = clientDetails.get(cid);
      if (cached && (Array.isArray(cached.contacts) || cached.type === 'particulier')) return cached;
      const res = await global.GderpiApi.apiCall('/clients/' + encodeURIComponent(cid));
      mergeClient(res.data);
      return res.data;
    }

    function getClient(clientId) {
      const cid = String(clientId || '').trim();
      if (!cid) return null;
      return clientDetails.get(cid) || clients.find((c) => String(c.clientId || c.id) === cid) || null;
    }

    function getBoutique(boutiqueId) {
      const bid = String(boutiqueId || '').trim();
      return boutiques.find((b) => String(b.boutiqueId || b.id) === bid) || null;
    }

    function getClientId() {
      return el('client-id')?.value?.trim() || '';
    }

    function setHidden(map) {
      Object.entries(map).forEach(([suffix, val]) => {
        const node = el(suffix);
        if (node) node.value = val || '';
      });
    }

    function setContactFields(fields) {
      const c = fields && typeof fields === 'object' ? fields : {};
      setHidden({
        'contact-nom': c.contactNom || '',
        'contact-fonction': c.contactFonction || '',
        'contact-email': c.contactEmail || '',
        'contact-tel': c.contactTelephone || ''
      });
    }

    function setEmetteurFields(fields) {
      const c = fields && typeof fields === 'object' ? fields : {};
      setHidden({
        'emetteur-contact-id': c.emetteurContactId || '',
        'emetteur-contact-nom': c.emetteurContactNom || '',
        'emetteur-contact-fonction': c.emetteurContactFonction || '',
        'emetteur-contact-email': c.emetteurContactEmail || '',
        'emetteur-contact-tel': c.emetteurContactTelephone || ''
      });
    }

    function refreshEmetteurSelect(boutiqueId, preferredId) {
      const sel = el('emetteur-select');
      if (!sel) return;
      const boutique = getBoutique(boutiqueId);
      const contacts = getBoutiqueContactsList(boutique);
      if (!boutiqueId || !contacts.length) {
        sel.innerHTML = '<option value="">' + (boutiqueId ? '— Aucun contact —' : '— Boutique requise —') + '</option>';
        selectedEmetteurId = '';
        setEmetteurFields({});
        return;
      }
      sel.innerHTML = contacts.map((ct) => {
        const cid = String(ct.id || ct.contactId || '');
        return '<option value="' + esc(cid) + '">' + esc(emetteurOptionLabel(ct)) + '</option>';
      }).join('');
      const pick = String(preferredId || selectedEmetteurId || '').trim();
      const match = pick && contacts.some((ct) => String(ct.id || ct.contactId) === pick)
        ? pick
        : String((contacts.find((ct) => ct.principal) || contacts[0]).id || contacts[0].contactId || '');
      sel.value = match;
      applyEmetteur(match);
    }

    function applyEmetteur(contactId) {
      const boutique = getBoutique(el('boutique')?.value || '');
      const contacts = getBoutiqueContactsList(boutique);
      const ct = contacts.find((c) => String(c.id || c.contactId) === String(contactId));
      selectedEmetteurId = String(contactId || '');
      setEmetteurFields(ct ? contactToEmetteurFields(ct) : {});
      if (el('emetteur-select') && contactId) el('emetteur-select').value = String(contactId);
    }

    async function refreshServiceSelect(client, preferredService) {
      const sel = el('service-select');
      if (!sel) return;
      if (!client) {
        sel.innerHTML = '<option value="">— Client requis —</option>';
        sel.disabled = true;
        selectedService = '';
        return;
      }
      if (!isClientEntreprise(client)) {
        sel.innerHTML = '<option value="">— Particulier —</option>';
        sel.disabled = true;
        selectedService = '';
        return;
      }
      const contacts = getClientContactsList(client);
      const extra = new Set();
      contacts.forEach((ct) => extra.add(contactServiceOf(ct)));
      if (preferredService) extra.add(preferredService === '' ? SANS_SERVICE() : preferredService);
      const services = await global.GderpiClientServices.fetchClientServices();
      const labels = global.GderpiClientServices.buildServiceLabels(services, [...extra]);
      sel.innerHTML = '<option value="">— Service —</option>' +
        labels.map((label) => '<option value="' + esc(label) + '">' + esc(label) + '</option>').join('');
      let pick = preferredService != null ? preferredService : selectedService;
      if (pick === '') pick = SANS_SERVICE();
      if (pick && labels.includes(pick)) sel.value = pick;
      else if (labels.length) {
        const fromContact = contacts.find((ct) => ct.principal) || contacts[0];
        pick = fromContact ? contactServiceOf(fromContact) : labels[0];
        sel.value = pick;
      }
      selectedService = sel.value || '';
      sel.disabled = !getCanEdit();
    }

    function refreshContactSelect(client, preferredId, saved) {
      const sel = el('contact-select');
      const addBtn = el('contact-add');
      if (!sel) return;
      if (!client) {
        sel.innerHTML = '<option value="">— Client requis —</option>';
        sel.disabled = true;
        if (addBtn) addBtn.disabled = true;
        selectedContactId = '';
        setContactFields({});
        return;
      }
      const all = getClientContactsList(client);
      if (!isClientEntreprise(client)) {
        sel.innerHTML = all.length
          ? '<option value="' + esc(String(all[0].id || '')) + '">' + esc(contactOptionLabel(all[0])) + '</option>'
          : '<option value="">— Aucun contact —</option>';
        sel.disabled = true;
        if (addBtn) addBtn.disabled = true;
        const ct = all[0];
        selectedContactId = ct ? String(ct.id || ct.contactId || '') : '';
        setContactFields(ct ? contactToFields(ct) : {});
        return;
      }
      const service = selectedService || el('service-select')?.value || '';
      const scoped = service ? all.filter((ct) => contactServiceOf(ct) === service) : [];
      if (!service) {
        sel.innerHTML = '<option value="">— Service requis —</option>';
        sel.disabled = true;
        if (addBtn) addBtn.disabled = !getCanEdit();
        return;
      }
      if (!scoped.length) {
        sel.innerHTML = '<option value="">— Aucun contact pour ce service —</option>';
        sel.disabled = !getCanEdit();
        if (addBtn) addBtn.disabled = !getCanEdit();
        if (saved?.contactNom && (saved.contactService || '') === (service === SANS_SERVICE() ? '' : service)) {
          setContactFields(saved);
        } else {
          setContactFields({
            contactClientId: '',
            contactNom: '',
            contactService: service === SANS_SERVICE() ? '' : service,
            contactFonction: '',
            contactEmail: '',
            contactTelephone: ''
          });
        }
        selectedContactId = '';
        return;
      }
      sel.innerHTML = '<option value="">— Contact —</option>' + scoped.map((ct) => {
        const cid = String(ct.id || ct.contactId || '');
        return '<option value="' + esc(cid) + '">' + esc(contactOptionLabel(ct)) + '</option>';
      }).join('');
      const pick = String(preferredId || selectedContactId || saved?.contactClientId || '').trim();
      const ok = pick && scoped.some((ct) => String(ct.id || ct.contactId) === pick);
      const chosen = ok ? pick : String((scoped.find((ct) => ct.principal) || scoped[0]).id || scoped[0].contactId || '');
      sel.value = chosen;
      sel.disabled = !getCanEdit();
      if (addBtn) addBtn.disabled = !getCanEdit();
      applyContact(chosen, client);
    }

    function applyContact(contactId, client) {
      const contacts = getClientContactsList(client);
      const ct = contacts.find((c) => String(c.id || c.contactId) === String(contactId));
      selectedContactId = String(contactId || '');
      setContactFields(ct ? contactToFields(ct) : {});
    }

    function setClientDisplay(clientId) {
      const hidden = el('client-id');
      const cid = clientId ? String(clientId).trim() : '';
      if (hidden) hidden.value = cid;
      const client = getClient(cid);
      const label = client
        ? (global.GderpiClientSearch?.clientFieldLabel(client) || client.displayName || client.raisonSociale || '')
        : '';
      if (clientSearchBinding) clientSearchBinding.setDisplayValue(label);
      else if (el('client-search')) el('client-search').value = label;
    }

    async function applyClient(clientId, saved, opts) {
      const cid = String(clientId || '').trim();
      setClientDisplay(cid);
      const client = cid ? await ensureClientLoaded(cid) : null;
      const preferredService = saved?.contactService != null
        ? (saved.contactService || SANS_SERVICE())
        : undefined;
      await refreshServiceSelect(client, preferredService);
      refreshContactSelect(client, saved?.contactClientId, saved);
      if (opts?.notify !== false) onClientChange(cid, client);
    }

    function collect() {
      const service = el('service-select')?.value || selectedService || '';
      return {
        boutiqueId: el('boutique')?.value || '',
        clientId: getClientId(),
        documentClient: el('document-client')?.value?.trim() || '',
        contactClientId: el('contact-select')?.value?.trim() || selectedContactId || '',
        contactNom: el('contact-nom')?.value?.trim() || '',
        contactService: service === SANS_SERVICE() ? '' : service,
        contactFonction: el('contact-fonction')?.value?.trim() || '',
        contactEmail: el('contact-email')?.value?.trim() || '',
        contactTelephone: el('contact-tel')?.value?.trim() || '',
        emetteurContactId: el('emetteur-contact-id')?.value?.trim() || selectedEmetteurId || '',
        emetteurContactNom: el('emetteur-contact-nom')?.value?.trim() || '',
        emetteurContactFonction: el('emetteur-contact-fonction')?.value?.trim() || '',
        emetteurContactEmail: el('emetteur-contact-email')?.value?.trim() || '',
        emetteurContactTelephone: el('emetteur-contact-tel')?.value?.trim() || ''
      };
    }

    function setEditable(editable, locks) {
      const can = editable === true;
      const lockBoutique = locks?.boutique === true;
      const lockClient = locks?.client === true;
      if (el('boutique')) el('boutique').disabled = !can || lockBoutique;
      if (el('emetteur-select')) el('emetteur-select').disabled = !can || !el('boutique')?.value;
      if (el('client-search')) el('client-search').disabled = !can || lockClient;
      if (el('document-client')) el('document-client').disabled = !can;
      if (el('service-select') && isClientEntreprise(getClient(getClientId()))) {
        el('service-select').disabled = !can;
      }
      if (el('contact-select') && isClientEntreprise(getClient(getClientId()))) {
        el('contact-select').disabled = !can || !el('service-select')?.value;
      }
      if (el('contact-add')) el('contact-add').disabled = !can || !getClientId() || !isClientEntreprise(getClient(getClientId()));
    }

    function populateBoutique(list, selectedId) {
      boutiques = Array.isArray(list) ? list : [];
      const sel = el('boutique');
      if (!sel) return;
      const current = selectedId || sel.value || '';
      const active = boutiques.find((b) => b.actif !== false) || boutiques[0];
      const fallback = active?.boutiqueId || active?.id || '';
      sel.innerHTML = '<option value="">— Sélectionner une boutique —</option>' +
        boutiques.map((b) => {
          const bid = b.boutiqueId || b.id;
          return '<option value="' + esc(bid) + '">' + esc(b.nom || bid) + '</option>';
        }).join('');
      const pick = current && boutiques.some((b) => String(b.boutiqueId || b.id) === String(current))
        ? current
        : fallback;
      if (pick) sel.value = pick;
      refreshEmetteurSelect(sel.value, selectedEmetteurId);
    }

    function reset() {
      selectedService = '';
      selectedContactId = '';
      selectedEmetteurId = '';
      setClientDisplay('');
      setContactFields({});
      setEmetteurFields({});
      if (el('document-client')) el('document-client').value = '';
      refreshServiceSelect(null);
      refreshContactSelect(null);
    }

    async function applyDocument(doc, opts) {
      const d = doc && typeof doc === 'object' ? doc : {};
      populateBoutique(boutiques, d.boutiqueId);
      selectedEmetteurId = d.emetteurContactId || '';
      refreshEmetteurSelect(el('boutique')?.value || d.boutiqueId, selectedEmetteurId);
      if (el('document-client')) el('document-client').value = d.documentClient || d.referenceClient || '';
      await applyClient(d.clientId, {
        contactClientId: d.contactClientId || '',
        contactNom: d.contactNom || '',
        contactService: d.contactService,
        contactFonction: d.contactFonction || '',
        contactEmail: d.contactEmail || '',
        contactTelephone: d.contactTelephone || ''
      }, { notify: false });
      setEditable(opts?.editable !== false, opts?.locks || {});
    }

    async function openNewContact() {
      const clientId = getClientId();
      const client = getClient(clientId);
      if (!clientId || !isClientEntreprise(client)) {
        global.GderpiStatus.showStatus('Sélectionnez un client entreprise.', 'warning');
        return;
      }
      global.__gderpiContactModalClientId = clientId;
      global.__gderpiContactModalService = selectedService || el('service-select')?.value || '';
      global.__gderpiContactModalOnCreated = async (updated, newId) => {
        mergeClient(updated);
        const created = (updated?.contacts || []).find((ct) => String(ct.id || ct.contactId) === String(newId));
        if (created) selectedService = contactServiceOf(created);
        await refreshServiceSelect(updated, selectedService);
        refreshContactSelect(updated, newId, null);
        markDirty();
      };
      if (typeof global.GderpiDevisTab?.openNewContactModal === 'function') {
        await global.GderpiDevisTab.openNewContactModal(clientId);
        return;
      }
      document.getElementById('gderpi-devis-contact-add')?.click();
    }

    function bind(opts) {
      boutiques = opts.getBoutiques?.() || boutiques;
      clients = opts.getClients?.() || clients;
      onDirty = typeof opts.onDirty === 'function' ? opts.onDirty : onDirty;
      onClientChange = typeof opts.onClientChange === 'function' ? opts.onClientChange : onClientChange;
      getCanEdit = typeof opts.getCanEdit === 'function' ? opts.getCanEdit : getCanEdit;

      const search = el('client-search');
      if (search && global.GderpiBindClientSearch?.bindClientSearchField && !clientSearchBinding) {
        clientSearchBinding = global.GderpiBindClientSearch.bindClientSearchField(search, {
          getClients: () => (opts.getClients?.() || clients),
          onSelect: (client) => {
            applyClient(String(client.clientId || client.id), null, { notify: true }).then(() => {
              markDirty();
            });
          },
          onClear: () => {
            applyClient('', null, { notify: true }).then(() => markDirty());
          }
        });
      }

      el('boutique')?.addEventListener('change', () => {
        refreshEmetteurSelect(el('boutique').value, '');
        markDirty();
      });
      el('emetteur-select')?.addEventListener('change', () => {
        applyEmetteur(el('emetteur-select').value);
        markDirty();
      });
      el('service-select')?.addEventListener('change', () => {
        selectedService = el('service-select').value || '';
        refreshContactSelect(getClient(getClientId()), '', collect());
        markDirty();
      });
      el('contact-select')?.addEventListener('change', () => {
        applyContact(el('contact-select').value, getClient(getClientId()));
        markDirty();
      });
      el('document-client')?.addEventListener('input', markDirty);
      el('contact-add')?.addEventListener('click', () => {
        openNewContact().catch((err) => {
          global.GderpiStatus.showStatus(err.message || 'Erreur contact', 'danger');
        });
      });
    }

    function setLists(nextBoutiques, nextClients) {
      if (Array.isArray(nextBoutiques)) boutiques = nextBoutiques;
      if (Array.isArray(nextClients)) clients = nextClients;
    }

    return {
      bind,
      setLists,
      populateBoutique,
      applyDocument,
      applyClient,
      collect,
      reset,
      setEditable,
      getClientId,
      ensureClientLoaded
    };
  }

  global.GderpiDocPartyFields = { createDocPartyFields };
})(window);
