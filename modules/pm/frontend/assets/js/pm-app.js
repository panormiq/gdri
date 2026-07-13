/**
 * FICHIER : modules/pm/frontend/assets/js/pm-app.js
 * RÔLE : Application PM — tableau Kanban, inbox, liaison GDERPI.
 */
(function initPmApp(global) {
  'use strict';

  const state = {
    board: null,
    cards: [],
    gderpi: null,
    annuaire: null,
    selectedCard: null
  };

  function gderpiDevisUrl(devisId) {
    if (typeof global.pmGderpiDevisUrl === 'function') {
      return global.pmGderpiDevisUrl(devisId);
    }
    const base = (global.PM_CONFIG || {}).gderpiUrl || '#';
    if (!devisId) return base;
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'devis=' + encodeURIComponent(devisId);
  }

  function statutLabel(statut) {
    const labels = {
      brouillon: 'Brouillon',
      envoye: 'Envoyé',
      accepte: 'Accepté',
      refuse: 'Refusé',
      expire: 'Expiré'
    };
    return labels[statut] || statut || '';
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function cardClass(card) {
    let c = 'pm-card';
    if (card.type === 'devis') c += ' pm-card--devis';
    if (card.type === 'commande') c += ' pm-card--commande';
    if (card.priority === 'high') c += ' pm-card--high';
    return c;
  }

  function renderBoard() {
    const boardEl = document.getElementById('pm-board');
    if (!boardEl || !state.board) return;

    const byColumn = {};
    (state.board.columns || []).forEach(function (col) {
      byColumn[col.id] = [];
    });
    state.cards.forEach(function (card) {
      const col = card.columnId || 'inbox';
      if (!byColumn[col]) byColumn[col] = [];
      byColumn[col].push(card);
    });

    boardEl.innerHTML = (state.board.columns || []).map(function (col) {
      const cards = byColumn[col.id] || [];
      const cardsHtml = cards.length
        ? cards.map(function (card) {
            const orgTag = card.annuaire && card.annuaire.organisationName
              ? '<span class="pm-card-tag">' + esc(card.annuaire.organisationName) + '</span>'
              : '';
            const gderpiTag = card.gderpi && card.gderpi.devisNumero
              ? '<span class="pm-card-tag pm-card-tag--gderpi">Devis ' + esc(card.gderpi.devisNumero) + '</span>'
              : '';
            return '<article class="' + cardClass(card) + '" data-card-id="' + esc(card.cardId) + '">' +
              '<div class="pm-card-title">' + esc(card.title) + '</div>' +
              '<div class="pm-card-meta">' +
                (card.contactEmail ? '<span>' + esc(card.contactEmail) + '</span>' : '') +
                '<span>' + esc(card.type) + '</span>' +
              '</div>' +
              gderpiTag +
              orgTag +
            '</article>';
          }).join('')
        : '<div class="pm-empty">Aucune carte</div>';

      return '<section class="pm-column" data-column-id="' + esc(col.id) + '">' +
        '<header class="pm-column-header">' +
          '<span>' + esc(col.label) + '</span>' +
          '<span class="pm-column-count">' + cards.length + '</span>' +
        '</header>' +
        '<div class="pm-column-cards">' + cardsHtml + '</div>' +
      '</section>';
    }).join('');

    boardEl.querySelectorAll('[data-card-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        openCard(el.getAttribute('data-card-id'));
      });
    });
  }

  function renderCompatBadges() {
    const gderpiEl = document.getElementById('pm-gderpi-badge');
    if (gderpiEl) {
      if (state.gderpi && state.gderpi.gderpiInstalled) {
        gderpiEl.textContent = 'GDERPI connecté';
        gderpiEl.className = 'pm-compat-badge';
      } else {
        gderpiEl.textContent = 'GDERPI non disponible';
        gderpiEl.className = 'pm-compat-badge pm-compat-badge--off';
      }
    }
    const annuaireEl = document.getElementById('pm-annuaire-badge');
    if (annuaireEl) {
      if (state.annuaire && state.annuaire.annuaireInstalled) {
        annuaireEl.textContent = 'Annuaire connecté';
        annuaireEl.className = 'pm-compat-badge';
      } else {
        annuaireEl.textContent = 'Annuaire non disponible';
        annuaireEl.className = 'pm-compat-badge pm-compat-badge--off';
      }
    }
  }

  function renderGderpiBadge() {
    renderCompatBadges();
  }

  function renderDetail(card) {
    const overlay = document.getElementById('pm-detail-overlay');
    const panel = document.getElementById('pm-detail-panel');
    if (!overlay || !panel || !card) return;

    const tasks = (card.tasks || []).map(function (t, i) {
      const done = t.done ? ' pm-task--done' : '';
      return '<li class="pm-task' + done + '">' +
        '<input type="checkbox" data-task-idx="' + i + '"' + (t.done ? ' checked' : '') + ' disabled>' +
        '<span>' + esc(t.label) + '</span></li>';
    }).join('');

    const activities = (card.activities || []).slice().reverse().slice(0, 8).map(function (a) {
      return '<div class="pm-activity-item">' + esc(a.message) + '</div>';
    }).join('');

    let actions = '';
    let gderpiBlock = '';
    if (state.gderpi && state.gderpi.gderpiInstalled) {
      if (!card.gderpi || !card.gderpi.devisId) {
        if (state.gderpi.canCreateDevis) {
          actions += '<button type="button" class="btn btn-primary btn-sm" id="pm-btn-create-devis">Créer devis GDERPI</button>';
        }
        actions += '<button type="button" class="btn btn-outline btn-sm" id="pm-btn-link-devis">Lier un devis existant</button>';
      } else {
        const g = card.gderpi;
        gderpiBlock =
          '<div class="pm-gderpi-block">' +
            '<strong>GDERPI</strong><br>' +
            'Devis ' + esc(g.devisNumero || g.devisId) +
            (g.lastStatut ? ' — ' + esc(statutLabel(g.lastStatut)) : '') +
            (g.commandeClientNumero ? '<br>Commande ' + esc(g.commandeClientNumero) : '') +
          '</div>';
        actions +=
          '<a class="btn btn-outline btn-sm" href="' + esc(gderpiDevisUrl(g.devisId)) + '" target="_blank" rel="noopener">Ouvrir le devis</a> ' +
          '<button type="button" class="btn btn-outline btn-sm" id="pm-btn-sync-devis">Synchroniser</button>';
      }
    }

    let annuaireBlock = '';
    if (card.annuaire && card.annuaire.contactId) {
      annuaireBlock = '<p><strong>Annuaire :</strong> ' + esc(card.annuaire.organisationName || '') +
        (card.annuaire.contactName ? ' — ' + esc(card.annuaire.contactName) : '') + '</p>';
      if (state.annuaire && state.annuaire.annuaireInstalled) {
        annuaireBlock += '<a class="btn btn-outline btn-sm" href="' +
          esc((global.PM_CONFIG || {}).annuaireUrl || '#') + '" target="_blank" rel="noopener">Ouvrir Annuaire</a> ';
      }
    }

    panel.innerHTML =
      '<button type="button" class="btn btn-link btn-sm" id="pm-detail-close">← Fermer</button>' +
      '<h2>' + esc(card.title) + '</h2>' +
      '<p class="text-muted small">' + esc(card.description) + '</p>' +
      (card.contactEmail ? '<p><strong>Contact :</strong> ' + esc(card.contactName) + ' &lt;' + esc(card.contactEmail) + '&gt;</p>' : '') +
      annuaireBlock +
      gderpiBlock +
      '<div class="pm-detail-actions">' + actions + '</div>' +
      '<h3 class="h6">Tâches de suivi</h3>' +
      '<ul class="pm-task-list">' + (tasks || '<li class="text-muted">Aucune tâche</li>') + '</ul>' +
      '<div class="pm-activity"><h3 class="h6">Activité</h3>' + (activities || '<div class="text-muted">—</div>') + '</div>';

    openDetailOverlay();

    document.getElementById('pm-detail-close').addEventListener('click', closeDetail);
    const createBtn = document.getElementById('pm-btn-create-devis');
    if (createBtn) {
      createBtn.addEventListener('click', function () { createDevis(card.cardId); });
    }
    const linkBtn = document.getElementById('pm-btn-link-devis');
    if (linkBtn) {
      linkBtn.addEventListener('click', function () { openLinkDevisModal(card.cardId); });
    }
    const syncBtn = document.getElementById('pm-btn-sync-devis');
    if (syncBtn && card.gderpi && card.gderpi.devisId) {
      syncBtn.addEventListener('click', function () { syncDevis(card.cardId, card.gderpi.devisId); });
    }
  }

  function openDetailOverlay() {
    const overlay = document.getElementById('pm-detail-overlay');
    if (!overlay) return;
    overlay.hidden = false;
    overlay.classList.add('is-open');
    document.body.classList.add('pm-detail-open');
  }

  function closeDetail() {
    const overlay = document.getElementById('pm-detail-overlay');
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('is-open');
    }
    document.body.classList.remove('pm-detail-open');
    state.selectedCard = null;
  }

  function openCard(cardId) {
    global.PmApi.call('/cards/' + encodeURIComponent(cardId)).then(function (res) {
      state.selectedCard = res.data;
      renderDetail(res.data);
    }).catch(function (err) {
      alert(err.message || 'Erreur chargement carte');
    });
  }

  function loadAll() {
    return Promise.all([
      global.PmApi.call('/boards/default'),
      global.PmApi.call('/cards'),
      global.PmApi.call('/integrations/gderpi/status'),
      global.PmApi.call('/integrations/annuaire/status')
    ]).then(function (results) {
      state.board = results[0].data;
      state.cards = results[1].data || [];
      state.gderpi = results[2].data;
      state.annuaire = results[3].data;
      renderCompatBadges();
      renderBoard();
    });
  }

  function pollInbox() {
    const btn = document.getElementById('pm-btn-poll');
    if (btn) btn.disabled = true;
    global.PmApi.call('/inbox/poll', { method: 'POST', body: '{}' })
      .then(function (res) {
        alert(res.data.message || res.message || 'Polling terminé');
        return loadAll();
      })
      .catch(function (err) {
        alert(err.message || 'Erreur polling mail');
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function createDevis(cardId) {
    if (!confirm('Créer un devis GDERPI en brouillon pour cette carte ?')) return;
    global.PmApi.call('/cards/' + encodeURIComponent(cardId) + '/gderpi/create-devis', {
      method: 'POST',
      body: '{}'
    }).then(function (res) {
      alert('Devis ' + (res.data.devis.numero || res.data.devis.devisId) + ' créé');
      closeDetail();
      return loadAll();
    }).catch(function (err) {
      alert(err.message || 'Erreur création devis');
    });
  }

  function openLinkDevisModal(cardId) {
    const modal = document.getElementById('pm-link-devis-modal');
    if (!modal) return;
    modal.hidden = false;
    modal.dataset.cardId = cardId;
    const search = document.getElementById('pm-link-devis-search');
    if (search) {
      search.value = '';
      search.focus();
    }
    refreshLinkDevisList('').catch(function (err) {
      alert(err.message || 'Erreur chargement devis');
    });
  }

  function closeLinkDevisModal() {
    const modal = document.getElementById('pm-link-devis-modal');
    if (modal) modal.hidden = true;
  }

  function refreshLinkDevisList(q) {
    const list = document.getElementById('pm-link-devis-list');
    if (!list) return Promise.resolve();
    list.innerHTML = '<li class="text-muted">Chargement…</li>';
    const params = new URLSearchParams({ unlinkedOnly: '1' });
    if (q) params.set('q', q);
    return global.PmApi.call('/integrations/gderpi/devis?' + params.toString()).then(function (res) {
      const items = res.data || [];
      if (!items.length) {
        list.innerHTML = '<li class="text-muted">Aucun devis disponible</li>';
        return;
      }
      list.innerHTML = items.map(function (d) {
        const label = (d.numero || d.devisId) + (d.objet ? ' — ' + d.objet : '');
        const meta = (d.statut ? statutLabel(d.statut) : '');
        return '<li><button type="button" class="pm-pick-devis" data-devis-id="' + esc(d.devisId) + '">' +
          esc(label) + (meta ? ' <span class="text-muted">(' + esc(meta) + ')</span>' : '') +
          '</button></li>';
      }).join('');
      list.querySelectorAll('.pm-pick-devis').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const modal = document.getElementById('pm-link-devis-modal');
          const cid = modal && modal.dataset.cardId;
          if (cid) linkDevis(cid, btn.getAttribute('data-devis-id'));
        });
      });
    });
  }

  function syncDevis(cardId, devisId) {
    global.PmApi.call('/cards/' + encodeURIComponent(cardId) + '/gderpi/sync-devis/' + encodeURIComponent(devisId), {
      method: 'POST',
      body: '{}'
    }).then(function (res) {
      state.selectedCard = res.data;
      renderDetail(res.data);
      alert('Carte synchronisée avec GDERPI');
      return loadAll();
    }).catch(function (err) {
      alert(err.message || 'Erreur synchronisation');
    });
  }

  function linkDevis(cardId, devisId) {
    const id = devisId || '';
    if (!id) return;
    global.PmApi.call('/cards/' + encodeURIComponent(cardId) + '/gderpi/link-devis', {
      method: 'POST',
      body: JSON.stringify({ devisId: id.trim() })
    }).then(function () {
      closeLinkDevisModal();
      alert('Devis lié');
      closeDetail();
      return loadAll();
    }).catch(function (err) {
      alert(err.message || 'Erreur liaison');
    });
  }

  function saveSettings() {
    const boutiqueId = (document.getElementById('pm-settings-boutique') || {}).value || '';
    global.PmApi.call('/settings', {
      method: 'PUT',
      body: JSON.stringify({ defaultBoutiqueId: boutiqueId.trim() || null })
    }).then(function () {
      return global.PmApi.call('/integrations/gderpi/status');
    }).then(function (res) {
      state.gderpi = res.data;
      renderGderpiBadge();
      alert('Paramètres enregistrés');
    }).catch(function (err) {
      alert(err.message || 'Erreur paramètres');
    });
  }

  function bindEvents() {
    const pollBtn = document.getElementById('pm-btn-poll');
    if (pollBtn) pollBtn.addEventListener('click', pollInbox);

    const refreshBtn = document.getElementById('pm-btn-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { loadAll(); });

    const settingsBtn = document.getElementById('pm-btn-settings-save');
    if (settingsBtn) settingsBtn.addEventListener('click', saveSettings);

    const overlay = document.getElementById('pm-detail-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeDetail();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeDetail();
        closeLinkDevisModal();
      }
    });

    const linkModalClose = document.getElementById('pm-link-devis-close');
    if (linkModalClose) linkModalClose.addEventListener('click', closeLinkDevisModal);
    const linkBackdrop = document.getElementById('pm-link-devis-backdrop');
    if (linkBackdrop) linkBackdrop.addEventListener('click', closeLinkDevisModal);
    const linkSearch = document.getElementById('pm-link-devis-search');
    if (linkSearch) {
      let timer;
      linkSearch.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          refreshLinkDevisList(linkSearch.value.trim()).catch(function (err) {
            alert(err.message || 'Erreur recherche');
          });
        }, 200);
      });
    }
  }

  function loadBoutiqueSelect(selectedId) {
    const sel = document.getElementById('pm-settings-boutique');
    if (!sel) return Promise.resolve();

    return global.PmApi.call('/integrations/gderpi/boutiques').then(function (res) {
      const boutiques = res.data || [];
      const current = selectedId || sel.value || '';
      if (!boutiques.length) {
        sel.innerHTML = '<option value="">GDERPI non disponible ou aucune boutique</option>';
        return;
      }
      sel.innerHTML =
        '<option value="">— Sélectionner une boutique —</option>' +
        boutiques.map(function (b) {
          const id = b.boutiqueId || '';
          const label = (b.nom || id) + (b.slug ? ' (' + b.slug + ')' : '');
          return '<option value="' + esc(id) + '">' + esc(label) + '</option>';
        }).join('');
      if (current) sel.value = current;
    }).catch(function () {
      sel.innerHTML = '<option value="">Impossible de charger les boutiques</option>';
    });
  }

  function init() {
    closeDetail();
    bindEvents();
    global.PmApi.call('/settings').then(function (res) {
      const saved = res.data ? (res.data.defaultBoutiqueId || '') : '';
      return loadBoutiqueSelect(saved);
    }).catch(function () {
      return loadBoutiqueSelect('');
    });
    loadAll().then(function () {
      const params = new URLSearchParams(window.location.search);
      const cardId = params.get('card');
      if (cardId) openCard(cardId);
    }).catch(function (err) {
      console.error('PM init:', err);
      const boardEl = document.getElementById('pm-board');
      if (boardEl) boardEl.innerHTML = '<div class="pm-empty">Impossible de charger le tableau PM.</div>';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
