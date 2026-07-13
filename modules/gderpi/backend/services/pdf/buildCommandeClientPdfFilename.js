/**
 * FICHIER : modules/gderpi/backend/services/pdf/buildCommandeClientPdfFilename.js
 * RÔLE : Nom de fichier PDF pour une commande client.
 */

function buildCommandeClientPdfFilename(commande) {
  const raw = String(commande?.numero || commande?.id || 'commande-client').trim();
  const safe = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'commande-client';
  return `commande-client-${safe}.pdf`;
}

module.exports = buildCommandeClientPdfFilename;
