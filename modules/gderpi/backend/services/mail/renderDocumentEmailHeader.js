/**
 * Bandeau titre des e-mails document (compatibilité Outlook / mode sombre).
 */

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const HEADER_THEMES = {
  devis: { bg: '#1e3a5f', label: 'Devis' },
  commande_client: { bg: '#ea580c', label: 'Accusé de réception' },
  facture: { bg: '#1e40af', label: 'Facture' },
  avoir: { bg: '#b45309', label: 'Avoir' },
  commande_fournisseur: { bg: '#1e3a5f', label: 'Commande fournisseur' },
  commande_confirmation: { bg: '#16a34a', label: 'Confirmation commande' }
};

function renderDocumentEmailHead() {
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>`;
}

function renderDocumentEmailHeader({ type, numero, boutique, label }) {
  const theme = HEADER_THEMES[type] || HEADER_THEMES.devis;
  const bg = theme.bg;
  const titleLabel = String(label || theme.label || '').trim();

  return `
        <tr>
          <td bgcolor="${bg}" style="padding:28px 32px;background-color:${bg};color:#ffffff;">
            <div style="font-size:13px;color:#e2e8f0;text-transform:uppercase;letter-spacing:.06em;">${esc(titleLabel)}</div>
            <div style="font-size:24px;font-weight:700;margin-top:6px;color:#ffffff;">${esc(numero)}</div>
            ${boutique ? `<div style="font-size:14px;margin-top:8px;color:#e2e8f0;">${esc(boutique)}</div>` : ''}
          </td>
        </tr>`;
}

function renderDocumentEmailIntroRow(introHtml) {
  return `<tr><td bgcolor="#ffffff" style="padding:28px 32px 8px;font-size:15px;line-height:1.6;background-color:#ffffff;color:#334155;">${introHtml}</td></tr>`;
}

function renderDocumentEmailMetaRow(label, value) {
  if (!String(value || '').trim()) return '';
  return `<tr><td bgcolor="#ffffff" style="padding:8px 32px 0;font-size:14px;background-color:#ffffff;color:#64748b;"><strong style="color:#334155;">${esc(label)} :</strong> ${esc(value)}</td></tr>`;
}

function renderDocumentEmailFooterRow(text = 'Ce message a été envoyé automatiquement.') {
  return `<tr><td bgcolor="#ffffff" style="padding:16px 32px 32px;font-size:12px;background-color:#ffffff;color:#94a3b8;">${esc(text)}</td></tr>`;
}

module.exports = {
  renderDocumentEmailHead,
  renderDocumentEmailHeader,
  renderDocumentEmailIntroRow,
  renderDocumentEmailMetaRow,
  renderDocumentEmailFooterRow
};
