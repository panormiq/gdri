/**

 * URL publique API pour les liens documents GDERPI (emails)

 */



const PRODUCTION_API_BASE = 'https://www.gdr-innovation.fr/api';



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

    process.env.GDERPI_USE_LOCAL_LINKS === 'true' ||

    process.env.GDERPI_USE_LOCAL_LINKS === '1' ||

    process.env.GDRI_DEV === 'true'

  );

}



function getPublicApiBaseUrl() {

  const candidates = [

    process.env.BACKEND_API_URL,

    process.env.GDERPI_PUBLIC_API_URL,

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



function buildPublicDocUrl(entrepriseId, docSegment, action, token, query = {}) {

  const apiBase = getPublicApiBaseUrl();

  const encoded = encodeURIComponent(token);

  const params = new URLSearchParams({ t: encoded });

  Object.entries(query).forEach(([key, value]) => {

    if (value != null && value !== '') params.set(key, String(value));

  });

  return `${apiBase}/gderpi/public/${docSegment}/${encodeURIComponent(entrepriseId)}/${action}?${params.toString()}`;

}



function buildDevisViewUrl(entrepriseId, token) {

  return buildPublicDocUrl(entrepriseId, 'devis', 'html', token);

}



function buildDevisDownloadUrl(entrepriseId, token, { economy = false } = {}) {

  return buildPublicDocUrl(entrepriseId, 'devis', 'pdf', token, economy ? { economy: '1' } : {});

}



function buildDevisAcceptUrl(entrepriseId, token) {

  const apiBase = getPublicApiBaseUrl();

  const encoded = encodeURIComponent(token);

  return `${apiBase}/gderpi/public/devis/${encodeURIComponent(entrepriseId)}/accept?t=${encoded}`;

}



function buildCommandeClientViewUrl(entrepriseId, token) {

  return buildPublicDocUrl(entrepriseId, 'commande-client', 'html', token);

}



function buildCommandeClientDownloadUrl(entrepriseId, token, { economy = false } = {}) {

  return buildPublicDocUrl(entrepriseId, 'commande-client', 'pdf', token, economy ? { economy: '1' } : {});

}



function buildCommandeFournisseurViewUrl(entrepriseId, token) {

  return buildPublicDocUrl(entrepriseId, 'commande-fournisseur', 'html', token);

}



function buildCommandeFournisseurDownloadUrl(entrepriseId, token) {

  return buildPublicDocUrl(entrepriseId, 'commande-fournisseur', 'pdf', token);

}



function buildFactureViewUrl(entrepriseId, token) {

  return buildPublicDocUrl(entrepriseId, 'facture', 'html', token);

}



function buildFactureDownloadUrl(entrepriseId, token, { economy = false } = {}) {

  return buildPublicDocUrl(entrepriseId, 'facture', 'pdf', token, economy ? { economy: '1' } : {});

}



function buildAvoirViewUrl(entrepriseId, token) {

  return buildPublicDocUrl(entrepriseId, 'avoir', 'html', token);

}



function buildAvoirDownloadUrl(entrepriseId, token, { economy = false } = {}) {

  return buildPublicDocUrl(entrepriseId, 'avoir', 'pdf', token, economy ? { economy: '1' } : {});

}



function buildCgvViewUrl(entrepriseId, boutiqueSlug, { profil = 'b2b' } = {}) {

  const apiBase = getPublicApiBaseUrl();

  const slug = String(boutiqueSlug || '').trim();

  const profile = String(profil || 'b2b').trim().toLowerCase() === 'b2c' ? 'b2c' : 'b2b';

  const params = new URLSearchParams({ profil: profile });

  return `${apiBase}/gderpi/public/cgv/${encodeURIComponent(entrepriseId)}/${encodeURIComponent(slug)}?${params.toString()}`;

}



function buildCgvDownloadUrl(entrepriseId, boutiqueSlug, { profil = 'b2b' } = {}) {

  const apiBase = getPublicApiBaseUrl();

  const slug = String(boutiqueSlug || '').trim();

  const profile = String(profil || 'b2b').trim().toLowerCase() === 'b2c' ? 'b2c' : 'b2b';

  const params = new URLSearchParams({ profil: profile });

  return `${apiBase}/gderpi/public/cgv/${encodeURIComponent(entrepriseId)}/${encodeURIComponent(slug)}/pdf?${params.toString()}`;

}



module.exports = {

  getPublicApiBaseUrl,

  buildPublicDocUrl,

  buildDevisViewUrl,

  buildDevisDownloadUrl,

  buildDevisAcceptUrl,

  buildCommandeClientViewUrl,

  buildCommandeClientDownloadUrl,

  buildCommandeFournisseurViewUrl,

  buildCommandeFournisseurDownloadUrl,

  buildFactureViewUrl,

  buildFactureDownloadUrl,

  buildAvoirViewUrl,

  buildAvoirDownloadUrl,

  buildCgvViewUrl,

  buildCgvDownloadUrl,

  PRODUCTION_API_BASE

};


