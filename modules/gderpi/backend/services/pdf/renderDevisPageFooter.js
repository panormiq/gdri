/**
 * FICHIER : modules/gderpi/backend/services/pdf/renderDevisPageFooter.js
 * RÔLE : Pied de page devis : mentions légales et lien CGV.
 */

const escapeHtmlText = require('./escapeHtmlText');
const buildIssuerFooterLegalLine = require('./buildIssuerFooterLegalLine');

const esc = escapeHtmlText;

function renderDevisPageFooter(boutique, piedText, cgvUrl) {
  const legalLine = buildIssuerFooterLegalLine(boutique);
  const pied = String(piedText || '').trim();
  if (!legalLine && !cgvUrl && !pied) return '';

  const parts = [];
  if (legalLine) parts.push('<div>' + esc(legalLine) + '</div>');
  if (cgvUrl) {
    parts.push(
      '<div>Conditions générales de vente : <a class="gderpi-devis-doc__footer-cgv-link" href="' + esc(cgvUrl) + '" target="_blank" rel="noopener">consulter en ligne</a></div>'
    );
  }
  if (pied) parts.push('<div>' + esc(pied).replace(/\n/g, '<br>') + '</div>');

  return '<footer class="gderpi-devis-doc__page-footer">' + parts.join('') + '</footer>';
}

module.exports = renderDevisPageFooter;
