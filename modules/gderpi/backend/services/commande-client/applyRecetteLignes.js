/**
 * FICHIER : modules/gderpi/backend/services/commande-client/applyRecetteLignes.js
 * RÔLE : Marque les lignes dev/service comme recettées.
 */

const { filterLinesByKind } = require('../workflow/commandeClientKind');

function applyRecetteLignes(lignes, ligneIds, now) {
  const list = Array.isArray(lignes) ? lignes.map((l) => ({ ...l })) : [];
  const ids = new Set((Array.isArray(ligneIds) ? ligneIds : []).map((id) => String(id).trim()).filter(Boolean));
  const date = now || new Date();

  list.forEach((line, idx) => {
    const t = String(line.articleType || '').toLowerCase();
    if (t !== 'developpement' && t !== 'service') return;
    if (line.recetteValideeAt) return;
    if (!ids.has(String(line.id))) return;
    list[idx] = { ...line, recetteValideeAt: date };
  });

  return list;
}

function remainingDevLineIds(lignes) {
  return filterLinesByKind(lignes, 'dev')
    .filter((l) => !l.recetteValideeAt)
    .map((l) => String(l.id));
}

module.exports = { applyRecetteLignes, remainingDevLineIds };
