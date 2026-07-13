/**
 * FICHIER : modules/gderpi/backend/services/devis/isDevisContentEmpty.js
 * RÔLE : Indique si un brouillon devis est vide (aucune donnée utile).
 *
 * ENTRÉES : devis normalisé ou API
 * SORTIES : boolean
 *
 * DÉPEND DE : —
 * NE PAS : persistance
 *
 * APPELÉ PAR : listDevis.js
 */

function isDevisContentEmpty(devis) {
  if (!devis || devis.statut !== 'brouillon') return false;
  const hasMeta = Boolean(
    devis.clientId ||
    String(devis.objet || '').trim() ||
    String(devis.notes || '').trim()
  );
  const lignes = Array.isArray(devis.lignes) ? devis.lignes : [];
  const hasLines = lignes.some((l) =>
    Boolean(
      String(l?.libelle || '').trim() ||
      String(l?.reference || '').trim() ||
      String(l?.description || '').trim()
    )
  );
  return !hasMeta && !hasLines;
}

module.exports = isDevisContentEmpty;
