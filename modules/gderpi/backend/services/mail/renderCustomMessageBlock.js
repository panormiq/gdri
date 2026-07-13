/**
 * Bloc HTML / texte pour un message personnalisé ajouté à l'envoi.
 */

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCustomMessageBlock(customMessage) {
  const text = String(customMessage || '').trim();
  if (!text) return { html: '', bodyLines: [] };

  const htmlBody = esc(text).replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
  return {
    html: `
        <tr>
          <td bgcolor="#f8fafc" style="padding:16px 32px 20px;font-size:15px;line-height:1.6;color:#334155;background-color:#f8fafc;border-left:4px solid #2563eb;">
            ${htmlBody}
          </td>
        </tr>
        <tr>
          <td bgcolor="#ffffff" style="height:12px;line-height:12px;font-size:0;background-color:#ffffff;">&nbsp;</td>
        </tr>`,
    bodyLines: ['', text, '']
  };
}

module.exports = renderCustomMessageBlock;
