/**
 * E-mail de confirmation après commande via lien public devis (avec récap modifications).
 */

const { applyTemplate, formatMoney, formatDateFr } = require('./applyDevisMailTemplate');
const renderDocumentEmailLinks = require('../mail/renderDocumentEmailLinks');
const {
  renderDocumentEmailHead,
  renderDocumentEmailHeader,
  renderDocumentEmailIntroRow,
  renderDocumentEmailMetaRow,
  renderDocumentEmailFooterRow
} = require('../mail/renderDocumentEmailHeader');
const buildDevisOrderModifications = require('./buildDevisOrderModifications');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderChangesTable(modifications) {
  if (!modifications?.changes?.length) return '';

  const rows = modifications.changes.map((change) => {
    if (change.type === 'removed') {
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${esc(change.libelle)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#b91c1c;">Retiré</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${esc(String(change.devisQty))}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">—</td>
      </tr>`;
    }
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${esc(change.libelle)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#b45309;">Quantité modifiée</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${esc(String(change.devisQty))}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${esc(String(change.commandeQty))}</td>
    </tr>`;
  }).join('');

  return `
    <p style="margin:20px 0 8px;font-weight:600;color:#0f172a;">Récapitulatif des modifications</p>
    <table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:14px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th align="left" style="padding:8px 12px;color:#64748b;">Article</th>
          <th align="left" style="padding:8px 12px;color:#64748b;">Modification</th>
          <th align="right" style="padding:8px 12px;color:#64748b;">Devis</th>
          <th align="right" style="padding:8px 12px;color:#64748b;">Commande</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin:12px 0 0;font-size:14px;color:#475569;">
      Montant devis initial : <strong>${esc(modifications.devisMontantTtc)}</strong> TTC<br>
      Montant commandé : <strong>${esc(modifications.commandeMontantTtc)}</strong> TTC
    </p>`;
}

function renderDevisOrderConfirmationEmailHtml({
  devis,
  commande,
  boutique,
  client,
  modifieeParClient,
  viewUrl,
  downloadUrl,
  economyDownloadUrl,
  cgvViewUrl,
  cgvDownloadUrl
}) {
  const contactNom = devis?.contactNom
    || client?.nom
    || client?.raisonSociale
    || 'Madame, Monsieur';
  const vars = {
    numero: commande?.numero || '',
    devisNumero: devis?.numero || devis?.devisId || '',
    contactNom,
    boutique: boutique?.nom || boutique?.libelle || '',
    montantTtc: formatMoney(commande?.totaux?.totalTtc),
    dateCommande: formatDateFr(commande?.createdAt)
  };

  const subject = modifieeParClient
    ? applyTemplate('Confirmation commande {{numero}} — modifications en attente de validation — {{boutique}}', vars)
    : applyTemplate('Confirmation commande {{numero}} — {{boutique}}', vars);

  const intro = modifieeParClient
    ? `<p>Bonjour ${esc(contactNom)},</p>
       <p>Nous avons bien reçu votre commande <strong>${esc(commande?.numero || '')}</strong> issue du devis <strong>${esc(vars.devisNumero)}</strong>.</p>
       <p>Des écarts ont été constatés par rapport au devis initial. Votre commande est en cours de validation par notre équipe. Le tarif définitif vous sera confirmé par e-mail.</p>`
    : `<p>Bonjour ${esc(contactNom)},</p>
       <p>Nous confirmons la réception de votre commande <strong>${esc(commande?.numero || '')}</strong> conforme au devis <strong>${esc(vars.devisNumero)}</strong>.</p>
       <p>Montant total : <strong>${esc(vars.montantTtc)}</strong> TTC.</p>`;

  const modifications = modifieeParClient
    ? buildDevisOrderModifications(devis, commande)
    : null;

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
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08);">
        ${renderDocumentEmailHeader({ type: 'commande_confirmation', numero: vars.numero, boutique: vars.boutique })}
        ${renderDocumentEmailIntroRow(intro)}
        ${renderDocumentEmailMetaRow('Devis', vars.devisNumero)}
        ${renderDocumentEmailMetaRow('Montant TTC', vars.montantTtc)}
        ${renderDocumentEmailMetaRow('Date', vars.dateCommande)}
        ${modifications?.hasChanges ? `<tr><td bgcolor="#ffffff" style="padding:8px 32px 0;background-color:#ffffff;color:#334155;">${renderChangesTable(modifications)}</td></tr>` : ''}
        ${linksHtml}
        ${renderDocumentEmailFooterRow()}
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const bodyText = [
    modifieeParClient
      ? `Commande ${commande?.numero} reçue avec modifications — validation en cours.`
      : `Commande ${commande?.numero} confirmée — ${vars.montantTtc} TTC.`,
    ...linkBodyLines
  ].join('\n');

  return { subject, html, bodyText };
}

module.exports = renderDevisOrderConfirmationEmailHtml;
