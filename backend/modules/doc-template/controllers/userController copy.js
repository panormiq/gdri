// backend/controllers/userController.js

const User = require('../models/user_model');

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({});
    
    return res.status(200).json({
      success: true,
      data: users.map(u => u.toSafeObject()), // ✅ Plus simple
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

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    // Convertir et enlever le mot de passe
    const userData = user.toJSON ? user.toJSON() : { ...user };
    delete userData.password_hash;
    delete userData.password;
    
    return res.status(200).json({
      success: true,
      data: userData
    });
    
  } catch (error) {
    console.error('❌ Erreur getUserById:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Trouver l'utilisateur
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    // Mettre à jour les champs (ne pas modifier password_hash directement)
    delete updates.password_hash;
    delete updates.password;
    delete updates._id;
    
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
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { ObjectId } = require('mongodb');
    
    const result = await User.deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Utilisateur supprimé avec succès',
      data: { id }
    });
    
  } catch (error) {
    console.error('❌ Erreur deleteUser:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

const getUserCollections = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    // Si vous avez un modèle Collection, récupérez les collections
    // Sinon, retournez les IDs
    return res.status(200).json({
      success: true,
      data: user.collections || []
    });
    
  } catch (error) {
    console.error('❌ Erreur getUserCollections:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

const getMyEntreprises = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    // ✅ Utiliser la structure de votre modèle
    return res.status(200).json({
      success: true,
      data: user.entreprises || [],
      currentEntrepriseId: user.currentEntrepriseId
    });
    
  } catch (error) {
    console.error('❌ Erreur getMyEntreprises:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

const switchEntreprise = async (req, res) => {
  try {
    const { entrepriseId } = req.body;
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        error: 'entrepriseId requis'
      });
    }
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    try {
      // ✅ Utiliser la méthode de votre classe
      user.switchEntreprise(entrepriseId);
      await user.save();
      
      const userData = user.toJSON ? user.toJSON() : { ...user };
      delete userData.password_hash;
      
      return res.status(200).json({
        success: true,
        data: userData,
        message: 'Entreprise changée avec succès'
      });
    } catch (switchError) {
      return res.status(403).json({
        success: false,
        error: switchError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur switchEntreprise:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

const assignEntreprise = async (req, res) => {
  try {
    const { id } = req.params;
    const { entrepriseId, role } = req.body;
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        error: 'entrepriseId requis'
      });
    }
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    // ✅ Utiliser la méthode de votre classe
    const added = user.addEntreprise(entrepriseId, role || 'user');
    
    if (!added) {
      return res.status(400).json({
        success: false,
        error: 'L\'utilisateur appartient déjà à cette entreprise'
      });
    }
    
    await user.save();
    
    const userData = user.toJSON ? user.toJSON() : { ...user };
    delete userData.password_hash;
    
    return res.status(200).json({
      success: true,
      data: userData,
      message: 'Entreprise assignée avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur assignEntreprise:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
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
  assignEntreprise
};