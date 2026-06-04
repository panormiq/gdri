/**
 * Middleware DB entreprise — Doc-Hub
 * Fichier : modules/doc-hub/backend/middleware/useDocHubEntrepriseDb.js
 */

const path = require('path');
const database = require(path.join(__dirname, '../../../../backend/config/database'));
const { ObjectId } = require('mongodb');
const { prepareEntrepriseDb } = require('../dbSetup');

const useDocHubEntrepriseDb = async (req, res, next) => {
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
      } catch (err) {
        console.error('❌ Doc-Hub: erreur chargement entrepriseId:', err);
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
        message: `Impossible de se connecter à la base entreprise (ID: ${entrepriseId})`
      });
    }

    req.entrepriseId = entrepriseId;
    req.userId = user.user_id;

    try {
      await prepareEntrepriseDb(req.entrepriseDb);
    } catch (prepError) {
      // E11000 : course entre requêtes parallèles sur les slots par défaut — ignorable si déjà présents
      if (prepError.code !== 11000 && prepError.code !== '11000') {
        throw prepError;
      }
    }

    next();
  } catch (error) {
    console.error('❌ Doc-Hub useDocHubEntrepriseDb:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur accès base entreprise: ' + error.message
    });
  }
};

module.exports = { useDocHubEntrepriseDb };
