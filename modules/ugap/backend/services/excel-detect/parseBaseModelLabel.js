/**
 * FICHIER : modules/ugap/backend/services/excel-detect/parseBaseModelLabel.js
 * RÔLE : Parse le libellé de la ligne récap modèle (nom, motorisation, poste, livraison).
 * ENTRÉES : label string (ligne première croix).
 * SORTIES : { modelName, motorizationBase, posteNumber, deliveryMode }.
 * DÉPEND DE : —
 * NE PAS : lire prix ni colonnes Excel.
 * APPELÉ PAR : extractModelRecapRow, buildExcelDetectionReport.
 */

function parseBaseModelLabel(label) {
  const raw = String(label || '').replace(/\s+/g, ' ').trim();
  if (!raw) {
    return { modelName: '', motorizationBase: '', posteNumber: null, deliveryMode: '' };
  }

  const posteMatch = raw.match(/\bposte\s*(\d+)\b/i);
  const posteNumber = posteMatch ? parseInt(posteMatch[1], 10) : null;

  const beforePoste = (posteMatch && posteMatch.index >= 0)
    ? raw.slice(0, posteMatch.index).trim().replace(/[-–—]\s*$/, '').trim()
    : raw;

  let modelName = beforePoste;
  let motorizationBase = '';

  const firstDashIndex = beforePoste.indexOf(' - ');
  if (firstDashIndex > -1) {
    modelName = beforePoste.slice(0, firstDashIndex).trim();
    motorizationBase = beforePoste.slice(firstDashIndex + 3).trim();
  } else {
    const motorizationMarker = beforePoste.match(/\b(suzuki|mercury|yamaha|honda|evinrude|double)\b/i);
    if (motorizationMarker && motorizationMarker.index > 0) {
      modelName = beforePoste.slice(0, motorizationMarker.index).trim().replace(/[-–—]\s*$/, '').trim();
      motorizationBase = beforePoste.slice(motorizationMarker.index).trim();
    }
  }

  const deliveryMode = /\bd[ée]part\s+usine\b/i.test(raw) ? 'Départ usine' : '';

  return {
    modelName,
    motorizationBase,
    posteNumber: Number.isFinite(posteNumber) ? posteNumber : null,
    deliveryMode
  };
}

module.exports = parseBaseModelLabel;
