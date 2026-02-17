/**
 * Service de gestion des données UGAP (MongoDB)
 * Fichier : modules/ugap/backend/services/UgapDataService.js
 */

class UgapDataService {
  /**
   * Sauvegarde les données extraites dans MongoDB
   * @param {Object} db - Base de données MongoDB
   * @param {Object} data - Données à sauvegarder { models, categories }
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<Object>} Données sauvegardées
   */
  static async saveData(db, data, entrepriseId) {
    const collection = db.collection('ugap_data');
    
    const document = {
      entrepriseId,
      models: data.models || [],
      categories: data.categories || [],
      updatedAt: new Date(),
      createdAt: new Date()
    };

    // Mise à jour ou insertion
    const existing = await collection.findOne({ entrepriseId });
    if (existing) {
      document.createdAt = existing.createdAt;
      await collection.updateOne(
        { entrepriseId },
        { $set: document }
      );
    } else {
      await collection.insertOne(document);
    }

    return document;
  }

  /**
   * Récupère les données sauvegardées
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<Object|null>} Données sauvegardées ou null
   */
  static async getData(db, entrepriseId) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    
    if (!document) return null;

    const categories = (document.categories || []).map(category => {
      // S'assurer qu'il y a toujours une sous-catégorie "Non attribuée"
      const subCategories = category.subCategories || [];
      const allAssignedOptionIds = new Set();
      subCategories.forEach(sc => {
        (sc.optionIds || []).forEach(id => allAssignedOptionIds.add(id));
      });

      const options = category.options || [];
      const unassignedOptions = options.filter(opt => !allAssignedOptionIds.has(opt.id));

      // Vérifier si une sous-catégorie "Non attribuée" existe déjà
      let nonAttribueeSubCat = subCategories.find(sc => 
        sc.name === 'Non attribuées' || sc.name === 'Non attribuée'
      );

      if (unassignedOptions.length > 0) {
        if (nonAttribueeSubCat) {
          // Mettre à jour les optionIds pour inclure toutes les options non assignées
          const existingIds = new Set(nonAttribueeSubCat.optionIds || []);
          unassignedOptions.forEach(opt => {
            if (!existingIds.has(opt.id)) {
              existingIds.add(opt.id);
            }
          });
          nonAttribueeSubCat.optionIds = Array.from(existingIds);
        } else {
          // Créer une nouvelle sous-catégorie "Non attribuées"
          nonAttribueeSubCat = {
            id: `subcat_${Date.now()}_non_attribuee`,
            name: 'Non attribuées',
            description: `Options non classées dans les autres sous-catégories (${unassignedOptions.length} option(s))`,
            optionIds: unassignedOptions.map(opt => opt.id)
          };
          subCategories.push(nonAttribueeSubCat);
        }
      } else if (nonAttribueeSubCat && (nonAttribueeSubCat.optionIds || []).length === 0) {
        // Supprimer la sous-catégorie "Non attribuées" si elle est vide
        const index = subCategories.indexOf(nonAttribueeSubCat);
        if (index > -1) {
          subCategories.splice(index, 1);
        }
      }

      return {
        ...category,
        subCategories
      };
    });

