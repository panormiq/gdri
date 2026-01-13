const Entreprise = require('../models/entreprise_model');
const User = require('../models/user_model');
const fs = require('fs');
const path = require('path');
const db = require('../../../config/database');
const { ObjectId } = require('mongodb');

// ================================
// Helper: parse form fields imbriqués
// ================================
function nestBodyFields(body) {
  const result = {};
  for (const key in body) {
    const keys = key.split('.');
    keys.reduce((acc, k, i) => {
      if (i === keys.length - 1) acc[k] = body[key];
      else acc[k] = acc[k] || {};
      return acc[k];
    }, result);
  }
  return result;
}

// ================================
// Helper: supprimer un fichier si existant
// ================================
function removeFile(filePath) {
  if (filePath && fs.existsSync(path.join(__dirname, '..', filePath))) {
    fs.unlinkSync(path.join(__dirname, '..', filePath));
  }
}

// ================================
// CREATE
// ================================
exports.createEntreprise = async (req, res) => {
  try {
    let entrepriseData = req.body.data ? JSON.parse(req.body.data) : nestBodyFields(req.body);

    if (!entrepriseData.name) {
      return res.status(400).json({ success: false, error: 'Le nom est obligatoire' });
    }

    // Logo
    if (req.file) {
  entrepriseData.logo = '/uploads/' + req.file.filename;
}

    const entreprise = new Entreprise(entrepriseData);
    await entreprise.save();

    // ✅ Renvoi avec logo correctement
    res.status(201).json({ success: true, data: entreprise.toJSON(), message: 'Entreprise créée avec succès' });
  } catch (err) {
    console.error('❌ Erreur création:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ================================
// UPDATE
// ================================
exports.updateEntreprise = async (req, res) => {
  try {
    const entreprise = await Entreprise.findById(req.params.id);
    if (!entreprise) {
      return res.status(404).json({ success: false, error: 'Entreprise introuvable' });
    }
// ✅ Changer l’entreprise courante
exports.setCurrentEntreprise = async (req, res) => {
  try {
    const { entrepriseId } = req.body;
    const userCollection = await db.getUserCollection();

    if (!ObjectId.isValid(entrepriseId)) {
      return res.status(400).json({ success: false, data: {}, error: 'ID entreprise invalide' });
    }

    const user = req.user;
    const found = user.entreprises.find(e => e.entrepriseId.toString() === entrepriseId);
    if (!found) {
      return res.status(403).json({ success: false, data: {}, error: 'Vous n’avez pas accès à cette entreprise' });
    }

    // Mise à jour de l’entreprise courante
    await userCollection.updateOne(
      { _id: user._id },
      { $set: { currentEntrepriseId: new ObjectId(entrepriseId) } }
    );

    res.json({
      success: true,
      data: { currentEntrepriseId: entrepriseId, role: found.role },
      error: null
    });

  } catch (err) {
    console.error('❌ Erreur setCurrentEntreprise:', err.message);
    res.status(500).json({ success: false, data: {}, error: err.message });
  }
};
    /* =========================
       Champs texte (PATCH)
    ========================= */
    Object.entries(req.body).forEach(([key, value]) => {
      // champs imbriqués address.street
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        entreprise[parent] = entreprise[parent] || {};
        entreprise[parent][child] = value;
      } else {
        entreprise[key] = value;
      }
    });

    /* =========================
       Logo
    ========================= */

    // suppression demandée
    if (req.body.logo === '') {
      entreprise.logo = null;
    }

    // nouveau fichier
    if (req.file) {
      entreprise.logo = `/uploads/${req.file.filename}`;
    }

    await entreprise.save();

    res.json({
      success: true,
      data: entreprise.toJSON()
    });

  } catch (err) {
    console.error('❌ Update entreprise:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
// ================================
// GET ALL
// ================================
exports.getAllEntreprises = async (req, res) => {
  try {
    const user = req.user;

    if (!user || !Array.isArray(user.entreprises)) {
      return res.status(404).json({ success: false, data: [], error: 'Aucune entreprise trouvée' });
    }

    const entrepriseCollection = await db.getMainEntrepriseCollection();
    const entrepriseIds = user.entreprises.map(e => new ObjectId(e.entrepriseId));
    const entreprises = await entrepriseCollection.find({ _id: { $in: entrepriseIds } }).toArray();

    // Injecter le rôle pour chaque entreprise
    const data = entreprises.map(ent => {
      const ctx = user.entreprises.find(e => e.entrepriseId.toString() === ent._id.toString());
      return { ...ent, role: ctx?.role || 'user' };
    });

    res.json({ success: true, data, error: null });

  } catch (err) {
    console.error('❌ Erreur getAllEntreprises:', err.message);
    res.status(500).json({ success: false, data: [], error: err.message });
  }
};

// ================================
// GET ONE
// ================================
exports.getEntrepriseById = async (req, res) => {
  try {
    
    const entreprise = await Entreprise.findById(req.params.id);
    if (!entreprise) return res.status(404).json({ success: false, error: 'Entreprise non trouvée' });

    // ✅ toJSON pour inclure logo
    res.json({ success: true, data: entreprise.toJSON() });
  } catch (err) {
    console.error('❌ Erreur récupération:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
exports.getCurrentEntreprise = async (req, res) => {
  try {
    const entrepriseId = req.auth.currentEntreprise;

    if (!entrepriseId) {
      return res.status(404).json({ success: false, data: {}, error: 'Aucune entreprise courante définie' });
    }

    if (!ObjectId.isValid(entrepriseId)) {
      return res.status(400).json({ success: false, data: {}, error: 'Entreprise courante invalide' });
    }

    const entrepriseCollection = await db.getMainEntrepriseCollection();
    const entreprise = await entrepriseCollection.findOne({ _id: new ObjectId(entrepriseId) });

    if (!entreprise) {
      return res.status(404).json({ success: false, data: {}, error: 'Entreprise introuvable' });
    }

    res.json({
      success: true,
      data: { ...entreprise, role: req.auth.currentEntrepriseRole },
      error: null
    });

  } catch (err) {
    console.error('❌ Erreur getCurrentEntreprise:', err.message);
    res.status(500).json({ success: false, data: {}, error: err.message });
  }
};

// ================================
// DELETE
// ================================
exports.deleteEntreprise = async (req, res) => {
  try {
    const entreprise = await Entreprise.findById(req.params.id);
    if (!entreprise) return res.status(404).json({ success: false, error: 'Entreprise non trouvée' });

    removeFile(entreprise.logo);
    await entreprise.deleteOne();

    res.json({ success: true, message: 'Entreprise supprimée avec succès' });
  } catch (err) {
    console.error('❌ Erreur suppression:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
