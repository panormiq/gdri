/**
 * FICHIER : modules/gderpi/frontend/assets/js/facturation/bindFacturationModal.js
 * RÔLE : Modale facturation partielle + facturation complète des lignes livrées.
 */

(function initGderpiBindFacturationModal(global) {
  'use strict';

  const H = () => global.GderpiCommandeClientHelpers;

  let modal = null;
  let commande = null;
  let factureLines = [];
  let isSubmitting = false;

  function ensureModal() {
    if (modal) return modal;
    const el = document.getElementById('gderpi-facturation-modal');
    if (!el || !global.GderpiModal) return null;
    modal = global.GderpiModal.enhance(el, { title: 'Facturation', size: 'lg', stacked: true });
    return modal;
  }

  function openModalOnTop() {
    const api = ensureModal();
    if (!api?.root) {
      global.GderpiStatus.showStatus('Modale facturation indisponible.', 'danger');
      return null;
    }
    if (api.root.parentElement === document.body) {
      document.body.appendChild(api.root);
    }
    api.open();
    return api;
  }

  function refreshAfterFacture(id) {
    global.GderpiCommandesClientTab?.refreshCommandesList?.();
    global.GderpiFacturationTab?.refreshFacturationList?.();
    global.GderpiCommandeClientEditor?.reloadCommande?.(id);
  }

  function setSaveEnabled(enabled) {
    const saveBtn = document.getElementById('gderpi-facturation-save');
    if (saveBtn) saveBtn.disabled = !enabled || isSubmitting;
  }

  function syncLineQtyFromDom(index, input) {
    const max = Number(factureLines[index].quantiteMax) || 0;
    let val = Number(input.value) || 0;
    if (val > max) val = max;
    if (val < 0) val = 0;
    factureLines[index].quantite = val;
    factureLines[index].selected = val > 0;
    input.value = val;
    const row = input.closest('[data-fact-line]');
    const check = row?.querySelector('.gderpi-fact-line-check');
    if (check) check.checked = val > 0;
  }

  function renderLines() {
    const tbody = document.getElementById('gderpi-facturation-lines-tbody');
    if (!tbody) return;

    if (!factureLines.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Aucune ligne livrée disponible à facturer</td></tr>';
      setSaveEnabled(false);
      return;
    }

    const esc = (v) => global.GderpiEscape.escapeHtml(v);
    tbody.innerHTML = factureLines.map((line, i) =>
      '<tr data-fact-line="' + i + '">' +
      '<td><input type="checkbox" class="form-check-input gderpi-fact-line-check" ' +
        (line.selected ? 'checked' : '') + '></td>' +
      '<td>' + esc(line.reference || '—') + '</td>' +
      '<td>' + esc(line.libelle || '—') + '</td>' +
      '<td class="text-end">' + esc(line.quantiteCommande) + '</td>' +
      '<td class="text-end">' + esc(line.quantiteFacturee || '—') + '</td>' +
      '<td class="text-end">' + esc(line.quantiteMax) + '</td>' +
      '<td><input type="number" class="form-control form-control-sm gderpi-fact-qty" min="0" step="any" ' +
        'value="' + esc(line.quantite) + '" data-max="' + esc(line.quantiteMax) + '"></td>' +
      '</tr>'
    ).join('');

    tbody.querySelectorAll('.gderpi-fact-line-check').forEach((input, i) => {
      input.addEventListener('change', () => {
        factureLines[i].selected = input.checked;
        if (!input.checked) {
          factureLines[i].quantite = 0;
          const qtyInput = input.closest('tr')?.querySelector('.gderpi-fact-qty');
          if (qtyInput) qtyInput.value = '0';
        } else if ((Number(factureLines[i].quantite) || 0) <= 0) {
          factureLines[i].quantite = factureLines[i].quantiteMax;
          const qtyInput = input.closest('tr')?.querySelector('.gderpi-fact-qty');
          if (qtyInput) qtyInput.value = String(factureLines[i].quantiteMax);
        }
      });
    });
    tbody.querySelectorAll('.gderpi-fact-qty').forEach((input, i) => {
      const onQty = () => syncLineQtyFromDom(i, input);
      input.addEventListener('input', onQty);
      input.addEventListener('change', onQty);
    });
    setSaveEnabled(factureLines.some((l) => (Number(l.quantite) || 0) > 0));
  }

  function collectLinesFromDom() {
    const tbody = document.getElementById('gderpi-facturation-lines-tbody');
    if (!tbody) return [];

    return factureLines.map((line, i) => {
      const row = tbody.querySelector('[data-fact-line="' + i + '"]');
      const check = row?.querySelector('.gderpi-fact-line-check');
      const input = row?.querySelector('.gderpi-fact-qty');
      const selected = check?.checked === true;
      const qty = Number(input?.value) || 0;
      return { id: line.id, quantite: selected && qty > 0 ? qty : 0 };
    }).filter((l) => l.id && l.quantite > 0);
  }

  async function postFacture(payload) {
    const id = commande?.commandeClientId || commande?.id;
    if (!id) throw new Error('Commande introuvable');
    isSubmitting = true;
    setSaveEnabled(false);
    try {
      const res = await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id) + '/facturer', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      modal?.close?.();
      const numero = res.data?.lastFacture?.numero || res.data?.factureNumero || '';
      global.GderpiStatus.showStatus('Facture ' + numero + ' émise.', 'success');
      refreshAfterFacture(id);
      return res.data;
    } finally {
      isSubmitting = false;
      setSaveEnabled(collectLinesFromDom().length > 0);
    }
  }

  async function submitFacture() {
    const lignes = collectLinesFromDom();
    if (!lignes.length) {
      throw new Error('Indiquez au moins une quantité à facturer');
    }
    return postFacture({ lignes });
  }

  async function createFactureComplet(cmd) {
    const id = cmd?.commandeClientId || cmd?.id;
    if (!id) return;
    const fresh = await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id));
    commande = fresh.data || cmd;
    const billable = H().billableLines(commande);
    if (!billable.length) {
      global.GderpiStatus.showStatus('Aucune ligne livrée disponible à facturer.', 'warning');
      return;
    }
    const label = billable.length === 1
      ? 'la ligne « ' + (billable[0].libelle || billable[0].reference || '') + ' »'
      : 'les ' + billable.length + ' lignes livrées';
    if (!confirm('Émettre une facture pour ' + label + ' ?')) return;

    const data = await postFacture({ mode: 'complet' });
    const factureId = data?.lastFacture?.id || data?.factures?.[data.factures.length - 1]?.id;
    await global.GderpiFacturationTab?.sendFactureToClient?.(id, null, factureId);
  }

  function openFacturationModalWithCommande(cmd) {
    const billable = H().billableLines(cmd);
    if (!billable.length) {
      global.GderpiStatus.showStatus('Aucune ligne livrée disponible à facturer.', 'warning');
      return;
    }

    const preselectAll = billable.length === 1;
    factureLines = billable.map((l) => ({
      id: l.id,
      reference: l.reference,
      libelle: l.libelle,
      quantiteCommande: l.quantite,
      quantiteFacturee: l.quantiteFacturee || 0,
      quantiteMax: l.quantiteFacturable,
      quantite: l.quantiteFacturable,
      selected: preselectAll
    }));

    const title = document.getElementById('gderpi-facturation-modal-title');
    if (title) title.textContent = 'Facturation partielle — commande ' + (cmd.numero || '');

    const intro = document.getElementById('gderpi-facturation-intro');
    if (intro) {
      intro.textContent = preselectAll
        ? 'Ajustez la quantité à facturer si besoin, puis validez.'
        : 'Cochez les lignes livrées à facturer et indiquez les quantités.';
    }

    renderLines();
    openModalOnTop();
  }

  async function openFacturationModal(cmd) {
    const id = cmd?.commandeClientId || cmd?.id;
    if (!id) {
      global.GderpiStatus.showStatus('Commande introuvable.', 'warning');
      return;
    }
    try {
      const res = await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id));
      commande = res.data || cmd;
      openFacturationModalWithCommande(commande);
    } catch (err) {
      global.GderpiStatus.showStatus(err.message || 'Erreur chargement commande', 'danger');
      throw err;
    }
  }

  function bindSaveButton() {
    const saveBtn = document.getElementById('gderpi-facturation-save');
    if (!saveBtn || saveBtn.dataset.gderpiFactBound) return;
    saveBtn.dataset.gderpiFactBound = '1';
    saveBtn.addEventListener('click', () => {
      submitFacture().catch((err) => {
        global.GderpiStatus.showStatus(err.message || 'Erreur facturation', 'danger');
      });
    });
  }

  bindSaveButton();
  global.GderpiFacturationModal = { openFacturationModal, createFactureComplet };
})(window);
