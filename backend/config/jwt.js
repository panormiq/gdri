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
  
  // Récupérer le token depuis le cookie HttpOnly ou le header Authorization
  let token = null;
  
  // 1. Vérifier le cookie HttpOnly (priorité pour sécurité)
  if (req.cookies && req.cookies.authToken) {
    token = req.cookies.authToken;
    console.log('🔐 authenticateJWT - Token trouvé dans cookie HttpOnly');
  }
  
  // 2. Sinon, vérifier le header Authorization (fallback)
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Enlever "Bearer "
      console.log('🔐 authenticateJWT - Token trouvé dans header Authorization');
    }
  }
  
  if (!token) {
    console.log('❌ authenticateJWT - Token manquant');
    return res.status(401).json({
      success: false,
      message: 'Token manquant ou invalide'
    });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    console.log('❌ authenticateJWT - Token invalide');
    return res.status(401).json({
      success: false,
      message: 'Token invalide ou expiré'
    });
  }
  
  console.log('✅ authenticateJWT - Token valide pour:', decoded.email);
  console.log('🔍 authenticateJWT - Données décodées:', {
    user_id: decoded.user_id,
    currentEntrepriseId: decoded.currentEntrepriseId,
    entrepriseId: decoded.entrepriseId,
    role: decoded.role,
    email: decoded.email
  });

  // ✅ Format multi-entreprises : utiliser currentEntrepriseId
  const currentEntrepriseId = decoded.currentEntrepriseId || decoded.entrepriseId;

  // Ajouter les infos utilisateur à la requête
  req.user = {
    user_id: decoded.user_id,
    currentEntrepriseId: currentEntrepriseId, // Format doc-template
    entrepriseId: currentEntrepriseId, // Gardé pour compatibilité
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

