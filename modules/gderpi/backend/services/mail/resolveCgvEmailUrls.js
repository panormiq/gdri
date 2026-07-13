/**
 * FICHIER : modules/gderpi/backend/services/mail/resolveCgvEmailUrls.js
 * RÔLE : URLs publiques CGV pour les e-mails documents (devis, commande, facture).
 */

const resolveCgvProfil = require('../pdf/resolveCgvProfil');
const { buildCgvViewUrl, buildCgvDownloadUrl } = require('../../utils/publicUrl');

function resolveCgvEmailUrls({ entrepriseId, boutique, devis, client }) {
  const slug = String(boutique?.slug || '').trim();
  if (!slug || boutique?.actif === false) {
    return { cgvViewUrl: null, cgvDownloadUrl: null };
  }

  const profil = resolveCgvProfil(devis || {}, client);
  return {
    cgvViewUrl: buildCgvViewUrl(entrepriseId, slug, { profil }),
    cgvDownloadUrl: buildCgvDownloadUrl(entrepriseId, slug, { profil })
  };
}

module.exports = resolveCgvEmailUrls;
