/**
 * FICHIER : modules/gderpi/backend/services/commande-client/applyAvancementLignes.js
 * RÔLE : Applique un avancement prestation (heures ou %) sur les lignes dev/service.
 *
 * ENTRÉES : lignes[], items[{ id, quantite?, percent? }], now
 * SORTIES : lignes mises à jour
 *
 * DÉPEND DE : remainingPrestationQty.js
 * NE PAS : persistance, changement de statut
 *
 * APPELÉ PAR : validateRecetteCommande.js
 */

const remainingPrestationQty = require('../workflow/remainingPrestationQty');
const isPrestationLine = require('../workflow/isPrestationLine');

function applyAvancementLignes(lignes, items, now) {
  const list = Array.isArray(lignes) ? lignes.map((l) => ({ ...l })) : [];
  const byId = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const id = String(item?.id || '').trim();
    if (id) byId.set(id, item);
  });
  const date = now || new Date();

  list.forEach((line, idx) => {
    if (!isPrestationLine(line)) return;
    const item = byId.get(String(line.id));
    if (!item) return;

    const ordered = Number(line.quantite) || 0;
    const already = Number(line.quantiteLivree) || 0;
    const reste = remainingPrestationQty(line);
    if (reste <= 0) return;

    let add = Number(item.quantite);
    if (!Number.isFinite(add) || add <= 0) {
      const pct = Number(item.percent);
      if (Number.isFinite(pct) && pct > 0) {
        add = Math.round(ordered * (pct / 100) * 10000) / 10000;
      }
    }
    if (!Number.isFinite(add) || add <= 0) return;
    add = Math.min(reste, Math.round(add * 10000) / 10000);

    const quantiteLivree = Math.round((already + add) * 10000) / 10000;
    const done = quantiteLivree + 0.0001 >= ordered;
    list[idx] = {
      ...line,
      quantiteLivree,
      recetteValideeAt: done ? (line.recetteValideeAt || date) : null
    };
  });

  return list;
}

module.exports = applyAvancementLignes;
