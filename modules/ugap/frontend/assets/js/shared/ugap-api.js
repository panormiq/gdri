/**
 * FICHIER : modules/ugap/frontend/assets/js/shared/ugap-api.js
 * RÔLE : Appels API /api/ugap, alertes UI et escape HTML partagés (admin + onglets).
 * ENTRÉES : endpoints, options fetch ; messages pour alertes.
 * SORTIES : JSON API ; DOM alert-container ; chaînes échappées.
 * DÉPEND DE : fetch, document#getElementById('alert-container').
 * NE PAS : logique métier import, rendu tableaux, workflow staging.
 * APPELÉ PAR : admin.php, import/import-list.js, autres scripts UGAP admin.
 */
(function () {
    'use strict';

    function resolveUgapApiBase() {
        const root = (typeof window !== 'undefined' && window.API_BASE_URL)
            ? String(window.API_BASE_URL).replace(/\/$/, '')
            : 'http://localhost:3000/api';
        return `${root}/ugap`;
    }

    const API_BASE = resolveUgapApiBase();

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showAlert(message, type = 'info') {
        const container = document.getElementById('alert-container');
        if (!container) {
            console.log('[ugap-alert]', type, message);
            return;
        }
        container.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
        setTimeout(() => {
            container.innerHTML = '';
        }, 5000);
    }

    async function apiCall(endpoint, options = {}) {
        const { allowBusinessError = false, ...fetchOptions } = options || {};
        const url = `${resolveUgapApiBase()}${endpoint}`;
        const response = await fetch(url, {
            ...fetchOptions,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...fetchOptions.headers
            }
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Réponse non-JSON reçue:', text.substring(0, 200));
            throw new Error(
                `L'API a retourné du HTML au lieu de JSON (${response.status}). URL : ${url}. Vérifiez que le backend Node est démarré (route /import/detect-excel) et que vous êtes authentifié.`
            );
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `Erreur HTTP ${response.status}`);
        }

        if (!data.success && !allowBusinessError) {
            throw new Error(data.message || 'Erreur API');
        }
        return data;
    }

    window.UgapShared = {
        API_BASE,
        resolveUgapApiBase,
        escapeHtml,
        showAlert,
        apiCall
    };

    if (typeof window.escapeHtml !== 'function') {
        window.escapeHtml = escapeHtml;
    }
    if (typeof window.showAlert !== 'function') {
        window.showAlert = showAlert;
    }
    if (typeof window.apiCall !== 'function') {
        window.apiCall = apiCall;
    }
})();
