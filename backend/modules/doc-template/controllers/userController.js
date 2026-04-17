// backend/controllers/userController.js

const User = require('../models/user_model');
const fs = require('fs');
const path = require('path');
const { sendMail } = require('../../../../modules/mail/backend/mailService');
const crypto = require('crypto');
const bcrypt = require('bcrypt');


// ================================
// Helper: supprimer un fichier si existant
// ================================
function removeFile(filePath) {
  if (filePath && fs.existsSync(path.join(__dirname, '..', filePath))) {
    fs.unlinkSync(path.join(__dirname, '..', filePath));
  }
}

// ================================
// GET ALL USERS
// ================================
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({});
    
    return res.status(200).json({
      success: true,
      data: users.map(u => u.toSafeObject()),
      count: users.length
    });
    
  } catch (error) {
    console.error('❌ Erreur getAllUsers:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ================================
// GET USER BY ID
// ================================
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });

    const userData = user.toJSON();
    delete userData.password_hash;

    return res.status(200).json({ success: true, data: userData });
    
  } catch (error) {
    console.error('❌ Erreur getUserById:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================
// UPDATE USER
// ================================
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
     let avatar = null;
    if (req.file) avatar = req.file.path;
    const updates = req.body;

    // Récupérer l'utilisateur
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    // Champs par défaut de ton modèle
    const defaultFields = {
      email: '',
      username: '',
      firstName: '',
      lastName: '',
      entreprises: [],
      currentEntrepriseId: null,
      role: 'users',
      isActive: true
    };

    // Pré-remplir les champs manquants pour les anciens utilisateurs
    Object.keys(defaultFields).forEach(key => {
      if (user[key] === undefined) {
        user[key] = defaultFields[key];
      }
    });

    // Supprimer les champs qu'on ne veut pas mettre à jour
    delete updates.password_hash;
    delete updates.password;
    delete updates._id;

    // Patch intelligent : ne mettre à jour que les champs envoyés
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        user[key] = updates[key];
      }
    });

    // Sauvegarder
    await user.save();

    // Retourner sans le mot de passe
    const userData = user.toJSON ? user.toJSON() : { ...user };
    delete userData.password_hash;
    delete userData.password;

    return res.status(200).json({
      success: true,
      data: userData,
      message: 'Utilisateur modifié avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur updateUser:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};


// ================================
// DELETE USER
// ================================
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });

    // Supprimer l’avatar si existant
    removeFile(user.avatar);

    await User.deleteOne({ _id: user._id });

    return res.status(200).json({ success: true, message: 'Utilisateur supprimé avec succès', data: { id } });
    
  } catch (error) {
    console.error('❌ Erreur deleteUser:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================
// GET USER COLLECTIONS
// ================================
const getUserCollections = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });

    return res.status(200).json({ success: true, data: user.collections || [] });
    
  } catch (error) {
    console.error('❌ Erreur getUserCollections:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================
// GET MY ENTREPRISES
// ================================
const getMyEntreprises = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });

    return res.status(200).json({ 
      success: true, 
      data: user.entreprises || [], 
      currentEntrepriseId: user.currentEntrepriseId 
    });
    
  } catch (error) {
    console.error('❌ Erreur getMyEntreprises:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================
// SWITCH ENTREPRISE
// ================================
const switchEntreprise = async (req, res) => {
  try {
    const { entrepriseId } = req.body;
    if (!entrepriseId) return res.status(400).json({ success: false, error: 'entrepriseId requis' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });

    try {
      user.switchEntreprise(entrepriseId);
      await user.save();
      const userData = user.toJSON();
      delete userData.password_hash;

      return res.status(200).json({ success: true, data: userData, message: 'Entreprise changée avec succès' });
    } catch (switchError) {
      return res.status(403).json({ success: false, error: switchError.message });
    }
    
  } catch (error) {
    console.error('❌ Erreur switchEntreprise:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================
// ASSIGN ENTREPRISE
// ================================
const assignEntreprise = async (req, res) => {
  try {
    const { id } = req.params;
    const { entrepriseId, role } = req.body;
    if (!entrepriseId) return res.status(400).json({ success: false, error: 'entrepriseId requis' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });

    const added = await user.addEntreprise(entrepriseId, role || 'user');
    if (!added) return res.status(400).json({ success: false, error: 'L\'utilisateur appartient déjà à cette entreprise' });

    await user.save(); // persiste les changements

    const userData = user.toJSON();
    delete userData.password_hash;

    return res.status(200).json({ success: true, data: userData, message: 'Entreprise assignée avec succès' });
    
  } catch (error) {
    console.error('❌ Erreur assignEntreprise:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
async function sendPasswordReset(user, resetToken) {
  const resetLink = `${process.env.FRONT_URL}/reset-password/${resetToken}`;
  
  await sendMail({
    to: user.email,
    subject: 'Réinitialisation de votre mot de passe',
    template: 'reset-password',
    context: { resetLink, username: user.username }
  });
}
// controllers/userController.js
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id); // ID du token
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });

    const userData = user.toJSON();
    delete userData.password_hash;

    return res.status(200).json({ success: true, data: userData });
  } catch (err) {
    console.error('❌ Erreur getCurrentUser:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};


const createUser = async (req, res) => {
  try {
     // Récupérer l'avatar si un fichier a été envoyé
    let avatar = null;
    if (req.file) avatar = req.file.path;
    const { email, username, firstName, lastName, role, entrepriseId } = req.body;

    if (!email || !username) {
      return res.status(400).json({ success: false, error: 'Email et username requis' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email déjà utilisé' });
    }

    // Générer un mot de passe temporaire aléatoire
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Créer l'utilisateur
    const user = new User({
      email,
      username,
      firstName,
      lastName,
      password_hash: hashedPassword,
      role: role || 'user',
      entreprises: entrepriseId ? [{ entrepriseId, role: 'user', joinedAt: new Date() }] : []
    });

    // Token d'activation
    const token = crypto.randomBytes(32).toString('hex');
    user.activationToken = token;
    user.activationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24h

    await user.save();

    // Envoyer le mail
    const activationUrl = `${process.env.FRONT_URL}/activate-account?token=${token}&email=${encodeURIComponent(email)}`;
    const templatePath = path.join(__dirname, '../../../../modules/mail/backend/templates/activateUser.html');
    await sendMail({
      to: email,
      subject: 'Activation de votre compte',
      template: 'activateUser',
      variables: {
        firstName: firstName || username,
        activationUrl,
        tempPassword
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Utilisateur créé et mail envoyé',
      data: user.toSafeObject()
    });

  } catch (err) {
    console.error('❌ Erreur createUser:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};


module.exports = { 
  getAllUsers, 
  getUserById, 
  updateUser, 
  deleteUser,
  getUserCollections,
  getMyEntreprises,
  switchEntreprise, 
  assignEntreprise,
  sendPasswordReset,
  createUser,
  getCurrentUser
};
