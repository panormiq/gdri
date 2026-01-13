// Fonction pour obtenir le BASE_API_URL de manière dynamique
// Priorité 1: Variable globale définie par PHP (la plus fiable)
// Priorité 2: Détection depuis window.location
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
// Note: Cette fonction n'est pas utilisée dans CommonApi.js mais est disponible pour cohérence
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

/* =========================
   AUTHENTICATION
========================= */
export const authApi = {
  isAuthenticated: () => {
    return Boolean(document.cookie.match(/userId=/));
  },

  getCurrentUser: async () => {
    try {
      const res = await fetch(`${getBaseApiUrl()}/users/me`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      log('📦 getCurrentUser Response:', raw);
      return { success: raw.success ?? false, data: raw.data ?? null, error: raw.error ?? null };
    } catch (error) {
      console.error('❌ Erreur getCurrentUser:', error);
      return { success: false, data: null, error: error.message };
    }
  },

  login: async (credentials) => {
    try {
      const res = await fetch(`${getBaseApiUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        credentials: 'include'
      });
      const raw = await res.json();
      log('📦 login Response:', raw);
      return { success: raw.success ?? false, data: raw.data ?? null, error: raw.error ?? null };
    } catch (error) {
      console.error('❌ Erreur login:', error);
      return { success: false, data: null, error: error.message };
    }
  },

  logout: async () => {
    try {
      const res = await fetch(`${getBaseApiUrl()}/auth/logout`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      log('📦 logout success');
      return { success: true };
    } catch (error) {
      console.error('❌ Erreur logout:', error);
      return { success: false };
    }
  }
};

/* =========================
   ENTREPRISE
========================= */
export const entrepriseApi = {
  async getMyEntreprises() {
    try {
      const res = await fetch(`${getBaseApiUrl()}/entreprises/current`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      log('📦 getMyEntreprises Response:', raw);

      if (raw.success) {
        const dataArray = Array.isArray(raw.data) ? raw.data : [raw.data];
        const currentId = raw.data?._id || (dataArray[0]?._id || null);
        return { success: true, data: dataArray, currentEntrepriseId: currentId };
      }

      return { success: false, data: [], error: raw.error ?? 'Erreur inconnue' };
    } catch (error) {
      console.error('❌ Erreur getMyEntreprises:', error);
      return { success: false, data: [], error: error.message };
    }
  },

  async setCurrentEntreprise(entrepriseId) {
    try {
      const res = await fetch(`${getBaseApiUrl()}/entreprises/set-current`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entrepriseId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      log('📦 setCurrentEntreprise Response:', raw);

      if (raw.success) return { success: true, data: raw.data, error: null };
      return { success: false, data: {}, error: raw.error ?? 'Erreur inconnue' };
    } catch (error) {
      console.error('❌ Erreur setCurrentEntreprise:', error);
      return { success: false, data: {}, error: error.message };
    }
  },

  async getAllEntreprises() {
    try {
      const res = await fetch(`${getBaseApiUrl()}/entreprises`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      log('📦 getAllEntreprises Response:', raw);

      if (raw.success) {
        const dataArray = Array.isArray(raw.data) ? raw.data : [raw.data];
        return { success: true, data: dataArray, error: null };
      }
      return { success: false, data: [], error: raw.error ?? 'Erreur inconnue' };
    } catch (error) {
      console.error('❌ Erreur getAllEntreprises:', error);
      return { success: false, data: [], error: error.message };
    }
  }
};

/* =========================
   EXPORT COMMON API
========================= */
export const commonApi = {
  auth: authApi,
  entreprise: entrepriseApi
};

export const commonApiUtils = {
  async checkAuthOrRedirect(redirectUrl = '/index.php?page=login') {
    try {
      const userRes = await authApi.getCurrentUser();
      if (!userRes.success || !userRes.data) {
        window.location.href = redirectUrl;
        return false;
      }
      return true;
    } catch {
      window.location.href = redirectUrl;
      return false;
    }
  
  }
};
