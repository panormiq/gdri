// src/modules/editor/shared/api/DocumentApi.js

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

export const documentApi = {
  async getAll() {
    try {
      log('📤 documentApi.getAll request started');
      const res = await fetch(`${getBaseApiUrl()}/documents`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      log('getAll fetch completed, status:', res.status);

      if (!res.ok) {
        let errorMessage = `HTTP ${res.status}`;
        try {
          const raw = await res.json();
          errorMessage = raw.error || raw.message || errorMessage;
        } catch (e) {
          try {
            const text = await res.text();
            if (text) errorMessage = text;
          } catch (e2) {
            // ignore parse error
          }
        }
        throw new Error(errorMessage);
      }

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

      const res = await fetch(`${getBaseApiUrl()}/documents/${id}`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });

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

      const res = await fetch(`${getBaseApiUrl()}/documents`, {
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
      console.error('❌ Erreur documentApi.create:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  async update(id, data) {
    try {
      log('📤 documentApi.update request started for id:', id, 'payload:', data);

      const res = await fetch(`${getBaseApiUrl()}/documents/${id}`, {
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
      console.error('❌ Erreur documentApi.update:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  async delete(id) {
    try {
      log('📤 documentApi.delete request started for id:', id);

      const res = await fetch(`${getBaseApiUrl()}/documents/${id}`, {
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

      const res = await fetch(`${getBaseApiUrl()}/documents/${id}/html`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });

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

      const res = await fetch(`${getBaseApiUrl()}/documents/${id}/pdf`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });

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
  },
  /**
   * Télécharge un PDF à partir d'un HTML fourni (viewer)
   */
  async downloadPdfFromHtml(html, filename) {
    try {
      log('📤 documentApi.downloadPdfFromHtml request started');

      const res = await fetch(`${getBaseApiUrl()}/documents/pdf-from-html`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ html })
      });

      log('downloadPdfFromHtml fetch completed, status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'viewer-export.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      return { success: true, data: {}, error: null };
    } catch (error) {
      console.error('❌ Erreur documentApi.downloadPdfFromHtml:', error);
      return { success: false, data: {}, error: error.message };
    }
  }
};

