/**
 * FICHIER : modules/annuaire/backend/services/organisations/hasGderpiBoutiques.js
 * RÔLE : Indique si l'entreprise a des boutiques GDERPI (source ou annuaire).
 */

const ORG_COL = 'annuaire_organisations';

async function hasGderpiBoutiques(db, entrepriseId) {
  const eid = String(entrepriseId);
  const gderpiCount = await db.collection('gderpi_boutiques').countDocuments({ entrepriseId: eid });
  if (gderpiCount > 0) return true;
  const annuaireCount = await db.collection(ORG_COL).countDocuments({
    entrepriseId: eid,
    gderpiBoutiqueId: { $ne: null }
  });
  return annuaireCount > 0;
}

module.exports = hasGderpiBoutiques;
