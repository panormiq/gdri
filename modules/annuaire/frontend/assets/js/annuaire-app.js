(function initAnnuaireApp(global) {
  'use strict';

  const cfg = global.ANNUAIRE_CONFIG || {};
  const state = {
    organisations: [],
    contacts: [],
    services: [],
    selectedOrgId: null,
    contextBoutiqueId: null,
    selectionSource: 'boutique',
    filterKind: '',
    filterOwner: '',
    myContacts: null,
    currentUserId: String(cfg.currentUserId || '').trim(),
    members: [],
    identityMode: cfg.mode === 'identity',
    canManage: cfg.canManage === true,
    identityUrl: String(cfg.identityUrl || ''),
    openDropbox: ''
  };

  const ROLE_LABELS = {
    client: 'Client',
    fournisseur: 'Fournisseur',
    prospect: 'Prospect',
    partenaire: 'Partenaire',
    interne: 'Interne',
    boutique: 'Boutique'
  };

  const KIND_TAB_LABELS = {
    '': 'Tous',
    client: 'Clients',
    fournisseur: 'Fournisseurs',
    prospect: 'Prospects',
    interne: 'Internes',
    boutique: 'Boutiques'
  };

  function applyKindFilter(list, kind) {
    const k = kind != null ? kind : state.filterKind;
    if (!k) return list;
    if (k === 'interne') {
      return list.filter(function (o) {
        return o.scope === 'interne' || (o.roles || []).indexOf('interne') >= 0;
      });
    }
    if (k === 'boutique') {
      return list.filter(function (o) {
        return o.gderpiBoutiqueId || (o.roles || []).indexOf('boutique') >= 0;
      });
    }
    return list.filter(function (o) {
      return (o.roles || []).indexOf(k) >= 0;
    });
  }

  function dropboxVisible(kind) {
    const k = state.filterKind;
    if (!k) return true;
    if (k === 'boutique') return kind === 'boutique';
    if (k === 'interne') return kind === 'client';
    return kind === k;
  }

  function updateFilterTabCounts() {
    document.querySelectorAll('[data-annuaire-kind]').forEach(function (btn) {
      const kind = btn.getAttribute('data-annuaire-kind') || '';
      const label = KIND_TAB_LABELS[kind] || kind;
      let n = 0;
      if (kind === 'boutique') n = state.organisations.filter(isBoutiqueOrg).length;
      else if (kind === 'interne') {
        n = state.organisations.filter(function (o) {
          return o.scope === 'interne' || (o.roles || []).indexOf('interne') >= 0;
        }).length;
      } else if (kind) {
        n = state.organisations.filter(function (o) {
          return (o.roles || []).indexOf(kind) >= 0;
        }).length;
      } else {
        n = state.organisations.filter(function (o) { return !isOwnCompanyOrg(o); }).length;
      }
      btn.textContent = n ? label + ' (' + n + ')' : label;
    });
  }

  function sortByDisplayName(a, b) {
    return (a.displayName || '').localeCompare(b.displayName || '', 'fr');
  }

  function isBoutiqueOrg(org) {
    return Boolean(org && (org.gderpiBoutiqueId || (org.roles || []).indexOf('boutique') >= 0));
  }

  function entityLegalOrg() {
    return state.organisations.find(function (o) { return o.isOwnEntity; })
      || state.organisations.find(function (o) { return o.isPrimaryCompany && o.gderpiBoutiqueId; })
      || primaryOrganisation();
  }

  function orgLinkedToBoutique(org, boutiqueId) {
    if (!boutiqueId || !org) return true;
    const links = org.boutiqueOrganisationIds || [];
    if (!links.length) return true;
    return links.indexOf(boutiqueId) >= 0;
  }

  function filterOrgsBySearch(list) {
    const needle = searchNeedle();
    if (!needle) return list;
    return list.filter(function (o) {
      const hay = [
        o.displayName,
        o.raisonSociale,
        o.email,
        o.ville,
        (o.roles || []).join(' ')
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.indexOf(needle) >= 0;
    });
  }

  function listClientsForPicker() {
    let list = state.organisations.filter(function (o) {
      if (isOwnCompanyOrg(o)) return false;
      if (state.filterKind === 'interne') {
        return o.scope === 'interne' || (o.roles || []).indexOf('interne') >= 0;
      }
      return (o.roles || []).indexOf('client') >= 0
        || (o.roles || []).indexOf('prospect') >= 0
        || (o.roles || []).indexOf('partenaire') >= 0;
    });
    list = applyKindFilter(list);
    if (state.contextBoutiqueId) {
      list = list.filter(function (o) { return orgLinkedToBoutique(o, state.contextBoutiqueId); });
    }
    list = applyOwnerOrganisationFilter(list);
    return filterOrgsBySearch(list).sort(sortByDisplayName);
  }

  function listFournisseursForPicker() {
    let list = state.organisations.filter(function (o) {
      return !isOwnCompanyOrg(o) && (o.roles || []).indexOf('fournisseur') >= 0;
    });
    list = applyKindFilter(list);
    if (state.contextBoutiqueId) {
      list = list.filter(function (o) { return orgLinkedToBoutique(o, state.contextBoutiqueId); });
    }
    list = applyOwnerOrganisationFilter(list);
    return filterOrgsBySearch(list).sort(sortByDisplayName);
  }

  function listBoutiquesForPicker() {
    let list = state.organisations.filter(isBoutiqueOrg);
    list = applyKindFilter(list);
    return filterOrgsBySearch(list).sort(sortByDisplayName);
  }

  function defaultBoutiqueId() {
    const primary = primaryOrganisation();
    if (primary && isBoutiqueOrg(primary)) return primary.organisationId;
    const boutiques = listBoutiquesForPicker();
    return boutiques.length ? boutiques[0].organisationId : null;
  }

  function pickDefaultOrgId() {
    return state.contextBoutiqueId || defaultBoutiqueId();
  }

  function syncSelectionAfterBoutiqueChange() {
    const org = selectedOrg();
    if (org && !isBoutiqueOrg(org) && state.contextBoutiqueId && !orgLinkedToBoutique(org, state.contextBoutiqueId)) {
      state.selectedOrgId = state.contextBoutiqueId;
      state.selectionSource = 'boutique';
      return true;
    }
    if (state.contextBoutiqueId && (state.selectionSource === 'boutique' || !org)) {
      state.selectedOrgId = state.contextBoutiqueId;
      state.selectionSource = 'boutique';
      return true;
    }
    return false;
  }

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

  function primaryOrganisation() {
    return state.organisations.find(function (o) { return o.isPrimaryCompany; })
      || state.organisations.find(function (o) { return o.gderpiBoutiqueId; })
      || state.organisations.find(function (o) { return o.isOwnEntity; })
      || null;
  }

  function searchNeedle() {
    const q = document.getElementById('annuaire-search');
    return q && q.value.trim() ? q.value.trim().toLowerCase() : '';
  }

  function isOwnCompanyOrg(org) {
    return Boolean(org && (org.isOwnEntity || org.gderpiBoutiqueId));
  }

  function openOwnCompanyEditor(org) {
    if (!org) return;
    openOrgModal(org);
  }

  function contactsSectionMeta(org) {
    if (isOwnCompanyOrg(org)) {
      return {
        title: 'Équipe interne',
        hint: 'Collaborateurs de votre entreprise (Direction, Commercial…).',
        addLabel: '+ Ajouter un collaborateur',
        empty: 'Aucun collaborateur. Ajoutez les membres de votre équipe ici.'
      };
    }
    return {
      title: 'Contacts',
      hint: 'Personnes de contact chez ce client ou ce fournisseur.',
      addLabel: '+ Ajouter un contact',
      empty: 'Aucun contact. Cliquez « + Ajouter un contact ».'
    };
  }

  function renderContactsSectionHtml(org, orgContacts) {
    const meta = contactsSectionMeta(org);
    const contactCardsHtml = orgContacts.length
      ? orgContacts.map(renderContactCard).join('')
      : '<div class="annuaire-contacts-empty">' + esc(meta.empty) + '</div>';
    return '<section class="annuaire-contacts-section annuaire-contacts-section--full' +
      (isOwnCompanyOrg(org) ? ' annuaire-contacts-section--internal' : '') + '">' +
      '<div class="annuaire-contacts-toolbar">' +
        '<div>' +
          '<h3>' + esc(meta.title) + ' <span class="annuaire-contacts-toolbar__count">· ' + orgContacts.length + '</span></h3>' +
          (meta.hint ? '<p class="annuaire-contacts-toolbar__hint">' + esc(meta.hint) + '</p>' : '') +
        '</div>' +
      '<details class="annuaire-add-contact-details">' +
        '<summary>' + esc(meta.addLabel) + '</summary>' +
        '<div class="annuaire-add-contact-form">' +
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
            '<div><label>Responsable</label><select id="annuaire-c-owner">' +
              renderOwnerSelectOptions(state.currentUserId) +
            '</select></div>' +
          '</div>' +
          '<button type="button" class="btn btn-primary btn-sm" id="annuaire-btn-add-contact" style="margin-top:0.65rem;">Enregistrer</button>' +
        '</div>' +
      '</details>' +
      '<div class="annuaire-contact-cards">' + contactCardsHtml + '</div>' +
    '</section>';
  }

  function renderOrgRecapHtml(org) {
    const contactLine = [org.email, org.telephone].filter(Boolean).join(' · ');
    const cityLine = [org.codePostal, org.ville].filter(Boolean).join(' ');
    const metaLines = [];
    if (contactLine) metaLines.push(esc(contactLine));
    if (org.siret) metaLines.push('SIRET : ' + esc(org.siret));
    if (cityLine) metaLines.push(esc(cityLine));

    if (!state.canManage) {
      return '<div class="annuaire-org-panel annuaire-org-panel--main">' +
        '<div class="annuaire-org-panel__inner">' +
          '<p class="annuaire-org-panel__title">' + esc(org.displayName) + '</p>' +
          '<div class="annuaire-tags annuaire-tags--compact">' + roleTags(org.roles) + '</div>' +
          (metaLines.length ? '<p class="annuaire-org-panel__meta">' + metaLines.join('<br>') + '</p>' : '') +
        '</div>' +
      '</div>';
    }

    return '<div class="annuaire-org-panel annuaire-org-panel--main">' +
      '<div class="annuaire-org-panel__inner">' +
        '<div class="annuaire-org-panel__head">' +
          '<p class="annuaire-org-panel__title">' + esc(org.displayName) + '</p>' +
          '<button type="button" class="btn btn-outline btn-sm" id="annuaire-btn-edit-org">Modifier</button>' +
        '</div>' +
        '<div class="annuaire-tags annuaire-tags--compact">' + roleTags(org.roles) +
          (org.isPrimaryCompany ? '<span class="annuaire-tag" style="background:#dbeafe;color:#1d4ed8">Principale</span>' : '') +
        '</div>' +
        (metaLines.length ? '<p class="annuaire-org-panel__meta">' + metaLines.join('<br>') + '</p>' : '') +
      '</div>' +
    '</div>';
  }

  function renderEntityBar() {
    const el = document.getElementById('annuaire-entity-bar');
    if (!el || state.identityMode) return;
    const entity = entityLegalOrg();
    if (!entity) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    const contactLine = [entity.email, entity.telephone].filter(Boolean).join(' · ');
    el.hidden = false;
    el.innerHTML =
      '<div class="annuaire-entity-bar__inner" tabindex="0" role="button" aria-label="Coordonnées légales — double-clic pour modifier">' +
        '<span class="annuaire-entity-bar__label">Entité légale</span>' +
        '<span class="annuaire-entity-bar__name">' + esc(entity.displayName) + '</span>' +
        (contactLine ? '<span class="annuaire-entity-bar__meta">' + esc(contactLine) + '</span>' : '') +
        (state.canManage ? '<span class="annuaire-entity-bar__hint">Double-clic · coordonnées</span>' : '') +
      '</div>';
    const inner = el.querySelector('.annuaire-entity-bar__inner');
    if (inner && state.canManage) {
      inner.addEventListener('dblclick', function () { openOwnCompanyEditor(entity); });
    }
  }

  function orgDisplayLabel(org) {
    return org ? org.displayName : '— Choisir —';
  }

  function renderDropboxListItems(options, selectedId, source) {
    if (!options.length) {
      return '<div class="annuaire-dropbox__empty">Aucune entité</div>';
    }
    return options.map(function (o) {
      const active = o.organisationId === selectedId ? ' active' : '';
      return '<button type="button" class="annuaire-org-item annuaire-dropbox__item' + active + '" data-org-id="' +
        esc(o.organisationId) + '" data-dropbox-source="' + esc(source) + '">' +
        '<div class="annuaire-org-item-title">' + esc(o.displayName) + '</div>' +
      '</button>';
    }).join('');
  }

  function renderDropbox(kind, label, options, selectedId) {
    if (!dropboxVisible(kind)) return '';
    const openClass = state.openDropbox === kind ? ' annuaire-dropbox--open' : '';
    const found = options.find(function (o) { return o.organisationId === selectedId; });
    const value = found ? found.displayName : '— Choisir —';

    return '<div class="annuaire-dropbox' + openClass + '" data-dropbox="' + esc(kind) + '">' +
      '<button type="button" class="annuaire-dropbox__trigger" data-dropbox-toggle="' + esc(kind) + '">' +
        '<span class="annuaire-dropbox__label">' + esc(label) + '</span>' +
        '<span class="annuaire-dropbox__value">' + esc(value) + '</span>' +
        '<span class="annuaire-dropbox__chev" aria-hidden="true">▾</span>' +
      '</button>' +
      '<div class="annuaire-dropbox__panel">' +
        renderDropboxListItems(options, selectedId, kind) +
      '</div>' +
    '</div>';
  }

  function closeAllDropboxes() {
    state.openDropbox = '';
    document.querySelectorAll('.annuaire-dropbox--open').forEach(function (el) {
      el.classList.remove('annuaire-dropbox--open');
    });
  }

  function bindDropboxHandlers() {
    document.querySelectorAll('[data-dropbox-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        const kind = btn.getAttribute('data-dropbox-toggle') || '';
        const box = btn.closest('.annuaire-dropbox');
        if (!box) return;
        const willOpen = !box.classList.contains('annuaire-dropbox--open');
        closeAllDropboxes();
        if (willOpen) {
          box.classList.add('annuaire-dropbox--open');
          state.openDropbox = kind;
        }
      });
    });

    document.querySelectorAll('.annuaire-dropbox__item[data-org-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const orgId = btn.getAttribute('data-org-id');
        const source = btn.getAttribute('data-dropbox-source') || 'boutique';
        if (source === 'boutique') {
          state.contextBoutiqueId = orgId;
          state.selectionSource = 'boutique';
          state.selectedOrgId = orgId;
        } else if (source === 'client') {
          state.selectionSource = 'client';
          state.selectedOrgId = orgId;
        } else if (source === 'fournisseur') {
          state.selectionSource = 'fournisseur';
          state.selectedOrgId = orgId;
        }
        closeAllDropboxes();
        renderDropboxes();
        selectOrganisation(orgId);
      });
    });
  }

  function renderDropboxes() {
    const el = document.getElementById('annuaire-dropboxes');
    if (!el || state.identityMode) return;

    const boutiques = listBoutiquesForPicker();
    const clients = listClientsForPicker();
    const fournisseurs = listFournisseursForPicker();
    const org = selectedOrg();

    let boutiqueSelected = state.contextBoutiqueId || '';
    let clientSelected = '';
    let frsSelected = '';
    if (org) {
      if (state.selectionSource === 'client') clientSelected = org.organisationId;
      else if (state.selectionSource === 'fournisseur') frsSelected = org.organisationId;
      else if (isBoutiqueOrg(org) || state.selectionSource === 'boutique') {
        boutiqueSelected = org.organisationId;
        state.contextBoutiqueId = org.organisationId;
      }
    }

    updateFilterTabCounts();

    el.innerHTML =
      renderDropbox('boutique', 'Boutique', boutiques, boutiqueSelected) +
      renderDropbox('client', 'Client', clients, clientSelected) +
      renderDropbox('fournisseur', 'Fournisseur', fournisseurs, frsSelected);

    bindDropboxHandlers();
  }

  function renderSidebar() {
    renderEntityBar();
    renderDropboxes();
  }

  function contactInitials(c) {
    const p = (c.prenom || '').trim();
    const n = (c.nom || '').trim();
    if (p && n) return (p.charAt(0) + n.charAt(0)).toUpperCase();
    const d = (c.displayName || '?').trim();
    return d.slice(0, 2).toUpperCase();
  }

  function renderContactCard(c) {
    const principal = c.principal ? ' annuaire-contact-card--principal' : '';
    const roleLine = c.fonction || c.serviceLabel || c.serviceLibelle || '';
    const serviceOnly = c.serviceLabel && c.fonction ? c.serviceLabel : '';
    let html = '<article class="annuaire-contact-card' + principal + '">' +
      '<div class="annuaire-contact-card__head">' +
        '<div class="annuaire-contact-card__avatar">' + esc(contactInitials(c)) + '</div>' +
        '<div>' +
          '<div class="annuaire-contact-card__name">' + esc(c.displayName) + (c.principal ? ' ★' : '') + '</div>' +
          (roleLine ? '<div class="annuaire-contact-card__role">' + esc(roleLine) + '</div>' : '') +
        '</div>' +
      '</div>';
    if (c.email) {
      html += '<div class="annuaire-contact-card__line">✉ <a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></div>';
    }
    if (c.telephone) {
      html += '<div class="annuaire-contact-card__line">📞 ' + esc(c.telephone) + '</div>';
    }
    if (serviceOnly) {
      html += '<div class="annuaire-contact-card__line">' + esc(serviceOnly) + '</div>';
    }
    html += '<div class="annuaire-contact-card__footer">' +
      '<div class="annuaire-contact-card__owner">' +
        '<select class="annuaire-owner-select" data-contact-id="' + esc(c.contactId) + '" data-previous-owner="' + esc(c.ownerUserId || '') + '" title="Responsable">' +
          renderOwnerSelectOptions(c.ownerUserId || '') +
        '</select>' +
      '</div>' +
      '<button type="button" class="annuaire-contact-card__del annuaire-del-contact" data-id="' + esc(c.contactId) + '" title="Supprimer">Suppr.</button>' +
    '</div></article>';
    return html;
  }

  function roleTags(roles) {
    return (roles || []).map(function (r) {
      return '<span class="annuaire-tag annuaire-tag--' + esc(r) + '">' + esc(ROLE_LABELS[r] || r) + '</span>';
    }).join('');
  }

  function selectedOrg() {
    return state.organisations.find(function (o) { return o.organisationId === state.selectedOrgId; }) || null;
  }

  function memberLabel(userId) {
    if (!userId) return '—';
    if (state.currentUserId && userId === state.currentUserId) return 'Moi';
    const m = state.members.find(function (x) { return x.userId === userId; });
    return m ? (m.label || m.email) : 'Utilisateur';
  }

  function renderOwnerSelectOptions(selectedId) {
    let html = '<option value="">— Non assigné —</option>';
    state.members.forEach(function (m) {
      const sel = selectedId === m.userId ? ' selected' : '';
      html += '<option value="' + esc(m.userId) + '"' + sel + '>' + esc(m.label || m.email) + '</option>';
    });
    if (selectedId && !state.members.some(function (m) { return m.userId === selectedId; })) {
      html += '<option value="' + esc(selectedId) + '" selected>' + esc(memberLabel(selectedId)) + '</option>';
    }
    return html;
  }

  function loadMembers() {
    return global.AnnuaireApi.call('/members').then(function (res) {
      state.members = res.data || [];
    }).catch(function () {
      state.members = [];
    });
  }

  function updateContactOwner(contactId, ownerUserId, previousOwnerId) {
    return global.AnnuaireApi.call('/contacts/' + encodeURIComponent(contactId), {
      method: 'PUT',
      body: JSON.stringify({ ownerUserId: ownerUserId || null })
    }).then(function () {
      return selectOrganisation(state.selectedOrgId);
    }).catch(function (err) {
      alert(err.message);
      const sel = document.querySelector('.annuaire-owner-select[data-contact-id="' + contactId + '"]');
      if (sel) sel.value = previousOwnerId || '';
    });
  }

  function orgContactsForView(org) {
    let list = state.contacts.filter(function (c) {
      return c.organisationId === org.organisationId;
    });
    if (state.filterOwner === 'mine' && state.currentUserId) {
      list = list.filter(function (c) { return c.ownerUserId === state.currentUserId; });
    }
    return list;
  }

  function renderOrgHeaderHtml(org) {
    const contactLine = [org.email, org.telephone].filter(Boolean).join(' · ');
    const cityLine = [org.codePostal, org.ville].filter(Boolean).join(' ');

    if (state.identityMode && state.canManage) {
      const metaLines = [];
      if (contactLine) metaLines.push(esc(contactLine));
      if (org.siret) metaLines.push('SIRET : ' + esc(org.siret));
      if (org.adresse) metaLines.push(esc(org.adresse));
      if (cityLine) metaLines.push(esc(cityLine));
      return '<div class="annuaire-org-brief annuaire-org-brief--identity">' +
        '<div class="annuaire-org-brief__top">' +
          '<div>' +
            '<h2 class="annuaire-org-brief__title">' + esc(org.displayName) + '</h2>' +
            '<div class="annuaire-tags" style="margin-top:0.35rem;">' + roleTags(org.roles) + '</div>' +
          '</div>' +
          '<button type="button" class="btn btn-primary btn-sm" id="annuaire-btn-edit-org">Modifier les coordonnées</button>' +
        '</div>' +
        (metaLines.length ? '<p class="annuaire-org-brief__meta">' + metaLines.join('<br>') + '</p>' : '') +
      '</div>';
    }

    if (!state.canManage) {
      return '<div class="annuaire-org-brief annuaire-org-brief--compact">' +
        '<h2 class="annuaire-org-brief__title">' + esc(org.displayName) + '</h2>' +
        '<div class="annuaire-tags annuaire-tags--compact">' + roleTags(org.roles) + '</div>' +
        (contactLine || cityLine
          ? '<p class="annuaire-org-brief__meta">' + esc(contactLine) +
            (contactLine && cityLine ? ' · ' : '') + esc(cityLine) + '</p>'
          : '') +
      '</div>';
    }

    const metaLines = [];
    if (contactLine) metaLines.push(esc(contactLine));
    if (org.siret) metaLines.push('SIRET : ' + esc(org.siret));
    if (org.adresse) metaLines.push(esc(org.adresse));
    if (cityLine) metaLines.push(esc(cityLine));

    return '<details class="annuaire-org-admin-details">' +
      '<summary>Fiche organisation <span class="annuaire-org-admin-details__hint">· coordonnées, modification</span></summary>' +
      '<div class="annuaire-org-admin-details__body">' +
        '<div class="annuaire-org-brief__top">' +
          '<div>' +
            '<h2 class="annuaire-org-brief__title">' + esc(org.displayName) + '</h2>' +
            '<div class="annuaire-tags" style="margin-top:0.35rem;">' + roleTags(org.roles) +
              (org.isPrimaryCompany ? '<span class="annuaire-tag" style="background:#dbeafe;color:#1d4ed8">Principale</span>' : '') +
            '</div>' +
          '</div>' +
          '<button type="button" class="btn btn-outline btn-sm" id="annuaire-btn-edit-org">Modifier</button>' +
        '</div>' +
        (metaLines.length ? '<p class="annuaire-org-brief__meta">' + metaLines.join('<br>') + '</p>' : '') +
        (org.notes ? '<p class="text-muted small">' + esc(org.notes) + '</p>' : '') +
      '</div>' +
    '</details>';
  }

  function renderMain() {
    const main = document.getElementById('annuaire-main');
    if (!main) return;
    const org = selectedOrg();
    if (!org) {
      main.innerHTML = '<div class="annuaire-empty annuaire-empty--prompt"><strong>Choisissez une entité</strong><br>Utilisez les listes Boutique, Client ou Fournisseur ci-dessus.</div>';
      return;
    }

    const orgContacts = orgContactsForView(org);

    main.innerHTML =
      '<div class="annuaire-main-inner">' +
        (state.identityMode ? renderOrgHeaderHtml(org) : renderOrgRecapHtml(org)) +
        (state.identityMode ? '' : renderContactsSectionHtml(org, orgContacts)) +
      '</div>';

    const addBtn = document.getElementById('annuaire-btn-add-contact');
    if (addBtn) addBtn.addEventListener('click', addContact);
    const editOrgBtn = document.getElementById('annuaire-btn-edit-org');
    if (editOrgBtn) editOrgBtn.addEventListener('click', function () { openOrgModal(org); });
    main.querySelectorAll('.annuaire-del-contact').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Supprimer ce contact ?')) deleteContact(btn.getAttribute('data-id'));
      });
    });
    main.querySelectorAll('.annuaire-owner-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        const contactId = sel.getAttribute('data-contact-id');
        const previousOwnerId = sel.getAttribute('data-previous-owner') || '';
        const ownerUserId = sel.value || '';
        sel.disabled = true;
        updateContactOwner(contactId, ownerUserId, previousOwnerId).finally(function () {
          sel.disabled = false;
        });
      });
    });
  }

  function selectOrganisation(orgId) {
    state.selectedOrgId = orgId;
    const org = state.organisations.find(function (o) { return o.organisationId === orgId; });
    if (org) {
      if (isBoutiqueOrg(org)) {
        state.contextBoutiqueId = org.organisationId;
        state.selectionSource = 'boutique';
      } else if ((org.roles || []).indexOf('client') >= 0) {
        state.selectionSource = 'client';
      } else if ((org.roles || []).indexOf('fournisseur') >= 0) {
        state.selectionSource = 'fournisseur';
      }
    }
    renderDropboxes();
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

  function loadMyContactsIndex() {
    if (state.filterOwner !== 'mine' || !state.currentUserId) {
      state.myContacts = null;
      return Promise.resolve(null);
    }
    return global.AnnuaireApi.call('/contacts?ownerUserId=' + encodeURIComponent(state.currentUserId))
      .then(function (res) {
        state.myContacts = res.data || [];
        return state.myContacts;
      });
  }

  function applyOwnerOrganisationFilter(list) {
    if (state.filterOwner !== 'mine' || !Array.isArray(state.myContacts)) {
      return list;
    }
    const orgIds = {};
    state.myContacts.forEach(function (c) {
      if (c.organisationId) orgIds[c.organisationId] = true;
    });
    return list.filter(function (o) { return orgIds[o.organisationId]; });
  }

  function loadOrganisations() {
    if (state.identityMode) {
      return global.AnnuaireApi.call('/organisations/own').then(function (res) {
        const org = res.data || null;
        state.organisations = org ? [org] : [];
        state.selectedOrgId = org ? org.organisationId : null;
        renderSidebar();
        if (!org) {
          renderMain();
          return;
        }
        return selectOrganisation(org.organisationId).then(function () {
          openOrgModal(org);
        });
      });
    }

    const q = document.getElementById('annuaire-search');
    const params = new URLSearchParams();
    if (q && q.value.trim()) params.set('q', q.value.trim());
    const qs = params.toString() ? '?' + params.toString() : '';
    return loadMyContactsIndex().then(function () {
      return global.AnnuaireApi.call('/organisations' + qs);
    }).then(function (res) {
      state.organisations = res.data || [];
      if (!state.contextBoutiqueId) {
        state.contextBoutiqueId = defaultBoutiqueId();
      }
      const orgExists = state.selectedOrgId && state.organisations.some(function (o) {
        return o.organisationId === state.selectedOrgId;
      });
      if (!orgExists) {
        state.selectedOrgId = pickDefaultOrgId();
        state.selectionSource = 'boutique';
      }
      renderSidebar();
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

  function renderBoutiqueLinksInModal(org) {
    const wrap = document.getElementById('annuaire-org-boutiques-wrap');
    const checks = document.getElementById('annuaire-org-boutiques-checks');
    if (!wrap || !checks) return;
    const locked = org && (org.isOwnEntity || org.gderpiBoutiqueId);
    wrap.hidden = Boolean(locked);
    if (locked) {
      checks.innerHTML = '';
      return;
    }
    const boutiques = state.organisations.filter(isBoutiqueOrg);
    const linked = new Set((org && org.boutiqueOrganisationIds) || []);
    if (!boutiques.length) {
      checks.innerHTML = '<p class="text-muted small">Aucune boutique disponible.</p>';
      return;
    }
    checks.innerHTML = boutiques.map(function (b) {
      const checked = linked.has(b.organisationId) ? ' checked' : '';
      return '<label class="annuaire-boutique-check"><input type="checkbox" name="annuaire-org-boutique" value="' +
        esc(b.organisationId) + '"' + checked + '> ' + esc(b.displayName) + '</label>';
    }).join('');
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
    renderBoutiqueLinksInModal(isEdit ? org : null);

    if (title) title.textContent = isEdit
      ? (state.identityMode ? 'Coordonnées entreprise' : 'Modifier l\'entité')
      : 'Nouvelle entité';
    if (hint) {
      if (isEdit && isCompanyProfileOrg(org)) {
        hint.textContent = 'Identité légale de l\'entreprise — utilisée par UGAP et les autres applications.';
      } else {
        hint.textContent = 'Clients, fournisseurs, prospects ou contacts internes.';
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
      const boutiqueIds = [];
      document.querySelectorAll('input[name="annuaire-org-boutique"]:checked').forEach(function (cb) {
        boutiqueIds.push(cb.value);
      });
      payload.boutiqueOrganisationIds = boutiqueIds;
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
        ownerUserId: (document.getElementById('annuaire-c-owner') || {}).value || null,
        scope: org.scope
      })
    }).then(function () {
      const details = document.querySelector('.annuaire-add-contact-details');
      if (details) details.removeAttribute('open');
      return selectOrganisation(org.organisationId);
    })
      .catch(function (err) { alert(err.message); });
  }

  function deleteContact(contactId) {
    const org = selectedOrg();
    global.AnnuaireApi.call('/contacts/' + encodeURIComponent(contactId), { method: 'DELETE' })
      .then(function () { return selectOrganisation(org.organisationId); })
      .catch(function (err) { alert(err.message); });
  }

  function bindFilters() {
    document.querySelectorAll('[data-annuaire-kind]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-annuaire-kind]').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        state.filterKind = btn.getAttribute('data-annuaire-kind') || '';
        renderDropboxes();
        syncSelectionAfterBoutiqueChange();
        if (state.selectedOrgId) {
          selectOrganisation(state.selectedOrgId);
        } else {
          renderMain();
        }
      });
    });
    const mineBtn = document.querySelector('[data-annuaire-owner="mine"]');
    if (mineBtn) {
      mineBtn.addEventListener('click', function () {
        state.filterOwner = state.filterOwner === 'mine' ? '' : 'mine';
        mineBtn.classList.toggle('active', state.filterOwner === 'mine');
        loadOrganisations();
      });
    }
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
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('.annuaire-dropbox')) closeAllDropboxes();
    });
    document.getElementById('annuaire-btn-refresh')?.addEventListener('click', loadOrganisations);
    document.getElementById('annuaire-btn-add-org')?.addEventListener('click', addOrganisation);
    document.getElementById('annuaire-search')?.addEventListener('input', function () {
      renderDropboxes();
      const org = selectedOrg();
      if (org && state.selectionSource === 'client' && !listClientsForPicker().some(function (o) {
        return o.organisationId === org.organisationId;
      })) {
        state.selectedOrgId = state.contextBoutiqueId || pickDefaultOrgId();
        state.selectionSource = 'boutique';
        if (state.selectedOrgId) selectOrganisation(state.selectedOrgId);
        else renderMain();
        return;
      }
      if (org && state.selectionSource === 'fournisseur' && !listFournisseursForPicker().some(function (o) {
        return o.organisationId === org.organisationId;
      })) {
        state.selectedOrgId = state.contextBoutiqueId || pickDefaultOrgId();
        state.selectionSource = 'boutique';
        if (state.selectedOrgId) selectOrganisation(state.selectedOrgId);
        else renderMain();
      }
    });

    loadMembers().then(function () {
      return loadOrganisations();
    }).catch(function (err) {
      console.error('Annuaire init:', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
