/**
 * Routes d'authentification GDRI
 * Fichier : backend/routes/auth.js
 * 
 * Gestion de l'authentification via cookies HttpOnly
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../config/jwt');

/**
 * POST /api/auth/set-cookie-from-gdr
 * Définit le cookie HttpOnly authToken depuis un token JWT fourni
 * Utilisé pour l'intégration avec le frontend PHP GDRI
 */
router.post('/set-cookie-from-gdr', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token JWT manquant'
      });
    }

    // Vérifier que le token est valide
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token JWT invalide ou expiré'
      });
    }

    // Définir le cookie HttpOnly avec le token
    // HttpOnly = true : le JavaScript ne peut pas y accéder (sécurité XSS)
    // Secure = false en dev, true en production avec HTTPS
    // SameSite = 'Strict' : protection CSRF
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.cookie('authToken', token, {
      httpOnly: true, // Le JavaScript ne peut pas y accéder
      secure: isProduction, // HTTPS uniquement en production
      sameSite: 'Strict', // Protection CSRF
      maxAge: 24 * 60 * 60 * 1000, // 24 heures (identique au JWT)
      path: '/' // Disponible sur tout le site
    });

    console.log('✅ Cookie authToken défini pour:', decoded.email);

    res.json({
      success: true,
      message: 'Cookie défini avec succès',
      user: {
        email: decoded.email,
        user_id: decoded.user_id,
        entrepriseId: decoded.entrepriseId,
        role: decoded.role
      }
    });
  } catch (error) {
    console.error('❌ Erreur lors de la définition du cookie:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la définition du cookie'
    });
  }
});

/**
 * POST /api/auth/clear-cookie
 * Supprime le cookie authToken (déconnexion)
 */
router.post('/clear-cookie', (req, res) => {
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/'
  });

  res.json({
    success: true,
    message: 'Cookie supprimé avec succès'
  });
});

module.exports = router;
