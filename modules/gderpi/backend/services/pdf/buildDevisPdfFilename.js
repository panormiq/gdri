/**
 * FICHIER : modules/gderpi/backend/services/pdf/buildDevisPdfFilename.js
 * RÔLE : Nom de fichier PDF pour un devis.
 *
 * ENTRÉES : devis { numero, devisId }
 * SORTIES : string « devis-XXX.pdf »
 */

function buildDevisPdfFilename(devis) {
  const raw = String(devis?.numero || devis?.devisId || 'devis').trim();
  const safe = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'devis';
  return `devis-${safe}.pdf`;
}

module.exports = buildDevisPdfFilename;
