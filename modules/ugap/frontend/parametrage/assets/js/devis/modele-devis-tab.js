/**
 * FICHIER : modules/ugap/frontend/parametrage/assets/js/devis/modele-devis-tab.js
 * RÔLE : Modèles de devis canvas V2 — liste, création, duplication, édition.
 */
(function initUgapModeleDevisTab(global) {
  'use strict';

  const state = { mounted: false, templates: [], loading: false };

  function apiCall(endpoint, options) {
    if (typeof global.UgapShared?.apiCall === 'function') {
      return global.UgapShared.apiCall(endpoint, options);
    }
    return global.apiCall(endpoint, options);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function escHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setStatus(msg, type) {
    const el = byId('ugap-modele-devis-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'ugap-devis-form-status' + (type ? ` is-${type}` : '');
  }

  function resolveEditorUrl(templateNamespace) {
    const base = global.UgapDevisTemplateEditorBase
      || '/frontend/pages/modules/document-agent-v2/editor.php';
    const join = base.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    params.set('template', templateNamespace || 'ugap:devis:default');
    params.set('return', window.location.href);
    return `${base}${join}${params.toString()}`;
  }

  function encodeNs(namespace) {
    return encodeURIComponent(String(namespace || ''));
  }

  async function loadTemplates() {
    state.loading = true;
    renderGrid();
    try {
      const result = await apiCall('/devis/templates');
      state.templates = Array.isArray(result?.data?.templates) ? result.data.templates : [];
      setStatus('', '');
    } catch (error) {
      setStatus(error.message || 'Impossible de charger les modèles', 'error');
    } finally {
      state.loading = false;
      renderGrid();
    }
  }

  function openEditor(namespace) {
    window.open(resolveEditorUrl(namespace), '_blank', 'noopener');
  }

  async function createTemplate() {
    const name = window.prompt('Nom du nouveau modèle', 'Nouveau modèle devis');
    if (name == null) return;
    const label = String(name).trim();
    if (!label) {
      setStatus('Nom requis', 'error');
      return;
    }
    setStatus('Création…', '');
    try {
      await apiCall('/devis/templates', {
        method: 'POST',
        body: JSON.stringify({ name: label })
      });
      await loadTemplates();
      setStatus(`Modèle « ${label} » créé.`, 'success');
    } catch (error) {
      setStatus(error.message || 'Création impossible', 'error');
    }
  }

  async function duplicateTemplate(namespace, currentName) {
    const suggested = `${currentName || 'Modèle'} (copie)`;
    const name = window.prompt('Nom de la copie', suggested);
    if (name == null) return;
    setStatus('Duplication…', '');
    try {
      await apiCall(`/devis/templates/${encodeNs(namespace)}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ name: String(name).trim() || suggested })
      });
      await loadTemplates();
      setStatus('Modèle dupliqué.', 'success');
    } catch (error) {
      setStatus(error.message || 'Duplication impossible', 'error');
    }
  }

  async function renameTemplate(namespace, name) {
    const label = String(name || '').trim();
    if (!label) return;
    try {
      await apiCall(`/devis/templates/${encodeNs(namespace)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: label })
      });
      const item = state.templates.find((t) => t.namespace === namespace);
      if (item) item.name = label;
      setStatus('Nom enregistré.', 'success');
    } catch (error) {
      setStatus(error.message || 'Renommage impossible', 'error');
      await loadTemplates();
    }
  }

  async function setActiveTemplate(namespace) {
    setStatus('Mise à jour du modèle actif…', '');
    try {
      await apiCall('/devis/templates/active', {
        method: 'PUT',
        body: JSON.stringify({ namespace })
      });
      state.templates = state.templates.map((t) => ({
        ...t,
        isActive: t.namespace === namespace
      }));
      renderGrid();
      setStatus('Modèle actif mis à jour.', 'success');
    } catch (error) {
      setStatus(error.message || 'Impossible de définir le modèle actif', 'error');
    }
  }

  async function updateTemplateShortName(namespace, shortName) {
    const label = String(shortName || '').trim();
    const item = state.templates.find((t) => t.namespace === namespace);
    if (item && String(item.shortName || '').trim() === label) return;
    try {
      const updated = await apiCall(`/devis/templates/${encodeNs(namespace)}/prefs`, {
        method: 'PATCH',
        body: JSON.stringify({ shortName: label })
      });
      const row = updated?.data;
      if (row?.namespace) {
        state.templates = state.templates.map((t) => (
          t.namespace === row.namespace ? { ...t, ...row } : t
        ));
      }
      setStatus('Nom court enregistré.', 'success');
    } catch (error) {
      setStatus(error.message || 'Nom court non enregistré', 'error');
      await loadTemplates();
    }
  }

  async function updateTemplatePrefs(namespace, patch) {
    try {
      const updated = await apiCall(`/devis/templates/${encodeNs(namespace)}/prefs`, {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });
      const row = updated?.data;
      if (row?.namespace) {
        state.templates = state.templates.map((t) => (
          t.namespace === row.namespace
            ? { ...t, ...row }
            : patch.isDefaultPrint === true
              ? { ...t, isDefaultPrint: t.namespace === row.namespace }
              : t
        ));
      } else {
        await loadTemplates();
      }
      renderGrid();
      setStatus('Préférences enregistrées.', 'success');
    } catch (error) {
      setStatus(error.message || 'Enregistrement impossible', 'error');
      await loadTemplates();
    }
  }

  function renderCard(template) {
    const ns = template.namespace;
    const activeBadge = template.isActive
      ? '<span class="ugap-devis-template-badge is-active">Actif</span>'
      : '';
    const defaultBadge = template.isDefault
      ? '<span class="ugap-devis-template-badge is-default">Système</span>'
      : '';
    const defaultPrintBadge = template.isDefaultPrint
      ? '<span class="ugap-devis-template-badge is-default-print">Défaut impression</span>'
      : '';
    const activateBtn = template.isActive
      ? ''
      : `<button type="button" class="btn btn-outline btn-sm" data-template-action="activate" data-namespace="${escHtml(ns)}">Utiliser</button>`;

    return `
      <article class="ugap-devis-template-card${template.isActive ? ' is-active' : ''}" data-namespace="${escHtml(ns)}">
        <div class="ugap-devis-template-card-head">
          <input
            type="text"
            class="ugap-devis-template-name"
            value="${escHtml(template.name)}"
            data-namespace="${escHtml(ns)}"
            aria-label="Nom du modèle"
          >
          <div class="ugap-devis-template-badges">${defaultBadge}${activeBadge}${defaultPrintBadge}</div>
        </div>
        <p class="ugap-devis-template-meta"><code>${escHtml(ns)}</code></p>
        <label class="ugap-devis-template-short-name-wrap">
          <span class="ugap-devis-template-short-name-label">Nom court (bouton liste)</span>
          <input
            type="text"
            class="ugap-devis-template-short-name"
            value="${escHtml(template.shortName || '')}"
            data-namespace="${escHtml(ns)}"
            maxlength="48"
            placeholder="Ex: Standard, UGAP…"
            aria-label="Nom court du modèle"
          >
        </label>
        <div class="ugap-devis-template-prefs">
          <div class="ugap-devis-template-prefs-title">Impression</div>
          <label class="ugap-devis-template-pref">
            <input type="checkbox" data-template-pref="quickPrint" data-namespace="${escHtml(ns)}"${template.quickPrint ? ' checked' : ''}>
            <span>Utiliser en rapide</span>
          </label>
          <label class="ugap-devis-template-pref">
            <input type="checkbox" data-template-pref="showIncludedLines" data-namespace="${escHtml(ns)}"${template.showIncludedLines ? ' checked' : ''}>
            <span>Afficher les lignes incluses</span>
          </label>
          <label class="ugap-devis-template-pref">
            <input type="checkbox" data-template-pref="isDefaultPrint" data-namespace="${escHtml(ns)}"${template.isDefaultPrint ? ' checked' : ''}>
            <span>Modèle par défaut</span>
          </label>
        </div>
        <div class="ugap-devis-template-actions">
          <button type="button" class="btn btn-primary btn-sm" data-template-action="edit" data-namespace="${escHtml(ns)}">Éditer</button>
          <button type="button" class="btn btn-outline btn-sm" data-template-action="duplicate" data-namespace="${escHtml(ns)}" data-name="${escHtml(template.name)}">Dupliquer</button>
          ${activateBtn}
        </div>
      </article>
    `;
  }

  function renderGrid() {
    const grid = byId('ugap-modele-devis-grid');
    if (!grid) return;

    if (state.loading) {
      grid.innerHTML = '<p class="text-muted">Chargement des modèles…</p>';
      return;
    }

    if (!state.templates.length) {
      grid.innerHTML = '<p class="text-muted">Aucun modèle — créez-en un à partir du modèle système.</p>';
      return;
    }

    grid.innerHTML = state.templates.map(renderCard).join('');
  }

  function bindGridEvents() {
    const grid = byId('ugap-modele-devis-grid');
    if (!grid || grid.dataset.bound) return;
    grid.dataset.bound = '1';

    grid.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-template-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-template-action');
      const namespace = btn.getAttribute('data-namespace');
      if (!namespace) return;

      if (action === 'edit') {
        openEditor(namespace);
        return;
      }
      if (action === 'duplicate') {
        void duplicateTemplate(namespace, btn.getAttribute('data-name') || '');
        return;
      }
      if (action === 'activate') {
        void setActiveTemplate(namespace);
      }
    });

    grid.addEventListener('change', (ev) => {
      const prefInput = ev.target.closest('[data-template-pref]');
      if (prefInput) {
        const namespace = prefInput.getAttribute('data-namespace');
        const pref = prefInput.getAttribute('data-template-pref');
        if (!namespace || !pref) return;
        void updateTemplatePrefs(namespace, { [pref]: prefInput.checked });
        return;
      }
      const input = ev.target.closest('.ugap-devis-template-name');
      if (!input) return;
      void renameTemplate(input.getAttribute('data-namespace'), input.value);
    });

    grid.addEventListener('blur', (ev) => {
      const input = ev.target.closest('.ugap-devis-template-short-name');
      if (!input) return;
      const namespace = input.getAttribute('data-namespace');
      if (!namespace) return;
      void updateTemplateShortName(namespace, input.value);
    }, true);

    grid.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const input = ev.target.closest('.ugap-devis-template-name');
      if (!input) return;
      ev.preventDefault();
      input.blur();
    });
  }

  function bindEvents() {
    if (state.mounted) return;
    state.mounted = true;
    bindGridEvents();
    byId('ugap-modele-devis-create')?.addEventListener('click', () => void createTemplate());
  }

  function mount() {
    bindEvents();
    void loadTemplates();
  }

  global.UgapModeleDevisTab = { mount, loadTemplates, openEditor };
}(window));
