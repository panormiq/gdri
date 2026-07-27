/**
 * FICHIER : modules/gderpi/backend/services/pdf/renderCommandeFournisseurHtml.js
 * RÔLE : Génère le document HTML complet d'une commande fournisseur.
 */

const escapeHtmlText = require('./escapeHtmlText');
const formatMoneyFr = require('./formatMoneyFr');
const formatDateFr = require('./formatDateFr');
const formatPostalAddress = require('./formatPostalAddress');
const renderDevisPageFooter = require('./renderDevisPageFooter');
const renderDocumentLayoutCss = require('./renderDocumentLayoutCss');
const renderDocumentObjetLine = require('./renderDocumentObjetLine');

const esc = escapeHtmlText;
const money = formatMoneyFr;
const ACCENT = '#7c3aed';

function issuerLine(html) {
  return `<div class="gderpi-devis-doc__issuer-line">${html}</div>`;
}

function renderLegalLines(boutique) {
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
  if (b.telephone) lines.push(issuerLine(`Tél. ${esc(b.telephone)}`));
  if (b.email) lines.push(issuerLine(esc(b.email)));

  return `<div class="gderpi-devis-doc__issuer-block">${lines.join('')}</div>`;
}

function renderFournisseurBlock(fournisseur) {
  if (!fournisseur) return '<p class="gderpi-devis-doc__muted">Fournisseur non renseigné</p>';
  const parts = [];
  const title = fournisseur.raisonSociale || fournisseur.nom || 'Fournisseur';
  parts.push(`<strong>${esc(title)}</strong>`);
  const addr = formatPostalAddress({
    adresse: fournisseur.adresse,
    complement: fournisseur.adresseComplement,
    codePostal: fournisseur.codePostal,
    ville: fournisseur.ville,
    pays: fournisseur.pays
  });
  if (addr.length) parts.push(addr.map((l) => esc(l)).join('<br>'));
  const contactLines = [];
  if (fournisseur.contactNom) contactLines.push(`<strong>À l'attention de :</strong> ${esc(fournisseur.contactNom)}`);
  if (fournisseur.contactFonction) contactLines.push(esc(fournisseur.contactFonction));
  if (fournisseur.email) contactLines.push(esc(fournisseur.email));
  if (fournisseur.telephone) contactLines.push(`Tél. ${esc(fournisseur.telephone)}`);
  if (contactLines.length) {
    parts.push('<div class="gderpi-devis-doc__contact">' + contactLines.join('<br>') + '</div>');
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
      `<td>${esc(line.libelle || '—')}</td>` +
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

function renderCommandeFournisseurHtml(context) {
  const { commande, boutique, fournisseur, commandeClient, logoUrl } = context || {};
  const c = commande || {};
  const totaux = c.totaux || {};
  const fraisPortHt = Number(c.fraisPortHt) || 0;
  const fraisPortTva = Number(c.fraisPortTauxTva) || 0;
  const lignesHt = Math.round((Array.isArray(c.lignes) ? c.lignes : [])
    .reduce((sum, line) => sum + (Number(line.montantHt) || 0), 0) * 100) / 100;
  const dateCommande = formatDateFr(c.createdAt);
  const objet = String(c.objet || '').trim();
  const notes = String(c.notes || '').trim();
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

  const paymentTerms = String(fournisseur?.conditionsPaiement || '').trim();
  const delai = Number(fournisseur?.delaiLivraisonJours);
  const deliveryLine = Number.isFinite(delai) && delai > 0
    ? `<div><strong>Délai de livraison souhaité :</strong> ${esc(delai)} jour(s)</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Commande fournisseur ${esc(c.numero || '')}</title>
  <style>
    ${renderDocumentLayoutCss()}
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; font-size: 13px; line-height: 1.45; color: #1e293b; background: #f1f5f9; }
    .gderpi-devis-doc { max-width: 210mm; margin: 0 auto; background: #fff; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08); }
    .gderpi-devis-doc__sheet { min-height: calc(297mm - 26mm); display: flex; flex-direction: column; }
    .gderpi-devis-doc__sheet-body { flex: 0 0 auto; }
    .gderpi-devis-doc__sheet-spacer { flex: 1 1 auto; min-height: 12mm; }
    .gderpi-devis-doc__header { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; border-bottom: 2px solid ${ACCENT}; }
    .gderpi-devis-doc__logo { max-width: 200px; object-fit: contain; }
    .gderpi-devis-doc__issuer { font-size: 12px; color: #334155; }
    .gderpi-devis-doc__issuer-line { display: block; margin: 0 0 3px; }
    .gderpi-devis-doc__title-block { text-align: right; }
    .gderpi-devis-doc__title { margin: 0; font-size: 24px; font-weight: 800; color: ${ACCENT}; }
    .gderpi-devis-doc__meta { margin-top: 8px; font-size: 12px; color: #64748b; }
    .gderpi-devis-doc__client { background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; text-align: left; font-size: 12px; }
    .gderpi-devis-doc__client h2 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; color: #64748b; }
    .gderpi-devis-doc__notes { margin: 0 0 20px; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; color: #475569; }
    table.gderpi-devis-doc__lines { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    table.gderpi-devis-doc__lines th { text-align: left; padding: 8px 6px; background: ${ACCENT}; color: #fff; font-size: 11px; }
    table.gderpi-devis-doc__lines th.num, table.gderpi-devis-doc__lines td.num { text-align: right; }
    table.gderpi-devis-doc__lines td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr.gderpi-devis-doc__line-desc td { padding-top: 0; padding-bottom: 10px; }
    .gderpi-devis-doc__desc { font-size: 11px; color: #475569; font-style: italic; }
    .gderpi-devis-doc__totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 24px; }
    table.gderpi-devis-doc__totals { min-width: 280px; border-collapse: collapse; font-size: 12px; }
    table.gderpi-devis-doc__totals td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
    table.gderpi-devis-doc__totals tr.gderpi-devis-doc__total-ttc td { font-weight: 800; font-size: 14px; border-top: 2px solid ${ACCENT}; }
    .gderpi-devis-doc__contact { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0; font-size: 11px; }
    .gderpi-devis-doc__payment-terms { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #475569; }
    .gderpi-devis-doc__page-footer { flex-shrink: 0; margin-top: 0; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; text-align: center; }
    .gderpi-devis-doc__muted { color: #94a3b8; }
    @media print { body { background: #fff; } }
  </style>
</head>
<body>
  <article class="gderpi-devis-doc">
    <div class="gderpi-devis-doc__sheet">
      <div class="gderpi-devis-doc__sheet-body">
        <header class="gderpi-devis-doc__header">
          <div class="gderpi-devis-doc__issuer">
            ${logoBlock}
            <div style="margin-top:${logoUrl ? '12px' : '0'}">${renderLegalLines(boutique)}</div>
          </div>
          <div class="gderpi-devis-doc__title-block">
            <h1 class="gderpi-devis-doc__title">COMMANDE FOURNISSEUR</h1>
            <div class="gderpi-devis-doc__meta">
              <div><strong>N° commande</strong> ${esc(c.numero || '—')}</div>
              ${dateCommande ? `<div><strong>Date</strong> ${esc(dateCommande)}</div>` : ''}
              ${commandeClient?.numero ? `<div><strong>Commande client</strong> ${esc(commandeClient.numero)}</div>` : ''}
            </div>
            <div class="gderpi-devis-doc__client">
              <h2>Fournisseur</h2>
              ${renderFournisseurBlock(fournisseur)}
            </div>
          </div>
        </header>
        ${renderDocumentObjetLine(objet)}
        ${notes ? `<div class="gderpi-devis-doc__notes"><strong>Notes</strong><br>${esc(notes).replace(/\n/g, '<br>')}</div>` : ''}
        <table class="gderpi-devis-doc__lines">
          <thead><tr>
            <th class="num">#</th><th>Réf.</th><th>Désignation</th><th class="num">Qté</th><th>Unité</th>
            <th class="num">P.U. HT</th><th class="num">Rem.</th><th class="num">Montant HT</th>
          </tr></thead>
          <tbody>${renderLineRows(c.lignes)}</tbody>
        </table>
        <div class="gderpi-devis-doc__totals-wrap">
          <table class="gderpi-devis-doc__totals">
            ${htRows}
            ${renderTvaBreakdown(totaux.tvaParTaux)}
            <tr><td>Total TVA</td><td class="num">${money(totaux.totalTva)}</td></tr>
            <tr class="gderpi-devis-doc__total-ttc"><td>Total TTC</td><td class="num">${money(totaux.totalTtc)}</td></tr>
          </table>
        </div>
        ${(paymentTerms || deliveryLine) ? `<div class="gderpi-devis-doc__payment-terms">${deliveryLine}${paymentTerms ? `<div><strong>Conditions de paiement :</strong> ${esc(paymentTerms)}</div>` : ''}</div>` : ''}
      </div>
      <div class="gderpi-devis-doc__sheet-spacer" aria-hidden="true"></div>
      ${renderDevisPageFooter(boutique, pied, '')}
    </div>
  </article>
</body>
</html>`;
}

module.exports = renderCommandeFournisseurHtml;
