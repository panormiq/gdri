/**
 * Ligne objet sur une seule ligne : « Objet : … »
 */

const escapeHtmlText = require('./escapeHtmlText');

const esc = escapeHtmlText;

function renderDocumentObjetLine(value, label = 'Objet') {
  const text = String(value || '').trim();
  if (!text) return '';
  return `<p class="gderpi-devis-doc__objet"><strong>${esc(label)} :</strong> ${esc(text)}</p>`;
}

module.exports = renderDocumentObjetLine;
