/**
 * URL publique API pour les liens de téléchargement (emails)
 * Ne doit jamais produire localhost en production (sauf DOC_HUB_USE_LOCAL_LINKS=true).
 */

const config = require('../config.json');

const PRODUCTION_API_BASE =
  config.publicApiBase || 'https://www.gdr-innovation.fr/api';

function normalizeApiBase(url) {
  const u = String(url || '').replace(/\/$/, '');
  if (!u) return '';
  return u.endsWith('/api') ? u : `${u}/api`;
}

function isLocalhostUrl(url) {
  return /localhost|127\.0\.0\.1/i.test(String(url || ''));
}

function normalizePublicUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || isLocalhostUrl(trimmed)) return null;
  return normalizeApiBase(trimmed);
}

function isLocalDevMode() {
  return (
    process.env.DOC_HUB_USE_LOCAL_LINKS === 'true' ||
    process.env.DOC_HUB_USE_LOCAL_LINKS === '1' ||
    process.env.GDRI_DEV === 'true'
  );
}

/**
 * @returns {string} ex. https://www.gdr-innovation.fr/api
 */
function getPublicApiBaseUrl() {
  const candidates = [
    process.env.BACKEND_API_URL,
    process.env.DOC_HUB_PUBLIC_API_URL,
    process.env.DOC_HUB_PUBLIC_BASE_URL,
    process.env.APP_BASE_URL,
    process.env.FRONTEND_BASE_URL,
    process.env.PUBLIC_APP_URL,
    process.env.APP_URL
  ];

  for (const candidate of candidates) {
    const normalized = normalizePublicUrl(candidate);
    if (normalized) return normalized;
  }

  if (isLocalDevMode()) {
    const port = process.env.PORT || 3000;
    return `http://localhost:${port}/api`;
  }

  return normalizeApiBase(PRODUCTION_API_BASE);
}

/**
 * Lien de téléchargement (?t= — compatible Apache / proxies)
 */
function buildDownloadUrl(token) {
  const apiBase = getPublicApiBaseUrl();
  const encoded = encodeURIComponent(token);
  return `${apiBase}/doc-hub/public/download?t=${encoded}`;
}

module.exports = { getPublicApiBaseUrl, buildDownloadUrl, PRODUCTION_API_BASE };
