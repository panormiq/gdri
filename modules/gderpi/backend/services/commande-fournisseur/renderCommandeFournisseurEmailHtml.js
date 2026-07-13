/**
 * Corps HTML de l'e-mail de commande fournisseur (liens publics, sans pièce jointe).
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

function buildTemplateVars({ commande, boutique, fournisseur }) {
  const totaux = commande?.totaux || {};
  const contactNom = fournisseur?.contactNom
    || fournisseur?.raisonSociale
    || fournisseur?.displayName
    || 'Madame, Monsieur';
  return {
    numero: commande?.numero || '',
    objet: commande?.objet || '',
    contactNom,
    fournisseur: fournisseur?.raisonSociale || fournisseur?.displayName || fournisseur?.nom || '',
    boutique: boutique?.nom || boutique?.libelle || '',
    montantHt: formatMoney(totaux.totalHt),
    dateCommande: formatDateFr(commande?.createdAt)
  };
}

function renderCommandeFournisseurEmailHtml({
  commande,
  boutique,
  fournisseur,
  mailTemplate,
  customMessage,
  viewUrl,
  downloadUrl
}) {
  const template = mailTemplate || DEFAULTS.commande_fournisseur;
  const vars = buildTemplateVars({ commande, boutique, fournisseur });
  const subject = applyTemplate(template.subjectTemplate, vars);
  const intro = applyTemplate(template.introHtml, vars);
  const customBlock = renderCustomMessageBlock(customMessage);

  const { html: linksHtml, bodyLines: linkBodyLines } = renderDocumentEmailLinks({
    viewUrl,
    downloadUrl,
    docLabel: 'commande fournisseur'
  });

  const html = `<!DOCTYPE html>
<html lang="fr">
${renderDocumentEmailHead()}
<body style="margin:0;padding:0;background:#f1f5f9;color:#334155;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
        ${renderDocumentEmailHeader({ type: 'commande_fournisseur', numero: vars.numero, boutique: vars.boutique })}
        ${renderDocumentEmailIntroRow(intro)}
        ${customBlock.html}
        ${renderDocumentEmailMetaRow('Objet', vars.objet)}
        ${renderDocumentEmailMetaRow('Total HT', vars.montantHt)}
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
    `Veuillez trouver notre commande fournisseur ${vars.numero}.`,
    ...customBlock.bodyLines,
    vars.objet ? `Objet : ${vars.objet}` : '',
    vars.montantHt ? `Total HT : ${vars.montantHt}` : '',
    '',
    ...linkBodyLines,
    '',
    'Merci de nous confirmer la prise en charge de cette commande.'
  ].filter(Boolean).join('\n');

  return { subject, html, bodyText };
}

module.exports = renderCommandeFournisseurEmailHtml;
