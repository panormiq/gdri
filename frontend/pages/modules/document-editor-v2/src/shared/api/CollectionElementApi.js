// src/modules/editor/shared/api/CollectionElementApi.js

// Utiliser window.API_BASE_URL si défini (pour intégration GDR), sinon fallback
const BASE_API_URL = window.API_BASE_URL || 'http://localhost:5005/api';
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
        `${BASE_API_URL}/collections/${collectionId}/data`,
        { credentials: 'include' }
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
    const res = await fetch(`${BASE_API_URL}/collections/${collectionId}/data/${elementId}`, {
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
        `${BASE_API_URL}/collections/${collectionId}/data`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        `${BASE_API_URL}/collections/${collectionId}/data/${dataId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
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
        `${BASE_API_URL}/collections/${collectionId}/data/${dataId}`,
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
