const escapeHtmlText = require('./escapeHtmlText');
const formatDateFr = require('./formatDateFr');
const resolveDevisContact = require('./resolveDevisContact');
const resolveDevisEmetteurContact = require('./resolveDevisEmetteurContact');
const renderDevisPageFooter = require('./renderDevisPageFooter');
const renderDocumentObjetLine = require('./renderDocumentObjetLine');
const buildCgvPublicUrl = require('./buildCgvPublicUrl');
const resolveCgvProfil = require('./resolveCgvProfil');

const esc = escapeHtmlText;

function renderLegalBlock(boutique, emetteurContact) {
  const b = boutique || {};
  const lines = [];
  const name = b.raisonSociale || b.nom || '';
  if (name) lines.push(`<strong>${esc(name)}</strong>`);
  if (b.adresse) lines.push(esc(b.adresse));
  const cpVille = [b.codePostal, b.ville].filter(Boolean).join(' ');
  if (cpVille) lines.push(esc(cpVille));
  if (b.siret) lines.push(`SIRET : ${esc(b.siret)}`);
  let html = lines.join('<br>');
  const contact = emetteurContact;
  if (contact?.nom) html += '<br><br><strong>De la part de :</strong> ' + esc(contact.nom);
  return html;
}

function renderLineRows(lignes) {
  const lines = Array.isArray(lignes) ? lignes : [];
  return lines.map((line, index) =>
    '<tr>' +
    `<td class="num">${index + 1}</td>` +
    `<td>${esc(line.reference || '—')}</td>` +
    `<td>${esc(line.referenceClient || '') ? esc(line.referenceClient) + '<br>' : ''}${esc(line.libelle || '—')}</td>` +
    `<td class="num">${esc(line.quantite)}</td>` +
    `<td>${esc(line.unite || 'pièce')}</td>` +
    '</tr>'
  ).join('');
}

function renderBonLivraisonHtml(context) {
  const { bon, boutique, client, devis, logoUrl, entrepriseId, req } = context || {};
  const b = bon || {};
  const dateBl = formatDateFr(b.dateLivraison || b.createdAt);
  const emetteurContact = resolveDevisEmetteurContact(devis || {}, boutique);
  const cgvUrl = buildCgvPublicUrl(req, entrepriseId, boutique, resolveCgvProfil(devis || {}, client));
  const pied = String(boutique?.piedDePage || '').trim();
  const adresseLivraison = String(b.adresseLivraison || '').trim();
  const blContact = {
    nom: String(b.contactNom || '').trim(),
    fonction: String(b.contactFonction || '').trim(),
    email: String(b.contactEmail || '').trim(),
    telephone: String(b.contactTelephone || '').trim()
  };
  const hasBlContact = Boolean(blContact.nom || blContact.email || blContact.telephone);
  const contact = hasBlContact ? blContact : resolveDevisContact(devis || {}, client);

  const clientName = client?.displayName || client?.raisonSociale
    || [client?.prenom, client?.nom].filter(Boolean).join(' ')
    || 'Client';

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>BL ${esc(b.numero || '')}</title>
<style>
@page { size: A4; margin: 10mm 12mm 18mm 12mm; }
body { margin:0; padding:12px; font-family:Segoe UI,system-ui,sans-serif; font-size:13px; color:#1e293b; background:#f1f5f9; }
.doc { max-width:210mm; margin:0 auto; background:#fff; padding:8mm 14mm 18mm; box-shadow:0 4px 24px rgba(15,23,42,.08); }
.hdr { display:grid; grid-template-columns:1fr 1fr; gap:16px 24px; border-bottom:2px solid #047857; padding-bottom:12px; margin-bottom:16px; }
.title { margin:0; font-size:24px; font-weight:800; color:#047857; }
.meta { margin-top:8px; font-size:12px; color:#64748b; }
.logo { max-height:56px; max-width:180px; }
.addr { margin-top:10px; padding:10px 12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; font-size:12px; }
table.lines { width:100%; border-collapse:collapse; font-size:12px; margin-top:16px; }
table.lines th { background:#047857; color:#fff; padding:8px 6px; text-align:left; }
table.lines th.num, table.lines td.num { text-align:right; }
table.lines td { padding:8px 6px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
.sign { margin-top:36px; display:grid; grid-template-columns:1fr 1fr; gap:24px; font-size:11px; }
.sign-box { border:1px solid #cbd5e1; border-radius:6px; min-height:72px; padding:10px; }
.gderpi-devis-doc__objet { margin:0 0 14px; font-size:12px; line-height:1.45; color:#334155; }
.gderpi-devis-doc__objet strong { color:#64748b; font-weight:700; }
.gderpi-devis-doc__page-footer { margin-top:24px; padding-top:12px; border-top:1px solid #e2e8f0; font-size:10px; color:#64748b; text-align:center; page-break-inside:avoid; }
@media print {
  body { background:#fff; padding:0; }
  .doc { box-shadow:none; padding:0 0 18mm; }
  .gderpi-devis-doc__page-footer {
    position:fixed;
    left:0;
    right:0;
    bottom:0;
    padding:6px 12mm 0;
    background:#fff;
    margin-top:0;
  }
}
</style></head><body>
<article class="doc">
  <header class="hdr">
    <div>${logoUrl ? `<img class="logo" src="${esc(logoUrl)}" alt="Logo">` : ''}<div style="margin-top:12px;font-size:12px;">${renderLegalBlock(boutique, emetteurContact)}</div></div>
    <div>
      <h1 class="title">BON DE LIVRAISON</h1>
      <div class="meta">
        <div><strong>N°</strong> ${esc(b.numero || '—')}</div>
        ${dateBl ? `<div><strong>Date</strong> ${esc(dateBl)}</div>` : ''}
        <div><strong>Commande</strong> ${esc(b.commandeClientNumero || '—')}</div>
        ${b.devisNumero ? `<div><strong>Devis</strong> ${esc(b.devisNumero)}</div>` : ''}
        ${b.documentClient ? `<div><strong>Document client</strong> ${esc(b.documentClient)}</div>` : ''}
        ${b.referenceClient ? `<div><strong>Bon de commande client</strong> ${esc(b.referenceClient)}</div>` : ''}
      </div>
      <div class="addr">
        <strong>Client</strong><br>${esc(clientName)}
        ${contact?.nom ? '<br>À l\'attention de : ' + esc(contact.nom) : ''}
        ${adresseLivraison ? '<br><br><strong>Adresse de livraison</strong><br>' + esc(adresseLivraison).replace(/\n/g, '<br>') : ''}
      </div>
    </div>
  </header>
  ${renderDocumentObjetLine(b.objet)}
  <table class="lines"><thead><tr><th class="num">#</th><th>Réf.</th><th>Désignation</th><th class="num">Qté livrée</th><th>Unité</th></tr></thead>
  <tbody>${renderLineRows(b.lignes)}</tbody></table>
  <div class="sign">
    <div><div class="sign-box"><strong>Émis par</strong><br>${esc(boutique?.nom || boutique?.raisonSociale || '')}</div></div>
    <div><div class="sign-box"><strong>Reçu par le client</strong><br>Date et signature</div></div>
  </div>
  ${renderDevisPageFooter(boutique, pied, cgvUrl)}
</article></body></html>`;
}

module.exports = renderBonLivraisonHtml;
