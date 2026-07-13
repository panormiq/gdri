/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/previewDocumentHtml.js
 * RÔLE : Aperçu HTML et téléchargement PDF réutilisables (modale iframe partagée).
 */

(function initGderpiPreviewDocumentHtml(global) {
  'use strict';

  const PREVIEW_LOADING_HTML = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Aperçu</title></head><body style="font-family:sans-serif;padding:2rem;color:#334155">Chargement de l\'aperçu…</body></html>';

  let previewModal = null;

  function ensurePreviewModal(title) {
    const el = document.getElementById('gderpi-devis-preview-modal');
    const iframe = document.getElementById('gderpi-devis-preview-iframe');
    if (!el || !iframe) return null;

    if (!previewModal) {
      previewModal = global.GderpiModal.enhance(el, {
        title: title || 'Aperçu document',
        onClose: () => { iframe.srcdoc = ''; }
      });
    } else if (typeof previewModal.setTitle === 'function') {
      previewModal.setTitle(title || 'Aperçu document');
    }
    return previewModal;
  }

  async function previewHtml(title, htmlApiPath) {
    const modal = ensurePreviewModal(title);
    const iframe = document.getElementById('gderpi-devis-preview-iframe');
    if (!modal || !iframe) {
      throw new Error('Impossible d\'ouvrir l\'aperçu.');
    }

    modal.open();
    iframe.srcdoc = PREVIEW_LOADING_HTML;

    try {
      const res = await global.GderpiApi.apiCall(htmlApiPath);
      const html = res?.data?.html;
      if (!html) throw new Error('Réponse HTML vide');
      iframe.srcdoc = html;
      global.GderpiStatus.showStatus('Aperçu affiché.', 'success');
    } catch (err) {
      modal.close();
      iframe.srcdoc = '';
      throw err;
    }
  }

  async function downloadPdf(pdfApiPath, statusLabel) {
    global.GderpiStatus.showStatus(statusLabel || 'Génération du PDF…', 'secondary');
    const file = await global.GderpiApi.apiDownload(pdfApiPath);
    global.GderpiApi.downloadBlob(file.blob, file.filename);
    global.GderpiStatus.showStatus('PDF téléchargé.', 'success');
  }

  global.GderpiDocumentPreview = {
    previewHtml,
    downloadPdf
  };
})(window);
