/**
 * FICHIER : modules/annuaire/backend/middleware/useAnnuaireEntrepriseDb.js
 */

const path = require('path');
const database = require(path.join(__dirname, '../../../../backend/config/database'));
const { ObjectId } = require('mongodb');

async function useAnnuaireEntrepriseDb(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    let entrepriseId = user.currentEntrepriseId || user.entrepriseId;
    if (!entrepriseId) {
      try {
        const db = await database.connect();
        const userDoc = await db.collection('users').findOne({ _id: new ObjectId(user.user_id) });
        if (userDoc?.currentEntrepriseId) {
          entrepriseId = userDoc.currentEntrepriseId.toString();
        } else if (Array.isArray(userDoc?.entreprises) && userDoc.entreprises.length > 0) {
          entrepriseId = userDoc.entreprises[0].entrepriseId.toString();
        }
      } catch (dbError) {
        console.error('❌ Annuaire: erreur entrepriseId:', dbError);
      }
    }

    if (!entrepriseId) {
      if (user.role === 'ADMIN_GDRI' || user.role === 'superadmin') {
        entrepriseId = 'SYSTEM';
      } else {
        return res.status(400).json({
          success: false,
          message: 'Aucune entreprise active.'
        });
      }
    }

    req.entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    if (!req.entrepriseDb) {
      return res.status(500).json({
        success: false,
        message: 'Impossible de se connecter à la base entreprise.'
      });
    }

    req.entrepriseId = String(entrepriseId);
    req.entrepriseRole = user.role;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { useAnnuaireEntrepriseDb };
