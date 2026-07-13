/**
 * Page HTML publique de confirmation de commande depuis un devis.
 */

const { formatMoney, formatDateFr } = require('./applyDevisMailTemplate');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function lineMontantHt(line) {
  const qty = Number(line.quantite) || 0;
  const prix = Number(line.prixHt) || 0;
  const rem = Number(line.remisePct ?? line.remise ?? 0) || 0;
  return Math.round(qty * prix * (1 - rem / 100) * 100) / 100;
}

function renderLineRow(line, index) {
  const montant = lineMontantHt(line);
  const qty = Number(line.quantite) || 1;
  const prix = formatMoney(line.prixHt);
  const montantFmt = formatMoney(montant);
  const tauxTva = Number(line.tauxTva) || 20;
  const remise = Number(line.remisePct ?? line.remise ?? 0) || 0;

  return `
    <tr class="gderpi-order-line" data-prix-ht="${esc(line.prixHt)}" data-remise="${esc(remise)}" data-taux-tva="${esc(tauxTva)}">
      <td class="gderpi-order-ref">${esc(line.reference || '—')}</td>
      <td class="gderpi-order-libelle">
        <strong>${esc(line.libelle || 'Article')}</strong>
        ${line.description ? `<div class="gderpi-order-desc">${esc(line.description)}</div>` : ''}
        <input type="hidden" name="lignes[${index}][id]" value="${esc(line.id)}">
      </td>
      <td class="gderpi-order-pu">${esc(prix)}</td>
      <td class="gderpi-order-qty">
        <input type="number" name="lignes[${index}][quantite]" value="${esc(qty)}" min="0" step="any" class="gderpi-qty-input" aria-label="Quantité">
      </td>
      <td class="gderpi-order-montant">${esc(montantFmt)}</td>
      <td class="gderpi-order-action">
        <button type="button" class="gderpi-remove-btn" title="Retirer cet article">Retirer</button>
      </td>
    </tr>`;
}

