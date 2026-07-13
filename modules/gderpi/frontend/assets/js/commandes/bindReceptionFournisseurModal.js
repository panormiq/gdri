/**

 * FICHIER : modules/gderpi/frontend/assets/js/commandes/bindReceptionFournisseurModal.js

 * RÔLE : Modale réception fournisseur partielle + réception complète.

 */



(function initGderpiBindReceptionFournisseurModal(global) {

  'use strict';



  const esc = (v) => global.GderpiEscape.escapeHtml(v);



  let modal = null;

  let commande = null;

  let receptionLines = [];



  function remainingCfQty(line) {

    if (Number.isFinite(Number(line?.quantiteRestante))) {

      return Math.max(0, Number(line.quantiteRestante));

    }

    const ordered = Number(line?.quantite) || 0;

    const recue = Number(line?.quantiteRecue) || 0;

    return Math.max(0, Math.round((ordered - recue) * 10000) / 10000);

  }



  function ensureModal() {

    if (modal) return modal;

    const el = document.getElementById('gderpi-reception-frs-modal');

    if (!el || !global.GderpiModal) return null;

    modal = global.GderpiModal.enhance(el, { title: 'Réception fournisseur', size: 'lg', stacked: true });

    return modal;

  }



  function refreshAfterReception(id) {

    global.GderpiCommandesClientTab?.refreshCommandesList?.();

    global.GderpiCommandeClientEditor?.reloadCommande?.(id);

    global.GderpiCommandeFournisseurEditor?.reloadCommande?.();

    global.GderpiAchatsTab?.refreshAchatsList?.();

  }



  function renderLines() {

    const tbody = document.getElementById('gderpi-reception-frs-lines-tbody');

    if (!tbody) return;

    if (!receptionLines.length) {

      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Aucune ligne fournisseur en attente de réception</td></tr>';

      return;

    }

    tbody.innerHTML = receptionLines.map((line, i) =>

      '<tr data-reception-line="' + i + '">' +

      '<td class="text-muted small">' + esc(line.cfNumero || '—') + '</td>' +

      '<td>' + esc(line.reference || '—') + '</td>' +

      '<td>' + esc(line.libelle || '—') + '</td>' +

      '<td class="text-end">' + esc(line.quantiteCommandee) + '</td>' +

      '<td class="text-end">' + esc(line.quantiteDejaRecue || 0) + '</td>' +

      '<td><input type="number" class="form-control form-control-sm gderpi-reception-frs-qty" min="0" max="' + esc(line.quantiteRestante) + '" step="any" value="' + esc(line.quantite) + '"></td>' +

      '<td>' + esc(line.unite || 'pièce') + '</td>' +

      '</tr>'

    ).join('');



    tbody.querySelectorAll('.gderpi-reception-frs-qty').forEach((input, i) => {

      input.addEventListener('change', () => {

        const max = Number(receptionLines[i].quantiteRestante) || 0;

        let val = Number(input.value) || 0;

        if (val > max) val = max;

        if (val < 0) val = 0;

        receptionLines[i].quantite = val;

        input.value = val;

      });

    });

  }



  async function loadReceptionLinesFromCf(cf) {
    const cfId = cf.commandeFournisseurId || cf.id;
    const lines = [];
    (cf.lignes || []).forEach((line) => {
      const reste = remainingCfQty(line);
      if (reste <= 0) return;
      lines.push({
        commandeFournisseurId: cfId,
        cfNumero: cf.numero,
        id: line.id,
        articleId: line.articleId,
        reference: line.reference,
        libelle: line.libelle,
        unite: line.unite,
        quantiteCommandee: Number(line.quantite) || 0,
        quantiteDejaRecue: Number(line.quantiteRecue) || 0,
        quantiteRestante: reste,
        quantite: reste
      });
    });
    return lines;
  }

  async function loadReceptionLines(cmd) {

    const id = cmd?.commandeClientId || cmd?.id;

    const res = await global.GderpiApi.apiCall('/commandes-fournisseur?commandeClientId=' + encodeURIComponent(id));

    const cfs = (res.data || []).filter((c) => {
      const s = String(c.statut || '');
      return s !== 'annulee' && s !== 'brouillon' && s !== 'recue';
    });

    const lines = [];

    cfs.forEach((cf) => {

      const cfId = cf.commandeFournisseurId || cf.id;

      (cf.lignes || []).forEach((line) => {

        const reste = remainingCfQty(line);

        if (reste <= 0) return;

        lines.push({

          commandeFournisseurId: cfId,

          cfNumero: cf.numero,

          id: line.id,

          articleId: line.articleId,

          reference: line.reference,

          libelle: line.libelle,

          unite: line.unite,

          quantiteCommandee: Number(line.quantite) || 0,

          quantiteDejaRecue: Number(line.quantiteRecue) || 0,

          quantiteRestante: reste,

          quantite: reste

        });

      });

    });

    return lines;

  }



  async function postReception(payload) {

    const id = commande?.commandeClientId || commande?.id;

    if (!id) throw new Error('Commande introuvable');

    await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id) + '/reception-fournisseur', {

      method: 'POST',

      body: JSON.stringify(payload)

    });

    modal?.close?.();

    global.GderpiStatus.showStatus('Réception fournisseur enregistrée.', 'success');

    refreshAfterReception(id);

  }



  async function submitReception() {

    const lignes = receptionLines

      .filter((l) => Number(l.quantite) > 0)

      .map((l) => ({

        commandeFournisseurId: l.commandeFournisseurId,

        id: l.id,

        articleId: l.articleId,

        reference: l.reference,

        libelle: l.libelle,

        quantite: Number(l.quantite) || 0

      }));

    if (!lignes.length) throw new Error('Indiquez au moins une quantité reçue');



    const notes = document.getElementById('gderpi-reception-frs-notes')?.value?.trim() || '';

    await postReception({ lignes, notes });

  }



  async function createReceptionComplet(cmd) {

    commande = cmd;

    const lines = await loadReceptionLines(cmd);

    if (!lines.length) {

      global.GderpiStatus.showStatus('Aucune ligne fournisseur en attente de réception.', 'warning');

      return;

    }

    if (!confirm('Enregistrer la réception complète de toutes les lignes fournisseur restantes ?\n\nLa commande passera en « À livrer » si ce n\'est pas déjà le cas.')) {

      return;

    }

    await postReception({ mode: 'complet' });

  }



  async function openReceptionForCommandeFournisseur(cfId) {
    const res = await global.GderpiApi.apiCall('/commandes-fournisseur/' + encodeURIComponent(cfId));
    const cf = res.data;
    if (!cf) throw new Error('Commande fournisseur introuvable');

    commande = cf.commandeClientId
      ? { id: cf.commandeClientId, commandeClientId: cf.commandeClientId }
      : null;
    receptionLines = await loadReceptionLinesFromCf(cf);
    if (!receptionLines.length) {
      global.GderpiStatus.showStatus('Aucune ligne restante à recevoir.', 'warning');
      return;
    }

    const title = document.getElementById('gderpi-reception-frs-modal-title');
    if (title) title.textContent = 'Réception — CF ' + (cf.numero || '');

    const intro = document.getElementById('gderpi-reception-frs-intro');
    if (intro) intro.textContent = 'Saisissez les quantités reçues pour cette commande fournisseur.';

    const notesEl = document.getElementById('gderpi-reception-frs-notes');
    if (notesEl) notesEl.value = '';

    renderLines();
    ensureModal()?.open();

    const saveBtn = document.getElementById('gderpi-reception-frs-save');
    if (saveBtn) {
      saveBtn.onclick = () => {
        const lignes = receptionLines
          .filter((l) => Number(l.quantite) > 0)
          .map((l) => ({
            id: l.id,
            articleId: l.articleId,
            reference: l.reference,
            libelle: l.libelle,
            quantite: Number(l.quantite) || 0
          }));
        if (!lignes.length) {
          global.GderpiStatus.showStatus('Indiquez au moins une quantité reçue.', 'warning');
          return;
        }
        const notes = document.getElementById('gderpi-reception-frs-notes')?.value?.trim() || '';
        global.GderpiApi.apiCall('/commandes-fournisseur/' + encodeURIComponent(cfId) + '/reception', {
          method: 'POST',
          body: JSON.stringify({ lignes, notes })
        }).then(() => {
          modal?.close?.();
          global.GderpiStatus.showStatus('Réception fournisseur enregistrée.', 'success');
          global.GderpiAchatsTab?.refreshAchatsList?.();
          global.GderpiCommandeFournisseurEditor?.reloadCommande?.(cfId);
          if (commande?.commandeClientId) refreshAfterReception(commande.commandeClientId);
        }).catch((err) => {
          global.GderpiStatus.showStatus(err.message || 'Erreur réception fournisseur', 'danger');
        });
      };
    }
  }

  async function openReceptionFournisseurModal(cmd) {

    commande = cmd;

    receptionLines = await loadReceptionLines(cmd);

    if (!receptionLines.length) {

      global.GderpiStatus.showStatus('Aucune ligne fournisseur en attente de réception.', 'warning');

      return;

    }



    const title = document.getElementById('gderpi-reception-frs-modal-title');

    if (title) title.textContent = 'Réception fournisseur — commande ' + (cmd.numero || '');



    const intro = document.getElementById('gderpi-reception-frs-intro');

    if (intro) {

      intro.textContent = 'Indiquez les quantités reçues du fournisseur. Les quantités disponibles pour le BL client seront mises à jour.';

    }



    const notesEl = document.getElementById('gderpi-reception-frs-notes');

    if (notesEl) notesEl.value = '';



    renderLines();

    ensureModal()?.open();



    const saveBtn = document.getElementById('gderpi-reception-frs-save');

    if (saveBtn) {

      saveBtn.onclick = () => submitReception().catch((err) => {

        global.GderpiStatus.showStatus(err.message || 'Erreur réception fournisseur', 'danger');

      });

    }

  }



  global.GderpiReceptionFournisseurModal = {
    openReceptionFournisseurModal,
    openReceptionForCommandeFournisseur,
    createReceptionComplet
  };

})(window);

