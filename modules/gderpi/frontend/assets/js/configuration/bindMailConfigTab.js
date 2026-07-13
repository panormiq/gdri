/**
 * FICHIER : modules/gderpi/frontend/assets/js/configuration/bindMailConfigTab.js
 * RÔLE : Association par boutique (mail générique + contacts) → comptes module Mail.
 */
(function initGderpiBindMailConfigTab(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  let accountsData = null;
  let listFilter = { search: '', unmappedOnly: false };
  let mailSettingsCache = null;
  let activeMailTemplateType = 'devis';
  let previewTimer = null;
  let previewRequestId = 0;

  const MAIL_TEMPLATE_TYPES = [
    { id: 'devis', label: 'Devis', variables: '{{numero}}, {{contactNom}}, {{objet}}, {{boutique}}, {{montantTtc}}, {{dateValidite}}' },
    { id: 'commande_client', label: 'Commande client', variables: '{{numero}}, {{devisNumero}}, {{contactNom}}, {{objet}}, {{boutique}}, {{montantTtc}}, {{dateCommande}}' },
    { id: 'facture', label: 'Facture', variables: '{{numero}}, {{commandeNumero}}, {{devisNumero}}, {{contactNom}}, {{objet}}, {{boutique}}, {{montantTtc}}, {{dateFacture}}' },
    { id: 'avoir', label: 'Avoir', variables: '{{numero}}, {{factureOrigine}}, {{commandeNumero}}, {{devisNumero}}, {{contactNom}}, {{objet}}, {{boutique}}, {{montantTtc}}, {{dateAvoir}}' },
    { id: 'commande_fournisseur', label: 'Commande fournisseur', variables: '{{numero}}, {{contactNom}}, {{objet}}, {{fournisseur}}, {{boutique}}, {{montantHt}}, {{dateCommande}}' }
  ];

  function getMailEntityConfigUrl() {
    try {
      return new URL('mail-config.php?module=mail', global.location.href).href;
    } catch {
      return 'mail-config.php?module=mail';
    }
  }

  function openMailTool() {
    global.open(getMailEntityConfigUrl(), '_blank', 'noopener');
    global.GderpiStatus.showStatus(
      'Créez ou modifiez le compte dans le module Mail, puis cliquez sur Actualiser.',
      'secondary'
    );
  }

  function accountLabelById(accounts, accountId) {
    const id = String(accountId || '').trim();
    if (!id) return '';
    const account = (accounts || []).find((a) => String(a.id) === id);
    if (!account) return id;
    return (account.label || account.email) + ' (' + account.email + ')';
  }

  function buildAccountOptionsHtml(accounts, selectedId, { allowDefault } = {}) {
    const selected = String(selectedId || '').trim();
    const opts = [];
    if (allowDefault) {
      opts.push('<option value=""' + (!selected ? ' selected' : '') + '>— Compte par défaut —</option>');
    } else if (!selected) {
      opts.push('<option value="" selected>— Sélectionner un compte —</option>');
    } else {
      opts.push('<option value="">— Sélectionner un compte —</option>');
    }
    (accounts || []).forEach((account) => {
      const id = String(account.id || '').trim();
      if (!id) return;
      const label = esc(account.label || account.email) + ' (' + esc(account.email) + ')';
      opts.push('<option value="' + esc(id) + '"' + (selected === id ? ' selected' : '') + '>' + label + '</option>');
    });
    if (selected && !(accounts || []).some((a) => String(a.id) === selected)) {
      opts.push('<option value="' + esc(selected) + '" selected>' + esc(selected) + '</option>');
    }
    return opts.join('');
  }

  function resolveRowSelection(mappings, contact, accounts, defaultAccountId) {
    if (!contact.hasEmail) return '';
    const email = String(contact.email || '').trim().toLowerCase();
    const saved = String(mappings[email] || '').trim();
    if (saved) return saved;
    if (contact.kind === 'generic') {
      return String(
        contact.suggestedAccountId || defaultAccountId || accounts?.[0]?.id || ''
      ).trim();
    }
    return String(contact.suggestedAccountId || '').trim();
  }

  function rowStatus(contact, selectedId, mappings) {
    if (!contact.hasEmail) return { key: 'missing', label: 'E-mail manquant' };
    const email = String(contact.email || '').trim().toLowerCase();
    const saved = String(mappings[email] || '').trim();
    if (saved) return { key: 'linked', label: 'Associé' };
    if (selectedId && selectedId === contact.suggestedAccountId) {
      return { key: 'auto', label: 'Auto (même adresse)' };
    }
    if (!selectedId) return { key: 'default', label: 'Par défaut' };
    return { key: 'linked', label: 'Associé' };
  }

  function defaultRowMatchesFilter(accounts, defaultAccountId) {
    const q = listFilter.search.trim().toLowerCase();
    if (q) {
      const hay = [
        'gderpi',
        'compte par défaut',
        'fallback',
        accountLabelById(accounts, defaultAccountId)
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (listFilter.unmappedOnly && defaultAccountId) return false;
    return true;
  }

  function contactMatchesFilter(contact, mappings, accounts, defaultAccountId) {
    const q = listFilter.search.trim().toLowerCase();
    if (q) {
      const hay = [
        contact.boutiqueName,
        contact.contactName,
        contact.emitterLabel,
        contact.email,
        'compte par défaut',
        accountLabelById(accounts, resolveRowSelection(mappings, contact, accounts, defaultAccountId))
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (listFilter.unmappedOnly && contact.hasEmail) {
      const email = String(contact.email || '').trim().toLowerCase();
      if (mappings[email]) return false;
    }
    if (listFilter.unmappedOnly && !contact.hasEmail) return false;
    return true;
  }

  function sortMailContacts(contacts) {
    return [...(contacts || [])].sort((a, b) => {
      const byBoutique = (a.boutiqueName || '').localeCompare(b.boutiqueName || '', 'fr');
      if (byBoutique !== 0) return byBoutique;
      if (a.kind !== b.kind) return a.kind === 'generic' ? -1 : 1;
      return (a.contactName || a.label || '').localeCompare(b.contactName || b.label || '', 'fr');
    });
  }

  function renderDefaultRow(accounts, defaultAccountId) {
    const selected = String(defaultAccountId || accounts[0]?.id || '').trim();
    const opts = buildAccountOptionsHtml(accounts, selected, { allowDefault: false });
    return '<tr class="gderpi-mail-mapping-row gderpi-mail-mapping-row--default" data-gderpi-mail-default-row>' +
      '<td><span class="gderpi-mail-emitter">GDERPI</span></td>' +
      '<td class="gderpi-mail-cell-contact text-muted small">—</td>' +
      '<td class="gderpi-mail-cell-email text-muted small">—</td>' +
      '<td class="gderpi-mail-cell-select">' +
      '<select id="gderpi-mail-default-account" class="form-control form-control-sm">' + opts + '</select>' +
      '</td>' +
      '<td><span class="gderpi-mail-badge gderpi-mail-badge--default">Par défaut</span></td>' +
      '</tr>';
  }

  function renderMappingRow(contact, accounts, mappings, defaultAccountId) {
    const emitter = esc(contact.emitterLabel || contact.boutiqueName || '—');
    const contactLabel = esc(contact.contactName || '—');
    const status = rowStatus(
      contact,
      resolveRowSelection(mappings, contact, accounts, defaultAccountId),
      mappings
    );
    const isGeneric = contact.kind === 'generic';

    if (!contact.hasEmail) {
      return '<tr class="gderpi-mail-mapping-row gderpi-mail-mapping-row--missing">' +
        '<td><span class="gderpi-mail-emitter">' + emitter + '</span></td>' +
        '<td class="gderpi-mail-cell-contact text-muted small">' + contactLabel + '</td>' +
        '<td colspan="2" class="text-muted small">Définissez l\'e-mail sur la fiche boutique</td>' +
        '<td><span class="gderpi-mail-badge gderpi-mail-badge--missing">' + esc(status.label) + '</span></td>' +
        '</tr>';
    }

    const email = String(contact.email || '').trim().toLowerCase();
    const selected = resolveRowSelection(mappings, contact, accounts, defaultAccountId);
    const opts = buildAccountOptionsHtml(accounts, selected, { allowDefault: !isGeneric });

    return '<tr class="gderpi-mail-mapping-row' + (isGeneric ? ' gderpi-mail-mapping-row--generic' : '') + '" data-email="' + esc(email) + '">' +
      '<td><span class="gderpi-mail-emitter">' + emitter + '</span></td>' +
      '<td class="gderpi-mail-cell-contact">' + contactLabel + '</td>' +
      '<td class="gderpi-mail-cell-email">' + esc(contact.email) + '</td>' +
      '<td class="gderpi-mail-cell-select"><select class="form-control form-control-sm gderpi-mail-contact-map" data-email="' + esc(email) + '">' + opts + '</select></td>' +
      '<td><span class="gderpi-mail-badge gderpi-mail-badge--' + status.key + '">' + esc(status.label) + '</span></td>' +
      '</tr>';
  }

  function updateRowCount(visibleRows, totalRows) {
    const el = document.getElementById('gderpi-mail-row-count');
    if (!el) return;
    el.textContent = (visibleRows === totalRows ? totalRows : visibleRows + '/' + totalRows) +
      ' élément' + (totalRows > 1 ? 's' : '');
  }

  function renderMailList(data) {
    const d = data || {};
    const accounts = d.accounts || [];
    const mappings = d.contactAccountMappings || {};
    const defaultAccountId = d.defaultAccountId || '';
    const tbody = document.getElementById('gderpi-mail-mappings-tbody');
    if (!tbody) return;

    if (!accounts.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Aucun compte mail. Utilisez « + Compte mail » pour ouvrir le module Mail.</td></tr>';
      updateRowCount(0, 0);
      return;
    }

    const contacts = sortMailContacts(d.contacts || []);
    const rows = [];
    const showDefault = defaultRowMatchesFilter(accounts, defaultAccountId);
    if (showDefault) rows.push(renderDefaultRow(accounts, defaultAccountId));

    contacts.forEach((contact) => {
      if (contactMatchesFilter(contact, mappings, accounts, defaultAccountId)) {
        rows.push(renderMappingRow(contact, accounts, mappings, defaultAccountId));
      }
    });

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Aucun résultat pour ce filtre.</td></tr>';
      const totalRows = contacts.length + 1;
      updateRowCount(0, totalRows);
      return;
    }

    tbody.innerHTML = rows.join('');
    const totalRows = contacts.length + 1;
    updateRowCount(rows.length, totalRows);
  }

  function syncFormToCache() {
    if (!mailSettingsCache) mailSettingsCache = { templates: {} };
    if (!mailSettingsCache.templates) mailSettingsCache.templates = {};
    const subjectEl = document.getElementById('gderpi-mail-subject');
    const introEl = document.getElementById('gderpi-mail-intro');
    const ttlEl = document.getElementById('gderpi-mail-ttl');
    const acceptEl = document.getElementById('gderpi-mail-enable-accept');
    if (subjectEl || introEl) {
      mailSettingsCache.templates[activeMailTemplateType] = {
        subjectTemplate: subjectEl?.value?.trim() || '',
        introHtml: introEl?.value?.trim() || ''
      };
    }
    if (ttlEl) mailSettingsCache.linkTtlDays = Number(ttlEl.value) || 30;
    if (acceptEl) mailSettingsCache.enableAcceptLink = acceptEl.checked !== false;
  }

  function fillTemplateForm(type) {
    activeMailTemplateType = String(type || 'devis').trim();
    const templates = mailSettingsCache?.templates || {};
    const block = templates[activeMailTemplateType] || {};
    const subject = document.getElementById('gderpi-mail-subject');
    const intro = document.getElementById('gderpi-mail-intro');
    if (subject) subject.value = block.subjectTemplate || '';
    if (intro) intro.value = block.introHtml || '';

    const meta = MAIL_TEMPLATE_TYPES.find((t) => t.id === activeMailTemplateType);
    const hint = document.getElementById('gderpi-mail-vars-hint');
    if (hint && meta) hint.textContent = 'Variables : ' + meta.variables;

    const devisOnly = document.getElementById('gderpi-mail-devis-only');
    if (devisOnly) {
      if (activeMailTemplateType === 'devis') devisOnly.removeAttribute('hidden');
      else devisOnly.setAttribute('hidden', '');
    }

    document.querySelectorAll('[data-gderpi-mail-template]').forEach((btn) => {
      const active = btn.getAttribute('data-gderpi-mail-template') === activeMailTemplateType;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    scheduleMailPreview();
  }

  function fillDevisForm(data) {
    const d = data || {};
    mailSettingsCache = {
      ...d,
      templates: d.templates && typeof d.templates === 'object'
        ? { ...d.templates }
        : {
          devis: {
            subjectTemplate: d.subjectTemplate || '',
            introHtml: d.introHtml || ''
          }
        }
    };
    const ttl = document.getElementById('gderpi-mail-ttl');
    const accept = document.getElementById('gderpi-mail-enable-accept');
    if (ttl) ttl.value = d.linkTtlDays ?? 30;
    if (accept) accept.checked = d.enableAcceptLink !== false;
    fillTemplateForm(activeMailTemplateType);
  }

  function fillAccountSelects(data) {
    accountsData = data || {};
    renderMailList(accountsData);
  }

  function applyListFilter() {
    if (!accountsData) return;
    renderMailList(accountsData);
  }

  function collectAccountPayload() {
    const mappings = {};
    document.querySelectorAll('.gderpi-mail-contact-map').forEach((sel) => {
      const email = String(sel.dataset.email || '').trim().toLowerCase();
      const accountId = String(sel.value || '').trim();
      if (email && accountId) mappings[email] = accountId;
    });
    const defaultAccountId = document.getElementById('gderpi-mail-default-account')?.value?.trim() || '';
    return { contactAccountMappings: mappings, defaultAccountId };
  }

  function collectPreviewPayload() {
    syncFormToCache();
    const block = mailSettingsCache?.templates?.[activeMailTemplateType] || {};
    const sampleMessage = document.getElementById('gderpi-mail-preview-sample-message')?.checked
      ? 'Exemple de message personnalisé ajouté lors de l\'envoi, avant les liens de consultation.'
      : '';
    return {
      type: activeMailTemplateType,
      subjectTemplate: block.subjectTemplate || '',
      introHtml: block.introHtml || '',
      customMessage: sampleMessage,
      enableAcceptLink: mailSettingsCache?.enableAcceptLink !== false
    };
  }

  function scheduleMailPreview(delayMs) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      refreshMailPreview().catch(() => { /* silencieux */ });
    }, delayMs == null ? 350 : delayMs);
  }

  async function refreshMailPreview() {
    const root = document.getElementById('gderpi-mail-preview');
    const frame = document.getElementById('gderpi-mail-preview-frame');
    const subjectEl = document.getElementById('gderpi-mail-preview-subject');
    if (!root || !frame || !subjectEl) return;

    const requestId = ++previewRequestId;
    root.classList.add('gderpi-mail-preview--loading');

    try {
      const res = await global.GderpiApi.apiCall('/settings/mail/preview', {
        method: 'POST',
        body: JSON.stringify(collectPreviewPayload()),
        silent: true
      });
      if (requestId !== previewRequestId) return;

      const data = res.data || {};
      subjectEl.textContent = String(data.subject || '—');
      frame.srcdoc = String(data.html || '');
      resizeMailPreviewFrame(frame);
    } catch (err) {
      if (requestId !== previewRequestId) return;
      subjectEl.textContent = 'Erreur aperçu';
      frame.srcdoc = '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;color:#b91c1c;">'
        + esc(err.message || 'Impossible de générer l\'aperçu') + '</body></html>';
    } finally {
      if (requestId === previewRequestId) root.classList.remove('gderpi-mail-preview--loading');
    }
  }

  function resizeMailPreviewFrame(frame) {
    if (!frame) return;
    const resize = () => {
      try {
        const doc = frame.contentDocument;
        const height = Math.max(
          doc?.documentElement?.scrollHeight || 0,
          doc?.body?.scrollHeight || 0,
          520
        );
        frame.style.height = Math.min(height + 16, 900) + 'px';
      } catch (_) {
        frame.style.height = '520px';
      }
    };
    frame.addEventListener('load', resize, { once: true });
    setTimeout(resize, 80);
  }

  function bindPreviewControls() {
    ['gderpi-mail-subject', 'gderpi-mail-intro', 'gderpi-mail-ttl', 'gderpi-mail-enable-accept', 'gderpi-mail-preview-sample-message']
      .forEach((id) => {
        const el = document.getElementById(id);
        if (!el || el.dataset.gderpiMailPreviewBound) return;
        el.dataset.gderpiMailPreviewBound = '1';
        const eventName = el.type === 'checkbox' ? 'change' : 'input';
        el.addEventListener(eventName, () => scheduleMailPreview());
      });
  }

  function collectDevisPayload() {
    syncFormToCache();
    return {
      templates: mailSettingsCache.templates,
      linkTtlDays: mailSettingsCache.linkTtlDays,
      enableAcceptLink: mailSettingsCache.enableAcceptLink
    };
  }

  async function loadDevisSettings() {
    const res = await global.GderpiApi.apiCall('/settings/mail');
    fillDevisForm(res.data || {});
  }

  async function loadAccounts() {
    const res = await global.GderpiApi.apiCall('/settings/mail-accounts');
    fillAccountSelects(res.data || {});
  }

  async function saveDevisSettings(event) {
    event?.preventDefault?.();
    const res = await global.GderpiApi.apiCall('/settings/mail', {
      method: 'PUT',
      body: JSON.stringify(collectDevisPayload())
    });
    fillDevisForm(res.data || {});
    global.GderpiStatus.showStatus('Modèles d\'e-mail enregistrés.', 'success');
  }

  async function saveAccounts() {
    const res = await global.GderpiApi.apiCall('/settings/mail-accounts', {
      method: 'PUT',
      body: JSON.stringify(collectAccountPayload())
    });
    fillAccountSelects(res.data || {});
    global.GderpiStatus.showStatus('Associations enregistrées.', 'success');
  }

  function bindForm() {
    bindPreviewControls();
    const form = document.getElementById('gderpi-mail-settings-form');
    if (form && !form.dataset.gderpiMailBound) {
      form.dataset.gderpiMailBound = '1';
      form.addEventListener('submit', (e) => saveDevisSettings(e).catch((err) => {
        global.GderpiStatus.showStatus(err.message || 'Erreur enregistrement', 'danger');
      }));
    }

    const saveBtn = document.getElementById('gderpi-mail-save-accounts');
    if (saveBtn && !saveBtn.dataset.gderpiMailBound) {
      saveBtn.dataset.gderpiMailBound = '1';
      saveBtn.addEventListener('click', () => saveAccounts().catch((err) => {
        global.GderpiStatus.showStatus(err.message || 'Erreur enregistrement associations', 'danger');
      }));
    }

    const addBtn = document.getElementById('gderpi-mail-add-account');
    if (addBtn && !addBtn.dataset.gderpiMailBound) {
      addBtn.dataset.gderpiMailBound = '1';
      addBtn.addEventListener('click', openMailTool);
    }

    const refreshBtn = document.getElementById('gderpi-mail-refresh-accounts');
    if (refreshBtn && !refreshBtn.dataset.gderpiMailBound) {
      refreshBtn.dataset.gderpiMailBound = '1';
      refreshBtn.addEventListener('click', () => loadAccounts().catch((err) => {
        global.GderpiStatus.showStatus(err.message || 'Erreur actualisation', 'danger');
      }));
    }

    document.querySelectorAll('[data-gderpi-mail-template]').forEach((btn) => {
      if (btn.dataset.gderpiMailTemplateBound) return;
      btn.dataset.gderpiMailTemplateBound = '1';
      btn.addEventListener('click', () => {
        syncFormToCache();
        fillTemplateForm(btn.getAttribute('data-gderpi-mail-template'));
      });
    });

    const search = document.getElementById('gderpi-mail-search');
    if (search && !search.dataset.gderpiMailBound) {
      search.dataset.gderpiMailBound = '1';
      search.addEventListener('input', () => {
        listFilter.search = search.value || '';
        applyListFilter();
      });
    }

    const unmapped = document.getElementById('gderpi-mail-filter-unmapped');
    if (unmapped && !unmapped.dataset.gderpiMailBound) {
      unmapped.dataset.gderpiMailBound = '1';
      unmapped.addEventListener('change', () => {
        listFilter.unmappedOnly = unmapped.checked;
        applyListFilter();
      });
    }
  }

  function bindMailConfigTab() {
    bindForm();
  }

  async function refreshMailAccountsTab() {
    bindForm();
    try {
      await loadAccounts();
    } catch (err) {
      global.GderpiStatus.showStatus(err.message || 'Erreur chargement comptes mail', 'danger');
    }
  }

  async function refreshMailDevisTab() {
    bindForm();
    try {
      await loadDevisSettings();
      scheduleMailPreview(0);
    } catch (err) {
      global.GderpiStatus.showStatus(err.message || 'Erreur chargement modèle devis', 'danger');
    }
  }

  global.GderpiMailConfigTab = {
    bindMailConfigTab,
    refreshMailAccountsTab,
    refreshMailDevisTab,
    getMailEntityConfigUrl
  };
})(window);
