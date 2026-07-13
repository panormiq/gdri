/**
 * FICHIER : modules/gderpi/backend/services/pdf/renderAvoirHtml.js
 * RÔLE : Génère le document HTML complet d'un avoir client.
 */

const escapeHtmlText = require('./escapeHtmlText');
const formatMoneyFr = require('./formatMoneyFr');
const formatDateFr = require('./formatDateFr');
const formatPostalAddress = require('./formatPostalAddress');
const resolveDevisContact = require('./resolveDevisContact');
const resolveDevisEmetteurContact = require('./resolveDevisEmetteurContact');
const renderDevisPageFooter = require('./renderDevisPageFooter');
const buildCgvPublicUrl = require('./buildCgvPublicUrl');
const resolveCgvProfil = require('./resolveCgvProfil');
const renderDocumentEconomyCss = require('./renderDocumentEconomyCss');
const renderDocumentLayoutCss = require('./renderDocumentLayoutCss');
const renderDocumentObjetLine = require('./renderDocumentObjetLine');

const esc = escapeHtmlText;
const money = formatMoneyFr;

function joinLines(lines) {
  return lines.filter(Boolean).map((l) => esc(l)).join('<br>');
}

function issuerLine(html) {
  return `<div class="gderpi-devis-doc__issuer-line">${html}</div>`;
}

function renderLegalLines(boutique, emetteurContact) {
  const b = boutique || {};
  const lines = [];
  const name = b.raisonSociale || b.nom || '';
  if (name) lines.push(issuerLine(`<strong>${esc(name)}</strong>`));

  const addr = formatPostalAddress({
    adresse: b.adresse,
    codePostal: b.codePostal,
    ville: b.ville,
    pays: b.pays
  });
  addr.forEach((line) => lines.push(issuerLine(esc(line))));

  if (b.siret) lines.push(issuerLine(`SIRET : ${esc(b.siret)}`));
  if (b.tvaIntracommunautaire) lines.push(issuerLine(`TVA : ${esc(b.tvaIntracommunautaire)}`));
  const showDirectEmail = b.email && !(emetteurContact && emetteurContact.email);
  const showDirectTel = b.telephone && !(emetteurContact && emetteurContact.telephone);
  if (showDirectTel) lines.push(issuerLine(`Tél. ${esc(b.telephone)}`));
  if (showDirectEmail) lines.push(issuerLine(esc(b.email)));
  if (b.siteWeb) lines.push(issuerLine(esc(b.siteWeb)));

  return `<div class="gderpi-devis-doc__issuer-block">${lines.join('')}</div>`;
}

function renderIssuerContactBlock(contact) {
  if (!contact) return '';
  const contactLines = [];
  if (contact.nom) contactLines.push(`<strong>De la part de :</strong> ${esc(contact.nom)}`);
  if (contact.fonction) contactLines.push(esc(contact.fonction));
  if (contact.email) contactLines.push(esc(contact.email));
  if (contact.telephone) contactLines.push(`Tél. ${esc(contact.telephone)}`);
  if (!contactLines.length) return '';
  return '<div class="gderpi-devis-doc__contact">' + contactLines.join('<br>') + '</div>';
}

function renderClientBlock(client, contact) {
  if (!client) return '<p class="gderpi-devis-doc__muted">Client non renseigné</p>';
  const parts = [];
  const title = client.displayName || client.raisonSociale
    || [client.prenom, client.nom].filter(Boolean).join(' ')
    || 'Client';
  parts.push(`<strong>${esc(title)}</strong>`);
  const addr = formatPostalAddress(client.adresseFacturation || {
    adresse: client.adresse,
    complement: client.adresseComplement,
    codePostal: client.codePostal,
    ville: client.ville,
    pays: client.pays
  });
  if (addr.length) parts.push(joinLines(addr));
  if (contact) {
    const contactLines = [];
    if (contact.nom) contactLines.push(`<strong>À l'attention de :</strong> ${esc(contact.nom)}`);
    if (contact.fonction) contactLines.push(esc(contact.fonction));
    if (contact.email) contactLines.push(esc(contact.email));
    if (contact.telephone) contactLines.push(`Tél. ${esc(contact.telephone)}`);
    if (contactLines.length) {
      parts.push('<div class="gderpi-devis-doc__contact">' + contactLines.join('<br>') + '</div>');
    }
  }
  return parts.join('<br>');
}

