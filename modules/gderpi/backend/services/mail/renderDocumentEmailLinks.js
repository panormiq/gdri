/**
 * Bloc HTML commun : liens consulter / télécharger / impression économique.
 * Boutons en tableaux (compatibilité Outlook / mode sombre des clients mail).
 */

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderEmailButton(href, label, { bg = '#2563eb', color = '#ffffff', border = '' } = {}) {
  const borderStyle = border ? `border:1px solid ${border};` : '';
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="display:inline-table;margin:0 8px 8px 0;vertical-align:top;">
  <tr>
    <td align="center" bgcolor="${bg}" style="background-color:${bg};border-radius:8px;${borderStyle}">
      <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:12px 20px;color:${color};text-decoration:none;font-weight:600;font-size:14px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.2;mso-line-height-rule:exactly;">
        <span style="color:${color};">${label}</span>
      </a>
    </td>
  </tr>
</table>`;
}

const CONTENT_CELL = 'padding:24px 32px 0;background-color:#ffffff;color:#334155;';
const TEXT_STYLE = 'margin:0 0 12px;font-size:15px;line-height:1.5;color:#334155;';

function renderDocumentEmailLinks({ viewUrl, downloadUrl, economyDownloadUrl, docLabel, cgvViewUrl, cgvDownloadUrl }) {
  const label = docLabel || 'document';
  const economyBlock = economyDownloadUrl
    ? renderEmailButton(economyDownloadUrl, 'PDF impression économique (N&amp;B)', {
      bg: '#f1f5f9',
      color: '#334155',
      border: '#cbd5e1'
    })
    : '';

  const html = `
        <tr>
          <td style="${CONTENT_CELL}" bgcolor="#ffffff">
            <p style="${TEXT_STYLE}">Consultez ou téléchargez votre ${esc(label)} :</p>
            ${viewUrl ? renderEmailButton(viewUrl, 'Consulter en ligne', { bg: '#0f172a', color: '#ffffff' }) : ''}
            ${renderEmailButton(downloadUrl, 'Télécharger le PDF', { bg: '#2563eb', color: '#ffffff' })}
            ${economyBlock}
          </td>
        </tr>`;

  const cgvHtml = cgvViewUrl
    ? `
        <tr>
          <td style="${CONTENT_CELL}" bgcolor="#ffffff">
            <p style="${TEXT_STYLE}">Conditions générales de vente :</p>
            ${renderEmailButton(cgvViewUrl, 'Consulter les CGV', { bg: '#0f766e', color: '#ffffff' })}
            ${cgvDownloadUrl ? renderEmailButton(cgvDownloadUrl, 'Télécharger les CGV (PDF)', {
      bg: '#f1f5f9',
      color: '#334155',
      border: '#cbd5e1'
    }) : ''}
          </td>
        </tr>`
    : '';

  const bodyLines = [
    `Consulter en ligne : ${viewUrl || downloadUrl}`,
    `Télécharger le PDF : ${downloadUrl}`,
    economyDownloadUrl ? `PDF impression économique (N&B) : ${economyDownloadUrl}` : '',
    cgvViewUrl ? `Consulter les CGV : ${cgvViewUrl}` : '',
    cgvDownloadUrl ? `Télécharger les CGV (PDF) : ${cgvDownloadUrl}` : ''
  ].filter(Boolean);

  return { html: html + cgvHtml, bodyLines };
}

module.exports = renderDocumentEmailLinks;
