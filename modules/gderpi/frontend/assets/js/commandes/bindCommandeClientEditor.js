/**
 * FICHIER : modules/gderpi/frontend/assets/js/commandes/bindCommandeClientEditor.js
 * RÔLE : Éditeur commande client — création depuis devis ou modification.
 */

(function initGderpiBindCommandeClientEditor(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const fmt = (v) => global.GderpiFormat.formatMoney(v);
  const bindSearch = (input, opts) => global.GderpiBindArticleSearch.bindArticleSearchField(input, opts);
  const canWrite = () => global.GDERPI_CONFIG?.canWrite === true;

  let articles = [];
  let clients = [];
  let lines = [];
  let lineSearchBindings = [];
  let editorModal = null;
  let mode = '';
  let sourceDevisId = '';
  let sourceDevis = null;
  let editingId = '';
  let currentCommande = null;
  let isDirty = false;

  function emptyLine() {
    return {
      articleId: null,
      articleType: '',
      reference: '',
      referenceClient: '',
      libelle: '',
      description: '',
      unite: 'piece',
      quantite: 1,
      prixHt: 0,
      remisePct: 0,
      tauxTva: 20,
      fournisseurId: null,
      prixSurDevis: false
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
    return ['validee_client', 'a_valider_gdri', 'validee_gdri', 'confirmee', 'en_cours'].includes(s);
  }

  function renderEditorActions() {
    const actions = document.getElementById('gderpi-cmd-client-actions');
    if (!actions) return;

    let html = '<button type="button" class="btn btn-outline btn-sm" id="gderpi-cmd-client-cancel">Fermer</button>';

    if (editingId) {
      html += ' <button type="button" class="btn btn-outline btn-sm" id="gderpi-cmd-client-pdf">PDF</button>';
      html += ' <button type="button" class="btn btn-outline btn-sm" id="gderpi-cmd-client-html">Aperçu HTML</button>';
    }

    if (isEditable()) {
      html += ' <button type="button" class="btn btn-primary btn-sm" id="gderpi-cmd-client-save">' +
        (mode === 'create' ? 'Créer la commande' : 'Enregistrer') + '</button>';
    }

    actions.innerHTML = html;
    actions.querySelector('#gderpi-cmd-client-cancel')?.addEventListener('click', closeEditor);
    actions.querySelector('#gderpi-cmd-client-save')?.addEventListener('click', () => save().catch(handleErr));
    actions.querySelector('#gderpi-cmd-client-pdf')?.addEventListener('click', () => {
      if (!editingId) return;
      global.GderpiCommandeClientHelpers.downloadCommandeClientPdf(editingId).catch(handleErr);
    });
    actions.querySelector('#gderpi-cmd-client-html')?.addEventListener('click', () => {
      if (!editingId) return;
      global.GderpiCommandeClientHelpers.previewCommandeClientHtml(editingId).catch(handleErr);
    });
  }

  function isDevLine(l) {
    return String(l?.articleType || '').toLowerCase() === 'developpement';
  }

  function calcLineTotals(line) {
    const qty = Number(line.quantite) || 0;
    const prix = Number(line.prixHt) || 0;
    const rem = Number(line.remisePct) || 0;
    const ht = Math.round(qty * prix * (1 - rem / 100) * 100) / 100;
    return { ...line, montantHt: ht };
  }

  function calcDocTotals() {
    let totalHt = 0;
    let totalTva = 0;
    lines.filter((l) => !isLineEmpty(l)).forEach((l) => {
      const line = calcLineTotals(l);
      totalHt += line.montantHt;
      totalTva += line.montantHt * (Number(line.tauxTva) || 0) / 100;
    });
    totalHt = Math.round(totalHt * 100) / 100;
    totalTva = Math.round(totalTva * 100) / 100;
    return { totalHt, totalTva, totalTtc: Math.round((totalHt + totalTva) * 100) / 100 };
  }

  const H = () => global.GderpiCommandeClientHelpers;

  function refreshCommandeLists() {
    global.GderpiCommandesClientTab?.refreshCommandesList?.();
    global.GderpiFacturationTab?.refreshFacturationList?.();
  }

  function renderWorkflowStrip() {
    const wrap = document.getElementById('gderpi-cmd-client-workflow-wrap');
    const el = document.getElementById('gderpi-cmd-client-workflow');
    if (!wrap || !el) return;

    if (mode !== 'edit' || !currentCommande) {
      wrap.hidden = true;
      return;
    }

    const wf = global.GderpiCommandeClientWorkflow;
    const id = editingId;
    wrap.hidden = false;
    el.innerHTML = wf.renderEditorWorkflow(currentCommande, esc, canWrite());

    wf.bindDropdownToggles(el);

    const actionsSel = el.querySelector('.gderpi-cmd-actions-select');
    const modalWorkflowActions = new Set([
      'facture_partiel', 'bl_partiel', 'reception_partiel', 'avancement_partiel', 'recette_partiel'
    ]);
    wf.bindActionsSelect(actionsSel, currentCommande, async (action) => {
      const tab = global.GderpiCommandesClientTab;
      if (!tab?.runWorkflowAction) {
        global.GderpiStatus.showStatus('Actions commande indisponibles.', 'danger');
        return;
      }
      await tab.runWorkflowAction(currentCommande, action);
      if (!modalWorkflowActions.has(action)) {
        await reloadCommande(id);
        refreshCommandeLists();
      }
    });
  }

  async function workflowSetStatus(id, statut) {
    const res = await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id) + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ statut })
    });
    await reloadCommande(id);
    global.GderpiStatus.showStatus('Statut mis à jour.', 'success');
    refreshCommandeLists();
  }

  async function reloadCommande(id) {
    const res = await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id));
    currentCommande = res.data;
    renderHeader();
    renderWorkflowStrip();
  }

  function goToCommandes(commandeId) {
    global.GderpiAppNav?.('commandes');
    global.GderpiCommandesClientTab?.openList?.({ highlightId: commandeId, actives: true });
  }

  function clientLabel(id) {
    const c = clients.find((x) => String(x.clientId || x.id) === String(id));
    if (!c) return id || '—';
    return c.displayName || c.raisonSociale || [c.prenom, c.nom].filter(Boolean).join(' ') || id;
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

  function cloneLineFromDevis(line) {
    return calcLineTotals({
      articleId: line.articleId || null,
      articleType: line.articleType || '',
      reference: line.reference || '',
      referenceClient: line.referenceClient || '',
      libelle: line.libelle || '',
      description: line.description || '',
      unite: line.unite || 'piece',
      quantite: line.quantite ?? 1,
      prixHt: line.prixHt ?? 0,
      remisePct: line.remisePct ?? 0,
      tauxTva: line.tauxTva ?? 20,
      fournisseurId: line.fournisseurId || null,
      prixSurDevis: line.prixSurDevis === true
    });
  }

  function articleFromCatalog(a) {
    const clientId = sourceDevis?.clientId || currentCommande?.clientId || '';
    const tarif = global.GderpiArticleTarif?.resolveArticleTarifClient
      ? global.GderpiArticleTarif.resolveArticleTarifClient(a, clientId)
      : null;
    const prixSurDevis = tarif
      ? tarif.prixSurDevis === true
      : (a.prixSurDevis === true || a.type === 'developpement');
    return calcLineTotals({
      articleId: a.articleId || a.id,
      articleType: a.type || '',
      reference: a.reference || '',
      referenceClient: tarif?.reference || '',
      libelle: a.libelle || a.nom || '',
      description: a.description || '',
      unite: a.unite || 'piece',
      quantite: 1,
      prixHt: prixSurDevis ? 0 : (tarif ? Number(tarif.prixHt) || 0 : (Number(a.prixHt) || 0)),
      remisePct: 0,
      tauxTva: a.tauxTva ?? 20,
      fournisseurId: a.fournisseurId || null,
      boutiqueFournisseurId: a.boutiqueFournisseurId || null,
      prixSurDevis
    });
  }

  async function ensureRefs() {
    const [articlesRes, clientsRes] = await Promise.all([
      global.GderpiApi.apiCall('/articles'),
      global.GderpiApi.apiCall('/clients')
    ]);
    articles = articlesRes.data || [];
    clients = clientsRes.data || [];
  }

  function ensureEditorModal() {
    if (editorModal) return editorModal;
    const el = document.getElementById('gderpi-cmd-client-editor');
    if (!el || !global.GderpiModal) return null;
    editorModal = global.GderpiModal.enhance(el, {
      size: 'xl',
      variant: 'devis',
      stacked: true,
      hideHeader: true,
      onBackdrop: () => closeEditor()
    });
    return editorModal;
  }

  function renderDevisLink() {
    const wrap = document.getElementById('gderpi-cmd-client-devis-link');
    if (!wrap) return;
    const devisId = sourceDevisId || currentCommande?.devisId;
    const devisNumero = sourceDevis?.numero || currentCommande?.devisNumero;
    if (!devisId || !devisNumero) {
      wrap.innerHTML = '<span class="text-muted">—</span>';
      return;
    }
    wrap.innerHTML = '<button type="button" class="btn btn-link btn-sm p-0 gderpi-cmd-open-devis" data-devis-id="' +
      esc(devisId) + '">' + esc(devisNumero) + '</button>';
    wrap.querySelector('.gderpi-cmd-open-devis')?.addEventListener('click', () => {
      closeEditor();
      global.GderpiAppNav?.('devis');
      global.GderpiDevisTab?.openDevis?.(devisId);
    });
  }

  function renderHeader() {
    const title = document.getElementById('gderpi-cmd-client-title');
    const subtitle = document.getElementById('gderpi-cmd-client-subtitle');
    if (mode === 'create') {
      if (title) title.textContent = 'Nouvelle commande client';
      if (subtitle) subtitle.textContent = sourceDevis?.numero
        ? 'À partir du devis ' + sourceDevis.numero
        : '';
    } else {
      if (title) title.textContent = 'Commande ' + (currentCommande?.numero || '');
      if (subtitle) subtitle.textContent = currentCommande?.objet || '';
    }
    renderDevisLink();
    renderWorkflowStrip();

    const clientEl = document.getElementById('gderpi-cmd-client-client');
    const clientId = sourceDevis?.clientId || currentCommande?.clientId;
    if (clientEl) clientEl.textContent = clientLabel(clientId);

    const docEl = document.getElementById('gderpi-cmd-client-document');
    if (docEl) {
      const docVal = mode === 'create'
        ? (sourceDevis?.documentClient || sourceDevis?.referenceClient || '')
        : (currentCommande?.documentClient || '');
      docEl.textContent = docVal || '—';
    }

    const refEl = document.getElementById('gderpi-cmd-client-reference');
    if (refEl) {
      refEl.value = mode === 'create'
        ? ''
        : (currentCommande?.referenceClient || '');
      refEl.disabled = !isEditable();
    }

    const objetEl = document.getElementById('gderpi-cmd-client-objet');
    if (objetEl) {
      objetEl.value = mode === 'create' ? (sourceDevis?.objet || '') : (currentCommande?.objet || '');
      objetEl.disabled = !isEditable();
    }

    const notesEl = document.getElementById('gderpi-cmd-client-notes');
    if (notesEl) {
      notesEl.value = mode === 'create' ? (sourceDevis?.notes || '') : (currentCommande?.notes || '');
      notesEl.disabled = !isEditable();
    }

    const expiredWarn = document.getElementById('gderpi-cmd-client-expired-warn');
    if (expiredWarn) {
      const dv = sourceDevis?.dateValidite;
      let show = false;
      if (mode === 'create' && dv) {
        const expiry = new Date(dv);
        show = !Number.isNaN(expiry.getTime()) && expiry < new Date();
      }
      expiredWarn.hidden = !show;
    }

    renderEditorActions();
  }

  function readLineFromDom(idx, row) {
    const detailRow = row.nextElementSibling?.matches('[data-cmd-line-detail-idx]')
      ? row.nextElementSibling
      : document.querySelector('[data-cmd-line-detail-idx="' + idx + '"]');
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
    const tbody = document.getElementById('gderpi-cmd-client-lines-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('[data-cmd-line-idx]').forEach((row) => {
      const idx = Number(row.getAttribute('data-cmd-line-idx'));
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
    const row = document.querySelector('[data-cmd-line-idx="' + idx + '"]');
    const qty = row?.querySelector('.gderpi-devis-line-qty');
    if (qty) { qty.focus(); qty.select(); }
  }

  function linesTableColspan(editable) {
    const showFulfillment = !editable && H().showFulfillmentColumns(currentCommande);
    return showFulfillment ? 14 : 10;
  }

  function renderLineDescriptionBlock(l, idx, editable) {
    if (editable && isLineEmpty(l)) return '';
    const text = String(l.description || '').trim();
    if (!editable && !text) return '';
    const dev = isDevLine(l);
    const label = dev ? 'Description / précisions' : 'Description';
    const rows = dev ? 3 : 2;
    const colspan = linesTableColspan(editable);
    if (!editable) {
      return '<tr class="gderpi-devis-line-detail"><td colspan="' + colspan + '">' +
        '<div class="gderpi-devis-line-desc-read">' + esc(text).replace(/\n/g, '<br>') + '</div></td></tr>';
    }
    return '<tr data-cmd-line-detail-idx="' + idx + '" class="gderpi-devis-line-detail' + (dev ? ' gderpi-devis-line-detail--dev' : '') + '">' +
      '<td colspan="' + colspan + '"><label class="gderpi-devis-line-desc-label">' + esc(label) + '</label>' +
      '<textarea class="form-control gderpi-devis-line-description" rows="' + rows + '">' + esc(l.description || '') + '</textarea></td></tr>';
  }

  function renderReadonlyLine(l, idx) {
    const fulfillment = H().showFulfillmentColumns(currentCommande)
      ? H().lineFulfillmentCells(l, currentCommande, esc)
      : '';
    return '<tr>' +
      '<td>' + esc(l.reference || '—') + '</td>' +
      '<td>' + esc(l.referenceClient || '—') + '</td>' +
      '<td>' + esc(l.libelle) + '</td>' +
      '<td>' + esc(l.unite) + '</td>' +
      '<td class="text-end">' + esc(l.quantite) + '</td>' +
      fulfillment +
      '<td class="text-end">' + fmt(l.prixHt) + '</td>' +
      '<td class="text-end">' + esc(l.remisePct) + '</td>' +
      '<td class="text-end">' + esc(l.tauxTva) + '%</td>' +
      '<td class="text-end">' + fmt(l.montantHt) + '</td>' +
      '<td></td></tr>' + renderLineDescriptionBlock(l, idx, false);
  }

  function renderLinesTableHead(editable) {
    const thead = document.getElementById('gderpi-cmd-client-lines-thead');
    if (!thead) return;
    const showFulfillment = !editable && H().showFulfillmentColumns(currentCommande);
    const fulfillmentHead = showFulfillment
      ? '<th class="text-end">Reçu frs</th><th class="text-end">Livré</th><th class="text-end">Dispo</th><th class="text-end">Reste</th>'
      : '';
    const colspanBase = showFulfillment ? 12 : 8;
    thead.innerHTML = '<tr>' +
      '<th>Réf. interne</th><th>Réf. client</th><th>Libellé</th><th>Unité</th><th class="text-end">Qté</th>' +
      fulfillmentHead +
      '<th class="text-end">Prix HT</th><th class="text-end">Rem.%</th><th class="text-end">TVA</th><th class="text-end">Montant HT</th><th></th></tr>';
    thead.dataset.colspanBase = String(colspanBase);
    const tfoot = document.querySelector('#gderpi-cmd-client-lines-tbody')?.closest('table')?.querySelector('tfoot');
    if (tfoot) {
      tfoot.querySelectorAll('tr').forEach((row) => {
        const labelCell = row.querySelector('td[colspan]');
        if (labelCell) labelCell.colSpan = colspanBase;
      });
    }
  }

  function renderEditableLine(l, idx) {
    if (isLineEmpty(l)) {
      return '<tr data-cmd-line-idx="' + idx + '" class="gderpi-devis-line-main gderpi-devis-line--draft">' +
        '<td><input class="form-control gderpi-devis-line-ref" type="text" value="' + esc(l.reference) + '" placeholder="Réf. interne" autocomplete="off"></td>' +
        '<td><input class="form-control gderpi-devis-line-ref-client" type="text" value="' + esc(l.referenceClient) + '" placeholder="Réf. client" autocomplete="off"></td>' +
        '<td colspan="7"><input class="form-control gderpi-devis-line-libelle gderpi-devis-line-libelle--draft" type="text" value="' + esc(l.libelle) + '" placeholder="Libellé — tapez pour chercher" autocomplete="off"></td>' +
        '</tr>';
    }
    const prixRequired = l.prixSurDevis ? ' required' : '';
    return '<tr data-cmd-line-idx="' + idx + '" class="gderpi-devis-line-main">' +
      '<td><input class="form-control gderpi-devis-line-ref" type="text" value="' + esc(l.reference) + '" autocomplete="off"></td>' +
      '<td><input class="form-control gderpi-devis-line-ref-client" type="text" value="' + esc(l.referenceClient) + '" autocomplete="off"></td>' +
      '<td><input class="form-control gderpi-devis-line-libelle" type="text" value="' + esc(l.libelle) + '" placeholder="Libellé — tapez pour chercher" autocomplete="off"></td>' +
      '<td><input class="form-control gderpi-devis-line-unite" type="text" value="' + esc(l.unite) + '"></td>' +
      '<td><input class="form-control gderpi-devis-line-qty text-end" type="number" min="0.01" step="0.01" value="' + esc(l.quantite) + '"></td>' +
      '<td><input class="form-control gderpi-devis-line-prix text-end" type="number" min="0" step="0.01" value="' + esc(l.prixHt) + '"' + prixRequired + '></td>' +
      '<td><input class="form-control gderpi-devis-line-rem text-end" type="number" min="0" max="100" step="0.1" value="' + esc(l.remisePct) + '"></td>' +
      '<td><input class="form-control gderpi-devis-line-tva text-end" type="number" min="0" step="0.1" value="' + esc(l.tauxTva) + '"></td>' +
      '<td class="text-end gderpi-devis-line-amount">' + fmt(l.montantHt) + '</td>' +
      '<td><button type="button" class="btn btn-outline-danger btn-sm gderpi-cmd-line-remove" title="Supprimer">×</button></td>' +
      '</tr>' + renderLineDescriptionBlock(l, idx, true);
  }

  function bindEditableRows() {
    destroyLineBindings();
    const tbody = document.getElementById('gderpi-cmd-client-lines-tbody');
    if (!tbody) return;

    tbody.querySelectorAll('[data-cmd-line-idx]').forEach((row) => {
      const idx = Number(row.getAttribute('data-cmd-line-idx'));
      const refInput = row.querySelector('.gderpi-devis-line-ref');
      const libInput = row.querySelector('.gderpi-devis-line-libelle');
      const searchOpts = {
        getArticles: () => articles,
        onSelect: (article) => applyArticleToLine(idx, article),
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

      const detailRow = row.nextElementSibling?.matches('[data-cmd-line-detail-idx]') ? row.nextElementSibling : null;
      detailRow?.querySelector('.gderpi-devis-line-description')?.addEventListener('input', () => syncLineFromRow(idx, row));

      row.querySelector('.gderpi-cmd-line-remove')?.addEventListener('click', () => {
        lines.splice(idx, 1);
        markDirty();
        ensureTrailingEmptyLine();
        renderLines();
      });
    });
  }

  function renderLines() {
    const tbody = document.getElementById('gderpi-cmd-client-lines-tbody');
    if (!tbody) return;
    const editable = isEditable();
    renderLinesTableHead(editable);
    tbody.innerHTML = lines.map((l, idx) => {
      const line = calcLineTotals(l);
      return editable ? renderEditableLine(line, idx) : renderReadonlyLine(line, idx);
    }).join('');
    if (editable) bindEditableRows();
    renderTotals();
  }

  function renderTotals() {
    const totals = calcDocTotals();
    const ht = document.getElementById('gderpi-cmd-client-total-ht');
    const tva = document.getElementById('gderpi-cmd-client-total-tva');
    const ttc = document.getElementById('gderpi-cmd-client-total-ttc');
    if (ht) ht.textContent = fmt(totals.totalHt);
    if (tva) tva.textContent = fmt(totals.totalTva);
    if (ttc) ttc.textContent = fmt(totals.totalTtc);
  }

  function collectPayload() {
    syncAllLinesFromDom();
    const filledLines = lines.filter((l) => !isLineEmpty(l)).map(calcLineTotals);
    return {
      referenceClient: document.getElementById('gderpi-cmd-client-reference')?.value?.trim() || '',
      objet: document.getElementById('gderpi-cmd-client-objet')?.value?.trim() || '',
      notes: document.getElementById('gderpi-cmd-client-notes')?.value?.trim() || '',
      lignes: filledLines
    };
  }

  function isDevisExpired(devis) {
    if (!devis?.dateValidite) return false;
    const expiry = new Date(devis.dateValidite);
    return !Number.isNaN(expiry.getTime()) && expiry < new Date();
  }

  async function save() {
    const payload = collectPayload();
    if (!payload.lignes.length) {
      global.GderpiStatus.showStatus('Ajoutez au moins une ligne.', 'warning');
      return;
    }

    if (mode === 'create') {
      if (isDevisExpired(sourceDevis)) payload.allowExpired = true;
      const res = await global.GderpiApi.apiCall(
        '/devis/' + encodeURIComponent(sourceDevisId) + '/to-commande-client',
        { method: 'POST', body: JSON.stringify(payload) }
      );
      let msg = 'Commande client ' + (res.data?.numero || '') + ' créée.';
      if (res.data?.modifieeParClient) {
        msg += ' Modifiée par le client — validation GDRI requise.';
      } else if (res.data?.statut === 'a_livrer') {
        msg += ' Prête à livrer.';
      } else if (res.data?.bloquantGdri === 'achats_a_generer' || res.data?.bloquantGdri === 'achats_a_valider') {
        msg += ' Commandes fournisseur en brouillon — vérifiez-les dans Achats.';
      } else if (res.data?.statut === 'validee_gdri') {
        msg += ' Validée GDRI.';
      }
      global.GderpiStatus.showStatus(msg, 'success');
      const cmdId = res.data?.commandeClientId || res.data?.id;
      closeEditor();
      global.GderpiDevisTab?.refreshDevisList?.();
      if (cmdId) goToCommandes(cmdId);
      else refreshCommandeLists();
      return;
    }

    const res = await global.GderpiApi.apiCall(
      '/commandes-client/' + encodeURIComponent(editingId),
      { method: 'PUT', body: JSON.stringify(payload) }
    );
    isDirty = false;
    currentCommande = res.data;
    renderHeader();
    renderLines();
    global.GderpiStatus.showStatus('Commande enregistrée.', 'success');
    refreshCommandeLists();
  }

  function openEditor() {
    ensureEditorModal()?.open?.();
    renderHeader();
    renderLines();
  }

  function closeEditor() {
    destroyLineBindings();
    editorModal?.close?.();
    mode = '';
    sourceDevisId = '';
    sourceDevis = null;
    editingId = '';
    currentCommande = null;
    lines = [];
    isDirty = false;
  }

  async function autoCreateFromDevis(devisId, devis) {
    const d = devis || (await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(devisId))).data;
    if (!d) throw new Error('Devis introuvable');
    if (d.statut !== 'accepte') throw new Error('Le devis doit être accepté');
    if (d.commandeClientId) return { commandeClientId: d.commandeClientId, id: d.commandeClientId, alreadyExists: true };

    const payload = {
      referenceClient: '',
      objet: d.objet || '',
      notes: d.notes || '',
      lignes: d.lignes || []
    };
    if (isDevisExpired(d)) payload.allowExpired = true;

    const res = await global.GderpiApi.apiCall(
      '/devis/' + encodeURIComponent(devisId) + '/to-commande-client',
      { method: 'POST', body: JSON.stringify(payload) }
    );
    return res.data;
  }

  async function openFromDevis(devisId) {
    await ensureRefs();
    const res = await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(devisId));
    const devis = res.data;
    if (!devis) throw new Error('Devis introuvable');
    if (devis.statut !== 'accepte') {
      throw new Error('Le devis doit être accepté');
    }
    if (devis.commandeClientId) {
      await openCommande(devis.commandeClientId);
      return;
    }

    mode = 'create';
    sourceDevisId = devisId;
    sourceDevis = devis;
    editingId = '';
    currentCommande = null;
    isDirty = false;
    lines = (devis.lignes || []).map(cloneLineFromDevis);
    if (!lines.length) lines.push(emptyLine());
    ensureTrailingEmptyLine();
    openEditor();
  }

  async function openCommande(commandeClientId) {
    await ensureRefs();
    const res = await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(commandeClientId));
    const cmd = res.data;
    if (!cmd) throw new Error('Commande introuvable');

    mode = 'edit';
    sourceDevisId = cmd.devisId || '';
    sourceDevis = cmd.devisId ? { numero: cmd.devisNumero, id: cmd.devisId } : null;
    editingId = commandeClientId;
    currentCommande = cmd;
    isDirty = false;
    lines = (cmd.lignes || []).map(cloneLineFromDevis);
    if (isEditable()) ensureTrailingEmptyLine();
    openEditor();
  }

  function bindCommandeClientEditor() {
    ensureEditorModal();
    document.getElementById('gderpi-cmd-client-reference')?.addEventListener('input', markDirty);
    document.getElementById('gderpi-cmd-client-objet')?.addEventListener('input', markDirty);
    document.getElementById('gderpi-cmd-client-notes')?.addEventListener('input', markDirty);
  }

  function handleErr(err) {
    global.GderpiStatus.showStatus(err.message || 'Erreur commande client', 'danger');
  }

  global.GderpiCommandeClientEditor = {
    bindCommandeClientEditor,
    autoCreateFromDevis,
    openFromDevis,
    openCommande,
    reloadCommande
  };
})(window);
