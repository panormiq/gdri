/**
 * FICHIER : modules/gderpi/frontend/assets/js/facturation/bindAvoirModal.js
 * RÔLE : Émission d'avoir total ou partiel sur une facture (imputation ou remboursement).
 */

(function initGderpiBindAvoirModal(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const fmt = (v) => global.GderpiFormat.formatMoney(v);
  const H = () => global.GderpiCommandeClientHelpers;

  let modal = null;
  let commande = null;
  let factureId = null;
  let facture = null;
  let avoirLines = [];

  function ensureModal() {
    if (modal) return modal;
    const el = document.getElementById('gderpi-avoir-modal');
    if (!el || !global.GderpiModal) return null;
    modal = global.GderpiModal.enhance(el, { title: 'Avoir', size: 'lg', stacked: true });
    return modal;
  }

  function refreshAfterAvoir(id) {
    global.GderpiCommandesClientTab?.refreshCommandesList?.();
    global.GderpiFacturationTab?.refreshFacturationList?.();
    global.GderpiCommandeClientEditor?.reloadCommande?.(id);
  }

  async function postAvoir(cmdId, fId, payload) {
    const path = H().factureApiPath(cmdId, fId, '/avoir');
    const res = await global.GderpiApi.apiCall(path, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    modal?.close?.();
    const numero = res.data?.lastAvoir?.numero || '';
    const mode = res.data?.lastAvoir?.mode || '';
    let msg = 'Avoir ' + numero + ' émis.';
    if (mode === 'imputation') msg += ' Solde imputé sur la facture.';
    else if (mode === 'remboursement') msg += ' Remboursement à effectuer.';
    global.GderpiStatus.showStatus(msg, 'success');
    refreshAfterAvoir(cmdId);
    return res.data;
  }

  function renderLines() {
    const tbody = document.getElementById('gderpi-avoir-lines-tbody');
    if (!tbody) return;

    if (!avoirLines.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Aucune ligne créditable sur cette facture</td></tr>';
      return;
    }

    tbody.innerHTML = avoirLines.map((line, i) =>
      '<tr data-avoir-line="' + i + '">' +
      '<td><input type="checkbox" class="form-check-input gderpi-avoir-line-check" ' +
        (line.selected ? 'checked' : '') + '></td>' +
      '<td>' + esc(line.reference || '—') + '</td>' +
      '<td>' + esc(line.libelle || '—') + '</td>' +
      '<td class="text-end">' + esc(line.quantiteFacture) + '</td>' +
      '<td class="text-end">' + esc(line.quantiteAvoir || '—') + '</td>' +
      '<td class="text-end">' + esc(line.quantiteMax) + '</td>' +
      '<td><input type="number" class="form-control form-control-sm gderpi-avoir-qty" min="0" step="any" ' +
        'value="' + esc(line.quantite) + '" data-max="' + esc(line.quantiteMax) + '"></td>' +
      '</tr>'
    ).join('');

    tbody.querySelectorAll('.gderpi-avoir-line-check').forEach((input, i) => {
      input.addEventListener('change', () => {
        avoirLines[i].selected = input.checked;
      });
    });
    tbody.querySelectorAll('.gderpi-avoir-qty').forEach((input, i) => {
      input.addEventListener('input', () => {
        let qty = Number(input.value);
        const max = Number(input.dataset.max) || avoirLines[i].quantiteMax;
        if (!Number.isFinite(qty) || qty < 0) qty = 0;
        if (qty > max) qty = max;
        avoirLines[i].quantite = qty;
        input.value = qty;
      });
    });
  }

  async function submitAvoirPartiel() {
    const cmdId = commande?.commandeClientId || commande?.id;
    if (!cmdId || !factureId) throw new Error('Facture introuvable');

    const lignes = avoirLines
      .filter((l) => l.selected && (Number(l.quantite) || 0) > 0)
      .map((l) => ({ id: l.id, quantite: Number(l.quantite) }));
    if (!lignes.length) throw new Error('Sélectionnez au moins une ligne à créditer');

    const motif = document.getElementById('gderpi-avoir-motif')?.value?.trim() || '';
    const data = await postAvoir(cmdId, factureId, { lignes, motif });
    const avoirId = data?.lastAvoir?.id;
    if (avoirId) {
      await global.GderpiFacturationTab?.sendAvoirToClient?.(cmdId, factureId, avoirId);
    }
    return data;
  }

  function openAvoirPartielModal(cmdId, fId, fNumero) {
    if (!cmdId || !fId) return;
    global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(cmdId))
      .then((res) => {
        commande = res.data;
        factureId = fId;
        facture = H().resolveFactureEntry(commande, fId);
        if (!facture) throw new Error('Facture introuvable');
        if (facture.soldeeParAvoir) {
          global.GderpiStatus.showStatus('Cette facture est déjà soldée par avoir.', 'warning');
          return;
        }

        const lines = H().avoirableLines(commande, fId);
        if (!lines.length) {
          global.GderpiStatus.showStatus('Aucun montant disponible pour un avoir sur cette facture.', 'warning');
          return;
        }

        avoirLines = lines.map((l) => ({
          id: l.id,
          reference: l.reference,
          libelle: l.libelle,
          quantiteFacture: l.quantiteFacture,
          quantiteAvoir: l.quantiteAvoir || 0,
          quantiteMax: l.quantiteAvoirable,
          quantite: l.quantiteAvoirable,
          selected: false
        }));

        const numero = fNumero || facture.numero || '';
        const title = document.getElementById('gderpi-avoir-modal-title');
        if (title) title.textContent = 'Avoir partiel — facture ' + numero;

        const intro = document.getElementById('gderpi-avoir-intro');
        if (intro) {
          const payee = facture.payee === true;
          intro.textContent = payee
            ? 'Cochez les lignes à créditer. La facture est payée : un remboursement client sera à effectuer.'
            : 'Cochez les lignes à créditer. La facture n\'est pas payée : le solde sera imputé (pas de remboursement).';
        }

        const motifEl = document.getElementById('gderpi-avoir-motif');
        if (motifEl) motifEl.value = '';

        renderLines();
        ensureModal()?.open();

        const saveBtn = document.getElementById('gderpi-avoir-save');
        if (saveBtn) {
          saveBtn.onclick = () => submitAvoirPartiel().catch((err) => {
            global.GderpiStatus.showStatus(err.message || 'Erreur avoir', 'danger');
          });
        }
      })
      .catch((err) => {
        global.GderpiStatus.showStatus(err.message || 'Erreur chargement commande', 'danger');
      });
  }

  async function createAvoirTotal(cmdId, fId, fNumero, opts) {
    if (!cmdId || !fId) return;
    const options = opts && typeof opts === 'object' ? opts : {};

    const fresh = await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(cmdId));
    const cmd = fresh.data;
    const fact = H().resolveFactureEntry(cmd, fId);
    const numero = fNumero || fact?.numero || '';
    if (!fact) throw new Error('Facture introuvable');

    if (fact.soldeeParAvoir) {
      global.GderpiStatus.showStatus('Cette facture est déjà soldée par avoir.', 'warning');
      return;
    }

    const lines = H().avoirableLines(cmd, fId);
    if (!lines.length) {
      global.GderpiStatus.showStatus('Aucun montant disponible pour un avoir sur cette facture.', 'warning');
      return;
    }

    const resteDu = fact.resteDuTtc ?? fact.totalFactureTtc ?? fact.totaux?.totalTtc;
    const payee = fact.payee === true;

    let confirmMsg = 'Émettre un avoir total sur la facture ' + numero + ' ?\n\n';
    confirmMsg += 'Montant crédité : ' + fmt(resteDu) + ' TTC\n\n';
    if (payee) {
      confirmMsg += 'La facture est payée : un remboursement client sera à effectuer.';
    } else {
      confirmMsg += 'La facture n\'est pas payée : le solde sera imputé (pas de remboursement).';
    }
    if (!confirm(confirmMsg)) return;

    let motif = '';
    if (!options.skipMotif) {
      motif = window.prompt('Motif de l\'avoir (optionnel) :', '') || '';
    }

    const data = await postAvoir(cmdId, fId, { mode: 'complet', motif });
    const avoirId = data?.lastAvoir?.id;
    if (avoirId) {
      await global.GderpiFacturationTab?.sendAvoirToClient?.(cmdId, fId, avoirId);
    }
    return data;
  }

  global.GderpiAvoirModal = { createAvoirTotal, openAvoirPartielModal };
})(window);
