/**
 * FICHIER : modules/gderpi/frontend/assets/js/achats/bindAchatsTab.js
 * RÔLE : Onglet achats — commandes fournisseur et changements de statut.
 */

(function initGderpiBindAchatsTab(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const fmt = (v) => global.GderpiFormat.formatMoney(v);
  const canWrite = () => global.GDERPI_CONFIG?.canWrite === true;

  let fournisseurs = [];
  let boutiques = [];
  let commandes = [];

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

  function supplierLabel(cmd) {
    if (cmd?.fournisseurBoutiqueId) {
      const b = boutiques.find((x) => String(x.boutiqueId || x.id) === String(cmd.fournisseurBoutiqueId));
      return 'Boutique : ' + (b ? (b.nom || b.raisonSociale || cmd.fournisseurBoutiqueId) : cmd.fournisseurBoutiqueId);
    }
    const id = cmd?.fournisseurId;
    if (!id) return '— Sans fournisseur —';
    const f = fournisseurs.find((x) => String(x.fournisseurId || x.id) === String(id));
    return f ? (f.raisonSociale || f.nom || id) : id;
  }

  function statutBadge(statut) {
    const s = String(statut || 'brouillon');
    return '<span class="gderpi-badge-statut gderpi-badge-statut--' + esc(s) + '">' + esc(STATUT_LABELS[s] || s) + '</span>';
  }

  async function ensureFournisseurs() {
    const [frsRes, btqRes] = await Promise.all([
      global.GderpiApi.apiCall('/fournisseurs'),
      global.GderpiApi.apiCall('/boutiques')
    ]);
    fournisseurs = frsRes.data || [];
    boutiques = btqRes.data || [];
  }

  async function updateStatus(id, statut) {
    if (statut === 'envoyee') {
      const cmd = commandes.find((c) => String(c.commandeFournisseurId || c.id) === String(id));
      const frs = supplierLabel(cmd);
      const modalResult = await global.GderpiSendEmail?.prompt?.({
        title: 'Valider et envoyer au fournisseur',
        description: 'Un e-mail avec lien de consultation sera envoyé au contact principal (' + frs + ').',
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
        await refreshAchatsList();
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
      await refreshAchatsList();
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
      await refreshAchatsList();
    } catch (err) {
      global.GderpiStatus.showStatus(err.message || 'Erreur envoi e-mail', 'error');
      throw err;
    }
  }

  async function refreshAchatsList() {
    await ensureFournisseurs();
    const q = document.getElementById('gderpi-achats-search')?.value?.trim() || '';
    const statut = document.getElementById('gderpi-achats-filter-statut')?.value || '';
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (statut) params.set('statut', statut);
    const path = '/commandes-fournisseur' + (params.toString() ? '?' + params.toString() : '');
    const res = await global.GderpiApi.apiCall(path);
    commandes = res.data || [];

    const tbody = document.getElementById('gderpi-achats-tbody');
    const count = document.getElementById('gderpi-achats-count');
    if (count) count.textContent = commandes.length + ' élément(s)';
    if (!tbody) return;

    if (!commandes.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Aucune commande fournisseur. Elles sont créées en brouillon depuis une commande client validée.</td></tr>';
      return;
    }

    tbody.innerHTML = commandes.map((c) => {
      const id = c.commandeFournisseurId || c.id;
      const next = NEXT_STATUS[c.statut];
      let actions = '';
      if (canWrite() && next) {
        actions = '<button type="button" class="btn btn-outline btn-sm gderpi-achats-next" data-id="' + esc(id) + '" data-next="' + esc(next) + '">' + esc(NEXT_LABEL[c.statut]) + '</button>';
      }
      if (canWrite() && c.statut && c.statut !== 'brouillon' && c.statut !== 'annulee') {
        actions += ' <button type="button" class="btn btn-outline btn-sm gderpi-achats-email" data-id="' + esc(id) + '">E-mail fournisseur</button>';
      }
      if (canWrite() && RECEPTION_STATUTS.has(String(c.statut))) {
        actions += ' <button type="button" class="btn btn-outline btn-sm gderpi-achats-reception" data-id="' + esc(id) + '">Réception partielle</button>';
      }
      actions += ' <button type="button" class="btn btn-outline btn-sm gderpi-achats-pdf" data-id="' + esc(id) + '">PDF</button>';
      actions += ' <button type="button" class="btn btn-outline btn-sm gderpi-achats-html" data-id="' + esc(id) + '">Aperçu</button>';
      if (canWrite() && c.statut !== 'annulee' && c.statut !== 'recue') {
        actions += ' <button type="button" class="btn btn-outline-danger btn-sm gderpi-achats-cancel" data-id="' + esc(id) + '">Annuler</button>';
      }
      const origineTag = c.origine === 'stock'
        ? ' <span class="gderpi-badge gderpi-badge--stock" title="Commande stock autonome">Stock</span>'
        : '';
      return '<tr data-gderpi-achats-row data-id="' + esc(id) + '">' +
        '<td><strong>' + esc(c.numero) + '</strong>' + origineTag + '</td>' +
        '<td>' + esc(supplierLabel(c)) + '</td>' +
        '<td>' + esc(c.objet || '—') + '</td>' +
        '<td>' + statutBadge(c.statut) + '</td>' +
        '<td class="text-end">' + fmt(c.totaux?.totalHt) + '</td>' +
        '<td class="text-nowrap">' + actions + '</td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-gderpi-achats-row]').forEach((tr) => {
      tr.style.cursor = 'pointer';
      tr.addEventListener('dblclick', (ev) => {
        if (ev.target.closest('button')) return;
        const id = tr.getAttribute('data-id');
        global.GderpiCommandeFournisseurEditor?.openCommandeFournisseur?.(id).catch(handleErr);
      });
    });

    tbody.querySelectorAll('.gderpi-achats-next').forEach((btn) => {
      btn.addEventListener('click', () => updateStatus(btn.dataset.id, btn.dataset.next).catch(handleErr));
    });
    tbody.querySelectorAll('.gderpi-achats-email').forEach((btn) => {
      btn.addEventListener('click', () => sendEmail(btn.dataset.id).catch(handleErr));
    });
    tbody.querySelectorAll('.gderpi-achats-pdf').forEach((btn) => {
      btn.addEventListener('click', () => {
        global.GderpiCommandeClientHelpers.downloadCommandeFournisseurPdf(btn.dataset.id).catch(handleErr);
      });
    });
    tbody.querySelectorAll('.gderpi-achats-html').forEach((btn) => {
      btn.addEventListener('click', () => {
        global.GderpiCommandeClientHelpers.previewCommandeFournisseurHtml(btn.dataset.id).catch(handleErr);
      });
    });
    tbody.querySelectorAll('.gderpi-achats-reception').forEach((btn) => {
      btn.addEventListener('click', () => {
        global.GderpiReceptionFournisseurModal?.openReceptionForCommandeFournisseur?.(btn.dataset.id);
      });
    });
    tbody.querySelectorAll('.gderpi-achats-cancel').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!confirm('Annuler cette commande fournisseur ?')) return;
        updateStatus(btn.dataset.id, 'annulee').catch(handleErr);
      });
    });
  }

  function bindAchatsTab() {
    ['gderpi-achats-search', 'gderpi-achats-filter-statut'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => refreshAchatsList().catch(handleErr));
      if (el.type === 'search') {
        let t;
        el.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => refreshAchatsList().catch(handleErr), 200); });
      }
    });
    ensureFournisseurs().catch(() => {});
  }

  function handleErr(err) {
    global.GderpiStatus.showStatus(err.message || 'Erreur achats', 'danger');
  }

  global.GderpiAchatsTab = {
    bindAchatsTab,
    refreshAchatsList,
    getTierRefs: () => ({ fournisseurs, boutiques })
  };
})(window);
