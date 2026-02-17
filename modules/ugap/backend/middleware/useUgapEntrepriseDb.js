/**
 * Middleware pour attacher la DB de l'entreprise courante (UGAP)
 * Fichier : modules/ugap/backend/middleware/useUgapEntrepriseDb.js
 * 
 * Note: database est géré par GDRI, on l'importe directement depuis la config
 */

const path = require('path');
const database = require(path.join(__dirname, '../../../../backend/config/database'));
const { ObjectId } = require('mongodb');

const useUgapEntrepriseDb = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    let entrepriseId = user.currentEntrepriseId || user.entrepriseId;

    if (!entrepriseId) {
      try {
        const db = await database.connect();
        const usersCollection = db.collection('users');
        const userDoc = await usersCollection.findOne({ _id: new ObjectId(user.user_id) });
        if (userDoc?.currentEntrepriseId) {
          entrepriseId = userDoc.currentEntrepriseId.toString();
        } else if (Array.isArray(userDoc?.entreprises) && userDoc.entreprises.length > 0) {
          entrepriseId = userDoc.entreprises[0].entrepriseId.toString();
        }
      } catch (dbError) {
        console.error('❌ UGAP: erreur chargement entrepriseId:', dbError);
      }
    }

    if (!entrepriseId) {
      if (user.role === 'ADMIN_GDRI' || user.role === 'superadmin') {
        entrepriseId = 'SYSTEM';
      } else {
        return res.status(400).json({
          success: false,
          message: 'Aucune entreprise active. Veuillez sélectionner une entreprise.'
        });
      }
    }

    req.entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    if (!req.entrepriseDb) {
      return res.status(500).json({
        success: false,
        message: `Impossible de se connecter à la base de données de l'entreprise (ID: ${entrepriseId})`
      });
    }

    req.entrepriseId = entrepriseId;
    req.entrepriseRole = user.role;

    next();
  } catch (error) {
    console.error('❌ UGAP: erreur useUgapEntrepriseDb:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'accès à la base de données de l\'entreprise: ' + error.message
    });
  }
};

module.exports = { useUgapEntrepriseDb };
