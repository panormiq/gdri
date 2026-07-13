/**
 * FICHIER : modules/gderpi/backend/services/articles/resolveArticlePrixVenteClient.js
 * RÔLE : Retourne le prix de vente HT et le flag prixSurDevis pour un client donné.
 *
 * ENTRÉES : article, clientId
 * SORTIES : { prixHt, prixSurDevis, hasTarifClient }
 *
 * DÉPEND DE : —
 * NE PAS : persistance
 *
 * APPELÉ PAR : (frontend devis via copie article)
 */

function isPrixSurDevis(value) {
  return value === true || value === 1 || String(value).toLowerCase() === 'true';
}

function resolveArticlePrixVenteClient(article, clientId) {
  const cataloguePrix = Number(article?.prixHt);
  const cataloguePrixHt = Number.isFinite(cataloguePrix) ? cataloguePrix : 0;
  const catalogueSurDevis = isPrixSurDevis(article?.prixSurDevis);

  const id = clientId != null ? String(clientId).trim() : '';
  if (!id || !article) {
    return {
      prixHt: catalogueSurDevis ? 0 : cataloguePrixHt,
      prixSurDevis: catalogueSurDevis,
      hasTarifClient: false
    };
  }

  const list = Array.isArray(article.refsClient) ? article.refsClient : [];
  const match = list.find((r) => String(r.clientId || '').trim() === id);
  if (!match) {
    return {
      prixHt: catalogueSurDevis ? 0 : cataloguePrixHt,
      prixSurDevis: catalogueSurDevis,
      hasTarifClient: false
    };
  }

  if (match.prixSurDevis === true) {
    return { prixHt: 0, prixSurDevis: true, hasTarifClient: true };
  }

  if (match.prixVenteHt != null && Number.isFinite(Number(match.prixVenteHt))) {
    return {
      prixHt: Math.round(Number(match.prixVenteHt) * 100) / 100,
      prixSurDevis: false,
      hasTarifClient: true
    };
  }

  return {
    prixHt: catalogueSurDevis ? 0 : cataloguePrixHt,
    prixSurDevis: catalogueSurDevis,
    hasTarifClient: Boolean(match.reference)
  };
}

module.exports = resolveArticlePrixVenteClient;
