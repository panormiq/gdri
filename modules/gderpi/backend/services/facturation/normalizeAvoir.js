/**
 * Normalise un avoir client embarqué dans une facture.
 */

const crypto = require('crypto');

function normalizeAvoir(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const totaux = a.totaux && typeof a.totaux === 'object' ? a.totaux : {};

  let id = String(a.id || a.avoirId || '').trim();
  if (!id) id = crypto.randomUUID();

  const motif = String(a.motif || '').trim();
  const modeRaw = String(a.mode || '').trim().toLowerCase();
  const mode = modeRaw === 'remboursement' ? 'remboursement' : 'imputation';
  let remboursementStatut = null;
  if (mode === 'remboursement') {
    const st = String(a.remboursementStatut || '').trim().toLowerCase();
    remboursementStatut = st === 'rembourse' ? 'rembourse' : 'en_attente';
  }

  return {
    id,
    numero: String(a.numero || a.avoirNumero || '').trim(),
    date: a.date || a.avoirDate || null,
    factureOrigineId: String(a.factureOrigineId || '').trim() || null,
    factureOrigineNumero: String(a.factureOrigineNumero || '').trim() || null,
    motif,
    mode,
    remboursementStatut,
    rembourseAt: a.rembourseAt || null,
    lignes: Array.isArray(a.lignes) ? a.lignes.map((l) => ({
      id: String(l.id || l.lineId || '').trim(),
      quantite: Number(l.quantite) || 0
    })).filter((l) => l.id && l.quantite > 0) : [],
    totaux
  };
}

module.exports = normalizeAvoir;
