/**
 * FICHIER : modules/pm/backend/services/integrations/gderpi/listGderpiBoutiques.js
 * RÔLE : Liste les boutiques GDERPI pour les paramètres PM.
 */

const isGderpiAvailable = require('../isGderpiAvailable');

async function listGderpiBoutiques(db, entrepriseId) {
  if (!isGderpiAvailable()) return [];

  const listBoutiques = require('../../../../../gderpi/backend/services/boutiques/listBoutiques');
  const entries = await listBoutiques(db, entrepriseId, { actifOnly: true });
  return entries.map((b) => ({
    boutiqueId: b.boutiqueId || b.id,
    nom: b.nom || b.name || '',
    slug: b.slug || ''
  }));
}

module.exports = listGderpiBoutiques;
