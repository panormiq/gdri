/**
 * Service de gestion des données UGAP (MongoDB)
 * Fichier : modules/ugap/backend/services/UgapDataService.js
 */
const fs = require('fs');
const { ObjectId } = require('mongodb');
const UgapImportAssignmentService = require('./UgapImportAssignmentService');
const UgapExcelService = require('./UgapExcelService');

class UgapDataService {
  static normalizeUiState(uiState) {
    const source = uiState && typeof uiState === 'object' ? uiState : {};
    const families = Array.isArray(source.families)
      ? source.families
      : (Array.isArray(source.validatedFamilies) ? source.validatedFamilies : []);
    const businessViews = Array.isArray(source.businessViews)
      ? source.businessViews
      : (Array.isArray(source.viewHeuristicRules) ? source.viewHeuristicRules : []);
    const baseModelTemplateFamilies = Array.isArray(source.baseModelTemplateFamilies)
      ? source.baseModelTemplateFamilies.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    const normalizePreset = (preset) => {
      const p = preset && typeof preset === 'object' ? preset : {};
      return {
        id: String(p.id || '').trim(),
        label: String(p.label || '').trim(),
        businessViewIds: Array.isArray(p.businessViewIds)
          ? p.businessViewIds.map((x) => String(x)).filter(Boolean)
          : []
      };
    };
    const rawViewPresets = Array.isArray(source.viewPresets) ? source.viewPresets.map(normalizePreset).filter((p) => p.id) : [];
    const defaultPreset = {
      id: 'basic',
      label: 'Basic',
      businessViewIds: businessViews.map((v) => String(v?.id || '').trim()).filter(Boolean)
    };
    const viewPresets = rawViewPresets.length > 0
      ? rawViewPresets
      : [defaultPreset];
    const activeViewPresetIdRaw = String(source.activeViewPresetId || '').trim();
    const activeViewPresetId = viewPresets.some((p) => p.id === activeViewPresetIdRaw)
      ? activeViewPresetIdRaw
      : viewPresets[0]?.id || 'basic';
    const familyDecisionGroupTemplates = Array.isArray(source.familyDecisionGroupTemplates)
      ? source.familyDecisionGroupTemplates
          .map((tpl) => {
            const t = tpl && typeof tpl === 'object' ? tpl : {};
            return {
              id: String(t.id || '').trim(),
              title: String(t.title || '').trim(),
              description: String(t.description || '').trim(),
              suggestedFamilyLabel: String(t.suggestedFamilyLabel || '').trim(),
              suggestedObjectName: String(t.suggestedObjectName || '').trim(),
              decisionGroups: Array.isArray(t.decisionGroups) ? t.decisionGroups : []
            };
          })
          .filter((t) => t.id)
      : [];
    return {
      families,
      businessViews,
      baseModelTemplateFamilies,
      viewPresets,
      activeViewPresetId,
      familyDecisionGroupTemplates,
      updatedAt: source.updatedAt || null
    };
  }

  static normalizeSelectionRules(rules) {
    const source = rules && typeof rules === 'object' ? rules : {};
    return {
      unique: !!source.unique,
      required: !!source.required
    };
  }

  static normalizeCategory(category) {
    const source = category && typeof category === 'object' ? category : {};
    return {
      ...source,
      id: String(source.id || ''),
      name: String(source.name || ''),
      selectionRules: this.normalizeSelectionRules(source.selectionRules),
      businessViewIds: Array.isArray(source.businessViewIds) ? source.businessViewIds.map((x) => String(x)).filter(Boolean) : [],
      familyIds: Array.isArray(source.familyIds) ? source.familyIds.map((x) => String(x)).filter(Boolean) : [],
      options: Array.isArray(source.options) ? source.options.map((opt) => this.normalizeOption(opt)) : [],
      subCategories: Array.isArray(source.subCategories) ? source.subCategories : []
    };
  }

  static normalizeOption(option) {
    const source = option && typeof option === 'object' ? option : {};
    const compatibleModels = Array.isArray(source.compatibleModels)
      ? source.compatibleModels.map((x) => String(x)).filter(Boolean)
      : [];
    const hasExplicitDivers = source.isDivers !== undefined && source.isDivers !== null;
    return {
      ...source,
      id: String(source.id || ''),
      name: String(source.name || ''),
      refUgap: String(source.refUgap || ''),
      compatibleModels,
      // Persistance explicite "Divers" (fallback historique: pas de croix => divers)
      isDivers: hasExplicitDivers ? !!source.isDivers : compatibleModels.length === 0,
      isSparePart: !!source.isSparePart,
      isMinoration: !!source.isMinoration
    };
  }

  static normalizeBusinessView(view) {
    const source = view && typeof view === 'object' ? view : {};
    return {
      ...source,
      id: String(source.id || ''),
      label: String(source.label || ''),
      categoryIds: Array.isArray(source.categoryIds) ? source.categoryIds.map((x) => String(x)).filter(Boolean) : [],
      familyIds: Array.isArray(source.familyIds) ? source.familyIds.map((x) => String(x)).filter(Boolean) : []
    };
  }

  static normalizeDependencyRules(rules) {
    if (!Array.isArray(rules)) return [];
    return rules
      .map((rule) => {
        const source = rule && typeof rule === 'object' ? rule : {};
        return {
          triggerOptionId: String(source.triggerOptionId || '').trim(),
          autoSelectOptionIds: Array.isArray(source.autoSelectOptionIds)
            ? source.autoSelectOptionIds.map((x) => String(x)).filter(Boolean)
            : [],
          message: source.message != null ? String(source.message) : ''
        };
      })
      .filter((rule) => rule.triggerOptionId && rule.autoSelectOptionIds.length > 0);
  }

  static normalizeSubCategory(subCategory) {
    const source = subCategory && typeof subCategory === 'object' ? subCategory : {};
    return {
      ...source,
      id: String(source.id || ''),
      name: String(source.name || ''),
      description: String(source.description || ''),
      optionIds: Array.isArray(source.optionIds) ? source.optionIds.map((x) => String(x)).filter(Boolean) : []
    };
  }

