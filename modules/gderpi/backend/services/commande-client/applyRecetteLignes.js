/**
 * FICHIER : modules/gderpi/backend/services/commande-client/applyRecetteLignes.js
 * RÔLE : Marque les lignes dev/service comme recettées.
 */

const { filterLinesByKind } = require('../workflow/commandeClientKind');
const lineRequiresRecette = require('../workflow/lineRequiresRecette');
const isPrestationLine = require('../workflow/isPrestationLine');

function applyRecetteLignes(lignes, ligneIds, now) {
  const list = Array.isArray(lignes) ? lignes.map((l) => ({ ...l })) : [];
  const ids = new Set((Array.isArray(ligneIds) ? ligneIds : []).map((id) => String(id).trim()).filter(Boolean));
  const date = now || new Date();

  list.forEach((line, idx) => {
    if (!isPrestationLine(line)) return;
    if (line.recetteValideeAt) return;
    if (!ids.has(String(line.id))) return;
    list[idx] = { ...line, recetteValideeAt: date };
  });

  return list;
}

function remainingDevLineIds(lignes) {
  return filterLinesByKind(lignes, 'dev')
    .filter((l) => lineRequiresRecette(l) && !l.recetteValideeAt)
    .map((l) => String(l.id));
}

module.exports = { applyRecetteLignes, remainingDevLineIds };
