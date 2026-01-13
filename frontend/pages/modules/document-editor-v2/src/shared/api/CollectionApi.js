// src/modules/collection-editor/api/collectionApi.js

// Utiliser window.API_BASE_URL si défini (pour intégration GDR), sinon fallback
const BASE_API_URL = window.API_BASE_URL || 'http://localhost:5005/api';
const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log(...args);
}

export const collectionApi = {
  async getAll() {
    try {
      log('📤 getAll request started');
      const res = await fetch(`${BASE_API_URL}/collections`, { credentials: 'include' });
      log('getAll fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 getAll Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? [], error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur getAll:', error);
      return { success: false, data: [], error: error.message };
    }
  },

  async create(data) {
    try {
      log('📤 create request started with payload:', data);

      const res = await fetch(`${BASE_API_URL}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });

      log('create fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 create Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? {}, error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur create:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  async update(id, data) {
    try {
      log('📤 update request started for id:', id, 'payload:', data);

      const res = await fetch(`${BASE_API_URL}/collections/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });

      log('update fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 update Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? {}, error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur update:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  async delete(id) {
    try {
      log('📤 delete request started for id:', id);

      const res = await fetch(`${BASE_API_URL}/collections/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      log('delete fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 delete Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? {}, error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur delete:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  async getFieldTypes() {
    try {
      log('📤 getFieldTypes request started');

      const res = await fetch(`${BASE_API_URL}/collections/fieldTypes`, { credentials: 'include' });

      log('getFieldTypes fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 getFieldTypes Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? [], error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur getFieldTypes:', error);
      return { success: false, data: [], error: error.message };
    }
  },
    async getCore() {
    try {
      log('📤 getcore request started');

      const res = await fetch(`${BASE_API_URL}/collections/core`, { credentials: 'include' });

      log('core fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 core Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? [], error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur getFieldTypes:', error);
      return { success: false, data: [], error: error.message };
    }
  },

  async getById(id) {
    try {
      log('📤 getById request started for id:', id);

      const res = await fetch(`${BASE_API_URL}/collections/${id}`, { credentials: 'include' });

      log('getById fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 getById Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? {}, error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur getById:', error);
      return { success: false, data: {}, error: error.message };
    }
  }
};
