/**
 * FICHIER : modules/gderpi/frontend/assets/js/commandes/bindRecetteModal.js
 * RÔLE : Modale avancement prestation — heures ou % selon l'unité, ou solde 100 %.
 */

(function initGderpiBindRecetteModal(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const H = () => global.GderpiCommandeClientHelpers;

  const DEFAULT_LIBELLE = 'Avancement prestation';

  let modal = null;
  let commande = null;
  let recetteLines = [];

  function ensureModal() {
    if (modal) return modal;
    const el = document.getElementById('gderpi-recette-modal');
    if (!el || !global.GderpiModal) return null;
    modal = global.GderpiModal.enhance(el, { title: DEFAULT_LIBELLE, size: 'lg', stacked: true });
    return modal;
  }

  function refreshAfterRecette(id) {
    global.GderpiCommandesClientTab?.refreshCommandesList?.();
    global.GderpiCommandeClientEditor?.reloadCommande?.(id);
  }

  function lineMode(line) {
    return H().isHeureUnite(line.unite) ? 'heure' : 'percent';
  }

  function renderLines() {
    const wrap = document.getElementById('gderpi-recette-lines-wrap');
    const tbody = document.getElementById('gderpi-recette-lines-tbody');
    const thead = document.getElementById('gderpi-recette-lines-thead');
    if (!wrap || !tbody) return;

    if (!recetteLines.length) {
      wrap.hidden = true;
      tbody.innerHTML = '';
      return;
    }

    if (thead) {
      thead.innerHTML = '<tr><th>Réf.</th><th>Désignation</th><th class="text-end">Commandé</th>' +
        '<th class="text-end">Déjà livré</th><th>Cet avancement</th></tr>';
    }

    wrap.hidden = false;
    tbody.innerHTML = recetteLines.map((line, i) => {
      const mode = lineMode(line);
      const reste = H().remainingPrestationQty(line);
      const livree = Number(line.quantiteLivree) || 0;
      const input = mode === 'heure'
        ? '<input class="form-control form-control-sm text-end gderpi-recette-qty" type="number" min="0" max="' +
          esc(reste) + '" step="0.25" value="" placeholder="heures">'
        : '<div class="gderpi-recette-pct-wrap"><input class="form-control form-control-sm text-end gderpi-recette-pct" type="number" min="0" max="100" step="1" value="" placeholder="%">' +
          '<span class="text-muted small">%</span></div>';
      return '<tr data-recette-line="' + i + '">' +
        '<td>' + esc(line.reference || '—') + '</td>' +
        '<td>' + esc(line.libelle || '—') + '<div class="text-muted small">' +
          (mode === 'heure' ? 'Reste ' + esc(reste) + ' ' + esc(line.unite || 'h') : 'Reste ' + esc(reste) + ' / ' + esc(line.quantite)) +
          '</div></td>' +
        '<td class="text-end">' + esc(line.quantite) + ' ' + esc(line.unite || '') + '</td>' +
        '<td class="text-end">' + esc(livree) + '</td>' +
        '<td>' + input + '</td></tr>';
    }).join('');
  }

  function collectItems() {
    const rows = document.querySelectorAll('#gderpi-recette-lines-tbody tr[data-recette-line]');
    const items = [];
    rows.forEach((row) => {
      const idx = Number(row.getAttribute('data-recette-line'));
      const line = recetteLines[idx];
      if (!line) return;
      const qtyEl = row.querySelector('.gderpi-recette-qty');
      const pctEl = row.querySelector('.gderpi-recette-pct');
      if (qtyEl) {
        const quantite = Number(qtyEl.value);
        if (Number.isFinite(quantite) && quantite > 0) items.push({ id: line.id, quantite });
      } else if (pctEl) {
        const percent = Number(pctEl.value);
        if (Number.isFinite(percent) && percent > 0) items.push({ id: line.id, percent });
      }
    });
    return items;
  }

  async function postRecette(payload) {
    const id = commande?.commandeClientId || commande?.id;
    if (!id) throw new Error('Commande introuvable');
    await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id) + '/recette', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    modal?.close?.();
    global.GderpiStatus.showStatus('Avancement enregistré — vous pouvez facturer la part livrée.', 'success');
    refreshAfterRecette(id);
  }

  async function submitRecette() {
    const lignes = collectItems();
    if (!lignes.length) throw new Error('Indiquez des heures ou un % sur au moins une ligne');

    const libelle = document.getElementById('gderpi-recette-libelle')?.value?.trim()
      || DEFAULT_LIBELLE;
    const notes = document.getElementById('gderpi-recette-notes')?.value?.trim() || '';

    await postRecette({ libelle, notes, lignes });
  }

  async function createRecetteComplet(cmd) {
    const id = cmd?.commandeClientId || cmd?.id;
    if (!id) return;
    const fresh = await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id));
    commande = fresh.data || cmd;
    const remaining = H().remainingDevLines(commande);
    if (!remaining.length) {
      global.GderpiStatus.showStatus('Aucune prestation restante à solder.', 'warning');
      return;
    }
    const label = remaining.length === 1
      ? 'la ligne « ' + (remaining[0].libelle || remaining[0].reference || '') + ' »'
      : 'les ' + remaining.length + ' lignes prestation';
    if (!confirm('Solder à 100 % ' + label + ' ?\n\nLa part non encore facturée deviendra facturable.')) return;

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
      global.GderpiStatus.showStatus('Aucune prestation restante à avancer.', 'warning');
      return;
    }

    recetteLines = remaining.slice();

    const title = document.getElementById('gderpi-recette-modal-title');
    if (title) title.textContent = 'Avancement prestation — commande ' + (cmd.numero || '');

    const intro = document.getElementById('gderpi-recette-intro');
    if (intro) {
      intro.textContent = 'Saisissez les heures livrées, ou un % pour un forfait. Vous pourrez ensuite facturer cette part.';
    }

    const libelleEl = document.getElementById('gderpi-recette-libelle');
    const notesEl = document.getElementById('gderpi-recette-notes');
    if (libelleEl) libelleEl.value = DEFAULT_LIBELLE;
    if (notesEl) notesEl.value = '';

    renderLines();
    ensureModal()?.open();

    const saveBtn = document.getElementById('gderpi-recette-save');
    if (saveBtn) {
      saveBtn.textContent = 'Enregistrer l\'avancement';
      saveBtn.onclick = () => submitRecette().catch((err) => {
        global.GderpiStatus.showStatus(err.message || 'Erreur avancement', 'danger');
      });
    }
  }

  global.GderpiRecetteModal = { openRecetteModal, createRecetteComplet };
})(window);