function renderLineRows(lignes) {
  const lines = Array.isArray(lignes) ? lignes : [];
  if (!lines.length) {
    return '<tr><td colspan="8" class="gderpi-devis-doc__muted">Aucune ligne</td></tr>';
  }
  let html = '';
  lines.forEach((line, index) => {
    const desc = String(line.description || line.commentaire || '').trim();
    html +=
      '<tr>' +
      `<td class="num">${index + 1}</td>` +
      `<td>${esc(line.reference || '—')}</td>` +
      `<td>${esc(line.referenceClient || '') ? esc(line.referenceClient) + '<br>' : ''}${esc(line.libelle || '—')}</td>` +
      `<td class="num">${esc(line.quantite)}</td>` +
      `<td>${esc(line.unite || '')}</td>` +
      `<td class="num">${money(line.prixHt)}</td>` +
      `<td class="num">${Number(line.remisePct) ? esc(line.remisePct) + ' %' : '—'}</td>` +
      `<td class="num">${money(line.montantHt)}</td>` +
      '</tr>';
    if (desc) {
      html += '<tr class="gderpi-devis-doc__line-desc"><td></td><td colspan="7"><div class="gderpi-devis-doc__desc">' + esc(desc).replace(/\n/g, '<br>') + '</div></td></tr>';
    }
  });
  return html;
}

function renderTvaBreakdown(tvaParTaux) {
  const buckets = Object.values(tvaParTaux || {}).filter((b) => (Number(b.baseHt) || 0) > 0);
  if (!buckets.length) return '';
  return buckets.map((b) =>
    `<tr><td>TVA ${esc(b.tauxTva)} % sur ${money(b.baseHt)}</td><td class="num">${money(b.montantTva)}</td></tr>`
  ).join('');
}

