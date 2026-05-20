/**
 * Routes d'authentification GDRI
 * Fichier : backend/routes/auth.js
 * 
 * Gestion de l'authentification via cookies HttpOnly
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../config/jwt');
const database = require('../config/database');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

router.post('/login-gdri', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
    }

    const db = await database.connect();
    const usersCollection = db.collection('users');
    const emailRegex = new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const user = await usersCollection.findOne({ email: emailRegex });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }
    const userStatus = String(user.status || '').toLowerCase();
    if (userStatus && userStatus !== 'active') {
      if (userStatus === 'pending') {
        return res.status(403).json({ success: false, message: 'Votre compte n\'est pas encore activé.' });
      }
      return res.status(403).json({ success: false, message: 'Votre compte est inactif.' });
    }

    const storedHash = String(user.password_hash || '');
    let ok = false;
    if (storedHash) {
      // Compatibilité hash bcrypt PHP legacy ($2y$) vers format reconnu côté Node.
      const hashForNode = storedHash.startsWith('$2y$')
        ? `$2b$${storedHash.slice(4)}`
        : storedHash;
      ok = await bcrypt.compare(password, hashForNode);
    }
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    let currentEntrepriseId = user.currentEntrepriseId ? String(user.currentEntrepriseId) : null;
    const entreprises = Array.isArray(user.entreprises) ? user.entreprises : [];

    if (!currentEntrepriseId && entreprises.length > 0 && entreprises[0]?.entrepriseId) {
      currentEntrepriseId = String(entreprises[0].entrepriseId);
      if (/^[a-f0-9]{24}$/i.test(currentEntrepriseId)) {
        await usersCollection.updateOne(
          { _id: new ObjectId(user._id) },
          { $set: { currentEntrepriseId: new ObjectId(currentEntrepriseId) } }
        );
      }
    }

    if (!currentEntrepriseId && user.entity_id) {
      const legacyEntityId = String(user.entity_id);
      if (/^[a-f0-9]{24}$/i.test(legacyEntityId)) {
        currentEntrepriseId = legacyEntityId;
        await usersCollection.updateOne(
          { _id: new ObjectId(user._id) },
          {
            $set: {
              currentEntrepriseId: new ObjectId(legacyEntityId),
              entreprises: [{
                entrepriseId: new ObjectId(legacyEntityId),
                role: user.role === 'ADMIN_ENTITY' ? 'admin' : 'user',
                joinedAt: new Date()
              }]
            }
          }
        );
      }
    }

    await usersCollection.updateOne(
      { _id: new ObjectId(user._id) },
      { $set: { last_login: new Date() } }
    );

    return res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user_id: String(user._id),
        email: user.email || '',
        role: user.role || 'USER_ENTITY',
        currentEntrepriseId: currentEntrepriseId || null
      }
    });
  } catch (error) {
    console.error('Erreur route POST /api/auth/login-gdri:', error);
    return res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

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
    // httpOnly: true = inaccessible en JavaScript (anti-XSS)
    // secure: true si HTTPS (production ou X-Forwarded-Proto)
    const isProduction = process.env.NODE_ENV === 'production';
    const isHttps = req.secure || (req.get('x-forwarded-proto') === 'https');
    const useSecureCookie = Boolean(isProduction || isHttps);

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: useSecureCookie,
      sameSite: 'Lax', // Lax pour autoriser les redirections OAuth (Facebook) depuis le même site
      maxAge: 24 * 60 * 60 * 1000, // 24 heures
      path: '/'
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
  const isProduction = process.env.NODE_ENV === 'production';
  const isHttps = req.secure || (req.get('x-forwarded-proto') === 'https');
  const useSecureCookie = Boolean(isProduction || isHttps);
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: useSecureCookie,
    sameSite: 'Lax',
    path: '/'
  });

  res.json({
    success: true,
    message: 'Cookie supprimé avec succès'
  });
});

module.exports = router;
