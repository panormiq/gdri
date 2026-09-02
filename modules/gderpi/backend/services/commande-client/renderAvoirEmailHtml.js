/**
 * FICHIER : modules/gderpi/backend/services/commande-client/renderAvoirEmailHtml.js
 */

const { applyTemplate, formatMoney, formatDateFr } = require('../devis/applyDevisMailTemplate');
const renderDocumentEmailLinks = require('../mail/renderDocumentEmailLinks');
const renderCustomMessageBlock = require('../mail/renderCustomMessageBlock');
const {
  renderDocumentEmailHead,
  renderDocumentEmailHeader,
  renderDocumentEmailIntroRow,
  renderDocumentEmailMetaRow,
  renderDocumentEmailFooterRow
} = require('../mail/renderDocumentEmailHeader');
const { DEFAULTS } = require('../mail/gderpiMailTemplateDefaults');

function buildAvoirTemplateVars({ commande, boutique, client, devis }) {
  const totaux = commande?.totaux || {};
  const contactNom = commande?.contactNom
    || devis?.contactNom
    || client?.nom
    || client?.raisonSociale
    || 'Madame, Monsieur';

  return {
    numero: commande?.avoirNumero || '',
    factureOrigine: commande?.factureOrigineNumero || commande?.factureNumero || '',
    commandeNumero: commande?.numero || '',
    devisNumero: commande?.devisNumero || devis?.numero || '',
    objet: commande?.objet || '',
    contactNom,
    boutique: boutique?.nom || boutique?.libelle || '',
    montantTtc: formatMoney(totaux.totalTtc),
    dateAvoir: formatDateFr(commande?.avoirDate)
  };
}

function renderAvoirEmailHtml({
  commande,
  boutique,
  client,
  devis,
  mailTemplate,
  customMessage,
  viewUrl,
  downloadUrl,
  economyDownloadUrl,
  cgvViewUrl,
  cgvDownloadUrl
}) {
  const template = mailTemplate || DEFAULTS.avoir;
  const vars = buildAvoirTemplateVars({ commande, boutique, client, devis });
  const subject = applyTemplate(template.subjectTemplate, vars);
  const intro = applyTemplate(template.introHtml, vars);
  const customBlock = renderCustomMessageBlock(customMessage);

  const { html: linksHtml, bodyLines: linkBodyLines } = renderDocumentEmailLinks({
    viewUrl,
    downloadUrl,
    economyDownloadUrl,
    docLabel: 'avoir',
    cgvViewUrl,
    cgvDownloadUrl
  });

  const html = `<!DOCTYPE html>
<html lang="fr">
${renderDocumentEmailHead()}
<body style="margin:0;padding:0;background:#f1f5f9;color:#334155;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
        ${renderDocumentEmailHeader({ type: 'avoir', numero: vars.numero, boutique: vars.boutique })}
        ${renderDocumentEmailIntroRow(intro)}
        ${customBlock.html}
        ${renderDocumentEmailMetaRow("Facture d'origine", vars.factureOrigine)}
        ${renderDocumentEmailMetaRow('Objet', vars.objet)}
        ${renderDocumentEmailMetaRow('Montant TTC crédité', vars.montantTtc)}
        ${renderDocumentEmailMetaRow('Date', vars.dateAvoir)}
        ${linksHtml}
        ${renderDocumentEmailFooterRow()}
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const bodyText = [
    `Bonjour ${vars.contactNom},`,
    `Avoir ${vars.numero} (facture ${vars.factureOrigine}, commande ${vars.commandeNumero}).`,
    ...customBlock.bodyLines,
    vars.objet ? `Objet : ${vars.objet}` : '',
    vars.montantTtc ? `Montant TTC crédité : ${vars.montantTtc}` : '',
    '',
    ...linkBodyLines
  ].filter(Boolean).join('\n');

  return { subject, html, bodyText };
}

module.exports = renderAvoirEmailHtml;
