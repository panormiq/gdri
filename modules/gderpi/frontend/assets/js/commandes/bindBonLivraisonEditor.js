/**
 * FICHIER : modules/gderpi/frontend/assets/js/commandes/bindBonLivraisonEditor.js
 * RÔLE : Modale création bon de livraison partiel + livraison complète directe.
 */

(function initGderpiBindBonLivraisonEditor(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const H = () => global.GderpiCommandeClientHelpers;

  let modal = null;
  let commande = null;
  let blLines = [];
  let blClient = null;
  let isSubmitting = false;

  function ensureModal() {
    if (modal) return modal;
    const el = document.getElementById('gderpi-bl-editor-modal');
    if (!el || !global.GderpiModal) return null;
    modal = global.GderpiModal.enhance(el, { title: 'Bon de livraison', size: 'lg', stacked: true });
    return modal;
  }

  function refreshAfterBl(id) {
    global.GderpiCommandesClientTab?.refreshCommandesList?.();
    global.GderpiCommandeClientEditor?.reloadCommande?.(id);
    global.GderpiBonsLivraisonTab?.refreshBonsLivraisonList?.();
  }

  function setSaveEnabled(enabled) {
    const saveBtn = document.getElementById('gderpi-bl-save');
    if (saveBtn) saveBtn.disabled = !enabled || isSubmitting;
  }

  function syncLineQtyFromDom(index, input) {
    const max = Number(blLines[index].quantiteRestante) || 0;
    let val = Number(input.value) || 0;
    if (val > max) val = max;
    if (val < 0) val = 0;
    blLines[index].quantite = val;
    input.value = val;
  }

  function renderLines() {
    const tbody = document.getElementById('gderpi-bl-lines-tbody');
    if (!tbody) return;

    if (!blLines.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Aucune ligne produit restante</td></tr>';
      return;
    }

    tbody.innerHTML = blLines.map((line, i) =>
      '<tr data-bl-line="' + i + '">' +
      '<td>' + esc(line.reference || '—') + '</td>' +
      '<td>' + esc(line.libelle || '—') + '</td>' +
      '<td class="text-end">' + esc(line.quantiteRestante) + '</td>' +
      '<td class="text-end">' + esc(line.quantiteLivrable) + '</td>' +
      '<td><input type="number" class="form-control form-control-sm gderpi-bl-qty" min="0" max="' + esc(line.quantiteRestante) + '" step="any" value="' + esc(line.quantite) + '"></td>' +
      '<td>' + esc(line.unite || 'pièce') + '</td>' +
      '</tr>'
    ).join('');

    tbody.querySelectorAll('.gderpi-bl-qty').forEach((input, i) => {
      const onQty = () => syncLineQtyFromDom(i, input);
      input.addEventListener('input', onQty);
      input.addEventListener('change', onQty);
    });
  }

  function collectLinesFromDom() {
    const tbody = document.getElementById('gderpi-bl-lines-tbody');
    if (!tbody) return [];

    return blLines.map((line, i) => {
      const row = tbody.querySelector('[data-bl-line="' + i + '"]');
      const input = row?.querySelector('.gderpi-bl-qty');
      const qty = Number(input?.value) || 0;
      return {
        blIndex: i,
        id: line.id,
        lineId: line.lineId || line.id,
        sourceDevisLineId: line.sourceDevisLineId,
        ordre: line.ordre ?? i,
        articleId: line.articleId,
        articleType: line.articleType,
        reference: line.reference,
        referenceClient: line.referenceClient,
        libelle: line.libelle,
        description: line.description,
        unite: line.unite,
        quantite: qty,
        prixHt: line.prixHt,
        remisePct: line.remisePct,
        tauxTva: line.tauxTva
      };
    }).filter((l) => Number(l.quantite) > 0);
  }

  function linesExceedingDispo(lignes) {
    return lignes.filter((l) => {
      const source = blLines.find((b) => String(b.id) === String(l.id));
      const dispo = Number(source?.quantiteLivrable) || 0;
      return Number(l.quantite) > dispo + 0.0001;
    }).map((l) => {
      const source = blLines.find((b) => String(b.id) === String(l.id));
      return {
        ...l,
        quantiteLivrable: Number(source?.quantiteLivrable) || 0
      };
    });
  }

  async function loadClientForCommande(cmd) {
    const clientId = cmd?.clientId;
    if (!clientId) return null;
    const cached = global.GderpiCommandesClientTab?.findClient?.(clientId);
    if (cached) return cached;
    try {
      const res = await global.GderpiApi.apiCall('/clients/' + encodeURIComponent(clientId));
      return res.data || null;
    } catch (_) {
      return null;
    }
  }

  async function loadDevisForCommande(cmd) {
    const devisId = cmd?.devisId;
    if (!devisId) return null;
    try {
      const res = await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(devisId));
      return res.data || null;
    } catch (_) {
      return null;
    }
  }

  function updateAdresseDisplay() {
    const select = document.getElementById('gderpi-bl-adresse-select');
    const display = document.getElementById('gderpi-bl-adresse-display');
    if (!display) return;
    const addr = H().findClientAdresseByKey(blClient, select?.value);
    const text = addr ? H().formatPostalAddressText(addr) : '';
    display.textContent = text || '—';
    display.classList.toggle('gderpi-bl-adresse-display--empty', !text);
  }

  function updateContactDisplay() {
    const select = document.getElementById('gderpi-bl-contact-select');
    const display = document.getElementById('gderpi-bl-contact-display');
    if (!display) return;
    const contact = H().findClientContactByKey(blClient, select?.value);
    const fields = H().contactToBlFields(contact);
    const text = fields
      ? H().formatContactDisplay({
        nom: fields.contactNom,
        fonction: fields.contactFonction,
        email: fields.contactEmail,
        telephone: fields.contactTelephone
      })
      : '';
    display.textContent = text || '—';
  }

  function renderAdresseSelect(client) {
    const select = document.getElementById('gderpi-bl-adresse-select');
    const emptyMsg = document.getElementById('gderpi-bl-adresse-empty');
    if (!select) return false;

    const adresses = H().buildClientAdressesList(client);
    if (!adresses.length) {
      select.innerHTML = '';
      select.disabled = true;
      if (emptyMsg) emptyMsg.hidden = false;
      updateAdresseDisplay();
      return false;
    }

    select.disabled = false;
    if (emptyMsg) emptyMsg.hidden = true;
    const defaultKey = H().resolveDefaultClientAdresseKey(client);
    select.innerHTML = adresses.map((addr, i) => {
      const key = H().clientAddressKey(addr, i);
      const selected = key === defaultKey ? ' selected' : '';
      return '<option value="' + esc(key) + '"' + selected + '>' + esc(H().clientAddressOptionLabel(addr)) + '</option>';
    }).join('');

    if (!select.dataset.gderpiBlBound) {
      select.dataset.gderpiBlBound = '1';
      select.addEventListener('change', updateAdresseDisplay);
    }

    updateAdresseDisplay();
    return true;
  }

  function renderContactSelect(client, devis) {
    const select = document.getElementById('gderpi-bl-contact-select');
    if (!select) return true;

    const contacts = H().buildClientContactsList(client);
    if (!contacts.length) {
      select.innerHTML = '<option value="">— Aucun contact —</option>';
      select.disabled = true;
      updateContactDisplay();
      return true;
    }

    select.disabled = false;
    const defaultKey = H().resolveDefaultClientContactKey(client, devis);
    select.innerHTML = contacts.map((contact, i) => {
      const key = H().clientContactKey(contact, i);
      const selected = key === defaultKey ? ' selected' : '';
      return '<option value="' + esc(key) + '"' + selected + '>' + esc(H().clientContactOptionLabel(contact)) + '</option>';
    }).join('');

    if (!select.dataset.gderpiBlBound) {
      select.dataset.gderpiBlBound = '1';
      select.addEventListener('change', updateContactDisplay);
    }

    updateContactDisplay();
    return true;
  }

  async function fillBlClientBlock(cmd) {
    const clientNameEl = document.getElementById('gderpi-bl-client-name');
    const notesEl = document.getElementById('gderpi-bl-notes');
    if (notesEl) notesEl.value = '';

    const [client, devis] = await Promise.all([
      loadClientForCommande(cmd),
      loadDevisForCommande(cmd)
    ]);
    blClient = client;

    if (clientNameEl) clientNameEl.textContent = H().clientDisplayName(client) || '—';

    renderContactSelect(client, devis);
    return renderAdresseSelect(client);
  }

  function resolveAdresseLivraisonPayload() {
    const select = document.getElementById('gderpi-bl-adresse-select');
    const addr = H().findClientAdresseByKey(blClient, select?.value);
    return {
      adresseClientId: select?.value || '',
      adresseLivraison: addr ? H().formatPostalAddressText(addr) : ''
    };
  }

  function resolveContactPayload() {
    const select = document.getElementById('gderpi-bl-contact-select');
    const contact = H().findClientContactByKey(blClient, select?.value);
    const fields = H().contactToBlFields(contact) || {
      contactNom: '',
      contactFonction: '',
      contactEmail: '',
      contactTelephone: ''
    };
    return {
      contactClientId: select?.value || '',
      ...fields
    };
  }

  async function postBl(payload) {
    const id = commande?.commandeClientId || commande?.id;
    if (!id) throw new Error('Commande introuvable');
    isSubmitting = true;
    setSaveEnabled(false);
    try {
      await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id) + '/bons-livraison', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      modal?.close?.();
      global.GderpiStatus.showStatus('Bon de livraison créé.', 'success');
      refreshAfterBl(id);
    } finally {
      isSubmitting = false;
      const hasAdresse = Boolean(H().buildClientAdressesList(blClient).length);
      const hasLivrable = blLines.some((l) => Number(l.quantiteLivrable) > 0);
      setSaveEnabled(hasLivrable && hasAdresse);
    }
  }

  async function submitBl() {
    const lignes = collectLinesFromDom();
    if (!lignes.length) {
      global.GderpiStatus.showStatus('Indiquez au moins une quantité à livrer.', 'warning');
      return;
    }

    const { adresseClientId, adresseLivraison } = resolveAdresseLivraisonPayload();
    if (!adresseLivraison) {
      global.GderpiStatus.showStatus('Sélectionnez une adresse de livraison sur la fiche client.', 'warning');
      return;
    }

    const depassements = linesExceedingDispo(lignes);
    let forceDepassement = false;
    if (depassements.length) {
      const details = depassements.map((l) =>
        '• ' + (l.libelle || l.reference || 'ligne') + ' : ' + l.quantite + ' (dispo ' + l.quantiteLivrable + ')'
      ).join('\n');
      const ok = confirm(
        'Certaines quantités dépassent le stock reçu disponible :\n\n' +
        details +
        '\n\nContinuer quand même ?'
      );
      if (!ok) return;
      forceDepassement = true;
    }

    await postBl({
      mode: 'partiel',
      adresseClientId,
      adresseLivraison,
      ...resolveContactPayload(),
      notes: document.getElementById('gderpi-bl-notes')?.value?.trim() || '',
      forceDepassement,
      lignes
    });
  }

  async function createBlComplet(cmd) {
    commande = cmd;
    const remaining = H().remainingProductLines(cmd);
    if (!remaining.length) {
      global.GderpiStatus.showStatus('Aucune ligne produit restante à livrer.', 'warning');
      return;
    }

    const livrableLines = remaining.filter((l) => H().livrableQty(l, cmd) > 0);
    if (!livrableLines.length) {
      global.GderpiStatus.showStatus('Aucune quantité disponible — confirmez la réception fournisseur.', 'warning');
      return;
    }

    const depassePossible = livrableLines.some((l) => H().livrableQty(l, cmd) < H().remainingQty(l));
    const label = livrableLines.length === 1
      ? 'la ligne « ' + (livrableLines[0].libelle || livrableLines[0].reference || '') + ' »'
      : 'les lignes produit disponibles (' + livrableLines.length + ')';
    let msg = 'Créer un bon de livraison pour ' + label + ' ?\n\nSeules les quantités reçues et disponibles seront livrées.';
    if (depassePossible) {
      msg += '\n\n(Livraison partielle : le reste commandé sera livré après réception fournisseur.)';
    }
    if (!confirm(msg)) return;

    await postBl({ mode: 'complet' });
  }

  function buildBlLinesFromCommande(cmd) {
    const remaining = H().remainingProductLines(cmd);
    return remaining.map((l) => {
      const qtyRestante = H().remainingQty(l);
      const qtyLivrable = H().livrableQty(l, cmd);
      return {
        ...l,
        quantiteRestante: qtyRestante,
        quantiteLivrable: qtyLivrable,
        quantite: qtyLivrable
      };
    });
  }

  async function openBonLivraisonEditor(cmd) {
    const id = cmd?.commandeClientId || cmd?.id;
    if (!id) return;

    try {
      const res = await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id));
      commande = res.data || cmd;
    } catch (err) {
      global.GderpiStatus.showStatus(err.message || 'Erreur chargement commande', 'danger');
      return;
    }

    blLines = buildBlLinesFromCommande(commande);
    if (!blLines.length) {
      global.GderpiStatus.showStatus('Aucune ligne produit restante à livrer.', 'warning');
      return;
    }

    const hasLivrable = blLines.some((l) => Number(l.quantiteLivrable) > 0);

    const title = document.getElementById('gderpi-bl-editor-title');
    if (title) title.textContent = 'BL partiel — commande ' + (commande.numero || '');

    const intro = document.getElementById('gderpi-bl-editor-intro');
    if (intro) {
      intro.textContent = hasLivrable
        ? 'Indiquez les quantités à livrer, puis choisissez le contact et l\'adresse de livraison.'
        : 'Aucune quantité disponible — confirmez d\'abord la réception fournisseur.';
    }

    const hasAdresse = await fillBlClientBlock(commande);
    renderLines();
    setSaveEnabled(hasLivrable && hasAdresse);
    ensureModal()?.open();
  }

  function bindSaveButton() {
    const saveBtn = document.getElementById('gderpi-bl-save');
    if (!saveBtn || saveBtn.dataset.gderpiBlBound) return;
    saveBtn.dataset.gderpiBlBound = '1';
    saveBtn.addEventListener('click', () => {
      submitBl().catch((err) => {
        global.GderpiStatus.showStatus(err.message || 'Erreur création BL', 'danger');
      });
    });
  }

  bindSaveButton();
  global.GderpiBonLivraisonEditor = { openBonLivraisonEditor, createBlComplet };
})(window);
