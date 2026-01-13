// backend/modules/doc-template/controllers/templateImageController.js
const { ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

/**
 * 🔹 Upload une image pour un template
 * POST /api/doc-template/templates/:id/images
 */
const uploadTemplateImage = async (req, res) => {
  try {
    const { id: templateId } = req.params;
    const entrepriseId = req.user.currentEntrepriseId || req.user.entrepriseId;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'Aucun fichier fourni' 
      });
    }

    // Vérifier que le template existe
    const template = await req.entrepriseDb
      .collection('templates')
      .findOne({ _id: new ObjectId(templateId) });

    if (!template) {
      return res.status(404).json({ 
        success: false, 
        error: 'Template non trouvé' 
      });
    }

    // Créer le dossier pour les images du template
    const imagesDir = path.join(
      process.cwd(),
      'uploads',
      `entreprise_${entrepriseId}`,
      `template_${templateId}`,
      'images'
    );
    
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Générer un ID et un nom de fichier unique
    const fileExt = path.extname(req.file.originalname);
    const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const fileName = `${fileId}${fileExt}`;
    const filePath = path.join(imagesDir, fileName);

    // Déplacer le fichier depuis le dossier temporaire (multer l'a déjà sauvegardé)
    // Si multer utilise diskStorage, req.file.path contient le chemin temporaire
    if (req.file.path && req.file.path !== filePath) {
      // Vérifier que le fichier temporaire existe avant de le copier
      if (fs.existsSync(req.file.path)) {
        try {
          // Copier le fichier depuis le chemin temporaire vers le chemin final
          fs.copyFileSync(req.file.path, filePath);
          // Supprimer le fichier temporaire
          fs.unlinkSync(req.file.path);
        } catch (copyError) {
          console.error('❌ Erreur lors de la copie du fichier:', copyError);
          throw new Error(`Erreur lors de la copie du fichier: ${copyError.message}`);
        }
      } else {
        // Si le fichier temporaire n'existe pas, vérifier si multer a mis le buffer en mémoire
        if (req.file.buffer) {
          // Écrire le buffer directement dans le fichier final
          fs.writeFileSync(filePath, req.file.buffer);
        } else {
          throw new Error('Fichier temporaire non trouvé et pas de buffer disponible');
        }
      }
    } else if (req.file.buffer) {
      // Si le fichier est en mémoire (multer memoryStorage), écrire directement
      fs.writeFileSync(filePath, req.file.buffer);
    } else if (!req.file.path) {
      throw new Error('Aucun fichier ou buffer disponible');
    }

    // Créer l'objet image avec métadonnées
    // URL via l'API (au lieu d'une URL directe vers uploads pour éviter les problèmes de permissions)
    const imageData = {
      id: fileId,
      fileName: fileName,
      originalName: req.file.originalname,
      url: `/api/doc-template/templates/${templateId}/images/${fileId}`,
      path: filePath,
      mimeType: req.file.mimetype,
      size: req.file.size,
      width: null, // Sera rempli si on traite l'image
      height: null, // Sera rempli si on traite l'image
      createdAt: new Date()
    };

    // Ajouter l'image au template (dans template.images[])
    const images = template.images || [];
    images.push(imageData);

    await req.entrepriseDb
      .collection('templates')
      .updateOne(
        { _id: new ObjectId(templateId) },
        { $set: { images: images, updatedAt: new Date() } }
      );

    res.status(201).json({
      success: true,
      data: imageData
    });

  } catch (error) {
    console.error('❌ uploadTemplateImage error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * 🔹 Récupère une image de template
 * GET /api/doc-template/templates/:id/images/:imageId
 */
const getTemplateImage = async (req, res) => {
  try {
    const { id: templateId, imageId } = req.params;
    const entrepriseId = req.user.currentEntrepriseId || req.user.entrepriseId;

    const template = await req.entrepriseDb
      .collection('templates')
      .findOne({ _id: new ObjectId(templateId) });

    if (!template) {
      return res.status(404).json({ 
        success: false, 
        error: 'Template non trouvé' 
      });
    }

    const images = template.images || [];
    const image = images.find(img => img.id === imageId || img.fileName === imageId);

    if (!image) {
      return res.status(404).json({ 
        success: false, 
        error: 'Image non trouvée' 
      });
    }

    // Vérifier que le fichier existe
    const filePath = image.path || path.join(
      process.cwd(),
      'uploads',
      `entreprise_${entrepriseId}`,
      `template_${templateId}`,
      'images',
      image.fileName
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Fichier image non trouvé' 
      });
    }

    // Envoyer le fichier
    res.sendFile(path.resolve(filePath));

  } catch (error) {
    console.error('❌ getTemplateImage error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * 🔹 Supprime une image de template
 * DELETE /api/doc-template/templates/:id/images/:imageId
 */
const deleteTemplateImage = async (req, res) => {
  try {
    const { id: templateId, imageId } = req.params;
    const entrepriseId = req.user.currentEntrepriseId || req.user.entrepriseId;

    const template = await req.entrepriseDb
      .collection('templates')
      .findOne({ _id: new ObjectId(templateId) });

    if (!template) {
      return res.status(404).json({ 
        success: false, 
        error: 'Template non trouvé' 
      });
    }

    const images = template.images || [];
    const imageIndex = images.findIndex(img => img.id === imageId || img.fileName === imageId);

    if (imageIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Image non trouvée' 
      });
    }

    const image = images[imageIndex];

    // Supprimer le fichier
    const filePath = image.path || path.join(
      process.cwd(),
      'uploads',
      `entreprise_${entrepriseId}`,
      `template_${templateId}`,
      'images',
      image.fileName
    );

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Retirer l'image du tableau
    images.splice(imageIndex, 1);

    await req.entrepriseDb
      .collection('templates')
      .updateOne(
        { _id: new ObjectId(templateId) },
        { $set: { images: images, updatedAt: new Date() } }
      );

    res.json({
      success: true,
      message: 'Image supprimée'
    });

  } catch (error) {
    console.error('❌ deleteTemplateImage error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

module.exports = {
  uploadTemplateImage,
  getTemplateImage,
  deleteTemplateImage
};
