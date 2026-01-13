// backend/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/user_model');
const crypto = require('crypto');


const register = async (req, res) => {
  try {
    const { email, password, username, firstName, lastName, entrepriseId } = req.body;
    
    console.log('📝 Tentative d\'enregistrement:', { email, firstName, lastName, entrepriseId });
    
    // Validation basique
    if (!email || !password || !username ){
      return res.status(400).json({ 
        success: false, 
        error: 'Tous les champs sont requis' 
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email déjà utilisé' 
      });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer l'utilisateur
    const user = new User({
      email,
      password_hash: hashedPassword,
      firstName,
      lastName,
      username,
      entrepriseId
    });

    await user.save();
    console.log('✅ Utilisateur créé:', user._id);

    // Générer le token
    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        entrepriseId: user.entrepriseId,
        role: user.role
      }
    });
  } catch (error) {
    console.error('❌ Erreur register:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erreur lors de l\'enregistrement'
    });
  }
};

const login = async (req, res) => {
  try {
   
    const { email, password } = req.body;
    
    console.log('🔐 Tentative de login pour:', email);

    // Validation
    if (!email || !password) {
      console.log('⚠️ Champs manquants');
      return res.status(400).json({ 
        success: false, 
        error: 'Email et mot de passe requis' 
      });
    }

    // Chercher l'utilisateur
    const user = await User.findOne({ email });
    console.log('👤 Utilisateur trouvé:', user ? 'Oui' : 'Non');
    console.log('👤 password ddb:', user?.password_hash);
    
    if (!user) {
      console.log('⚠️ Utilisateur non trouvé');
      return res.status(400).json({ 
        success: false, 
        error: 'Email ou mot de passe incorrect' 
      });
    }

    // Vérifier le mot de passe
    const isMatch = await user.comparePassword(password);
    console.log('🔑 Mot de passe valide:', isMatch ? 'Oui' : 'Non');
    
    if (!isMatch) {
      console.log('⚠️ Mot de passe invalide');
      return res.status(400).json({ 
        success: false, 
        error: 'Email ou mot de passe incorrect' 
      });
    }

    // Vérifier si le compte est actif
    if (!user.isActive) {
      console.log('⚠️ Compte désactivé');
      return res.status(403).json({ 
        success: false, 
        error: 'Compte désactivé' 
      });
    }

    // Générer le token
    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Login réussi pour:', email);
    
    // Configure le cookie httpOnly contenant le token
    // Avec proxy reverse, on est sur le même domaine, donc secure: true si HTTPS
    const isSecure = req.protocol === 'https' || req.get('X-Forwarded-Proto') === 'https';
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: isSecure,    // true si HTTPS (via proxy)
      sameSite: isSecure ? "lax" : "lax",  // "lax" fonctionne bien avec proxy
      maxAge: 24 * 60 * 60 * 1000
    });

    // Renvoie l'utilisateur, sans token
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        entrepriseId: user.entrepriseId,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Erreur login:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erreur lors de la connexion'
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'Utilisateur non trouvé' 
      });
    }

    res.json({
      success: true,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('❌ Erreur getCurrentUser:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erreur lors de la récupération de l\'utilisateur'
    });
  }
};

const logout = (req, res) => {
  // Efface le cookie
  res.clearCookie("authToken");
  res.json({ 
    success: true, 
    message: 'Déconnexion réussie' 
  });
};

const me = async (req, res) => {
  try {
    console.log('📍 Route /me appelée');
    console.log('👤 req.user:', req.user);
    
    // req.user est déjà rempli par le middleware auth
    // Pas besoin de requête DB supplémentaire
    if (!req.user) {
      console.log('⚠️ req.user non défini');
      return res.status(401).json({ success: false });
    }

    console.log('✅ Utilisateur retourné:', req.user.email);
    
    res.json({
      success: true,
      user: {
        id: req.user._id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        username: req.user.username,
        entrepriseId: req.user.entrepriseId,
        role: req.user.role
      }
    });

  } catch (error) {
    console.error("❌ /me error:", error);
    res.status(500).json({ success: false });
  }
};
const changeRole = async (req, res) => {
  try {

    const { role } = req.body;
    console.log('req.user =', req.user);
console.log('req.headers.authorization =', req.headers.authorization);
    const userId = req.user._id; // juste _id

    console.log('🔄 Changement de rôle demandé:', { userId, newRole: role });

    // Validation du rôle
    const validRoles = ['user', 'admin', 'superadmin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Rôle invalide'
      });
    }

    // Mettre à jour le rôle dans la base de données
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    user.role = role;
    await user.save();

    console.log('✅ Rôle changé:', { userId, newRole: role });

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        entreprises: user.entreprises,

       
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Erreur changeRole:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors du changement de rôle'
    });
  }
};
// ===================================================
// 🔐 FORGOT PASSWORD
// ===================================================
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email requis'
      });
    }

    const user = await User.findOne({ email });

    // 🔒 Ne jamais révéler si l'email existe
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'Si cet email existe, un lien a été envoyé'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');

    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 1000 * 60 * 60; // 1h

    await user.save();

    const resetLink = `${process.env.FRONT_URL}/reset-password/${token}`;

    // 🧪 TEMP : affiché en console
    console.log('📧 Reset password link:', resetLink);

    return res.status(200).json({
      success: true,
      message: 'Email de réinitialisation envoyé'
    });

  } catch (error) {
    console.error('❌ forgotPassword:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

// ===================================================
// 🔐 RESET PASSWORD
// ===================================================
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Mot de passe requis'
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Token invalide ou expiré'
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(password, salt);

    // 🔥 Nettoyage token
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès'
    });

  } catch (error) {
    console.error('❌ resetPassword:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

// ⚠️ CORRECTION PRINCIPALE : Ajouter 'me' dans les exports
module.exports = { register, login, getCurrentUser, logout, me, changeRole, forgotPassword, resetPassword };