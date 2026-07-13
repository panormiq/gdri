/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/apiCall.js
 * RÔLE : Wrapper fetch authentifié vers /api/gderpi.
 *
 * ENTRÉES : path, options fetch (+ silent, loadingMessage, immediate)
 * SORTIES : JSON parsé
 *
 * DÉPEND DE : window.GDERPI_CONFIG, GderpiLoading
 * NE PAS : logique métier onglets
 *
 * APPELÉ PAR : tous les onglets GDERPI
 */
(function initGderpiApiCall(global) {
  'use strict';

  const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH']);

  function extractMeta(options) {
    const opts = options && typeof options === 'object' ? { ...options } : {};
    const meta = {
      silent: Boolean(opts.silent),
      immediate: Boolean(opts.immediate),
      loadingMessage: opts.loadingMessage
    };
    delete opts.silent;
    delete opts.immediate;
    delete opts.loadingMessage;
    return { fetchOptions: opts, meta };
  }

  function beginLoading(meta, method) {
    if (meta.silent || !global.GderpiLoading) return;
    const isMutation = MUTATION_METHODS.has(String(method || 'GET').toUpperCase());
    global.GderpiLoading.show({
      immediate: meta.immediate || isMutation,
      message: meta.loadingMessage || (isMutation ? 'Enregistrement…' : 'Chargement…')
    });
  }

  function endLoading(meta) {
    if (meta.silent || !global.GderpiLoading) return;
    global.GderpiLoading.hide();
  }

  async function apiCall(path, options) {
    const { fetchOptions, meta } = extractMeta(options);
    const method = String(fetchOptions.method || 'GET').toUpperCase();
    const cfg = global.GDERPI_CONFIG || {};
    const base = String(cfg.apiBase || '').replace(/\/$/, '');
    const jwt = String(cfg.jwt || '').trim();
    if (!base || !jwt) throw new Error('Configuration API GDERPI manquante');
    const url = base + '/gderpi' + (path.startsWith('/') ? path : '/' + path);

    beginLoading(meta, method);
    try {
      const res = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jwt,
          ...(fetchOptions.headers ? fetchOptions.headers : {})
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || ('Erreur HTTP ' + res.status));
      }
      return data;
    } finally {
      endLoading(meta);
    }
  }

  async function apiDownload(path, options) {
    const { fetchOptions, meta } = extractMeta(options);
    const cfg = global.GDERPI_CONFIG || {};
    const base = String(cfg.apiBase || '').replace(/\/$/, '');
    const jwt = String(cfg.jwt || '').trim();
    if (!base || !jwt) throw new Error('Configuration API GDERPI manquante');
    const url = base + '/gderpi' + (path.startsWith('/') ? path : '/' + path);

    beginLoading(meta, fetchOptions.method || 'GET');
    try {
      const res = await fetch(url, {
        ...fetchOptions,
        headers: {
          Authorization: 'Bearer ' + jwt,
          ...(fetchOptions.headers ? fetchOptions.headers : {})
        }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || ('Erreur HTTP ' + res.status));
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      return {
        blob,
        filename: match ? match[1] : 'document.pdf',
        contentType: res.headers.get('Content-Type') || blob.type || 'application/octet-stream'
      };
    } finally {
      endLoading(meta);
    }
  }

  global.GderpiApi = {
    apiCall,
    apiDownload,
    downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  };
})(window);
