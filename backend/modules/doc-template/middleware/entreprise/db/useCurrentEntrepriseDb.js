// middleware/entreprise/db/useCurrentEntrepriseDb.js
// Adapté pour GDRI : utilise req.user.entrepriseId au lieu de req.user.currentEntrepriseId

const database = require('../../../../../config/database');

/**
 * Middleware pour attacher automatiquement la DB de l'entreprise courante
 * Format multi-entreprises (doc-template) : utilise user.currentEntrepriseId
 */
const useCurrentEntrepriseDb = async (req, res, next) => {
  try {
    const user = req.user;
 
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentification requise' });
    }

    // ✅ Format multi-entreprises : utiliser currentEntrepriseId
    let entrepriseId = user.currentEntrepriseId || user.entrepriseId;
    
    // Si pas dans le JWT, récupérer depuis MongoDB
    if (!entrepriseId) {
      try {
        const db = await database.connect();
        const usersCollection = db.collection('users');
        const { ObjectId } = require('mongodb');
        const userDoc = await usersCollection.findOne({ _id: new ObjectId(user.user_id) });
        
        if (userDoc) {
          // Format multi-entreprises : currentEntrepriseId
          if (userDoc.currentEntrepriseId) {
            entrepriseId = userDoc.currentEntrepriseId.toString();
            console.log('📦 Format multi-entreprises (MongoDB) - currentEntrepriseId:', entrepriseId);
          }
          // Si pas de currentEntrepriseId mais des entreprises, prendre la première
          else if (userDoc.entreprises && Array.isArray(userDoc.entreprises) && userDoc.entreprises.length > 0) {
            entrepriseId = userDoc.entreprises[0].entrepriseId.toString();
            console.log('📦 Format multi-entreprises (MongoDB) - première entreprise:', entrepriseId);
          }
        }
      } catch (dbError) {
        console.error('❌ Erreur lors de la récupération de l\'utilisateur depuis MongoDB:', dbError);
      }
    }
   
    // Vérifier que l'utilisateur a une entreprise active
    if (!entrepriseId) {
      // Pour les superadmins, utiliser une entreprise système par défaut
      if (user.role === 'ADMIN_GDRI' || user.role === 'superadmin') {
        console.warn('⚠️  useCurrentEntrepriseDb - Superadmin sans entrepriseId, utilisation de l\'entreprise système par défaut');
        entrepriseId = 'SYSTEM';
        console.log('🏢 Utilisation de l\'entreprise système par défaut pour superadmin');
      } else {
        console.error('❌ useCurrentEntrepriseDb - Aucune entreprise active pour l\'utilisateur:', {
          userId: user.user_id,
          email: user.email,
          role: user.role,
          entrepriseId: user.entrepriseId,
          currentEntrepriseId: user.currentEntrepriseId
        });
        return res.status(400).json({ success: false, error: 'Aucune entreprise active. Veuillez sélectionner une entreprise.' });
      }
    }

    // Attacher la DB et l'entrepriseId
    try {
      req.entrepriseDb = await database.getEntrepriseDb(entrepriseId);
      if (!req.entrepriseDb) {
        console.error(`❌ Impossible de se connecter à la base d'entreprise: GDR-ENTREPRISE-${entrepriseId}`);
        return res.status(500).json({
          success: false,
          error: `Impossible de se connecter à la base de données de l'entreprise (ID: ${entrepriseId})`
        });
      }
    } catch (dbError) {
      console.error('❌ Erreur lors de la connexion à la base d\'entreprise:', dbError);
      return res.status(500).json({
        success: false,
        error: `Erreur lors de la connexion à la base de données de l'entreprise: ${dbError.message}`
      });
    }
    
    req.entrepriseId = entrepriseId;
    
    // ✅ ADAPTÉ POUR GDRI : role est directement dans req.user.role
    req.entrepriseRole = user.role;

    console.log(`🏢 DB Entreprise: GDR-ENTREPRISE-${entrepriseId} (Role: ${req.entrepriseRole})`);
    
    next();
  } catch (error) {
    console.error('❌ Erreur useCurrentEntrepriseDb:', error);
    console.error('❌ Stack trace:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'accès à la base de données de l\'entreprise: ' + error.message
    });
  }
};

module.exports = { useCurrentEntrepriseDb };
