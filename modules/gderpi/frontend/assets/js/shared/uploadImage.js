/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/uploadImage.js
 * RÔLE : Envoie une image vers POST /api/gderpi/uploads/image.
 *
 * ENTRÉES : File, scope (boutique-logo | article-image)
 * SORTIES : { url, path, scope, filename }
 *
 * DÉPEND DE : GDERPI_CONFIG
 * NE PAS : binding DOM
 *
 * APPELÉ PAR : bindImageUploadField.js
 */
(function initGderpiUploadImage(global) {
  'use strict';

  async function uploadImage(file, scope) {
    const cfg = global.GDERPI_CONFIG || {};
    const base = String(cfg.apiBase || '').replace(/\/$/, '');
    const jwt = String(cfg.jwt || '').trim();
    if (!base || !jwt) throw new Error('Configuration API GDERPI manquante');
    if (!file) throw new Error('Aucun fichier sélectionné');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('scope', String(scope || 'misc'));

    global.GderpiLoading?.show?.({ immediate: true, message: 'Envoi de l\'image…' });
    let res;
    try {
      res = await fetch(base + '/gderpi/uploads/image', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + jwt },
        body: formData
      });
    } finally {
      global.GderpiLoading?.hide?.();
    }
    const raw = await res.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_) {
      data = {};
    }
    if (!res.ok || data.success === false) {
      const fallback = res.status >= 500
        ? 'Erreur serveur lors de l\'upload de l\'image.'
        : ('Erreur upload HTTP ' + res.status);
      throw new Error(data.message || fallback);
    }
    if (!data.data) {
      throw new Error('Réponse upload invalide.');
    }
    return data.data;
  }

  global.GderpiImages = global.GderpiImages || {};
  global.GderpiImages.uploadImage = uploadImage;
})(window);
