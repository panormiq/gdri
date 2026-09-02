/**
 * FICHIER : modules/gderpi/frontend/assets/js/mail/bindSentEmailsTab.js
 * RÔLE : Mini boîte d'envoi GDERPI — copies des e-mails envoyés par le logiciel.
 */

(function initGderpiBindSentEmailsTab(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);

  const TYPE_COLORS = {
    devis: 'devis',
    commande_client: 'commande',
    facture: 'facture',
    avoir: 'avoir',
    commande_fournisseur: 'achat'
  };

  let items = [];
  let types = [];
  let counts = {};
  let selectedId = '';
  let searchTimer = 0;
  let bound = false;

  function formatDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function statusLabel(status) {
    if (status === 'sent') return 'Envoyé';
    if (status === 'failed') return 'Échec';
    return 'En attente';
  }

  function emptyPreview(message) {
    return (
      '<div class="gderpi-mailbox__empty">' +
        '<p>' + esc(message) + '</p>' +
      '</div>'
    );
  }

  function typeOptionsHtml() {
    const all = counts.all != null ? counts.all : items.length;
    let html = '<option value="">Tous les documents (' + all + ')</option>';
    types.forEach((t) => {
      const n = counts[t.id] || 0;
      html += '<option value="' + esc(t.id) + '">' + esc(t.label) + ' (' + n + ')</option>';
    });
    return html;
  }

  function queryParams() {
    const type = document.getElementById('gderpi-emails-filter-type')?.value || '';
    const status = document.getElementById('gderpi-emails-filter-status')?.value || '';
    const q = document.getElementById('gderpi-emails-search')?.value?.trim() || '';
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    params.set('limit', '120');
    return params.toString();
  }

  function renderList() {
    const list = document.getElementById('gderpi-emails-list');
    const countEl = document.getElementById('gderpi-emails-count');
    if (!list) return;
    if (countEl) {
      countEl.textContent = items.length
        ? items.length + ' message' + (items.length > 1 ? 's' : '')
        : '';
    }
    if (!items.length) {
      list.innerHTML = '<div class="gderpi-mailbox__empty gderpi-mailbox__empty--list">' +
        '<p>Aucun e-mail envoyé pour ce filtre.</p></div>';
      return;
    }
    list.innerHTML = items.map((item) => {
      const active = item.id === selectedId ? ' is-active' : '';
      const failed = item.status === 'failed' ? ' is-failed' : '';
      const typeClass = TYPE_COLORS[item.documentType] || 'autre';
      return (
        '<button type="button" class="gderpi-mailbox__item' + active + failed + '" data-email-id="' + esc(item.id) + '">' +
          '<span class="gderpi-mailbox__item-top">' +
            '<span class="gderpi-mailbox-type gderpi-mailbox-type--' + typeClass + '">' + esc(item.documentTypeLabel) + '</span>' +
            '<span class="gderpi-mailbox__item-date">' + esc(formatDateTime(item.sentAt)) + '</span>' +
          '</span>' +
          '<span class="gderpi-mailbox__item-to">' + esc(item.to || '—') + '</span>' +
          '<span class="gderpi-mailbox__item-subject">' + esc(item.subject || '(sans objet)') + '</span>' +
          (item.documentNumero
            ? '<span class="gderpi-mailbox__item-doc">' + esc(item.documentNumero) + '</span>'
            : '') +
        '</button>'
      );
    }).join('');
  }

  function renderPreviewPlaceholder() {
    const preview = document.getElementById('gderpi-emails-preview');
    if (!preview) return;
    preview.innerHTML = emptyPreview('Sélectionnez un message pour afficher le contenu envoyé.');
  }

  function renderPreview(email) {
    const preview = document.getElementById('gderpi-emails-preview');
    if (!preview) return;
    const canOpen = Boolean(email.openNav && email.openId);
    const failed = email.status === 'failed';
    preview.innerHTML =
      '<div class="gderpi-mailbox__message">' +
        '<div class="gderpi-mailbox__meta">' +
          '<div class="gderpi-mailbox__meta-row">' +
            '<span class="gderpi-mailbox-type gderpi-mailbox-type--' + (TYPE_COLORS[email.documentType] || 'autre') + '">' +
              esc(email.documentTypeLabel) +
            '</span>' +
            '<span class="gderpi-badge-statut gderpi-badge-statut--' + (failed ? 'refuse' : 'envoye') + '">' +
              esc(statusLabel(email.status)) +
            '</span>' +
            (email.documentNumero ? '<strong>' + esc(email.documentNumero) + '</strong>' : '') +
            '<span class="gderpi-mailbox__meta-date">' + esc(formatDateTime(email.sentAt)) + '</span>' +
          '</div>' +
          '<h4 class="gderpi-mailbox__subject">' + esc(email.subject || '(sans objet)') + '</h4>' +
          '<dl class="gderpi-mailbox__headers">' +
            '<div><dt>De</dt><dd>' + esc(email.from || '—') + '</dd></div>' +
            '<div><dt>À</dt><dd>' + esc(email.to || '—') + '</dd></div>' +
            (email.cc ? '<div><dt>Cc</dt><dd>' + esc(email.cc) + '</dd></div>' : '') +
          '</dl>' +
          (failed && email.error
            ? '<p class="gderpi-mailbox__error">' + esc(email.error) + '</p>'
            : '') +
          (canOpen
            ? '<div class="gderpi-mailbox__actions">' +
                '<button type="button" class="btn btn-outline btn-sm" data-gderpi-email-open>Ouvrir le document</button>' +
              '</div>'
            : '') +
        '</div>' +
        '<div class="gderpi-mailbox__body">' +
          (email.bodyHtml
            ? '<iframe class="gderpi-mailbox__iframe" title="Aperçu du message" sandbox></iframe>'
            : '<pre class="gderpi-mailbox__text">' + esc(email.bodyText || 'Pas de contenu.') + '</pre>') +
        '</div>' +
      '</div>';

    const iframe = preview.querySelector('.gderpi-mailbox__iframe');
    if (iframe && email.bodyHtml) iframe.srcdoc = email.bodyHtml;

    preview.querySelector('[data-gderpi-email-open]')?.addEventListener('click', () => {
      openRelatedDocument(email).catch((err) => {
        global.GderpiStatus.showStatus(err.message || 'Impossible d\'ouvrir le document', 'danger');
      });
    });
  }

  async function openRelatedDocument(email) {
    const ctx = email.context || {};
    const type = email.documentType;
    if (type === 'devis' && (ctx.devisId || email.openId)) {
      await global.GderpiAppNav?.('devis');
      await global.GderpiDevisTab?.openDevis?.(ctx.devisId || email.openId);
      return;
    }
    if (type === 'commande_fournisseur' && (ctx.commandeFournisseurId || email.openId)) {
      await global.GderpiAppNav?.('achats');
      await global.GderpiCommandeFournisseurEditor?.openCommandeFournisseur?.(
        ctx.commandeFournisseurId || email.openId
      );
      return;
    }
    const commandeId = ctx.commandeClientId || (type === 'commande_client' ? email.openId : '');
    if (commandeId) {
      await global.GderpiAppNav?.(type === 'commande_client' ? 'commandes' : 'facturation');
      await global.GderpiCommandeClientEditor?.openCommande?.(commandeId);
    }
  }

  async function selectEmail(id) {
    selectedId = id;
    renderList();
    const preview = document.getElementById('gderpi-emails-preview');
    if (preview) preview.innerHTML = emptyPreview('Chargement du message…');
    try {
      const res = await global.GderpiApi.apiCall('/emails/' + encodeURIComponent(id), { silent: true });
      const email = res.data;
      if (!email || email.id !== selectedId) return;
      renderPreview(email);
    } catch (err) {
      if (preview) preview.innerHTML = emptyPreview(err.message || 'Impossible de charger le message.');
      global.GderpiSendEmailFeedback?.notifySendError?.(err);
    }
  }

  async function refreshSentEmails() {
    const typeSelect = document.getElementById('gderpi-emails-filter-type');
    const previousType = typeSelect?.value || '';
    try {
      const res = await global.GderpiApi.apiCall('/emails?' + queryParams(), { silent: true });
      const data = res.data || {};
      items = data.items || [];
      types = data.types || types;
      counts = data.counts || {};
      if (typeSelect && types.length) {
        typeSelect.innerHTML = typeOptionsHtml();
        typeSelect.value = previousType;
        if (previousType && !Array.from(typeSelect.options).some((o) => o.value === previousType)) {
          typeSelect.value = '';
        }
      }
      if (selectedId && !items.some((item) => item.id === selectedId)) {
        selectedId = '';
        renderPreviewPlaceholder();
      }
      renderList();
      if (!selectedId) renderPreviewPlaceholder();
    } catch (err) {
      items = [];
      renderList();
      const preview = document.getElementById('gderpi-emails-preview');
      if (preview) {
        preview.innerHTML = emptyPreview(err.message || 'Impossible de charger les e-mails envoyés.');
      }
      global.GderpiSendEmailFeedback?.notifySendError?.(err);
    }
  }

  function noteOutboundSend(data) {
    const emailId = data && data.emailId ? String(data.emailId) : '';
    if (emailId) selectedId = emailId;
    const panel = document.getElementById('gderpi-panel-emails');
    if (panel && !panel.hidden) {
      refreshSentEmails()
        .then(() => { if (emailId) return selectEmail(emailId); })
        .catch(() => {});
    }
  }

  function bindSentEmailsTab() {
    if (bound) return;
    bound = true;
    const list = document.getElementById('gderpi-emails-list');
    const search = document.getElementById('gderpi-emails-search');
    const typeSelect = document.getElementById('gderpi-emails-filter-type');
    const statusSelect = document.getElementById('gderpi-emails-filter-status');
    const refreshBtn = document.getElementById('gderpi-emails-refresh');

    list?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-email-id]');
      if (!btn) return;
      selectEmail(btn.getAttribute('data-email-id')).catch((err) => {
        global.GderpiStatus.showStatus(err.message || 'Impossible de charger le message', 'danger');
      });
    });

    search?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        refreshSentEmails().catch((err) => {
          global.GderpiStatus.showStatus(err.message || 'Erreur chargement', 'danger');
        });
      }, 220);
    });

    [typeSelect, statusSelect].forEach((el) => {
      el?.addEventListener('change', () => {
        refreshSentEmails().catch((err) => {
          global.GderpiStatus.showStatus(err.message || 'Erreur chargement', 'danger');
        });
      });
    });

    refreshBtn?.addEventListener('click', () => {
      refreshSentEmails().catch((err) => {
        global.GderpiStatus.showStatus(err.message || 'Erreur chargement', 'danger');
      });
    });
  }

  global.GderpiSentEmailsTab = { bindSentEmailsTab, refreshSentEmails, selectEmail, noteOutboundSend };
})(window);
