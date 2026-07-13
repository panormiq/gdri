/**
 * FICHIER : frontend/pages/modules/document-agent-v2/assets/js/api.js
 * RÔLE : Appels API agent-documentaire-v2.
 */
(function initAdv2Api(global) {
  'use strict';

  const API_BASE = (global.API_BASE_URL || '/api').replace(/\/$/, '') + '/agent-documentaire-v2';

  async function api(path, options) {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
      ...options
    });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await res.text();
      throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    return data;
  }

  global.Adv2Api = {
    getTemplate(namespace) {
      return api(`/templates/${encodeURIComponent(namespace)}`);
    },
    saveTemplate(namespace, body) {
      return api(`/templates/${encodeURIComponent(namespace)}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
    },
    previewHtml(namespace, payload) {
      let variables = {};
      let template;
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        if (Object.prototype.hasOwnProperty.call(payload, 'variables')
          || Object.prototype.hasOwnProperty.call(payload, 'template')) {
          variables = payload.variables || {};
          template = payload.template;
        } else {
          variables = payload;
        }
      }
      return fetch(`${API_BASE}/templates/${encodeURIComponent(namespace)}/preview`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variables,
          template: template || undefined
        })
      });
    }
  };
}(window));