function renderOrderForm({ devis, boutique, acceptActionUrl, errorMessage }) {
  const lignes = Array.isArray(devis?.lignes) ? devis.lignes : [];
  const totaux = devis?.totaux || {};
  const validite = formatDateFr(devis?.dateValidite);
  const linesHtml = lignes.map((line, i) => renderLineRow(line, i)).join('');
  const initialTtc = formatMoney(totaux.totalTtc ?? totaux.ttc);

  return `
    <div class="gderpi-accept-card">
      <div class="gderpi-accept-badge">Devis ${esc(devis?.numero || devis?.devisId || '')}</div>
      <h1>Confirmer ma commande</h1>
      ${boutique?.nom ? `<p class="gderpi-accept-meta">${esc(boutique.nom)}</p>` : ''}
      ${devis?.objet ? `<p><strong>Objet :</strong> ${esc(devis.objet)}</p>` : ''}
      ${validite ? `<p class="gderpi-accept-meta">Devis valable jusqu'au ${esc(validite)}</p>` : ''}

      ${errorMessage ? `<div class="gderpi-accept-error">${esc(errorMessage)}</div>` : ''}

      <p class="gderpi-accept-hint">
        Vérifiez les articles et quantités ci-dessous. Vous pouvez ajuster les quantités ou retirer un article.
        En confirmant, vous acceptez les conditions du devis pour les articles commandés.
      </p>
      <p class="gderpi-accept-note">
        Si vous modifiez les quantités ou retirez des articles, un récapitulatif des modifications et du nouveau tarif vous sera envoyé par e-mail après validation par notre équipe.
      </p>

      <form method="post" action="${esc(acceptActionUrl)}" id="gderpi-order-form">
        <div class="gderpi-order-table-wrap">
          <table class="gderpi-order-table">
            <thead>
              <tr>
                <th>Réf.</th>
                <th>Article</th>
                <th>PU HT</th>
                <th>Qté</th>
                <th>Montant HT</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="gderpi-order-lines">${linesHtml}</tbody>
          </table>
        </div>

        <div class="gderpi-order-totals">
          <div class="gderpi-order-total-row"><span>Total HT</span><strong id="gderpi-total-ht">—</strong></div>
          <div class="gderpi-order-total-row"><span>TVA</span><strong id="gderpi-total-tva">—</strong></div>
          <div class="gderpi-order-total-row gderpi-order-total-row--ttc"><span>Total TTC</span><strong id="gderpi-total-ttc">${esc(initialTtc)}</strong></div>
          <p class="gderpi-accept-meta gderpi-order-total-hint">Montant devis initial : ${esc(initialTtc)} TTC</p>
        </div>

        <label class="gderpi-order-ref-label" for="gderpi-ref-client">Votre référence commande (optionnel)</label>
        <input type="text" id="gderpi-ref-client" name="referenceClient" class="gderpi-order-ref-input" maxlength="120" placeholder="Ex. BC-2026-0042">

        <button type="submit" class="gderpi-accept-btn" id="gderpi-submit-btn">Confirmer ma commande</button>
      </form>
    </div>`;
}

function renderDevisAcceptPage({ devis, boutique, acceptActionUrl, state, errorMessage }) {
  let content = '';

  if (state === 'already_accepted') {
    content = `
      <div class="gderpi-accept-card gderpi-accept-card--success">
        <div class="gderpi-accept-icon">✓</div>
        <h1>Commande déjà confirmée</h1>
        <p>Ce devis a déjà donné lieu à une commande. Merci pour votre confiance.</p>
      </div>`;
  } else if (state === 'expired') {
    content = `
      <div class="gderpi-accept-card gderpi-accept-card--muted">
        <h1>Lien expiré</h1>
        <p>Ce lien n'est plus valide. Contactez votre interlocuteur commercial.</p>
      </div>`;
  } else if (state === 'invalid') {
    content = `
      <div class="gderpi-accept-card gderpi-accept-card--muted">
        <h1>Lien invalide</h1>
        <p>Ce lien n'est pas reconnu. Vérifiez l'URL reçue par e-mail.</p>
      </div>`;
  } else {
    content = renderOrderForm({ devis, boutique, acceptActionUrl, errorMessage });
  }

  return wrapPage(devis, content, state === 'ready');
}

function renderDevisAcceptSuccessPage({ devis, commande, modifieeParClient }) {
  const numero = commande?.numero || '';
  const montant = formatMoney(commande?.totaux?.totalTtc);
  const devisNum = devis?.numero || devis?.devisId || '';

  let detail = '';
  if (modifieeParClient) {
    detail = `
      <p>Votre commande <strong>${esc(numero)}</strong> a bien été enregistrée à partir du devis <strong>${esc(devisNum)}</strong>.</p>
      <p>Des modifications par rapport au devis initial ont été constatées. Un récapitulatif des modifications et du tarif vous sera envoyé par e-mail après validation par notre équipe.</p>
      ${montant ? `<p class="gderpi-accept-amount">${esc(montant)} <span>TTC (provisoire)</span></p>` : ''}`;
  } else {
    detail = `
      <p>Votre commande <strong>${esc(numero)}</strong> a bien été enregistrée, conforme au devis <strong>${esc(devisNum)}</strong>.</p>
      <p>Un e-mail de confirmation vous a été envoyé.</p>
      ${montant ? `<p class="gderpi-accept-amount">${esc(montant)} <span>TTC</span></p>` : ''}`;
  }

  const content = `
    <div class="gderpi-accept-card gderpi-accept-card--success">
      <div class="gderpi-accept-icon">✓</div>
      <h1>Commande confirmée</h1>
      ${detail}
      <p class="gderpi-accept-meta">Merci pour votre confiance.</p>
    </div>`;

  return wrapPage(devis, content, false);
}

function wrapPage(devis, content, withScript) {
  const script = withScript ? `
<script>
(function () {
  function fmt(n) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
  }
  function recalc() {
    const rows = document.querySelectorAll('.gderpi-order-line:not(.gderpi-order-line--removed)');
    let totalHt = 0;
    const tvaBuckets = {};
    rows.forEach(function (row) {
      const input = row.querySelector('.gderpi-qty-input');
      const qty = Math.max(0, Number(input?.value) || 0);
      const prix = Number(row.dataset.prixHt) || 0;
      const remise = Number(row.dataset.remise) || 0;
      const taux = Number(row.dataset.tauxTva) || 20;
      const ht = Math.round(qty * prix * (1 - remise / 100) * 100) / 100;
      const montantCell = row.querySelector('.gderpi-order-montant');
      if (montantCell) montantCell.textContent = fmt(ht);
      totalHt += ht;
      const key = String(taux);
      tvaBuckets[key] = (tvaBuckets[key] || 0) + ht;
    });
    let totalTva = 0;
    Object.keys(tvaBuckets).forEach(function (k) {
      totalTva += Math.round(tvaBuckets[k] * Number(k) / 100 * 100) / 100;
    });
    totalHt = Math.round(totalHt * 100) / 100;
    totalTva = Math.round(totalTva * 100) / 100;
    const totalTtc = Math.round((totalHt + totalTva) * 100) / 100;
    const htEl = document.getElementById('gderpi-total-ht');
    const tvaEl = document.getElementById('gderpi-total-tva');
    const ttcEl = document.getElementById('gderpi-total-ttc');
    if (htEl) htEl.textContent = fmt(totalHt);
    if (tvaEl) tvaEl.textContent = fmt(totalTva);
    if (ttcEl) ttcEl.textContent = fmt(totalTtc);
    const activeRows = document.querySelectorAll('.gderpi-order-line:not(.gderpi-order-line--removed)').length;
    const submitBtn = document.getElementById('gderpi-submit-btn');
    if (submitBtn) submitBtn.disabled = activeRows === 0;
  }
  document.getElementById('gderpi-order-lines')?.addEventListener('input', function (e) {
    if (e.target.classList.contains('gderpi-qty-input')) recalc();
  });
  document.getElementById('gderpi-order-lines')?.addEventListener('click', function (e) {
    const btn = e.target.closest('.gderpi-remove-btn');
    if (!btn) return;
    const row = btn.closest('.gderpi-order-line');
    if (!row) return;
    row.classList.add('gderpi-order-line--removed');
    const input = row.querySelector('.gderpi-qty-input');
    if (input) input.value = '0';
    recalc();
  });
  document.getElementById('gderpi-order-form')?.addEventListener('submit', function () {
    document.querySelectorAll('.gderpi-order-line--removed .gderpi-qty-input').forEach(function (input) {
      input.value = '0';
    });
  });
  recalc();
})();
</script>` : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Confirmation commande — devis ${esc(devis?.numero || '')}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;padding:24px 16px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:linear-gradient(160deg,#eff6ff,#f8fafc)}
    .gderpi-accept-card{max-width:760px;width:100%;margin:0 auto;background:#fff;border-radius:16px;padding:28px 24px;box-shadow:0 12px 40px rgba(15,23,42,.1)}
    .gderpi-accept-card--success{border-top:4px solid #16a34a;text-align:center}
    .gderpi-accept-card--muted{border-top:4px solid #94a3b8;text-align:center}
    .gderpi-accept-icon{width:56px;height:56px;border-radius:50%;background:#dcfce7;color:#16a34a;display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 16px}
    h1{margin:0 0 12px;font-size:1.45rem;color:#0f172a}
    p{color:#475569;line-height:1.6;margin:0 0 12px}
    .gderpi-accept-badge{display:inline-block;padding:4px 10px;background:#eff6ff;color:#1d4ed8;border-radius:999px;font-size:12px;font-weight:600;margin-bottom:12px}
    .gderpi-accept-amount{font-size:2rem;font-weight:700;color:#0f172a;margin:16px 0}
    .gderpi-accept-amount span{font-size:1rem;font-weight:500;color:#64748b}
    .gderpi-accept-meta{font-size:14px;color:#64748b}
    .gderpi-accept-hint{font-size:14px;margin-top:16px}
    .gderpi-accept-note{font-size:13px;color:#64748b;background:#f8fafc;border-left:3px solid #3b82f6;padding:10px 12px;border-radius:0 8px 8px 0;margin:12px 0 20px}
    .gderpi-accept-error{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;font-size:14px;margin:12px 0}
    .gderpi-order-table-wrap{overflow-x:auto;margin:16px 0}
    .gderpi-order-table{width:100%;border-collapse:collapse;font-size:14px}
    .gderpi-order-table th{text-align:left;padding:8px 10px;background:#f8fafc;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0;white-space:nowrap}
    .gderpi-order-table td{padding:10px;border-bottom:1px solid #e2e8f0;vertical-align:top}
    .gderpi-order-ref{color:#64748b;font-size:13px;white-space:nowrap}
    .gderpi-order-desc{font-size:12px;color:#94a3b8;margin-top:4px}
    .gderpi-order-pu,.gderpi-order-montant{white-space:nowrap;text-align:right}
    .gderpi-order-qty{width:90px}
    .gderpi-qty-input{width:72px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px}
    .gderpi-remove-btn{border:0;background:#fee2e2;color:#b91c1c;padding:6px 10px;border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap}
    .gderpi-remove-btn:hover{background:#fecaca}
    .gderpi-order-line--removed{opacity:.45}
    .gderpi-order-line--removed .gderpi-qty-input{pointer-events:none}
    .gderpi-order-totals{margin:20px 0;padding:16px;background:#f8fafc;border-radius:10px}
    .gderpi-order-total-row{display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:#475569}
    .gderpi-order-total-row--ttc{font-size:16px;color:#0f172a;margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0}
    .gderpi-order-total-hint{margin:8px 0 0;font-size:12px}
    .gderpi-order-ref-label{display:block;font-size:14px;color:#475569;margin:16px 0 6px}
    .gderpi-order-ref-input{width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px}
    .gderpi-accept-btn{width:100%;margin-top:16px;padding:14px 20px;border:0;border-radius:10px;background:#16a34a;color:#fff;font-size:16px;font-weight:600;cursor:pointer}
    .gderpi-accept-btn:hover:not(:disabled){background:#15803d}
    .gderpi-accept-btn:disabled{background:#94a3b8;cursor:not-allowed}
    @media(max-width:640px){
      .gderpi-order-action,.gderpi-order-ref{display:none}
      .gderpi-order-table th:nth-child(3),.gderpi-order-table td:nth-child(3){display:none}
    }
  </style>
</head>
<body>${content}${script}</body>
</html>`;
}

module.exports = { renderDevisAcceptPage, renderDevisAcceptSuccessPage };
