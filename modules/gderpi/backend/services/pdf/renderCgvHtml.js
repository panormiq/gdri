/**
 * FICHIER : modules/gderpi/backend/services/pdf/renderCgvHtml.js
 * RÔLE : Page HTML publique des CGV boutique (B2B ou B2C).
 */

const escapeHtmlText = require('./escapeHtmlText');
const formatDateFr = require('./formatDateFr');
const resolveDevisConditions = require('./resolveDevisConditions');
const { labelCgvProfil } = require('../devis/devisConditionsPaiementOptions');

const esc = escapeHtmlText;

function renderConditionsBody(resolved) {
  if (!resolved?.sections?.length) {
    return '<p class="gderpi-cgv-doc__muted">Aucune condition de vente configurée pour cette boutique.</p>';
  }
  return resolved.sections.map((section) => {
    let block = '';
    if (section.title) {
      block += `<h2 class="gderpi-cgv-doc__section-title">${esc(section.title)}</h2>`;
    }
    block += `<div class="gderpi-cgv-doc__section-body">${esc(section.text).replace(/\n/g, '<br>')}</div>`;
    return block;
  }).join('');
}

function renderCgvHtml({ boutique, profil, cgvProfilResolved, downloadUrl }) {
  const b = boutique || {};
  const profile = cgvProfilResolved === 'b2c' ? 'b2c' : 'b2b';
  const clientStub = profile === 'b2c' ? { type: 'particulier' } : { type: 'entreprise' };
  const resolved = resolveDevisConditions(b, clientStub);
  const titleName = b.raisonSociale || b.nom || 'Boutique';
  const updatedAt = formatDateFr(b.updatedAt);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CGV — ${esc(titleName)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: "Segoe UI", system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.55;
      color: #1e293b;
      background: #f8fafc;
    }
    .gderpi-cgv-doc {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      padding: 28px 32px 40px;
      box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
      border-radius: 8px;
    }
    .gderpi-cgv-doc__header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #0f766e;
    }
    .gderpi-cgv-doc__title {
      margin: 0 0 6px;
      font-size: 1.35rem;
      color: #0f172a;
    }
    .gderpi-cgv-doc__meta {
      margin: 0;
      font-size: 0.85rem;
      color: #64748b;
    }
    .gderpi-cgv-doc__section-title {
      margin: 1.25rem 0 0.45rem;
      font-size: 0.95rem;
      color: #0f766e;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .gderpi-cgv-doc__section-body {
      margin-bottom: 0.75rem;
      color: #334155;
    }
    .gderpi-cgv-doc__muted { color: #64748b; }
    .gderpi-cgv-doc__actions {
      margin: 0 0 20px;
      font-size: 0.9rem;
    }
    .gderpi-cgv-doc__actions a {
      color: #0f766e;
      font-weight: 600;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <article class="gderpi-cgv-doc">
    <header class="gderpi-cgv-doc__header">
      <h1 class="gderpi-cgv-doc__title">Conditions générales de vente — ${esc(titleName)}</h1>
      <p class="gderpi-cgv-doc__meta">Profil ${esc(labelCgvProfil(profile))}${updatedAt ? ` — mise à jour du ${esc(updatedAt)}` : ''}</p>
      ${downloadUrl ? `<p class="gderpi-cgv-doc__actions"><a href="${esc(downloadUrl)}">Télécharger ces CGV en PDF</a></p>` : ''}
    </header>
    ${renderConditionsBody(resolved)}
  </article>
</body>
</html>`;
}

module.exports = renderCgvHtml;
