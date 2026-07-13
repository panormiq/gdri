/**
 * FICHIER : modules/gderpi/frontend/assets/js/commandes/bindBonsLivraisonTab.js
 * RÔLE : Onglet bons de livraison client — liste, PDF et aperçu.
 */

(function initGderpiBindBonsLivraisonTab(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const fmtDate = (v) => global.GderpiFormat.formatDate(v);
  const H = () => global.GderpiCommandeClientHelpers;

  let clients = [];
  let bons = [];
  let highlightId = '';

  function clientLabel(id) {
    const c = clients.find((x) => String(x.clientId || x.id) === String(id));
    if (!c) return id || '—';
    return c.displayName || c.raisonSociale || [c.prenom, c.nom].filter(Boolean).join(' ') || id;
  }

  async function ensureClients() {
    const res = await global.GderpiApi.apiCall('/clients');
    clients = res.data || [];
  }

  function renderActions(bl) {
    const blId = bl.bonLivraisonId || bl.id;
    return '<button type="button" class="btn btn-outline btn-sm gderpi-bl-pdf" data-bl-id="' + esc(blId) + '">PDF</button> ' +
      '<button type="button" class="btn btn-outline btn-sm gderpi-bl-html" data-bl-id="' + esc(blId) + '">Aperçu</button>';
  }

  function renderRow(bl) {
    const blId = bl.bonLivraisonId || bl.id;
    const cmdId = bl.commandeClientId || '';
    const hl = highlightId && String(highlightId) === String(blId) ? ' gderpi-row--highlight' : '';
    const cmdCell = cmdId
      ? '<button type="button" class="btn btn-link btn-sm p-0 gderpi-bl-cmd-link" data-cmd-id="' + esc(cmdId) + '">' + esc(bl.commandeClientNumero || cmdId) + '</button>'
      : esc(bl.commandeClientNumero || '—');

    return '<tr class="gderpi-bl-row' + hl + '" data-bl-id="' + esc(blId) + '">' +
      '<td><strong>' + esc(bl.numero || '—') + '</strong></td>' +
      '<td>' + fmtDate(bl.dateLivraison || bl.createdAt) + '</td>' +
      '<td>' + esc(clientLabel(bl.clientId)) + '</td>' +
      '<td>' + cmdCell + '</td>' +
      '<td>' + esc(bl.objet || '—') + '</td>' +
      '<td class="text-nowrap">' + renderActions(bl) + '</td>' +
      '</tr>';
  }

  function bindTableEvents(root) {
    root.querySelectorAll('.gderpi-bl-pdf').forEach((btn) => {
      btn.addEventListener('click', () => H().downloadBonLivraisonPdf(btn.dataset.blId).catch(handleErr));
    });
    root.querySelectorAll('.gderpi-bl-html').forEach((btn) => {
      btn.addEventListener('click', () => H().previewBonLivraisonHtml(btn.dataset.blId).catch(handleErr));
    });
    root.querySelectorAll('.gderpi-bl-cmd-link').forEach((btn) => {
      btn.addEventListener('click', () => {
        global.GderpiCommandeClientEditor?.openCommande?.(btn.getAttribute('data-cmd-id')).catch(handleErr);
      });
    });
  }

  async function refreshBonsLivraisonList() {
    await ensureClients();
    const q = document.getElementById('gderpi-bl-search')?.value?.trim() || '';
    const params = new URLSearchParams();
    if (q) params.set('q', q);

    const res = await global.GderpiApi.apiCall('/bons-livraison' + (params.toString() ? '?' + params.toString() : ''));
    bons = res.data || [];

    const tbody = document.getElementById('gderpi-bl-tbody');
    const count = document.getElementById('gderpi-bl-count');
    if (count) {
      count.textContent = bons.length + ' bon' + (bons.length > 1 ? 's' : '') + ' de livraison';
    }
    if (!tbody) return;

    if (!bons.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Aucun bon de livraison. Créez-en un depuis Commandes client.</td></tr>';
      return;
    }

    tbody.innerHTML = bons.map(renderRow).join('');
    bindTableEvents(tbody);

    if (highlightId) {
      tbody.querySelector('[data-bl-id="' + highlightId + '"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      window.setTimeout(() => { highlightId = ''; }, 4000);
    }
  }

  function openList(opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    if (options.highlightId) highlightId = String(options.highlightId);
    return refreshBonsLivraisonList();
  }

  function bindBonsLivraisonTab() {
    const search = document.getElementById('gderpi-bl-search');
    if (search) {
      let t;
      search.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => refreshBonsLivraisonList().catch(handleErr), 200);
      });
    }
  }

  function handleErr(err) {
    global.GderpiStatus.showStatus(err.message || 'Erreur bons de livraison', 'danger');
  }

  global.GderpiBonsLivraisonTab = {
    bindBonsLivraisonTab,
    refreshBonsLivraisonList,
    openList
  };
})(window);
