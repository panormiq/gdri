(function initAnnuaireApp(global) {
  'use strict';

  const state = {
    organisations: [],
    contacts: [],
    services: [],
    selectedOrgId: null,
    filterScope: '',
    filterRole: '',
    gderpi: null
  };

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function orgKindLabel(o) {
    if (o.gderpiBoutiqueId) return 'Boutique';
    if (o.isOwnEntity) return 'Entreprise';
    if ((o.roles || []).includes('client')) return 'Client';
    if ((o.roles || []).includes('fournisseur')) return 'Fournisseur';
    if (o.scope === 'interne') return 'Interne';
    return 'Externe';
  }

  function orgKindClass(o) {
    if (o.gderpiBoutiqueId) return 'boutique';
    if (o.isOwnEntity) return 'siege';
    return 'default';
  }

  function roleTags(roles) {
    return (roles || []).map(function (r) {
      return '<span class="annuaire-tag annuaire-tag--' + esc(r) + '">' + esc(r) + '</span>';
    }).join('');
  }

  function selectedOrg() {
    return state.organisations.find(function (o) { return o.organisationId === state.selectedOrgId; }) || null;
  }

  function renderOrgList() {
    const ul = document.getElementById('annuaire-org-list');
    if (!ul) return;
    let list = state.organisations;
    if (state.filterScope) {
      list = list.filter(function (o) { return o.scope === state.filterScope; });
    }
    if (state.filterRole) {
      list = list.filter(function (o) {
        return (o.roles || []).indexOf(state.filterRole) >= 0;
      });
    }
    if (!list.length) {
      ul.innerHTML = '<div class="annuaire-empty">Aucune organisation</div>';
      return;
    }
    ul.innerHTML = list.map(function (o) {
      const active = o.organisationId === state.selectedOrgId ? ' active' : '';
      const kind = orgKindLabel(o);
      const kindClass = orgKindClass(o);
      return '<button type="button" class="annuaire-org-item' + active + '" data-org-id="' + esc(o.organisationId) + '">' +
        '<div class="annuaire-org-item-title">' +
          '<span class="annuaire-kind-badge annuaire-kind-badge--' + esc(kindClass) + '">' + esc(kind) + '</span> ' +
          esc(o.displayName) +
        '</div>' +
        '<div class="annuaire-org-item-meta">' + esc(o.scope) + ' · ' + esc((o.roles || []).join(', ')) + '</div>' +
      '</button>';
    }).join('');
    ul.querySelectorAll('[data-org-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectOrganisation(btn.getAttribute('data-org-id'));
      });
    });
  }

  function renderMain() {
    const main = document.getElementById('annuaire-main');
    if (!main) return;
    const org = selectedOrg();
    if (!org) {
      main.innerHTML = '<div class="annuaire-empty">Sélectionnez une organisation</div>';
      return;
    }

    const orgContacts = state.contacts.filter(function (c) {
      return c.organisationId === org.organisationId;
    });

    let gderpiActions = '';
    if (state.gderpi && state.gderpi.gderpiInstalled) {
      if (!org.gderpiClientId && org.scope === 'externe') {
        gderpiActions += '<button type="button" class="btn btn-outline btn-sm" id="annuaire-btn-gderpi-client">Créer client GDERPI</button> ';
      } else if (org.gderpiClientId) {
        gderpiActions += '<span class="text-muted small">Client GDERPI lié</span> ';
      }
      if (!org.gderpiFournisseurId && org.scope === 'externe') {
        gderpiActions += '<button type="button" class="btn btn-outline btn-sm" id="annuaire-btn-gderpi-fournisseur">Créer fournisseur GDERPI</button>';
      } else if (org.gderpiFournisseurId) {
        gderpiActions += '<span class="text-muted small">Fournisseur GDERPI lié</span>';
      }
      if (org.gderpiBoutiqueId) {
        gderpiActions += '<span class="text-muted small">Boutique GDERPI liée</span>';
      }
    }

    let orgHint = '';
    if (org.gderpiBoutiqueId) {
      orgHint = 'Votre entité commerciale (GDERPI). Une boutique = une fiche dans l\'annuaire, sans doublon.';
    } else if (org.isOwnEntity) {
      orgHint = 'Entité interne par défaut (sans module GDERPI boutique).';
    }

    main.innerHTML =
      '<div class="annuaire-panel">' +
        '<div class="d-flex justify-content-between align-items-start flex-wrap gap-2">' +
          '<h2>' + esc(org.displayName) + '</h2>' +
          '<button type="button" class="btn btn-outline btn-sm" id="annuaire-btn-edit-org">Modifier l\'entité</button>' +
        '</div>' +
        '<div class="annuaire-tags">' + roleTags(org.roles) +
          '<span class="annuaire-tag">' + esc(org.scope) + '</span>' +
          (org.gderpiBoutiqueId ? '<span class="annuaire-tag annuaire-tag--boutique">Boutique GDERPI</span>' : '') +
          (org.isPrimaryCompany ? '<span class="annuaire-tag" style="background:#dbeafe;color:#1d4ed8">Principale</span>' : '') +
        '</div>' +
        (orgHint ? '<p class="text-muted small annuaire-org-hint">' + esc(orgHint) + '</p>' : '') +
        '<p class="text-muted small">' + esc(org.email) + (org.telephone ? ' · ' + esc(org.telephone) : '') +
          (org.siret ? '<br>SIRET : ' + esc(org.siret) : '') + '</p>' +
        '<div class="annuaire-actions">' + gderpiActions + '</div>' +
      '</div>' +
      '<div class="annuaire-panel">' +
        '<h2>Contacts (' + orgContacts.length + ')</h2>' +
        '<div class="annuaire-form-grid" id="annuaire-contact-form">' +
          '<div><label>Prénom</label><input type="text" id="annuaire-c-prenom"></div>' +
          '<div><label>Nom</label><input type="text" id="annuaire-c-nom"></div>' +
          '<div><label>Email</label><input type="email" id="annuaire-c-email"></div>' +
          '<div><label>Téléphone</label><input type="text" id="annuaire-c-tel"></div>' +
          '<div><label>Fonction</label><input type="text" id="annuaire-c-fonction"></div>' +
          '<div><label>Service</label><select id="annuaire-c-service"><option value="">—</option>' +
            state.services.map(function (s) {
              return '<option value="' + esc(s.serviceId) + '">' + esc(s.libelle) + '</option>';
            }).join('') +
          '</select></div>' +
        '</div>' +
        '<button type="button" class="btn btn-primary btn-sm" id="annuaire-btn-add-contact">Ajouter contact</button>' +
        '<table class="annuaire-contact-table" style="margin-top:1rem">' +
          '<thead><tr><th>Nom</th><th>Service</th><th>Email</th><th>Tél</th><th></th></tr></thead>' +
          '<tbody>' +
            (orgContacts.length ? orgContacts.map(function (c) {
              return '<tr><td>' + esc(c.displayName) + (c.principal ? ' ★' : '') + '</td>' +
                '<td>' + esc(c.serviceLabel || c.serviceLibelle || '') + '</td>' +
                '<td>' + esc(c.email) + '</td>' +
                '<td>' + esc(c.telephone) + '</td>' +
                '<td><button type="button" class="btn btn-link btn-sm text-danger annuaire-del-contact" data-id="' + esc(c.contactId) + '">Suppr.</button></td></tr>';
            }).join('') : '<tr><td colspan="5" class="text-muted">Aucun contact</td></tr>') +
          '</tbody>' +
        '</table>' +
      '</div>';

    const addBtn = document.getElementById('annuaire-btn-add-contact');
    if (addBtn) addBtn.addEventListener('click', addContact);
    const editOrgBtn = document.getElementById('annuaire-btn-edit-org');
    if (editOrgBtn) editOrgBtn.addEventListener('click', function () { openOrgModal(org); });
    const gderpiBtn = document.getElementById('annuaire-btn-gderpi-client');
    if (gderpiBtn) gderpiBtn.addEventListener('click', createGderpiClient);
    const gderpiFrsBtn = document.getElementById('annuaire-btn-gderpi-fournisseur');
    if (gderpiFrsBtn) gderpiFrsBtn.addEventListener('click', createGderpiFournisseur);
    main.querySelectorAll('.annuaire-del-contact').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Supprimer ce contact ?')) deleteContact(btn.getAttribute('data-id'));
      });
    });
  }

  function selectOrganisation(orgId) {
    state.selectedOrgId = orgId;
    renderOrgList();
    return global.AnnuaireApi.call('/services?organisationId=' + encodeURIComponent(orgId))
      .then(function (res) {
        state.services = res.data || [];
        return global.AnnuaireApi.call('/contacts?organisationId=' + encodeURIComponent(orgId));
      })
      .then(function (res) {
        state.contacts = res.data || [];
        renderMain();
      });
  }

  function loadOrganisations() {
    const q = document.getElementById('annuaire-search');
    const params = new URLSearchParams();
    if (state.filterScope) params.set('scope', state.filterScope);
    if (state.filterRole) params.set('role', state.filterRole);
    if (q && q.value.trim()) params.set('q', q.value.trim());
    const qs = params.toString() ? '?' + params.toString() : '';
    return global.AnnuaireApi.call('/organisations' + qs).then(function (res) {
      state.organisations = res.data || [];
      if (!state.selectedOrgId && state.organisations.length) {
        state.selectedOrgId = state.organisations[0].organisationId;
      }
      renderOrgList();
      if (state.selectedOrgId) return selectOrganisation(state.selectedOrgId);
      renderMain();
    });
  }

  function closeOrgModal() {
    const modal = document.getElementById('annuaire-org-modal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }

  function isCompanyProfileOrg(org) {
    return Boolean(org && (org.isOwnEntity || org.gderpiBoutiqueId));
  }

  function openOrgModal(org) {
    const modal = document.getElementById('annuaire-org-modal');
    const form = document.getElementById('annuaire-org-form');
    if (!modal || !form) return;

    const isEdit = Boolean(org);
    const title = document.getElementById('annuaire-org-modal-title');
    const hint = document.getElementById('annuaire-org-modal-hint');
    const scopeSelect = document.getElementById('annuaire-org-scope');
    const rolesWrap = document.getElementById('annuaire-org-roles-wrap');
    const identityExtra = document.getElementById('annuaire-org-identity-extra');
    const primaryWrap = document.getElementById('annuaire-org-primary-wrap');
    const primaryInput = document.getElementById('annuaire-org-primary');

    document.getElementById('annuaire-org-edit-id').value = isEdit ? org.organisationId : '';
    document.getElementById('annuaire-org-raison').value = isEdit ? (org.raisonSociale || org.displayName || '') : '';
    document.getElementById('annuaire-org-type').value = isEdit ? (org.type || 'entreprise') : 'entreprise';
    document.getElementById('annuaire-org-scope').value = isEdit ? (org.scope || 'externe') : 'externe';
    document.getElementById('annuaire-org-siret').value = isEdit ? (org.siret || '') : '';
    document.getElementById('annuaire-org-email').value = isEdit ? (org.email || '') : '';
    document.getElementById('annuaire-org-tel').value = isEdit ? (org.telephone || '') : '';
    document.getElementById('annuaire-org-web').value = isEdit ? (org.siteWeb || '') : '';
    document.getElementById('annuaire-org-notes').value = isEdit ? (org.notes || '') : '';

    if (identityExtra) {
      const showIdentity = isEdit && isCompanyProfileOrg(org);
      identityExtra.hidden = !showIdentity;
      if (primaryWrap) primaryWrap.hidden = !(showIdentity && org.gderpiBoutiqueId);
      if (primaryInput) primaryInput.checked = org.isPrimaryCompany === true;
      if (showIdentity) {
        document.getElementById('annuaire-org-forme').value = org.formeJuridique || '';
        document.getElementById('annuaire-org-tva').value = org.tvaIntracommunautaire || '';
        document.getElementById('annuaire-org-rcs').value = org.rcs || '';
        document.getElementById('annuaire-org-capital').value = org.capitalSocial || '';
        document.getElementById('annuaire-org-adresse').value = org.adresse || '';
        document.getElementById('annuaire-org-adresse2').value = org.adresseComplement || '';
        document.getElementById('annuaire-org-cp').value = org.codePostal || '';
        document.getElementById('annuaire-org-ville').value = org.ville || '';
        document.getElementById('annuaire-org-pays').value = org.pays || 'France';
      }
    }

    form.querySelectorAll('input[name="annuaire-org-role"]').forEach(function (cb) {
      cb.checked = isEdit ? (org.roles || []).indexOf(cb.value) >= 0 : cb.value === 'prospect';
    });

    if (title) title.textContent = isEdit ? 'Modifier l\'entité' : 'Nouvelle entité';
    if (hint) {
      if (isEdit && org.gderpiBoutiqueId) {
        hint.textContent = 'Boutique GDERPI — identité synchronisée avec GDERPI. La boutique principale alimente UGAP et la fiche entité GDRI.';
      } else if (isEdit && org.isOwnEntity) {
        hint.textContent = 'Votre entreprise — les modifications sont synchronisées vers la fiche entité GDRI.';
      } else {
        hint.textContent = 'Clients, fournisseurs ou contacts internes. Vos boutiques viennent de GDERPI (une fiche = une boutique).';
      }
    }

    const lockScope = isEdit && (org.isOwnEntity || org.gderpiBoutiqueId);
    if (scopeSelect) scopeSelect.disabled = lockScope;
    if (rolesWrap) {
      rolesWrap.style.opacity = lockScope ? '0.6' : '1';
      form.querySelectorAll('input[name="annuaire-org-role"]').forEach(function (cb) {
        cb.disabled = lockScope;
      });
    }

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('annuaire-org-raison')?.focus();
  }

  function collectOrgFormPayload(editId) {
    const org = editId ? state.organisations.find(function (o) { return o.organisationId === editId; }) : null;
    const locked = org && (org.isOwnEntity || org.gderpiBoutiqueId);
    const roles = [];
    if (!locked) {
      document.querySelectorAll('input[name="annuaire-org-role"]:checked').forEach(function (cb) {
        roles.push(cb.value);
      });
    }
    const scopeEl = document.getElementById('annuaire-org-scope');
    const scope = locked && org ? org.scope : ((scopeEl || {}).value || 'externe');
    if (!locked && !roles.length) roles.push(scope === 'interne' ? 'interne' : 'prospect');
    const payload = {
      raisonSociale: ((document.getElementById('annuaire-org-raison') || {}).value || '').trim(),
      type: (document.getElementById('annuaire-org-type') || {}).value || 'entreprise',
      siret: (document.getElementById('annuaire-org-siret') || {}).value || '',
      email: (document.getElementById('annuaire-org-email') || {}).value || '',
      telephone: (document.getElementById('annuaire-org-tel') || {}).value || '',
      siteWeb: (document.getElementById('annuaire-org-web') || {}).value || '',
      notes: (document.getElementById('annuaire-org-notes') || {}).value || ''
    };
    if (org && isCompanyProfileOrg(org)) {
      payload.formeJuridique = (document.getElementById('annuaire-org-forme') || {}).value || '';
      payload.tvaIntracommunautaire = (document.getElementById('annuaire-org-tva') || {}).value || '';
      payload.rcs = (document.getElementById('annuaire-org-rcs') || {}).value || '';
      payload.capitalSocial = (document.getElementById('annuaire-org-capital') || {}).value || '';
      payload.adresse = (document.getElementById('annuaire-org-adresse') || {}).value || '';
      payload.adresseComplement = (document.getElementById('annuaire-org-adresse2') || {}).value || '';
      payload.codePostal = (document.getElementById('annuaire-org-cp') || {}).value || '';
      payload.ville = (document.getElementById('annuaire-org-ville') || {}).value || '';
      payload.pays = (document.getElementById('annuaire-org-pays') || {}).value || 'France';
      if (org.gderpiBoutiqueId && document.getElementById('annuaire-org-primary')?.checked) {
        payload.isPrimaryCompany = true;
      }
    }
    if (!locked) {
      payload.scope = scope;
      payload.roles = roles;
    }
    return payload;
  }

  function saveOrganisation(ev) {
    if (ev) ev.preventDefault();
    const editId = (document.getElementById('annuaire-org-edit-id') || {}).value || '';
    const payload = collectOrgFormPayload(editId);
    if (!payload.raisonSociale) {
      alert('Raison sociale / nom requis');
      return;
    }
    const req = editId
      ? global.AnnuaireApi.call('/organisations/' + encodeURIComponent(editId), {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
      : global.AnnuaireApi.call('/organisations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

    req.then(function () {
      closeOrgModal();
      return loadOrganisations();
    }).catch(function (err) { alert(err.message); });
  }

  function addOrganisation() {
    openOrgModal(null);
  }

  function addContact() {
    const org = selectedOrg();
    if (!org) return;
    global.AnnuaireApi.call('/contacts', {
      method: 'POST',
      body: JSON.stringify({
        organisationId: org.organisationId,
        prenom: (document.getElementById('annuaire-c-prenom') || {}).value || '',
        nom: (document.getElementById('annuaire-c-nom') || {}).value || '',
        email: (document.getElementById('annuaire-c-email') || {}).value || '',
        telephone: (document.getElementById('annuaire-c-tel') || {}).value || '',
        fonction: (document.getElementById('annuaire-c-fonction') || {}).value || '',
        serviceId: (document.getElementById('annuaire-c-service') || {}).value || null,
        scope: org.scope
      })
    }).then(function () { return selectOrganisation(org.organisationId); })
      .catch(function (err) { alert(err.message); });
  }

  function deleteContact(contactId) {
    const org = selectedOrg();
    global.AnnuaireApi.call('/contacts/' + encodeURIComponent(contactId), { method: 'DELETE' })
      .then(function () { return selectOrganisation(org.organisationId); })
      .catch(function (err) { alert(err.message); });
  }

  function importGderpi() {
    if (!confirm('Importer clients, fournisseurs et boutiques GDERPI dans l\'annuaire ?')) return;
    global.AnnuaireApi.call('/integrations/gderpi/import', { method: 'POST', body: '{}' })
      .then(function (res) {
        const s = res.data || {};
        const parts = [
          (s.clients || 0) + ' client(s)',
          (s.fournisseurs || 0) + ' fournisseur(s)',
          (s.boutiques || 0) + ' boutique(s)',
          (s.contactsImported || 0) + ' contact(s) importé(s)'
        ];
        alert('Import terminé : ' + parts.join(', ') + '.');
        return loadOrganisations();
      })
      .catch(function (err) { alert(err.message); });
  }

  function createGderpiClient() {
    const org = selectedOrg();
    if (!org || !confirm('Créer un client GDERPI pour cette organisation ?')) return;
    global.AnnuaireApi.call('/integrations/gderpi/organisations/' + encodeURIComponent(org.organisationId) + '/create-client', {
      method: 'POST',
      body: '{}'
    }).then(function () {
      alert('Client GDERPI créé');
      return loadOrganisations();
    }).catch(function (err) { alert(err.message); });
  }

  function createGderpiFournisseur() {
    const org = selectedOrg();
    if (!org || !confirm('Créer un fournisseur GDERPI pour cette organisation ?')) return;
    global.AnnuaireApi.call('/integrations/gderpi/organisations/' + encodeURIComponent(org.organisationId) + '/create-fournisseur', {
      method: 'POST',
      body: '{}'
    }).then(function () {
      alert('Fournisseur GDERPI créé');
      return loadOrganisations();
    }).catch(function (err) { alert(err.message); });
  }

  function bindFilters() {
    document.querySelectorAll('[data-annuaire-scope], [data-annuaire-role]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-annuaire-scope], [data-annuaire-role]').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        state.filterScope = btn.getAttribute('data-annuaire-scope') || '';
        state.filterRole = btn.getAttribute('data-annuaire-role') || '';
        loadOrganisations();
      });
    });
  }

  function bindOrgModal() {
    document.getElementById('annuaire-org-form')?.addEventListener('submit', saveOrganisation);
    document.querySelectorAll('[data-annuaire-modal-close]').forEach(function (el) {
      el.addEventListener('click', closeOrgModal);
    });
  }

  function init() {
    bindFilters();
    bindOrgModal();
    document.getElementById('annuaire-btn-refresh')?.addEventListener('click', loadOrganisations);
    document.getElementById('annuaire-btn-add-org')?.addEventListener('click', addOrganisation);
    document.getElementById('annuaire-btn-import-gderpi')?.addEventListener('click', importGderpi);
    document.getElementById('annuaire-search')?.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') loadOrganisations();
    });

    global.AnnuaireApi.call('/integrations/gderpi/status').then(function (res) {
      state.gderpi = res.data;
      const badge = document.getElementById('annuaire-gderpi-badge');
      if (badge) {
        if (!state.gderpi.gderpiInstalled) {
          badge.textContent = 'GDERPI absent';
        } else {
          const links = [
            state.gderpi.linkedClients + ' client(s)',
            state.gderpi.linkedFournisseurs + ' frs',
            state.gderpi.linkedBoutiques + ' boutique(s)'
          ].join(' · ');
          badge.textContent = 'GDERPI connecté · ' + links;
        }
      }
    }).catch(function () {});

    loadOrganisations().catch(function (err) {
      console.error('Annuaire init:', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
