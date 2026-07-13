/**
 * FICHIER : modules/gderpi/backend/services/pdf/renderBonPourAccordSection.js
 * RÔLE : Bloc signature « Bon pour accord » imprimable sur le devis.
 */

const escapeHtmlText = require('./escapeHtmlText');
const formatMoneyFr = require('./formatMoneyFr');

const esc = escapeHtmlText;

function renderBonPourAccordSection(devis) {
  if (!devis || devis.afficherBonPourAccord !== true) return '';

  const totalTtc = formatMoneyFr(devis.totaux?.totalTtc);
  const intro = totalTtc && totalTtc !== '0,00 €'
    ? `Lu et approuvé, bon pour commande au montant de <strong>${esc(totalTtc)}</strong> TTC.`
    : 'Lu et approuvé, bon pour commande au montant indiqué ci-dessus.';

  return `
    <section class="gderpi-devis-doc__bon-pour-accord">
      <h3>Bon pour accord</h3>
      <p class="gderpi-devis-doc__bpa-intro">${intro}</p>
      <div class="gderpi-devis-doc__bpa-grid">
        <div class="gderpi-devis-doc__bpa-field">
          <span class="gderpi-devis-doc__bpa-label">Date</span>
          <span class="gderpi-devis-doc__bpa-line"></span>
        </div>
        <div class="gderpi-devis-doc__bpa-field">
          <span class="gderpi-devis-doc__bpa-label">Nom et qualité</span>
          <span class="gderpi-devis-doc__bpa-line"></span>
        </div>
        <div class="gderpi-devis-doc__bpa-field gderpi-devis-doc__bpa-field--signature">
          <span class="gderpi-devis-doc__bpa-label">Signature</span>
          <span class="gderpi-devis-doc__bpa-line gderpi-devis-doc__bpa-line--tall"></span>
        </div>
      </div>
    </section>`;
}

module.exports = renderBonPourAccordSection;
