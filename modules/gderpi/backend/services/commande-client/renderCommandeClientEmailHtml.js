/**
 * Corps HTML de l'e-mail d'accusé de réception de commande client.
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

function buildCommandeTemplateVars({ commande, boutique, client, devis }) {
  const totaux = commande?.totaux || {};
  const contactNom = devis?.contactNom
    || client?.nom
    || client?.raisonSociale
    || 'Madame, Monsieur';

  return {
    numero: commande?.numero || '',
    devisNumero: commande?.devisNumero || devis?.numero || '',
    objet: commande?.objet || '',
    contactNom,
    boutique: boutique?.nom || boutique?.libelle || '',
    montantTtc: formatMoney(totaux.totalTtc),
    dateCommande: formatDateFr(commande?.createdAt)
  };
}

function renderCommandeClientEmailHtml({
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
  const template = mailTemplate || DEFAULTS.commande_client;
  const vars = buildCommandeTemplateVars({ commande, boutique, client, devis });
  const subject = applyTemplate(template.subjectTemplate, vars);
  const intro = applyTemplate(template.introHtml, vars);
  const customBlock = renderCustomMessageBlock(customMessage);

  const { html: linksHtml, bodyLines: linkBodyLines } = renderDocumentEmailLinks({
    viewUrl,
    downloadUrl,
    economyDownloadUrl,
    docLabel: 'commande',
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
        ${renderDocumentEmailHeader({ type: 'commande_client', numero: vars.numero, boutique: vars.boutique })}
        ${renderDocumentEmailIntroRow(intro)}
        ${customBlock.html}
        ${renderDocumentEmailMetaRow('Objet', vars.objet)}
        ${renderDocumentEmailMetaRow('Montant TTC', vars.montantTtc)}
        ${renderDocumentEmailMetaRow('Date', vars.dateCommande)}
        ${linksHtml}
        ${renderDocumentEmailFooterRow()}
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const bodyText = [
    `Bonjour ${vars.contactNom},`,
    `Accusé de réception de votre commande ${vars.numero}.`,
    ...customBlock.bodyLines,
    vars.objet ? `Objet : ${vars.objet}` : '',
    vars.montantTtc ? `Montant TTC : ${vars.montantTtc}` : '',
    '',
    ...linkBodyLines
  ].filter(Boolean).join('\n');

  return { subject, html, bodyText };
}

module.exports = renderCommandeClientEmailHtml;
