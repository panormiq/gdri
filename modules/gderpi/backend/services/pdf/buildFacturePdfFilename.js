/**
 * FICHIER : modules/gderpi/backend/services/pdf/buildFacturePdfFilename.js
 * RÔLE : Nom de fichier PDF pour une facture client.
 */

function buildFacturePdfFilename(commande) {
  const raw = String(commande?.factureNumero || commande?.numero || commande?.id || 'facture').trim();
  const safe = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'facture';
  return `facture-${safe}.pdf`;
}

module.exports = buildFacturePdfFilename;
