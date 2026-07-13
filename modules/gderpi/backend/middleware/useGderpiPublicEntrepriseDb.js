/**
 * FICHIER : modules/gderpi/backend/middleware/useGderpiPublicEntrepriseDb.js
 * RÔLE : DB entreprise pour routes publiques GDERPI (CGV).
 */

const path = require('path');
const database = require(path.join(__dirname, '../../../../backend/config/database'));

async function useGderpiPublicEntrepriseDb(req, res, next) {
  try {
    const entrepriseId = String(req.params.entrepriseId || '').trim();
    if (!entrepriseId) {
      return res.status(400).json({ success: false, message: 'Entreprise requise' });
    }

    req.entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    if (!req.entrepriseDb) {
      return res.status(404).json({ success: false, message: 'Entreprise introuvable' });
    }

    req.entrepriseId = entrepriseId;
    next();
  } catch (error) {
    console.error('GDERPI public DB:', error);
    return res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

module.exports = { useGderpiPublicEntrepriseDb };
