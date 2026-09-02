/**
 * FICHIER : modules/gderpi/frontend/assets/js/facturation/bindFacturationTab.js
 * RÔLE : Onglet facturation client — factures émises, suivi paiement, PDF et e-mail.
 */

(function initGderpiBindFacturationTab(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const fmt = (v) => global.GderpiFormat.formatMoney(v);
  const fmtDate = (v) => global.GderpiFormat.formatDate(v);
  const H = () => global.GderpiCommandeClientHelpers;
  const canWrite = () => global.GDERPI_CONFIG?.canWrite === true;

  let clients = [];
  let commandes = [];
  let highlightId = '';

  function clientLabel(id) {
    const c = clients.find((x) => String(x.clientId || x.id) === String(id));
    if (!c) return id || '—';
    return c.displayName || c.raisonSociale || [c.prenom, c.nom].filter(Boolean).join(' ') || id;
  }

  function payeBadge(cmd) {
    if (cmd.remboursementEnAttente) {
      return '<span class="gderpi-badge gderpi-badge--remb-attente">Remb. en attente</span>';
    }
    if (cmd.soldeeParAvoir) {
      return '<span class="gderpi-badge gderpi-badge--soldee-avoir">Soldée (avoir)</span>';
    }
    if (cmd.facturePayee) {
      return '<span class="gderpi-badge gderpi-badge--paye">Payée</span>';
    }
    if (cmd.statutPaiement === 'partiellement_creditee') {
      return '<span class="gderpi-badge gderpi-badge--partiel-credit">Part. créditée</span>';
    }
    return '<span class="gderpi-badge gderpi-badge--non-paye">Non payée</span>';
  }

  function canEmitAvoir(cmd) {
    if (cmd.soldeeParAvoir) return false;
    const reste = Number(cmd.resteDuTtc);
    if (Number.isFinite(reste) && reste <= 0.0001 && (Number(cmd.totalAvoirTtc) || 0) > 0) return false;
    return true;
  }

  async function markAvoirRembourse(id, factureId, avoirId) {
    const path = H().avoirApiPath(id, factureId, avoirId, '/rembourse');
    await global.GderpiApi.apiCall(path, {
      method: 'PATCH',
      body: JSON.stringify({ rembourse: true })
    });
    global.GderpiStatus.showStatus('Remboursement enregistré.', 'success');
    await refreshFacturationList();
  }

  async function ensureClients() {
    const res = await global.GderpiApi.apiCall('/clients');
    clients = res.data || [];
  }

  async function downloadFacturePdf(id, factureId) {
    await H().downloadFacturePdf(id, factureId);
  }

  async function previewFactureHtml(id, factureId) {
    await H().previewFactureHtml(id, factureId);
  }

  async function sendFactureToClient(id, email, factureId, payloadOverride) {
    let payload = payloadOverride && typeof payloadOverride === 'object' ? { ...payloadOverride } : {};
    if (!payloadOverride) {
      const modalResult = await global.GderpiSendEmail?.prompt?.({
        title: 'Envoyer la facture',
        description: 'Le client recevra un lien pour consulter et télécharger la facture.',
        recipientContext: { type: 'facture', id }
      });
      if (!modalResult) return null;
      payload = { ...(global.GderpiSendEmail.buildPayload(modalResult) || {}) };
    } else if (email) {
      payload.to = email;
    }
    if (factureId) payload.factureId = factureId;
    const path = H().factureApiPath(id, factureId, '/send');
    try {
      global.GderpiStatus.showStatus('Envoi de la facture…', 'secondary');
      const res = await global.GderpiApi.apiCall(path, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      global.GderpiSendEmailFeedback.notifySendSuccess(res, { label: 'Facture' });
    } catch (err) {
      global.GderpiSendEmailFeedback.notifySendError(err);
    }
  }

  async function sendAvoirToClient(id, factureId, avoirId, email, payloadOverride) {
    let payload = payloadOverride && typeof payloadOverride === 'object' ? { ...payloadOverride } : {};
    if (!payloadOverride) {
      const modalResult = await global.GderpiSendEmail?.prompt?.({
        title: 'Envoyer l\'avoir',
        description: 'Le client recevra un lien pour consulter et télécharger l\'avoir.',
        recipientContext: { type: 'avoir', id }
      });
      if (!modalResult) return null;
      payload = { ...(global.GderpiSendEmail.buildPayload(modalResult) || {}) };
    } else if (email) {
      payload.to = email;
    }
    const path = H().avoirApiPath(id, factureId, avoirId, '/send');
    try {
      global.GderpiStatus.showStatus('Envoi de l\'avoir…', 'secondary');
      const res = await global.GderpiApi.apiCall(path, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      global.GderpiSendEmailFeedback.notifySendSuccess(res, { label: 'Avoir' });
    } catch (err) {
      global.GderpiSendEmailFeedback.notifySendError(err);
    }
  }

  async function togglePayee(id, payee, factureId) {
    const path = H().factureApiPath(id, factureId, '/payee');
    await global.GderpiApi.apiCall(path, {
      method: 'PATCH',
      body: JSON.stringify({ payee })
    });
    global.GderpiStatus.showStatus(payee ? 'Facture marquée comme payée.' : 'Facture marquée comme non payée.', 'success');
    await refreshFacturationList();
  }

  function avoirPayeBadge(avoir) {
    if (avoir.mode === 'remboursement') {
      if (avoir.remboursementStatut === 'rembourse') {
        return '<span class="gderpi-badge gderpi-badge--paye">Remboursé</span>';
      }
      return '<span class="gderpi-badge gderpi-badge--remb-attente">Remb. en attente</span>';
    }
    return '<span class="gderpi-badge gderpi-badge--soldee-avoir">Imputé</span>';
  }

  function buildDisplayGroups(flatList) {
    const byCmd = new Map();
    (flatList || []).forEach((row) => {
      const cmdId = String(row.commandeClientId || row.id || '');
      if (!byCmd.has(cmdId)) byCmd.set(cmdId, []);
      byCmd.get(cmdId).push(row);
    });

    const groups = [...byCmd.entries()].map(([cmdId, rows]) => {
      const factures = rows.slice().sort((a, b) => (Number(a.factureIndex) || 0) - (Number(b.factureIndex) || 0));
      const latest = factures.reduce((max, r) => {
        const t = r.factureDate ? new Date(r.factureDate).getTime() : 0;
        return t > max ? t : max;
      }, 0);
      return { cmdId, factures, latest, sample: factures[0] };
    });

    groups.sort((a, b) => b.latest - a.latest);
    return groups;
  }

  function renderDevisLink(c) {
    if (!c.devisId || !c.devisNumero) return '—';
    return '<button type="button" class="btn btn-link btn-sm p-0 gderpi-fact-devis-link" data-devis-id="' + esc(c.devisId) + '">' + esc(c.devisNumero) + '</button>';
  }

  function buildDisplayRows(flatList) {
    const groups = buildDisplayGroups(flatList);
    const display = [];
    groups.forEach(({ cmdId, factures }) => {
      const multi = factures.length > 1;
      if (multi) {
        display.push({ type: 'cmd-sep', cmdId, row: factures[0], factureCount: factures.length });
      }
      factures.forEach((factRow, idx) => {
        display.push({ type: 'facture', cmdId, row: factRow, multi, firstInGroup: idx === 0 });
        (Array.isArray(factRow.factureAvoirs) ? factRow.factureAvoirs : []).forEach((avoir) => {
          display.push({ type: 'avoir', cmdId, row: factRow, avoir, multi });
        });
      });
    });
    return display;
  }

  function renderFactureRow(entry) {
    const c = entry.row;
    const id = entry.cmdId;
    const factureId = c.factureId || '';
    const factureTtc = c.totalFactureTtc != null ? c.totalFactureTtc : c.totaux?.totalTtc;
    const resteDu = c.resteDuTtc != null ? c.resteDuTtc : factureTtc;
    const hl = String(id) === String(highlightId) ? ' class="gderpi-row-highlight"' : '';
    const positionLabel = c.facturePositionLabel
      ? '<span class="gderpi-fact-position-label">' + esc(c.facturePositionLabel) + '</span>'
      : '';
    const factureLink = c.factureNumero
      ? '<button type="button" class="btn btn-link btn-sm p-0 gderpi-fact-open-link" data-cmd-id="' + esc(id) + '" data-facture-id="' + esc(factureId) + '"><strong>' + esc(c.factureNumero) + '</strong></button>' + positionLabel
      : '—';
    const devisLink = renderDevisLink(c);
    const cmdCell = entry.multi
      ? '<span class="text-muted">' + esc(c.numero) + '</span>'
      : '<button type="button" class="btn btn-link btn-sm p-0 gderpi-fact-cmd-link" data-cmd-id="' + esc(id) + '">' + esc(c.numero) + '</button>';

    return '<tr data-gderpi-fact-row data-cmd-id="' + esc(id) + '" data-facture-id="' + esc(factureId) + '"' + hl + '>' +
      '<td onclick="event.stopPropagation()">' + factureLink + '</td>' +
      '<td>' + fmtDate(c.factureDate) + '</td>' +
      '<td>' + esc(clientLabel(c.clientId)) + '</td>' +
      '<td>' + cmdCell + '</td>' +
      '<td>' + esc(c.documentClient || '—') + '</td>' +
      '<td>' + esc(c.referenceClient || '—') + '</td>' +
      '<td onclick="event.stopPropagation()">' + devisLink + '</td>' +
      '<td>' + payeBadge(c) + '</td>' +
      '<td class="text-end">' + fmt(factureTtc) + '</td>' +
      '<td class="text-end"><strong>' + fmt(resteDu) + '</strong></td>' +
      '<td class="gderpi-cmd-actions-cell" onclick="event.stopPropagation()">' + renderFactureActions(c) + '</td></tr>';
  }

  function renderAvoirRow(entry) {
    const c = entry.row;
    const id = entry.cmdId;
    const factureId = c.factureId || '';
    const avoir = entry.avoir || {};
    const montant = avoir.totaux?.totalTtc;
    return '<tr class="gderpi-fact-row--avoir" data-cmd-id="' + esc(id) + '">' +
      '<td class="gderpi-fact-row__avoir-ref">' +
      '<span class="gderpi-fact-row__indent">↳ Avoir <strong>' + esc(avoir.numero || '—') + '</strong></span>' +
      '<small class="gderpi-fact-row__avoir-sur">sur ' + esc(c.factureNumero || '') + '</small></td>' +
      '<td>' + fmtDate(avoir.date) + '</td>' +
      '<td class="text-muted">—</td>' +
      '<td class="text-muted">' + (entry.multi ? '—' : esc(c.numero)) + '</td>' +
      '<td class="text-muted">—</td><td class="text-muted">—</td><td class="text-muted">—</td>' +
      '<td>' + avoirPayeBadge(avoir) + '</td>' +
      '<td class="text-end">' + fmt(montant) + '</td>' +
      '<td class="text-end text-muted">—</td>' +
      '<td class="gderpi-cmd-actions-cell">' + renderAvoirActions(id, factureId, avoir) + '</td></tr>';
  }

  function renderTableRows(displayRows) {
    return displayRows.map((entry) => {
      if (entry.type === 'cmd-sep') {
        const s = entry.row;
        const id = entry.cmdId;
        return '<tr class="gderpi-fact-row--cmd-sep" data-cmd-id="' + esc(id) + '">' +
          '<td colspan="11">' +
          '<span class="gderpi-fact-row__cmd-label">Commande</span> ' +
          '<button type="button" class="btn btn-link btn-sm p-0 gderpi-fact-cmd-link" data-cmd-id="' + esc(id) + '"><strong>' + esc(s.numero) + '</strong></button>' +
          ' <span class="text-muted">— ' + esc(clientLabel(s.clientId)) + ' · ' + entry.factureCount + ' factures</span>' +
          '</td></tr>';
      }
      if (entry.type === 'avoir') return renderAvoirRow(entry);
      return renderFactureRow(entry);
    }).join('');
  }

  function renderFactureActions(c) {
    const id = c.commandeClientId || c.id;
    const factureId = c.factureId || '';
    const Menu = global.GderpiListActionsMenu;
    if (!Menu) return '';
    const items = [];
    if (canWrite() && !c.soldeeParAvoir) {
      if (c.facturePayee) {
        items.push({ value: 'unpay', label: 'Marquer non payée' });
      } else if (!c.remboursementEnAttente) {
        items.push({ value: 'pay', label: 'Marquer payée', tone: 'success' });
      }
    }
    items.push({ value: 'pdf', label: 'PDF', dividerBefore: items.length > 0 });
    items.push({ value: 'html', label: 'Aperçu' });
    if (canWrite()) items.push({ value: 'email', label: 'E-mail' });
    if (canWrite() && canEmitAvoir(c)) {
      items.push({ value: 'avoir_partiel', label: 'Avoir partiel', dividerBefore: true });
      items.push({ value: 'avoir_total', label: 'Avoir total' });
    }
    if (canWrite() && c.remboursementEnAttente && c.avoirRemboursementEnAttenteId) {
      items.push({
        value: 'rembourse',
        label: 'Remboursé',
        tone: 'success',
        dividerBefore: true,
        attrs: { 'data-avoir-id': c.avoirRemboursementEnAttenteId }
      });
    }
    return Menu.render(items, {
      attrs: {
        'data-kind': 'facture',
        'data-id': id,
        'data-facture-id': factureId,
        'data-facture-numero': c.factureNumero || ''
      }
    });
  }

  function renderAvoirActions(cmdId, factureId, avoir) {
    const Menu = global.GderpiListActionsMenu;
    if (!Menu) return '';
    const avoirId = avoir.id || '';
    const items = [
      { value: 'pdf', label: 'PDF' },
      { value: 'html', label: 'Aperçu' }
    ];
    if (canWrite()) items.push({ value: 'email', label: 'E-mail' });
    if (canWrite() && avoir.mode === 'remboursement' && avoir.remboursementStatut === 'en_attente') {
      items.push({ value: 'rembourse', label: 'Remboursé', tone: 'success', dividerBefore: true });
    }
    return Menu.render(items, {
      attrs: {
        'data-kind': 'avoir',
        'data-id': cmdId,
        'data-facture-id': factureId,
        'data-avoir-id': avoirId
      }
    });
  }

  async function refreshFacturationList() {
    await ensureClients();
    const q = document.getElementById('gderpi-facturation-search')?.value?.trim() || '';
    const payee = document.getElementById('gderpi-facturation-filter-paye')?.value || '';
    const params = new URLSearchParams();
    params.set('facturation', '1');
    if (q) params.set('q', q);
    if (payee === '0' || payee === '1') params.set('payee', payee);

    const res = await global.GderpiApi.apiCall('/commandes-client?' + params.toString());
    commandes = res.data || [];

    const tbody = document.getElementById('gderpi-facturation-tbody');
    const count = document.getElementById('gderpi-facturation-count');
    const displayRows = buildDisplayRows(commandes);
    const factureCount = commandes.length;
    const cmdCount = new Set(displayRows.map((r) => r.cmdId)).size;
    if (count) {
      count.textContent = factureCount + ' facture(s) · ' + cmdCount + ' commande' + (cmdCount > 1 ? 's' : '');
    }
    if (!tbody) return;

    if (!commandes.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="text-muted">Aucune facture émise. Émettez une facture depuis Commandes client.</td></tr>';
      return;
    }

    tbody.innerHTML = renderTableRows(displayRows);
    bindTableEvents(tbody);

    if (highlightId) {
      tbody.querySelector('[data-cmd-id="' + highlightId + '"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      window.setTimeout(() => { highlightId = ''; }, 4000);
    }
  }

  function bindTableEvents(root) {
    root.querySelectorAll('[data-gderpi-fact-row]').forEach((row) => {
      const id = row.getAttribute('data-cmd-id');
      const factureId = row.getAttribute('data-facture-id');
      row.style.cursor = 'pointer';
      row.addEventListener('dblclick', (ev) => {
        if (ev.target.closest('button')) return;
        previewFactureHtml(id, factureId || null).catch(handleErr);
      });
    });
    root.querySelectorAll('.gderpi-fact-open-link').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        previewFactureHtml(btn.getAttribute('data-cmd-id'), btn.getAttribute('data-facture-id') || null).catch(handleErr);
      });
    });
    root.querySelectorAll('.gderpi-fact-cmd-link').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        global.GderpiCommandeClientEditor?.openCommande?.(btn.getAttribute('data-cmd-id')).catch(handleErr);
      });
    });
    root.querySelectorAll('.gderpi-fact-devis-link').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        global.GderpiAppNav?.('devis');
        global.GderpiDevisTab?.openDevis?.(btn.getAttribute('data-devis-id'));
      });
    });
    global.GderpiListActionsMenu?.bind?.(root, async (action, itemEl, menuEl) => {
      const kind = menuEl.getAttribute('data-kind') || 'facture';
      const id = menuEl.getAttribute('data-id') || '';
      const factureId = menuEl.getAttribute('data-facture-id') || null;
      const factureNumero = menuEl.getAttribute('data-facture-numero') || '';
      const avoirId = itemEl.getAttribute('data-avoir-id') || menuEl.getAttribute('data-avoir-id') || '';

      if (kind === 'avoir') {
        if (action === 'pdf') return H().downloadAvoirPdf(id, factureId, avoirId);
        if (action === 'html') return H().previewAvoirHtml(id, factureId, avoirId);
        if (action === 'email') return sendAvoirToClient(id, factureId, avoirId);
        if (action === 'rembourse') {
          if (!confirm('Confirmer le remboursement client ?')) return;
          return markAvoirRembourse(id, factureId, avoirId);
        }
        return;
      }

      if (action === 'pay') return togglePayee(id, true, factureId);
      if (action === 'unpay') return togglePayee(id, false, factureId);
      if (action === 'pdf') return downloadFacturePdf(id, factureId);
      if (action === 'html') return previewFactureHtml(id, factureId);
      if (action === 'email') return sendFactureToClient(id, null, factureId);
      if (action === 'avoir_partiel') {
        return global.GderpiAvoirModal?.openAvoirPartielModal?.(id, factureId, factureNumero);
      }
      if (action === 'avoir_total') {
        return global.GderpiAvoirModal?.createAvoirTotal?.(id, factureId, factureNumero);
      }
      if (action === 'rembourse') {
        if (!confirm('Confirmer le remboursement client ?')) return;
        return markAvoirRembourse(id, factureId, avoirId);
      }
    });
  }

  function openList(opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    const payeeEl = document.getElementById('gderpi-facturation-filter-paye');
    if (payeeEl && (options.payee === '0' || options.payee === '1' || options.payee === '')) {
      payeeEl.value = options.payee;
    }
    if (options.highlightId) highlightId = String(options.highlightId);
    return refreshFacturationList();
  }

  function bindFacturationTab() {
    document.getElementById('gderpi-facturation-filter-paye')?.addEventListener('change', () => refreshFacturationList().catch(handleErr));
    const search = document.getElementById('gderpi-facturation-search');
    if (search) {
      let t;
      search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => refreshFacturationList().catch(handleErr), 200); });
    }
  }

  function handleErr(err) {
    global.GderpiStatus.showStatus(err.message || 'Erreur facturation', 'danger');
  }

  global.GderpiFacturationTab = {
    bindFacturationTab,
    refreshFacturationList,
    openList,
    downloadFacturePdf,
    previewFactureHtml,
    sendFactureToClient,
    sendAvoirToClient
  };
})(window);
