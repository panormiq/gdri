/**
 * FICHIER : modules/gderpi/backend/services/pdf/buildAvoirPdfFilename.js
 */

function buildAvoirPdfFilename(commande) {
  const raw = String(commande?.avoirNumero || commande?.numero || commande?.id || 'avoir').trim();
  const safe = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'avoir';
  return `avoir-${safe}.pdf`;
}

module.exports = buildAvoirPdfFilename;
