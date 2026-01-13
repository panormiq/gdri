// src/modules/editor/shared/api/TemplateApi.js

// Utiliser window.API_BASE_URL si défini (pour intégration GDR), sinon fallback
const BASE_API_URL = window.API_BASE_URL || 'http://localhost:5005/api';
const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log(...args);
}

export const templateApi = {
  async getAll() {
    try {
      log('📤 templateApi.getAll request started');
      const res = await fetch(`${BASE_API_URL}/templates`, { credentials: 'include' });
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

      const res = await fetch(`${BASE_API_URL}/templates`, {
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
      console.error('❌ Erreur templateApi.create:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  async update(id, data) {
    try {
      log('📤 templateApi.update request started for id:', id, 'payload:', data);

      const res = await fetch(`${BASE_API_URL}/templates/${id}`, {
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
      console.error('❌ Erreur templateApi.update:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  async delete(id) {
    try {
      log('📤 templateApi.delete request started for id:', id);

      const res = await fetch(`${BASE_API_URL}/templates/${id}`, {
        method: 'DELETE',
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

      const res = await fetch(`${BASE_API_URL}/templates/${id}`, { credentials: 'include' });

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
