/**
 * Configuration et utilitaires JWT
 * Fichier : backend/config/jwt.js
 */

const jwt = require('jsonwebtoken');

// Secret partagé (doit être identique en PHP et Node.js)
// En production, utiliser une variable d'environnement
const JWT_SECRET = process.env.JWT_SECRET || 'gdri-2024-secret-key-change-in-production';

/**
 * Vérifie et décode un token JWT
 * @param {string} token - Token JWT
 * @returns {Object|null} Données décodées ou null si invalide
 */
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware Express pour vérifier l'authentification JWT
 * @param {Request} req - Requête Express
 * @param {Response} res - Réponse Express
 * @param {Function} next - Middleware suivant
 */
function authenticateJWT(req, res, next) {
  console.log('🔐 authenticateJWT - Route:', req.path, req.method);
  
  // Récupérer le token depuis le header Authorization
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ authenticateJWT - Token manquant');
    return res.status(401).json({
      success: false,
      message: 'Token manquant ou invalide'
    });
  }

  const token = authHeader.substring(7); // Enlever "Bearer "
  const decoded = verifyToken(token);

  if (!decoded) {
    console.log('❌ authenticateJWT - Token invalide');
    return res.status(401).json({
      success: false,
      message: 'Token invalide ou expiré'
    });
  }
  
  console.log('✅ authenticateJWT - Token valide pour:', decoded.email);

  // Ajouter les infos utilisateur à la requête
  req.user = {
    user_id: decoded.user_id,
    entity_id: decoded.entity_id,
    role: decoded.role,
    email: decoded.email
  };

  next();
}

module.exports = {
  JWT_SECRET,
  verifyToken,
  authenticateJWT
};

