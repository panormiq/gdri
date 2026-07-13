/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/resolveArticleTarifClient.js
 * RÔLE : Résout référence et prix de vente article pour un client donné.
 *
 * ENTRÉES : article, clientId
 * SORTIES : { reference, prixHt, prixSurDevis }
 *
 * DÉPEND DE : —
 * NE PAS : appels API
 *
 * APPELÉ PAR : bindDevisTab.js, bindCommandeClientEditor.js
 */

(function initGderpiResolveArticleTarifClient(global) {
  'use strict';

  function isPrixSurDevis(value) {
    return value === true || value === 1 || String(value).toLowerCase() === 'true';
  }

  function resolveArticleTarifClient(article, clientId) {
    const id = clientId != null ? String(clientId).trim() : '';
    const cataloguePrix = Number(article?.prixHt);
    const cataloguePrixHt = Number.isFinite(cataloguePrix) ? cataloguePrix : 0;
    const catalogueSurDevis = isPrixSurDevis(article?.prixSurDevis);

    if (!id || !article) {
      return {
        reference: '',
        prixHt: catalogueSurDevis ? 0 : cataloguePrixHt,
        prixSurDevis: catalogueSurDevis
      };
    }

    const list = Array.isArray(article.refsClient) ? article.refsClient : [];
    const match = list.find((r) => String(r.clientId || '').trim() === id);

    if (!match) {
      return {
        reference: '',
        prixHt: catalogueSurDevis ? 0 : cataloguePrixHt,
        prixSurDevis: catalogueSurDevis
      };
    }

    if (match.prixSurDevis === true) {
      return { reference: String(match.reference || '').trim(), prixHt: 0, prixSurDevis: true };
    }

    if (match.prixVenteHt != null && match.prixVenteHt !== '' && Number.isFinite(Number(match.prixVenteHt))) {
      return {
        reference: String(match.reference || '').trim(),
        prixHt: Math.round(Number(match.prixVenteHt) * 100) / 100,
        prixSurDevis: false
      };
    }

    return {
      reference: String(match.reference || '').trim(),
      prixHt: catalogueSurDevis ? 0 : cataloguePrixHt,
      prixSurDevis: catalogueSurDevis
    };
  }

  global.GderpiArticleTarif = { resolveArticleTarifClient };
})(window);
