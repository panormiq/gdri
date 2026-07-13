/**
 * FICHIER : modules/gderpi/backend/services/pdf/buildCommandeFournisseurPdfFilename.js
 * RÔLE : Nom de fichier PDF pour une commande fournisseur.
 */

function buildCommandeFournisseurPdfFilename(commande) {
  const raw = String(commande?.numero || commande?.id || 'commande-fournisseur').trim();
  const safe = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'commande-fournisseur';
  return `commande-fournisseur-${safe}.pdf`;
}

module.exports = buildCommandeFournisseurPdfFilename;
