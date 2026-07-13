/**
 * Remplace les variables de template e-mail devis.
 */

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
}

function formatDateFr(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function applyTemplate(template, vars) {
  let out = String(template || '');
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value ?? ''));
  }
  return out;
}

function buildDevisTemplateVars({ devis, boutique, client }) {
  const totaux = devis?.totaux || {};
  return {
    numero: devis?.numero || devis?.devisId || '',
    objet: devis?.objet || '',
    contactNom: devis?.contactNom || client?.nom || client?.raisonSociale || 'Madame, Monsieur',
    boutique: boutique?.nom || boutique?.libelle || '',
    montantTtc: formatMoney(totaux.totalTtc ?? totaux.ttc),
    dateValidite: formatDateFr(devis?.dateValidite)
  };
}

module.exports = { applyTemplate, buildDevisTemplateVars, formatMoney, formatDateFr };
