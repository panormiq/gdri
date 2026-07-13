/**

 * Corps HTML de l'e-mail d'envoi devis au client.

 */



const { applyTemplate, buildDevisTemplateVars } = require('./applyDevisMailTemplate');

const renderDocumentEmailLinks = require('../mail/renderDocumentEmailLinks');
const renderCustomMessageBlock = require('../mail/renderCustomMessageBlock');
const {
  renderDocumentEmailHead,
  renderDocumentEmailHeader,
  renderDocumentEmailIntroRow,
  renderDocumentEmailMetaRow,
  renderDocumentEmailFooterRow
} = require('../mail/renderDocumentEmailHeader');



function esc(value) {

  return String(value ?? '')

    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;');

}



function renderDevisEmailHtml({
  devis,
  boutique,
  client,
  settings,
  mailTemplate,
  customMessage,
  viewUrl,
  downloadUrl,
  economyDownloadUrl,
  acceptUrl,
  cgvViewUrl,
  cgvDownloadUrl
}) {
  const template = mailTemplate || {
    subjectTemplate: settings?.subjectTemplate,
    introHtml: settings?.introHtml
  };
  const vars = buildDevisTemplateVars({ devis, boutique, client });
  const subject = applyTemplate(template.subjectTemplate, vars);
  const intro = applyTemplate(template.introHtml, vars);
  const customBlock = renderCustomMessageBlock(customMessage);



  const { html: linksHtml, bodyLines: linkBodyLines } = renderDocumentEmailLinks({
    viewUrl,
    downloadUrl,
    economyDownloadUrl,
    docLabel: 'devis',
    cgvViewUrl,
    cgvDownloadUrl
  });



  const acceptBlock = settings.enableAcceptLink && acceptUrl
    ? `
        <tr>
          <td bgcolor="#ffffff" style="padding:24px 32px 0;background-color:#ffffff;color:#334155;">
            <p style="margin:0 0 12px;font-size:15px;color:#334155;">Vous pouvez confirmer votre commande en ligne :</p>
            <a href="${esc(acceptUrl)}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Confirmer ma commande</a>
          </td>
        </tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="fr">
${renderDocumentEmailHead()}
<body style="margin:0;padding:0;background:#f1f5f9;color:#334155;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08);">
        ${renderDocumentEmailHeader({ type: 'devis', numero: vars.numero, boutique: vars.boutique })}
        ${renderDocumentEmailIntroRow(intro)}
        ${customBlock.html}
        ${renderDocumentEmailMetaRow('Objet', vars.objet)}
        ${renderDocumentEmailMetaRow('Montant TTC', vars.montantTtc)}
        ${renderDocumentEmailMetaRow("Valable jusqu'au", vars.dateValidite)}
        ${linksHtml}
        ${acceptBlock}
        ${renderDocumentEmailFooterRow("Ce message a été envoyé automatiquement. Si vous n'êtes pas le destinataire, merci de l'ignorer.")}
      </table>
    </td></tr>
  </table>
</body>
</html>`;



  const bodyText = [
    applyTemplate(template.introHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), vars),
    ...customBlock.bodyLines,
    vars.objet ? `Objet : ${vars.objet}` : '',

    vars.montantTtc ? `Montant TTC : ${vars.montantTtc}` : '',

    '',

    ...linkBodyLines,

    settings.enableAcceptLink && acceptUrl ? `Confirmer ma commande : ${acceptUrl}` : ''

  ].filter(Boolean).join('\n');



  return { subject, html, bodyText };

}



module.exports = renderDevisEmailHtml;


