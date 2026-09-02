/**
 * FICHIER : modules/gderpi/backend/services/pdf/renderDevisHtml.js
 * RÔLE : Génère le document HTML complet d'un devis (aperçu avant PDF).
 *
 * ENTRÉES : contexte { devis, boutique, client, logoUrl, entrepriseId, req }
 * SORTIES : string HTML
 *
 * DÉPEND DE : escapeHtmlText.js, formatMoneyFr.js, formatDateFr.js, formatPostalAddress.js
 * NE PAS : requêtes Mongo, génération PDF
 *
 * APPELÉ PAR : getDevisHtml.js
 */

const escapeHtmlText = require('./escapeHtmlText');
const formatMoneyFr = require('./formatMoneyFr');
const formatDateFr = require('./formatDateFr');
const formatPostalAddress = require('./formatPostalAddress');
const resolveDevisContact = require('./resolveDevisContact');
const resolveDevisEmetteurContact = require('./resolveDevisEmetteurContact');
const resolveDevisConditions = require('./resolveDevisConditions');
const resolveCgvProfil = require('./resolveCgvProfil');
const buildCgvPublicUrl = require('./buildCgvPublicUrl');
const { labelCgvProfil } = require('../devis/devisConditionsPaiementOptions');
const renderBonPourAccordSection = require('./renderBonPourAccordSection');
const renderDevisPaymentSection = require('./renderDevisPaymentSection');
const renderDevisPageFooter = require('./renderDevisPageFooter');
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

function renderConditionsSection(resolved) {
  if (!resolved || !resolved.sections || !resolved.sections.length) return '';
  let body = '';
  resolved.sections.forEach((section) => {
    if (section.title) {
      body += `<h4 class="gderpi-devis-doc__conditions-sub">${esc(section.title)}</h4>`;
    }
    body += `<div class="gderpi-devis-doc__conditions-block">${esc(section.text).replace(/\n/g, '<br>')}</div>`;
  });
  return `<section class="gderpi-devis-doc__conditions"><h3>Conditions de vente</h3>${body}</section>`;
}

function renderCgvAnnex(resolved, profil) {
  const inner = renderConditionsSection(resolved);
  if (!inner) return '';
  const profileLabel = labelCgvProfil(profil);
  return `<div class="gderpi-devis-doc__cgv-annex"><p class="gderpi-devis-doc__cgv-annex-title">Annexe — Conditions générales de vente (${esc(profileLabel)})</p>${inner}</div>`;
}

