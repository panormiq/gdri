/**
 * FICHIER : modules/gderpi/frontend/assets/js/commandes/commandeClientWorkflow.js
 * RÔLE : Affichage pipeline commande client — statut, colonnes livraison/facturation, actions.
 */

(function initGderpiCommandeClientWorkflow(global) {
  'use strict';

  const H = () => global.GderpiCommandeClientHelpers;
  const fmt = (v) => global.GderpiFormat.formatMoney(v);
  const fmtDate = (v) => global.GderpiFormat.formatDate(v);

  function renderStatutBadge(cmd, esc) {
    const s = String(cmd.statut || 'validee_client');
    let extra = '';
    if (cmd.modifieeParClient && cmd.validationGdriRequise) {
      extra = ' <span class="gderpi-cmd-flag gderpi-cmd-flag--modifiee" title="Modifiée par le client">Modifiée</span>';
    } else if (cmd.conformeAuDevis && s === 'validee_client') {
      extra = ' <span class="gderpi-cmd-flag gderpi-cmd-flag--conforme" title="Conforme au devis">Conforme</span>';
    }
    return '<span class="gderpi-badge-statut gderpi-badge-statut--' + esc(s) + '">' +
      esc(H().statutLabel(s, cmd)) + '</span>' + extra;
  }

  function renderBesoinsMeta(cmd, esc) {
    const besoins = H().besoinsSummary(cmd);
    if (!besoins) return '';
    return '<div class="gderpi-cmd-progress text-muted small">' + esc(besoins) + '</div>';
  }

  function renderToggleButton(cmd, esc, kind, summaryFn) {
    const id = cmd.commandeClientId || cmd.id;
    const summary = summaryFn(cmd);
    if (summary === '—' && kind === 'facturation') {
      return '<span class="text-muted small">—</span>';
    }
    const label = esc(summary === '—' ? 'Détail' : summary);
    const panelId = 'gderpi-cmd-detail-' + kind + '-' + esc(id);
    return '<button type="button" class="btn btn-outline btn-sm gderpi-cmd-dropdown-toggle" ' +
      'data-cmd-id="' + esc(id) + '" data-cmd-detail-kind="' + esc(kind) + '" ' +
      'aria-expanded="false" aria-controls="' + panelId + '">' +
      label + ' <span class="gderpi-cmd-dropdown-caret">▾</span></button>';
  }

  function renderLivraisonPanelContent(cmd, esc) {
    const lines = H().fulfillmentLines(cmd);
    if (!lines.length) {
      return '<p class="text-muted mb-0">Aucune ligne à livrer.</p>';
    }

    let rows = '';
    lines.forEach((line) => {
      const isDev = H().isDevLine(line);
      const ordered = Number(line.quantite) || 0;
      const recue = Number(line.quantiteRecueFrs) || 0;
      const livree = Number(line.quantiteLivree) || 0;
      const reste = isDev ? H().remainingPrestationQty(line) : H().remainingQty(line);
      const title = String(line.libelle || '').trim() || String(line.reference || '').trim() || '—';
      const sub = String(line.libelle || '').trim() && String(line.reference || '').trim()
        ? line.reference
        : '';

      if (isDev) {
        rows += '<tr>' +
          '<td><strong>' + esc(title) + '</strong>' +
          (sub ? '<br><span class="text-muted">' + esc(sub) + '</span>' : '') + '</td>' +
          '<td class="text-end">' + esc(ordered) + '</td>' +
          '<td class="text-end">—</td>' +
          '<td class="text-end">' + esc(livree || '—') + '</td>' +
          '<td class="text-end">' + esc(reste) + '</td>' +
          '<td>' + H().renderLineAchatStatut(line, cmd, esc) + '</td></tr>';
        return;
      }

      rows += '<tr>' +
        '<td><strong>' + esc(title) + '</strong>' +
        (sub ? '<br><span class="text-muted">' + esc(sub) + '</span>' : '') + '</td>' +
        '<td class="text-end">' + esc(ordered) + '</td>' +
        '<td class="text-end">' + esc(recue || '—') + '</td>' +
        '<td class="text-end">' + esc(livree || '—') + '</td>' +
        '<td class="text-end">' + esc(reste) + '</td>' +
        '<td class="gderpi-cmd-achat-cell">' + H().renderLineAchatStatut(line, cmd, esc) + '</td></tr>';
    });

    return '<div class="gderpi-cmd-detail-panel__table-wrap">' +
      '<table class="gderpi-cmd-dropdown-table">' +
      '<thead><tr>' +
      '<th>Article</th><th class="text-end">Commandé</th><th class="text-end">Reçu frs</th>' +
      '<th class="text-end">Livré client</th><th class="text-end">Reste à livrer</th><th>Statut achat</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderFacturationPanelContent(cmd, esc) {
    const factures = Array.isArray(cmd?.factures) ? cmd.factures : [];
    if (!factures.length) {
      const billable = H().billableLines(cmd).length;
      if (billable) {
        return '<p class="text-muted mb-0">' + esc(billable + ' ligne(s) prête(s) à facturer.') + '</p>';
      }
      return '<p class="text-muted mb-0">Aucune facture émise.</p>';
    }

    let rows = '';
    factures.forEach((facture) => {
      const paye = H().facturePayeLabel(facture);
      const total = facture.totaux?.totalTtc ?? facture.totalFactureTtc;
      rows += '<tr class="gderpi-cmd-fact-row">' +
        '<td><strong>' + esc(facture.numero || 'Facture') + '</strong></td>' +
        '<td>' + esc(fmtDate(facture.date)) + '</td>' +
        '<td class="text-end">' + esc(fmt(total)) + '</td>' +
        '<td><span class="gderpi-cmd-avail-status gderpi-cmd-avail-status--' + esc(paye.tone) + '">' + esc(paye.label) + '</span></td>' +
        '<td></td></tr>';

      const avoirs = Array.isArray(facture.avoirs) ? facture.avoirs : [];
      avoirs.forEach((avoir) => {
        const montant = avoir.totaux?.totalTtc ?? avoir.montantTtc;
        let statut = 'Émis';
        let tone = 'info';
        if (avoir.rembourse) { statut = 'Remboursé'; tone = 'ok'; }
        else if (avoir.remboursementEnAttente) { statut = 'Remb. attente'; tone = 'warn'; }
        rows += '<tr class="gderpi-cmd-avoir-row">' +
          '<td class="gderpi-cmd-avoir-indent">↳ Avoir ' + esc(avoir.numero || '—') + '</td>' +
          '<td>' + esc(fmtDate(avoir.date)) + '</td>' +
          '<td class="text-end">' + esc(fmt(montant)) + '</td>' +
          '<td><span class="gderpi-cmd-avail-status gderpi-cmd-avail-status--' + esc(tone) + '">' + esc(statut) + '</span></td>' +
          '<td class="text-muted small">sur ' + esc(facture.numero || '') + '</td></tr>';
      });
    });

    return '<div class="gderpi-cmd-detail-panel__table-wrap">' +
      '<table class="gderpi-cmd-dropdown-table">' +
      '<thead><tr>' +
      '<th>Document</th><th>Date</th><th class="text-end">Montant TTC</th><th>Statut</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderDetailRow(cmd, esc, kind, colSpan, panelFn, title) {
    const id = cmd.commandeClientId || cmd.id;
    const panelId = 'gderpi-cmd-detail-' + kind + '-' + esc(id);
    return '<tr class="gderpi-cmd-detail-row" data-cmd-detail-for="' + esc(id) + '" ' +
      'data-cmd-detail-kind="' + esc(kind) + '" hidden onclick="event.stopPropagation()">' +
      '<td colspan="' + colSpan + '">' +
      '<div class="gderpi-cmd-detail-panel gderpi-cmd-detail-panel--' + esc(kind) + '" id="' + panelId + '">' +
      '<div class="gderpi-cmd-detail-panel__title">' + esc(title) + ' — ' + esc(cmd.numero || '') + '</div>' +
      panelFn(cmd, esc) +
      '</div></td></tr>';
  }

  function renderCommandDetailRows(cmd, esc, colSpan) {
    return renderDetailRow(cmd, esc, 'livraison', colSpan, renderLivraisonPanelContent, 'Livraison') +
      renderDetailRow(cmd, esc, 'facturation', colSpan, renderFacturationPanelContent, 'Facturation');
  }

  function renderListStatutCell(cmd, esc) {
    return renderStatutBadge(cmd, esc) + renderBesoinsMeta(cmd, esc);
  }

  function renderListLivraisonCell(cmd, esc) {
    return renderToggleButton(cmd, esc, 'livraison', H().livraisonColumnSummary);
  }

  function renderListFacturationCell(cmd, esc) {
    return renderToggleButton(cmd, esc, 'facturation', H().facturationColumnSummary);
  }

  function renderActionsSelect(cmd, escFn, canWrite) {
    if (!canWrite) return '<span class="text-muted small">—</span>';
    const items = H().workflowActions(cmd);
    if (!items.length) return '<span class="text-muted small">—</span>';
    const id = cmd.commandeClientId || cmd.id;
    const Menu = global.GderpiListActionsMenu;
    if (!Menu) {
      const opts = '<option value="">Actions…</option>' + items.map((it) =>
        '<option value="' + escFn(it.value) + '">' + escFn(it.label) + '</option>'
      ).join('');
      return '<select class="form-control form-control-sm gderpi-cmd-actions-select" ' +
        'data-cmd-id="' + escFn(id) + '" title="Actions sur la commande">' + opts + '</select>';
    }
    return Menu.render(items, {
      attrs: { 'data-cmd-id': id, 'data-legacy-select': '0' }
    });
  }

  function renderStatutSelect(cmd, esc, canWrite) {
    return renderListStatutCell(cmd, esc);
  }

  function renderListActionsCell(cmd, esc, canWrite) {
    return renderActionsSelect(cmd, esc, canWrite);
  }

  function renderEditorPanel(cmd, esc, kind, summaryFn, panelFn, title) {
    const summary = summaryFn(cmd);
    if (summary === '—' && kind === 'facturation') {
      return '<span class="text-muted small">—</span>';
    }
    const id = cmd.commandeClientId || cmd.id;
    const panelId = 'gderpi-cmd-editor-detail-' + kind + '-' + esc(id);
    const label = esc(summary === '—' ? 'Détail' : summary);
    return '<div class="gderpi-cmd-editor-detail" data-cmd-editor-detail="' + esc(kind) + '">' +
      '<button type="button" class="btn btn-outline btn-sm gderpi-cmd-dropdown-toggle" ' +
      'data-cmd-id="' + esc(id) + '" data-cmd-detail-kind="' + esc(kind) + '" ' +
      'aria-expanded="false" aria-controls="' + panelId + '">' +
      label + ' <span class="gderpi-cmd-dropdown-caret">▾</span></button>' +
      '<div class="gderpi-cmd-detail-panel gderpi-cmd-detail-panel--inline" id="' + panelId + '" hidden>' +
      '<div class="gderpi-cmd-detail-panel__title">' + esc(title) + '</div>' +
      panelFn(cmd, esc) +
      '</div></div>';
  }

  function renderEditorWorkflow(cmd, esc, canWrite) {
    let html = '<div class="gderpi-cmd-workflow__row">';
    html += '<label class="gderpi-cmd-workflow__label">Statut</label>';
    html += renderStatutBadge(cmd, esc);
    html += '</div>';

    if (cmd.modifieeParClient && cmd.validationGdriRequise) {
      html += '<p class="gderpi-cmd-workflow__alert gderpi-cmd-workflow__alert--warn">' +
        esc('Le client a modifié la commande. Une validation GDRI est nécessaire avant de poursuivre.') +
        '</p>';
    }

    const besoins = renderBesoinsMeta(cmd, esc);
    if (besoins) html += besoins;

    html += '<div class="gderpi-cmd-workflow__row gderpi-cmd-workflow__row--cols">';
    html += '<div><label class="gderpi-cmd-workflow__label">Livraison</label>';
    html += renderEditorPanel(cmd, esc, 'livraison', H().livraisonColumnSummary, renderLivraisonPanelContent, 'Livraison') + '</div>';
    html += '<div><label class="gderpi-cmd-workflow__label">Facturation</label>';
    html += renderEditorPanel(cmd, esc, 'facturation', H().facturationColumnSummary, renderFacturationPanelContent, 'Facturation') + '</div></div>';

    const items = canWrite ? H().workflowActions(cmd) : [];
    if (items.length) {
      html += '<div class="gderpi-cmd-workflow__row gderpi-cmd-workflow__row--action">';
      html += '<label class="gderpi-cmd-workflow__label">Actions</label>';
      html += renderActionsSelect(cmd, esc, canWrite);
      html += '</div>';
    }

    if (H().hasBl(cmd)) {
      html += '<p class="gderpi-cmd-workflow__meta text-muted small">BL ' + esc(cmd.bonLivraisonNumero || '') + '</p>';
    }
    if (H().hasRecette(cmd)) {
      html += '<p class="gderpi-cmd-workflow__meta text-muted small">' + esc(cmd.recetteLibelle || 'Prestation terminée') + '</p>';
    }
    return html;
  }

  function setToggleState(btn, open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    const caret = btn.querySelector('.gderpi-cmd-dropdown-caret');
    if (caret) caret.textContent = open ? '▴' : '▾';
    btn.classList.toggle('gderpi-cmd-dropdown-toggle--open', open);
  }

  function closeAllDetailRows(root, exceptCmdId, exceptKind) {
    (root || document).querySelectorAll('.gderpi-cmd-detail-row').forEach((row) => {
      const cmdId = row.getAttribute('data-cmd-detail-for');
      const kind = row.getAttribute('data-cmd-detail-kind');
      if (cmdId === exceptCmdId && kind === exceptKind) return;
      row.hidden = true;
    });
    (root || document).querySelectorAll('.gderpi-cmd-dropdown-toggle').forEach((btn) => {
      const cmdId = btn.getAttribute('data-cmd-id');
      const kind = btn.getAttribute('data-cmd-detail-kind');
      if (cmdId === exceptCmdId && kind === exceptKind) return;
      setToggleState(btn, false);
    });
    (root || document).querySelectorAll('.gderpi-cmd-detail-panel--inline').forEach((panel) => {
      panel.hidden = true;
    });
  }

  function bindDropdownToggles(root) {
    (root || document).querySelectorAll('.gderpi-cmd-dropdown-toggle').forEach((btn) => {
      if (btn.dataset.boundDropdown) return;
      btn.dataset.boundDropdown = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cmdId = btn.getAttribute('data-cmd-id');
        const kind = btn.getAttribute('data-cmd-detail-kind');
        if (!cmdId || !kind) return;

        const scope = (root || document);
        const listDetailRow = scope.querySelector(
          '.gderpi-cmd-detail-row[data-cmd-detail-for="' + cmdId + '"][data-cmd-detail-kind="' + kind + '"]'
        );
        const editorPanel = btn.closest('.gderpi-cmd-editor-detail')
          ?.querySelector('.gderpi-cmd-detail-panel--inline');

        if (listDetailRow) {
          const open = listDetailRow.hidden;
          closeAllDetailRows(scope);
          listDetailRow.hidden = !open;
          setToggleState(btn, open);
          if (open) {
            listDetailRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
          return;
        }

        if (editorPanel) {
          const open = editorPanel.hidden;
          closeAllDetailRows(scope);
          editorPanel.hidden = !open;
          setToggleState(btn, open);
        }
      });
    });
  }

  function bindAvailabilityToggles(root) {
    bindDropdownToggles(root);
  }

  function bindActionsSelect(selectOrRoot, cmd, onAction) {
    if (!selectOrRoot) return;

    // Ancien <select> (fallback)
    if (selectOrRoot.tagName === 'SELECT') {
      selectOrRoot.addEventListener('change', () => {
        const action = selectOrRoot.value;
        selectOrRoot.value = '';
        if (!action) return;
        Promise.resolve(onAction(action, cmd)).catch((err) => {
          global.GderpiStatus?.showStatus?.(err?.message || 'Erreur action commande', 'danger');
        });
      });
      return;
    }

    // Nouveau menu actions — le root peut être le menu ou un conteneur
    const menuRoot = selectOrRoot.classList?.contains('gderpi-actions-menu')
      ? selectOrRoot
      : selectOrRoot.querySelector?.('.gderpi-actions-menu');
    if (!menuRoot) return;
    global.GderpiListActionsMenu?.bind?.(menuRoot.parentNode || menuRoot, async (action) => {
      await onAction(action, cmd);
    });
  }

  global.GderpiCommandeClientWorkflow = {
    renderStatutBadge,
    renderStatutSelect,
    renderListStatutCell,
    renderListLivraisonCell,
    renderListFacturationCell,
    renderCommandDetailRows,
    renderListActionsCell,
    renderActionsSelect,
    renderEditorWorkflow,
    bindActionsSelect,
    bindDropdownToggles,
    bindAvailabilityToggles
  };
})(window);
