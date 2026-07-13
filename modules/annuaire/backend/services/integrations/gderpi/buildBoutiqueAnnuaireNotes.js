/**
 * FICHIER : modules/annuaire/backend/services/integrations/gderpi/buildBoutiqueAnnuaireNotes.js
 * RÔLE : Construit les notes Annuaire pour une boutique GDERPI (adresse, slug).
 */

function buildBoutiqueAnnuaireNotes(boutique) {
  const b = boutique && typeof boutique === 'object' ? boutique : {};
  const parts = [];
  if (b.nom && b.raisonSociale && String(b.nom).trim() !== String(b.raisonSociale).trim()) {
    parts.push(`Nom commercial : ${String(b.nom).trim()}`);
  }
  if (b.slug) parts.push(`Slug : ${String(b.slug).trim()}`);
  const addr = [
    b.adresse,
    [b.codePostal, b.ville].filter(Boolean).join(' '),
    b.pays
  ].filter(Boolean).join(', ');
  if (addr) parts.push(`Adresse : ${addr}`);
  if (b.actif === false) parts.push('Statut : inactive');
  return parts.join('\n');
}

module.exports = buildBoutiqueAnnuaireNotes;
