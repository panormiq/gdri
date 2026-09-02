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

  function regleeBadge(cmd) {
    if (cmd?.reglee === true) {
      return '<span class="gderpi-badge gderpi-badge--regle">Réglée</span>';
    }
    return '<span class="gderpi-badge gderpi-badge--non-regle">Non réglée</span>';
  }

  async function setReglee(id, reglee) {
    await global.GderpiApi.apiCall('/commandes-fournisseur/' + encodeURIComponent(id) + '/reglee', {
      method: 'PATCH',
      body: JSON.stringify({ reglee })
    });
    global.GderpiStatus.showStatus(reglee ? 'Commande marquée comme réglée.' : 'Commande marquée comme non réglée.', 'success');
    await refreshAchatsList();
  }

  async function ensureFournisseurs() {
    const [frsRes, btqRes] = await Promise.all([
      global.GderpiApi.apiCall('/fournisseurs'),
      global.GderpiApi.apiCall('/boutiques')
    ]);
    fournisseurs = frsRes.data || [];
    boutiques = btqRes.data || [];
  }

  async function applyStatus(id, statut, body = {}) {
    const res = await global.GderpiApi.apiCall('/commandes-fournisseur/' + encodeURIComponent(id) + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ statut, ...body })
    });
    await refreshAchatsList();
    return res;
  }

  async function markAsSent(id) {
    if (!confirm(
      'Marquer cette commande comme envoyée sans e-mail ?\n\n' +
      'Utile pour les commandes déjà parties via un autre canal ou un ancien logiciel.'
    )) return;
    try {
      await applyStatus(id, 'envoyee', { sendEmail: false });
      global.GderpiStatus.showStatus('Commande marquée comme envoyée (sans e-mail).', 'success');
    } catch (err) {
      global.GderpiStatus.showStatus(err.message || 'Erreur mise à jour statut', 'error');
      throw err;
    }
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
        const res = await applyStatus(id, statut, emailPayload);
        global.GderpiSendEmailFeedback.notifySendSuccess(res, { label: 'E-mail', fallbackTo: 'fournisseur' });
        return;
      } catch (err) {
        global.GderpiSendEmailFeedback.notifySendError(err);
      }
    }
    try {
      await applyStatus(id, statut);
      global.GderpiStatus.showStatus('Statut mis à jour.', 'success');
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
      global.GderpiSendEmailFeedback.notifySendSuccess(res, { label: 'E-mail', fallbackTo: 'fournisseur' });
      await refreshAchatsList();
    } catch (err) {
      global.GderpiSendEmailFeedback.notifySendError(err);
    }
  }

  async function refreshAchatsList() {
    await ensureFournisseurs();
    const q = document.getElementById('gderpi-achats-search')?.value?.trim() || '';
    const statut = document.getElementById('gderpi-achats-filter-statut')?.value || '';
    const reglee = document.getElementById('gderpi-achats-filter-reglee')?.value || '';
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (statut) params.set('statut', statut);
    if (reglee === '0' || reglee === '1') params.set('reglee', reglee);
    const path = '/commandes-fournisseur' + (params.toString() ? '?' + params.toString() : '');
    const res = await global.GderpiApi.apiCall(path);
    commandes = res.data || [];

    const tbody = document.getElementById('gderpi-achats-tbody');
    const count = document.getElementById('gderpi-achats-count');
    if (count) count.textContent = commandes.length + ' élément(s)';
    if (!tbody) return;

    if (!commandes.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Aucune commande fournisseur. Elles sont créées en brouillon depuis une commande client validée.</td></tr>';
      return;
    }

    tbody.innerHTML = commandes.map((c) => {
      const id = c.commandeFournisseurId || c.id;
      const next = NEXT_STATUS[c.statut];
      const items = [];
      if (canWrite() && next) {
        items.push({
          value: 'next',
          label: NEXT_LABEL[c.statut] || 'Suivant',
          tone: c.statut === 'brouillon' ? 'primary' : 'success',
          attrs: { 'data-next': next }
        });
      }
      if (canWrite() && c.statut === 'brouillon') {
        items.push({ value: 'mark_sent', label: 'Marquer envoyée' });
      }
      if (canWrite() && c.statut && c.statut !== 'brouillon' && c.statut !== 'annulee') {
        items.push({ value: 'email', label: 'E-mail fournisseur' });
      }
      if (canWrite() && RECEPTION_STATUTS.has(String(c.statut))) {
        items.push({ value: 'reception', label: 'Réception partielle' });
      }
      if (canWrite() && String(c.statut) !== 'annulee') {
        if (c.reglee === true) {
          items.push({ value: 'unpay', label: 'Marquer non réglée' });
        } else {
          items.push({ value: 'pay', label: 'Marquer réglée', tone: 'success' });
        }
      }
      items.push({ value: 'pdf', label: 'PDF', dividerBefore: items.length > 0 });
      items.push({ value: 'html', label: 'Aperçu' });
      if (canWrite() && c.statut !== 'annulee' && c.statut !== 'recue') {
        items.push({ value: 'cancel', label: 'Annuler', tone: 'danger', dividerBefore: true });
      }
      const actions = global.GderpiListActionsMenu
        ? global.GderpiListActionsMenu.render(items, { attrs: { 'data-id': id } })
        : '';
      const origineTag = c.origine === 'stock'
        ? ' <span class="gderpi-badge gderpi-badge--stock" title="Commande stock autonome">Stock</span>'
        : '';
      return '<tr data-gderpi-achats-row data-id="' + esc(id) + '">' +
        '<td><strong>' + esc(c.numero) + '</strong>' + origineTag + '</td>' +
        '<td>' + esc(supplierLabel(c)) + '</td>' +
        '<td>' + esc(c.objet || '—') + '</td>' +
        '<td>' + statutBadge(c.statut) + '</td>' +
        '<td>' + regleeBadge(c) + '</td>' +
        '<td class="text-end">' + fmt(c.totaux?.totalHt) + '</td>' +
        '<td class="gderpi-cmd-actions-cell" onclick="event.stopPropagation()">' + actions + '</td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-gderpi-achats-row]').forEach((tr) => {
      tr.style.cursor = 'pointer';
      tr.addEventListener('dblclick', (ev) => {
        if (ev.target.closest('button, .gderpi-actions-menu')) return;
        const id = tr.getAttribute('data-id');
        global.GderpiCommandeFournisseurEditor?.openCommandeFournisseur?.(id).catch(handleErr);
      });
    });

    global.GderpiListActionsMenu?.bind?.(tbody, async (action, itemEl, menuEl) => {
      const id = menuEl.getAttribute('data-id') || '';
      if (action === 'next') return updateStatus(id, itemEl.getAttribute('data-next'));
      if (action === 'mark_sent') return markAsSent(id);
      if (action === 'email') return sendEmail(id);
      if (action === 'pdf') return global.GderpiCommandeClientHelpers.downloadCommandeFournisseurPdf(id);
      if (action === 'html') return global.GderpiCommandeClientHelpers.previewCommandeFournisseurHtml(id);
      if (action === 'reception') {
        return global.GderpiReceptionFournisseurModal?.openReceptionForCommandeFournisseur?.(id);
      }
      if (action === 'pay') return setReglee(id, true);
      if (action === 'unpay') return setReglee(id, false);
      if (action === 'cancel') {
        if (!confirm('Annuler cette commande fournisseur ?')) return;
        return updateStatus(id, 'annulee');
      }
    });
  }

  function bindAchatsTab() {
    ['gderpi-achats-search', 'gderpi-achats-filter-statut', 'gderpi-achats-filter-reglee'].forEach((id) => {
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