  /**
   * Sauvegarde les données extraites dans MongoDB
   * @param {Object} db - Base de données MongoDB
   * @param {Object} data - Données à sauvegarder { models, categories }
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<Object>} Données sauvegardées
   */
  static async saveData(db, data, entrepriseId) {
    const collection = db.collection('ugap_data');
    const existing = await collection.findOne({ entrepriseId });
    const normalizedInputUiState = this.normalizeUiState(data?.uiState);
    const existingUiState = this.normalizeUiState(existing?.uiState);
    const resolvedUiState = {
      families: normalizedInputUiState.families.length
        ? normalizedInputUiState.families
        : existingUiState.families,
      businessViews: normalizedInputUiState.businessViews.length
        ? normalizedInputUiState.businessViews
        : existingUiState.businessViews,
      baseModelTemplateFamilies: normalizedInputUiState.baseModelTemplateFamilies.length
        ? normalizedInputUiState.baseModelTemplateFamilies
        : existingUiState.baseModelTemplateFamilies,
      viewPresets: normalizedInputUiState.viewPresets.length
        ? normalizedInputUiState.viewPresets
        : existingUiState.viewPresets,
      activeViewPresetId: normalizedInputUiState.activeViewPresetId || existingUiState.activeViewPresetId || 'basic',
      updatedAt: normalizedInputUiState.updatedAt || existingUiState.updatedAt || null
    };
    
    const document = {
      entrepriseId,
      models: data.models || [],
      categories: (data.categories || []).map((cat) => this.normalizeCategory(cat)),
      businessViews: Array.isArray(data.businessViews) ? data.businessViews.map((view) => this.normalizeBusinessView(view)) : [],
      dependencyRules: this.normalizeDependencyRules(data.dependencyRules),
      uiState: this.normalizeUiState(resolvedUiState),
      updatedAt: new Date(),
      createdAt: new Date()
    };

    // Mise à jour ou insertion
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
   * Pousse les modèles validés du staging dans le catalogue publié (ugap_data)
   * sans attendre la publication complète de l'import.
   */
  static async syncValidatedModelsToPublishedCatalog(db, entrepriseId, stagingModels = [], validatedModelIds = []) {
    const ids = new Set(
      (Array.isArray(validatedModelIds) ? validatedModelIds : [])
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    );
    if (!ids.size) return;

    const collection = db.collection('ugap_data');
    const existing = await collection.findOne({ entrepriseId });
    const existingModels = Array.isArray(existing?.models) ? existing.models : [];
    const byId = new Map(
      existingModels
        .map((m) => ({ id: String(m?.id || '').trim(), model: m }))
        .filter((row) => row.id)
        .map((row) => [row.id, row.model])
    );

    (Array.isArray(stagingModels) ? stagingModels : []).forEach((m) => {
      const id = String(m?.id || '').trim();
      if (!id || !ids.has(id)) return;
      const prev = byId.get(id) || {};
      byId.set(id, {
        ...prev,
        ...m,
        importValidationStatus: 'validated',
        // Conserver les configurations déjà faites côté catalogue si le staging n'en a pas.
        configurations: Array.isArray(m?.configurations)
          ? m.configurations
          : (Array.isArray(prev?.configurations) ? prev.configurations : [])
      });
    });

    // Mettre à jour uniquement les IDs cochés; ne pas toucher aux autres modèles.
    const nextModels = Array.from(byId.values());
    const now = new Date();
    await collection.updateOne(
      { entrepriseId },
      {
        $set: {
          models: nextModels,
          updatedAt: now
        },
        $setOnInsert: {
          entrepriseId,
          categories: [],
          businessViews: [],
          dependencyRules: [],
          uiState: this.normalizeUiState({}),
          createdAt: now
        }
      },
      { upsert: true }
    );
  }

  /**
   * Synchronise la liste complète des modèles du staging vers le catalogue publié.
   * Utilisé après validation modèles pour garantir que le catalogue n'est jamais vide
   * à cause d'un problème de sous-ensemble d'IDs.
   */
  static async syncAllStagingModelsToPublishedCatalog(db, entrepriseId, stagingModels = [], validatedModelIds = []) {
    const validatedSet = new Set(
      (Array.isArray(validatedModelIds) ? validatedModelIds : [])
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    );
    const collection = db.collection('ugap_data');
    const existing = await collection.findOne({ entrepriseId });
    const prev = Array.isArray(existing?.models) ? existing.models : [];
    const prevById = new Map(
      prev
        .map((m) => ({ id: String(m?.id || '').trim(), model: m }))
        .filter((row) => row.id)
        .map((row) => [row.id, row.model])
    );
    const next = (Array.isArray(stagingModels) ? stagingModels : []).map((m) => {
      const id = String(m?.id || '').trim();
      const old = id ? (prevById.get(id) || {}) : {};
      return {
        ...old,
        ...m,
        importValidationStatus: id && validatedSet.has(id) ? 'validated' : 'to_validate',
        configurations: Array.isArray(m?.configurations)
          ? m.configurations
          : (Array.isArray(old?.configurations) ? old.configurations : [])
      };
    });

    const now = new Date();
    await collection.updateOne(
      { entrepriseId },
      {
        $set: {
          models: next,
          updatedAt: now
        },
        $setOnInsert: {
          entrepriseId,
          categories: [],
          businessViews: [],
          dependencyRules: [],
          uiState: this.normalizeUiState({}),
          createdAt: now
        }
      },
      { upsert: true }
    );
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

    const categories = (document.categories || []).map((rawCategory) => {
      const category = this.normalizeCategory(rawCategory);
      // S'assurer qu'il y a toujours une sous-catégorie "Non attribuée"
      const subCategories = (category.subCategories || []).map((sc) => this.normalizeSubCategory(sc));
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
      categories,
      businessViews: Array.isArray(document.businessViews) ? document.businessViews.map((view) => this.normalizeBusinessView(view)) : [],
      dependencyRules: this.normalizeDependencyRules(document.dependencyRules),
      uiState: this.normalizeUiState(document.uiState)
    };
  }

  static async getUiState(db, entrepriseId) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne(
      { entrepriseId },
      { projection: { uiState: 1 } }
    );
    return this.normalizeUiState(document?.uiState);
  }

  static async updateUiState(db, entrepriseId, updates) {
    const collection = db.collection('ugap_data');
    const existing = await collection.findOne(
      { entrepriseId },
      { projection: { uiState: 1 } }
    );
    const current = this.normalizeUiState(existing?.uiState);
    const next = this.normalizeUiState({
      ...current,
      ...(updates && typeof updates === 'object' ? updates : {}),
      updatedAt: new Date()
    });
    const now = new Date();
    await collection.updateOne(
      { entrepriseId },
      {
        $set: { uiState: next, updatedAt: now },
        $setOnInsert: {
          entrepriseId,
          models: [],
          categories: [],
          businessViews: [],
          dependencyRules: [],
          createdAt: now
        }
      },
      { upsert: true }
    );
    return next;
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
      selectionRules: { unique: false, required: false },
      businessViewIds: [],
      familyIds: [],
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
    const current = await collection.findOne({ entrepriseId, 'categories.id': categoryId }, { projection: { categories: 1 } });
    const existing = (current?.categories || []).find((cat) => String(cat?.id) === String(categoryId));
    if (!existing) return false;
    const merged = this.normalizeCategory({
      ...existing,
      ...(updates && typeof updates === 'object' ? updates : {}),
      id: categoryId
    });
    const result = await collection.updateOne(
      { entrepriseId, 'categories.id': categoryId },
      { $set: { 'categories.$[cat]': merged, updatedAt: new Date() } },
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
    const merged = this.normalizeOption({ ...updates, id: optionId });
    const result = await collection.updateOne(
      { entrepriseId, 'categories.options.id': optionId },
      { 
        $set: { 
          'categories.$[cat].options.$[opt]': merged,
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
   * Assigne des familles a un lot d'options en une seule ecriture
   * @param {Object} db
   * @param {string} entrepriseId
   * @param {Array<{optionId:string,familyLabel:string}>} assignments
   * @returns {Promise<{updatedCount:number,updatedOptionIds:string[]}>}
   */
  static async assignOptionsFamiliesBulk(db, entrepriseId, assignments) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const updatesMap = new Map();
    (Array.isArray(assignments) ? assignments : []).forEach((item) => {
      const optionId = String(item?.optionId || '').trim();
      const familyLabel = String(item?.familyLabel || '').trim();
      if (!optionId || !familyLabel) return;
      updatesMap.set(optionId, familyLabel);
    });
    if (!updatesMap.size) return { updatedCount: 0, updatedOptionIds: [] };

    let updatedCount = 0;
    const updatedOptionIds = [];
    const categories = (document.categories || []).map((cat) => {
      const options = (cat.options || []).map((opt) => {
        const optionId = String(opt?.id || '').trim();
        if (!optionId || !updatesMap.has(optionId)) return opt;
        updatedCount += 1;
        updatedOptionIds.push(optionId);
        return {
          ...opt,
          familyLabel: updatesMap.get(optionId)
        };
      });
      return { ...cat, options };
    });

    await collection.updateOne(
      { entrepriseId },
      { $set: { categories, updatedAt: new Date() } }
    );
    return { updatedCount, updatedOptionIds };
  }

  /**
   * Ajoute une nouvelle option dans une catégorie
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} categoryId - ID de la catégorie cible
   * @param {Object} option - Données de l'option à créer
   * @returns {Promise<boolean>} Succès
   */
  static async createOption(db, entrepriseId, categoryId, option) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const categories = Array.isArray(document.categories) ? document.categories : [];
    if (!categories.length) {
      throw new Error('Aucune catégorie disponible');
    }

    const targetCategory = categories.find((cat) => String(cat?.id || '') === String(categoryId || '').trim()) || categories[0];
    if (!targetCategory) {
      throw new Error('Catégorie cible introuvable');
    }

    const optionId = String(option?.id || '').trim();
    if (!optionId) {
      throw new Error('ID option requis');
    }

    const existingIds = new Set(
      categories.flatMap((cat) => (cat.options || []).map((opt) => String(opt?.id || '').trim()).filter(Boolean))
    );
    if (existingIds.has(optionId)) {
      throw new Error(`Une option avec l'id "${optionId}" existe déjà`);
    }

    const toCreate = {
      ...option,
      id: optionId,
      name: String(option?.name || '').trim(),
      refUgap: String(option?.refUgap || '').trim(),
      baseRefUgap: String(option?.baseRefUgap || '').trim(),
      familyLabel: String(option?.familyLabel || '').trim(),
      subFamily: String(option?.subFamily || '').trim(),
      priceClient: 0,
      priceUgap: Number.isFinite(Number(option?.priceUgap)) ? Number(option.priceUgap) : 0,
      baseIncluded: true,
      manualBaseOption: option?.manualBaseOption !== false,
      baseIncludedPrice: Number.isFinite(Number(option?.baseIncludedPrice)) ? Number(option.baseIncludedPrice) : 0,
      compatibleModels: Array.isArray(option?.compatibleModels)
        ? option.compatibleModels.map((x) => String(x)).filter(Boolean)
        : [],
      isDivers: option?.isDivers !== undefined ? !!option.isDivers : false
    };

    const result = await collection.updateOne(
      { entrepriseId, 'categories.id': targetCategory.id },
      {
        $push: { 'categories.$.options': toCreate },
        $set: { updatedAt: new Date() }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Supprime une option (et ses références en sous-catégories)
   * @param {Object} db - Base de données MongoDB
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} optionId - ID de l'option à supprimer
   * @returns {Promise<boolean>} Succès
   */
  static async deleteOption(db, entrepriseId, optionId) {
    const collection = db.collection('ugap_data');
    const document = await collection.findOne({ entrepriseId });
    if (!document) {
      throw new Error('Données non trouvées');
    }

    const targetId = String(optionId || '').trim();
    if (!targetId) {
      throw new Error('optionId requis');
    }

    const categories = (document.categories || []).map((cat) => {
      const options = (cat.options || []).filter((opt) => String(opt?.id || '').trim() !== targetId);
      const subCategories = (cat.subCategories || []).map((sc) => ({
        ...sc,
        optionIds: Array.isArray(sc.optionIds)
          ? sc.optionIds.map((x) => String(x)).filter((id) => id !== targetId)
          : []
      }));
      return { ...cat, options, subCategories };
    });

    const result = await collection.updateOne(
      { entrepriseId },
      {
        $set: {
          categories,
          updatedAt: new Date()
        }
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
            selectionRules: this.normalizeSelectionRules(category.selectionRules),
            businessViewIds: Array.isArray(category.businessViewIds) ? category.businessViewIds.map((x) => String(x)).filter(Boolean) : [],
            familyIds: Array.isArray(category.familyIds) ? category.familyIds.map((x) => String(x)).filter(Boolean) : [],
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

  static async purgePublishedData(db, entrepriseId) {
    const collection = db.collection('ugap_data');
    const result = await collection.deleteOne({ entrepriseId });
    return {
      deleted: result.deletedCount > 0,
      deletedCount: result.deletedCount || 0
    };
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
      optionIds: subCategory.optionIds || [],
      familyId: subCategory.familyId != null ? String(subCategory.familyId) : ''
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
      optionIds: updates.optionIds !== undefined ? updates.optionIds : (subCategory?.optionIds || []),
      familyId: updates.familyId !== undefined ? String(updates.familyId || '') : String(subCategory?.familyId || '')
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
      "assignation": "Nom de l'assignation (optionnel)"
    }
  ]
}`,
      minorationPrompt: `Tu analyses des lignes de minoration UGAP.

Objectif:
1) Identifier le ou les poste(s) concerné(s)
2) Identifier l'option actuellement présente (moteur actuel / base)
3) Identifier l'option qui remplace
4) Calculer la moins-value à déduire

Règles métier:
- Une croix indique le moteur actuellement présent pour le poste.
- Si on change de moteur, la minoration correspond à la déduction du prix du moteur actuel.
- Priorité d'analyse: poste(s) > option actuelle > option remplaçante > impact prix.
- Si une donnée est absente, retourner null sur le champ.

Réponds UNIQUEMENT en JSON valide:
{
  "assignments": [
    {
      "sourceLine": "ligne brute",
      "postes": [1, 2],
      "currentOption": "moteur actuel",
      "replacementOption": "moteur remplaçant",
      "minorationAmount": 0,
      "currency": "EUR",
      "confidence": 0
    }
  ]
}`,
      subCategoryLlmId: null,
      categorizationLlmId: null,
      minorationLlmId: null,
      familleLlmId: null,
      assignationLlmId: null,
      assignationPrompt: `Tu dois assigner UNE famille à UNE vue métier.

Vues métier disponibles:
{{businessViews}}

Famille à classer:
- familyLabel: {{familyLabel}}
- assignation actuelle: {{assignation}}
- sousFamille: {{subFamily}}
- nombre options: {{optionsCount}}
- exemples options:
{{optionsList}}

Règles:
- Choisir exactement UNE vue métier parmi les id fournis.
- Se baser sur le sens métier de la famille et les mots-clés des vues.
- Répondre en JSON strict, sans texte autour.

Format:
{
  "businessViewId": "id_exact_si_possible",
  "businessViewLabel": "label_vue_metier",
  "confidence": 0.0,
  "reason": "explication courte"
}`,
      familleContext: `Tu es expert catalogue options bateau / UGAP.

Contexte : listes d'options et de minorations issues de catalogues. Une « famille » regroupe des VARIANTES du même produit / même prestation : pour un même poste catalogue, le client ne fait **qu'un seul choix** parmi ces lignes (ex. une couleur parmi toutes les teintes proposées pour ce flotteur ou cette console — on ne peut pas commander 5 couleurs différentes pour le même équipement). Toutes les lignes « couleur X / couleur Y / RAL … » qui décrivent ce même équipement doivent donc être dans **une seule** famille avec tous leurs \`id\` dans \`optionIds\`.`,
      famillePrompt: `## Tâche
Produire le regroupement « familles d'options » : une famille = toutes les options **en concurrence** pour le même besoin : **une seule** peut être retenue (choix unique). Les variantes couleur, RAL, finition ou teinte du **même** article / équipement sont **toujours** dans la **même** famille : l'utilisateur choisit une option parmi la liste, pas plusieurs couleurs à la fois pour le même produit.

## Choix unique — couleurs et finitions (règle absolue)
- Si plusieurs lignes ne diffèrent que par la couleur, la teinte, le RAL ou la finition du **même** équipement (ex. « Console de pilotage en rouge … », « … en vert … », « … Noir - RAL 9005 »), elles forment **une seule** famille ; \`optionIds\` contient **tous** les ids de ces lignes (ex. 5 couleurs → 5 ids dans **la même** entrée JSON, pas 5 familles).
- Ne jamais éclater les couleurs d'un même produit en plusieurs familles : ce serait faux métier (on ne cumule pas plusieurs coloris pour un seul équipement).

## Méthode (à appliquer dans l'ordre)
1) Parcourir **toute** la liste numérotée ; ne rien ignorer.
2) Repérer les **groupes de variantes** : même intention métier, libellés qui partagent une **racine stable** et ne changent que sur la partie variante.
   - Exemples de racines stables : « Coloris flotteur en … », « Coloris de la coque en … », « Console de pilotage en … », « Marquage comprenant … lettres », « Pulvérisation zone renfort … », « Bâche … Postes … ».
3) **Regrouper** dans une seule famille tous les ids de ces variantes ; \`familyLabel\` = nom générique du choix (ex. « Couleur du flotteur », « Couleur de la coque », « Console de pilotage (couleur / finition) », « Marquage (nombre de lettres) »).
4) **Ne pas regrouper** des lignes qui ne sont pas des variantes du même choix :
   - Libellés décrivant des **postes / emplacements différents** sur l'embarcation (ex. « … Poste 1 » vs « … Postes 2 et 9 ») : ce sont des **prestations distinctes** (même famille d'équipement répétée à plusieurs endroits), mets-les dans des **familles séparées** ou laisse des familles à une ligne selon le cas.
   - Équipements ou prestations de nature différente (même catégorie catalogue ne suffit pas à fusionner).
5) Les **minorations** (\`type=minoration\`) : applique les mêmes règles ; ne fusionne pas une minoration avec une option si ce n'est pas la même variante logique.

## Exemple canonique (référence métier)
Entrées (5 teintes du même flotteur) :
- Coloris flotteur en Rouge Etna
- Coloris flotteur en Vert Army
- Coloris flotteur en Noir
- Coloris flotteur en Orange Sylvano
- Coloris flotteur en Gris Military ou Jaune Colorado
Sortie attendue : **une seule** famille, **5** ids dans \`optionIds\` (pas 5 familles).
\`{"familyLabel":"Couleur du flotteur","optionIds":["id1","id2","id3","id4","id5"]}\`
Le client ne peut en sélectionner qu'une ; \`defaultOptionId\` optionnel si une teinte « standard » est identifiable, sinon omis.

## DONNÉES (liste injectée automatiquement)
{{LISTE_LIGNES}}

## FORMAT DE RETOUR (obligatoire)
- Un **seul** tableau JSON (array), racine directe. Aucun texte avant \`[\` ni après \`]\` (pas de markdown, pas de \`\`\`json).
- Chaque élément : \`familyLabel\` (string, non vide), \`optionIds\` (array de strings = valeurs \`id=\` **exactes** de la liste).
- Optionnel : \`defaultOptionId\` (string) ∈ \`optionIds\`, seulement si une ligne est clairement la référence / standard.
- Requis : \`assignation\` (string) = nom d'assignation métier pour la famille.
- Requis : \`businessView\` (string) = vue métier principale.
- Optionnel : \`subFamily\` (string) = sous-famille métier si pertinent.
- **Choix unique** : pour un même équipement, toutes les variantes couleur / RAL / finition → **une** famille et **tous** les ids dans \`optionIds\` (une seule teinte retenue, pas plusieurs).

Exemple de forme (ids fictifs) :
[
  {"familyLabel":"Couleur du flotteur","optionIds":["opt_23","opt_24","opt_25"]},
  {"familyLabel":"Console de pilotage (couleur)","optionIds":["opt_86","opt_87","opt_88"],"defaultOptionId":"opt_86"}
]

## Règles strictes
- Chaque \`id\` présent dans les données apparaît **exactement une fois** au total dans tous les \`optionIds\`.
- Pas de doublon d'id entre familles ; pas d'id inventé.
- \`familyLabel\` : court, en français, nom du **choix catalogue** (ex. « Couleur du flotteur »), pas le nom d'une teinte isolée.
- \`assignation\` : terme métier court et exploitable en production.
- \`businessView\` : vue métier de rattachement.
- Couleurs / RAL / finitions du même équipement : **toujours** regroupées ; interdit de créer une famille par teinte.
- Liste longue : reste cohérent du début à la fin ; une seule réponse JSON couvrant **toutes** les lignes.`
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
      categorizationPrompt: document.categorizationPrompt || defaultPrompts.categorizationPrompt,
      minorationPrompt: document.minorationPrompt || defaultPrompts.minorationPrompt,
      subCategoryLlmId: document.subCategoryLlmId || defaultPrompts.subCategoryLlmId,
      categorizationLlmId: document.categorizationLlmId || defaultPrompts.categorizationLlmId,
      minorationLlmId: document.minorationLlmId || defaultPrompts.minorationLlmId,
      familleLlmId: document.familleLlmId || defaultPrompts.familleLlmId,
      assignationLlmId: document.assignationLlmId || defaultPrompts.assignationLlmId,
      assignationPrompt: document.assignationPrompt || defaultPrompts.assignationPrompt,
      familleContext:
        document.familleContext !== undefined && document.familleContext !== null
          ? document.familleContext
          : defaultPrompts.familleContext,
      famillePrompt: document.famillePrompt || defaultPrompts.famillePrompt
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
    
    if (prompts.minorationPrompt !== undefined && prompts.minorationPrompt !== null) {
      updateData.minorationPrompt = prompts.minorationPrompt;
    }

    if (prompts.famillePrompt !== undefined && prompts.famillePrompt !== null) {
      updateData.famillePrompt = prompts.famillePrompt;
    }

    if (prompts.familleContext !== undefined && prompts.familleContext !== null) {
      updateData.familleContext = prompts.familleContext;
    }
    if (prompts.subCategoryLlmId !== undefined) {
      updateData.subCategoryLlmId = prompts.subCategoryLlmId ? String(prompts.subCategoryLlmId).trim() : null;
    }
    if (prompts.categorizationLlmId !== undefined) {
      updateData.categorizationLlmId = prompts.categorizationLlmId ? String(prompts.categorizationLlmId).trim() : null;
    }
    if (prompts.minorationLlmId !== undefined) {
      updateData.minorationLlmId = prompts.minorationLlmId ? String(prompts.minorationLlmId).trim() : null;
    }
    if (prompts.familleLlmId !== undefined) {
      updateData.familleLlmId = prompts.familleLlmId ? String(prompts.familleLlmId).trim() : null;
    }
    if (prompts.assignationLlmId !== undefined) {
      updateData.assignationLlmId = prompts.assignationLlmId ? String(prompts.assignationLlmId).trim() : null;
    }
    if (prompts.assignationPrompt !== undefined && prompts.assignationPrompt !== null) {
      updateData.assignationPrompt = prompts.assignationPrompt;
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
        minorationPrompt: prompts.minorationPrompt || defaults.minorationPrompt,
        subCategoryLlmId: prompts.subCategoryLlmId !== undefined
          ? (prompts.subCategoryLlmId ? String(prompts.subCategoryLlmId).trim() : null)
          : defaults.subCategoryLlmId,
        categorizationLlmId: prompts.categorizationLlmId !== undefined
          ? (prompts.categorizationLlmId ? String(prompts.categorizationLlmId).trim() : null)
          : defaults.categorizationLlmId,
        minorationLlmId: prompts.minorationLlmId !== undefined
          ? (prompts.minorationLlmId ? String(prompts.minorationLlmId).trim() : null)
          : defaults.minorationLlmId,
        familleLlmId: prompts.familleLlmId !== undefined
          ? (prompts.familleLlmId ? String(prompts.familleLlmId).trim() : null)
          : defaults.familleLlmId,
        assignationLlmId: prompts.assignationLlmId !== undefined
          ? (prompts.assignationLlmId ? String(prompts.assignationLlmId).trim() : null)
          : defaults.assignationLlmId,
        assignationPrompt: prompts.assignationPrompt || defaults.assignationPrompt,
        familleContext: prompts.familleContext !== undefined && prompts.familleContext !== null
          ? prompts.familleContext
          : defaults.familleContext,
        famillePrompt: prompts.famillePrompt || defaults.famillePrompt,
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

  static buildOptionBusinessKey(option, categoryName = '') {
    // Une ligne Excel = un id (opt_<row>) : ne pas fusionner plusieurs lignes ayant la même réf. UGAP.
    const id = String(option?.id || '').trim();
    if (id) return `id:${id}`;
    const ref = String(option?.refUgap || '').trim().toUpperCase();
    if (ref) return `ref:${ref}`;
    const normalize = (value) => String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    const name = normalize(option?.name);
    const category = normalize(categoryName || option?.category);
    return `name:${name}|cat:${category}`;
  }

  static mergeImportedCategories(categories) {
    const incoming = Array.isArray(categories) ? categories : [];
    const mergedByCategory = new Map();
    incoming.forEach((category) => {
      const categoryName = String(category?.name || 'Divers').trim() || 'Divers';
      const categoryId = String(category?.id || `cat_${categoryName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`);
      if (!mergedByCategory.has(categoryName)) {
        mergedByCategory.set(categoryName, {
          id: categoryId,
          name: categoryName,
          options: [],
          subCategories: Array.isArray(category?.subCategories) ? category.subCategories : [],
          _optionIndex: new Map()
        });
      }
      const target = mergedByCategory.get(categoryName);
      (category?.options || []).forEach((option) => {
        const businessKey = this.buildOptionBusinessKey(option, categoryName);
        const existing = target._optionIndex.get(businessKey);
        if (!existing) {
          const normalized = this.normalizeOption(option);
          normalized.businessKey = businessKey;
          target._optionIndex.set(businessKey, normalized);
          target.options.push(normalized);
          return;
        }
        const mergedModels = new Set([...(existing.compatibleModels || []), ...((option?.compatibleModels || []).map((x) => String(x)))]);
        existing.compatibleModels = Array.from(mergedModels).filter(Boolean);
        if (!existing.refUgap && option?.refUgap) existing.refUgap = String(option.refUgap);
        if (!existing.name && option?.name) existing.name = String(option.name);
        if (Number(option?.priceClient) > 0) existing.priceClient = Number(option.priceClient);
        if (Number(option?.priceUgap) > 0) existing.priceUgap = Number(option.priceUgap);
      });
    });
    return Array.from(mergedByCategory.values()).map((cat) => {
      delete cat._optionIndex;
      return cat;
    });
  }

  /**
   * Garde progress.validatedModelIds aligné sur les modèles réellement présents dans le staging
   * (réimport / suppression de modèles avant la fin du workflow).
   */
  static normalizeStagingProgressForModels(models, progress = {}) {
    const modelIdSet = new Set(
      (Array.isArray(models) ? models : [])
        .map((m) => String(m?.id || '').trim())
        .filter(Boolean)
    );
    const raw = Array.isArray(progress?.validatedModelIds) ? progress.validatedModelIds : [];
    const seen = new Set();
    const pruned = [];
    raw.forEach((x) => {
      const id = String(x || '').trim();
      if (!id || !modelIdSet.has(id) || seen.has(id)) return;
      seen.add(id);
      pruned.push(id);
    });
    const modelsCompleted = modelIdSet.size > 0 && [...modelIdSet].every((mid) => seen.has(mid));
    const base = {
      ...progress,
      validatedModelIds: pruned,
      modelsCompleted
    };
    if (!modelsCompleted) {
      base.optionsCompleted = false;
      base.familiesCompleted = false;
      base.viewsCompleted = false;
    }
    return base;
  }

  /**
   * progress.optionsCompleted ne peut être vrai que si les modèles sont complets
   * ET que le document staging indique optionsStatus === 'validated'.
   */
  static coerceStagingProgressOptionsWithDocument(progress, stagingDoc = {}) {
    const p = progress && typeof progress === 'object' ? { ...progress } : {};
    const modelsDone = !!p.modelsCompleted;
    const optionsValidated = String(stagingDoc.optionsStatus || '').toLowerCase() === 'validated';
    p.optionsCompleted = !!(modelsDone && optionsValidated);
    if (!modelsDone) {
      p.familiesCompleted = false;
      p.viewsCompleted = false;
    }
    return p;
  }

  /**
   * Source unique de vérité du statut import.
   */
  static computeStagingStatuses(progress = {}, stagingDoc = {}) {
    const modelsCompleted = !!progress?.modelsCompleted;
    const optionsValidated = String(stagingDoc?.optionsStatus || '').toLowerCase() === 'validated';
    const modelsStatus = modelsCompleted ? 'validated' : 'to_validate';
    const status = !modelsCompleted
      ? 'draft'
      : (optionsValidated ? 'validated' : 'in_review');
    return { status, modelsStatus };
  }


  static _stagingModelProgressOutOfSync(doc, normalizedProgress) {
    const prev = doc?.progress || {};
    const prevIds = JSON.stringify((Array.isArray(prev.validatedModelIds) ? prev.validatedModelIds : []).map((x) => String(x)));
    const nextIds = JSON.stringify((normalizedProgress.validatedModelIds || []).map((x) => String(x)));
    const modelsMismatch = prevIds !== nextIds || Boolean(prev.modelsCompleted) !== Boolean(normalizedProgress.modelsCompleted);
    const optionsMismatch = Boolean(prev.optionsCompleted) !== Boolean(normalizedProgress.optionsCompleted);
    return modelsMismatch || optionsMismatch;
  }

  static countStagingMinorationOptions(categories) {
    let count = 0;
    (Array.isArray(categories) ? categories : []).forEach((cat) => {
      (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
        if (UgapImportAssignmentService.isMinorationLine(opt?.name, opt?.refUgap)) count += 1;
      });
    });
    return count;
  }

  /**
   * Ancien import : mergeImportedCategories fusionnait toutes les lignes partageant la même réf. UGAP.
   * Ré-extrait le fichier source si encore présent et si des minorations MINO manquent.
   */
  static async repairImportStagingMergedOptionsIfNeeded(db, doc) {
    if (!doc || !doc._id || doc.status === 'published') return doc;
    const filePath = String(doc?.source?.sourceFilePath || '').trim();
    if (!filePath || !fs.existsSync(filePath)) return doc;

    let extracted;
    try {
      extracted = UgapExcelService.extractData(filePath);
    } catch {
      return doc;
    }

    const freshCategories = this.mergeImportedCategories(extracted?.categories || []);
    const freshMino = this.countStagingMinorationOptions(freshCategories);
    const currentMino = this.countStagingMinorationOptions(doc.categories);
    if (freshMino <= currentMino) return doc;

    const freshTotal = freshCategories.reduce((n, cat) => n + (cat.options?.length || 0), 0);
    const currentTotal = (Array.isArray(doc.categories) ? doc.categories : [])
      .reduce((n, cat) => n + (cat.options?.length || 0), 0);
    if (freshTotal <= currentTotal) return doc;

    const collection = db.collection('ugap_import_staging');
    const patch = {
      categories: freshCategories,
      updatedAt: new Date()
    };
    if (Array.isArray(extracted?.models) && extracted.models.length > 0) {
      patch.models = extracted.models;
    }
    await collection.updateOne(
      { _id: doc._id, entrepriseId: doc.entrepriseId },
      { $set: patch }
    );
    return { ...doc, ...patch };
  }

  static async repairImportStagingMinorationsIfNeeded(db, doc) {
    if (!doc || !doc._id || doc.status === 'published') return doc;
    const categories = Array.isArray(doc.categories) ? doc.categories : [];
    const cleared = UgapImportAssignmentService.clearMinorationCrossAssignments(categories, true);
    if (!cleared) return doc;
    const { doc: assignedDoc, summary } = UgapImportAssignmentService.applyStagingAssignments({
      ...doc,
      categories
    });
    const collection = db.collection('ugap_import_staging');
    await collection.updateOne(
      { _id: doc._id, entrepriseId: doc.entrepriseId },
      {
        $set: {
          categories: assignedDoc.categories,
          importAssignmentsSummary: summary,
          importAssignmentsAppliedAt: assignedDoc.importAssignmentsAppliedAt,
          updatedAt: new Date()
        }
      }
    );
    return { ...doc, categories: assignedDoc.categories, importAssignmentsSummary: summary };
  }

  static async repairImportStagingModelProgressIfNeeded(db, doc) {
    if (!doc || !doc._id || doc.status === 'published') return doc;
    let normalized = this.normalizeStagingProgressForModels(doc.models, doc.progress || {});
    normalized = this.coerceStagingProgressOptionsWithDocument(normalized, doc);
    const progressDirty = this._stagingModelProgressOutOfSync(doc, normalized);
    const computed = this.computeStagingStatuses(normalized, doc);
    const statusDirty = String(doc.status || '').toLowerCase() !== computed.status
      || String(doc.modelsStatus || '').toLowerCase() !== computed.modelsStatus;
    if (!progressDirty && !statusDirty) return doc;
    const collection = db.collection('ugap_import_staging');
    const patch = { progress: normalized, updatedAt: new Date() };
    if (!normalized.modelsCompleted) {
      patch.status = 'draft';
      patch.modelsStatus = 'to_validate';
      patch.optionsStatus = 'to_validate';
      patch.baseOptionsStatus = 'to_validate';
      patch.minorationsStatus = 'to_validate';
      patch.majorationsStatus = 'to_validate';
      patch.diversStatus = 'to_validate';
    } else {
      patch.status = computed.status;
      patch.modelsStatus = computed.modelsStatus;
    }
    await collection.updateOne(
      { _id: doc._id, entrepriseId: doc.entrepriseId },
      { $set: patch }
    );
    return { ...doc, ...patch };
  }

  static async saveImportStaging(db, entrepriseId, payload) {
    const collection = db.collection('ugap_import_staging');
    const now = new Date();
    const source = payload?.source || {};
    const sourceFileHash = String(source.sourceFileHash || '').trim();
    const existing = sourceFileHash
      ? await collection.findOne({ entrepriseId, 'source.sourceFileHash': sourceFileHash })
      : null;

    const mergedCategories = this.mergeImportedCategories(payload?.categories || []);
    const document = {
      entrepriseId,
      source: {
        sourceFileName: String(source.sourceFileName || ''),
        sourceFileHash,
        sourceFilePath: String(source.sourceFilePath || ''),
        importedAt: source.importedAt || now
      },
      status: 'draft',
      modelsStatus: 'to_validate',
      optionsStatus: 'to_validate',
      baseOptionsStatus: 'to_validate',
      minorationsStatus: 'to_validate',
      majorationsStatus: 'to_validate',
      diversStatus: 'to_validate',
      models: Array.isArray(payload?.models) ? payload.models : [],
      categories: mergedCategories,
      businessViews: Array.isArray(payload?.businessViews) ? payload.businessViews : [],
      dependencyRules: this.normalizeDependencyRules(payload?.dependencyRules),
      uiState: this.normalizeUiState(payload?.uiState),
      progress: {
        validatedModelIds: [],
        modelsCompleted: false,
        optionsCompleted: false,
        familiesCompleted: false,
        viewsCompleted: false
      },
      updatedAt: now,
      createdAt: now
    };

    if (existing) {
      document.createdAt = existing.createdAt || now;
      // Réimport du même fichier: repartir sur une validation modèles propre
      // pour éviter de réinjecter d'anciens validatedModelIds.
      const prevProgress = {
        ...(existing.progress || {}),
        validatedModelIds: [],
        modelsCompleted: false,
        optionsCompleted: false,
        familiesCompleted: false,
        viewsCompleted: false
      };
      const baseProg = this.normalizeStagingProgressForModels(document.models, prevProgress);
      document.progress = this.coerceStagingProgressOptionsWithDocument(
        baseProg,
        document
      );
      const computed = this.computeStagingStatuses(document.progress, document);
      document.status = computed.status;
      document.modelsStatus = computed.modelsStatus;
      document.optionsStatus = 'to_validate';
      document.baseOptionsStatus = 'to_validate';
      document.minorationsStatus = 'to_validate';
      document.majorationsStatus = 'to_validate';
      document.diversStatus = 'to_validate';
      await collection.updateOne({ _id: existing._id }, { $set: document });
      return { ...document, _id: existing._id, alreadyProcessed: true, alreadyValidated: existing.status === 'validated' || existing.status === 'published' };
    }

    const result = await collection.insertOne(document);
    return { ...document, _id: result.insertedId, alreadyProcessed: false, alreadyValidated: false };
  }

  static async getLatestImportStaging(db, entrepriseId) {
    const collection = db.collection('ugap_import_staging');
    let active = await collection.find({
      entrepriseId,
      status: { $ne: 'published' }
    }).sort({ updatedAt: -1 }).limit(1).next();
    if (active) {
      let repaired = await this.repairImportStagingMergedOptionsIfNeeded(db, active);
      repaired = await this.repairImportStagingMinorationsIfNeeded(db, repaired);
      return await this.repairImportStagingModelProgressIfNeeded(db, repaired);
    }
    const latest = await collection.find({ entrepriseId }).sort({ updatedAt: -1 }).limit(1).next();
    if (!latest) return null;
    let repaired = await this.repairImportStagingMergedOptionsIfNeeded(db, latest);
    repaired = await this.repairImportStagingMinorationsIfNeeded(db, repaired);
    return await this.repairImportStagingModelProgressIfNeeded(db, repaired);
  }

  static getImportStagingDisplayName(doc) {
    const source = doc?.source && typeof doc.source === 'object' ? doc.source : {};
    const displayName = String(source.displayName || '').trim();
    if (displayName) return displayName;
    const fileName = String(source.sourceFileName || '').trim();
    return fileName || 'Sans nom';
  }

  static async listImportStaging(db, entrepriseId) {
    const collection = db.collection('ugap_import_staging');
    const docs = await collection.find(
      { entrepriseId },
      {
        projection: {
          status: 1,
          source: 1,
          progress: 1,
          modelsStatus: 1,
          optionsStatus: 1,
          updatedAt: 1,
          createdAt: 1,
          models: 1
        }
      }
    ).sort({ updatedAt: -1 }).toArray();

    return docs.map((doc) => {
      const models = Array.isArray(doc.models) ? doc.models : [];
      const validatedIds = new Set((doc.progress?.validatedModelIds || []).map((x) => String(x)));
      const validatedModelsCount = models.filter((m) => validatedIds.has(String(m?.id || ''))).length;
      return {
        _id: String(doc._id),
        status: String(doc.status || 'draft'),
        sourceFileName: String(doc.source?.sourceFileName || ''),
        displayName: String(doc.source?.displayName || ''),
        label: this.getImportStagingDisplayName(doc),
        importedAt: doc.source?.importedAt || doc.createdAt || null,
        updatedAt: doc.updatedAt || null,
        modelsCount: models.length,
        validatedModelsCount
      };
    });
  }

  static async updateImportStagingDisplayName(db, entrepriseId, importId, displayName) {
    const label = String(displayName || '').trim();
    if (!label) throw new Error('Nom requis');
    const collection = db.collection('ugap_import_staging');
    const result = await collection.updateOne(
      { _id: new ObjectId(String(importId)), entrepriseId },
      { $set: { 'source.displayName': label, updatedAt: new Date() } }
    );
    if (!result.matchedCount) throw new Error('Import staging introuvable');
    return {
      _id: String(importId),
      displayName: label,
      label
    };
  }

  static async getImportStagingById(db, entrepriseId, importId) {
    if (!importId) return null;
    const collection = db.collection('ugap_import_staging');
    const _id = new ObjectId(String(importId));
    const doc = await collection.findOne({ _id, entrepriseId });
    if (!doc) return null;
    let repaired = await this.repairImportStagingMergedOptionsIfNeeded(db, doc);
    repaired = await this.repairImportStagingMinorationsIfNeeded(db, repaired);
    repaired = await this.repairImportStagingModelProgressIfNeeded(db, repaired);
    return repaired;
  }

  static async markImportModelsValidated(db, entrepriseId, importId, modelIds = [], modelUpdates = []) {
    const collection = db.collection('ugap_import_staging');
    const document = await collection.findOne({ _id: new ObjectId(String(importId)), entrepriseId });
    if (!document) throw new Error('Import staging introuvable');

    const updateMap = new Map(
      (Array.isArray(modelUpdates) ? modelUpdates : [])
        .map((row) => ({
          id: String(row?.id || '').trim(),
          basePrice: Number(row?.basePrice),
          name: row?.name !== undefined && row?.name !== null ? String(row.name).trim() : undefined
        }))
        .filter((row) => row.id)
        .map((row) => [row.id, row])
    );

    const nextModels = (Array.isArray(document.models) ? document.models : []).map((model) => {
      const id = String(model?.id || '').trim();
      if (!id || !updateMap.has(id)) return model;
      const patch = updateMap.get(id);
      const next = { ...model };
      if (Number.isFinite(patch.basePrice)) next.basePrice = Number(patch.basePrice);
      if (patch.name !== undefined) next.name = patch.name || next.name || id;
      return next;
    });

    const allModelIds = new Set((nextModels || []).map((m) => String(m?.id || '').trim()).filter(Boolean));
    const normalizedProgress = this.normalizeStagingProgressForModels(nextModels, document.progress || {});
    const incoming = (Array.isArray(modelIds) ? modelIds : [])
      .map((x) => String(x || '').trim())
      .filter((id) => id && allModelIds.has(id));
    if (!incoming.length) {
      throw new Error('Aucun modele pending selectionne pour validation');
    }
    const mergedValidated = new Set(
      (Array.isArray(normalizedProgress.validatedModelIds) ? normalizedProgress.validatedModelIds : [])
        .map((x) => String(x || '').trim())
        .filter((id) => id && allModelIds.has(id))
    );
    incoming.forEach((id) => mergedValidated.add(id));
    const mergedArray = Array.from(mergedValidated);
    const modelsCompleted = allModelIds.size > 0 && mergedArray.every((id) => allModelIds.has(id))
      && [...allModelIds].every((id) => mergedArray.includes(id));
    const mergedFinal = mergedArray;
    const optionsValidated = String(document.optionsStatus || '').toLowerCase() === 'validated';
    const nextOptionsCompleted = !!(modelsCompleted && optionsValidated);
    const computed = this.computeStagingStatuses(
      { modelsCompleted, optionsCompleted: nextOptionsCompleted },
      { optionsStatus: optionsValidated ? 'validated' : 'to_validate' }
    );
    const setPayload = {
      models: nextModels,
      'progress.validatedModelIds': mergedFinal,
      'progress.modelsCompleted': modelsCompleted,
      'progress.optionsCompleted': nextOptionsCompleted,
      modelsStatus: computed.modelsStatus,
      status: computed.status,
      updatedAt: new Date()
    };
    if (!modelsCompleted) {
      setPayload.optionsStatus = 'to_validate';
      setPayload.baseOptionsStatus = 'to_validate';
      setPayload.minorationsStatus = 'to_validate';
      setPayload.majorationsStatus = 'to_validate';
      setPayload.diversStatus = 'to_validate';
    }

    const draftForAssign = {
      ...document,
      models: nextModels,
      progress: {
        ...(document.progress || {}),
        validatedModelIds: mergedFinal,
        modelsCompleted,
        optionsCompleted: nextOptionsCompleted
      }
    };
    const { doc: assignedDoc, summary } = UgapImportAssignmentService.applyStagingAssignments(draftForAssign);
    setPayload.categories = assignedDoc.categories;
    setPayload.importAssignmentsSummary = summary;
    setPayload.importAssignmentsAppliedAt = assignedDoc.importAssignmentsAppliedAt;

    const updated = await collection.findOneAndUpdate(
      { _id: document._id, entrepriseId },
      { $set: setPayload },
      { returnDocument: 'after' }
    );
    const resultDoc = updated?.value || {
      ...assignedDoc,
      ...setPayload,
      progress: {
        ...(document.progress || {}),
        validatedModelIds: mergedFinal,
        modelsCompleted,
        optionsCompleted: nextOptionsCompleted
      }
    };

    try {
      await this.syncValidatedModelsToPublishedCatalog(
        db,
        entrepriseId,
        resultDoc.models || nextModels,
        mergedFinal
      );
    } catch (syncErr) {
      console.warn('⚠️ UGAP syncValidatedModelsToPublishedCatalog:', syncErr.message || syncErr);
    }

    return resultDoc;
  }

  static normalizeImportBaseProductsRows(baseProducts) {
    return (Array.isArray(baseProducts) ? baseProducts : []).map((row) => {
      const pricesByModelId = {};
      const rawPrices = row?.pricesByModelId && typeof row.pricesByModelId === 'object' ? row.pricesByModelId : {};
      Object.keys(rawPrices).forEach((mid) => {
        const v = Number(rawPrices[mid]);
        if (Number.isFinite(v)) pricesByModelId[String(mid)] = v;
      });
      const priceRaw = row?.price;
      const price = priceRaw === '' || priceRaw == null ? null : Number(priceRaw);
      return {
        id: String(row?.id || '').trim() || `bp_${Date.now()}`,
        key: String(row?.key || '').trim(),
        label: String(row?.label || '').trim(),
        pricingMode: row?.pricingMode === 'per_model' ? 'per_model' : 'fixed',
        price: Number.isFinite(price) ? price : null,
        pricesByModelId,
        optionIds: Array.isArray(row?.optionIds) ? row.optionIds.map((x) => String(x || '').trim()).filter(Boolean) : [],
        modelIds: Array.isArray(row?.modelIds) ? row.modelIds.map((x) => String(x || '').trim()).filter(Boolean) : [],
        aliases: Array.isArray(row?.aliases) ? row.aliases.map((x) => String(x || '').trim()).filter(Boolean) : []
      };
    }).filter((row) => (row.optionIds || []).length > 0);
  }

  static applyImportBaseProductsToCategories(categories, importBaseProducts) {
    const optionToBase = new Map();
    (importBaseProducts || []).forEach((bp) => {
      (bp.optionIds || []).forEach((oid) => optionToBase.set(oid, bp.id));
    });
    (Array.isArray(categories) ? categories : []).forEach((cat) => {
      (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
        const oid = String(opt?.id || '').trim();
        if (opt?.importExcludeFromBaseProduct) {
          delete opt.baseProductId;
          delete opt.baseProductLabel;
          return;
        }
        const bpId = optionToBase.get(oid);
        if (!bpId) {
          delete opt.baseProductId;
          delete opt.baseProductLabel;
          return;
        }
        opt.baseProductId = bpId;
        const bp = importBaseProducts.find((x) => x.id === bpId);
        if (bp?.label) opt.baseProductLabel = bp.label;
        else delete opt.baseProductLabel;
      });
    });
  }

  static async updateImportStagingBaseProducts(db, entrepriseId, importId, baseProducts = []) {
    const collection = db.collection('ugap_import_staging');
    const document = await collection.findOne({ _id: new ObjectId(String(importId)), entrepriseId });
    if (!document) throw new Error('Import staging introuvable');

    const categories = Array.isArray(document.categories) ? document.categories : [];
    const importBaseProducts = this.normalizeImportBaseProductsRows(baseProducts);
    this.applyImportBaseProductsToCategories(categories, importBaseProducts);

    const draft = {
      ...document,
      categories,
      importBaseProducts
    };
    const { doc, summary } = UgapImportAssignmentService.applyStagingAssignments(draft);
    await collection.updateOne(
      { _id: document._id, entrepriseId },
      {
        $set: {
          categories: doc.categories,
          importBaseProducts,
          importAssignmentsSummary: summary,
          importAssignmentsAppliedAt: doc.importAssignmentsAppliedAt,
          baseOptionsStatus: 'validated',
          updatedAt: new Date()
        }
      }
    );
    return await collection.findOne({ _id: document._id, entrepriseId });
  }

  static applyImportOptionLineKindToOption(opt, kind) {
    const k = String(kind || '').trim().toLowerCase();
    if (!opt || typeof opt !== 'object') return;
    if (k !== 'minoration' && k !== 'majoration' && k !== 'option') return;
    opt.importOptionLineKind = k;
    if (k === 'minoration') {
      opt.isMinoration = true;
      opt.manualMinorationAssignment = true;
      delete opt.manualMajorationAssignment;
      return;
    }
    if (k === 'majoration') {
      opt.isMinoration = false;
      opt.manualMajorationAssignment = true;
      delete opt.manualMinorationAssignment;
      return;
    }
    opt.isMinoration = false;
    delete opt.manualMajorationAssignment;
    delete opt.manualMinorationAssignment;
  }

  static async updateImportStagingOptionsTri(db, entrepriseId, importId, updates = []) {
    const collection = db.collection('ugap_import_staging');
    const document = await collection.findOne({ _id: new ObjectId(String(importId)), entrepriseId });
    if (!document) throw new Error('Import staging introuvable');

    const patchByOptionId = new Map();
    (Array.isArray(updates) ? updates : []).forEach((row) => {
      const optionId = String(row?.optionId || '').trim();
      if (!optionId) return;
      const compatibleModels = Array.isArray(row?.compatibleModels)
        ? row.compatibleModels.map((x) => String(x || '').trim()).filter(Boolean)
        : [];
      const importOptionLabel = String(row?.importOptionLabel || '').trim();
      const importOptionLineKind = String(row?.importOptionLineKind || '').trim().toLowerCase();
      const importExcludeFromBaseProduct = row?.importExcludeFromBaseProduct === true;
      patchByOptionId.set(optionId, {
        compatibleModels,
        importOptionLabel,
        importOptionLineKind,
        importExcludeFromBaseProduct
      });
    });

    const categories = Array.isArray(document.categories) ? document.categories : [];
    categories.forEach((cat) => {
      (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
        const id = String(opt?.id || '').trim();
        if (!patchByOptionId.has(id)) return;
        const patch = patchByOptionId.get(id);
        opt.compatibleModels = Array.isArray(patch.compatibleModels) ? patch.compatibleModels : [];
        const label = String(patch.importOptionLabel || '').trim();
        if (label) opt.importOptionLabel = label;
        else delete opt.importOptionLabel;
        if (patch.importExcludeFromBaseProduct) {
          opt.importExcludeFromBaseProduct = true;
          delete opt.baseProductId;
          delete opt.baseProductLabel;
        }
        if (patch.importOptionLineKind) {
          this.applyImportOptionLineKindToOption(opt, patch.importOptionLineKind);
        }
      });
    });

    const draft = {
      ...document,
      categories,
      importBaseProducts: document.importBaseProducts || []
    };
    const { doc, summary } = UgapImportAssignmentService.applyStagingAssignments(draft);
    await collection.updateOne(
      { _id: document._id, entrepriseId },
      {
        $set: {
          categories: doc.categories,
          importAssignmentsSummary: summary,
          importAssignmentsAppliedAt: doc.importAssignmentsAppliedAt,
          'progress.optionsTriCompleted': true,
          updatedAt: new Date()
        }
      }
    );
    return await collection.findOne({ _id: document._id, entrepriseId });
  }

  static async updateImportStagingMinorations(db, entrepriseId, importId, updates = [], baseProducts, scope = 'minoration') {
    const collection = db.collection('ugap_import_staging');
    const document = await collection.findOne({ _id: new ObjectId(String(importId)), entrepriseId });
    if (!document) throw new Error('Import staging introuvable');
    const assignScope = String(scope || 'minoration').toLowerCase() === 'majoration' ? 'majoration' : 'minoration';

    const patchByOptionId = new Map();
    (Array.isArray(updates) ? updates : []).forEach((row) => {
      const optionId = String(row?.optionId || '').trim();
      if (!optionId) return;
      const compatibleModels = Array.isArray(row?.compatibleModels)
        ? row.compatibleModels.map((x) => String(x || '').trim()).filter(Boolean)
        : [];
      const importOptionLabel = String(row?.importOptionLabel || '').trim();
      const importOptionLineKind = String(row?.importOptionLineKind || '').trim().toLowerCase();
      const importExcludeFromBaseProduct = row?.importExcludeFromBaseProduct === true;
      patchByOptionId.set(optionId, { compatibleModels, importOptionLabel, importOptionLineKind, importExcludeFromBaseProduct });
    });

    const categories = Array.isArray(document.categories) ? document.categories : [];
    categories.forEach((cat) => {
      const opts = Array.isArray(cat?.options) ? cat.options : [];
      opts.forEach((opt) => {
        const id = String(opt?.id || '').trim();
        if (!patchByOptionId.has(id)) return;
        const patch = patchByOptionId.get(id);
        if (Array.isArray(patch)) {
          opt.compatibleModels = patch;
        } else if (patch && typeof patch === 'object') {
          opt.compatibleModels = Array.isArray(patch.compatibleModels) ? patch.compatibleModels : [];
          const label = String(patch.importOptionLabel || '').trim();
          if (label) opt.importOptionLabel = label;
          else delete opt.importOptionLabel;
          if (patch.importExcludeFromBaseProduct) {
            opt.importExcludeFromBaseProduct = true;
            delete opt.baseProductId;
            delete opt.baseProductLabel;
          }
          if (patch.importOptionLineKind) {
            UgapDataService.applyImportOptionLineKindToOption(opt, patch.importOptionLineKind);
          }
        }
        if (assignScope === 'minoration' && UgapImportAssignmentService.isMinorationLine(opt?.name, opt?.refUgap)) {
          opt.isMinoration = true;
          opt.manualMinorationAssignment = true;
        }
        if (assignScope === 'majoration' && UgapImportAssignmentService.isMajorationLine(opt?.name, opt?.refUgap)) {
          opt.manualMajorationAssignment = true;
        }
      });
    });

    let importBaseProducts = document.importBaseProducts;
    if (Array.isArray(baseProducts)) {
      importBaseProducts = this.normalizeImportBaseProductsRows(baseProducts);
      this.applyImportBaseProductsToCategories(categories, importBaseProducts);
    }

    const draft = {
      ...document,
      categories,
      importBaseProducts: importBaseProducts || document.importBaseProducts || []
    };
    const { doc, summary } = UgapImportAssignmentService.applyStagingAssignments(draft);
    const $set = {
      categories: doc.categories,
      importAssignmentsSummary: summary,
      importAssignmentsAppliedAt: doc.importAssignmentsAppliedAt,
      updatedAt: new Date()
    };
    if (assignScope === 'majoration') {
      $set.majorationsStatus = 'validated';
    } else {
      $set.minorationsStatus = 'validated';
    }
    if (Array.isArray(baseProducts)) {
      $set.importBaseProducts = draft.importBaseProducts;
      $set.baseOptionsStatus = 'validated';
    }
    await collection.updateOne(
      { _id: document._id, entrepriseId },
      { $set }
    );
    return await collection.findOne({ _id: document._id, entrepriseId });
  }

  static async applyImportStagingAssignments(db, entrepriseId, importId) {
    const collection = db.collection('ugap_import_staging');
    const document = await collection.findOne({ _id: new ObjectId(String(importId)), entrepriseId });
    if (!document) throw new Error('Import staging introuvable');
    UgapImportAssignmentService.clearMinorationCrossAssignments(document.categories, true);
    const { doc, summary } = UgapImportAssignmentService.applyStagingAssignments(document);
    await collection.updateOne(
      { _id: document._id, entrepriseId },
      {
        $set: {
          categories: doc.categories,
          importAssignmentsSummary: summary,
          importAssignmentsAppliedAt: doc.importAssignmentsAppliedAt,
          updatedAt: new Date()
        }
      }
    );
    return await collection.findOne({ _id: document._id, entrepriseId });
  }

  static async markImportOptionsValidated(db, entrepriseId, importId) {
    const collection = db.collection('ugap_import_staging');
    const _id = new ObjectId(String(importId));
    const before = await collection.findOne({ _id, entrepriseId });
    if (!before) throw new Error('Import staging introuvable');
    if (!before.progress?.modelsCompleted) {
      throw new Error('Validez tous les modèles avant de valider les options');
    }
    await collection.updateOne(
      { _id, entrepriseId },
      {
        $set: {
          optionsStatus: 'validated',
          minorationsStatus: 'validated',
          majorationsStatus: 'validated',
          diversStatus: 'validated',
          'progress.optionsCompleted': true,
          status: 'validated',
          updatedAt: new Date()
        }
      }
    );
    const doc = await collection.findOne({ _id, entrepriseId });
    if (!doc) throw new Error('Import staging introuvable');
    return doc;
  }

  static async publishImportStaging(db, entrepriseId, importId) {
    const collection = db.collection('ugap_import_staging');
    const _id = new ObjectId(String(importId));
    let doc = await collection.findOne({ _id, entrepriseId });
    if (!doc) throw new Error('Import staging introuvable');
    const { doc: assignedDoc } = UgapImportAssignmentService.applyStagingAssignments(doc);
    doc = assignedDoc;
    await collection.updateOne(
      { _id, entrepriseId },
      {
        $set: {
          categories: doc.categories,
          importAssignmentsSummary: doc.importAssignmentsSummary,
          importAssignmentsAppliedAt: doc.importAssignmentsAppliedAt,
          updatedAt: new Date()
        }
      }
    );
    const payload = {
      models: doc.models || [],
      categories: doc.categories || [],
      businessViews: doc.businessViews || [],
      dependencyRules: doc.dependencyRules || [],
      uiState: doc.uiState || {}
    };
    await this.saveData(db, payload, entrepriseId);
    await collection.updateOne(
      { _id, entrepriseId },
      {
        $set: {
          status: 'published',
          'progress.viewsCompleted': true,
          updatedAt: new Date(),
          publishedAt: new Date()
        }
      }
    );
    return await collection.findOne({ _id, entrepriseId });
  }
}

module.exports = UgapDataService;
