/**
 * FICHIER : modules/gderpi/frontend/assets/js/commandes/bindCommandeFournisseurEditor.js
 * RÔLE : Éditeur commande fournisseur — consultation et modification (brouillon / envoyée).
 */

(function initGderpiBindCommandeFournisseurEditor(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const fmt = (v) => global.GderpiFormat.formatMoney(v);
  const bindSearch = (input, opts) => global.GderpiBindArticleSearch.bindArticleSearchField(input, opts);
  const canWrite = () => global.GDERPI_CONFIG?.canWrite === true;

  const STATUT_LABELS = {
    brouillon: 'Brouillon',
    envoyee: 'Envoyée',
    confirmee: 'Confirmée',
    partiellement_recue: 'Part. reçue',
    recue: 'Reçue',
    annulee: 'Annulée'
  };

  const NEXT_STATUS = {
    brouillon: 'envoyee',
    envoyee: 'confirmee',
    confirmee: 'recue',
    partiellement_recue: 'recue'
  };

  const NEXT_LABEL = {
    brouillon: 'Valider et envoyer',
    envoyee: 'Confirmer',
    confirmee: 'Marquer reçue',
    partiellement_recue: 'Finaliser réception'
  };

  const RECEPTION_STATUTS = new Set(['envoyee', 'confirmee', 'partiellement_recue']);

  let articles = [];
  let fournisseurs = [];
  let boutiques = [];
  let lines = [];
  let lineSearchBindings = [];
  let editorModal = null;
  let mode = 'edit';
  let createOrigine = '';
  let draftSupplierKey = '';
  let editingId = '';
  let currentCommande = null;
  let linkedCommandeClient = null;
  let isDirty = false;

  function emptyLine() {
    return {
      articleId: null,
      articleType: 'produit',
      reference: '',
      referenceFournisseur: '',
      referenceClient: '',
      libelle: '',
      description: '',
      unite: 'piece',
      quantite: 1,
      prixHt: 0,
      remisePct: 0,
      tauxTva: 20
    };
  }

  function isLineEmpty(line) {
    if (!line) return true;
    return !String(line.libelle || '').trim()
      && !line.articleId
      && !String(line.reference || '').trim();
  }

  function isEditable() {
    if (!canWrite()) return false;
    if (mode === 'create') return true;
    const s = String(currentCommande?.statut || '');
    return s === 'brouillon' || s === 'envoyee';
  }

  function parseSupplierKey(key) {
    const raw = String(key || '').trim();
    if (raw.startsWith('btq:')) {
      return { fournisseurId: null, fournisseurBoutiqueId: raw.slice(4) };
    }
    if (raw.startsWith('frs:')) {
      return { fournisseurId: raw.slice(4), fournisseurBoutiqueId: null };
    }
    return { fournisseurId: null, fournisseurBoutiqueId: null };
  }

  function supplierKeyFromIds(fournisseurId, fournisseurBoutiqueId) {
    if (fournisseurBoutiqueId) return 'btq:' + fournisseurBoutiqueId;
    if (fournisseurId) return 'frs:' + fournisseurId;
    return '';
  }

  function articleFournisseurs(article) {
    if (Array.isArray(article?.fournisseursArticle) && article.fournisseursArticle.length) {
      return article.fournisseursArticle;
    }
    return Array.isArray(article?.fournisseurs) ? article.fournisseurs : [];
  }

  function supplierIds() {
    if (canEditSupplier()) return parseSupplierKey(draftSupplierKey);
    return {
      fournisseurId: currentCommande?.fournisseurId || null,
      fournisseurBoutiqueId: currentCommande?.fournisseurBoutiqueId || null
    };
  }

  function articlesForSearch() {
    let list = articles.filter(articleMatchesSupplier);
    if (mode === 'create' && createOrigine === 'stock') {
      list = list.filter((a) => a.type === 'produit' && a.gestionStock === true);
    }
    return list;
  }

  function showReceptionColumns() {
    if (isEditable()) return false;
    const s = String(currentCommande?.statut || '');
    return ['confirmee', 'partiellement_recue', 'recue'].includes(s);
  }

  function supplierLabel() {
    const ids = supplierIds();
    if (ids.fournisseurBoutiqueId) {
      const b = boutiques.find((x) => String(x.boutiqueId || x.id) === String(ids.fournisseurBoutiqueId));
      return 'Boutique : ' + (b ? (b.nom || b.raisonSociale || ids.fournisseurBoutiqueId) : ids.fournisseurBoutiqueId);
    }
    const id = ids.fournisseurId;
    if (!id) return '— Sans fournisseur —';
    const f = fournisseurs.find((x) => String(x.fournisseurId || x.id) === String(id));
    return f ? (f.displayName || f.raisonSociale || id) : id;
  }

  function articleMatchesSupplier(article) {
    if (mode === 'create' && !draftSupplierKey) return false;
    const { fournisseurId, boutiqueFournisseurId } = supplierIds();
    if (!fournisseurId && !boutiqueFournisseurId) return true;
    const list = articleFournisseurs(article);
    if (!list.length) return !fournisseurId;
    return list.some((f) => {
      if (boutiqueFournisseurId && String(f.boutiqueId || '') === String(boutiqueFournisseurId)) return true;
      if (fournisseurId && String(f.fournisseurId || '') === String(fournisseurId)) return true;
      return false;
    });
  }

  function resolveFrsEntry(article) {
    const { fournisseurId, boutiqueFournisseurId } = supplierIds();
    const list = articleFournisseurs(article);
    return list.find((f) => {
      if (boutiqueFournisseurId && String(f.boutiqueId || '') === String(boutiqueFournisseurId)) return true;
      if (fournisseurId && String(f.fournisseurId || '') === String(fournisseurId)) return true;
      return false;
    }) || list.find((f) => f.principal) || list[0] || null;
  }

  function calcLineTotals(line) {
    const qty = Number(line.quantite) || 0;
    const prix = Number(line.prixHt) || 0;
    const rem = Number(line.remisePct) || 0;
    const ht = Math.round(qty * prix * (1 - rem / 100) * 100) / 100;
    return { ...line, montantHt: ht };
  }

  function getFraisPortFromDom() {
    const ht = Number(document.getElementById('gderpi-cmd-frs-frais-port-ht')?.value) || 0;
    const tva = Number(document.getElementById('gderpi-cmd-frs-frais-port-tva')?.value);
    return {
      fraisPortHt: ht > 0 ? Math.round(ht * 100) / 100 : 0,
      fraisPortTauxTva: ht > 0 && Number.isFinite(tva) ? tva : 20
    };
  }

  function calcDocTotals() {
    let totalHt = 0;
    let totalTva = 0;
    lines.filter((l) => !isLineEmpty(l)).forEach((l) => {
      const line = calcLineTotals(l);
      totalHt += line.montantHt;
      totalTva += line.montantHt * (Number(line.tauxTva) || 0) / 100;
    });
    const frais = getFraisPortFromDom();
    if (frais.fraisPortHt > 0) {
      totalHt += frais.fraisPortHt;
      totalTva += frais.fraisPortHt * frais.fraisPortTauxTva / 100;
    }
    totalHt = Math.round(totalHt * 100) / 100;
    totalTva = Math.round(totalTva * 100) / 100;
    return { totalHt, totalTva, totalTtc: Math.round((totalHt + totalTva) * 100) / 100 };
  }

  function bindFraisPortFields() {
    ['gderpi-cmd-frs-frais-port-ht', 'gderpi-cmd-frs-frais-port-tva'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.gderpiFraisBound) return;
      el.dataset.gderpiFraisBound = '1';
      el.addEventListener('input', () => {
        markDirty();
        renderTotals();
      });
    });
  }

  function syncFraisPortFields(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const resetValues = opts.resetValues === true;
    const editable = isEditable();
    const fraisHtEl = document.getElementById('gderpi-cmd-frs-frais-port-ht');
    const fraisTvaEl = document.getElementById('gderpi-cmd-frs-frais-port-tva');
    const fraisEditRow = document.getElementById('gderpi-cmd-frs-frais-port-edit-row');
    if (resetValues) {
      if (mode === 'create') {
        if (fraisHtEl) fraisHtEl.value = '';
        if (fraisTvaEl) fraisTvaEl.value = 20;
      } else {
        if (fraisHtEl) {
          fraisHtEl.value = Number(currentCommande?.fraisPortHt) > 0 ? currentCommande.fraisPortHt : '';
        }
        if (fraisTvaEl) {
          fraisTvaEl.value = Number(currentCommande?.fraisPortHt) > 0
            && Number.isFinite(Number(currentCommande?.fraisPortTauxTva))
            ? currentCommande.fraisPortTauxTva
            : 20;
        }
      }
    }
    if (fraisEditRow) fraisEditRow.hidden = !editable;
    if (fraisHtEl) fraisHtEl.disabled = !editable;
    if (fraisTvaEl) fraisTvaEl.disabled = !editable;
    bindFraisPortFields();
  }

  function renderFraisPortRow() {
    const row = document.getElementById('gderpi-cmd-frs-frais-port-row');
    const frais = getFraisPortFromDom();
    const showDisplay = !isEditable() && frais.fraisPortHt > 0;
    if (row) row.hidden = !showDisplay;
    const cell = document.getElementById('gderpi-cmd-frs-frais-port-display');
    if (cell && frais.fraisPortHt > 0) cell.textContent = fmt(frais.fraisPortHt);
  }

  function cloneLine(line) {
    const refFrs = line.referenceFournisseur || line.referenceClient || '';
    return calcLineTotals({
      id: line.id,
      articleId: line.articleId || null,
      articleType: line.articleType || 'produit',
      reference: line.reference || '',
      referenceFournisseur: refFrs,
      referenceClient: refFrs,
      libelle: line.libelle || '',
      description: line.description || '',
      unite: line.unite || 'piece',
      quantite: line.quantite ?? 1,
      prixHt: line.prixHt ?? 0,
      remisePct: line.remisePct ?? 0,
      tauxTva: line.tauxTva ?? 20,
      quantiteRecue: line.quantiteRecue ?? 0,
      quantiteRestante: line.quantiteRestante
    });
  }

  function articleFromCatalog(a) {
    const frs = resolveFrsEntry(a);
    const refFrs = frs?.referenceFournisseur || '';
    // Tarif d'achat fournisseur uniquement (jamais le prix de vente catalogue).
    const prix = frs?.prixAchatHt != null && frs.prixAchatHt !== ''
      ? Number(frs.prixAchatHt)
      : 0;
    const ids = supplierIds();
    return calcLineTotals({
      articleId: a.articleId || a.id,
      articleType: a.type || 'produit',
      reference: a.reference || '',
      referenceFournisseur: refFrs,
      referenceClient: refFrs,
      libelle: a.libelle || a.nom || '',
      description: a.description || '',
      unite: a.unite || 'piece',
      quantite: 1,
      prixHt: Number.isFinite(prix) ? prix : 0,
      remisePct: 0,
      tauxTva: a.tauxTva ?? 20,
      fournisseurId: ids.fournisseurId,
      boutiqueFournisseurId: ids.boutiqueFournisseurId
    });
  }

  function applyCatalogPurchasePricesToLines() {
    if (!isEditable() || !articles.length) return false;
    let changed = false;
    lines = lines.map((l) => {
      if (isLineEmpty(l) || !l.articleId) return l;
      const catalog = articles.find((a) => String(a.articleId || a.id) === String(l.articleId));
      if (!catalog) return l;
      const mapped = articleFromCatalog(catalog);
      const nextPrix = Number(mapped.prixHt) || 0;
      const nextRef = mapped.referenceFournisseur || '';
      if (Number(l.prixHt) === nextPrix && String(l.referenceFournisseur || '') === nextRef) {
        return l;
      }
      changed = true;
      return calcLineTotals({
        ...l,
        prixHt: nextPrix,
        referenceFournisseur: nextRef || l.referenceFournisseur || '',
        referenceClient: nextRef || l.referenceClient || '',
        fournisseurId: mapped.fournisseurId || l.fournisseurId,
        boutiqueFournisseurId: mapped.boutiqueFournisseurId || l.boutiqueFournisseurId
      });
    });
    return changed;
  }

  function markDirty() {
    isDirty = true;
  }

  function destroyLineBindings() {
    lineSearchBindings.forEach((b) => b?.destroy?.());
    lineSearchBindings = [];
  }

  function ensureTrailingEmptyLine() {
    if (!isEditable()) return false;
    if (!lines.length || !isLineEmpty(lines[lines.length - 1])) {
      lines.push(emptyLine());
      return true;
    }
    return false;
  }

  function cmdFrsEl(id) {
    return document.getElementById(id);
  }

  function canEditCreateFields() {
    return mode === 'create';
  }

  function canEditSupplier() {
    if (!canWrite()) return false;
    if (mode === 'create') return true;
    return String(currentCommande?.statut || '') === 'brouillon';
  }

  function setCreateSelectEnabled(sel, enabled) {
    if (!sel) return;
    if (enabled) {
      sel.disabled = false;
      sel.removeAttribute('disabled');
      sel.removeAttribute('aria-disabled');
    } else {
      sel.disabled = true;
    }
  }

  function setCreateSelectsLoading() {
    const frsSel = cmdFrsEl('gderpi-cmd-frs-fournisseur-select');
    const btqSel = cmdFrsEl('gderpi-cmd-frs-boutique');
    if (frsSel) frsSel.innerHTML = '<option value="">— Chargement… —</option>';
    if (btqSel) btqSel.innerHTML = '<option value="">— Chargement… —</option>';
  }

  function enableCreateSelects() {
    setCreateSelectEnabled(cmdFrsEl('gderpi-cmd-frs-fournisseur-select'), canEditSupplier());
    setCreateSelectEnabled(cmdFrsEl('gderpi-cmd-frs-boutique'), canEditCreateFields());
  }

  async function ensureTierRefs(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const force = opts.force === true;
    const silent = opts.silent !== false;
    const apiOpts = silent ? { silent: true } : {};

    if (!force) {
      const cached = global.GderpiAchatsTab?.getTierRefs?.();
      if (cached?.fournisseurs?.length) fournisseurs = cached.fournisseurs;
      if (cached?.boutiques?.length) boutiques = cached.boutiques;
    }

    const errors = [];
    const tasks = [];
    if (force || !fournisseurs.length) {
      tasks.push(
        global.GderpiApi.apiCall('/fournisseurs', apiOpts)
          .then((res) => { fournisseurs = Array.isArray(res.data) ? res.data : []; })
          .catch((err) => {
            errors.push(err);
            if (!fournisseurs.length) fournisseurs = [];
          })
      );
    }
    if (force || !boutiques.length) {
      tasks.push(
        global.GderpiApi.apiCall('/boutiques', apiOpts)
          .then((res) => { boutiques = Array.isArray(res.data) ? res.data : []; })
          .catch((err) => {
            errors.push(err);
            if (!boutiques.length) boutiques = [];
          })
      );
    }
    if (tasks.length) await Promise.all(tasks);
    if (errors.length && !silent) {
      throw errors[0];
    }
    return { fournisseurs, boutiques, errors };
  }

  async function ensureArticles() {
    if (articles.length) return;
    const articlesRes = await global.GderpiApi.apiCall('/articles');
    articles = articlesRes.data || [];
  }

  async function ensureRefs() {
    await Promise.all([ensureTierRefs(), ensureArticles()]);
  }

  function ensureEditorModal() {
    if (editorModal) return editorModal;
    const el = document.getElementById('gderpi-cmd-frs-editor');
    if (!el || !global.GderpiModal) return null;
    editorModal = global.GderpiModal.enhance(el, {
      size: 'xl',
      variant: 'devis',
      stacked: true,
      hideHeader: true,
      onBackdrop: () => closeEditor(),
      onOpen: () => {
        if (canEditSupplier()) {
          populateCreateSelects();
          enableCreateSelects();
        }
      }
    });
    return editorModal;
  }

  function statutBadge(statut) {
    const s = String(statut || 'brouillon');
    return '<span class="gderpi-badge-statut gderpi-badge-statut--' + esc(s) + '">' + esc(STATUT_LABELS[s] || s) + '</span>';
  }

  function renderWorkflowStrip() {
    const wrap = document.getElementById('gderpi-cmd-frs-workflow-wrap');
    const el = document.getElementById('gderpi-cmd-frs-workflow');
    if (!wrap || !el || !currentCommande || mode === 'create') {
      if (wrap) wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    const s = String(currentCommande.statut || 'brouillon');
    const next = NEXT_STATUS[s];
    let html = statutBadge(s);
    if (canWrite() && next) {
      html += ' <button type="button" class="btn btn-outline btn-sm gderpi-cmd-frs-next" data-next="' + esc(next) + '">' +
        esc(NEXT_LABEL[s] || 'Suivant') + '</button>';
    }
    if (canWrite() && RECEPTION_STATUTS.has(s)) {
      html += ' <button type="button" class="btn btn-outline btn-sm gderpi-cmd-frs-reception">Réception partielle</button>';
    }
    if (canWrite() && s !== 'brouillon' && s !== 'annulee') {
      html += ' <button type="button" class="btn btn-outline btn-sm gderpi-cmd-frs-email">E-mail fournisseur</button>';
    }
    if (canWrite() && s !== 'annulee' && s !== 'recue') {
      html += ' <button type="button" class="btn btn-outline-danger btn-sm gderpi-cmd-frs-cancel">Annuler</button>';
    }
    el.innerHTML = html;
    el.querySelector('.gderpi-cmd-frs-next')?.addEventListener('click', (ev) => {
      updateStatus(editingId, ev.currentTarget.getAttribute('data-next')).catch(handleErr);
    });
    el.querySelector('.gderpi-cmd-frs-reception')?.addEventListener('click', () => {
      global.GderpiReceptionFournisseurModal?.openReceptionForCommandeFournisseur?.(editingId);
    });
    el.querySelector('.gderpi-cmd-frs-email')?.addEventListener('click', () => {
      sendEmail(editingId).catch(handleErr);
    });
    el.querySelector('.gderpi-cmd-frs-cancel')?.addEventListener('click', () => {
      if (!window.confirm('Annuler cette commande fournisseur ?')) return;
      updateStatus(editingId, 'annulee').catch(handleErr);
    });
  }

  async function updateStatus(id, statut) {
    if (statut === 'envoyee') {
      const modalResult = await global.GderpiSendEmail?.prompt?.({
        title: 'Valider et envoyer au fournisseur',
        description: 'Un e-mail avec lien de consultation sera envoyé au contact principal du fournisseur.',
        recipientContext: { type: 'commande_fournisseur', id }
      });
      if (!modalResult) return;
      const emailPayload = global.GderpiSendEmail.buildPayload(modalResult) || {};
      try {
        await global.GderpiApi.apiCall('/commandes-fournisseur/' + encodeURIComponent(id) + '/status', {
          method: 'PATCH',
          body: JSON.stringify({ statut, ...emailPayload })
        });
        global.GderpiStatus.showStatus('Commande validée et e-mail envoyé au fournisseur.', 'success');
        await reloadCommande(id);
        global.GderpiAchatsTab?.refreshAchatsList?.();
        renderLines();
        return;
      } catch (err) {
        global.GderpiStatus.showStatus(err.message || 'Erreur mise à jour statut', 'error');
        throw err;
      }
    }
    try {
      await global.GderpiApi.apiCall('/commandes-fournisseur/' + encodeURIComponent(id) + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ statut })
      });
      const msg = statut === 'envoyee'
        ? 'Commande validée et e-mail envoyé au fournisseur.'
        : 'Statut mis à jour.';
      global.GderpiStatus.showStatus(msg, 'success');
      await reloadCommande(id);
      global.GderpiAchatsTab?.refreshAchatsList?.();
      renderLines();
    } catch (err) {
      global.GderpiStatus.showStatus(err.message || 'Erreur mise à jour statut', 'error');
      throw err;
    }
  }

  async function sendEmail(id) {
    const modalResult = await global.GderpiSendEmail?.prompt?.({
      title: 'Renvoyer la commande fournisseur',
      description: 'Le fournisseur recevra un lien pour consulter et télécharger la commande.',
      recipientContext: { type: 'commande_fournisseur', id }
    });
    if (!modalResult) return;
    const payload = global.GderpiSendEmail.buildPayload(modalResult) || {};
    try {
      const res = await global.GderpiApi.apiCall('/commandes-fournisseur/' + encodeURIComponent(id) + '/send', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const to = res.data?.sentTo || 'fournisseur';
      global.GderpiStatus.showStatus('E-mail envoyé à ' + to + '.', 'success');
      await reloadCommande(id);
    } catch (err) {
      global.GderpiStatus.showStatus(err.message || 'Erreur envoi e-mail', 'error');
      throw err;
    }
  }

  async function reloadCommande(id) {
    const res = await global.GderpiApi.apiCall('/commandes-fournisseur/' + encodeURIComponent(id));
    currentCommande = res.data;
    if (currentCommande?.commandeClientId) {
      try {
        const cc = await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(currentCommande.commandeClientId));
        linkedCommandeClient = cc.data;
      } catch {
        linkedCommandeClient = null;
      }
    } else {
      linkedCommandeClient = null;
    }
    lines = (currentCommande?.lignes || []).map(cloneLine);
    if (isEditable()) ensureTrailingEmptyLine();
    if (applyCatalogPurchasePricesToLines()) markDirty();
    syncFraisPortFields({ resetValues: true });
    renderHeader();
    if (editorModal) renderLines();
  }

  function supplierLabelFromKey(key) {
    const parsed = parseSupplierKey(key);
    if (parsed.fournisseurBoutiqueId) {
      const b = boutiques.find((x) => String(x.boutiqueId || x.id) === String(parsed.fournisseurBoutiqueId));
      return 'Boutique : ' + (b ? (b.nom || b.raisonSociale || parsed.fournisseurBoutiqueId) : parsed.fournisseurBoutiqueId);
    }
    const id = parsed.fournisseurId;
    if (!id) return '';
    const f = fournisseurs.find((x) => String(x.fournisseurId || x.id) === String(id));
    return f ? (f.displayName || f.raisonSociale || id) : id;
  }

  function collectSupplierOptionKeys() {
    const keys = new Map();
    const add = (key, label, group) => {
      const k = String(key || '').trim();
      if (!k || keys.has(k)) return;
      keys.set(k, { key: k, label: String(label || k).trim(), group: group || '' });
    };

    lines.filter((l) => !isLineEmpty(l)).forEach((line) => {
      const articleId = line.articleId ? String(line.articleId).trim() : '';
      if (!articleId) return;
      const article = articles.find((a) => String(a.articleId || a.id) === articleId);
      if (!article) return;
      articleFournisseurs(article).forEach((entry) => {
        if (entry.sourceType === 'boutique' && entry.boutiqueId) {
          add('btq:' + entry.boutiqueId, supplierLabelFromKey('btq:' + entry.boutiqueId), 'article');
        } else if (entry.fournisseurId) {
          add('frs:' + entry.fournisseurId, supplierLabelFromKey('frs:' + entry.fournisseurId), 'article');
        }
      });
    });

    fournisseurs.forEach((f) => {
      const id = f.fournisseurId || f.id;
      if (!id) return;
      add('frs:' + id, f.displayName || f.raisonSociale || id, 'catalogue');
    });

    boutiques.forEach((b) => {
      const id = b.boutiqueId || b.id;
      if (!id) return;
      add('btq:' + id, 'Boutique : ' + (b.nom || b.raisonSociale || id), 'catalogue');
    });

    return Array.from(keys.values());
  }

  function fillSupplierSelect(selectedKey) {
    const sel = cmdFrsEl('gderpi-cmd-frs-fournisseur-select');
    if (!sel) return false;
    const pick = String(selectedKey || sel.value || draftSupplierKey || '').trim();
    const options = collectSupplierOptionKeys();
    const groups = [
      { id: 'article', title: 'Fournisseurs de l\'article' },
      { id: 'catalogue', title: 'Catalogue complet' }
    ];
    const html = ['<option value="">— Sélectionner un fournisseur —</option>'];
    if (!options.length) {
      html[0] = '<option value="">— Créez un fournisseur (menu Fournisseurs) —</option>';
    } else {
      groups.forEach((group) => {
        const items = options.filter((o) => o.group === group.id);
        if (!items.length) return;
        html.push('<optgroup label="' + esc(group.title) + '">');
        items.forEach((o) => {
          html.push('<option value="' + esc(o.key) + '"' + (o.key === pick ? ' selected' : '') + '>' + esc(o.label) + '</option>');
        });
        html.push('</optgroup>');
      });
      const other = options.filter((o) => o.group !== 'article' && o.group !== 'catalogue');
      other.forEach((o) => {
        html.push('<option value="' + esc(o.key) + '"' + (o.key === pick ? ' selected' : '') + '>' + esc(o.label) + '</option>');
      });
    }
    sel.innerHTML = html.join('');
    setCreateSelectEnabled(sel, canEditSupplier());
    if (pick && options.some((o) => o.key === pick)) {
      sel.value = pick;
      draftSupplierKey = pick;
    } else if (pick) {
      sel.value = '';
      draftSupplierKey = '';
    } else {
      draftSupplierKey = sel.value || '';
    }
    return true;
  }

  function fillBoutiqueSelect(selectedId) {
    const sel = cmdFrsEl('gderpi-cmd-frs-boutique');
    if (!sel) return false;
    const pick = String(selectedId || sel.value || defaultBoutiqueId() || '').trim();
    const active = boutiques.filter((b) => b.actif !== false);
    const list = active.length ? active : boutiques;
    if (!list.length) {
      sel.innerHTML = '<option value="">— Créez une boutique (Configuration) —</option>';
      setCreateSelectEnabled(sel, false);
      return true;
    }
    const optionHtml = list.map((b) => {
      const id = String(b.boutiqueId || b.id || '').trim();
      if (!id) return '';
      return '<option value="' + esc(id) + '"' + (id === pick ? ' selected' : '') + '>' +
        esc(b.nom || b.raisonSociale || id) + '</option>';
    }).filter(Boolean).join('');
    sel.innerHTML = optionHtml || '<option value="">— Créez une boutique (Configuration) —</option>';
    setCreateSelectEnabled(sel, canEditCreateFields() && Boolean(optionHtml));
    if (pick && optionHtml) sel.value = pick;
    else if (!sel.value && list.length) {
      const fallback = defaultBoutiqueId();
      if (fallback) sel.value = fallback;
    }
    return true;
  }

  function populateCreateSelects() {
    const okFrs = fillSupplierSelect(draftSupplierKey);
    const okBtq = fillBoutiqueSelect(defaultBoutiqueId());
    enableCreateSelects();
    if (!okFrs || !okBtq) {
      global.GderpiStatus?.showStatus?.(
        'Listes fournisseur / boutique introuvables dans la modale — rechargez la page (Ctrl+F5).',
        'danger'
      );
      return false;
    }
    if (!fournisseurs.length) {
      global.GderpiStatus?.showStatus?.(
        'Aucun fournisseur externe — créez-en un dans le menu Fournisseurs.',
        'warning'
      );
    }
    return true;
  }

  function defaultBoutiqueId() {
    const active = boutiques.find((b) => b.actif !== false);
    return active?.boutiqueId || active?.id || boutiques[0]?.boutiqueId || boutiques[0]?.id || '';
  }

  function renderSupplierField() {
    const createWrap = cmdFrsEl('gderpi-cmd-frs-create-fields');
    const supplierWrap = cmdFrsEl('gderpi-cmd-frs-supplier-wrap');
    const displayWrap = cmdFrsEl('gderpi-cmd-frs-fournisseur-display-wrap');
    const display = cmdFrsEl('gderpi-cmd-frs-fournisseur-display');
    const showSupplierSelect = canEditSupplier();
    const isCreate = mode === 'create';

    if (createWrap) {
      if (isCreate) createWrap.removeAttribute('hidden');
      else createWrap.setAttribute('hidden', '');
    }
    if (supplierWrap) {
      if (showSupplierSelect) supplierWrap.removeAttribute('hidden');
      else supplierWrap.setAttribute('hidden', '');
    }
    if (displayWrap) {
      if (showSupplierSelect) displayWrap.setAttribute('hidden', '');
      else displayWrap.removeAttribute('hidden');
    }
    if (showSupplierSelect) {
      if (!isCreate) {
        draftSupplierKey = supplierKeyFromIds(
          currentCommande?.fournisseurId,
          currentCommande?.fournisseurBoutiqueId
        ) || draftSupplierKey;
      }
      populateCreateSelects();
      if (isCreate && !boutiques.length) {
        global.GderpiStatus?.showStatus?.(
          'Aucune boutique — créez-en une dans Configuration → Boutiques (boutique émettrice).',
          'warning'
        );
      }
    } else if (display) {
      display.textContent = supplierLabel();
    }
  }

  function renderCommandeClientField() {
    const wrap = document.getElementById('gderpi-cmd-frs-cmd-client-wrap');
    if (wrap) wrap.hidden = mode === 'create';
  }

  function renderLinesHint() {
    const hint = document.getElementById('gderpi-cmd-frs-lines-hint');
    if (!hint) return;
    if (mode === 'create' && !draftSupplierKey) {
      hint.textContent = 'Sélectionnez d\'abord un fournisseur ci-dessus, puis ajoutez les lignes.';
      return;
    }
    if (mode === 'create' && createOrigine === 'stock') {
      hint.textContent = 'Articles « gérés en stock » liés au fournisseur choisi. Sans fournisseur sur l\'article : onglet Articles → Fournisseurs → + Fournisseur.';
    } else if (mode === 'create') {
      hint.textContent = 'Recherche filtrée sur le fournisseur choisi. Saisie libre possible si l\'article n\'a pas encore de fournisseur.';
    } else {
      hint.textContent = canEditSupplier()
        ? 'Brouillon — modifiez le fournisseur, les lignes, puis validez depuis la commande client ou l\'onglet Achats.'
        : 'Modifiable en brouillon ou envoyée. Double-clic sur une ligne dans la liste des achats pour ouvrir.';
    }
  }

  function renderEditorActions() {
    const actions = document.getElementById('gderpi-cmd-frs-actions');
    if (!actions) return;

    let html = '<button type="button" class="btn btn-outline btn-sm" id="gderpi-cmd-frs-close">Fermer</button>';
    if (editingId) {
      html += ' <button type="button" class="btn btn-outline btn-sm" id="gderpi-cmd-frs-pdf">PDF</button>';
      html += ' <button type="button" class="btn btn-outline btn-sm" id="gderpi-cmd-frs-html">Aperçu HTML</button>';
    }
    if (isEditable()) {
      const saveLabel = mode === 'create' ? 'Créer la commande' : 'Enregistrer';
      html += ' <button type="button" class="btn btn-primary btn-sm" id="gderpi-cmd-frs-save">' + saveLabel + '</button>';
    }

    actions.innerHTML = html;
    actions.querySelector('#gderpi-cmd-frs-close')?.addEventListener('click', closeEditor);
    actions.querySelector('#gderpi-cmd-frs-save')?.addEventListener('click', () => save().catch(handleErr));
    actions.querySelector('#gderpi-cmd-frs-pdf')?.addEventListener('click', () => {
      global.GderpiCommandeClientHelpers.downloadCommandeFournisseurPdf(editingId).catch(handleErr);
    });
    actions.querySelector('#gderpi-cmd-frs-html')?.addEventListener('click', () => {
      global.GderpiCommandeClientHelpers.previewCommandeFournisseurHtml(editingId).catch(handleErr);
    });
  }

  function renderCommandeClientLink() {
    const wrap = document.getElementById('gderpi-cmd-frs-cmd-client-link');
    if (!wrap) return;
    const ccId = currentCommande?.commandeClientId;
    const numero = linkedCommandeClient?.numero;
    if (!ccId || !numero) {
      wrap.innerHTML = '<span class="text-muted">—</span>';
      return;
    }
    wrap.innerHTML = '<button type="button" class="btn btn-link btn-sm p-0 gderpi-cmd-frs-open-cc" data-id="' +
      esc(ccId) + '">' + esc(numero) + '</button>';
    wrap.querySelector('.gderpi-cmd-frs-open-cc')?.addEventListener('click', () => {
      closeEditor();
      global.GderpiAppNav?.('commandes');
      global.GderpiCommandeClientEditor?.openCommande?.(ccId).catch(handleErr);
    });
  }

  function renderHeader() {
    const title = document.getElementById('gderpi-cmd-frs-title');
    const subtitle = document.getElementById('gderpi-cmd-frs-subtitle');
    if (mode === 'create') {
      if (title) {
        title.textContent = createOrigine === 'stock'
          ? 'Nouvelle commande stock'
          : 'Nouvelle commande fournisseur';
      }
      if (subtitle) subtitle.textContent = 'Sélectionnez le fournisseur puis les articles à commander';
    } else {
      if (title) title.textContent = 'Commande fournisseur ' + (currentCommande?.numero || '');
      if (subtitle) subtitle.textContent = currentCommande?.objet || '';
    }

    renderSupplierField();
    renderCommandeClientField();
    renderCommandeClientLink();
    renderWorkflowStrip();
    renderLinesHint();

    const objetEl = document.getElementById('gderpi-cmd-frs-objet');
    if (objetEl) {
      if (mode === 'create' && !objetEl.value) {
        objetEl.value = createOrigine === 'stock' ? 'Réapprovisionnement stock' : '';
      }
      objetEl.disabled = !isEditable();
    }

    const notesEl = document.getElementById('gderpi-cmd-frs-notes');
    if (notesEl) {
      if (mode === 'create') notesEl.value = notesEl.value || '';
      else notesEl.value = currentCommande?.notes || '';
      notesEl.disabled = !isEditable();
    }

    syncFraisPortFields();
    renderEditorActions();
  }

  function linesTableColspan() {
    const base = 8;
    return showReceptionColumns() ? base + 2 : base;
  }

  function renderLinesTableHead() {
    const thead = document.getElementById('gderpi-cmd-frs-lines-thead');
    if (!thead) return;
    const editable = isEditable();
    const receptionHead = showReceptionColumns()
      ? '<th class="text-end">Reçu</th><th class="text-end">Reste</th>'
      : '';
    const colspanBase = linesTableColspan();
    thead.innerHTML = '<tr>' +
      '<th>Réf. interne</th><th>Réf. fournisseur</th><th>Libellé</th><th>Unité</th><th class="text-end">Qté</th>' +
      receptionHead +
      '<th class="text-end">Prix achat HT</th><th class="text-end">Rem.%</th><th class="text-end">TVA</th><th class="text-end">Montant HT</th><th></th></tr>';
    thead.dataset.colspanBase = String(colspanBase);
    const tfoot = document.querySelector('#gderpi-cmd-frs-lines-tbody')?.closest('table')?.querySelector('tfoot');
    if (tfoot) {
      tfoot.querySelectorAll('tr').forEach((row) => {
        if (row.id === 'gderpi-cmd-frs-frais-port-edit-row') {
          const labelCell = row.querySelector('td[colspan]');
          if (labelCell) labelCell.colSpan = Math.max(1, colspanBase - 2);
          return;
        }
        const labelCell = row.querySelector('td[colspan]');
        if (labelCell) labelCell.colSpan = colspanBase;
      });
    }
  }

  function renderLineDescriptionBlock(l, idx, editable) {
    if (editable && isLineEmpty(l)) return '';
    const text = String(l.description || '').trim();
    if (!editable && !text) return '';
    const colspan = linesTableColspan() + 2;
    if (!editable) {
      return '<tr class="gderpi-devis-line-detail"><td colspan="' + colspan + '">' +
        '<div class="gderpi-devis-line-desc-read">' + esc(text).replace(/\n/g, '<br>') + '</div></td></tr>';
    }
    return '<tr data-cmd-frs-line-detail-idx="' + idx + '" class="gderpi-devis-line-detail">' +
      '<td colspan="' + colspan + '"><label class="gderpi-devis-line-desc-label">Description</label>' +
      '<textarea class="form-control gderpi-devis-line-description" rows="2">' + esc(l.description || '') + '</textarea></td></tr>';
  }

  function renderReadonlyLine(l, idx) {
    const recue = showReceptionColumns()
      ? '<td class="text-end">' + esc(l.quantiteRecue ?? 0) + '</td><td class="text-end">' + esc(l.quantiteRestante ?? '—') + '</td>'
      : '';
    const refFrs = l.referenceFournisseur || l.referenceClient || '—';
    return '<tr>' +
      '<td>' + esc(l.reference || '—') + '</td>' +
      '<td>' + esc(refFrs) + '</td>' +
      '<td>' + esc(l.libelle) + '</td>' +
      '<td>' + esc(l.unite) + '</td>' +
      '<td class="text-end">' + esc(l.quantite) + '</td>' +
      recue +
      '<td class="text-end">' + fmt(l.prixHt) + '</td>' +
      '<td class="text-end">' + esc(l.remisePct) + '</td>' +
      '<td class="text-end">' + esc(l.tauxTva) + '%</td>' +
      '<td class="text-end">' + fmt(l.montantHt) + '</td>' +
      '<td></td></tr>' + renderLineDescriptionBlock(l, idx, false);
  }

  function renderEditableLine(l, idx) {
    const refFrs = l.referenceFournisseur || l.referenceClient || '';
    if (isLineEmpty(l)) {
      return '<tr data-cmd-frs-line-idx="' + idx + '" class="gderpi-devis-line-main gderpi-devis-line--draft">' +
        '<td><input class="form-control gderpi-devis-line-ref" type="text" value="' + esc(l.reference) + '" placeholder="Réf. interne" autocomplete="off"></td>' +
        '<td><input class="form-control gderpi-devis-line-ref-frs" type="text" value="' + esc(refFrs) + '" placeholder="Réf. fournisseur" autocomplete="off"></td>' +
        '<td colspan="7"><input class="form-control gderpi-devis-line-libelle gderpi-devis-line-libelle--draft" type="text" value="' + esc(l.libelle) + '" placeholder="Libellé — tapez pour chercher" autocomplete="off"></td>' +
        '</tr>';
    }
    return '<tr data-cmd-frs-line-idx="' + idx + '" class="gderpi-devis-line-main">' +
      '<td><input class="form-control gderpi-devis-line-ref" type="text" value="' + esc(l.reference) + '" autocomplete="off"></td>' +
      '<td><input class="form-control gderpi-devis-line-ref-frs" type="text" value="' + esc(refFrs) + '" autocomplete="off"></td>' +
      '<td><input class="form-control gderpi-devis-line-libelle" type="text" value="' + esc(l.libelle) + '" placeholder="Libellé — tapez pour chercher" autocomplete="off"></td>' +
      '<td><input class="form-control gderpi-devis-line-unite" type="text" value="' + esc(l.unite) + '"></td>' +
      '<td><input class="form-control gderpi-devis-line-qty text-end" type="number" min="0.01" step="0.01" value="' + esc(l.quantite) + '"></td>' +
      '<td><input class="form-control gderpi-devis-line-prix text-end" type="number" min="0" step="0.01" value="' + esc(l.prixHt) + '"></td>' +
      '<td><input class="form-control gderpi-devis-line-rem text-end" type="number" min="0" max="100" step="0.1" value="' + esc(l.remisePct) + '"></td>' +
      '<td><input class="form-control gderpi-devis-line-tva text-end" type="number" min="0" step="0.1" value="' + esc(l.tauxTva) + '"></td>' +
      '<td class="text-end gderpi-devis-line-amount">' + fmt(l.montantHt) + '</td>' +
      '<td><button type="button" class="btn btn-outline-danger btn-sm gderpi-cmd-frs-line-remove" title="Supprimer">×</button></td>' +
      '</tr>' + renderLineDescriptionBlock(l, idx, true);
  }

  function readLineFromDom(idx, row) {
    const detailRow = row.nextElementSibling?.matches('[data-cmd-frs-line-detail-idx]')
      ? row.nextElementSibling
      : document.querySelector('[data-cmd-frs-line-detail-idx="' + idx + '"]');
    const refFrs = row.querySelector('.gderpi-devis-line-ref-frs')?.value?.trim() || '';
    return calcLineTotals({
      ...lines[idx],
      reference: row.querySelector('.gderpi-devis-line-ref')?.value?.trim() || '',
      referenceFournisseur: refFrs,
      referenceClient: refFrs,
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
    const tbody = document.getElementById('gderpi-cmd-frs-lines-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('[data-cmd-frs-line-idx]').forEach((row) => {
      const idx = Number(row.getAttribute('data-cmd-frs-line-idx'));
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
    const cell = row.querySelector('.gderpi-devis-line-amount');
    if (cell) cell.textContent = fmt(calcLineTotals(lines[idx]).montantHt);
    renderTotals();
  }

  function applyArticleToLine(idx, article) {
    lines[idx] = articleFromCatalog(article);
    markDirty();
    ensureTrailingEmptyLine();
    renderLines();
    const row = document.querySelector('[data-cmd-frs-line-idx="' + idx + '"]');
    const qty = row?.querySelector('.gderpi-devis-line-qty');
    if (qty) { qty.focus(); qty.select(); }
  }

  function bindEditableRows() {
    destroyLineBindings();
    const tbody = document.getElementById('gderpi-cmd-frs-lines-tbody');
    if (!tbody) return;

    tbody.querySelectorAll('[data-cmd-frs-line-idx]').forEach((row) => {
      const idx = Number(row.getAttribute('data-cmd-frs-line-idx'));
      const refInput = row.querySelector('.gderpi-devis-line-ref');
      const libInput = row.querySelector('.gderpi-devis-line-libelle');
      const searchOpts = {
        getArticles: () => articlesForSearch(),
        onSelect: (article) => applyArticleToLine(idx, article),
        onInput: (value) => {
          const merged = readLineFromDom(idx, row);
          lines[idx] = {
            ...merged,
            reference: refInput === document.activeElement ? value : merged.reference,
            libelle: libInput === document.activeElement ? value : merged.libelle,
            articleId: null,
            articleType: 'produit'
          };
        }
      };
      if (refInput) lineSearchBindings.push(bindSearch(refInput, searchOpts));
      if (libInput) lineSearchBindings.push(bindSearch(libInput, searchOpts));

      row.querySelectorAll('.gderpi-devis-line-qty, .gderpi-devis-line-prix, .gderpi-devis-line-rem, .gderpi-devis-line-tva, .gderpi-devis-line-unite, .gderpi-devis-line-ref-frs').forEach((inp) => {
        inp.addEventListener('input', () => syncLineFromRow(idx, row));
      });

      const detailRow = row.nextElementSibling?.matches('[data-cmd-frs-line-detail-idx]') ? row.nextElementSibling : null;
      detailRow?.querySelector('.gderpi-devis-line-description')?.addEventListener('input', () => syncLineFromRow(idx, row));

      row.querySelector('.gderpi-cmd-frs-line-remove')?.addEventListener('click', () => {
        lines.splice(idx, 1);
        markDirty();
        ensureTrailingEmptyLine();
        renderLines();
      });
    });
  }

  function renderLines() {
    const tbody = document.getElementById('gderpi-cmd-frs-lines-tbody');
    if (!tbody) return;
    const editable = isEditable();
    renderLinesTableHead();
    tbody.innerHTML = lines.map((l, idx) => {
      const line = calcLineTotals(l);
      return editable ? renderEditableLine(line, idx) : renderReadonlyLine(line, idx);
    }).join('');
    if (editable) bindEditableRows();
    renderTotals();
  }

  function renderTotals() {
    const totals = calcDocTotals();
    renderFraisPortRow();
    const ht = document.getElementById('gderpi-cmd-frs-total-ht');
    const tva = document.getElementById('gderpi-cmd-frs-total-tva');
    const ttc = document.getElementById('gderpi-cmd-frs-total-ttc');
    if (ht) ht.textContent = fmt(totals.totalHt);
    if (tva) tva.textContent = fmt(totals.totalTva);
    if (ttc) ttc.textContent = fmt(totals.totalTtc);
  }

  function collectPayload() {
    syncAllLinesFromDom();
    const filledLines = lines.filter((l) => !isLineEmpty(l)).map(calcLineTotals);
    const frais = getFraisPortFromDom();
    const payload = {
      objet: document.getElementById('gderpi-cmd-frs-objet')?.value?.trim() || '',
      notes: document.getElementById('gderpi-cmd-frs-notes')?.value?.trim() || '',
      fraisPortHt: frais.fraisPortHt,
      fraisPortTauxTva: frais.fraisPortTauxTva,
      lignes: filledLines
    };
    if (mode === 'create') {
      const supplier = parseSupplierKey(
        document.getElementById('gderpi-cmd-frs-fournisseur-select')?.value || draftSupplierKey
      );
      payload.boutiqueId = document.getElementById('gderpi-cmd-frs-boutique')?.value?.trim() || '';
      payload.fournisseurId = supplier.fournisseurId;
      payload.fournisseurBoutiqueId = supplier.fournisseurBoutiqueId;
      payload.origine = createOrigine === 'stock' ? 'stock' : 'manuel';
    } else if (canEditSupplier()) {
      const supplier = parseSupplierKey(
        document.getElementById('gderpi-cmd-frs-fournisseur-select')?.value || draftSupplierKey
      );
      payload.fournisseurId = supplier.fournisseurId;
      payload.fournisseurBoutiqueId = supplier.fournisseurBoutiqueId;
    }
    return payload;
  }

  async function save() {
    const payload = collectPayload();
    if (!payload.lignes.length) {
      global.GderpiStatus.showStatus('Ajoutez au moins une ligne.', 'warning');
      return;
    }

    if (mode === 'create') {
      if (!payload.boutiqueId) {
        global.GderpiStatus.showStatus('Boutique émettrice requise.', 'warning');
        return;
      }
      if (!payload.fournisseurId && !payload.fournisseurBoutiqueId) {
        global.GderpiStatus.showStatus('Sélectionnez un fournisseur.', 'warning');
        return;
      }
      const res = await global.GderpiApi.apiCall('/commandes-fournisseur', {
        method: 'POST',
        body: JSON.stringify(payload),
        loadingMessage: 'Création de la commande…'
      });
      const created = res.data;
      global.GderpiStatus.showStatus('Commande ' + (created?.numero || '') + ' créée.', 'success');
      mode = 'edit';
      createOrigine = '';
      draftSupplierKey = '';
      editingId = created?.commandeFournisseurId || created?.id || '';
      await reloadCommande(editingId);
      global.GderpiAchatsTab?.refreshAchatsList?.();
      return;
    }

    if (canEditSupplier() && !payload.fournisseurId && !payload.fournisseurBoutiqueId) {
      global.GderpiStatus.showStatus('Sélectionnez un fournisseur.', 'warning');
      return;
    }

    const res = await global.GderpiApi.apiCall(
      '/commandes-fournisseur/' + encodeURIComponent(editingId),
      { method: 'PUT', body: JSON.stringify(payload), loadingMessage: 'Enregistrement…' }
    );
    isDirty = false;
    currentCommande = res.data;
    lines = (currentCommande?.lignes || []).map(cloneLine);
    if (isEditable()) ensureTrailingEmptyLine();
    syncFraisPortFields({ resetValues: true });
    renderHeader();
    renderLines();
    global.GderpiStatus.showStatus('Commande fournisseur enregistrée.', 'success');
    global.GderpiAchatsTab?.refreshAchatsList?.();
  }

  function openEditor() {
    ensureEditorModal()?.open?.();
    renderHeader();
    renderLines();
  }

  function closeEditor() {
    destroyLineBindings();
    editorModal?.close?.();
    mode = 'edit';
    createOrigine = '';
    draftSupplierKey = '';
    editingId = '';
    currentCommande = null;
    linkedCommandeClient = null;
    lines = [];
    isDirty = false;
    const objetEl = document.getElementById('gderpi-cmd-frs-objet');
    if (objetEl) objetEl.value = '';
    const notesEl = document.getElementById('gderpi-cmd-frs-notes');
    if (notesEl) notesEl.value = '';
    const fraisHtEl = document.getElementById('gderpi-cmd-frs-frais-port-ht');
    if (fraisHtEl) fraisHtEl.value = '';
    const fraisTvaEl = document.getElementById('gderpi-cmd-frs-frais-port-tva');
    if (fraisTvaEl) fraisTvaEl.value = 20;
  }

  async function openNewCommande(options) {
    const opts = options && typeof options === 'object' ? options : {};
    mode = 'create';
    createOrigine = opts.origine === 'stock' ? 'stock' : 'manuel';
    draftSupplierKey = '';
    editingId = '';
    currentCommande = null;
    linkedCommandeClient = null;
    isDirty = false;
    lines = [emptyLine()];
    ensureTrailingEmptyLine();

    ensureEditorModal();
    cmdFrsEl('gderpi-cmd-frs-create-fields')?.removeAttribute('hidden');
    cmdFrsEl('gderpi-cmd-frs-supplier-wrap')?.removeAttribute('hidden');
    cmdFrsEl('gderpi-cmd-frs-fournisseur-display-wrap')?.setAttribute('hidden', '');
    setCreateSelectsLoading();

    try {
      await ensureTierRefs({ force: true, silent: false });
    } catch (err) {
      handleErr(err);
    }
    populateCreateSelects();

    const objetEl = cmdFrsEl('gderpi-cmd-frs-objet');
    if (objetEl) {
      objetEl.value = createOrigine === 'stock' ? 'Réapprovisionnement stock' : '';
    }
    const notesEl = cmdFrsEl('gderpi-cmd-frs-notes');
    if (notesEl) notesEl.value = '';
    syncFraisPortFields({ resetValues: true });

    openEditor();
    enableCreateSelects();
    ensureArticles().catch(handleErr);
  }

  async function openCommandeFournisseur(commandeFournisseurId) {
    await ensureTierRefs({ force: true });
    const articlesRes = await global.GderpiApi.apiCall('/articles');
    articles = articlesRes.data || [];
    mode = 'edit';
    createOrigine = '';
    draftSupplierKey = '';
    editingId = String(commandeFournisseurId || '').trim();
    if (!editingId) throw new Error('Identifiant requis');
    await reloadCommande(editingId);
    openEditor();
  }

  function bindCommandeFournisseurEditor() {
    ensureEditorModal();
    cmdFrsEl('gderpi-cmd-frs-create-fields')?.setAttribute('hidden', '');
    cmdFrsEl('gderpi-cmd-frs-supplier-wrap')?.setAttribute('hidden', '');
    const root = editorModal?.root || cmdFrsEl('gderpi-cmd-frs-editor');
    if (root && !root.dataset.cmdFrsEditorBound) {
      root.dataset.cmdFrsEditorBound = '1';
      root.addEventListener('input', (ev) => {
        const id = ev.target?.id;
        if (id === 'gderpi-cmd-frs-objet' || id === 'gderpi-cmd-frs-notes') markDirty();
      });
      root.addEventListener('change', (ev) => {
        const id = ev.target?.id;
        if (id === 'gderpi-cmd-frs-fournisseur-select') {
          draftSupplierKey = ev.target?.value || '';
          markDirty();
          renderLinesHint();
          if (mode === 'edit') {
            lines = lines.map((l) => {
              if (isLineEmpty(l) || !l.articleId) return l;
              const catalog = articles.find((a) => String(a.articleId || a.id) === String(l.articleId));
              if (!catalog) return l;
              const mapped = articleFromCatalog(catalog);
              return calcLineTotals({
                ...l,
                referenceFournisseur: mapped.referenceFournisseur,
                referenceClient: mapped.referenceFournisseur,
                prixHt: mapped.prixHt,
                fournisseurId: mapped.fournisseurId,
                boutiqueFournisseurId: mapped.boutiqueFournisseurId
              });
            });
          }
          renderLines();
        } else if (id === 'gderpi-cmd-frs-boutique') {
          markDirty();
        }
      });
    }
    ensureTierRefs({ silent: true })
      .then(() => populateCreateSelects())
      .catch(() => {});
  }

  function bindAchatsCreateButtons() {
    document.getElementById('gderpi-achats-new-stock')?.addEventListener('click', () => {
      openNewCommande({ origine: 'stock' }).catch(handleErr);
    });
    document.getElementById('gderpi-achats-new-manual')?.addEventListener('click', () => {
      openNewCommande({ origine: 'manuel' }).catch(handleErr);
    });
  }

  function handleErr(err) {
    global.GderpiStatus.showStatus(err?.message || 'Erreur commande fournisseur', 'danger');
  }

  global.GderpiCommandeFournisseurEditor = {
    bindCommandeFournisseurEditor,
    bindAchatsCreateButtons,
    openCommandeFournisseur,
    openNewStockCommande: () => openNewCommande({ origine: 'stock' }),
    openNewCommande,
    reloadCommande: (id) => reloadCommande(id || editingId)
  };
})(window);
