(function initAnnuaireApi(global) {
  'use strict';

  function apiCall(path, options) {
    const cfg = global.ANNUAIRE_CONFIG || {};
    const base = (cfg.apiBase || cfg.apiBaseUrl || '').replace(/\/$/, '');
    const token = cfg.jwt || cfg.jwtToken || '';
    const url = base + '/annuaire' + (path.startsWith('/') ? path : '/' + path);
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
          try { body = JSON.parse(text); } catch (e) {
            throw new Error('Réponse API invalide (' + res.status + ')');
          }
        }
        if (!res.ok || body.success === false) {
          throw new Error(body.message || ('Erreur HTTP ' + res.status));
        }
        return body;
      });
    });
  }

  global.AnnuaireApi = { call: apiCall };
})(window);
