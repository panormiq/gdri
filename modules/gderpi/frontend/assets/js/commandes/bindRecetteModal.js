/**
 * FICHIER : modules/gderpi/frontend/assets/js/commandes/bindRecetteModal.js
 * RÔLE : Modale livraison prestation partielle + livraison complète directe (dev).
 */

(function initGderpiBindRecetteModal(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const H = () => global.GderpiCommandeClientHelpers;

  const DEFAULT_LIBELLE = 'Livraison prestation';

  let modal = null;
  let commande = null;
  let recetteLines = [];

  function ensureModal() {
    if (modal) return modal;
    const el = document.getElementById('gderpi-recette-modal');
    if (!el || !global.GderpiModal) return null;
    modal = global.GderpiModal.enhance(el, { title: DEFAULT_LIBELLE, size: 'md', stacked: true });
    return modal;
  }

  function refreshAfterRecette(id) {
    global.GderpiCommandesClientTab?.refreshCommandesList?.();
    global.GderpiCommandeClientEditor?.reloadCommande?.(id);
  }

  function renderLines() {
    const wrap = document.getElementById('gderpi-recette-lines-wrap');
    const tbody = document.getElementById('gderpi-recette-lines-tbody');
    if (!wrap || !tbody) return;

    if (!recetteLines.length) {
      wrap.hidden = true;
      tbody.innerHTML = '';
      return;
    }

    wrap.hidden = false;
    tbody.innerHTML = recetteLines.map((line, i) =>
      '<tr data-recette-line="' + i + '">' +
      '<td><input type="checkbox" class="form-check-input gderpi-recette-line-check" ' +
        (line.selected ? 'checked' : '') + '></td>' +
      '<td>' + esc(line.reference || '—') + '</td>' +
      '<td>' + esc(line.libelle || '—') + '</td>' +
      '</tr>'
    ).join('');

    tbody.querySelectorAll('.gderpi-recette-line-check').forEach((input, i) => {
      input.addEventListener('change', () => {
        recetteLines[i].selected = input.checked;
      });
    });
  }

  async function postRecette(payload) {
    const id = commande?.commandeClientId || commande?.id;
    if (!id) throw new Error('Commande introuvable');
    await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id) + '/recette', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    modal?.close?.();
    global.GderpiStatus.showStatus('Livraison prestation enregistrée.', 'success');
    refreshAfterRecette(id);
  }

  async function submitRecette() {
    const ligneIds = recetteLines.filter((l) => l.selected).map((l) => l.id);
    if (!ligneIds.length) throw new Error('Sélectionnez au moins une ligne à livrer');

    const libelle = document.getElementById('gderpi-recette-libelle')?.value?.trim()
      || DEFAULT_LIBELLE;
    const notes = document.getElementById('gderpi-recette-notes')?.value?.trim() || '';

    await postRecette({ libelle, notes, ligneIds });
  }

  async function createRecetteComplet(cmd) {
    const id = cmd?.commandeClientId || cmd?.id;
    if (!id) return;
    const fresh = await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id));
    commande = fresh.data || cmd;
    const remaining = H().remainingDevLines(commande);
    if (!remaining.length) {
      global.GderpiStatus.showStatus('Aucune prestation / développement restant à livrer.', 'warning');
      return;
    }
    const label = remaining.length === 1
      ? 'la ligne « ' + (remaining[0].libelle || remaining[0].reference || '') + ' »'
      : 'les ' + remaining.length + ' lignes prestation / développement';
    if (!confirm('Enregistrer la livraison complète pour ' + label + ' ?')) return;

    await postRecette({
      mode: 'complet',
      libelle: DEFAULT_LIBELLE,
      notes: ''
    });
  }

  function openRecetteModal(cmd) {
    const id = cmd?.commandeClientId || cmd?.id;
    if (!id) return;
    global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id))
      .then((res) => {
        commande = res.data || cmd;
        openRecetteModalWithCommande(commande);
      })
      .catch((err) => {
        global.GderpiStatus.showStatus(err.message || 'Erreur chargement commande', 'danger');
      });
  }

  function openRecetteModalWithCommande(cmd) {
    const remaining = H().remainingDevLines(cmd);
    if (!remaining.length) {
      global.GderpiStatus.showStatus('Aucune prestation / développement restant à livrer.', 'warning');
      return;
    }

    recetteLines = remaining.map((l) => ({
      id: l.id,
      reference: l.reference,
      libelle: l.libelle,
      selected: false
    }));

    const title = document.getElementById('gderpi-recette-modal-title');
    if (title) title.textContent = 'Livraison prestation partielle — commande ' + (cmd.numero || '');

    const intro = document.getElementById('gderpi-recette-intro');
    if (intro) intro.textContent = 'Cochez les lignes prestation / développement livrées.';

    const libelleEl = document.getElementById('gderpi-recette-libelle');
    const notesEl = document.getElementById('gderpi-recette-notes');
    if (libelleEl) libelleEl.value = DEFAULT_LIBELLE;
    if (notesEl) notesEl.value = '';

    renderLines();
    ensureModal()?.open();

    const saveBtn = document.getElementById('gderpi-recette-save');
    if (saveBtn) {
      saveBtn.onclick = () => submitRecette().catch((err) => {
        global.GderpiStatus.showStatus(err.message || 'Erreur livraison prestation', 'danger');
      });
    }
  }

  global.GderpiRecetteModal = { openRecetteModal, createRecetteComplet };
})(window);
