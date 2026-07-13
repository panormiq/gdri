/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/resolveImageUrl.js
 * RÔLE : Résout une URL image (externe, uploadée ou legacy) pour affichage.
 *
 * ENTRÉES : url string
 * SORTIES : URL utilisable dans img src
 *
 * DÉPEND DE : GDERPI_CONFIG.apiBase
 * NE PAS : upload
 *
 * APPELÉ PAR : bindImageUploadField.js
 */
(function initGderpiResolveImageUrl(global) {
  'use strict';

  function normalizeStoredImagePath(url) {
    const raw = String(url || '').trim();
    if (!raw || /^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/uploads/gderpi/')) {
      return '/api/gderpi/media/' + raw.slice('/uploads/gderpi/'.length);
    }
    return raw;
  }

  function resolveImageUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw;

    const apiBase = String((global.GDERPI_CONFIG || {}).apiBase || '').replace(/\/$/, '');
    const origin = apiBase.replace(/\/api$/i, '');

    // URL externe (logo hébergé chez le client — se met à jour à la source)
    if (/^https?:\/\//i.test(raw)) return raw;

    // Upload GDERPI via API media
    if (raw.startsWith('/api/gderpi/media/')) {
      return origin + raw;
    }
    if (raw.startsWith('/gderpi/media/')) {
      return apiBase + raw;
    }

    // Ancien format statique -> API media
    if (raw.startsWith('/uploads/gderpi/')) {
      const suffix = raw.slice('/uploads/gderpi/'.length);
      return origin + '/api/gderpi/media/' + suffix;
    }

    return origin + (raw.startsWith('/') ? raw : '/' + raw);
  }

  global.GderpiImages = global.GderpiImages || {};
  global.GderpiImages.resolveImageUrl = resolveImageUrl;
  global.GderpiImages.normalizeStoredImagePath = normalizeStoredImagePath;
})(window);