function renderClientBlock(client, contact) {
  if (!client) {
    return '<p class="gderpi-devis-doc__muted">Client non renseigné</p>';
  }
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
    return '<tr><td colspan="9" class="gderpi-devis-doc__muted">Aucune ligne</td></tr>';
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

function renderDevisHtml(context) {
  const { devis, boutique, client, logoUrl, entrepriseId, req, economy: economyMode } = context || {};
  const economy = economyMode === true;
  const d = devis || {};
  const totaux = d.totaux || {};
  const fraisPortHt = Number(d.fraisPortHt) || 0;
  const fraisPortTva = Number(d.fraisPortTauxTva) || 0;
  const lignesHt = Math.round((Array.isArray(d.lignes) ? d.lignes : [])
    .reduce((sum, line) => sum + (Number(line.montantHt) || 0), 0) * 100) / 100;

  const dateDevis = formatDateFr(d.createdAt);
  const dateValidite = formatDateFr(d.dateValidite);
  const objet = String(d.objet || '').trim();
  const referenceClient = String(d.documentClient || d.referenceClient || '').trim();
  const contact = resolveDevisContact(d, client);
  const emetteurContact = resolveDevisEmetteurContact(d, boutique);

  const cgvProfil = resolveCgvProfil(d, client);
  const conditionsResolved = resolveDevisConditions(boutique, client, { devis: d, cgvProfil });
  const cgvUrl = buildCgvPublicUrl(req, entrepriseId, boutique, cgvProfil);
  const joindreCgvAnnexe = d.joindreCgvAnnexe === true;

  const pied = String(boutique?.piedDePage || '').trim();

  const fraisPortRow = fraisPortHt > 0
    ? `<tr><td>Frais de port HT</td><td class="num">${money(fraisPortHt)}${fraisPortTva ? ` <span class="gderpi-devis-doc__muted">(TVA ${esc(fraisPortTva)} %)</span>` : ''}</td></tr>`
    : '';

  const htRows = fraisPortHt > 0
    ? `<tr><td>Sous-total lignes HT</td><td class="num">${money(lignesHt)}</td></tr>${fraisPortRow}<tr><td><strong>Total HT</strong></td><td class="num"><strong>${money(totaux.totalHt)}</strong></td></tr>`
    : `<tr><td>Total HT</td><td class="num">${money(totaux.totalHt)}</td></tr>`;

  const logoBlock = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="Logo" class="gderpi-devis-doc__logo">`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Devis ${esc(d.numero || '')}</title>
  <style>
    ${renderDocumentLayoutCss()}
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      font-size: 13px;
      line-height: 1.45;
      color: #1e293b;
      background: #f1f5f9;
    }
    .gderpi-devis-doc {
      max-width: 210mm;
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
    }
    .gderpi-devis-doc__sheet {
      min-height: calc(297mm - 26mm);
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }
    .gderpi-devis-doc__sheet-body {
      flex: 0 0 auto;
    }
    .gderpi-devis-doc__sheet-spacer {
      flex: 1 1 auto;
      min-height: 12mm;
    }
    .gderpi-devis-doc__header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
      border-bottom: 2px solid #0f766e;
    }
    .gderpi-devis-doc__logo { max-width: 200px; object-fit: contain; }
    .gderpi-devis-doc__issuer { min-width: 0; font-size: 12px; color: #334155; }
    .gderpi-devis-doc__issuer-block { display: block; }
    .gderpi-devis-doc__issuer-line {
      display: block;
      margin: 0 0 3px;
      line-height: 1.45;
    }
    .gderpi-devis-doc__title-block { min-width: 0; text-align: right; }
    .gderpi-devis-doc__title { margin: 0; font-size: 26px; font-weight: 800; color: #0f766e; letter-spacing: 0.02em; }
    .gderpi-devis-doc__meta { margin-top: 8px; font-size: 12px; color: #64748b; }
    .gderpi-devis-doc__client {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      text-align: left;
      font-size: 12px;
      color: #334155;
    }
    .gderpi-devis-doc__client h2 {
      margin: 0 0 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      font-weight: 700;
    }
    table.gderpi-devis-doc__lines {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    table.gderpi-devis-doc__lines th {
      text-align: left;
      padding: 8px 6px;
      background: #0f766e;
      color: #fff;
      font-weight: 600;
      font-size: 11px;
    }
    table.gderpi-devis-doc__lines th.num,
    table.gderpi-devis-doc__lines td.num { text-align: right; }
    table.gderpi-devis-doc__lines td {
      padding: 8px 6px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    tr.gderpi-devis-doc__line-desc td {
      padding-top: 0;
      padding-bottom: 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    .gderpi-devis-doc__desc {
      font-size: 11px;
      color: #475569;
      font-style: italic;
    }
    .gderpi-devis-doc__totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 24px;
    }
    table.gderpi-devis-doc__totals {
      min-width: 280px;
      border-collapse: collapse;
      font-size: 12px;
    }
    table.gderpi-devis-doc__totals td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    table.gderpi-devis-doc__totals tr.gderpi-devis-doc__total-ttc td {
      font-weight: 800;
      font-size: 14px;
      border-top: 2px solid #0f766e;
      border-bottom: none;
      padding-top: 10px;
    }
    .gderpi-devis-doc__contact strong,
    .gderpi-devis-doc__payment-terms-title strong {
      color: #334155;
      font-weight: 700;
    }
    .gderpi-devis-doc__payment-terms,
    .gderpi-devis-doc__conditions {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #475569;
    }
    .gderpi-devis-doc__payment-terms-title {
      margin: 0 0 8px;
      font-size: 11px;
      line-height: 1.45;
      color: #334155;
    }
    .gderpi-devis-doc__conditions h3 {
      margin: 0 0 8px;
      font-size: 11px;
      text-transform: uppercase;
      color: #64748b;
    }
    .gderpi-devis-doc__payment-terms div {
      margin: 2px 0;
    }
    .gderpi-devis-doc__payment-complement {
      margin-top: 6px;
      font-style: italic;
    }
    .gderpi-devis-doc__page-footer {
      flex-shrink: 0;
      margin-top: 0;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      line-height: 1.5;
      color: #64748b;
      text-align: center;
    }
    .gderpi-devis-doc__footer-cgv-link { color: #0f766e; font-weight: 600; text-decoration: underline; }
    .gderpi-devis-doc__conditions-sub {
      margin: 14px 0 6px;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
    }
    .gderpi-devis-doc__conditions-sub:first-of-type { margin-top: 0; }
    .gderpi-devis-doc__conditions-block { margin-bottom: 4px; }
    .gderpi-devis-doc__cgv-annex {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 2px dashed #cbd5e1;
    }
    .gderpi-devis-doc__cgv-annex-title {
      margin: 0 0 12px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0f766e;
    }
    .gderpi-devis-doc__bon-pour-accord {
      margin-top: 28px;
      padding: 16px 18px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 11px;
      color: #334155;
      page-break-inside: avoid;
    }
    .gderpi-devis-doc__bon-pour-accord h3 {
      margin: 0 0 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0f766e;
    }
    .gderpi-devis-doc__bpa-intro { margin: 0 0 14px; }
    .gderpi-devis-doc__bpa-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 24px;
    }
    .gderpi-devis-doc__bpa-field { display: flex; flex-direction: column; gap: 6px; }
    .gderpi-devis-doc__bpa-field--signature { grid-column: 1 / -1; }
    .gderpi-devis-doc__bpa-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.03em;
    }
    .gderpi-devis-doc__bpa-line {
      display: block;
      border-bottom: 1px solid #94a3b8;
      min-height: 22px;
    }
    .gderpi-devis-doc__bpa-line--tall { min-height: 48px; border-bottom-width: 1px; }
    @media print {
      body { background: #fff; }
      .gderpi-devis-doc__cgv-annex {
        page-break-before: always;
        border-top: 0;
        margin-top: 0;
        padding: 0 14mm 14mm;
      }
    }
    .gderpi-devis-doc__contact {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed #e2e8f0;
      font-size: 11px;
    }
    .gderpi-devis-doc__muted { color: #94a3b8;     }
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
        <h1 class="gderpi-devis-doc__title">DEVIS</h1>
        <div class="gderpi-devis-doc__meta">
          <div><strong>N°</strong> ${esc(d.numero || '—')}</div>
          ${dateDevis ? `<div><strong>Date</strong> ${esc(dateDevis)}</div>` : ''}
          ${dateValidite ? `<div><strong>Valable jusqu'au</strong> ${esc(dateValidite)}</div>` : ''}
          ${referenceClient ? `<div><strong>Bon de commande client</strong> ${esc(referenceClient)}</div>` : ''}
        </div>
        <div class="gderpi-devis-doc__client">
          <h2>Client</h2>
          ${renderClientBlock(client, contact)}
        </div>
      </div>
    </header>

    ${renderDocumentObjetLine(objet)}

    <table class="gderpi-devis-doc__lines">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Réf.</th>
          <th>Désignation</th>
          <th class="num">Qté</th>
          <th>Unité</th>
          <th class="num">P.U. HT</th>
          <th class="num">Rem.</th>
          <th class="num">Montant HT</th>
        </tr>
      </thead>
      <tbody>
        ${renderLineRows(d.lignes)}
      </tbody>
    </table>

    <div class="gderpi-devis-doc__totals-wrap">
      <table class="gderpi-devis-doc__totals">
        ${htRows}
        ${renderTvaBreakdown(totaux.tvaParTaux)}
        <tr><td>Total TVA</td><td class="num">${money(totaux.totalTva)}</td></tr>
        <tr class="gderpi-devis-doc__total-ttc"><td>Total TTC</td><td class="num">${money(totaux.totalTtc)}</td></tr>
      </table>
    </div>

    ${renderDevisPaymentSection(d)}
    ${renderBonPourAccordSection(d)}
    </div>
    <div class="gderpi-devis-doc__sheet-spacer" aria-hidden="true"></div>
    ${renderDevisPageFooter(boutique, pied, cgvUrl)}
    </div>
    ${joindreCgvAnnexe ? renderCgvAnnex(conditionsResolved, cgvProfil) : ''}
  </article>
</body>
</html>`;
}

module.exports = renderDevisHtml;
