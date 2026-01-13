// backend/controllers/collectionImageController.js
const { ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const { processImage } = require('../middleware/entreprise/processImage');
const { deletePhotoFiles, ensureDirExists } = require('../utils/fileUtils');

/**
 * 🔹 Créer une image pour une entrée de collection
 */
const createCollectionImage = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { crop, rotation, fieldKey = 'photo' } = req.body;
    const filePath = req.file.path;
    const entrepriseId = req.user.currentEntrepriseId;
    const db = req.entrepriseDb;

    // Dossier previews (créé si nécessaire)
    const outputDir = `uploads/entreprise_${entrepriseId}/collection_${collectionId}/previews`;
    ensureDirExists(outputDir);

    // Traiter l'image (crop + rotation + préviews)
    const processed = await processImage(
      filePath,
      crop ? JSON.parse(crop) : null,
      rotation ? parseInt(rotation) : 0,
      outputDir
    );

    // Créer l'entrée dans collection_data_<collectionId>
    const entry = {
      collectionId,
      values: { [fieldKey]: processed },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db
      .collection(`collection_data_${collectionId}`)
      .insertOne(entry);

    res.status(201).json({
      success: true,
      data: { _id: result.insertedId, ...entry }
    });
  } catch (err) {
    console.error("❌ createCollectionImage error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * 🔹 Remplacer une image existante d'une entrée
 */
const replaceCollectionImage = async (req, res) => {
  try {
    const { collectionId, dataId } = req.params;
    const { crop, rotation, fieldKey = 'photo' } = req.body;
    const filePath = req.file.path;
    const entrepriseId = req.user.currentEntrepriseId;
    const db = req.entrepriseDb;

    // Récupérer l’entrée existante
    const entry = await db.collection(`collection_data_${collectionId}`)
      .findOne({ _id: new ObjectId(dataId) });

    if (!entry) return res.status(404).json({ success: false, error: 'Donnée non trouvée' });

    // Supprimer anciens fichiers si existants
    if (entry.values?.[fieldKey]) {
      deletePhotoFiles(entry.values[fieldKey]);
    }

    // Dossier previews
    const outputDir = `uploads/entreprise_${entrepriseId}/collection_${collectionId}/previews`;
    ensureDirExists(outputDir);

    // Traiter nouvelle image
    const processed = await processImage(
      filePath,
      crop ? JSON.parse(crop) : null,
      rotation ? parseInt(rotation) : 0,
      outputDir
    );

    // Mettre à jour le champ
    const updateObj = { [`values.${fieldKey}`]: processed, updatedAt: new Date() };
    const result = await db.collection(`collection_data_${collectionId}`)
      .findOneAndUpdate(
        { _id: new ObjectId(dataId) },
        { $set: updateObj },
        { returnDocument: 'after' }
      );

    res.json({ success: true, data: result.value });

  } catch (err) {
    console.error("❌ replaceCollectionImage error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * 🔹 Supprimer une entrée et ses images
 */
const deleteCollectionData = async (req, res) => {
  try {
    const { collectionId, dataId } = req.params;
    const db = req.entrepriseDb;

    const entry = await db.collection(`collection_data_${collectionId}`)
      .findOne({ _id: new ObjectId(dataId) });

    if (!entry) return res.status(404).json({ success: false, error: 'Donnée non trouvée' });

    // Supprimer les fichiers images si présents
    Object.values(entry.values || {}).forEach(field => {
      if (field) deletePhotoFiles(field);
    });

    await db.collection(`collection_data_${collectionId}`)
      .deleteOne({ _id: new ObjectId(dataId) });

    res.json({ success: true, message: 'Donnée et images supprimées' });
  } catch (err) {
    console.error("❌ deleteCollectionData error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * 🔹 Supprimer une collection entière et tous ses fichiers
 */
const deleteCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const entrepriseId = req.user.currentEntrepriseId;
    const db = req.entrepriseDb;

    const result = await db.collection('collections').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Collection non trouvée' });
    }

    // Supprimer tous les fichiers liés à cette collection
    const collectionPath = `uploads/entreprise_${entrepriseId}/collection_${id}`;
    if (fs.existsSync(collectionPath)) {
      fs.rmSync(collectionPath, { recursive: true, force: true });
    }

    res.json({ success: true, message: 'Collection et fichiers supprimés' });
  } catch (err) {
    console.error("❌ deleteCollection error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  createCollectionImage,
  replaceCollectionImage,
  deleteCollectionData,
  deleteCollection
};
