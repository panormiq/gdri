/**
 * FICHIER : modules/gderpi/frontend/assets/js/boutiques/bindBoutiqueConfig.js
 * RÔLE : CGV boutique — conditions de vente par blocs B2B / B2C.
 *
 * ENTRÉES : boutiqueId via sélecteur ou liste boutiques
 * SORTIES : sauvegarde conditions
 *
 * DÉPEND DE : GderpiApi, GderpiStatus, GderpiEscape, GderpiConditionsDefaults
 * NE PAS : CRUD boutique complet
 *
 * APPELÉ PAR : bindConfigurationTab.js, bindBoutiquesTab.js, initGderpiApp.js
 */
(function initGderpiBindBoutiqueConfig(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  let currentBoutiqueId = '';
  let currentBoutique = null;
  let activeConditionsTab = 'b2b';
  let boutiquesCache = [];

  const BLOCK_FIELDS = [
    { key: 'communes', id: 'gderpi-boutique-conditions-communes', label: 'Dispositions communes', group: 'common' },
    { key: 'paiementProModes', id: 'gderpi-boutique-conditions-paiement-pro-modes', label: 'Moyens de paiement (B2B)', group: 'b2b' },
    { key: 'paiementProDelais', id: 'gderpi-boutique-conditions-paiement-pro-delais', label: 'Délais et échéances (B2B)', group: 'b2b' },
    { key: 'livraisonPro', id: 'gderpi-boutique-conditions-livraison-pro', label: 'Livraison', group: 'b2b' },
    { key: 'garantiesPro', id: 'gderpi-boutique-conditions-garanties-pro', label: 'Garanties', group: 'b2b' },
    { key: 'litigesPro', id: 'gderpi-boutique-conditions-litiges-pro', label: 'Litiges', group: 'b2b' },
    { key: 'paiementParticulier', id: 'gderpi-boutique-conditions-paiement-particulier', label: 'Paiement', group: 'b2c' },
    { key: 'retourParticulier', id: 'gderpi-boutique-conditions-retour-particulier', label: 'Retours et rétractation', group: 'b2c' },
    { key: 'livraisonParticulier', id: 'gderpi-boutique-conditions-livraison-particulier', label: 'Livraison', group: 'b2c' },
    { key: 'garantiesParticulier', id: 'gderpi-boutique-conditions-garanties-particulier', label: 'Garanties', group: 'b2c' },
    { key: 'litigesParticulier', id: 'gderpi-boutique-conditions-litiges-particulier', label: 'Litiges et médiation', group: 'b2c' }
  ];

  const GROUP_LABELS = {
    common: 'Dispositions communes',
    b2b: 'B2B — Professionnels',
    b2c: 'B2C — Particuliers'
  };

  function cgvSelect() {
    return document.getElementById('gderpi-boutique-cgv-select');
  }

  function defaultsApi() {
    return global.GderpiConditionsDefaults || null;
  }

  function blocksFromBoutique(boutique) {
    const nested = boutique?.conditionsVenteBlocks || {};
    return { ...nested };
  }

  function hasAnyBlock(blocks) {
    return BLOCK_FIELDS.some((f) => String(blocks[f.key] || '').trim());
  }

  function applyDefaultsIfEmpty(blocks) {
    if (hasAnyBlock(blocks)) return blocks;
    const api = defaultsApi();
    if (!api) return blocks;
    return Object.assign({ communes: api.all.communes }, api.b2b(), api.b2c());
  }

  function fillConditionsFields(blocks) {
    BLOCK_FIELDS.forEach((f) => {
      const el = document.getElementById(f.id);
      if (el) el.value = blocks[f.key] || '';
    });
  }

  function collectConditionsBlocks() {
    const blocks = {};
    BLOCK_FIELDS.forEach((f) => {
      const el = document.getElementById(f.id);
      blocks[f.key] = el ? el.value.trim() : '';
    });
    return blocks;
  }

  function switchConditionsTab(tab) {
    activeConditionsTab = String(tab || 'b2b').trim();
    document.querySelectorAll('[data-gderpi-conditions-tab]').forEach((btn) => {
      const t = btn.getAttribute('data-gderpi-conditions-tab');
      const active = t === activeConditionsTab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-gderpi-conditions-panel]').forEach((panel) => {
      const active = panel.getAttribute('data-gderpi-conditions-panel') === activeConditionsTab;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
  }

  function resetTab(tab) {
    const api = defaultsApi();
    if (!api) return;
    const group = tab === 'b2c' ? 'b2c' : 'b2b';
    const defaults = group === 'b2c' ? api.b2c() : api.b2b();
    BLOCK_FIELDS.filter((f) => f.group === group).forEach((f) => {
      const el = document.getElementById(f.id);
      if (el) el.value = defaults[f.key] || '';
    });
    global.GderpiStatus.showStatus('Modèle ' + group.toUpperCase() + ' réinitialisé (non enregistré).', 'info');
  }

  function renderReadonlyBlocks(blocks) {
    const wrap = document.getElementById('gderpi-boutique-conditions-readonly');
    if (!wrap) return;
    const groups = ['common', 'b2b', 'b2c'];
    wrap.innerHTML = groups.map((group) => {
      const fields = BLOCK_FIELDS.filter((f) => f.group === group);
      const body = fields.map((f) => {
        const key = f.key;
        if (!String(blocks[key] || '').trim()) return '';
        return '<div class="gderpi-conditions-readonly__block"><strong>' + esc(f.label) + '</strong>' +
          '<div>' + esc(blocks[key]).replace(/\n/g, '<br>') + '</div></div>';
      }).join('');
      return '<div class="gderpi-conditions-readonly__section">' +
        '<h4 class="gderpi-conditions-readonly__section-title">' + esc(GROUP_LABELS[group]) + '</h4>' +
        body + '</div>';
    }).join('');
  }

  function updateSubtitle(boutique) {
    const subtitle = document.getElementById('gderpi-boutique-config-subtitle');
    if (!subtitle) return;
    const name = boutique?.nom || boutique?.raisonSociale || '';
    subtitle.textContent = name ? ('Boutique : ' + name) : 'Sélectionnez une boutique';
  }

  function fillConditionsPanel(boutique) {
    const blocks = applyDefaultsIfEmpty(blocksFromBoutique(boutique));
    fillConditionsFields(blocks);
    renderReadonlyBlocks(blocks);
    switchConditionsTab(activeConditionsTab);
    updateSubtitle(boutique);
  }

  function renderCgvSelectOptions(items, selectedId) {
    const select = cgvSelect();
    if (!select) return;
    if (!items.length) {
      select.innerHTML = '<option value="">Aucune boutique</option>';
      select.disabled = true;
      return;
    }
    select.disabled = false;
    select.innerHTML = items.map((b) => {
      const id = String(b.boutiqueId || '').trim();
      const label = b.nom || b.raisonSociale || id;
      const selected = id === selectedId ? ' selected' : '';
      return '<option value="' + esc(id) + '"' + selected + '>' + esc(label) + '</option>';
    }).join('');
    if (selectedId && items.some((b) => String(b.boutiqueId) === selectedId)) {
      select.value = selectedId;
    } else if (items[0]) {
      select.value = String(items[0].boutiqueId || '');
    }
  }

  async function loadBoutiquesForCgv() {
    const res = await global.GderpiApi.apiCall('/boutiques');
    boutiquesCache = res.data || [];
    return boutiquesCache;
  }

  function resolveCgvBoutiqueId(preferredId) {
    const fromList = global.GderpiBoutiquesTab?.getSelectedBoutiqueId?.();
    const id = String(preferredId || fromList || currentBoutiqueId || '').trim();
    if (id) return id;
    const first = boutiquesCache.find((b) => b.actif !== false) || boutiquesCache[0];
    return first ? String(first.boutiqueId || '').trim() : '';
  }

  async function loadBoutique(id) {
    const boutiqueId = String(id || '').trim();
    if (!boutiqueId) {
      currentBoutiqueId = '';
      currentBoutique = null;
      updateSubtitle(null);
      return null;
    }
    const res = await global.GderpiApi.apiCall('/boutiques/' + encodeURIComponent(boutiqueId));
    currentBoutiqueId = boutiqueId;
    currentBoutique = res.data || {};
    activeConditionsTab = 'b2b';
    fillConditionsPanel(currentBoutique);
    global.GderpiBoutiquesTab?.setSelectedBoutiqueId?.(boutiqueId);
    syncCgvSelect(boutiqueId);
    return currentBoutique;
  }

  function syncCgvSelect(boutiqueId) {
    const select = cgvSelect();
    if (!select || !boutiqueId) return;
    if (select.querySelector('option[value="' + boutiqueId.replace(/"/g, '') + '"]')) {
      select.value = boutiqueId;
    }
  }

  async function openCgvTab() {
    const items = await loadBoutiquesForCgv();
    const targetId = resolveCgvBoutiqueId();
    renderCgvSelectOptions(items, targetId);
    if (!targetId) {
      global.GderpiStatus.showStatus('Créez d\'abord une boutique dans Configuration → Boutiques.', 'warning');
      return;
    }
    const boutique = await loadBoutique(targetId);
    if (!boutique) return;
    const blocks = blocksFromBoutique(boutique);
    if (!hasAnyBlock(blocks)) {
      global.GderpiStatus.showStatus('Modèles B2B/B2C préremplis — modifiez puis enregistrez.', 'info');
    }
  }

  async function openConfig(boutiqueId) {
    if (typeof global.GderpiAppNav === 'function') {
      global.GderpiBoutiquesTab?.setSelectedBoutiqueId?.(boutiqueId);
      global.GderpiAppNav('configuration', { configTab: 'boutiques-cgv' });
      return;
    }
    await loadBoutique(boutiqueId);
  }

  async function saveConditions() {
    if (!currentBoutiqueId) return;
    const conditionsVenteBlocks = collectConditionsBlocks();
    await global.GderpiApi.apiCall('/boutiques/' + encodeURIComponent(currentBoutiqueId), {
      method: 'PUT',
      body: JSON.stringify({ conditionsVenteBlocks })
    });
    if (currentBoutique) {
      currentBoutique.conditionsVenteBlocks = conditionsVenteBlocks;
    }
    renderReadonlyBlocks(conditionsVenteBlocks);
    global.GderpiStatus.showStatus('Conditions de vente enregistrées.', 'success');
  }

  function bindBoutiqueConfig() {
    const saveBtn = document.getElementById('gderpi-boutique-conditions-save');
    const resetB2bBtn = document.getElementById('gderpi-boutique-conditions-reset-b2b');
    const resetB2cBtn = document.getElementById('gderpi-boutique-conditions-reset-b2c');
    const select = cgvSelect();

    if (select) {
      select.addEventListener('change', () => {
        loadBoutique(select.value).catch((err) => {
          global.GderpiStatus.showStatus(err.message || 'Erreur chargement boutique', 'danger');
        });
      });
    }
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        saveConditions().catch((err) => {
          global.GderpiStatus.showStatus(err.message || 'Erreur enregistrement', 'danger');
        });
      });
    }
    if (resetB2bBtn) {
      resetB2bBtn.addEventListener('click', () => resetTab('b2b'));
    }
    if (resetB2cBtn) {
      resetB2cBtn.addEventListener('click', () => resetTab('b2c'));
    }

    document.querySelectorAll('[data-gderpi-conditions-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchConditionsTab(btn.getAttribute('data-gderpi-conditions-tab'));
      });
    });
  }

  global.GderpiBoutiqueConfig = {
    bindBoutiqueConfig,
    openConfig,
    openCgvTab,
    syncCgvSelect,
    loadBoutique
  };
})(window);