function renderAvoirHtml(context) {
  const { commande, boutique, client, devis, logoUrl, entrepriseId, req, economy: economyMode } = context || {};
  const economy = economyMode === true;
  const c = commande || {};
  const totaux = c.totaux || {};
  const dateAvoir = formatDateFr(c.avoirDate);
  const dateFactureOrigine = formatDateFr(c.factureOrigineDate || c.factureDate);
  const objet = String(c.objet || '').trim();
  const motif = String(c.motif || '').trim();
  const documentClient = String(c.documentClient || '').trim();
  const referenceClient = String(c.referenceClient || '').trim();
  const contact = resolveDevisContact(devis || {}, client);
  const emetteurContact = resolveDevisEmetteurContact(devis || {}, boutique);
  const cgvProfil = resolveCgvProfil(devis || {}, client);
  const cgvUrl = buildCgvPublicUrl(req, entrepriseId, boutique, cgvProfil);
  const pied = String(boutique?.piedDePage || '').trim();
  const factureOrigine = c.factureOrigineNumero || c.factureNumero || '—';

  const logoBlock = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="Logo" class="gderpi-devis-doc__logo">`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Avoir ${esc(c.avoirNumero || '')}</title>
  <style>
    ${renderDocumentLayoutCss()}
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; font-size: 13px; line-height: 1.45; color: #1e293b; background: #f1f5f9; }
    .gderpi-devis-doc { max-width: 210mm; margin: 0 auto; background: #fff; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08); }
    .gderpi-devis-doc__sheet { min-height: calc(297mm - 26mm); display: flex; flex-direction: column; }
    .gderpi-devis-doc__sheet-body { flex: 0 0 auto; }
    .gderpi-devis-doc__sheet-spacer { flex: 1 1 auto; min-height: 12mm; }
    .gderpi-devis-doc__header { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; border-bottom: 2px solid #b45309; }
    .gderpi-devis-doc__logo { max-width: 200px; object-fit: contain; }
    .gderpi-devis-doc__issuer { font-size: 12px; color: #334155; }
    .gderpi-devis-doc__issuer-line { display: block; margin: 0 0 3px; }
    .gderpi-devis-doc__title-block { text-align: right; }
    .gderpi-devis-doc__title { margin: 0; font-size: 26px; font-weight: 800; color: #b45309; }
    .gderpi-devis-doc__meta { margin-top: 8px; font-size: 12px; color: #64748b; }
    .gderpi-devis-doc__client { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: left; font-size: 12px; }
    .gderpi-devis-doc__client h2 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; color: #64748b; }
    .gderpi-devis-doc__ref-facture { margin: 0 0 20px; padding: 10px 14px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; font-size: 12px; }
    table.gderpi-devis-doc__lines { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    table.gderpi-devis-doc__lines th { text-align: left; padding: 8px 6px; background: #b45309; color: #fff; font-size: 11px; }
    table.gderpi-devis-doc__lines th.num, table.gderpi-devis-doc__lines td.num { text-align: right; }
    table.gderpi-devis-doc__lines td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr.gderpi-devis-doc__line-desc td { padding-top: 0; padding-bottom: 10px; }
    .gderpi-devis-doc__desc { font-size: 11px; color: #475569; font-style: italic; }
    .gderpi-devis-doc__totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 24px; }
    table.gderpi-devis-doc__totals { min-width: 280px; border-collapse: collapse; font-size: 12px; }
    table.gderpi-devis-doc__totals td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
    table.gderpi-devis-doc__totals tr.gderpi-devis-doc__total-ttc td { font-weight: 800; font-size: 14px; border-top: 2px solid #b45309; }
    .gderpi-devis-doc__contact { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0; font-size: 11px; }
    .gderpi-devis-doc__page-footer { flex-shrink: 0; margin-top: 0; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; text-align: center; }
    .gderpi-devis-doc__footer-cgv-link { color: #b45309; font-weight: 600; }
    .gderpi-devis-doc__muted { color: #94a3b8; }
    @media print { body { background: #fff; } }
    ${economy ? renderDocumentEconomyCss() : ''}
  </style>
</head>
<body${economy ? ' class="gderpi-doc--economy"' : ''}>
  <article class="gderpi-devis-doc">
    <div class="gderpi-devis-doc__sheet">
      <div class="gderpi-devis-doc__sheet-body">
        <header class="gderpi-devis-doc__header">
          <div class="gderpi-devis-doc__issuer">
            ${logoBlock}
            <div style="margin-top:${logoUrl ? '12px' : '0'}">${renderLegalLines(boutique, emetteurContact)}</div>
            ${renderIssuerContactBlock(emetteurContact)}
          </div>
          <div class="gderpi-devis-doc__title-block">
            <h1 class="gderpi-devis-doc__title">AVOIR</h1>
            <div class="gderpi-devis-doc__meta">
              <div><strong>N° avoir</strong> ${esc(c.avoirNumero || '—')}</div>
              ${dateAvoir ? `<div><strong>Date</strong> ${esc(dateAvoir)}</div>` : ''}
              <div><strong>Facture d'origine</strong> ${esc(factureOrigine)}${dateFactureOrigine ? ` du ${esc(dateFactureOrigine)}` : ''}</div>
              <div><strong>N° commande</strong> ${esc(c.numero || '—')}</div>
              ${c.devisNumero ? `<div><strong>Devis</strong> ${esc(c.devisNumero)}</div>` : ''}
              ${documentClient ? `<div><strong>Document client</strong> ${esc(documentClient)}</div>` : ''}
              ${referenceClient ? `<div><strong>Bon de commande client</strong> ${esc(referenceClient)}</div>` : ''}
            </div>
            <div class="gderpi-devis-doc__client">
              <h2>Client</h2>
              ${renderClientBlock(client, contact)}
            </div>
          </div>
        </header>
        <div class="gderpi-devis-doc__ref-facture">
          Avoir établi sur la facture <strong>${esc(factureOrigine)}</strong>${dateFactureOrigine ? ` en date du ${esc(dateFactureOrigine)}` : ''}.
        </div>
        ${renderDocumentObjetLine(objet)}
        ${renderDocumentObjetLine(motif, 'Motif')}
        <table class="gderpi-devis-doc__lines">
          <thead><tr>
            <th class="num">#</th><th>Réf.</th><th>Désignation</th><th class="num">Qté</th><th>Unité</th>
            <th class="num">P.U. HT</th><th class="num">Rem.</th><th class="num">Montant HT</th>
          </tr></thead>
          <tbody>${renderLineRows(c.lignes)}</tbody>
        </table>
        <div class="gderpi-devis-doc__totals-wrap">
          <table class="gderpi-devis-doc__totals">
            <tr><td>Total HT crédité</td><td class="num">${money(totaux.totalHt)}</td></tr>
            ${renderTvaBreakdown(totaux.tvaParTaux)}
            <tr><td>Total TVA créditée</td><td class="num">${money(totaux.totalTva)}</td></tr>
            <tr class="gderpi-devis-doc__total-ttc"><td>Total TTC crédité</td><td class="num">${money(totaux.totalTtc)}</td></tr>
          </table>
        </div>
      </div>
      <div class="gderpi-devis-doc__sheet-spacer" aria-hidden="true"></div>
      ${renderDevisPageFooter(boutique, pied, cgvUrl)}
    </div>
  </article>
</body>
</html>`;
}

module.exports = renderAvoirHtml;
