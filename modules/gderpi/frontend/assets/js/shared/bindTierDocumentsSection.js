/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/bindTierDocumentsSection.js
 * RÔLE : Section pièces jointes réutilisable (clients / fournisseurs).
 */
(function initGderpiBindTierDocumentsSection(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);

  const DOCUMENT_TYPES = [
    { value: 'kbis', label: 'Kbis' },
    { value: 'rib', label: 'RIB' },
    { value: 'contrat', label: 'Contrat' },
    { value: 'devis', label: 'Devis' },
    { value: 'bon_commande', label: 'Bon de commande' },
    { value: 'facture', label: 'Facture' },
    { value: 'autre', label: 'Autre' }
  ];

  const TYPE_LABELS = DOCUMENT_TYPES.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
  }, {});

  function resolveMediaUrl(scope, filename) {
    const cfg = global.GDERPI_CONFIG || {};
    const entId = String(cfg.entrepriseId || '').trim();
    if (!entId || !scope || !filename) return '';
    const apiBase = String(cfg.apiBase || '').replace(/\/$/, '');
    const origin = apiBase.replace(/\/api$/i, '');
    return origin + '/api/gderpi/media/' + encodeURIComponent(entId) + '/' +
      encodeURIComponent(scope) + '/' + encodeURIComponent(filename);
  }

  function formatSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + ' o';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' Ko';
    return (n / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-FR');
  }

  function fillTypeSelect(selectEl, selected) {
    if (!selectEl) return;
    selectEl.innerHTML = DOCUMENT_TYPES.map((t) =>
      '<option value="' + esc(t.value) + '">' + esc(t.label) + '</option>'
    ).join('');
    selectEl.value = TYPE_LABELS[selected] ? selected : 'autre';
  }

  function getConfig(prefix) {
    return {
      prefix,
      sectionId: prefix + '-documents-section',
      tbodyId: prefix + '-documents-tbody',
      hintId: prefix + '-documents-hint',
      fileInputId: prefix + '-document-file',
      typeSelectId: prefix + '-document-type',
      labelInputId: prefix + '-document-label',
      uploadBtnId: prefix + '-document-upload'
    };
  }

  function renderDocuments(cfg, documents, tierId) {
    const section = document.getElementById(cfg.sectionId);
    const tbody = document.getElementById(cfg.tbodyId);
    const hint = document.getElementById(cfg.hintId);
    const uploadBtn = document.getElementById(cfg.uploadBtnId);
    const fileInput = document.getElementById(cfg.fileInputId);
    const typeSelect = document.getElementById(cfg.typeSelectId);
    const labelInput = document.getElementById(cfg.labelInputId);
    if (!section || !tbody) return;

    const hasTier = Boolean(String(tierId || '').trim());
    section.hidden = false;

    if (hint) {
      hint.textContent = hasTier
        ? 'PDF, Word, Excel, texte, CSV ou image (max 15 Mo).'
        : 'Enregistrez d\'abord la fiche pour ajouter des documents.';
    }
    if (uploadBtn) uploadBtn.disabled = !hasTier;
    if (fileInput) fileInput.disabled = !hasTier;
    if (typeSelect) typeSelect.disabled = !hasTier;
    if (labelInput) labelInput.disabled = !hasTier;

    const list = Array.isArray(documents) ? documents : [];
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Aucun document.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((doc) => {
      const url = resolveMediaUrl(doc.scope, doc.filename);
      const downloadUrl = url ? url + '?download=1' : '#';
      const viewUrl = url || '#';
      const typeLabel = TYPE_LABELS[doc.type] || doc.type || 'Autre';
      return '<tr data-doc-id="' + esc(doc.id) + '">' +
        '<td>' + esc(doc.label || doc.originalName || '—') + '</td>' +
        '<td>' + esc(typeLabel) + '</td>' +
        '<td>' + esc(formatSize(doc.sizeBytes)) + '</td>' +
        '<td>' + esc(formatDate(doc.uploadedAt)) + '</td>' +
        '<td class="gderpi-tier-doc-actions">' +
          (url ? '<a class="btn btn-outline btn-sm" href="' + esc(viewUrl) + '" target="_blank" rel="noopener">Ouvrir</a> ' : '') +
          (url ? '<a class="btn btn-outline btn-sm" href="' + esc(downloadUrl) + '">Télécharger</a> ' : '') +
          '<button type="button" class="btn btn-outline-danger btn-sm gderpi-tier-doc-del" data-doc-id="' + esc(doc.id) + '"' +
            (hasTier ? '' : ' disabled') + '>Suppr.</button>' +
        '</td></tr>';
    }).join('');
  }

  async function uploadDocument(apiBasePath, tierId, cfg) {
    const fileInput = document.getElementById(cfg.fileInputId);
    const file = fileInput?.files?.[0];
    if (!file) {
      global.GderpiStatus.showStatus('Sélectionnez un fichier.', 'warning');
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', document.getElementById(cfg.typeSelectId)?.value || 'autre');
    const label = document.getElementById(cfg.labelInputId)?.value?.trim();
    if (label) formData.append('label', label);

    const apiCfg = global.GDERPI_CONFIG || {};
    const base = String(apiCfg.apiBase || '').replace(/\/$/, '');
    const jwt = String(apiCfg.jwt || '').trim();
    if (!base || !jwt) throw new Error('Configuration API GDERPI manquante');

    global.GderpiLoading?.show?.({ immediate: true, message: 'Envoi du document…' });
    let res;
    try {
      res = await fetch(base + '/gderpi' + apiBasePath + '/' + encodeURIComponent(tierId) + '/documents', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + jwt },
        body: formData
      });
    } finally {
      global.GderpiLoading?.hide?.();
    }

    const raw = await res.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {}; }
    if (!res.ok || data.success === false) {
      throw new Error(data.message || 'Erreur upload document');
    }

    if (fileInput) fileInput.value = '';
    const labelInput = document.getElementById(cfg.labelInputId);
    if (labelInput) labelInput.value = '';
    global.GderpiStatus.showStatus('Document ajouté.', 'success');
    return data.data;
  }

  async function deleteDocument(apiBasePath, tierId, docId) {
    const res = await global.GderpiApi.apiCall(apiBasePath + '/' + encodeURIComponent(tierId) + '/documents/' + encodeURIComponent(docId), {
      method: 'DELETE'
    });
    global.GderpiStatus.showStatus('Document supprimé.', 'success');
    return res.data;
  }

  function bindDocumentsSection(options) {
    const cfg = getConfig(options.prefix);
    fillTypeSelect(document.getElementById(cfg.typeSelectId));

    const uploadBtn = document.getElementById(cfg.uploadBtnId);
    if (uploadBtn) {
      uploadBtn.addEventListener('click', async () => {
        const tierId = options.getTierId?.();
        if (!tierId) {
          global.GderpiStatus.showStatus('Enregistrez la fiche avant d\'ajouter un document.', 'warning');
          return;
        }
        try {
          const result = await uploadDocument(options.apiBasePath, tierId, cfg);
          if (!result) return;
          const tier = result.client || result.fournisseur || null;
          const docs = tier?.documents || [];
          renderDocuments(cfg, docs, tierId);
          if (typeof options.onChange === 'function') options.onChange(tier);
        } catch (err) {
          global.GderpiStatus.showStatus(err.message || 'Erreur upload', 'danger');
        }
      });
    }

    const tbody = document.getElementById(cfg.tbodyId);
    if (tbody) {
      tbody.addEventListener('click', async (ev) => {
        const btn = ev.target.closest('.gderpi-tier-doc-del');
        if (!btn) return;
        const docId = btn.getAttribute('data-doc-id');
        const tierId = options.getTierId?.();
        if (!tierId || !docId) return;
        if (!window.confirm('Supprimer ce document ?')) return;
        try {
          const tier = await deleteDocument(options.apiBasePath, tierId, docId);
          renderDocuments(cfg, tier?.documents || [], tierId);
          if (typeof options.onChange === 'function') options.onChange(tier);
        } catch (err) {
          global.GderpiStatus.showStatus(err.message || 'Erreur suppression', 'danger');
        }
      });
    }
  }

  global.GderpiTierDocuments = {
    DOCUMENT_TYPES,
    getConfig,
    renderDocuments,
    bindDocumentsSection
  };
})(window);
