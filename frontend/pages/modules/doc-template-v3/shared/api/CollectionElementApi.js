// src/modules/editor/shared/api/CollectionElementApi.js

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
  if (DEBUG) console.log('[CollectionElementApi]', ...args);
}

export const collectionElementApi = {
  /* =========================
     GET
  ========================= */

  async getByCollection(collectionId) {
    try {
      const res = await fetch(
        `${getBaseApiUrl()}/collections/${collectionId}/elements`,
        {
          headers: getAuthHeaders(),
          credentials: 'include'
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('getByCollection:', raw);

      return {
        success: raw.success ?? false,
        data: raw.data ?? [],
        error: raw.error ?? null
      };
    } catch (error) {
      console.error('❌ getByCollection:', error);
      return { success: false, data: [], error: error.message };
    }
  },

 async getById(collectionId, elementId) {
  try {
    const res = await fetch(`${getBaseApiUrl()}/collections/${collectionId}/elements/${elementId}`, {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = await res.json();
    return { success: raw.success ?? false, data: raw.data ?? {}, error: raw.error ?? null };
  } catch (error) {
    console.error('❌ getById:', error);
    return { success: false, data: {}, error: error.message };
  }
},


  /* =========================
     CREATE
  ========================= */

  async create(collectionId, data) {
    try {
      const res = await fetch(
        `${getBaseApiUrl()}/collections/${collectionId}/elements`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify(data) // { values }
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('create:', raw);

      return {
        success: raw.success ?? false,
        data: raw.data ?? {},
        error: raw.error ?? null
      };
    } catch (error) {
      console.error('❌ create:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  /* =========================
     UPDATE
  ========================= */

  async update(collectionId, dataId, data) {
    try {
      console.log("📝 Update request:", {
        collectionId,
        dataId,
        data
      });
      
      const res = await fetch(
        `${getBaseApiUrl()}/collections/${collectionId}/elements/${dataId}`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify(data)
        }
      );
      
      const raw = await res.json();
      
      if (!res.ok) {
        console.error('❌ Update failed:', {
          status: res.status,
          error: raw.error || raw.message || 'Unknown error',
          response: raw
        });
        return {
          success: false,
          data: {},
          error: raw.error || raw.message || `HTTP ${res.status}`
        };
      }

      log('✅ update success:', raw);

      return {
        success: raw.success ?? false,
        data: raw.data ?? {},
        error: raw.error ?? null
      };
    } catch (error) {
      console.error('❌ update error:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  /* =========================
     DELETE
  ========================= */

  async delete(collectionId, dataId) {
    try {
      const res = await fetch(
        `${getBaseApiUrl()}/collections/${collectionId}/elements/${dataId}`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      log('delete:', raw);

      return {
        success: raw.success ?? false,
        data: raw.data ?? {},
        error: raw.error ?? null
      };
    } catch (error) {
      console.error('❌ delete:', error);
      return { success: false, data: {}, error: error.message };
    }
  }
};

export default collectionElementApi;
