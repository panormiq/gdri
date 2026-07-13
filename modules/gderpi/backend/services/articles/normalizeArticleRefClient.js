/**
 * FICHIER : modules/gderpi/backend/services/articles/normalizeArticleRefClient.js
 * RÔLE : Normalise un tarif / référence article propre à un client.
 *
 * ENTRÉES : raw { clientId, reference, prixVenteHt, prixSurDevis }
 * SORTIES : objet normalisé
 *
 * DÉPEND DE : —
 * NE PAS : persistance
 *
 * APPELÉ PAR : normalizeArticleRefsClient.js
 */

function normalizePrixSurDevis(value) {
  return value === true || value === 1 || String(value).toLowerCase() === 'true';
}

function normalizeArticleRefClient(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const prixVenteHt = r.prixVenteHt;
  let prixVente = null;
  if (prixVenteHt !== null && prixVenteHt !== undefined && String(prixVenteHt).trim() !== '') {
    const n = Number(prixVenteHt);
    if (Number.isFinite(n) && n >= 0) prixVente = Math.round(n * 100) / 100;
  }
  return {
    clientId: String(r.clientId || '').trim(),
    reference: String(r.reference || '').trim(),
    prixVenteHt: prixVente,
    prixSurDevis: normalizePrixSurDevis(r.prixSurDevis)
  };
}

module.exports = normalizeArticleRefClient;
