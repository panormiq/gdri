// src/modules/editor/shared/api/TemplateApi.js

// Utiliser window.DOC_TEMPLATE_API_BASE si défini (pour intégration GDRI), sinon fallback
const getBaseApiUrl = () => {
    if (window.DOC_TEMPLATE_API_BASE) {
        return window.DOC_TEMPLATE_API_BASE;
    }
    // Utiliser window.API_BASE_URL si défini (depuis PHP)
    if (window.API_BASE_URL) {
        return window.API_BASE_URL + '/doc-template';
    }
    const pathname = window.location.pathname || '';
    const href = window.location.href || '';
    if (pathname.includes('/doc-template') || href.includes('/doc-template')) {
        return '/doc-template/api';
    }
    return '/api/doc-template';
};

// Fonction pour obtenir les headers (sans Authorization, on utilise les cookies HttpOnly)
const getAuthHeaders = (additionalHeaders = {}) => {
    return {
        'Content-Type': 'application/json',
        ...additionalHeaders
    };
};

const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log(...args);
}

export const templateApi = {
  async getAll() {
    try {
      log('📤 templateApi.getAll request started');
      const res = await fetch(`${getBaseApiUrl()}/templates`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      log('getAll fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 getAll Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? [], error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur templateApi.getAll:', error);
      return { success: false, data: [], error: error.message };
    }
  },

  async create(data) {
    try {
      log('📤 templateApi.create request started with payload:', data);

      const res = await fetch(`${getBaseApiUrl()}/templates`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(data)
      });

      log('create fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 create Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? {}, error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur templateApi.create:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  async update(id, data) {
    try {
      log('📤 templateApi.update request started for id:', id, 'payload:', data);

      const res = await fetch(`${getBaseApiUrl()}/templates/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(data)
      });

      log('update fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 update Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? {}, error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur templateApi.update:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  async delete(id) {
    try {
      log('📤 templateApi.delete request started for id:', id);

      const res = await fetch(`${getBaseApiUrl()}/templates/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      log('delete fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 delete Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? {}, error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur templateApi.delete:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  async getById(id) {
    try {
      log('📤 templateApi.getById request started for id:', id);

      const res = await fetch(`${getBaseApiUrl()}/templates/${id}`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      log('getById fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 getById Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? {}, error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur templateApi.getById:', error);
      return { success: false, data: {}, error: error.message };
    }
  }
};
