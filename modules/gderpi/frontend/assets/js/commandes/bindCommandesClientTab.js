/**
 * FICHIER : modules/gderpi/frontend/assets/js/commandes/bindCommandesClientTab.js
 * RÔLE : Onglet commandes client — liste, pipeline et actions bloquantes GDRI.
 */

(function initGderpiBindCommandesClientTab(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const fmt = (v) => global.GderpiFormat.formatMoney(v);
  const Wf = () => global.GderpiCommandeClientWorkflow;
  const H = () => global.GderpiCommandeClientHelpers;
  const canWrite = () => global.GDERPI_CONFIG?.canWrite === true;

  let clients = [];
  let commandes = [];
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

  async function annulerCommande(id) {
    if (!confirm('Annuler cette commande client ?\n\nCette action est définitive pour le suivi.')) return;
    await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id) + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ statut: 'annulee' })
    });
    global.GderpiStatus.showStatus('Commande annulée.', 'success');
    await refreshCommandesList();
    global.GderpiFacturationTab?.refreshFacturationList?.();
  }

  async function validerGdri(id) {
    const cmd = commandes.find((c) => String(c.commandeClientId || c.id) === String(id));
    const result = await global.GderpiBonCommandeClient?.ensure?.(cmd);
    if (!result) return;
    const currentRef = String(cmd?.referenceClient || '').trim();
    const needSave = result.referenceClient !== currentRef
      || result.sansBonCommandeClient !== (cmd?.sansBonCommandeClient === true);
    if (needSave) {
      await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id), {
        method: 'PUT',
        body: JSON.stringify({
          referenceClient: result.referenceClient || '',
          sansBonCommandeClient: result.sansBonCommandeClient === true
        })
      });
    }
    if (!confirm('Valider cette commande en interne (GDRI) ?')) return;
    await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id) + '/valider-gdri', { method: 'POST' });
    global.GderpiStatus.showStatus('Commande validée GDRI.', 'success');
    await refreshCommandesList();
  }

  async function genererAchats(id) {
    if (!confirm('Créer les commandes fournisseur en brouillon pour cette commande ?')) return;
    const res = await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id) + '/generer-achats', { method: 'POST' });
    const n = Array.isArray(res.data?.commandesFournisseur) ? res.data.commandesFournisseur.length : 0;
    global.GderpiStatus.showStatus(n + ' commande(s) fournisseur en brouillon — vérifiez-les dans Achats.', 'success');
    global.GderpiAppNav?.('achats');
    await refreshCommandesList();
  }

  async function envoyerAchats(id) {
    if (!confirm(
      'Valider et envoyer les commandes fournisseur ?\n\n' +
      'Un e-mail avec un lien de consultation et de téléchargement sera envoyé à chaque fournisseur (contact principal).\n\n' +
      'Vérifiez d\'abord les fournisseurs, les e-mails et les lignes dans l\'onglet Achats.'
    )) return;
    try {
      await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id) + '/envoyer-achats', { method: 'POST' });
      global.GderpiStatus.showStatus('Commandes fournisseur validées et e-mails envoyés — en attente de livraison.', 'success');
      await refreshCommandesList();
    } catch (err) {
      global.GderpiStatus.showStatus(err.message || 'Erreur envoi achats', 'error');
      throw err;
    }
  }

  async function confirmerReception(id) {
    if (!confirm('Confirmer la réception des marchandises fournisseur ?\n\nLa commande passera en « À livrer ».')) return;
    await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id) + '/confirmer-reception', { method: 'POST' });
    global.GderpiStatus.showStatus('Réception confirmée — prêt à livrer au client.', 'success');
    await refreshCommandesList();
  }

  async function emitFacture(id) {
    const cmd = commandes.find((c) => String(c.commandeClientId || c.id) === String(id));
    if (cmd) {
      await global.GderpiFacturationModal?.createFactureComplet?.(cmd);
      return;
    }
    await global.GderpiFacturationModal?.createFactureComplet?.({ commandeClientId: id });
  }

  async function runWorkflowAction(cmd, actionKey) {
    const id = cmd.commandeClientId || cmd.id;
    switch (actionKey) {
      case 'valider_gdri':
        await validerGdri(id);
        break;
      case 'generer_achats':
        await genererAchats(id);
        break;
      case 'envoyer_achats':
        await envoyerAchats(id);
        break;
      case 'confirmer_reception':
      case 'reception_complet':
        await global.GderpiReceptionFournisseurModal?.createReceptionComplet?.(cmd);
        await refreshCommandesList();
        break;
      case 'reception_partiel':
        global.GderpiReceptionFournisseurModal?.openReceptionFournisseurModal?.(cmd);
        break;
      case 'bl_complet':
        await global.GderpiBonLivraisonEditor?.createBlComplet?.(cmd);
        await refreshCommandesList();
        break;
      case 'bl_partiel':
        global.GderpiBonLivraisonEditor?.openBonLivraisonEditor?.(cmd);
        break;
      case 'avancement_complet':
      case 'recette_complet':
        await global.GderpiRecetteModal?.createRecetteComplet?.(cmd);
        await refreshCommandesList();
        break;
      case 'avancement_partiel':
      case 'recette_partiel':
        global.GderpiRecetteModal?.openRecetteModal?.(cmd);
        break;
      case 'goto_facturation':
        global.GderpiAppNav?.('facturation');
        global.GderpiFacturationTab?.openList?.({ highlightId: id });
        break;
      case 'facture_complet':
      case 'emit_facture':
        await global.GderpiFacturationModal?.createFactureComplet?.(cmd);
        await refreshCommandesList();
        break;
      case 'facture_partiel':
        await global.GderpiFacturationModal?.openFacturationModal?.(cmd);
        break;
      case 'email_facture': {
        const factures = Array.isArray(cmd?.factures) ? cmd.factures : [];
        const lastFactureId = factures.length ? factures[factures.length - 1].id : null;
        await global.GderpiFacturationTab?.sendFactureToClient?.(id, null, lastFactureId);
        break;
      }
      case 'email_commande':
        await H().sendCommandeClientToClient(id);
        break;
      case 'annuler':
        await annulerCommande(id);
        break;
      default:
        break;
    }
  }

  async function refreshCommandesList() {
    await ensureClients();
    const q = document.getElementById('gderpi-commandes-search')?.value?.trim() || '';
    const statut = document.getElementById('gderpi-commandes-filter-statut')?.value || '';
    const vue = document.getElementById('gderpi-commandes-filter-vue')?.value || '';
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (statut) {
      params.set('statut', statut);
    } else if (vue === 'actives') {
      params.set('actives', '1');
    } else if (vue === 'execution') {
      params.set('execution', '1');
    } else if (vue === 'post_facturation') {
      params.set('postFacturation', '1');
    }
    const path = '/commandes-client' + (params.toString() ? '?' + params.toString() : '');
    const res = await global.GderpiApi.apiCall(path);
    commandes = res.data || [];

    const tbody = document.getElementById('gderpi-commandes-tbody');
    const count = document.getElementById('gderpi-commandes-count');
    if (count) count.textContent = commandes.length + ' élément(s)';
    if (!tbody) return;

    if (!commandes.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="text-muted">Aucune commande client. Créez-en une depuis un devis accepté, ou via « + Commande client ».</td></tr>';
      return;
    }

    const wf = Wf();
    const COL_SPAN = 11;
    tbody.innerHTML = commandes.map((c) => {
      const id = c.commandeClientId || c.id;
      const devisLink = c.devisId && c.devisNumero
        ? '<button type="button" class="btn btn-link btn-sm p-0 gderpi-cmd-devis-link" data-devis-id="' + esc(c.devisId) + '">' + esc(c.devisNumero) + '</button>'
        : '<span class="text-muted">Sans devis</span>';
      const rowClass = H().rowHighlightClass(c);
      const highlight = String(id) === String(highlightId) ? ' gderpi-row-highlight' : '';
      const mainRow = '<tr data-gderpi-cmd-row data-cmd-id="' + esc(id) + '"' +
        ' class="' + esc((rowClass + highlight).trim()) + '">' +
        '<td><strong>' + esc(c.numero) + '</strong></td>' +
        '<td>' + esc(clientLabel(c.clientId)) + '</td>' +
        '<td>' + H().kindBadge(c) + '</td>' +
        '<td>' + esc(c.documentClient || '—') + '</td>' +
        '<td>' + esc(c.referenceClient || '—') + '</td>' +
        '<td onclick="event.stopPropagation()">' + devisLink + '</td>' +
        '<td class="gderpi-cmd-statut-cell" onclick="event.stopPropagation()">' +
          wf.renderListStatutCell(c, esc) + '</td>' +
        '<td class="gderpi-cmd-livraison-cell" onclick="event.stopPropagation()">' +
          wf.renderListLivraisonCell(c, esc) + '</td>' +
        '<td class="gderpi-cmd-facturation-cell" onclick="event.stopPropagation()">' +
          wf.renderListFacturationCell(c, esc) + '</td>' +
        '<td class="text-end">' + fmt(c.totaux?.totalTtc) + '</td>' +
        '<td class="gderpi-cmd-actions-cell" onclick="event.stopPropagation()">' +
          wf.renderListActionsCell(c, esc, canWrite()) + '</td></tr>';
      return mainRow + wf.renderCommandDetailRows(c, esc, COL_SPAN);
    }).join('');

    tbody.querySelectorAll('[data-gderpi-cmd-row]').forEach((row) => {
      const id = row.getAttribute('data-cmd-id');
      const cmd = commandes.find((x) => String(x.commandeClientId || x.id) === String(id));
      row.addEventListener('dblclick', () => {
        global.GderpiCommandeClientEditor?.openCommande?.(id).catch(handleErr);
      });

      wf.bindActionsSelect(
        row.querySelector('.gderpi-actions-menu') || row.querySelector('.gderpi-cmd-actions-select'),
        cmd,
        (action) => runWorkflowAction(cmd, action).catch(handleErr)
      );
    });

    tbody.querySelectorAll('.gderpi-cmd-devis-link').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        global.GderpiAppNav?.('devis');
        global.GderpiDevisTab?.openDevis?.(btn.getAttribute('data-devis-id'));
      });
    });

    wf.bindDropdownToggles(tbody);

    if (highlightId) {
      tbody.querySelector('[data-cmd-id="' + highlightId + '"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      window.setTimeout(() => { highlightId = ''; }, 4000);
    }
  }

  function openList(opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    const vueEl = document.getElementById('gderpi-commandes-filter-vue');
    const statutEl = document.getElementById('gderpi-commandes-filter-statut');
    if (options.showAll === true && vueEl) vueEl.value = '';
    if (options.actives === true && vueEl) vueEl.value = 'actives';
    if (options.execution === true && vueEl) vueEl.value = 'execution';
    if (options.postFacturation === true && vueEl) vueEl.value = 'post_facturation';
    if (options.statut && statutEl) {
      statutEl.value = options.statut;
      if (vueEl) vueEl.value = '';
    }
    if (options.highlightId) highlightId = String(options.highlightId);
    return refreshCommandesList();
  }

  function bindCommandesClientTab() {
    document.getElementById('gderpi-commandes-filter-vue')?.addEventListener('change', (e) => {
      const statutEl = document.getElementById('gderpi-commandes-filter-statut');
      if (e.target.value && statutEl) statutEl.value = '';
      refreshCommandesList().catch(handleErr);
    });
    document.getElementById('gderpi-commandes-filter-statut')?.addEventListener('change', (e) => {
      const vueEl = document.getElementById('gderpi-commandes-filter-vue');
      if (e.target.value && vueEl) vueEl.value = '';
      refreshCommandesList().catch(handleErr);
    });
    const search = document.getElementById('gderpi-commandes-search');
    if (search) {
      let t;
      search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => refreshCommandesList().catch(handleErr), 200); });
    }
  }

  function handleErr(err) {
    global.GderpiStatus.showStatus(err.message || 'Erreur commandes client', 'danger');
  }

  function findClient(clientId) {
    const id = String(clientId || '').trim();
    if (!id) return null;
    return clients.find((x) => String(x.clientId || x.id) === id) || null;
  }

  global.GderpiCommandesClientTab = {
    bindCommandesClientTab,
    refreshCommandesList,
    openList,
    runWorkflowAction,
    findClient
  };
})(window);
