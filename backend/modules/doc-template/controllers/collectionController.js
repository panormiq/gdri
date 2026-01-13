// backend/modules/doc-template/controllers/collectionController.js
// Adapté pour GDRI : imports et req.user.entrepriseId
const { ObjectId } = require('mongodb');
const fieldTypes = require('../../../config/json/types/fieldTypes.json');
const CollectionCore = require('../../../config/json/collection/collectionCore.json');
/**
 * 🔹 Collections CRUD
 */

const getFieldTypes = async (req, res) => {
  try {
    res.json({
      success: true,
      data:{version: fieldTypes.version,
      types: fieldTypes.types,
      baseTypes: fieldTypes.baseTypes,
     coreFields: fieldTypes.coreFields}
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
const getCollectionCore = async (req, res) => {
  try {
    res.json({
      success: true,
      data:{version: CollectionCore.version,
      core: CollectionCore.coreFields,
       }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
const getAllCollections = async (req, res) => {
  try {
    const collections = await req.entrepriseDb
      .collection('collections')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // ✅ Toujours renvoyer un tableau même vide
    res.json({
      success: true,
      data: collections || [],
      error: null
    });
  } catch (error) {
    console.error('❌ Erreur getAllCollections:', error);
    res.status(500).json({
      success: false,
      data: [],
      error: error.message
    });
  }
};

const getCollectionById = async (req, res) => {
  try {
    const collection = await req.entrepriseDb
      .collection('collections')
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection non trouvée' });
    }

    res.json({ success: true, data: collection });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};




const createCollection = async (req, res) => {
  try {
    const now = new Date();
    const { name, slug, description, fields, tags } = req.body;
    const entrepriseId = req.user.entrepriseId;

    console.log("💡 createCollection body :", req.body);

    // 🔒 Champs obligatoires collection
    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: "Le nom et le slug sont obligatoires"
      });
    }

    // 🔹 Validation des fields
    const validatedFields = [];

    if (Array.isArray(fields)) {
      for (const field of fields) {
        const {
          id,
          position,
          typeRef,
          type,
          label,
          name,

          required = false,
          defaultValue = null,
          validationOverrides = {},

          relation = null,
          ui = {}
        } = field;

        // ❌ Validation stricte
        if (
          !id ||
          !Number.isInteger(position) ||
          !typeRef ||
          !label
        ) {
          return res.status(400).json({
            success: false,
            message: "Field invalide : id, position, typeRef et label sont requis"
          });
        }

        // 🔗 Relation
        if (typeRef === 'Relation' && !relation?.collection) {
          return res.status(400).json({
            success: false,
            message: `Le champ "${label}" de type Relation doit définir une collection cible`
          });
        }

        validatedFields.push({
          id,
          position,
          typeRef,
          type,
          label,
          name,

          required,
          defaultValue,
          validationOverrides,

          relation,
          ui,

          createdAt: now,
          updatedAt: now
        });
      }
    }

    // 🔹 Normalisation des tags
    const validatedTags = Array.isArray(tags)
      ? tags
          .map(t => String(t).toLowerCase().trim())
          .filter(Boolean)
      : [];

    // 🔹 Document final
    const collectionDoc = {
      name,
      slug,
      description: description || '',
      fields: validatedFields,
      tags: validatedTags,

      entrepriseId: new ObjectId(entrepriseId),

      createdAt: now,
      updatedAt: now
    };

    // 🔹 Insertion
    const result = await req.entrepriseDb
      .collection('collections')
      .insertOne(collectionDoc);

    res.status(201).json({
      success: true,
      data: { _id: result.insertedId, ...collectionDoc }
    });

  } catch (error) {
    console.error("❌ createCollection:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};



const updateCollection = async (req, res) => {
  try {
    // Exclure _id des données de mise à jour (champ immuable)
    const { _id, ...bodyWithoutId } = req.body;
   
    const updateData = {
      ...bodyWithoutId,
      updatedAt: new Date()
    };
 
    // 🔹 Normaliser les tags si fournis
    if (updateData.tags) {
      updateData.tags = Array.isArray(updateData.tags)
        ? updateData.tags.map(t => t.toLowerCase().trim())
        : [];
    }

    // 🔹 Mettre à jour la collection
    const result = await req.entrepriseDb
      .collection('collections')
      .findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $set: updateData },
        { returnDocument: 'after' } // Retourne le document après mise à jour
      );
const updatedDoc = result.value || result;
    if (!updatedDoc) {
      return res.status(404).json({ success: false, error: 'Collection non trouvée' });
    }

    res.json({ success: true, data: result.value });

  } catch (error) {
    console.error("❌ updateCollection:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteCollection = async (req, res) => {
  try {
    const result = await req.entrepriseDb
      .collection('collections')
      .deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Collection non trouvée' });
    }

    res.json({ success: true, message: 'Collection supprimée' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🔹 Données des collections (entries)
 */

const getCollectionData = async (req, res) => {
  try {
    const collectionId = req.params.id;

    const collection = await req.entrepriseDb
      .collection('collections')
      .findOne({ _id: new ObjectId(collectionId) });

    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection non trouvée' });
    }

    const data = await req.entrepriseDb
      .collection(`collection_data_${collectionId}`)
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // S'assurer que les _id sont bien sérialisés en strings
    const serializedData = data.map(item => ({
      ...item,
      _id: item._id.toString()
    }));

    console.log(`📊 Collection ${collectionId} contient ${serializedData.length} éléments`);
    if (serializedData.length > 0) {
      console.log('📋 IDs des éléments:', serializedData.map(e => e._id));
    }

    res.json({ success: true, data: serializedData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const createCollectionData = async (req, res) => {
  try {
    const collectionId = req.params.id;
    const entrepriseId = req.user.entrepriseId;
    const now = new Date();

    // 🔹 Récupérer la collection pour connaître les champs
    const collection = await req.entrepriseDb
      .collection('collections')
      .findOne({ _id: new ObjectId(collectionId) });

    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection non trouvée' });
    }

    const entry = {
      ...req.body,
      createdAt: now,
      updatedAt: now
    };

    // 🔹 Traiter les champs de type "Fichier" qui peuvent être soit upload, soit document
    for (const field of collection.fields || []) {
      if (field.typeRef === 'Fichier' && entry[field.name]) {
        const fieldValue = entry[field.name];
        
        // Si c'est un objet avec type "document", valider que le document existe
        if (typeof fieldValue === 'object' && fieldValue.type === 'document') {
          if (fieldValue.documentId) {
            // Vérifier que le document existe
            const document = await req.entrepriseDb
              .collection('documents')
              .findOne({ _id: new ObjectId(fieldValue.documentId) });
            
            if (!document) {
              console.warn(`⚠️ Document ${fieldValue.documentId} non trouvé pour le champ ${field.name}`);
              // Ne pas bloquer, mais nettoyer la valeur
              entry[field.name] = null;
            } else {
              // S'assurer que l'URL est correcte
              entry[field.name] = {
                type: 'document',
                documentId: fieldValue.documentId,
                name: document.name,
                url: `/api/documents/${fieldValue.documentId}/pdf`,
                createdAt: document.createdAt
              };
            }
          }
        }
        // Si c'est un objet avec type "upload", garder tel quel (sera traité par la route d'upload)
        else if (typeof fieldValue === 'object' && fieldValue.type === 'upload') {
          // La valeur est déjà correcte, on la garde
          // L'upload du fichier sera fait via une route séparée si nécessaire
        }
      }
    }

    // 🔹 Insérer l'élément
    const result = await req.entrepriseDb
      .collection(`collection_data_${collectionId}`)
      .insertOne(entry);
    
    const insertedId = result.insertedId.toString();
    entry._id = insertedId;

    console.log('✅ Élément créé:', {
      collectionId,
      insertedId,
      insertedIdLength: insertedId.length,
      entry: entry
    });

    res.status(201).json({ 
      success: true, 
      data: entry
    });
  } catch (error) {
    console.error('❌ createCollectionData error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
const getElementFromCollection = async (req, res) => {
  const { collectionId, dataId } = req.params;

  try {
    // 🔹 Cherche dans la collection spécifique aux données
    const element = await req.entrepriseDb
      .collection(`collection_data_${collectionId}`)
      .findOne({ _id: new ObjectId(dataId) });

    if (!element) {
      return res.status(404).json({ success: false, error: 'Élément non trouvé' });
    }

    res.json({ success: true, data: element });
  } catch (err) {
    console.error('❌ getElementFromCollection:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

const updateCollectionData = async (req, res) => {
  try {
    const collectionId = req.params.id;
    const dataId = req.params.elementId;
    console.log("📝 Update request:", {
      collectionID: collectionId,
      dataId: dataId,
      body: req.body
    });
    
    // Vérifier que l'ID est valide
    if (!dataId || dataId.length !== 24) {
      return res.status(400).json({ 
        success: false, 
        error: `ID invalide: ${dataId}. Un ObjectId MongoDB doit faire 24 caractères.` 
      });
    }
    
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    const collectionName = `collection_data_${collectionId}`;
    console.log("🔍 Recherche dans la collection:", collectionName);
    
    // Vérifier d'abord si l'élément existe avant de le mettre à jour
    const existingElement = await req.entrepriseDb
      .collection(collectionName)
      .findOne({ _id: new ObjectId(dataId) });
    
    console.log("🔍 Vérification de l'élément existant:", {
      found: !!existingElement,
      elementId: existingElement?._id?.toString(),
      searchId: dataId,
      searchIdType: typeof dataId
    });
    
    if (!existingElement) {
      // Lister tous les IDs dans la collection pour debug
      const allElements = await req.entrepriseDb
        .collection(collectionName)
        .find({})
        .toArray();
      
      const allIds = allElements.map(e => e._id.toString());
      
      console.log(`⚠️ Élément non trouvé AVANT mise à jour. Collection contient ${allElements.length} éléments.`);
      console.log('📋 IDs disponibles:', allIds);
      console.log('🔍 ID recherché:', dataId);
      
      // Vérifier si la collection existe
      const collectionExists = await req.entrepriseDb
        .collection('collections')
        .findOne({ _id: new ObjectId(collectionId) });
      
      if (!collectionExists) {
        return res.status(404).json({ 
          success: false, 
          error: `Collection non trouvée: ${collectionId}` 
        });
      }
      
      return res.status(404).json({ 
        success: false, 
        error: `Donnée non trouvée avec l'ID: ${dataId}` 
      });
    }
    
    // Mettre à jour l'élément maintenant qu'on sait qu'il existe
    const result = await req.entrepriseDb
      .collection(collectionName)
      .findOneAndUpdate(
        { _id: new ObjectId(dataId) },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    
    console.log("📊 Résultat de la mise à jour:", {
      found: !!result.value,
      hasResult: !!result,
      resultKeys: result ? Object.keys(result) : []
    });
    
    // Récupérer l'élément mis à jour (result.value peut être null dans certaines versions)
    let updatedElement = result.value;
    
    if (!updatedElement) {
      // Si result.value est null, récupérer l'élément mis à jour séparément
      console.log("⚠️ result.value est null, récupération de l'élément mis à jour...");
      updatedElement = await req.entrepriseDb
        .collection(collectionName)
        .findOne({ _id: new ObjectId(dataId) });
      
      if (!updatedElement) {
        console.error('❌ Erreur inattendue: élément non trouvé après mise à jour');
        return res.status(500).json({ 
          success: false, 
          error: 'Erreur lors de la mise à jour' 
        });
      }
    }

    // S'assurer que l'ID est une string dans la réponse
    const serializedElement = {
      ...updatedElement,
      _id: updatedElement._id.toString()
    };

    console.log("✅ Élément mis à jour avec succès:", {
      id: serializedElement._id,
      updatedAt: serializedElement.updatedAt
    });

    res.json({ success: true, data: serializedElement });
  } catch (error) {
    console.error("❌ Erreur updateCollectionData:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erreur serveur lors de la mise à jour' 
    });
  }
};

const deleteCollectionData = async (req, res) => {
  try {
    const collectionId = req.params.id;
    const dataId = req.params.elementId;

    const result = await req.entrepriseDb
      .collection(`collection_data_${collectionId}`)
      .deleteOne({ _id: new ObjectId(dataId) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Donnée non trouvée' });
    }

    res.json({ success: true, message: 'Donnée supprimée' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ ADAPTÉ POUR GDRI : Exports avec alias pour correspondre à routes.js
module.exports = {
  // Collections CRUD
  getAll: getAllCollections,
  getById: getCollectionById,
  create: createCollection,
  update: updateCollection,
  delete: deleteCollection,
  
  // Éléments (elements)
  getElements: getCollectionData,
  addElement: createCollectionData,
  updateElement: updateCollectionData,
  deleteElement: deleteCollectionData,
  
  // Images (à implémenter - pour l'instant placeholder)
  uploadImage: async (req, res) => {
    res.status(501).json({ success: false, error: 'Upload image not yet implemented' });
  },
  getImage: async (req, res) => {
    res.status(501).json({ success: false, error: 'Get image not yet implemented' });
  },
  
  // Anciennes fonctions (gardées pour compatibilité)
  getAllCollections,
  getCollectionById,
  getCollectionData,
  createCollectionData,
  updateCollectionData,
  deleteCollectionData,
  getFieldTypes,
  getCollectionCore,
  getElementFromCollection
};
