const crypto = require('crypto');
const normalizeDevisLine = require('../devis/normalizeDevisLine');
const calculateDevisTotals = require('../devis/calculateDevisTotals');

function normalizeBonLivraison(raw) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const lignesRaw = Array.isArray(b.lignes) ? b.lignes : [];
  const lignes = lignesRaw.map((l, i) => normalizeDevisLine(l, i));
  const totaux = b.totaux && typeof b.totaux === 'object' ? b.totaux : calculateDevisTotals(lignes);

  return {
    id: String(b.id || b.bonLivraisonId || '').trim() || crypto.randomUUID(),
    commandeClientId: String(b.commandeClientId || '').trim(),
    commandeClientNumero: String(b.commandeClientNumero || '').trim(),
    boutiqueId: String(b.boutiqueId || '').trim(),
    clientId: b.clientId != null ? String(b.clientId).trim() || null : null,
    devisId: b.devisId != null ? String(b.devisId).trim() || null : null,
    devisNumero: String(b.devisNumero || '').trim(),
    documentClient: String(b.documentClient || '').trim(),
    referenceClient: String(b.referenceClient || '').trim(),
    numero: String(b.numero || '').trim(),
    objet: String(b.objet || '').trim(),
    notes: String(b.notes || '').trim(),
    adresseLivraison: String(b.adresseLivraison || '').trim(),
    contactClientId: b.contactClientId != null ? String(b.contactClientId).trim() || null : null,
    contactNom: String(b.contactNom || '').trim(),
    contactFonction: String(b.contactFonction || '').trim(),
    contactEmail: String(b.contactEmail || '').trim(),
    contactTelephone: String(b.contactTelephone || '').trim(),
    lignes,
    totaux,
    dateLivraison: b.dateLivraison || null,
    createdAt: b.createdAt || null,
    updatedAt: b.updatedAt || null
  };
}

module.exports = normalizeBonLivraison;
