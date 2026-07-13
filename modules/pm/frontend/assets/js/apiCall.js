/**
 * FICHIER : modules/pm/frontend/assets/js/apiCall.js
 * RÔLE : Wrapper fetch authentifié vers /api/pm.
 */
(function initPmApiCall(global) {
  'use strict';

  function apiCall(path, options) {
    const cfg = global.PM_CONFIG || {};
    const base = (cfg.apiBaseUrl || cfg.apiBase || '').replace(/\/$/, '');
    const token = cfg.jwtToken || cfg.jwt || '';
    const url = base + '/pm' + (path.startsWith('/') ? path : '/' + path);

    const opts = Object.assign({ credentials: 'include' }, options || {});
    opts.headers = Object.assign(
      { 'Content-Type': 'application/json', Accept: 'application/json' },
      opts.headers || {}
    );
    if (token) opts.headers.Authorization = 'Bearer ' + token;

    return fetch(url, opts).then(function (res) {
      return res.text().then(function (text) {
        let body = {};
        if (text) {
          try {
            body = JSON.parse(text);
          } catch (parseError) {
            const err = new Error(
              res.ok
                ? 'Réponse API PM invalide (JSON attendu)'
                : ('Erreur API PM (' + res.status + ')')
            );
            err.status = res.status;
            err.raw = text.slice(0, 200);
            throw err;
          }
        }
        if (!res.ok || body.success === false) {
          const err = new Error(body.message || ('Erreur HTTP ' + res.status));
          err.status = res.status;
          err.body = body;
          throw err;
        }
        return body;
      });
    });
  }

  global.PmApi = { call: apiCall };
})(window);
