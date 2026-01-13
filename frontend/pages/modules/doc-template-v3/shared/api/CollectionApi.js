// src/modules/collection-editor/api/collectionApi.js

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

// Fonction utilitaire pour gérer les erreurs 401
function handleAuthError(status) {
  if (status === 401) {
    console.warn('⚠️ Non authentifié, redirection vers la page de login');
    // Rediriger vers la page d'accueil (qui affichera le login)
    window.location.href = '/doc-template/index.php';
    return true; // Indique qu'on a géré l'erreur
  }
  return false;
}

export const collectionApi = {
  async getAll() {
    try {
      const apiUrl = getBaseApiUrl();
      log('📤 getAll request started');
      log('🔗 URL complète:', `${apiUrl}/collections`);
      const res = await fetch(`${apiUrl}/collections`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      log('getAll fetch completed, status:', res.status);

      if (!res.ok) {
        if (handleAuthError(res.status)) {
          return { success: false, data: [], error: 'Authentification requise' };
        }
        throw new Error(`HTTP ${res.status}`);
      }

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

      const res = await fetch(`${getBaseApiUrl()}/collections`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(data)
      });

      log('create fetch completed, status:', res.status);

      if (!res.ok) {
        if (handleAuthError(res.status)) {
          return { success: false, data: {}, error: 'Authentification requise' };
        }
        throw new Error(`HTTP ${res.status}`);
      }

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

      const res = await fetch(`${getBaseApiUrl()}/collections/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(data)
      });

      log('update fetch completed, status:', res.status);

      if (!res.ok) {
        if (handleAuthError(res.status)) {
          return { success: false, data: {}, error: 'Authentification requise' };
        }
        throw new Error(`HTTP ${res.status}`);
      }

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

      const res = await fetch(`${getBaseApiUrl()}/collections/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      log('delete fetch completed, status:', res.status);

      if (!res.ok) {
        if (handleAuthError(res.status)) {
          return { success: false, data: {}, error: 'Authentification requise' };
        }
        throw new Error(`HTTP ${res.status}`);
      }

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

      const res = await fetch(`${getBaseApiUrl()}/collections/fieldTypes`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      log('getFieldTypes fetch completed, status:', res.status);

      if (!res.ok) {
        if (handleAuthError(res.status)) {
          return { success: false, data: [], error: 'Authentification requise' };
        }
        throw new Error(`HTTP ${res.status}`);
      }

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

      const res = await fetch(`${getBaseApiUrl()}/collections/core`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      log('core fetch completed, status:', res.status);

      if (!res.ok) {
        if (handleAuthError(res.status)) {
          return { success: false, data: [], error: 'Authentification requise' };
        }
        throw new Error(`HTTP ${res.status}`);
      }

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

      const res = await fetch(`${getBaseApiUrl()}/collections/${id}`, { credentials: 'include' });

      log('getById fetch completed, status:', res.status);

      if (!res.ok) {
        if (handleAuthError(res.status)) {
          return { success: false, data: {}, error: 'Authentification requise' };
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const raw = await res.json();
      log('📦 getById Response:', raw);

      return { success: raw.success ?? false, data: raw.data ?? {}, error: raw.error ?? null };

    } catch (error) {
      console.error('❌ Erreur getById:', error);
      return { success: false, data: {}, error: error.message };
    }
  }
};
