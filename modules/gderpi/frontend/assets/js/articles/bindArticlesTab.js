/**
 * FICHIER : modules/gderpi/frontend/assets/js/articles/bindArticlesTab.js
 * RÔLE : Onglet articles — vue LC liste + création (fournisseurs, tarifs clients).
 */

(function initGderpiBindArticlesTab(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const canWrite = () => global.GDERPI_CONFIG?.canWrite === true;
  const fmtMoney = (n) => (Number.isFinite(Number(n)) ? Number(n).toFixed(2) : '—');

  let lcApi = null;
  let editingId = '';
  let nodesList = [];
  let clientsList = [];
  let fournisseursList = [];
  let boutiquesList = [];
  let frsSeq = 0;
  let tarifSeq = 0;
  let currentNodeFilter = '';
  let formFillGeneration = 0;
  let isFillingForm = false;
  let fournisseursState = [];
  let boutiqueInterneEntry = null;
  let tarifsState = [];
  let editingFrsKey = '';
  let editingTarifKey = '';
  let frsModal = null;
  let tarifModal = null;
  let activeArticleTab = 'general';

  function handleErr(err) {
    global.GderpiStatus.showStatus(err?.message || 'Erreur', 'danger');
  }

  function isPrixSurDevis(item) {
    const value = item && item.prixSurDevis;
    return value === true || value === 1 || String(value).toLowerCase() === 'true';
  }

  function setPrixSurDevisChecked(checked) {
    const prixSurDevisEl = document.getElementById('gderpi-article-prix-sur-devis');
    if (prixSurDevisEl) prixSurDevisEl.checked = checked === true;
    return prixSurDevisEl;
  }

  function frsRowKey(f, idx) {
    return String(f._key || supplierKeyFromEntry(f) || ('frs-' + idx));
  }

  function supplierKeyFromEntry(entry) {
    if (!entry) return '';
    if (entry.sourceType === 'boutique' && entry.boutiqueId) return 'btq:' + entry.boutiqueId;
    if (entry.fournisseurId) return 'frs:' + entry.fournisseurId;
    return '';
  }

  function boutiqueLabel(id) {
    const b = boutiquesList.find((x) => String(x.boutiqueId || x.id) === String(id));
    return b ? (b.nom || b.raisonSociale || id) : (id || '—');
  }

  function supplierLabelFromEntry(entry) {
    if (!entry) return '—';
    if (entry.sourceType === 'boutique') {
      return 'Boutique : ' + boutiqueLabel(entry.boutiqueId);
    }
    return fournisseurLabel(entry.fournisseurId);
  }

  function tarifRowKey(t, idx) {
    return String(t._key || t.clientId || ('tarif-' + idx));
  }

  function fournisseurLabel(id) {
    const f = fournisseursList.find((x) => String(x.fournisseurId || x.id) === String(id));
    return f ? (f.raisonSociale || f.nom || id) : (id || '—');
  }

  function clientLabel(id) {
    const c = clientsList.find((x) => String(x.clientId || x.id) === String(id));
    if (!c) return id || '—';
    return c.displayName || c.raisonSociale || [c.prenom, c.nom].filter(Boolean).join(' ') || id;
  }

  function normalizeFournisseursState(list) {
    return (Array.isArray(list) ? list : []).map((f, i) => ({
      ...f,
      _key: f._key || ('frs-' + (++frsSeq) + '-' + i)
    }));
  }

  function normalizeTarifsState(list) {
    return (Array.isArray(list) ? list : []).map((t, i) => ({
      ...t,
      _key: t._key || ('tarif-' + (++tarifSeq) + '-' + i)
    }));
  }

  function externalFournisseursOnly(list) {
    return (Array.isArray(list) ? list : []).filter((f) => f.sourceType !== 'boutique');
  }

  function boutiqueEntryFromList(list) {
    return (Array.isArray(list) ? list : []).find((f) => f.sourceType === 'boutique' && f.boutiqueId) || null;
  }

  function populateBoutiqueInterneSelect(selectedId) {
    const sel = document.getElementById('gderpi-article-boutique-interne');
    if (!sel) return;
    const pick = String(selectedId || sel.value || '').trim();
    const options = ['<option value="">— Aucune —</option>'];
    boutiquesList.forEach((b) => {
      const id = b.boutiqueId || b.id;
      if (!id) return;
      options.push('<option value="' + esc(id) + '"' + (String(id) === pick ? ' selected' : '') + '>' +
        esc(b.nom || b.raisonSociale || id) + '</option>');
    });
    sel.innerHTML = options.join('');
    if (pick) sel.value = pick;
  }

  function setFournisseursState(list) {
    const all = Array.isArray(list) ? list : [];
    boutiqueInterneEntry = boutiqueEntryFromList(all);
    fournisseursState = normalizeFournisseursState(externalFournisseursOnly(all));
    if (fournisseursState.length && !fournisseursState.some((f) => f.principal) && !boutiqueInterneEntry?.principal) {
      fournisseursState[0] = { ...fournisseursState[0], principal: true };
    }
    populateBoutiqueInterneSelect(boutiqueInterneEntry?.boutiqueId || '');
    renderFournisseursTable();
  }

  function collectFournisseursPayload() {
    const list = fournisseursState.map((f) => ({
      sourceType: 'fournisseur',
      fournisseurId: String(f.fournisseurId || '').trim(),
      boutiqueId: '',
      principal: f.principal === true,
      referenceFournisseur: String(f.referenceFournisseur || '').trim(),
      prixAchatHt: f.prixAchatHt != null && f.prixAchatHt !== '' ? Number(f.prixAchatHt) : null,
      moq: f.moq != null && f.moq !== '' ? Number(f.moq) : null,
      delaiJours: f.delaiJours != null && f.delaiJours !== '' ? Number(f.delaiJours) : null,
      conditions: String(f.conditions || '').trim(),
      actif: f.actif !== false
    })).filter((f) => f.fournisseurId);

    const btqId = document.getElementById('gderpi-article-boutique-interne')?.value?.trim() || '';
    if (btqId) {
      const prev = boutiqueInterneEntry && String(boutiqueInterneEntry.boutiqueId) === btqId
        ? boutiqueInterneEntry
        : {};
      list.push({
        sourceType: 'boutique',
        fournisseurId: '',
        boutiqueId: btqId,
        principal: prev.principal === true || !list.length,
        referenceFournisseur: String(prev.referenceFournisseur || '').trim(),
        prixAchatHt: prev.prixAchatHt != null && prev.prixAchatHt !== '' ? Number(prev.prixAchatHt) : null,
        moq: prev.moq != null && prev.moq !== '' ? Number(prev.moq) : null,
        delaiJours: prev.delaiJours != null && prev.delaiJours !== '' ? Number(prev.delaiJours) : null,
        conditions: String(prev.conditions || '').trim(),
        actif: prev.actif !== false
      });
    }

    if (!list.some((f) => f.principal) && list.length) {
      list[0] = { ...list[0], principal: true };
    }
    return list;
  }

  function setTarifsState(list) {
    tarifsState = normalizeTarifsState(list);
    renderTarifsTable();
  }

  function collectTarifsPayload() {
    return tarifsState.map((t) => {
      const prixRaw = t.prixVenteHt;
      let prixVenteHt = null;
      if (prixRaw != null && prixRaw !== '' && Number.isFinite(Number(prixRaw))) {
        prixVenteHt = Number(prixRaw);
      }
      return {
        clientId: String(t.clientId || '').trim(),
        reference: String(t.reference || '').trim(),
        prixVenteHt,
        prixSurDevis: t.prixSurDevis === true
      };
    }).filter((t) => t.clientId);
  }

  function switchArticleTab(tabId) {
    activeArticleTab = tabId || 'general';
    document.querySelectorAll('[data-gderpi-article-tab]').forEach((btn) => {
      const active = btn.getAttribute('data-gderpi-article-tab') === activeArticleTab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-gderpi-article-panel]').forEach((panel) => {
      const show = panel.getAttribute('data-gderpi-article-panel') === activeArticleTab;
      panel.hidden = !show;
    });
  }

  function populateArticleNodeSelect(selectEl, selectedNodeId, nodes) {
    if (!selectEl) return;
    const list = Array.isArray(nodes) ? nodes : nodesList;
    const selected = String(selectedNodeId || '').trim();
    let html = '<option value="">— Sans catégorie —</option>';
    list.forEach((n) => {
      html += '<option value="' + esc(n.id) + '">' + esc(n.label) + '</option>';
    });
    if (selected && !list.some((n) => String(n.id || '') === selected)) {
      html += '<option value="' + esc(selected) + '">' + esc(selected) + '</option>';
    }
    selectEl.innerHTML = html;
    if (selected) selectEl.value = selected;
  }

  function populateNodeSelects(nodes) {
    nodesList = Array.isArray(nodes) ? nodes : [];
    const filterSel = document.getElementById('gderpi-article-filter-node');
    const articleSel = document.getElementById('gderpi-article-node');
    if (filterSel) {
      let html = '<option value="">Toutes catégories</option>';
      nodesList.forEach((n) => { html += '<option value="' + esc(n.id) + '">' + esc(n.label) + '</option>'; });
      filterSel.innerHTML = html;
      if (currentNodeFilter) filterSel.value = currentNodeFilter;
    }
    if (articleSel) {
      populateArticleNodeSelect(articleSel, articleSel.value, nodesList);
    }
  }

  async function ensureFournisseursList() {
    if (fournisseursList.length) return fournisseursList;
    const res = await global.GderpiApi.apiCall('/fournisseurs');
    fournisseursList = res.data || [];
    return fournisseursList;
  }

  async function ensureBoutiquesList() {
    if (boutiquesList.length) return boutiquesList;
    const res = await global.GderpiApi.apiCall('/boutiques');
    boutiquesList = res.data || [];
    return boutiquesList;
  }

  async function ensureClientsList() {
    if (clientsList.length) return clientsList;
    const res = await global.GderpiApi.apiCall('/clients');
    clientsList = res.data || [];
    return clientsList;
  }

  function boutiqueOptionsHtml(selectedId, excludeKeys) {
    const sel = String(selectedId || '').trim();
    const excluded = new Set((excludeKeys || []).map(String));
    return boutiquesList.map((b) => {
      const id = b.boutiqueId || b.id;
      const key = 'btq:' + id;
      if (excluded.has(key) && String(id) !== sel) return '';
      const label = b.nom || b.raisonSociale || id;
      return '<option value="' + esc(id) + '"' + (String(id) === sel ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }

  function fournisseurOptionsHtml(selectedId, excludeKeys) {
    const sel = String(selectedId || '').trim();
    const excluded = new Set((excludeKeys || []).map(String));
    return fournisseursList.map((f) => {
      const id = f.fournisseurId || f.id;
      const key = 'frs:' + id;
      if (excluded.has(key) && String(id) !== sel) return '';
      return '<option value="' + esc(id) + '"' + (String(id) === sel ? ' selected' : '') + '>' + esc(f.raisonSociale || f.nom || id) + '</option>';
    }).join('');
  }

  function clientOptionsHtml(selectedId, excludeIds) {
    const sel = String(selectedId || '').trim();
    const excluded = new Set((excludeIds || []).map(String));
    return clientsList.map((c) => {
      const id = c.clientId || c.id;
      if (excluded.has(String(id)) && String(id) !== sel) return '';
      const label = clientLabel(id);
      return '<option value="' + esc(id) + '"' + (String(id) === sel ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }

  function renderFournisseursTable() {
    const tbody = document.getElementById('gderpi-article-frs-tbody');
    if (!tbody) return;
    if (!fournisseursState.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Aucun fournisseur. Cliquez sur + Fournisseur.</td></tr>';
      return;
    }
    tbody.innerHTML = fournisseursState.map((f, idx) => {
      const key = frsRowKey(f, idx);
      const principal = f.principal
        ? '<span class="gderpi-client-sublist__star" title="Principal">★</span>'
        : (canWrite()
          ? '<button type="button" class="btn btn-link btn-sm gderpi-client-contact-principal gderpi-article-frs-principal" data-key="' + esc(key) + '" title="Définir principal">☆</button>'
          : '');
      const del = canWrite()
        ? '<button type="button" class="btn btn-outline-danger btn-sm gderpi-article-frs-del" data-key="' + esc(key) + '">Suppr.</button>'
        : '';
      return '<tr data-gderpi-article-frs-row data-key="' + esc(key) + '">' +
        '<td class="text-center text-nowrap">' + principal + '</td>' +
        '<td>' + esc(supplierLabelFromEntry(f)) + '</td>' +
        '<td>' + esc(f.referenceFournisseur || '—') + '</td>' +
        '<td class="text-end">' + (f.prixAchatHt != null && f.prixAchatHt !== '' ? fmtMoney(f.prixAchatHt) : '—') + '</td>' +
        '<td class="text-end">' + esc(f.moq != null && f.moq !== '' ? f.moq : '—') + '</td>' +
        '<td class="text-end">' + esc(f.delaiJours != null && f.delaiJours !== '' ? f.delaiJours : '—') + '</td>' +
        '<td class="text-nowrap" onclick="event.stopPropagation()">' + del + '</td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-gderpi-article-frs-row]').forEach((row) => {
      row.addEventListener('dblclick', () => openFrsModal(row.getAttribute('data-key')));
    });
    tbody.querySelectorAll('.gderpi-article-frs-del').forEach((btn) => {
      btn.addEventListener('click', () => deleteFrs(btn.getAttribute('data-key')));
    });
    tbody.querySelectorAll('.gderpi-article-frs-principal').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setPrincipalFrs(btn.getAttribute('data-key'));
      });
    });
  }

  function renderTarifsTable() {
    const tbody = document.getElementById('gderpi-article-tarifs-tbody');
    if (!tbody) return;
    if (!tarifsState.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Aucun tarif client. Cliquez sur + Tarif client.</td></tr>';
      return;
    }
    tbody.innerHTML = tarifsState.map((t, idx) => {
      const key = tarifRowKey(t, idx);
      const del = canWrite()
        ? '<button type="button" class="btn btn-outline-danger btn-sm gderpi-article-tarif-del" data-key="' + esc(key) + '">Suppr.</button>'
        : '';
      const prixLabel = t.prixSurDevis
        ? '<span class="text-muted">Sur devis</span>'
        : (t.prixVenteHt != null && t.prixVenteHt !== '' ? fmtMoney(t.prixVenteHt) : '<span class="text-muted">Catalogue</span>');
      return '<tr data-gderpi-article-tarif-row data-key="' + esc(key) + '">' +
        '<td>' + esc(clientLabel(t.clientId)) + '</td>' +
        '<td>' + esc(t.reference || '—') + '</td>' +
        '<td class="text-end">' + prixLabel + '</td>' +
        '<td>' + (t.prixSurDevis ? 'Oui' : '—') + '</td>' +
        '<td class="text-nowrap" onclick="event.stopPropagation()">' + del + '</td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-gderpi-article-tarif-row]').forEach((row) => {
      row.addEventListener('dblclick', () => openTarifModal(row.getAttribute('data-key')));
    });
    tbody.querySelectorAll('.gderpi-article-tarif-del').forEach((btn) => {
      btn.addEventListener('click', () => deleteTarif(btn.getAttribute('data-key')));
    });
  }

  function setPrincipalFrs(key) {
    fournisseursState = fournisseursState.map((f, i) => ({
      ...f,
      principal: frsRowKey(f, i) === String(key)
    }));
    renderFournisseursTable();
  }

  function deleteFrs(key) {
    fournisseursState = fournisseursState.filter((f, i) => frsRowKey(f, i) !== String(key));
    if (fournisseursState.length && !fournisseursState.some((f) => f.principal)) {
      fournisseursState[0] = { ...fournisseursState[0], principal: true };
    }
    renderFournisseursTable();
  }

  function deleteTarif(key) {
    tarifsState = tarifsState.filter((t, i) => tarifRowKey(t, i) !== String(key));
    renderTarifsTable();
  }

  function ensureFrsModal() {
    if (frsModal) return frsModal;
    const el = document.getElementById('gderpi-article-frs-modal');
    if (!el || !global.GderpiModal) return null;
    frsModal = global.GderpiModal.enhance(el, { title: 'Fournisseur', size: 'md', stacked: true });
    return frsModal;
  }

  function ensureTarifModal() {
    if (tarifModal) return tarifModal;
    const el = document.getElementById('gderpi-article-tarif-modal');
    if (!el || !global.GderpiModal) return null;
    tarifModal = global.GderpiModal.enhance(el, { title: 'Tarif client', size: 'md', stacked: true });
    return tarifModal;
  }

  function resetFrsForm() {
    editingFrsKey = '';
    const sel = document.getElementById('gderpi-article-frs-id');
    if (sel) sel.innerHTML = '<option value="">— Sélectionner —</option>' + fournisseurOptionsHtml('', []);
    document.getElementById('gderpi-article-frs-ref').value = '';
    document.getElementById('gderpi-article-frs-prix').value = '';
    document.getElementById('gderpi-article-frs-moq').value = '';
    document.getElementById('gderpi-article-frs-delai').value = '';
    document.getElementById('gderpi-article-frs-conditions').value = '';
    const principal = document.getElementById('gderpi-article-frs-principal');
    if (principal) principal.checked = !fournisseursState.length;
    const title = document.getElementById('gderpi-article-frs-modal-title');
    if (title) title.textContent = 'Nouveau fournisseur';
  }

  function resetTarifForm() {
    editingTarifKey = '';
    const sel = document.getElementById('gderpi-article-tarif-client');
    if (sel) sel.innerHTML = '<option value="">— Sélectionner —</option>' + clientOptionsHtml('', []);
    document.getElementById('gderpi-article-tarif-ref').value = '';
    document.getElementById('gderpi-article-tarif-prix').value = '';
    const surDevis = document.getElementById('gderpi-article-tarif-sur-devis');
    if (surDevis) surDevis.checked = false;
    const title = document.getElementById('gderpi-article-tarif-modal-title');
    if (title) title.textContent = 'Nouveau tarif client';
  }

  async function openFrsModal(key) {
    if (!canWrite()) return;
    await Promise.all([ensureFournisseursList(), ensureBoutiquesList()]);
    ensureFrsModal();
    const usedKeys = fournisseursState.map((f) => supplierKeyFromEntry(f)).filter(Boolean);
    if (key) {
      const idx = fournisseursState.findIndex((f, i) => frsRowKey(f, i) === String(key));
      const f = idx >= 0 ? fournisseursState[idx] : null;
      if (!f) return;
      editingFrsKey = String(key);
      const sel = document.getElementById('gderpi-article-frs-id');
      if (sel) {
        sel.innerHTML = '<option value="">— Sélectionner —</option>' +
          fournisseurOptionsHtml(f.fournisseurId, usedKeys.filter((k) => k !== supplierKeyFromEntry(f)));
        sel.value = f.fournisseurId || '';
      }
      document.getElementById('gderpi-article-frs-ref').value = f.referenceFournisseur || '';
      document.getElementById('gderpi-article-frs-prix').value = f.prixAchatHt != null ? f.prixAchatHt : '';
      document.getElementById('gderpi-article-frs-moq').value = f.moq != null ? f.moq : '';
      document.getElementById('gderpi-article-frs-delai').value = f.delaiJours != null ? f.delaiJours : '';
      document.getElementById('gderpi-article-frs-conditions').value = f.conditions || '';
      const principal = document.getElementById('gderpi-article-frs-principal');
      if (principal) principal.checked = f.principal === true;
      const title = document.getElementById('gderpi-article-frs-modal-title');
      if (title) title.textContent = 'Modifier le fournisseur';
    } else {
      resetFrsForm();
      const sel = document.getElementById('gderpi-article-frs-id');
      if (sel) sel.innerHTML = '<option value="">— Sélectionner —</option>' + fournisseurOptionsHtml('', usedKeys);
    }
    frsModal?.open();
  }

  async function openTarifModal(key) {
    if (!canWrite()) return;
    await ensureClientsList();
    ensureTarifModal();
    const usedIds = tarifsState.map((t) => t.clientId).filter(Boolean);
    if (key) {
      const idx = tarifsState.findIndex((t, i) => tarifRowKey(t, i) === String(key));
      const t = idx >= 0 ? tarifsState[idx] : null;
      if (!t) return;
      editingTarifKey = String(key);
      const sel = document.getElementById('gderpi-article-tarif-client');
      if (sel) {
        sel.innerHTML = '<option value="">— Sélectionner —</option>' +
          clientOptionsHtml(t.clientId, usedIds.filter((id) => String(id) !== String(t.clientId)));
        sel.value = t.clientId || '';
      }
      document.getElementById('gderpi-article-tarif-ref').value = t.reference || '';
      document.getElementById('gderpi-article-tarif-prix').value = t.prixVenteHt != null ? t.prixVenteHt : '';
      const surDevis = document.getElementById('gderpi-article-tarif-sur-devis');
      if (surDevis) surDevis.checked = t.prixSurDevis === true;
      const title = document.getElementById('gderpi-article-tarif-modal-title');
      if (title) title.textContent = 'Modifier le tarif client';
    } else {
      resetTarifForm();
      const sel = document.getElementById('gderpi-article-tarif-client');
      if (sel) sel.innerHTML = '<option value="">— Sélectionner —</option>' + clientOptionsHtml('', usedIds);
    }
    tarifModal?.open();
  }

  function saveFrsFromModal(ev) {
    ev.preventDefault();
    const fournisseurId = document.getElementById('gderpi-article-frs-id')?.value?.trim() || '';
    if (!fournisseurId) {
      global.GderpiStatus.showStatus('Fournisseur requis.', 'warning');
      return;
    }
    const entry = {
      sourceType: 'fournisseur',
      fournisseurId,
      boutiqueId: '',
      referenceFournisseur: document.getElementById('gderpi-article-frs-ref')?.value?.trim() || '',
      prixAchatHt: document.getElementById('gderpi-article-frs-prix')?.value?.trim() || null,
      moq: document.getElementById('gderpi-article-frs-moq')?.value?.trim() || null,
      delaiJours: document.getElementById('gderpi-article-frs-delai')?.value?.trim() || null,
      conditions: document.getElementById('gderpi-article-frs-conditions')?.value?.trim() || '',
      principal: document.getElementById('gderpi-article-frs-principal')?.checked === true,
      actif: true
    };
    if (editingFrsKey) {
      fournisseursState = fournisseursState.map((f, i) => {
        if (frsRowKey(f, i) !== editingFrsKey) return f;
        return { ...f, ...entry, _key: f._key };
      });
    } else {
      fournisseursState.push({ ...entry, _key: 'frs-' + (++frsSeq) });
    }
    if (entry.principal) {
      const key = editingFrsKey || frsRowKey(fournisseursState[fournisseursState.length - 1], fournisseursState.length - 1);
      setPrincipalFrs(key);
    } else if (fournisseursState.length === 1) {
      fournisseursState[0] = { ...fournisseursState[0], principal: true };
    }
    renderFournisseursTable();
    frsModal?.close();
  }

  function saveTarifFromModal(ev) {
    ev.preventDefault();
    const clientId = document.getElementById('gderpi-article-tarif-client')?.value?.trim() || '';
    if (!clientId) {
      global.GderpiStatus.showStatus('Client requis.', 'warning');
      return;
    }
    const prixRaw = document.getElementById('gderpi-article-tarif-prix')?.value?.trim() || '';
    const entry = {
      clientId,
      reference: document.getElementById('gderpi-article-tarif-ref')?.value?.trim() || '',
      prixVenteHt: prixRaw !== '' ? prixRaw : null,
      prixSurDevis: document.getElementById('gderpi-article-tarif-sur-devis')?.checked === true
    };
    if (editingTarifKey) {
      tarifsState = tarifsState.map((t, i) => {
        if (tarifRowKey(t, i) !== editingTarifKey) return t;
        return { ...t, ...entry, _key: t._key };
      });
    } else {
      tarifsState.push({ ...entry, _key: 'tarif-' + (++tarifSeq) });
    }
    renderTarifsTable();
    tarifModal?.close();
  }

  async function ensureNodesList() {
    if (nodesList.length) return nodesList;
    const res = await global.GderpiApi.apiCall('/nodes');
    nodesList = res.data?.nodes || [];
    return nodesList;
  }

  function syncPrixSurDevisUi() {
    const typeSel = document.getElementById('gderpi-article-type');
    const uniteSel = document.getElementById('gderpi-article-unite');
    const prixInput = document.getElementById('gderpi-article-prix');
    const prixSurDevis = document.getElementById('gderpi-article-prix-sur-devis');
    const wrap = document.getElementById('gderpi-article-prix-sur-devis-wrap');
    const commentWrap = document.getElementById('gderpi-article-commentaire-wrap');
    const stockWrap = document.getElementById('gderpi-article-gestion-stock-wrap');
    const stockEl = document.getElementById('gderpi-article-gestion-stock');
    const gererWrap = document.getElementById('gderpi-article-gerer-commande-wrap');
    const gererEl = document.getElementById('gderpi-article-gerer-commande');
    const isDev = typeSel?.value === 'developpement';
    const isProduit = typeSel?.value === 'produit';
    if (stockWrap) stockWrap.hidden = !isProduit;
    if (!isProduit && stockEl) stockEl.checked = false;
    if (gererWrap) gererWrap.hidden = isProduit;
    if (isProduit && gererEl) gererEl.checked = true;
    else if (!editingId && gererEl && !isFillingForm) {
      gererEl.checked = true;
    }
    const isForfait = String(uniteSel?.value || '').toLowerCase() === 'forfait';
    if (commentWrap) commentWrap.classList.toggle('gderpi-field--highlight', isDev);
    if (wrap) wrap.classList.toggle('gderpi-field--highlight', isDev || prixSurDevis?.checked);
    if (!prixSurDevis || !prixInput) return;
    const onDevis = prixSurDevis.checked;
    prixInput.disabled = onDevis;
    prixInput.required = !onDevis;
    if (onDevis) prixInput.value = '0';
  }

  function buildFournisseursFromItem(item) {
    const list = Array.isArray(item?.fournisseursArticle) ? item.fournisseursArticle : [];
    if (list.length) return list;
    if (item?.fournisseurId) {
      return [{
        sourceType: 'fournisseur',
        fournisseurId: item.fournisseurId,
        boutiqueId: '',
        principal: true,
        referenceFournisseur: item.referenceFournisseur || '',
        prixAchatHt: null,
        moq: null,
        delaiJours: null,
        conditions: '',
        actif: true
      }];
    }
    return [];
  }

  async function fillForm(a, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const generation = opts.generation != null ? opts.generation : ++formFillGeneration;
    if (opts.generation == null) formFillGeneration = generation;

    const item = a || {};
    const prixSurDevisValue = isPrixSurDevis(item);
    isFillingForm = true;
    editingId = String(item.articleId || '').trim();
    switchArticleTab('general');
    document.getElementById('gderpi-article-type').value = item.type || 'produit';
    document.getElementById('gderpi-article-ref').value = item.reference || '';
    document.getElementById('gderpi-article-libelle').value = item.libelle || '';
    await global.GderpiUnites.populateUniteSelect(
      document.getElementById('gderpi-article-unite'),
      item.unite || '',
      true
    );
    if (generation !== formFillGeneration) {
      isFillingForm = false;
      return;
    }

    const nodes = await ensureNodesList();
    if (generation !== formFillGeneration) {
      isFillingForm = false;
      return;
    }
    populateArticleNodeSelect(
      document.getElementById('gderpi-article-node'),
      item.nodeId || '',
      nodes
    );
    if (generation !== formFillGeneration) {
      isFillingForm = false;
      return;
    }

    setPrixSurDevisChecked(prixSurDevisValue);
    const stockEl = document.getElementById('gderpi-article-gestion-stock');
    if (stockEl) stockEl.checked = item.gestionStock === true;
    const gererEl = document.getElementById('gderpi-article-gerer-commande');
    if (gererEl) {
      if (!item.articleId && !item.id) {
        gererEl.checked = item.gererCommande !== false;
      } else {
        gererEl.checked = item.gererCommande === true;
      }
    }
    document.getElementById('gderpi-article-prix').value = item.prixHt ?? 0;
    document.getElementById('gderpi-article-tva').value = item.tauxTva ?? 20;
    document.getElementById('gderpi-article-desc').value = item.description || '';
    document.getElementById('gderpi-article-commentaire').value = item.commentaire || '';

    await ensureFournisseursList();
    await ensureBoutiquesList();
    setFournisseursState(buildFournisseursFromItem(item));
    await ensureClientsList();
    setTarifsState(Array.isArray(item.refsClient) ? item.refsClient : []);

    global.GderpiImages.setImageValue(
      document.getElementById('gderpi-article-image'),
      document.getElementById('gderpi-article-image-url'),
      item.imageUrl || ''
    );
    global.GderpiImages.setImagePreview(
      document.getElementById('gderpi-article-image-preview'),
      item.imageUrl || ''
    );
    const imgFn = document.getElementById('gderpi-article-image-filename');
    if (imgFn) {
      const imgPath = String(item.imageUrl || '');
      if (/^https?:\/\//i.test(imgPath)) {
        imgFn.textContent = '';
        imgFn.classList.add('is-empty');
      } else {
        imgFn.textContent = imgPath ? imgPath.split('/').pop() : '';
        imgFn.classList.toggle('is-empty', !imgFn.textContent);
      }
    }
    const submit = document.getElementById('gderpi-article-submit');
    const title = document.getElementById('gderpi-article-form-title');
    if (submit) submit.textContent = editingId ? 'Enregistrer' : 'Créer l\'article';
    if (title) title.textContent = editingId ? 'Modifier l\'article' : 'Nouvel article';
    if (generation !== formFillGeneration) {
      isFillingForm = false;
      return;
    }
    syncPrixSurDevisUi();
    setPrixSurDevisChecked(prixSurDevisValue);
    isFillingForm = false;
  }

  async function resetForm() {
    const generation = ++formFillGeneration;
    editingId = '';
    if (generation !== formFillGeneration) return;
    await fillForm({}, { generation });
  }

  async function loadRows(q) {
    const type = document.getElementById('gderpi-article-filter-type')?.value || '';
    const nodeId = document.getElementById('gderpi-article-filter-node')?.value || currentNodeFilter;
    const params = new URLSearchParams();
    if (nodeId) params.set('nodeId', nodeId);
    if (type) params.set('type', type);
    if (q) params.set('q', q);
    const path = '/articles' + (params.toString() ? '?' + params.toString() : '');
    const res = await global.GderpiApi.apiCall(path);
    return res.data || [];
  }

  function renderRows(tbody, items, api) {
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Aucun article.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map((a) =>
      '<tr data-gderpi-lc-row data-id="' + esc(a.articleId) + '">' +
      '<td>' + esc(a.reference || '—') + '</td><td>' + esc(a.libelle) + '</td><td>' + esc(a.type) +
      (a.gestionStock ? ' <span class="gderpi-badge gderpi-badge--stock" title="Géré en stock">Stock</span>' : '') + '</td>' +
      '<td>' + esc(a.unite) + '</td><td class="text-end">' +
      (a.prixSurDevis ? '<span class="text-muted">Sur devis</span>' : Number(a.prixHt || 0).toFixed(2)) + '</td>' +
      '<td class="text-end">' + esc(a.tauxTva) + '%</td>' +
      '<td onclick="event.stopPropagation()"><button type="button" class="btn btn-outline-danger btn-sm gderpi-article-del" data-id="' + esc(a.articleId) + '">Suppr.</button></td></tr>'
    ).join('');

    tbody.querySelectorAll('[data-gderpi-lc-row]').forEach((tr) => {
      tr.addEventListener('dblclick', async () => {
        const id = tr.getAttribute('data-id');
        const res = await global.GderpiApi.apiCall('/articles/' + encodeURIComponent(id));
        await fillForm(res.data);
        api.openCreate();
      });
    });
    tbody.querySelectorAll('.gderpi-article-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id || !window.confirm('Supprimer cet article ?')) return;
        await global.GderpiApi.apiCall('/articles/' + encodeURIComponent(id), { method: 'DELETE' });
        global.GderpiStatus.showStatus('Article supprimé.', 'success');
        await api.refresh();
        global.GderpiDashboardTab?.refreshDashboard?.();
      });
    });
  }

  function bindArticlesTab() {
    const root = document.querySelector('[data-gderpi-vue-lc="articles"]');
    const form = document.getElementById('gderpi-article-form');
    const btnCancel = document.getElementById('gderpi-article-cancel');
    const typeSel = document.getElementById('gderpi-article-type');
    const uniteSel = document.getElementById('gderpi-article-unite');
    const prixSurDevisEl = document.getElementById('gderpi-article-prix-sur-devis');
    if (btnCancel) btnCancel.addEventListener('click', () => { resetForm(); lcApi?.closeCreate(); });

    document.querySelectorAll('[data-gderpi-article-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchArticleTab(btn.getAttribute('data-gderpi-article-tab')));
    });

    document.getElementById('gderpi-article-frs-add')?.addEventListener('click', () => {
      openFrsModal('').catch(handleErr);
    });
    document.getElementById('gderpi-article-tarif-add')?.addEventListener('click', () => {
      openTarifModal('').catch(handleErr);
    });

    document.getElementById('gderpi-article-frs-form')?.addEventListener('submit', saveFrsFromModal);
    document.getElementById('gderpi-article-frs-cancel')?.addEventListener('click', () => frsModal?.close());
    document.getElementById('gderpi-article-tarif-form')?.addEventListener('submit', saveTarifFromModal);
    document.getElementById('gderpi-article-tarif-cancel')?.addEventListener('click', () => tarifModal?.close());

    global.GderpiUnites.populateUniteSelect(document.getElementById('gderpi-article-unite'), 'piece');

    if (typeSel) {
      typeSel.addEventListener('change', () => {
        if (isFillingForm) return;
        if (typeSel.value === 'developpement' && uniteSel?.value === 'forfait' && prixSurDevisEl && !editingId) {
          prixSurDevisEl.checked = true;
        }
        syncPrixSurDevisUi();
      });
    }
    if (uniteSel) {
      uniteSel.addEventListener('change', () => {
        if (isFillingForm) return;
        if (typeSel?.value === 'developpement' && uniteSel.value === 'forfait' && prixSurDevisEl && !editingId) {
          prixSurDevisEl.checked = true;
        }
        syncPrixSurDevisUi();
      });
    }
    if (prixSurDevisEl) prixSurDevisEl.addEventListener('change', syncPrixSurDevisUi);

    global.GderpiImages.bindImageUploadField({
      fileInputId: 'gderpi-article-image-file',
      storageInputId: 'gderpi-article-image',
      externalUrlInputId: 'gderpi-article-image-url',
      previewId: 'gderpi-article-image-preview',
      clearBtnId: 'gderpi-article-image-clear',
      scope: 'article-image'
    });

    lcApi = global.GderpiVueLc.bindVueLc({
      key: 'articles',
      root,
      loadRows,
      renderRows,
      modalSize: 'xl',
      extraFilterEls: [
        document.getElementById('gderpi-article-filter-type'),
        document.getElementById('gderpi-article-filter-node')
      ],
      onCreateOpen: async () => {
        if (!editingId) {
          await global.GderpiUnites.populateUniteSelect(document.getElementById('gderpi-article-unite'), '', true);
          await ensureFournisseursList();
          await ensureBoutiquesList();
          await ensureClientsList();
          await resetForm();
        }
      },
      onCreateClose: () => { resetForm(); }
    });

    const filterNode = document.getElementById('gderpi-article-filter-node');
    if (filterNode) {
      filterNode.addEventListener('change', (ev) => { currentNodeFilter = ev.target.value; });
    }

    if (form) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const prixSurDevis = document.getElementById('gderpi-article-prix-sur-devis')?.checked === true;
        const payload = {
          type: document.getElementById('gderpi-article-type').value,
          reference: document.getElementById('gderpi-article-ref').value.trim(),
          fournisseursArticle: collectFournisseursPayload(),
          refsClient: collectTarifsPayload(),
          libelle: document.getElementById('gderpi-article-libelle').value.trim(),
          unite: document.getElementById('gderpi-article-unite').value.trim(),
          prixHt: prixSurDevis ? 0 : Number(document.getElementById('gderpi-article-prix').value),
          prixSurDevis,
          gestionStock: document.getElementById('gderpi-article-gestion-stock')?.checked === true,
          gererCommande: document.getElementById('gderpi-article-gerer-commande')?.checked === true,
          tauxTva: Number(document.getElementById('gderpi-article-tva').value),
          nodeId: document.getElementById('gderpi-article-node').value.trim(),
          description: document.getElementById('gderpi-article-desc').value.trim(),
          commentaire: document.getElementById('gderpi-article-commentaire').value.trim(),
          imageUrl: global.GderpiImages.getImageValue(
            document.getElementById('gderpi-article-image'),
            document.getElementById('gderpi-article-image-url')
          )
        };
        if (editingId) {
          await global.GderpiApi.apiCall('/articles/' + encodeURIComponent(editingId), { method: 'PUT', body: JSON.stringify(payload) });
          global.GderpiStatus.showStatus('Article mis à jour.', 'success');
        } else {
          await global.GderpiApi.apiCall('/articles', { method: 'POST', body: JSON.stringify(payload) });
          global.GderpiStatus.showStatus('Article créé.', 'success');
        }
        resetForm();
        lcApi.closeCreate();
        await lcApi.refresh();
        global.GderpiDashboardTab?.refreshDashboard?.();
      });
    }
  }

  global.GderpiArticlesRefresh = {
    refreshArticlesList: (nodeId) => {
      if (nodeId !== undefined) currentNodeFilter = String(nodeId || '');
      return lcApi?.refresh();
    },
    populateNodeSelects
  };
  global.GderpiArticlesTab = { bindArticlesTab };
})(window);
