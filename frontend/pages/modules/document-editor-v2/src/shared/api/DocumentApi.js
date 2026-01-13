// src/modules/editor/shared/api/DocumentApi.js

// Utiliser window.API_BASE_URL si défini (pour intégration GDR), sinon fallback
const BASE_API_URL = window.API_BASE_URL || 'http://localhost:5005/api';
const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log(...args);
}

export const documentApi = {
  async getAll() {
    try {
      log('📤 documentApi.getAll request started');
      const res = await fetch(`${BASE_API_URL}/documents`, { credentials: 'include' });
      log('getAll fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 getAll Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? [], error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur documentApi.getAll:', error);
      return { success: false, data: [], error: error.message };
    }
  },

  async getById(id) {
    try {
      log('📤 documentApi.getById request started for id:', id);

      const res = await fetch(`${BASE_API_URL}/documents/${id}`, { credentials: 'include' });

      log('getById fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 getById Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? {}, error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur documentApi.getById:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  async create(data) {
    try {
      log('📤 documentApi.create request started with payload:', data);

      const res = await fetch(`${BASE_API_URL}/documents`, {
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
      console.error('❌ Erreur documentApi.create:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  async update(id, data) {
    try {
      log('📤 documentApi.update request started for id:', id, 'payload:', data);

      const res = await fetch(`${BASE_API_URL}/documents/${id}`, {
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
      console.error('❌ Erreur documentApi.update:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  async delete(id) {
    try {
      log('📤 documentApi.delete request started for id:', id);

      const res = await fetch(`${BASE_API_URL}/documents/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      log('delete fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 delete Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? {}, error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur documentApi.delete:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  /**
   * Récupère le HTML d'un document
   */
  async getHtml(id) {
    try {
      log('📤 documentApi.getHtml request started for id:', id);

      const res = await fetch(`${BASE_API_URL}/documents/${id}/html`, { credentials: 'include' });

      log('getHtml fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('📦 getHtml Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? {}, error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur documentApi.getHtml:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  /**
   * Télécharge le PDF d'un document
   */
  async downloadPdf(id, filename) {
    try {
      log('📤 documentApi.downloadPdf request started for id:', id);

      const res = await fetch(`${BASE_API_URL}/documents/${id}/pdf`, { credentials: 'include' });

      log('downloadPdf fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Récupérer le blob
      const blob = await res.blob();
      
      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      return { success: true, data: {}, error: null };

    } catch (error) {
      console.error('❌ Erreur documentApi.downloadPdf:', error);
      return { success: false, data: {}, error: error.message };
    }
  }
};

