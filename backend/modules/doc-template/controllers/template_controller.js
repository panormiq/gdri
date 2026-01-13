// backend/controllers/template_controller.js
const { ObjectId } = require('mongodb');

/**
 * 🔹 Templates CRUD
 */

const getAllTemplates = async (req, res) => {
  try {
    const templates = await req.entrepriseDb
      .collection('templates')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // ✅ Toujours renvoyer un tableau même vide
    res.json({
      success: true,
      data: templates || [],
      error: null
    });
  } catch (error) {
    console.error('❌ Erreur getAllTemplates:', error);
    res.status(500).json({
      success: false,
      data: [],
      error: error.message
    });
  }
};

const getTemplateById = async (req, res) => {
  try {
    const template = await req.entrepriseDb
      .collection('templates')
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template non trouvé' });
    }

    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const createTemplate = async (req, res) => {
  try {
    const now = new Date();
    const { name, generalStyles, structure, content, defaultCollection, additionalCollections } = req.body;
    const entrepriseId = req.user.currentEntrepriseId;

    console.log("💡 createTemplate body :", req.body);

    // 🔒 Champs obligatoires
    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Le nom est obligatoire"
      });
    }

    // 🔹 Document final
    const templateDoc = {
      name,
      generalStyles: generalStyles || {},
      structure: structure || {},
      content: content || '',
      defaultCollection: defaultCollection || null,
      additionalCollections: additionalCollections || [],

      entrepriseId: new ObjectId(entrepriseId),

      createdAt: now,
      updatedAt: now
    };

    // 🔹 Insertion
    const result = await req.entrepriseDb
      .collection('templates')
      .insertOne(templateDoc);

    res.status(201).json({
      success: true,
      data: { _id: result.insertedId, ...templateDoc }
    });

  } catch (error) {
    console.error("❌ createTemplate:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const updateTemplate = async (req, res) => {
  try {
    // Exclure _id des données de mise à jour (champ immuable)
    const { _id, ...bodyWithoutId } = req.body;
   
    const updateData = {
      ...bodyWithoutId,
      updatedAt: new Date()
    };

    // 🔹 Mettre à jour le template
    const result = await req.entrepriseDb
      .collection('templates')
      .findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $set: updateData },
        { returnDocument: 'after' } // Retourne le document après mise à jour
      );
    
    const updatedDoc = result.value || result;
    if (!updatedDoc) {
      return res.status(404).json({ success: false, error: 'Template non trouvé' });
    }

    res.json({ success: true, data: updatedDoc });

  } catch (error) {
    console.error("❌ updateTemplate:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const result = await req.entrepriseDb
      .collection('templates')
      .deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Template non trouvé' });
    }

    res.json({ success: true, message: 'Template supprimé' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getAll: getAllTemplates,
  getById: getTemplateById,
  create: createTemplate,
  update: updateTemplate,
  delete: deleteTemplate
};
