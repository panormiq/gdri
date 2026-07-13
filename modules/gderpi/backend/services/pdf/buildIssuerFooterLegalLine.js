/**
 * FICHIER : modules/gderpi/backend/services/pdf/buildIssuerFooterLegalLine.js
 * RÔLE : Ligne unique pied de page : RCS, forme juridique, capital.
 */

const formatBoutiqueCapital = require('./formatBoutiqueCapital');

function buildIssuerFooterLegalLine(boutique) {
  const b = boutique || {};
  const parts = [];

  if (b.rcs) parts.push(`RCS : ${b.rcs}`);
  if (b.formeJuridique) parts.push(b.formeJuridique);
  if (b.capital) {
    parts.push(`au capital de ${formatBoutiqueCapital(b.capital, b.devise)}`);
  }

  return parts.join(' - ');
}

module.exports = buildIssuerFooterLegalLine;