    return {
      models: document.models || [],
      categories
    };
  }

  /**
   * Crée une catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} name - Nom de la catégorie
   * @returns {Promise<string>} ID de la catégorie
   */
  static async createCategory(db, entrepriseId, name) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const categories = document.categories || [];
    const baseSlug = `cat_${(name || '')
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')}`;
    let candidateId = baseSlug || `cat_${Date.now()}`;
    let suffix = 1;
    const existingIds = new Set(categories.map(cat => cat.id));
    while (existingIds.has(candidateId)) {
      suffix += 1;
      candidateId = `${baseSlug || 'cat'}_${suffix}`;
    }

    const newCategory = {
      id: candidateId,
      name,
      options: [],
      subCategories: []
    };

    const result = await collection.updateOne(
      { entrepriseId },
      { $push: { categories: newCategory }, $set: { updatedAt: new Date() } }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Impossible de créer la catégorie');
    }

    return candidateId;
  }

  /**
   * Met à jour une catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} categoryId - ID de la catégorie
   * @param {Object} updates - Données à mettre à jour
   * @returns {Promise<boolean>} Succès
   */
  static async updateCategory(db, entrepriseId, categoryId, updates) {
    const collection = db.collection('ugap_data');
    const result = await collection.updateOne(
      { entrepriseId, 'categories.id': categoryId },
      { $set: { 'categories.$[cat]': { ...updates, id: categoryId }, updatedAt: new Date() } },
      { arrayFilters: [{ 'cat.id': categoryId }] }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Réordonne les catégories
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string[]} orderedCategoryIds - Liste des IDs dans l'ordre souhaité
   * @returns {Promise<boolean>} Succès
   */
  static async reorderCategories(db, entrepriseId, orderedCategoryIds) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const categories = document.categories || [];
    const categoryById = new Map(categories.map(cat => [cat.id, cat]));
    const seen = new Set();
    const reordered = [];

    orderedCategoryIds.forEach(id => {
      if (seen.has(id)) return;
      const category = categoryById.get(id);
      if (category) {
        reordered.push(category);
        seen.add(id);
      }
    });

    // Conserver les catégories non listées à la fin (ordre existant)
    categories.forEach(cat => {
      if (!seen.has(cat.id)) {
        reordered.push(cat);
        seen.add(cat.id);
      }
    });

    const result = await collection.updateOne(
      { entrepriseId },
      { $set: { categories: reordered, updatedAt: new Date() } }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Met à jour une option
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} optionId - ID de l'option
   * @param {Object} updates - Données à mettre à jour
   * @returns {Promise<boolean>} Succès
   */
  static async updateOption(db, entrepriseId, optionId, updates) {
    const collection = db.collection('ugap_data');
    const result = await collection.updateOne(
      { entrepriseId, 'categories.options.id': optionId },
      { 
        $set: { 
          'categories.$[cat].options.$[opt]': { ...updates, id: optionId },
          updatedAt: new Date()
        }
      },
      { 
        arrayFilters: [
          { 'cat.options.id': optionId },
          { 'opt.id': optionId }
        ]
      }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Déplace une option vers une autre catégorie et/ou sous-catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} fromCategoryId - ID de la catégorie source
   * @param {string} optionId - ID de l'option
   * @param {string} toCategoryId - ID de la catégorie destination
   * @param {string} toSubCategoryId - ID de la sous-catégorie destination (optionnel)
   * @returns {Promise<boolean>} Succès
   */
  static async moveOptionToCategory(db, entrepriseId, fromCategoryId, optionId, toCategoryId, toSubCategoryId) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const categories = document.categories || [];
    const fromCategory = categories.find(cat => cat.id === fromCategoryId);
    const toCategory = categories.find(cat => cat.id === toCategoryId);

    if (!fromCategory) {
      throw new Error('Catégorie source non trouvée');
    }
    if (!toCategory) {
      throw new Error('Catégorie destination non trouvée');
    }

    const removeOptionFromSubCategories = (category) => {
      (category.subCategories || []).forEach(sc => {
        if (Array.isArray(sc.optionIds)) {
          sc.optionIds = sc.optionIds.filter(id => id !== optionId);
        }
      });
    };

    let option = null;

    if (fromCategoryId === toCategoryId) {
      option = (fromCategory.options || []).find(opt => opt.id === optionId);
    } else {
      const fromOptions = fromCategory.options || [];
      const optionIndex = fromOptions.findIndex(opt => opt.id === optionId);
      if (optionIndex === -1) {
        throw new Error('Option non trouvée');
      }

      option = fromOptions.splice(optionIndex, 1)[0];
      fromCategory.options = fromOptions;

      const toOptions = toCategory.options || [];
      const existsInTarget = toOptions.some(opt => opt.id === optionId);
      if (!existsInTarget) {
        toOptions.push({ ...option, category: toCategory.name || option.category });
      } else {
        toCategory.options = toOptions.map(opt =>
          opt.id === optionId ? { ...opt, category: toCategory.name || opt.category } : opt
        );
      }
    }

    if (!option) {
      throw new Error('Option non trouvée');
    }

    removeOptionFromSubCategories(fromCategory);
    if (fromCategoryId !== toCategoryId) {
      removeOptionFromSubCategories(toCategory);
    }

    if (toSubCategoryId && toSubCategoryId !== 'none') {
      const targetSubCategory = (toCategory.subCategories || []).find(sc => sc.id === toSubCategoryId);
      if (!targetSubCategory) {
        throw new Error('Sous-catégorie destination non trouvée');
      }
      targetSubCategory.optionIds = Array.isArray(targetSubCategory.optionIds)
        ? targetSubCategory.optionIds
        : [];
      if (!targetSubCategory.optionIds.includes(optionId)) {
        targetSubCategory.optionIds.push(optionId);
      }
    }

    const result = await collection.updateOne(
      { entrepriseId },
      { $set: { categories, updatedAt: new Date() } }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Ajoute une nouvelle catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {Object} category - Données de la catégorie
   * @returns {Promise<boolean>} Succès
   */
  static async addCategory(db, entrepriseId, category) {
    const collection = db.collection('ugap_data');
    const result = await collection.updateOne(
      { entrepriseId },
      { 
        $push: { 
          categories: {
            id: category.id || `cat_${Date.now()}`,
            name: category.name,
            subCategories: category.subCategories || [],
            options: category.options || []
          }
        },
        $set: { updatedAt: new Date() }
      }
    );
    return result.modifiedCount > 0 || result.upsertedCount > 0;
  }

  /**
   * Supprime une catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} categoryId - ID de la catégorie
   * @returns {Promise<boolean>} Succès
   */
  static async deleteCategory(db, entrepriseId, categoryId) {
    const collection = db.collection('ugap_data');
    const result = await collection.updateOne(
      { entrepriseId },
      { 
        $pull: { categories: { id: categoryId } },
        $set: { updatedAt: new Date() }
      }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Réinitialise toutes les catégories:
   * - Regroupe TOUTES les options existantes dans une catégorie unique "Non classées"
   * - Supprime toutes les sous-catégories (elles seront régénérées si besoin)
   *
   * Important: on ne met PAS categories=[] sinon on perd l'accès aux options côté UI/configurateur.
   *
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<{categoriesCleared:number, optionsMoved:number}>}
   */
  static async clearAllCategories(db, entrepriseId) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const categories = document.categories || [];
    const optionById = new Map();

    categories.forEach(cat => {
      (cat.options || []).forEach(opt => {
        if (!opt || !opt.id) return;
        if (!optionById.has(opt.id)) {
          optionById.set(opt.id, {
            ...opt,
            category: 'Non classées',
            subCategory: null
          });
        }
      });
    });

    const options = Array.from(optionById.values());
    const newCategories = [{
      id: 'cat_non_classees',
      name: 'Non classées',
      options,
      subCategories: []
    }];

    const result = await collection.updateOne(
      { entrepriseId },
      { $set: { categories: newCategories, updatedAt: new Date() } }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Impossible de réinitialiser les catégories');
    }

    return { categoriesCleared: categories.length, optionsMoved: options.length };
  }

  /**
   * Ajoute une sous-catégorie à une catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} categoryId - ID de la catégorie
   * @param {Object} subCategory - Données de la sous-catégorie
   * @returns {Promise<boolean>} Succès
   */
  static async addSubCategory(db, entrepriseId, categoryId, subCategory) {
    const collection = db.collection('ugap_data');
    const result = await collection.updateOne(
      { entrepriseId, 'categories.id': categoryId },
      { 
        $push: { 
          'categories.$[cat].subCategories': {
            id: subCategory.id || `subcat_${Date.now()}`,
            name: subCategory.name,
            description: subCategory.description || '',
            optionIds: subCategory.optionIds || []
          }
        },
        $set: { updatedAt: new Date() }
      },
      { arrayFilters: [{ 'cat.id': categoryId }] }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Met à jour une sous-catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} categoryId - ID de la catégorie
   * @param {string} subCategoryId - ID de la sous-catégorie
   * @param {Object} updates - Données à mettre à jour
   * @returns {Promise<boolean>} Succès
   */
  /**
   * Crée une nouvelle sous-catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} categoryId - ID de la catégorie
   * @param {Object} subCategory - Données de la sous-catégorie { name, description, optionIds? }
   * @returns {Promise<string>} ID de la sous-catégorie créée
   */
  static async createSubCategory(db, entrepriseId, categoryId, subCategory) {
    const collection = db.collection('ugap_data');
    
    const subCategoryId = subCategory.id || `subcat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newSubCategory = {
      id: subCategoryId,
      name: subCategory.name || '',
      description: subCategory.description || '',
      optionIds: subCategory.optionIds || []
    };

    const result = await collection.updateOne(
      { entrepriseId, 'categories.id': categoryId },
      { 
        $push: { 
          'categories.$[cat].subCategories': newSubCategory
        },
        $set: {
          updatedAt: new Date()
        }
      },
      { arrayFilters: [{ 'cat.id': categoryId }] }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Catégorie non trouvée');
    }

    return subCategoryId;
  }

  static async updateSubCategory(db, entrepriseId, categoryId, subCategoryId, updates) {
    const collection = db.collection('ugap_data');
    
    // Récupérer la sous-catégorie actuelle pour préserver les champs non fournis
    const data = await this.getData(db, entrepriseId);
    const category = data?.categories?.find(c => c.id === categoryId);
    const subCategory = category?.subCategories?.find(sc => sc.id === subCategoryId);
    
    // Fusionner les mises à jour avec les données existantes
    const updatedSubCategory = {
      id: subCategoryId,
      name: updates.name !== undefined ? updates.name : (subCategory?.name || ''),
      description: updates.description !== undefined ? updates.description : (subCategory?.description || ''),
      optionIds: updates.optionIds !== undefined ? updates.optionIds : (subCategory?.optionIds || [])
    };
    
    const result = await collection.updateOne(
      { entrepriseId, 'categories.id': categoryId, 'categories.subCategories.id': subCategoryId },
      { 
        $set: { 
          'categories.$[cat].subCategories.$[subcat]': updatedSubCategory,
          updatedAt: new Date()
        }
      },
      { 
        arrayFilters: [
          { 'cat.id': categoryId },
          { 'subcat.id': subCategoryId }
        ]
      }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Supprime une sous-catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} categoryId - ID de la catégorie
   * @param {string} subCategoryId - ID de la sous-catégorie
   * @returns {Promise<boolean>} Succès
   */
  static async deleteSubCategory(db, entrepriseId, categoryId, subCategoryId) {
    const collection = db.collection('ugap_data');
    const result = await collection.updateOne(
      { entrepriseId, 'categories.id': categoryId },
      { 
        $pull: { 'categories.$[cat].subCategories': { id: subCategoryId } },
        $set: { updatedAt: new Date() }
      },
      { arrayFilters: [{ 'cat.id': categoryId }] }
    );
    return result.modifiedCount > 0;
  }

  // ========================================
  // GESTION DES PROMPTS IA
  // ========================================

  /**
   * Récupère les prompts IA configurés
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<Object>} Prompts configurés avec valeurs par défaut si non configurés
   */
  static async getPrompts(db, entrepriseId) {
    const collection = db.collection('ugap_prompts');
    const document = await collection.findOne({ entrepriseId });
    
    // Prompts par défaut
    const defaultPrompts = {
      subCategoryPrompt: `### CONTEXTE (MODIFIABLE)
Tu travailles pour un constructeur de bateaux. Tu souhaites classer tes options dans des catégories afin de faciliter la configuration des bateaux.
Ta mission: regrouper les options en sous-catégories logiques et utiles pour la navigation.

Contexte important:
- Regrouper les options qui se remplacent (mutuellement exclusives).
- Exemple: motorisation / moteur -> un bateau ne peut avoir qu'un seul moteur, donc tous les types de moteur doivent être dans la même sous-catégorie.
- Prioriser des sous-catégories claires et orientées usage.

### REGLES FIXES (NON MODIFIABLE)
Instructions IMPORTANTES:
1. Analyse CHAQUE option individuellement et identifie des groupes logiques (sous-catégories)
2. Chaque sous-catégorie doit regrouper des options similaires MAIS pas trop nombreuses (idéalement 5-15 options par sous-catégorie)
3. Crée des sous-catégories FINES et SPÉCIFIQUES plutôt que des groupes trop larges
4. TOUTES les options DOIVENT être incluses dans au moins une sous-catégorie - aucune option ne doit être oubliée
5. Si une option peut appartenir à plusieurs groupes, choisis le groupe le plus spécifique
6. Les sous-catégories doivent être pertinentes et utiles pour la navigation

INTERDICTIONS STRICTES - À NE JAMAIS FAIRE :
❌ NE JAMAIS regrouper par marque (Suzuki, Yamaha, Mercury, etc.) - C'EST INTERDIT
❌ NE JAMAIS regrouper par caractéristique technique (puissance, carburant, arbre, etc.) - Ce sont des caractéristiques, pas des catégories
❌ NE JAMAIS créer de sous-catégories comme "Moteurs Suzuki", "Moteurs Yamaha", "Moteurs 150 ch", "Moteurs essence"

RÈGLES DE REGROUPEMENT - À FAIRE :
✅ Regrouper par FONCTION ou TYPE D'USAGE uniquement
✅ Exemples CORRECTS :
   - "Moteurs" (TOUS les moteurs, toutes marques, toutes puissances, tous carburants confondus)
   - "Hélices" (TOUTES les hélices, tous types, toutes marques)
   - "Pièces de rechange" (toutes les pièces détachées, toutes marques)
   - "Accessoires moteurs" (tous les accessoires pour moteurs, toutes marques)
   - "Configurations jumelées" (moteurs en double/twin, toutes marques)
   - "Services et maintenance" (services, révisions, garanties)
   - "Garanties" (toutes les garanties, toutes marques)
   - "Formations" (toutes les formations, toutes marques)

PRINCIPE FONDAMENTAL :
Une sous-catégorie doit répondre à la question "QU'EST-CE QUE C'EST ?" (fonction/usage),
PAS "QUI L'A FAIT ?" (marque) ou "QUELLES SONT SES CARACTÉRISTIQUES ?" (puissance, carburant, etc.)

### DONNEES (NON MODIFIABLE)
Catégorie: "{{categoryName}}"
Options:
{{optionsList}}

### REPONSE ATTENDUE (NON MODIFIABLE)
RÉPONDS UNIQUEMENT AVEC UN TABLEAU JSON VALIDE, SANS AUCUN TEXTE AVANT OU APRÈS.
Commence directement par [ et termine par ].

Format exact:
[
  {
    "name": "Nom de la sous-catégorie",
    "description": "Description courte",
    "optionIds": ["ID_EXACT_DE_L_OPTION_1", "ID_EXACT_DE_L_OPTION_2"]
  }
]

IMPORTANT:
- Utilise UNIQUEMENT les IDs exacts fournis dans la liste des options (format: "ID: xxx")
- Vérifie que TOUTES les options sont incluses dans au moins une sous-catégorie
- Ne crée pas de nouveaux IDs
- Si tu as {{totalOptions}} options, assure-toi que la somme des optionIds dans toutes les sous-catégories = {{totalOptions}}

Si aucune sous-catégorie pertinente ne peut être identifiée, retourne un tableau vide: [].`,
      categorizationPrompt: `Analyse les options suivantes et assigne-les à des catégories pertinentes.

Options:
{{optionsList}}

Catégories existantes: Motorisation, Flotteurs, Aménagement, Électronique, Remorque, Sécurité, Services, Divers

Réponds UNIQUEMENT avec un JSON valide au format suivant:
{
  "categorizations": [
    {
      "optionName": "Nom de l'option",
      "category": "Nom de la catégorie",
      "subCategory": "Nom de la sous-catégorie (optionnel)"
    }
  ]
}`
    };

    if (!document) {
      // Créer avec les valeurs par défaut
      await collection.insertOne({
        entrepriseId,
        ...defaultPrompts,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return defaultPrompts;
    }

    // Fusionner avec les valeurs par défaut pour les champs manquants
    return {
      subCategoryPrompt: document.subCategoryPrompt || defaultPrompts.subCategoryPrompt,
      categorizationPrompt: document.categorizationPrompt || defaultPrompts.categorizationPrompt
    };
  }

  /**
   * Met à jour les prompts IA
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {Object} prompts - Prompts à mettre à jour { subCategoryPrompt?, categorizationPrompt? }
   * @returns {Promise<Object>} Prompts mis à jour
   */
  static async updatePrompts(db, entrepriseId, prompts) {
    const collection = db.collection('ugap_prompts');
    
    const updateData = {
      updatedAt: new Date()
    };
    
    if (prompts.subCategoryPrompt !== undefined && prompts.subCategoryPrompt !== null) {
      updateData.subCategoryPrompt = prompts.subCategoryPrompt;
    }
    
    if (prompts.categorizationPrompt !== undefined && prompts.categorizationPrompt !== null) {
      updateData.categorizationPrompt = prompts.categorizationPrompt;
    }

    const existing = await collection.findOne({ entrepriseId });
    
    if (existing) {
      await collection.updateOne(
        { entrepriseId },
        { $set: updateData }
      );
    } else {
      // Récupérer les valeurs par défaut pour les champs non fournis
      const defaults = await this.getPrompts(db, entrepriseId);
      await collection.insertOne({
        entrepriseId,
        subCategoryPrompt: prompts.subCategoryPrompt || defaults.subCategoryPrompt,
        categorizationPrompt: prompts.categorizationPrompt || defaults.categorizationPrompt,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return await this.getPrompts(db, entrepriseId);
  }

  /**
   * Réinitialise les prompts aux valeurs par défaut
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<Object>} Prompts réinitialisés
   */
  static async resetPrompts(db, entrepriseId) {
    const collection = db.collection('ugap_prompts');
    await collection.deleteOne({ entrepriseId });
    return await this.getPrompts(db, entrepriseId);
  }

  /**
   * Ajoute une configuration à un modèle
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} modelId - ID du modèle
   * @param {Object} config - Configuration { name, description?, image? }
   * @returns {Promise<Object>} Données mises à jour
   */
  static async addModelConfiguration(db, entrepriseId, modelId, config) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    
    if (!document) {
      throw new Error('Aucune donnée configurée');
    }

    const model = document.models.find(m => m.id === modelId);
    if (!model) {
      throw new Error('Modèle non trouvé');
    }

    if (!model.configurations) {
      model.configurations = [];
    }

    const newConfig = {
      id: `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: config.name,
      description: config.description || '',
      image: config.image || null,
      createdAt: new Date()
    };

    model.configurations.push(newConfig);

    await collection.updateOne(
      { entrepriseId },
      { $set: { models: document.models, updatedAt: new Date() } }
    );

    return document;
  }

  /**
   * Met à jour une configuration d'un modèle
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} modelId - ID du modèle
   * @param {string} configId - ID de la configuration
   * @param {Object} updates - Mises à jour { name?, description?, image? }
   * @returns {Promise<Object>} Données mises à jour
   */
  static async updateModelConfiguration(db, entrepriseId, modelId, configId, updates) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    
    if (!document) {
      throw new Error('Aucune donnée configurée');
    }

    const model = document.models.find(m => m.id === modelId);
    if (!model || !model.configurations) {
      throw new Error('Modèle ou configuration non trouvé(e)');
    }

    const config = model.configurations.find(c => c.id === configId);
    if (!config) {
      throw new Error('Configuration non trouvée');
    }

    Object.assign(config, updates);
    config.updatedAt = new Date();

    await collection.updateOne(
      { entrepriseId },
      { $set: { models: document.models, updatedAt: new Date() } }
    );

    return document;
  }

  /**
   * Supprime une configuration d'un modèle
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} modelId - ID du modèle
   * @param {string} configId - ID de la configuration
   * @returns {Promise<Object>} Données mises à jour
   */
  static async deleteModelConfiguration(db, entrepriseId, modelId, configId) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    
    if (!document) {
      throw new Error('Aucune donnée configurée');
    }

    const model = document.models.find(m => m.id === modelId);
    if (!model || !model.configurations) {
      throw new Error('Modèle ou configuration non trouvé(e)');
    }

    const index = model.configurations.findIndex(c => c.id === configId);
    if (index === -1) {
      throw new Error('Configuration non trouvée');
    }

    model.configurations.splice(index, 1);

    await collection.updateOne(
      { entrepriseId },
      { $set: { models: document.models, updatedAt: new Date() } }
    );

    return document;
  }

  /**
   * Met à jour l'image d'un modèle
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} modelId - ID du modèle
   * @param {string} image - URL de l'image
   * @returns {Promise<Object>} Données mises à jour
   */
  static async updateModelImage(db, entrepriseId, modelId, image) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    
    if (!document) {
      throw new Error('Aucune donnée configurée');
    }

    const model = document.models.find(m => m.id === modelId);
    if (!model) {
      throw new Error('Modèle non trouvé');
    }

    model.image = image;

    await collection.updateOne(
      { entrepriseId },
      { $set: { models: document.models, updatedAt: new Date() } }
    );

    return document;
  }

  /**
   * Met à jour le lien doc-template d'une option
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} optionId - ID de l'option
   * @param {string} idDocTemplate - ID de la collection doc-template
   * @returns {Promise<Object>} Données mises à jour
   */
  static async updateOptionDocTemplate(db, entrepriseId, optionId, idDocTemplate) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    
    if (!document) {
      throw new Error('Aucune donnée configurée');
    }

    let option = null;
    for (const category of document.categories) {
      option = (category.options || []).find(o => o.id === optionId);
      if (option) break;
    }

    if (!option) {
      throw new Error('Option non trouvée');
    }

    option.idDocTemplate = idDocTemplate || null;

    await collection.updateOne(
      { entrepriseId },
      { $set: { categories: document.categories, updatedAt: new Date() } }
    );

    return document;
  }
}

module.exports = UgapDataService;
