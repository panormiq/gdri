const path = require('path');
const fs = require('fs');
const { ObjectId } = require('mongodb');
const UgapDataService = require('../services/UgapDataService');
const UgapExcelService = require('../services/UgapExcelService');
const UgapAIService = require('../services/UgapAIService');
const WebSearchSimulator = require('../services/WebSearchSimulator');
const UgapPdfService = require('../services/UgapPdfService');
const ExcelExtractionTester = require('../services/ExcelExtractionTester');
const PdfToExcelConverter = require('../services/PdfToExcelConverter');
const XLSX = require('xlsx');
const { detectTablesFromWorksheet } = require('../services/ExcelTableDetector');
const crypto = require('crypto');

async function getData(req, res) {
  try {
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      // Retourner 200 avec success: false pour que le frontend puisse gérer gracieusement
      return res.json({ 
        success: false, 
        message: 'Aucune donnée configurée',
        data: {
          models: [],
          categories: []
        }
      });
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ UGAP getData error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function importExcel(req, res) {
  try {
    const filePath = path.join(__dirname, '../../source/TARIF ALU UGAP 2024(6).xlsx');
    const extractedData = UgapExcelService.extractData(filePath);
    const sourceBuffer = fs.readFileSync(filePath);
    const sourceFileHash = crypto.createHash('sha256').update(sourceBuffer).digest('hex');

    // Fallback IA uniquement pour les modèles incomplets/ambiguës
    const aiService = new UgapAIService(req.entrepriseDb, req.entrepriseId);
    for (const model of extractedData.models || []) {
      const needsFallback =
        !model?.posteNumber ||
        !String(model?.motorizationBase || '').trim() ||
        /\bposte\b/i.test(String(model?.name || ''));

      if (!needsFallback) continue;

      const fallbackLabel = String(model?.baseLabel || '').trim();
      if (!fallbackLabel) continue;

      const parsed = await aiService.parseBaseModelLabelFallback(fallbackLabel);
      if (parsed.modelName) model.name = parsed.modelName;
      if (parsed.motorizationBase) model.motorizationBase = parsed.motorizationBase;
      if (Number.isFinite(parsed.posteNumber)) model.posteNumber = parsed.posteNumber;
      if (parsed.deliveryMode) model.defaultDeliveryMode = parsed.deliveryMode;
    }

    // Enrichissement IA des lignes "option de base" (produit initial/final)
    const allOptions = (extractedData.categories || []).flatMap((cat) => cat.options || []);
    const baseLikeOptions = allOptions.filter((opt) => {
      const s = String(opt?.name || '').toLowerCase();
      if (!s) return false;
      return (
        /\ben\s+remplacement\b/.test(s) ||
        /\ben\s+lieu\s+et\s+place\b/.test(s) ||
        /\bau\s+lieu\s+et\s+place\b/.test(s) ||
        /\bnon\s+fourniture\b/.test(s) ||
        /^(moins-value|plus-value|plus\s+value)\b/.test(s)
      );
    });

    if (baseLikeOptions.length > 0) {
      try {
        const aiRows = await aiService.extractBaseReplacementProducts(baseLikeOptions);
        const byId = new Map((aiRows || []).map((r) => [String(r.id || '').trim(), r]));
        const minConfidence = Number(process.env.UGAP_BASE_REPL_AI_MIN_CONFIDENCE || 0.55);

        (extractedData.categories || []).forEach((cat) => {
          (cat.options || []).forEach((opt) => {
            const ai = byId.get(String(opt.id || '').trim());
            if (!ai) return;
            if ((ai.confidence || 0) < minConfidence) return;
            if (ai.changeType) opt.changeType = ai.changeType;
            if (ai.initialProduct) opt.initialProduct = ai.initialProduct;
            if (ai.finalProduct) opt.finalProduct = ai.finalProduct;
          });
        });
      } catch (aiErr) {
        console.warn('⚠️ UGAP importExcel: enrichissement IA options de base ignoré:', aiErr.message || aiErr);
      }
    }

    const staging = await UgapDataService.saveImportStaging(req.entrepriseDb, req.entrepriseId, {
      ...extractedData,
      source: {
        sourceFileName: path.basename(filePath),
        sourceFileHash,
        sourceFilePath: filePath,
        importedAt: new Date()
      }
    });
    
    res.json({
      success: true,
      message: 'Import en zone tampon réussi',
      data: {
        importId: String(staging._id),
        status: staging.status,
        alreadyProcessed: !!staging.alreadyProcessed,
        alreadyValidated: !!staging.alreadyValidated,
        modelsCount: extractedData.models.length,
        categoriesCount: extractedData.categories.length,
        optionsCount: extractedData.categories.reduce((sum, cat) => sum + (cat.options?.length || 0), 0)
      }
    });
  } catch (error) {
    console.error('❌ UGAP importExcel error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getImportStaging(req, res) {
  try {
    const importId = String(req.query?.importId || '').trim();
    const data = importId
      ? await UgapDataService.getImportStagingById(req.entrepriseDb, req.entrepriseId, importId)
      : await UgapDataService.getLatestImportStaging(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      return res.json({ success: true, data: null, message: 'Aucun import en zone tampon' });
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ UGAP getImportStaging error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function listImportStaging(req, res) {
  try {
    const items = await UgapDataService.listImportStaging(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('❌ UGAP listImportStaging error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function renameImportStaging(req, res) {
  try {
    const { importId } = req.params;
    const displayName = String(req.body?.displayName || '').trim();
    const data = await UgapDataService.updateImportStagingDisplayName(
      req.entrepriseDb,
      req.entrepriseId,
      importId,
      displayName
    );
    res.json({ success: true, message: 'Nom mis à jour', data });
  } catch (error) {
    console.error('❌ UGAP renameImportStaging error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function validateImportModels(req, res) {
  try {
    const { importId } = req.params;
    const modelIds = Array.isArray(req.body?.modelIds) ? req.body.modelIds : [];
    const modelUpdates = Array.isArray(req.body?.modelUpdates) ? req.body.modelUpdates : [];
    const data = await UgapDataService.markImportModelsValidated(
      req.entrepriseDb,
      req.entrepriseId,
      importId,
      modelIds,
      modelUpdates
    );
    res.json({ success: true, message: 'Validation modèles mise à jour', data });
  } catch (error) {
    console.error('❌ UGAP validateImportModels error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function validateImportOptions(req, res) {
  try {
    const { importId } = req.params;
    const data = await UgapDataService.markImportOptionsValidated(
      req.entrepriseDb,
      req.entrepriseId,
      importId
    );
    res.json({ success: true, message: 'Validation options/minorations/divers mise à jour', data });
  } catch (error) {
    console.error('❌ UGAP validateImportOptions error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function applyImportAssignments(req, res) {
  try {
    const { importId } = req.params;
    const data = await UgapDataService.applyImportStagingAssignments(
      req.entrepriseDb,
      req.entrepriseId,
      importId
    );
    res.json({ success: true, message: 'Assignations import appliquees', data });
  } catch (error) {
    console.error('❌ UGAP applyImportAssignments error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function updateImportMinorations(req, res) {
  try {
    const { importId } = req.params;
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    const baseProducts = Array.isArray(req.body?.baseProducts) ? req.body.baseProducts : undefined;
    const data = await UgapDataService.updateImportStagingMinorations(
      req.entrepriseDb,
      req.entrepriseId,
      importId,
      updates,
      baseProducts
    );
    res.json({ success: true, message: 'Minorations mises à jour', data });
  } catch (error) {
    console.error('❌ UGAP updateImportMinorations error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function updateImportMajorations(req, res) {
  try {
    const { importId } = req.params;
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    const baseProducts = Array.isArray(req.body?.baseProducts) ? req.body.baseProducts : undefined;
    const data = await UgapDataService.updateImportStagingMinorations(
      req.entrepriseDb,
      req.entrepriseId,
      importId,
      updates,
      baseProducts,
      'majoration'
    );
    res.json({ success: true, message: 'Majorations mises à jour', data });
  } catch (error) {
    console.error('❌ UGAP updateImportMajorations error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function updateImportOptionsTri(req, res) {
  try {
    const { importId } = req.params;
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    const data = await UgapDataService.updateImportStagingOptionsTri(
      req.entrepriseDb,
      req.entrepriseId,
      importId,
      updates
    );
    res.json({ success: true, message: 'Options (types et postes) mises à jour', data });
  } catch (error) {
    console.error('❌ UGAP updateImportOptionsTri error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function updateImportBaseProducts(req, res) {
  try {
    const { importId } = req.params;
    const baseProducts = Array.isArray(req.body?.baseProducts) ? req.body.baseProducts : [];
    const data = await UgapDataService.updateImportStagingBaseProducts(
      req.entrepriseDb,
      req.entrepriseId,
      importId,
      baseProducts
    );
    res.json({ success: true, message: 'Options de base mises à jour', data });
  } catch (error) {
    console.error('❌ UGAP updateImportBaseProducts error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function publishImport(req, res) {
  try {
    const { importId } = req.params;
    const data = await UgapDataService.publishImportStaging(
      req.entrepriseDb,
      req.entrepriseId,
      importId
    );
    res.json({ success: true, message: 'Import publié dans le catalogue UGAP', data });
  } catch (error) {
    console.error('❌ UGAP publishImport error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getImportAudit(req, res) {
  try {
    const filePath = path.join(__dirname, '../../source/TARIF ALU UGAP 2024(6).xlsx');
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    const audit = UgapExcelService.buildImportAudit(filePath, data || null);
    res.json({ success: true, data: audit });
  } catch (error) {
    console.error('❌ UGAP getImportAudit error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function reintegrateImportAuditLine(req, res) {
  try {
    const filePath = path.join(__dirname, '../../source/TARIF ALU UGAP 2024(6).xlsx');
    const { modelId, rowIndex } = req.body || {};
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Aucune donnee UGAP a mettre a jour' });
    }

    const result = UgapExcelService.reintegrateExcludedRow(filePath, data, { modelId, rowIndex });
    await UgapDataService.saveData(req.entrepriseDb, data, req.entrepriseId);

    res.json({
      success: true,
      message: 'Ligne reintegree',
      data: result
    });
  } catch (error) {
    console.error('❌ UGAP reintegrateImportAuditLine error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getModels(req, res) {
  try {
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Aucune donnée configurée' });
    }
    res.json({ success: true, data: data.models || [] });
  } catch (error) {
    console.error('❌ UGAP getModels error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getCategories(req, res) {
  try {
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Aucune donnée configurée' });
    }
    res.json({ success: true, data: data.categories || [] });
  } catch (error) {
    console.error('❌ UGAP getCategories error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getUiState(req, res) {
  try {
    const data = await UgapDataService.getUiState(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ UGAP getUiState error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function updateUiState(req, res) {
  try {
    const updates = req.body || {};
    const data = await UgapDataService.updateUiState(req.entrepriseDb, req.entrepriseId, updates);
    res.json({ success: true, data, message: 'Etat UI UGAP mis à jour' });
  } catch (error) {
    console.error('❌ UGAP updateUiState error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function generateDevis(req, res) {
  try {
    const { modelId, configId, selectedOptions, use5Percent } = req.body;
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Aucune donnée configurée' });
    }
    const model = data.models.find(m => m.id === modelId);
    if (!model) {
      return res.status(404).json({ success: false, message: 'Modèle non trouvé' });
    }
    const requestedOptionIds = Array.isArray(selectedOptions)
      ? selectedOptions.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    const selectedSet = new Set(requestedOptionIds);
    const dependencyRules = Array.isArray(data?.dependencyRules) ? data.dependencyRules : [];
    let changed = true;
    while (changed) {
      changed = false;
      dependencyRules.forEach((rule) => {
        const triggerOptionId = String(rule?.triggerOptionId || '').trim();
        if (!triggerOptionId || !selectedSet.has(triggerOptionId)) return;
        const autoSelectIds = Array.isArray(rule?.autoSelectOptionIds) ? rule.autoSelectOptionIds : [];
        autoSelectIds.forEach((id) => {
          const normalizedId = String(id || '').trim();
          if (!normalizedId || selectedSet.has(normalizedId)) return;
          selectedSet.add(normalizedId);
          changed = true;
        });
      });
    }

    let total = model.basePrice || 0;
    const selectedOptionsData = [];
    const selectedOptionIds = Array.from(selectedSet);
    selectedOptionIds.forEach(optionId => {
      for (const category of data.categories) {
        const option = category.options.find(o => o.id === optionId);
        if (option) {
          selectedOptionsData.push(option);
          total += option.priceClient || option.priceUgap || 0;
          break;
        }
      }
    });

    const violations = [];
    (data.categories || []).forEach((category) => {
      const rules = category?.selectionRules || {};
      const categoryOptionIds = new Set((category?.options || []).map((opt) => String(opt?.id || '').trim()).filter(Boolean));
      const selectedInCategory = selectedOptionIds.filter((id) => categoryOptionIds.has(id));
      if (rules?.unique && selectedInCategory.length > 1) {
        violations.push(`Catégorie "${category?.name || category?.id}": choix unique violé (${selectedInCategory.length} options sélectionnées).`);
      }
      if (rules?.required && selectedInCategory.length === 0) {
        violations.push(`Catégorie "${category?.name || category?.id}": au moins une option est obligatoire.`);
      }
    });

    if (violations.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation des règles catégorie échouée',
        data: { violations }
      });
    }

    const budget5Percent = use5Percent ? total * 0.05 : 0;
    res.json({
      success: true,
      data: {
        model,
        configId,
        requestedOptionIds,
        autoSelectedOptionIds: selectedOptionIds.filter((id) => !requestedOptionIds.includes(id)),
        appliedDependencyRules: dependencyRules.filter((rule) => selectedOptionIds.includes(String(rule?.triggerOptionId || '').trim())),
        selectedOptions: selectedOptionsData,
        subtotal: total,
        budget5Percent,
        total: total + budget5Percent
      }
    });
  } catch (error) {
    console.error('❌ UGAP generateDevis error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function createCategory(req, res) {
  try {
    const { name } = req.body;
    const categoryId = await UgapDataService.createCategory(req.entrepriseDb, req.entrepriseId, name);
    res.json({ success: true, data: { id: categoryId, name } });
  } catch (error) {
    console.error('❌ UGAP createCategory error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function updateCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const updates = req.body;
    await UgapDataService.updateCategory(req.entrepriseDb, req.entrepriseId, categoryId, updates);
    res.json({ success: true, message: 'Catégorie mise à jour' });
  } catch (error) {
    console.error('❌ UGAP updateCategory error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function reorderCategories(req, res) {
  try {
    const { orderedCategoryIds } = req.body || {};
    if (!Array.isArray(orderedCategoryIds) || orderedCategoryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'orderedCategoryIds doit être un tableau non vide'
      });
    }

    await UgapDataService.reorderCategories(req.entrepriseDb, req.entrepriseId, orderedCategoryIds);
    res.json({ success: true, message: 'Ordre des catégories mis à jour' });
  } catch (error) {
    console.error('❌ UGAP reorderCategories error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function deleteCategory(req, res) {
  try {
    const { categoryId } = req.params;
    await UgapDataService.deleteCategory(req.entrepriseDb, req.entrepriseId, categoryId);
    res.json({ success: true, message: 'Catégorie supprimée' });
  } catch (error) {
    console.error('❌ UGAP deleteCategory error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function clearAllCategories(req, res) {
  try {
    const summary = await UgapDataService.clearAllCategories(req.entrepriseDb, req.entrepriseId);
    res.json({
      success: true,
      message: 'Catégories réinitialisées',
      data: summary
    });
  } catch (error) {
    console.error('❌ UGAP clearAllCategories error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function purgePublishedData(req, res) {
  try {
    const summary = await UgapDataService.purgePublishedData(req.entrepriseDb, req.entrepriseId);
    res.json({
      success: true,
      message: summary.deleted ? 'Données publiées UGAP purgées' : 'Aucune donnée publiée à purger',
      data: summary
    });
  } catch (error) {
    console.error('❌ UGAP purgePublishedData error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

// Clear uniquement le mapping (catégories détectées) d'une configuration (vue "Voir résultats")
async function clearConfigurationMappedCategories(req, res) {
  try {
    const { modelId, configId } = req.params;
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    const model = (data.models || []).find(m => m.id === modelId);
    const config = model?.configurations?.find(c => c.id === configId);

    if (!model || !config) {
      return res.status(404).json({ success: false, message: 'Modèle ou configuration introuvable' });
    }

    const existingPdfAnalysis = config.pdfAnalysis || {};

    const clearedMapped = {
      categories: [],
      stats: { totalCategories: 0, totalItems: 0, totalSubCategories: 0 }
    };

    await UgapDataService.updateModelConfiguration(
      req.entrepriseDb,
      req.entrepriseId,
      modelId,
      configId,
      {
        pdfAnalysis: {
          ...existingPdfAnalysis,
          mapped: clearedMapped,
          mappedAt: null,
          mappedJsonPath: null,
          mappedYamlPath: null
        }
      }
    );

    res.json({ success: true, message: 'Mapping réinitialisé', data: { mapped: clearedMapped } });
  } catch (error) {
    console.error('❌ UGAP clearConfigurationMappedCategories error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function createSubCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const { name, description, optionIds } = req.body;
    console.log(`📥 createSubCategory: name=${name}, description=${description}, optionIds=${JSON.stringify(optionIds)}`);
    const subCategoryId = await UgapDataService.createSubCategory(req.entrepriseDb, req.entrepriseId, categoryId, { 
      name, 
      description, 
      optionIds: optionIds || [] 
    });
    console.log(`✅ createSubCategory: Sous-catégorie créée avec ID ${subCategoryId}`);
    res.json({ success: true, data: { id: subCategoryId, name, description, optionIds: optionIds || [] } });
  } catch (error) {
    console.error('❌ UGAP createSubCategory error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function updateSubCategory(req, res) {
  try {
    const { categoryId, subCategoryId } = req.params;
    const updates = req.body;
    await UgapDataService.updateSubCategory(req.entrepriseDb, req.entrepriseId, categoryId, subCategoryId, updates);
    res.json({ success: true, message: 'Sous-catégorie mise à jour' });
  } catch (error) {
    console.error('❌ UGAP updateSubCategory error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function deleteSubCategory(req, res) {
  try {
    const { categoryId, subCategoryId } = req.params;
    await UgapDataService.deleteSubCategory(req.entrepriseDb, req.entrepriseId, categoryId, subCategoryId);
    res.json({ success: true, message: 'Sous-catégorie supprimée' });
  } catch (error) {
    console.error('❌ UGAP deleteSubCategory error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function updateOption(req, res) {
  try {
    const { optionId } = req.params;
    const updates = req.body;
    await UgapDataService.updateOption(req.entrepriseDb, req.entrepriseId, optionId, updates);
    res.json({ success: true, message: 'Option mise à jour' });
  } catch (error) {
    console.error('❌ UGAP updateOption error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function createOption(req, res) {
  try {
    const {
      categoryId,
      id,
      name,
      refUgap,
      baseRefUgap,
      compatibleModels,
      familyLabel,
      subFamily,
      baseIncludedPrice,
      priceUgap
    } = req.body || {};

    if (!id || !name) {
      return res.status(400).json({
        success: false,
        message: 'id et name sont requis'
      });
    }

    await UgapDataService.createOption(
      req.entrepriseDb,
      req.entrepriseId,
      categoryId,
      {
        id,
        name,
        refUgap,
        baseRefUgap,
        compatibleModels,
        familyLabel,
        subFamily,
        baseIncludedPrice,
        priceUgap
      }
    );

    res.json({ success: true, message: 'Option créée' });
  } catch (error) {
    console.error('❌ UGAP createOption error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function deleteOption(req, res) {
  try {
    const { optionId } = req.params;
    if (!optionId) {
      return res.status(400).json({ success: false, message: 'optionId requis' });
    }
    await UgapDataService.deleteOption(req.entrepriseDb, req.entrepriseId, optionId);
    res.json({ success: true, message: 'Option supprimée' });
  } catch (error) {
    console.error('❌ UGAP deleteOption error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function assignOptionsFamiliesBulk(req, res) {
  try {
    const assignments = Array.isArray(req.body?.assignments) ? req.body.assignments : [];
    if (!assignments.length) {
      return res.status(400).json({ success: false, message: 'assignments requis (tableau non vide)' });
    }
    const { updatedCount, updatedOptionIds } = await UgapDataService.assignOptionsFamiliesBulk(
      req.entrepriseDb,
      req.entrepriseId,
      assignments
    );
    res.json({ success: true, data: { updatedCount, updatedOptionIds } });
  } catch (error) {
    console.error('❌ UGAP assignOptionsFamiliesBulk error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function moveOptionToCategory(req, res) {
  try {
    const { fromCategoryId, optionId } = req.params;
    const { toCategoryId, toSubCategoryId } = req.body || {};

    if (!fromCategoryId || !optionId || !toCategoryId) {
      return res.status(400).json({
        success: false,
        message: 'fromCategoryId, optionId et toCategoryId sont requis'
      });
    }

    await UgapDataService.moveOptionToCategory(
      req.entrepriseDb,
      req.entrepriseId,
      fromCategoryId,
      optionId,
      toCategoryId,
      toSubCategoryId
    );

    res.json({ success: true, message: 'Option déplacée' });
  } catch (error) {
    console.error('❌ UGAP moveOptionToCategory error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function improveCategorization(req, res) {
  try {
    const useSSE = req.headers.accept && req.headers.accept.includes('text/event-stream');
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Aucune donnée configurée' });
    }
    const allOptions = data.categories.flatMap(cat => cat.options || []);
    
    if (useSSE) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      res.write(': connected\n\n');
      if (res.flush) res.flush();
      
      let isClosed = false;
      req.on('close', () => { isClosed = true; });
      
      const sendEvent = (event, data) => {
        if (isClosed) return;
        try {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          if (res.flush) res.flush();
        } catch (e) {
          isClosed = true;
        }
      };
      
      const keepAlive = setInterval(() => {
        if (isClosed) {
          clearInterval(keepAlive);
          return;
        }
        res.write(': keepalive\n\n');
        if (res.flush) res.flush();
      }, 3000);
      
      const progressCallback = (progress) => {
        if (isClosed) return;
        if (progress.type === 'stream' && progress.streamChunk) {
          sendEvent('stream', { chunk: progress.streamChunk });
          return;
        }
        sendEvent('progress', {
          message: progress.message || '',
          type: progress.type || 'info',
          partialData: progress.partialData,
          isPartial: progress.isPartial,
          isFinal: progress.isFinal
        });
      };
      
      try {
        const aiService = new UgapAIService(req.entrepriseDb, req.entrepriseId, progressCallback);
        const improvements = await aiService.improveCategorization(allOptions);
        clearInterval(keepAlive);
        sendEvent('done', { success: true, message: `${improvements.length} catégorisation(s) améliorée(s)`, data: improvements });
        res.end();
      } catch (error) {
        clearInterval(keepAlive);
        sendEvent('error', { message: error.message || 'Erreur serveur' });
        res.end();
      }
    } else {
      const aiService = new UgapAIService(req.entrepriseDb, req.entrepriseId);
      const improvements = await aiService.improveCategorization(allOptions);
      res.json({ success: true, data: improvements });
    }
  } catch (error) {
    console.error('❌ UGAP improveCategorization error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getPrompts(req, res) {
  try {
    const prompts = await UgapDataService.getPrompts(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data: prompts });
  } catch (error) {
    console.error('❌ UGAP getPrompts error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function updatePrompts(req, res) {
  try {
    const {
      subCategoryPrompt,
      categorizationPrompt,
      minorationPrompt,
      famillePrompt,
      assignationPrompt,
      familleContext,
      subCategoryLlmId,
      categorizationLlmId,
      minorationLlmId,
      familleLlmId,
      assignationLlmId
    } = req.body;
    await UgapDataService.updatePrompts(req.entrepriseDb, req.entrepriseId, {
      subCategoryPrompt,
      categorizationPrompt,
      minorationPrompt,
      famillePrompt,
      assignationPrompt,
      familleContext,
      subCategoryLlmId,
      categorizationLlmId,
      minorationLlmId,
      familleLlmId,
      assignationLlmId
    });
    res.json({ success: true, message: 'Prompts mis à jour' });
  } catch (error) {
    console.error('❌ UGAP updatePrompts error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function resetPrompts(req, res) {
  try {
    const prompts = await UgapDataService.resetPrompts(req.entrepriseDb, req.entrepriseId);
    res.json({ success: true, data: prompts, message: 'Prompts réinitialisés' });
  } catch (error) {
    console.error('❌ UGAP resetPrompts error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getIaContext(req, res) {
  try {
    const iaModule = require(path.join(__dirname, '../../../ia/backend'));
    const database = require(path.join(__dirname, '../../../../backend/config/database'));

    const entityId = req.entrepriseId ? String(req.entrepriseId) : '';
    const userId = String(req.user?.user_id || req.user?.sub || req.user?._id || '').trim();
    const userRole = String(req.user?.role || '').trim();
    const isAdmin = userRole === 'ADMIN_ENTITY' || userRole === 'ADMIN_GDRI';

    const entityClient = entityId ? await iaModule.getIAClientForEntity(entityId) : null;
    const globalClient = iaModule.getIAClient({ timeout: 600000 });
    const client = entityClient || globalClient;
    const cfg = await client._getEffectiveConfig({});

    const llmDoc = entityId ? await iaModule.getLLMConfigForEntity(entityId) : null;
    const promptsDoc = await UgapDataService.getPrompts(req.entrepriseDb, req.entrepriseId);

    let serverName = null;
    if (llmDoc && llmDoc.server_id) {
      try {
        const serversCol = database.getCollection('ia_servers');
        const sid = llmDoc.server_id;
        const oid = typeof sid === 'string' ? new ObjectId(sid) : sid;
        const serverDoc = await serversCol.findOne({ _id: oid });
        if (serverDoc) serverName = serverDoc.name || null;
      } catch (e) {
        /* ignore */
      }
    }

    let endpointSummary = '';
    if (cfg.provider === 'ollama_server' && cfg.serverUrl) {
      endpointSummary = `Proxy serveur IA : ${cfg.serverUrl}`;
    } else if (cfg.provider === 'openai') {
      endpointSummary = 'API OpenAI';
    } else if (cfg.provider === 'anthropic') {
      endpointSummary = 'API Anthropic';
    } else if (cfg.provider === 'deepseek') {
      endpointSummary = 'API DeepSeek';
    } else if (cfg.ollamaUrl) {
      endpointSummary = `Ollama : ${cfg.ollamaUrl}`;
    } else {
      endpointSummary = '—';
    }

    const llmsCol = database.getCollection('ia_llms');
    const userRightsCol = database.getCollection('ia_llm_user_rights');
    const roleRightsCol = database.getCollection('ia_llm_role_rights');
    const serversCol = database.getCollection('ia_servers');

    const allLlms = await llmsCol
      .find({ entity_id: entityId })
      .project({ _id: 1, name: 1, model: 1, provider: 1, is_default: 1, server_id: 1 })
      .sort({ created_at: -1 })
      .toArray();

    let allowedLlmIds = null; // null = pas de restriction explicite
    if (!isAdmin) {
      const [userRights, roleRights] = await Promise.all([
        userId ? userRightsCol.findOne({ entity_id: entityId, user_id: userId }) : null,
        userRole ? roleRightsCol.findOne({ entity_id: entityId, role_id: userRole }) : null
      ]);
      const userIds = (userRights?.llm_ids || []).map((x) => String(x));
      const roleIds = (roleRights?.llm_ids || []).map((x) => String(x));
      const union = new Set([...userIds, ...roleIds]);
      if (union.size > 0) {
        allowedLlmIds = union;
      }
    }

    const visibleLlms = (allowedLlmIds
      ? allLlms.filter((l) => allowedLlmIds.has(String(l._id)))
      : allLlms
    ).map((l) => ({
      id: String(l._id),
      name: l.name || '',
      model: l.model || '',
      provider: l.provider || '',
      is_default: !!l.is_default,
      serverId: l.server_id ? String(l.server_id) : ''
    }));

    const serverIds = Array.from(new Set(visibleLlms.map((l) => l.serverId).filter(Boolean)));
    const serversMap = new Map();
    if (serverIds.length > 0) {
      const serverOids = serverIds.map((id) => {
        try { return new ObjectId(id); } catch (_) { return null; }
      }).filter(Boolean);
      const serverDocs = await serversCol
        .find({ _id: { $in: serverOids } })
        .project({ _id: 1, name: 1, provider: 1, scope: 1 })
        .toArray();
      serverDocs.forEach((s) => {
        serversMap.set(String(s._id), {
          id: String(s._id),
          name: s.name || '',
          provider: s.provider || '',
          scope: s.scope || ''
        });
      });
    }
    const visibleServers = Array.from(serversMap.values());

    res.json({
      success: true,
      data: {
        source: entityClient ? 'entity_llm' : 'global_ia_config',
        sourceLabel: entityClient
          ? 'LLM de l’entité (module IA → ia_llms)'
          : 'Configuration IA globale (ia_config / variables d’environnement)',
        provider: cfg.provider,
        model: cfg.model,
        endpointSummary,
        llmName: entityClient && llmDoc ? (llmDoc.name || null) : null,
        entityLlm: llmDoc
          ? {
              id: llmDoc._id ? String(llmDoc._id) : '',
              name: llmDoc.name || '',
              model: llmDoc.model || '',
              provider: llmDoc.provider || '',
              is_default: !!llmDoc.is_default,
              serverId: llmDoc.server_id ? String(llmDoc.server_id) : '',
              serverName
            }
          : null,
        availableLlms: visibleLlms,
        availableServers: visibleServers,
        promptLlmSelection: {
          subCategoryLlmId: promptsDoc.subCategoryLlmId || '',
          categorizationLlmId: promptsDoc.categorizationLlmId || '',
          minorationLlmId: promptsDoc.minorationLlmId || '',
          familleLlmId: promptsDoc.familleLlmId || '',
          assignationLlmId: promptsDoc.assignationLlmId || ''
        }
      }
    });
  } catch (error) {
    console.error('❌ UGAP getIaContext error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function detectSubCategories(req, res) {
  try {
    const { categoryId } = req.params;
    const useSSE = req.headers.accept && req.headers.accept.includes('text/event-stream');

    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      if (useSSE) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'Aucune donnée configurée' })}\n\n`);
        res.end();
        return;
      }
      return res.status(404).json({ success: false, message: 'Aucune donnée configurée' });
    }

    const category = data.categories.find(c => c.id === categoryId);
    if (!category) {
      if (useSSE) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'Catégorie non trouvée' })}\n\n`);
        res.end();
        return;
      }
      return res.status(404).json({ success: false, message: 'Catégorie non trouvée' });
    }

    if (useSSE) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      
      res.write(': connected\n\n');
      if (res.flush) res.flush();

      let isClosed = false;
      req.on('close', () => { isClosed = true; });

      const sendEvent = (event, data) => {
        if (isClosed) return;
        try {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          if (res.flush) res.flush();
        } catch (e) {
          isClosed = true;
        }
      };

      const keepAlive = setInterval(() => {
        if (isClosed) {
          clearInterval(keepAlive);
          return;
        }
        res.write(': keepalive\n\n');
        if (res.flush) res.flush();
      }, 3000);

      const progressCallback = (progress) => {
        if (isClosed) return;
        
        if (progress.type === 'stream' && progress.streamChunk) {
          sendEvent('stream', { chunk: progress.streamChunk });
          return;
        }
        
        const eventData = {
          message: progress.message || '',
          type: progress.type || 'info'
        };
        
        if (progress.partialData) {
          eventData.partialSubCategories = progress.partialData;
          eventData.isPartial = progress.isPartial;
          eventData.isFinal = progress.isFinal;
        }
        
        sendEvent('progress', eventData);
      };

      try {
        const aiService = new UgapAIService(req.entrepriseDb, req.entrepriseId, progressCallback);
        console.log(`\n🚀 ugapController: Appel de detectSubCategories pour "${category.name}" avec ${category.options?.length || 0} options`);
        const subCategories = await aiService.detectSubCategories(category.options || [], category.name);

        console.log(`\n📤 ugapController: Résultat de detectSubCategories:`);
        console.log(`📊 ugapController: ${subCategories.length} sous-catégorie(s) retournée(s)`);
        console.log(`📋 ugapController: Sous-catégories:`, subCategories.map(sc => sc.name).join(', '));
        
        // Vérifier que toutes les options sont incluses
        const allAssignedOptionIds = new Set();
        subCategories.forEach(sc => {
          (sc.optionIds || []).forEach(id => allAssignedOptionIds.add(id));
        });
        const totalOptionsInSubCategories = allAssignedOptionIds.size;
        const missingCount = (category.options || []).length - totalOptionsInSubCategories;
        
        console.log(`📊 ugapController: Options assignées: ${totalOptionsInSubCategories}/${(category.options || []).length}`);
        if (missingCount > 0) {
          console.warn(`⚠️ ugapController: ${missingCount} option(s) non assignée(s) - une sous-catégorie "Non attribuées" devrait être créée`);
        }
        
        console.log(`📋 ugapController: Détails:`, JSON.stringify(subCategories, null, 2));

        clearInterval(keepAlive);
        sendEvent('done', {
          success: true,
          message: `${subCategories.length} sous-catégorie(s) détectée(s)`,
          data: subCategories
        });
        console.log(`✅ ugapController: Événement 'done' envoyé avec ${subCategories.length} sous-catégorie(s)`);
        res.end();
      } catch (error) {
        clearInterval(keepAlive);
        sendEvent('error', { message: error.message || 'Erreur serveur' });
        res.end();
      }
    } else {
      const aiService = new UgapAIService(req.entrepriseDb, req.entrepriseId);
      const subCategories = await aiService.detectSubCategories(category.options || [], category.name);

      res.json({
        success: true,
        data: subCategories
      });
    }
  } catch (error) {
    console.error('❌ UGAP detectSubCategories error:', error);
    if (useSSE) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: error.message || 'Erreur serveur' })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
    }
  }
}

// ========================================
// GESTION DES CONFIGURATIONS
// ========================================

async function addModelConfiguration(req, res) {
  try {
    const { modelId } = req.params;
    const { name, description, image } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    const result = await UgapDataService.addModelConfiguration(
      req.entrepriseDb,
      req.entrepriseId,
      modelId,
      { name, description, image }
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ UGAP addModelConfiguration error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function updateModelConfiguration(req, res) {
  try {
    const { modelId, configId } = req.params;
    const updates = req.body;

    const result = await UgapDataService.updateModelConfiguration(
      req.entrepriseDb,
      req.entrepriseId,
      modelId,
      configId,
      updates
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ UGAP updateModelConfiguration error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function deleteModelConfiguration(req, res) {
  try {
    const { modelId, configId } = req.params;

    await UgapDataService.deleteModelConfiguration(
      req.entrepriseDb,
      req.entrepriseId,
      modelId,
      configId
    );

    res.json({ success: true, message: 'Configuration supprimée' });
  } catch (error) {
    console.error('❌ UGAP deleteModelConfiguration error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function updateModelImage(req, res) {
  try {
    const { modelId } = req.params;
    const { image } = req.body;

    const result = await UgapDataService.updateModelImage(
      req.entrepriseDb,
      req.entrepriseId,
      modelId,
      image
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ UGAP updateModelImage error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function importConfigurationPdf(req, res) {
  try {
    const { modelId, configId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier PDF fourni' });
    }
    const isPdf = file.mimetype === 'application/pdf' || file.originalname?.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return res.status(400).json({ success: false, message: 'Le fichier doit être un PDF' });
    }

    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Aucune donnée configurée' });
    }

    const options = (data.categories || []).flatMap(cat => cat.options || []);
    const fileBuffer = await fs.promises.readFile(file.path);
    const extractedLines = await UgapPdfService.extractLinesFromPdf(fileBuffer);
    const matchResult = UgapPdfService.matchLinesToOptions(extractedLines, options);

    let structuredSections = UgapPdfService.buildStructuredSections(extractedLines);
    let structuredFields = structuredSections.flatMap(section =>
      (section.fields || []).map(field => ({
        section: section.title,
        label: field.label || '',
        value: field.value || ''
      }))
    );
    let aiStructuredSections = null;
    let aiStructuredFields = null;
    let aiRawResponse = null;
    let visionRawResponse = null;
    let visionError = null;
    let visionModel = process.env.OLLAMA_VISION_MODEL || 'llava:7b';
    let pdfImagePath = null;

    if (extractedLines.length > 0) {
      try {
        const aiService = new UgapAIService(req.entrepriseDb, req.entrepriseId);
        const iaClient = await aiService.resolveAiClient();
        const prompt = buildPdfExtractionPrompt(extractedLines);
        const aiResponse = await iaClient.sendAnalysisPrompt(prompt, {
          temperature: 0.1,
          max_tokens: 2000
        });

        if (aiResponse.success) {
          aiRawResponse = aiResponse.data?.response || '';
          const parsed = parsePdfExtractionJson(aiRawResponse);
          if (parsed && Array.isArray(parsed.sections)) {
            aiStructuredSections = parsed.sections;
            aiStructuredFields = aiStructuredSections.flatMap(section =>
              (section.fields || []).map(field => ({
                section: section.title || '',
                label: field.label || '',
                value: field.value || ''
              }))
            );

            if (aiStructuredFields.length > 0) {
              structuredSections = aiStructuredSections;
              structuredFields = aiStructuredFields;
            }
          }
        }
      } catch (aiError) {
        console.warn('⚠️ UGAP importConfigurationPdf AI extraction failed:', aiError.message || aiError);
      }
    }

    try {
      const imageResult = await UgapPdfService.renderFirstPageToPng(file.path);
      pdfImagePath = imageResult.imagePath;
      const visionPrompt = buildPdfVisionPrompt(extractedLines);
      const aiService = new UgapAIService(req.entrepriseDb, req.entrepriseId);
      const iaClient = await aiService.resolveAiClient();
      const visionResponse = await iaClient.sendVisionPrompt(
        visionPrompt,
        [imageResult.imageBase64],
        {
          model: visionModel,
          temperature: 0.1,
          max_tokens: 2000
        }
      );

      if (visionResponse.success) {
        visionRawResponse = visionResponse.data?.response || '';
        const parsed = parsePdfExtractionJson(visionRawResponse);
        if (parsed && Array.isArray(parsed.sections)) {
          aiStructuredSections = parsed.sections;
          aiStructuredFields = aiStructuredSections.flatMap(section =>
            (section.fields || []).map(field => ({
              section: section.title || '',
              label: field.label || '',
              value: field.value || ''
            }))
          );
          if (aiStructuredFields.length > 0) {
            structuredSections = aiStructuredSections;
            structuredFields = aiStructuredFields;
          }
        }
      } else {
        visionError = visionResponse.error?.message || 'Vision IA indisponible';
      }
    } catch (visionException) {
      visionError = visionException.message || 'Erreur vision';
    }

    const analysis = {
      fileName: file.originalname,
      pdfFilePath: file.path,
      pdfUrl: `/api/ugap/models/${modelId}/configurations/${configId}/pdf`,
      pdfImagePath,
      extractedLines,
      structuredSections,
      structuredFields,
      aiStructuredSections,
      aiStructuredFields,
      aiRawResponse,
      visionRawResponse,
      visionError,
      visionModel,
      matches: matchResult.matches,
      matchedOptionIds: matchResult.matchedOptionIds,
      unmatchedLines: matchResult.unmatchedLines,
      needsOcr: extractedLines.length === 0,
      updatedAt: new Date()
    };

    await UgapDataService.updateModelConfiguration(
      req.entrepriseDb,
      req.entrepriseId,
      modelId,
      configId,
      { pdfAnalysis: analysis }
    );

    const optionById = new Map(options.map(option => [option.id, option]));
    const matchedOptions = matchResult.matchedOptionIds
      .map(id => optionById.get(id))
      .filter(Boolean);

    res.json({
      success: true,
      data: {
        analysis,
        matchedOptions
      }
    });
  } catch (error) {
    console.error('❌ UGAP importConfigurationPdf error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function uploadConfigurationPdf(req, res) {
  try {
    const { modelId, configId } = req.params;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    }

    // Enregistrer le chemin et le nom dans la configuration (sans analyser)
    const analysis = {
      fileName: file.originalname,
      pdfFilePath: file.path,
      pdfUrl: `/api/ugap/models/${modelId}/configurations/${configId}/pdf`,
      uploadedAt: new Date()
    };

    await UgapDataService.updateModelConfiguration(
      req.entrepriseDb,
      req.entrepriseId,
      modelId,
      configId,
      { pdfAnalysis: analysis }
    );

    res.json({ success: true, data: { analysis } });
  } catch (error) {
    console.error('❌ UGAP uploadConfigurationPdf error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function extractConfigurationText(req, res) {
  try {
    const { modelId, configId } = req.params;
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    const model = (data.models || []).find(m => m.id === modelId);
    const config = model?.configurations?.find(c => c.id === configId);
    const pdfPath = config?.pdfAnalysis?.pdfFilePath;
    if (!pdfPath) {
      return res.status(400).json({ success: false, message: 'PDF non trouvé pour cette configuration' });
    }

    const fileBuffer = await fs.promises.readFile(pdfPath);
    const extractedLines = await UgapPdfService.extractLinesFromPdf(fileBuffer);
    const structuredSections = UgapPdfService.buildStructuredSections(extractedLines);
    const structuredFields = structuredSections.flatMap(section =>
      (section.fields || []).map(field => ({ section: section.title, label: field.label || '', value: field.value || '' }))
    );

    const analysisUpdate = {
      extractedLines,
      structuredSections,
      structuredFields,
      extractedAt: new Date()
    };

    await UgapDataService.updateModelConfiguration(
      req.entrepriseDb,
      req.entrepriseId,
      modelId,
      configId,
      { pdfAnalysis: { ...(config.pdfAnalysis || {}), ...analysisUpdate } }
    );

    res.json({ success: true, data: { analysis: analysisUpdate } });
  } catch (error) {
    console.error('❌ UGAP extractConfigurationText error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function analyzeConfigurationImage(req, res) {
  try {
    const { modelId, configId } = req.params;
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    const model = (data.models || []).find(m => m.id === modelId);
    const config = model?.configurations?.find(c => c.id === configId);
    const pdfPath = config?.pdfAnalysis?.pdfFilePath;
    if (!pdfPath) {
      return res.status(400).json({ success: false, message: 'PDF non trouvé pour cette configuration' });
    }

    // Render first page to PNG
    const imageResult = await UgapPdfService.renderFirstPageToPng(pdfPath);

    // Call vision model
    const aiService = new UgapAIService(req.entrepriseDb, req.entrepriseId);
    const iaClient = await aiService.resolveAiClient();
    const visionModel = process.env.OLLAMA_VISION_MODEL || 'llava:7b';
    const visionPrompt = buildPdfVisionPrompt(config.pdfAnalysis?.extractedLines || []);
    const visionResponse = await iaClient.sendVisionPrompt(
      visionPrompt,
      [imageResult.imageBase64],
      { model: visionModel, temperature: 0.1, max_tokens: 2000 }
    );

    let visionParsed = null;
    if (visionResponse.success) {
      visionParsed = parsePdfExtractionJson(visionResponse.data?.response || '');
    }

    const analysisUpdate = {
      pdfImagePath: imageResult.imagePath,
      visionRawResponse: visionResponse.data?.response || null,
      visionParsed,
      visionModel,
      visionAt: new Date()
    };

    await UgapDataService.updateModelConfiguration(
      req.entrepriseDb,
      req.entrepriseId,
      modelId,
      configId,
      { pdfAnalysis: { ...(config.pdfAnalysis || {}), ...analysisUpdate } }
    );

    res.json({ success: true, data: { analysis: analysisUpdate } });
  } catch (error) {
    console.error('❌ UGAP analyzeConfigurationImage error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function convertConfigurationPdfToExcel(req, res) {
  try {
    const { modelId, configId } = req.params;
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    const model = (data.models || []).find(m => m.id === modelId);
    const config = model?.configurations?.find(c => c.id === configId);
    const pdfPath = config?.pdfAnalysis?.pdfFilePath;
    if (!pdfPath) {
      return res.status(400).json({ success: false, message: 'PDF non trouvé pour cette configuration' });
    }

    const fileBuffer = await fs.promises.readFile(pdfPath);
    const extractedLines = await UgapPdfService.extractLinesFromPdf(fileBuffer);

    // Heuristic split: try multiple delimiters (2+ spaces, tab, |, ;, ,)
    const rows = extractedLines.map(line => {
      let cols = line.split(/\s{2,}|\t|\||;|,/).map(c => c.trim()).filter(Boolean);
      if (cols.length === 0) cols = [line.trim()];
      return cols;
    });

    // Normalize rows to equal length by padding with empty strings
    const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const normalized = rows.map(r => {
      const copy = r.slice();
      while (copy.length < maxCols) copy.push('');
      return copy;
    });

    const ws = XLSX.utils.aoa_to_sheet(normalized);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extract');

    const outDir = path.join(__dirname, '../uploads/excels');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `extract_${Date.now()}.xlsx`);
    XLSX.writeFile(wb, outPath);

    const excelUrl = `/api/ugap/models/${modelId}/configurations/${configId}/excel`;

    const analysisUpdate = {
      excelFilePath: outPath,
      excelUrl,
      excelGeneratedAt: new Date()
    };

    await UgapDataService.updateModelConfiguration(
      req.entrepriseDb,
      req.entrepriseId,
      modelId,
      configId,
      { pdfAnalysis: { ...(config.pdfAnalysis || {}), ...analysisUpdate } }
    );

    res.json({ success: true, data: { analysis: analysisUpdate } });
  } catch (error) {
    console.error('❌ UGAP convertConfigurationPdfToExcel error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getConfigurationExcel(req, res) {
  try {
    const { modelId, configId } = req.params;
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Aucune donnée configurée' });
    }

    const model = (data.models || []).find(m => m.id === modelId);
    const config = model?.configurations?.find(c => c.id === configId);
    const excelPath = config?.pdfAnalysis?.excelFilePath;

    if (!excelPath || !fs.existsSync(excelPath)) {
      return res.status(404).json({ success: false, message: 'Fichier Excel introuvable' });
    }

    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.sendFile(path.resolve(excelPath));
  } catch (error) {
    console.error('❌ UGAP getConfigurationExcel error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

function normalizeColor(c) {
  if (!c) return null;
  
  let colorStr = c.toString().trim();
  
  // Si c'est déjà en format hex sans #, le retourner en majuscules
  if (/^[0-9A-Fa-f]{6}$/.test(colorStr)) {
    return colorStr.toUpperCase();
  }
  
  // Si c'est en format ARGB (8 caractères), enlever le préfixe FF (alpha)
  if (/^[0-9A-Fa-f]{8}$/.test(colorStr)) {
    colorStr = colorStr.replace(/^FF/i, '');
    return colorStr.toUpperCase();
  }
  
  // Si ça commence par FF, l'enlever
  colorStr = colorStr.replace(/^FF/i, '');
  
  // Si ça commence par #, l'enlever
  colorStr = colorStr.replace(/^#/i, '');
  
  // Si c'est maintenant 6 caractères hex, le retourner
  if (/^[0-9A-Fa-f]{6}$/.test(colorStr)) {
    return colorStr.toUpperCase();
  }
  
  // Sinon, retourner null
  return null;
}

// Détecte toutes les couleurs uniques dans le fichier Excel
function detectAllColorsFromExcel(ws, range, wb = null) {
  const allColors = new Set();
  const colorCounts = {
    colA: {}, // Colonne A = catégories
    colB: {}, // Colonne B = caractéristiques ou valeurs
    colC: {}  // Colonne C = valeurs
  };

  let cellsChecked = 0;
  let cellsWithColor = 0;

  // Parcourir toutes les cellules et collecter toutes les couleurs
  for (let r = range.s.r; r <= range.e.r; r++) {
    const aCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    const bCell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    const cCell = ws[XLSX.utils.encode_cell({ r, c: 2 })];

    // Essayer de récupérer les couleurs avec le workbook pour les styles partagés
    const aColor = normalizeColor(getCellColor(aCell, wb));
    const bColor = normalizeColor(getCellColor(bCell, wb));
    const cColor = normalizeColor(getCellColor(cCell, wb));

    if (aCell) cellsChecked++;
    if (bCell) cellsChecked++;
    if (cCell) cellsChecked++;

    if (aColor) {
      allColors.add(aColor);
      colorCounts.colA[aColor] = (colorCounts.colA[aColor] || 0) + 1;
      cellsWithColor++;
    }
    if (bColor) {
      allColors.add(bColor);
      colorCounts.colB[bColor] = (colorCounts.colB[bColor] || 0) + 1;
      cellsWithColor++;
    }
    if (cColor) {
      allColors.add(cColor);
      colorCounts.colC[cColor] = (colorCounts.colC[cColor] || 0) + 1;
      cellsWithColor++;
    }
  }

  console.log(`📊 Color detection: ${cellsChecked} cells checked, ${cellsWithColor} cells with colors, ${allColors.size} unique colors found`);

  // Retourner toutes les couleurs uniques triées par fréquence décroissante
  const sortedColors = Array.from(allColors).map(color => {
    const totalCount = (colorCounts.colA[color] || 0) + 
                       (colorCounts.colB[color] || 0) + 
                       (colorCounts.colC[color] || 0);
    return {
      color: color,
      count: totalCount,
      colA: colorCounts.colA[color] || 0,
      colB: colorCounts.colB[color] || 0,
      colC: colorCounts.colC[color] || 0
    };
  }).sort((a, b) => b.count - a.count);

  return sortedColors;
}

// Détecte automatiquement les couleurs dominantes dans le fichier Excel
function detectColorsFromExcel(ws, range) {
  const colorCounts = {
    colA: {}, // Colonne A = catégories
    colB: {}, // Colonne B = caractéristiques ou valeurs
    colC: {}  // Colonne C = valeurs
  };

  // Parcourir toutes les cellules et compter les couleurs par colonne
  for (let r = range.s.r; r <= range.e.r; r++) {
    const aCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    const bCell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    const cCell = ws[XLSX.utils.encode_cell({ r, c: 2 })];

    const aColor = normalizeColor(getCellColor(aCell));
    const bColor = normalizeColor(getCellColor(bCell));
    const cColor = normalizeColor(getCellColor(cCell));

    if (aColor) {
      colorCounts.colA[aColor] = (colorCounts.colA[aColor] || 0) + 1;
    }
    if (bColor) {
      colorCounts.colB[bColor] = (colorCounts.colB[bColor] || 0) + 1;
    }
    if (cColor) {
      colorCounts.colC[cColor] = (colorCounts.colC[cColor] || 0) + 1;
    }
  }

  // Trouver la couleur la plus fréquente dans chaque colonne
  const getMostFrequent = (counts) => {
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
  };

  const categoryColor = getMostFrequent(colorCounts.colA);
  const charColor = getMostFrequent(colorCounts.colB);
  const valueColor = getMostFrequent(colorCounts.colC) || getMostFrequent(colorCounts.colB);

  return {
    category: categoryColor,
    characteristic: charColor,
    value: valueColor
  };
}

function getCellColor(cell, wb = null) {
  try {
    if (!cell) return null;
    
    // Méthode 1: Styles directs de la cellule
    const s = cell.s;
    if (s) {
      // Essayer plusieurs méthodes pour récupérer la couleur de fond
      let color = null;
      
      // fill.fgColor (couleur de premier plan du remplissage)
      if (s.fill) {
        const fill = s.fill;
        
        // Essayer fgColor
        if (fill.fgColor) {
          color = fill.fgColor.rgb || fill.fgColor.RGB || fill.fgColor.argb || fill.fgColor.ARGB;
        }
        
        // Si pas de fgColor, essayer bgColor (couleur de fond)
        if (!color && fill.bgColor) {
          color = fill.bgColor.rgb || fill.bgColor.RGB || fill.bgColor.argb || fill.bgColor.ARGB;
        }
        
        // Essayer directement rgb
        if (!color && fill.rgb) {
          color = fill.rgb;
        }
        
        // Essayer patternFill (format Office Open XML)
        if (!color && fill.patternFill) {
          const patternFill = fill.patternFill;
          if (patternFill.fgColor) {
            color = patternFill.fgColor.rgb || patternFill.fgColor.RGB || patternFill.fgColor.argb || patternFill.fgColor.ARGB;
          }
          if (!color && patternFill.bgColor) {
            color = patternFill.bgColor.rgb || patternFill.bgColor.RGB || patternFill.bgColor.argb || patternFill.bgColor.ARGB;
          }
        }
      }
      
      if (color) return color;
      
      // Méthode 2: Essayer via l'index de style (si workbook disponible)
      if (wb && cell.s && cell.s.style !== undefined && wb.Styles && wb.Styles.CellXf) {
        const styleIndex = cell.s.style;
        const cellXf = wb.Styles.CellXf[styleIndex];
        if (cellXf && cellXf.fillId !== undefined && wb.Styles.Fills) {
          const fill = wb.Styles.Fills[cellXf.fillId];
          if (fill && fill.patternFill) {
            const patternFill = fill.patternFill;
            if (patternFill.fgColor) {
              color = patternFill.fgColor.rgb || patternFill.fgColor.RGB || patternFill.fgColor.argb || patternFill.fgColor.ARGB;
            }
            if (!color && patternFill.bgColor) {
              color = patternFill.bgColor.rgb || patternFill.bgColor.RGB || patternFill.bgColor.argb || patternFill.bgColor.ARGB;
            }
          }
        }
      }
      
      if (color) return color;
    }
    
    // Méthode 3: Essayer directement dans la cellule (format alternatif)
    if (cell.fill) {
      const fill = cell.fill;
      const color = fill.rgb || fill.RGB || fill.argb || fill.ARGB || fill.fgColor?.rgb || fill.bgColor?.rgb;
      if (color) return color;
    }
    
    return null;
  } catch (e) {
    // Ne pas logger chaque erreur pour éviter le spam
    return null;
  }
}

function isColorMatch(cellColor, target) {
  if (!cellColor || !target) return false;
  const c = normalizeColor(cellColor);
  const t = normalizeColor(target);
  return c === t || c.startsWith(t) || t.startsWith(c);
}

function simpleObjectToYaml(obj, indent = 0) {
  const pad = (n) => ' '.repeat(n);
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'string') return obj.includes('\n') ? `|\n${pad(indent+2)}${obj.replace(/\n/g, '\n' + pad(indent+2))}` : obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    return obj.map(item => `${pad(indent)}- ${simpleObjectToYaml(item, indent + 2)}`).join('\n');
  }
  // object
  return Object.entries(obj).map(([k,v]) => `${pad(indent)}${k}: ${typeof v === 'object' ? '\n' + simpleObjectToYaml(v, indent+2) : simpleObjectToYaml(v, 0)}`).join('\n');
}

// MAPPING SANS IA - Cette fonction fait UNIQUEMENT l'extraction depuis Excel, AUCUN appel IA
// Peut être appelée avec step: 'categories', 'subcategories', 'values' pour faire une passe spécifique
async function mapConfigurationExcel(req, res) {
  try {
    const { modelId, configId } = req.params;
    const { step } = req.body || {}; // 'categories', 'subcategories', 'values' ou undefined (toutes)
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    const model = (data.models || []).find(m => m.id === modelId);
    const config = model?.configurations?.find(c => c.id === configId);
    
    if (!config || !config.pdfAnalysis) {
      return res.status(400).json({ success: false, message: 'Aucun fichier importé pour cette configuration' });
    }
    
    // Le mapping se fait TOUJOURS depuis le fichier Excel
    // Si on a un Excel directement, l'utiliser
    let excelPath = config.pdfAnalysis.excelFilePath;
    
    if (!excelPath || !fs.existsSync(excelPath)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Fichier Excel introuvable pour cette configuration. Assurez-vous d\'avoir importé un fichier (PDF ou Excel).' 
      });
    }
    
    console.log('✅ Utilisation du fichier Excel pour le mapping:', excelPath);

    // Lire l'Excel pour le mapping
    console.log('🔄 Lecture et parsing du fichier Excel...');
    if (!fs.existsSync(excelPath)) {
      return res.status(400).json({ success: false, message: 'Fichier Excel introuvable' });
    }
    
    const wb = XLSX.readFile(excelPath, { cellStyles: true });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const fullRange = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    console.log(`✅ Fichier Excel lu: ${fullRange.e.r + 1} lignes, ${fullRange.e.c + 1} colonnes`);

    // Chercher "DESCRIPTIF TECHNIQUE" pour commencer après
    let startRow = fullRange.s.r;
    const searchText = 'DESCRIPTIF TECHNIQUE';
    for (let r = fullRange.s.r; r <= fullRange.e.r; r++) {
      for (let c = 0; c <= Math.min(5, fullRange.e.c); c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v) {
          const cellText = String(cell.v).toUpperCase().trim();
          if (cellText.includes(searchText)) {
            startRow = r + 1; // Commencer après cette ligne
            console.log(`✅ "DESCRIPTIF TECHNIQUE" trouvé à la ligne ${r + 1}, début du mapping à la ligne ${startRow + 1}`);
            break;
          }
        }
      }
      if (startRow > fullRange.s.r) break;
    }

    // Détecter les couleurs dominantes pour identifier les catégories/sous-catégories
    const detectedColors = detectAllColorsFromExcel(ws, fullRange, wb);
    const categoryColors = detectedColors.slice(0, 3).map(c => normalizeColor(c.color)).filter(Boolean);
    
    console.log(`🎨 Couleurs détectées: ${categoryColors.length} couleur(s) dominante(s)`);

    const categories = [];

    // Détection des tableaux (selon consigne: blocs de lignes consécutives non vides)
    const { tables } = detectTablesFromWorksheet(ws, fullRange, { startRow });
    const tablesCount = tables.length;
    console.log(`📊 ${tablesCount} tableau(x) détecté(s)`);
    
    // Étape 2 : Pour chaque tableau, détecter catégories, puis sous-catégories, puis valeurs
    tables.forEach((table, tableIndex) => {
      console.log(`📋 Traitement du tableau ${tableIndex + 1} (lignes ${table.start + 1} à ${table.end + 1})`);
      
      // Lire toutes les lignes du tableau avec leurs positions
      const tableCells = [];
      for (let r = table.start; r <= table.end; r++) {
        for (let c = 0; c <= fullRange.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          const value = cell && cell.v !== undefined ? String(cell.v).trim() : '';
          if (value) {
            const color = normalizeColor(getCellColor(cell, wb));
            tableCells.push({
              row: r,
              col: c,
              value,
              color,
              cell,
              isCategory: false,
              isSubCategory: false,
              categoryId: null,
              subCategoryId: null
            });
          }
        }
      }
      
      if (tableCells.length === 0) return;
      
      // PASS 1 : Détecter TOUTES les catégories
      // Catégories = première ligne du tableau OU première colonne *utile* (pas forcément la colonne A)
      const firstRow = table.start;
      
      // Déterminer la première colonne réellement utilisée dans ce tableau
      // (si la colonne A est vide et que les données commencent en B/C, on veut quand même détecter)
      let firstCol = 0;
      for (let c = 0; c <= fullRange.e.c; c++) {
        const hasAnyInCol = tableCells.some(tc => tc.col === c);
        if (hasAnyInCol) { firstCol = c; break; }
      }
      
      const detectedCategories = [];
      
      // CONSIGNE: Les catégories sont TOUJOURS le premier élément du tableau = première ligne (en-tête)
      const firstRowCells = tableCells.filter(c => c.row === firstRow).sort((a, b) => a.col - b.col);
      const hasRowsBelow = tableCells.some(c => c.row > firstRow);
      
      console.log(`  → Analyse première ligne: ${firstRowCells.length} cellule(s), lignes en dessous: ${hasRowsBelow}`);
      
      // PRIORITÉ: Toujours utiliser la première ligne comme source des catégories
      if (firstRowCells.length > 0) {
        // Catégories en en-tête (première ligne) - TOUJOURS
        console.log(`  → Pass 1: Catégories en en-tête (première ligne) - PRIORITÉ`);
        firstRowCells.forEach(cell => {
          const category = {
            id: crypto.randomUUID(),
            title: cell.value,
            items: [],
            subCategories: [],
            colIndex: cell.col,
            source: 'header'
          };
          detectedCategories.push(category);
          cell.isCategory = true;
          cell.categoryId = category.id;
          console.log(`    ✓ Catégorie détectée: "${cell.value}" (colonne ${cell.col})`);
        });
      } else {
        // Fallback: Si la première ligne est vraiment vide, utiliser la première colonne
        console.log(`  → Pass 1: Première ligne vide, fallback sur première colonne`);
        const firstColCells = tableCells.filter(c => c.col === firstCol).sort((a, b) => a.row - b.row);
        
        console.log(`  → Analyse première colonne: ${firstColCells.length} cellule(s)`);
        
        // Identifier les catégories (STRICT, selon consigne):
        // - Soit cellule surlignée (couleur "catégorie")
        // - Soit cellule SEULE sur sa ligne (ligne titre / catégorie)
        // Rien d'autre (évite "tout est catégorie")
        firstColCells.forEach(cell => {
          const hasCategoryColor = cell.color && categoryColors.some(catColor => cell.color === catColor);
          const rowHasOtherCells = tableCells.some(c => c.row === cell.row && c.col !== firstCol);
          const rowHasOnlyThisCell = !rowHasOtherCells;
          
          // C'est une catégorie si :
          // - Elle a une couleur de catégorie
          // - OU elle est seule sur sa ligne (ligne titre)
          const isCategory = hasCategoryColor || rowHasOnlyThisCell;
          
          if (isCategory) {
            const category = {
              id: crypto.randomUUID(),
              title: cell.value,
              items: [],
              subCategories: [],
              rowIndex: cell.row,
              source: 'column'
            };
            detectedCategories.push(category);
            cell.isCategory = true;
            cell.categoryId = category.id;
            console.log(`    ✓ Catégorie détectée: "${cell.value}" (ligne ${cell.row}, col ${firstCol}, couleur: ${hasCategoryColor}, seuleLigne: ${rowHasOnlyThisCell})`);
          }
        });
      }
      
      if (detectedCategories.length === 0) {
        // Aucune catégorie détectée, essayer une approche plus permissive
        console.log(`  → Aucune catégorie détectée, tentative approche permissive...`);
        
        // PRIORITÉ: Toujours utiliser la première ligne comme source des catégories
        if (firstRowCells.length > 0) {
          console.log(`  → Utilisation de toutes les cellules de la première ligne comme catégories (fallback)`);
          firstRowCells.forEach(cell => {
            const category = {
              id: crypto.randomUUID(),
              title: cell.value,
              items: [],
              subCategories: [],
              colIndex: cell.col,
              source: 'header_fallback'
            };
            detectedCategories.push(category);
            cell.isCategory = true;
            cell.categoryId = category.id;
          });
        } else {
          // Fallback: Si la première ligne est vraiment vide, utiliser la première colonne
          const firstColCells = tableCells.filter(c => c.col === firstCol);
          if (firstColCells.length > 0) {
            console.log(`  → Première ligne vide, utilisation de toutes les cellules de la première colonne comme catégories (fallback)`);
            firstColCells.forEach(cell => {
              const category = {
                id: crypto.randomUUID(),
                title: cell.value,
                items: [],
                subCategories: [],
                rowIndex: cell.row,
                source: 'column_fallback'
              };
              detectedCategories.push(category);
              cell.isCategory = true;
              cell.categoryId = category.id;
            });
          }
        }
        
        // Si toujours rien, créer une catégorie par défaut
        if (detectedCategories.length === 0) {
          console.log(`  → Création d'une catégorie par défaut`);
          const defaultCategory = {
            id: crypto.randomUUID(),
            title: 'Sans catégorie',
            items: [],
            subCategories: [],
            source: 'default'
          };
          detectedCategories.push(defaultCategory);
        }
      }
      
      console.log(`  → ${detectedCategories.length} catégorie(s) détectée(s) au total`);
      
      // Pour l'instant, on s'arrête à la passe 1 et on retourne juste les catégories
      // Les passes 2 et 3 seront faites après validation/modification des catégories
      
      // Nettoyer les catégories (retirer colIndex/rowIndex pour l'affichage, mais garder source)
      detectedCategories.forEach(cat => {
        if (cat.colIndex !== undefined) {
          cat._colIndex = cat.colIndex; // Garder pour référence interne
          delete cat.colIndex;
        }
        if (cat.rowIndex !== undefined) {
          cat._rowIndex = cat.rowIndex; // Garder pour référence interne
          delete cat.rowIndex;
        }
      });
      
      // Ajouter les catégories du tableau à la liste globale
      categories.push(...detectedCategories);
      
      // Si on fait seulement la passe 1 (catégories), s'arrêter ici
      if (step === 'categories') {
        console.log(`✅ Passe 1 terminée: ${categories.length} catégorie(s) détectée(s)`);
      } else if (step === 'subcategories') {
        // PASS 2 : Détecter les sous-catégories
        console.log(`🔄 Pass 2: Détection des sous-catégories...`);
        // TODO: Implémenter la passe 2
        console.log(`✅ Passe 2 terminée`);
      } else if (step === 'values') {
        // PASS 3 : Détecter les valeurs
        console.log(`🔄 Pass 3: Détection des valeurs...`);
        // TODO: Implémenter la passe 3
        console.log(`✅ Passe 3 terminée`);
      }
      // Si step n'est pas défini, on fait toutes les passes (comportement par défaut)
      
      // Ajouter les catégories du tableau à la liste globale
      categories.push(...detectedCategories);
    });


    console.log(`✅ Mapping terminé: ${categories.length} catégorie(s) extraite(s), ${categories.reduce((sum, cat) => sum + (cat.items?.length || 0) + (cat.subCategories?.reduce((s, sc) => s + (sc.items?.length || 0), 0) || 0), 0)} élément(s)`);

    // Sauvegarder le fichier Excel pour téléchargement
    const tempDir = path.join(__dirname, '../uploads/camelot-mapping');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const excelFileName = `camelot_${configId}_${Date.now()}.xlsx`;
    const savedExcelPath = path.join(tempDir, excelFileName);
    
    // Copier le fichier avec un nom plus lisible (si différent du chemin actuel)
    let finalExcelPath = excelPath;
    if (excelPath !== savedExcelPath && fs.existsSync(excelPath)) {
      try {
        fs.copyFileSync(excelPath, savedExcelPath);
        finalExcelPath = savedExcelPath;
        console.log(`✅ Fichier Excel sauvegardé: ${finalExcelPath}`);
      } catch (e) {
        console.warn('⚠️ Impossible de copier le fichier Excel, utilisation du fichier original:', e);
      }
    }

    // Retourner juste le mapping (sans matching IA)
    const mapped = { 
      categories,
      stats: {
        totalTables: tablesCount,
        totalCategories: categories.length,
        totalItems: categories.reduce((sum, cat) => sum + (cat.items?.length || 0) + (cat.subCategories?.reduce((s, sc) => s + (sc.items?.length || 0), 0) || 0), 0),
        totalSubCategories: categories.reduce((sum, cat) => sum + (cat.subCategories?.length || 0), 0)
      }
    };
    const yamlStr = simpleObjectToYaml(mapped, 0);

    const mappedPath = path.join(__dirname, '../uploads/mapped');
    if (!fs.existsSync(mappedPath)) fs.mkdirSync(mappedPath, { recursive: true });
    const outJson = path.join(mappedPath, `mapped_${Date.now()}.json`);
    const outYaml = path.join(mappedPath, `mapped_${Date.now()}.yaml`);
    fs.writeFileSync(outJson, JSON.stringify(mapped, null, 2), 'utf8');
    fs.writeFileSync(outYaml, yamlStr, 'utf8');

    const analysisUpdate = {
      mappedJsonPath: outJson,
      mappedYamlPath: outYaml,
      camelotExcelPath: finalExcelPath,
      camelotExcelFileName: excelFileName,
      mapped: mapped,
      mappedAt: new Date()
    };
    
    console.log(`💾 Sauvegarde du mapping avec Excel path: ${finalExcelPath}`);

    await UgapDataService.updateModelConfiguration(
      req.entrepriseDb,
      req.entrepriseId,
      modelId,
      configId,
      { pdfAnalysis: { ...(config.pdfAnalysis || {}), ...analysisUpdate } }
    );

    console.log('📤 Envoi du résultat du mapping');
    
    res.json({ success: true, data: { mapped, yaml: yamlStr, excelPath: finalExcelPath, excelFileName } });
  } catch (error) {
    console.error('❌ UGAP mapConfigurationExcel error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}
function buildPdfExtractionPrompt(lines) {
  const maxLines = 800;
  const limitedLines = lines.slice(0, maxLines);
  return `Tu reçois le texte extrait d'un PDF technique. Il contient plusieurs tableaux.
Ta mission: reconstruire des sections structurées avec:
- un titre de section (catégorie)
- des champs (caractéristique + valeur)

Réponds UNIQUEMENT avec un JSON valide, sans texte autour.
Format attendu:
{
  "sections": [
    {
      "title": "Titre de section",
      "fields": [
        { "label": "Caractéristique", "value": "Valeur" }
      ]
    }
  ]
}

Texte extrait:
${limitedLines.join('\n')}`;
}

function buildPdfVisionPrompt(lines) {
  const maxLines = 800;
  const limitedLines = lines.slice(0, maxLines);
  return `Voici une image de tableau PDF. Le texte extrait est :
${limitedLines.join('\n')}

Analyse l'image et recompose le tableau en JSON.
Utilise le texte pour remplir les cellules, corrige si nécessaire.
Identifie les cellules fusionnées en regroupant correctement les titres.

Réponds UNIQUEMENT avec un JSON valide, sans texte autour.
Format attendu:
{
  "sections": [
    {
      "title": "Titre de section",
      "fields": [
        { "label": "Caractéristique", "value": "Valeur" }
      ]
    }
  ]
}
`;
}

function parsePdfExtractionJson(text) {
  if (!text) return null;
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  const jsonText = text.substring(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    return null;
  }
}

async function getConfigurationPdf(req, res) {
  try {
    const { modelId, configId } = req.params;
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Aucune donnée configurée' });
    }

    const model = (data.models || []).find(m => m.id === modelId);
    const config = model?.configurations?.find(c => c.id === configId);
    const pdfPath = config?.pdfAnalysis?.pdfFilePath;

    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return res.status(404).json({ success: false, message: 'PDF introuvable' });
    }

    res.type('application/pdf');
    return res.sendFile(path.resolve(pdfPath));
  } catch (error) {
    console.error('❌ UGAP getConfigurationPdf error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function updateOptionDocTemplate(req, res) {
  try {
    const { optionId } = req.params;
    const { idDocTemplate } = req.body;

    const result = await UgapDataService.updateOptionDocTemplate(
      req.entrepriseDb,
      req.entrepriseId,
      optionId,
      idDocTemplate
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ UGAP updateOptionDocTemplate error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

/**
 * Recherche des collections existantes similaires
 */
async function searchSimilarCollections(req, res) {
  try {
    const { categoryId, subCategoryId } = req.params;

    // Récupérer les données UGAP
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Aucune donnée configurée' });
    }

    const { category, subCategory } = findCategoryAndSubCategory(data, categoryId, subCategoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Catégorie non trouvée' });
    }
    if (!subCategory) {
      return res.status(404).json({ success: false, message: 'Sous-catégorie non trouvée' });
    }

    // Récupérer toutes les collections de doc-template pour cette entreprise
    const collectionsCollection = req.entrepriseDb.collection('collections');
    const collections = await collectionsCollection.find({
      entrepriseId: new ObjectId(req.entrepriseId)
    }).toArray();

    // Rechercher des collections similaires par nom
    const subCategoryName = subCategory.name.toLowerCase();
    const similarCollections = collections
      .map(collection => {
        const collectionName = collection.name.toLowerCase();
        const similarity = calculateSimilarity(subCategoryName, collectionName);
        return {
          ...collection,
          similarity
        };
      })
      .filter(c => c.similarity > 0.3) // Seuil de similarité de 30%
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5); // Top 5

    res.json({
      success: true,
      data: {
        similarCollections,
        subCategoryName: subCategory.name
      }
    });
  } catch (error) {
    console.error('❌ UGAP searchSimilarCollections error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

/**
 * Normalise un texte pour la comparaison
 */
function normalizeTextForMatching(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Enlever la ponctuation
    .replace(/\s+/g, ' ') // Normaliser les espaces
    .trim();
}

/**
 * Calcule la similarité entre deux chaînes (algorithme simple)
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const normalized1 = normalizeTextForMatching(str1);
  const normalized2 = normalizeTextForMatching(str2);
  
  if (normalized1 === normalized2) return 1.0;
  
  const longer = normalized1.length > normalized2.length ? normalized1 : normalized2;
  const shorter = normalized1.length > normalized2.length ? normalized2 : normalized1;
  
  if (longer.length === 0) return 1.0;
  
  // Vérifier si l'une contient l'autre (match partiel)
  if (longer.includes(shorter)) {
    return shorter.length / longer.length;
  }
  
  // Distance de Levenshtein
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  const similarity = 1 - (distance / maxLength);
  
  return Math.max(0, similarity);
}

/**
 * Distance de Levenshtein
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

async function generateCollectionWithAI(req, res) {
  try {
    const { categoryId, subCategoryId } = req.params;
    const { useWebSearch = false } = req.body;

    console.log(`🤖 Génération de collection par IA pour sous-catégorie ${subCategoryId}, recherche web: ${useWebSearch}`);

    // Récupérer les données
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Aucune donnée configurée' });
    }

    const { category, subCategory } = findCategoryAndSubCategory(data, categoryId, subCategoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Catégorie non trouvée' });
    }
    if (!subCategory) {
      return res.status(404).json({ success: false, message: 'Sous-catégorie non trouvée' });
    }

    const options = (category.options || []).filter(opt => 
      (subCategory.optionIds || []).includes(opt.id)
    );

    // Effectuer la recherche web si demandée
    let webResults = [];
    if (useWebSearch) {
      console.log('🌐 Recherche web activée...');
      const webSearch = new WebSearchSimulator();
      try {
        // Rechercher sur le nom de la sous-catégorie
        webResults = await webSearch.search(subCategory.name, 5);
        console.log(`✅ ${webResults.length} résultat(s) de recherche web trouvé(s)`);
      } catch (error) {
        console.warn('⚠️ Erreur lors de la recherche web:', error.message);
        // Continuer sans les résultats web
      }
    }

    // Construire le prompt
    let prompt = `Tu es un expert en création de structures de données pour des collections.

Analyse la sous-catégorie suivante et propose une structure de collection optimale :

**Sous-catégorie :** ${subCategory.name}
**Description :** ${subCategory.description || 'Aucune description'}
**Nombre d'options :** ${options.length}

${options.length > 0 ? `**Exemples d'options :**
${options.slice(0, 10).map(opt => `- ${opt.name} (Prix: ${opt.priceClient || 0}€)`).join('\n')}
${options.length > 10 ? `... et ${options.length - 10} autres options` : ''}` : ''}`;

    // Ajouter les résultats de recherche web si disponibles
    if (webResults.length > 0) {
      const webSearch = new WebSearchSimulator();
      prompt += webSearch.formatResultsForPrompt(webResults);
    }

    prompt += `

**Instructions :**
1. Analyse les caractéristiques principales de cette sous-catégorie
2. Identifie les champs essentiels pour décrire et gérer les éléments de cette collection
3. Propose une structure de collection avec des champs pertinents
4. Utilise les types de champs suivants : Texte, TextArea, Number, Boolean, Date, DateTime, Couleur, Fichier, Image, Enum, Relation

Réponds UNIQUEMENT avec un JSON valide au format suivant :
{
  "fields": [
    {
      "type": "Texte",
      "label": "Nom du champ",
      "required": true,
      "description": "Description du champ"
    }
  ],
  "reasoning": "Explication de la structure proposée"
}`;

    // Appel à l'IA
    const aiService = new UgapAIService(req.entrepriseDb, req.entrepriseId);
    const iaClient = await aiService.resolveAiClient();
    const aiResponse = await iaClient.sendAnalysisPrompt(prompt, { stream: false });
    
    // Extraire la réponse
    const aiText = aiResponse.data?.response || aiResponse.response || '';

    // Parser la réponse
    let fields = [];
    let reasoning = '';
    
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*"fields"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        fields = parsed.fields || [];
        reasoning = parsed.reasoning || '';
      } else {
        throw new Error('Aucun JSON trouvé dans la réponse de l\'IA');
      }
    } catch (parseError) {
      console.error('❌ Erreur de parsing:', parseError);
      return res.status(500).json({ 
        success: false, 
        message: 'Impossible de parser la réponse de l\'IA: ' + parseError.message,
        rawResponse: aiText.substring(0, 500)
      });
    }

    res.json({
      success: true,
      data: {
        fields,
        reasoning,
        webResults: webResults.length > 0 ? webResults : undefined
      }
    });
  } catch (error) {
    console.error('❌ UGAP generateCollectionWithAI error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

/**
 * Trouve la catégorie et la sous-catégorie par IDs, avec fallback global.
 */
function findCategoryAndSubCategory(data, categoryId, subCategoryId) {
  if (!data || !Array.isArray(data.categories)) {
    return { category: null, subCategory: null };
  }

  let category = data.categories.find(c => c.id === categoryId);
  let subCategory = (category?.subCategories || []).find(sc => sc.id === subCategoryId);

  if (!category || !subCategory) {
    for (const candidate of data.categories) {
      const match = (candidate.subCategories || []).find(sc => sc.id === subCategoryId);
      if (match) {
        category = candidate;
        subCategory = match;
        break;
      }
    }
  }

  return { category, subCategory };
}

async function detectExcelColors(req, res) {
  try {
    const { modelId, configId } = req.params;
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    const model = (data.models || []).find(m => m.id === modelId);
    const config = model?.configurations?.find(c => c.id === configId);
    const excelPath = config?.pdfAnalysis?.excelFilePath;
    
    if (!excelPath || !fs.existsSync(excelPath)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Fichier Excel introuvable pour cette configuration' 
      });
    }

    // Essayer plusieurs options de lecture pour récupérer les styles
    let wb;
    try {
      wb = XLSX.readFile(excelPath, { cellStyles: true, cellNF: true });
    } catch (e) {
      console.warn('Failed to read with cellStyles, trying without:', e);
      wb = XLSX.readFile(excelPath);
    }
    
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    
    if (!ws || !ws['!ref']) {
      return res.status(400).json({ 
        success: false, 
        message: 'Feuille Excel vide ou invalide' 
      });
    }
    
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    // Debug: logger quelques cellules pour voir leur structure
    console.log('🔍 Debug: Checking first few cells for colors...');
    console.log('Workbook has Styles?', !!wb.Styles);
    console.log('Workbook keys:', Object.keys(wb).filter(k => !k.startsWith('Sheet')));
    
    if (wb.Styles) {
      console.log('Workbook Styles keys:', Object.keys(wb.Styles));
      console.log('Fills count:', wb.Styles.Fills?.length || 0);
      console.log('CellXf count:', wb.Styles.CellXf?.length || 0);
      if (wb.Styles.Fills && wb.Styles.Fills.length > 0) {
        console.log('First few fills:', JSON.stringify(wb.Styles.Fills.slice(0, 3), null, 2));
      }
    }
    
    // Vérifier aussi les cellules avec des valeurs pour voir leur structure complète
    let sampleCells = [];
    for (let r = range.s.r; r <= Math.min(range.s.r + 10, range.e.r); r++) {
      for (let c = 0; c <= Math.min(2, range.e.c); c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[cellAddr];
        if (cell && (cell.v || cell.s)) {
          const color = getCellColor(cell, wb);
          const normalized = normalizeColor(color);
          const cellInfo = {
            address: cellAddr,
            hasValue: !!cell.v,
            hasStyle: !!cell.s,
            styleIndex: cell.s?.style,
            fill: cell.s?.fill ? JSON.stringify(cell.s.fill).substring(0, 100) : null,
            rawColor: color,
            normalized: normalized,
            cellKeys: Object.keys(cell).filter(k => !k.startsWith('!'))
          };
          sampleCells.push(cellInfo);
          if (sampleCells.length <= 5) {
            console.log(`Cell ${cellAddr}:`, cellInfo);
          }
        }
      }
    }
    
    console.log(`📊 Total sample cells checked: ${sampleCells.length}`);
    console.log(`📊 Cells with styles: ${sampleCells.filter(c => c.hasStyle).length}`);
    console.log(`📊 Cells with colors: ${sampleCells.filter(c => c.normalized).length}`);

    const detectedColors = detectAllColorsFromExcel(ws, range, wb);
    
    console.log(`✅ Detected ${detectedColors.length} unique colors`);
    if (detectedColors.length > 0) {
      console.log('Top colors:', detectedColors.slice(0, 5).map(c => `#${c.color} (${c.count} occurrences)`).join(', '));
    } else {
      console.warn('⚠️ No colors detected! This might mean:');
      console.warn('  1. The Excel file has no background colors');
      console.warn('  2. XLSX library cannot read the color format used');
      console.warn('  3. The file was converted from PDF without preserving colors');
      console.warn('  → User will need to enter colors manually');
    }

    res.json({ 
      success: true, 
      data: { 
        colors: detectedColors,
        debug: {
          totalCells: (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1),
          hasStyles: !!wb.Styles,
          fillsCount: wb.Styles?.Fills?.length || 0
        }
      } 
    });
  } catch (error) {
    console.error('❌ UGAP detectExcelColors error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Erreur serveur',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

async function suggestFamiliesByAI(req, res) {
  try {
    const { options } = req.body || {};
    if (!Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ success: false, message: 'Liste d\'options requise (tableau non vide)' });
    }
    console.log('\n🔎 [UGAP/FAMILLE] suggestFamiliesByAI called');
    console.log(`Entreprise: ${String(req.entrepriseId || '')} | lignes: ${options.length}`);
    console.log('Aperçu payload (3 premières lignes):');
    options.slice(0, 3).forEach((o, i) => {
      console.log(`  ${i + 1}. id=${o?.id || ''} | type=${o?.lineKind || ''} | cat=${o?.category || ''} | ${o?.name || ''}`);
    });
    const aiService = new UgapAIService(req.entrepriseDb, req.entrepriseId);
    const data = await aiService.suggestOptionFamilies(options);
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ UGAP suggestFamiliesByAI:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function assignFamiliesToBusinessViewsAI(req, res) {
  try {
    const { families, businessViews } = req.body || {};
    if (!Array.isArray(families) || families.length === 0) {
      return res.status(400).json({ success: false, message: 'Liste de familles requise.' });
    }
    if (!Array.isArray(businessViews) || businessViews.length === 0) {
      return res.status(400).json({ success: false, message: 'Liste de vues métier requise.' });
    }

    const aiService = new UgapAIService(req.entrepriseDb, req.entrepriseId);
    const data = await aiService.assignFamiliesToBusinessViews(families, businessViews);
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ UGAP assignFamiliesToBusinessViewsAI:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function completeBaseOptionsWithAI(req, res) {
  try {
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Aucune donnée configurée' });
    }

    const allOptions = (data.categories || []).flatMap((cat) => cat.options || []);
    const baseLikeOptions = allOptions.filter((opt) => {
      const s = String(opt?.name || '').toLowerCase();
      if (!s) return false;
      return (
        /\ben\s+remplacement\b/.test(s) ||
        /\ben\s+lieu\s+et\s+place\b/.test(s) ||
        /\bau\s+lieu\s+et\s+place\b/.test(s) ||
        /\bnon\s+fourniture\b/.test(s) ||
        /^(moins-value|plus-value|plus\s+value)\b/.test(s)
      );
    });

    if (baseLikeOptions.length === 0) {
      return res.json({
        success: true,
        message: 'Aucune ligne option de base à compléter',
        data,
        stats: { scanned: 0, enriched: 0 }
      });
    }

    const aiService = new UgapAIService(req.entrepriseDb, req.entrepriseId);
    const aiRows = await aiService.extractBaseReplacementProducts(baseLikeOptions);
    const byId = new Map((aiRows || []).map((r) => [String(r.id || '').trim(), r]));
    const minConfidence = Number(req.body?.minConfidence ?? process.env.UGAP_BASE_REPL_AI_MIN_CONFIDENCE ?? 0.55);

    let enriched = 0;
    (data.categories || []).forEach((cat) => {
      (cat.options || []).forEach((opt) => {
        const ai = byId.get(String(opt.id || '').trim());
        if (!ai) return;
        if ((ai.confidence || 0) < minConfidence) return;
        const before = `${opt.changeType || ''}|${opt.initialProduct || ''}|${opt.finalProduct || ''}`;
        if (ai.changeType) opt.changeType = ai.changeType;
        if (ai.initialProduct) opt.initialProduct = ai.initialProduct;
        if (ai.finalProduct) opt.finalProduct = ai.finalProduct;
        const after = `${opt.changeType || ''}|${opt.initialProduct || ''}|${opt.finalProduct || ''}`;
        if (after !== before) enriched += 1;
      });
    });

    await UgapDataService.saveData(req.entrepriseDb, data, req.entrepriseId);

    res.json({
      success: true,
      message: `Complétion IA terminée (${enriched} ligne(s) enrichie(s))`,
      data,
      stats: {
        scanned: baseLikeOptions.length,
        aiReturned: aiRows.length,
        enriched
      }
    });
  } catch (error) {
    console.error('❌ UGAP completeBaseOptionsWithAI:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function completeBaseOptionLineWithAI(req, res) {
  try {
    const { optionId } = req.body || {};
    const targetId = String(optionId || '').trim();
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'optionId requis' });
    }

    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Aucune donnée configurée' });
    }

    let targetOption = null;
    for (const cat of data.categories || []) {
      const found = (cat.options || []).find((o) => String(o.id || '').trim() === targetId);
      if (found) {
        targetOption = found;
        break;
      }
    }

    if (!targetOption) {
      return res.status(404).json({ success: false, message: 'Option introuvable' });
    }

    const s = String(targetOption.name || '').toLowerCase();
    const isBaseLike = (
      /\ben\s+remplacement\b/.test(s) ||
      /\ben\s+lieu\s+et\s+place\b/.test(s) ||
      /\bau\s+lieu\s+et\s+place\b/.test(s) ||
      /\bnon\s+fourniture\b/.test(s) ||
      /^(moins-value|plus-value|plus\s+value)\b/.test(s)
    );
    if (!isBaseLike) {
      return res.json({
        success: true,
        message: 'Ligne ignorée (hors périmètre options de base)',
        data: { updatedOption: targetOption, skipped: true }
      });
    }

    // 1) Heuristique d'abord : si ligne complète, on n'appelle PAS l'IA
    let appliedSource = 'none';
    const h = UgapExcelService.parseBaseReplacementProducts(targetOption.name || '');
    const heuristicComplete = !!(String(h?.initialProduct || '').trim() && String(h?.finalProduct || '').trim());
    if (h?.changeType || h?.initialProduct || h?.finalProduct) {
      if (h.changeType) targetOption.changeType = h.changeType;
      if (h.initialProduct) targetOption.initialProduct = h.initialProduct;
      if (h.finalProduct) targetOption.finalProduct = h.finalProduct;
      targetOption.baseAiConfidence = 0;
      if (heuristicComplete) {
        console.log(`[UGAP][BASE-OPTIONS][${targetOption.id}] Heuristique complète -> pas d'appel IA`, {
          initialProduct: targetOption.initialProduct || '',
          finalProduct: targetOption.finalProduct || '',
          changeType: targetOption.changeType || ''
        });
        appliedSource = 'heuristic';
        await UgapDataService.saveData(req.entrepriseDb, data, req.entrepriseId);
        return res.json({
          success: true,
          message: 'Ligne enrichie (heuristique)',
          data: {
            updatedOption: targetOption,
            accepted: true,
            appliedSource,
            confidence: 0
          }
        });
      }
    }

    // 2) IA seulement si heuristique non complète
    const aiService = new UgapAIService(req.entrepriseDb, req.entrepriseId);
    let ai = null;
    try {
      const rows = await aiService.extractBaseReplacementProducts([targetOption]);
      ai = (rows || [])[0] || null;
      console.log(`[UGAP][BASE-OPTIONS][IA-BATCH][${targetOption.id}]`, ai || null);
    } catch (e) {
      console.warn('⚠️ completeBaseOptionLineWithAI: appel IA en lot échoué, fallback unitaire:', e.message || e);
    }

    if (!ai) {
      try {
        const prompts = await UgapDataService.getPrompts(req.entrepriseDb, req.entrepriseId);
        const llmId = prompts.minorationLlmId || prompts.subCategoryLlmId || null;
        if (llmId) {
          const client = await aiService.resolveAiClient(llmId);
          const prompt = `Analyse UNE ligne UGAP et retourne uniquement un JSON.

Ligne:
id=${targetOption.id} | ${targetOption.name}

FORMAT DE RETOUR STRICT (OBLIGATOIRE):
- Réponds avec UN SEUL OBJET JSON valide.
- AUCUN texte avant "{" ni après "}".
- Clés autorisées uniquement: id, changeType, initialProduct, finalProduct, confidence
- changeType doit être exactement l'une de: "replacement", "motor_base_non_supply", ""
- initialProduct/finalProduct: string ("" si inconnu)
- confidence: number entre 0 et 1

Retour attendu:
{
  "id": "${targetOption.id}",
  "changeType": "replacement|motor_base_non_supply|",
  "initialProduct": "string",
  "finalProduct": "string",
  "confidence": 0.0
}

Exemples:
- "Flotteur moussé PE sans revêtement PU en remplacement de celui de base" => initial "flotteur de base", final "Flotteur moussé PE sans revêtement PU"
- "Moins-value GPSMAP 8412 xsv en remplacement HDS PRO 12 - Postes 1, 5, 6, 7 et 8" => initial "HDS PRO 12", final "GPSMAP 8412 xsv"
- "Non fourniture du moteur de base - Poste 1" => changeType "motor_base_non_supply", initial "moteur de base", final "moteur choisi"`;
          const response = await client.sendAnalysisPrompt(prompt, { temperature: 0.05, max_tokens: 700 });
          const text = String(response?.data?.response || '').trim();
          console.log(`\n🧾 [UGAP][BASE-OPTIONS][IA-RAW][${targetOption.id}]`);
          console.log(text || '(réponse vide)');
          console.log('---');
          const firstBrace = text.indexOf('{');
          const lastBrace = text.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
            ai = {
              id: String(parsed?.id || targetOption.id),
              changeType: String(parsed?.changeType || '').trim(),
              initialProduct: String(parsed?.initialProduct || '').trim(),
              finalProduct: String(parsed?.finalProduct || '').trim(),
              confidence: Number.isFinite(Number(parsed?.confidence)) ? Number(parsed.confidence) : 0
            };
          }
        }
      } catch (e2) {
        console.warn('⚠️ completeBaseOptionLineWithAI: fallback unitaire IA échoué:', e2.message || e2);
      }
    }

    const minConfidence = Number(req.body?.minConfidence ?? process.env.UGAP_BASE_REPL_AI_MIN_CONFIDENCE ?? 0.35);
    const aiHasUsefulData = !!ai && (
      String(ai.changeType || '').trim() !== '' ||
      String(ai.initialProduct || '').trim() !== '' ||
      String(ai.finalProduct || '').trim() !== ''
    );
    const aiAcceptedByConfidence = !!ai && ((ai.confidence || 0) >= minConfidence);
    const aiAccepted = aiHasUsefulData && (aiAcceptedByConfidence || !Number.isFinite(Number(ai.confidence)));
    console.log(
      `[UGAP][BASE-OPTIONS][IA-PARSED][${targetOption.id}]`,
      ai || null,
      `accepted=${aiAccepted} useful=${aiHasUsefulData} confidence=${ai?.confidence ?? 'n/a'}`
    );

    if (aiAccepted) {
      if (ai.changeType) targetOption.changeType = ai.changeType;
      if (ai.initialProduct) targetOption.initialProduct = ai.initialProduct;
      if (ai.finalProduct) targetOption.finalProduct = ai.finalProduct;
      targetOption.baseAiConfidence = Number.isFinite(Number(ai.confidence)) ? Number(ai.confidence) : null;
      appliedSource = 'ai';
    } else if (h?.changeType || h?.initialProduct || h?.finalProduct) {
      // Heuristique partielle conservée si IA insuffisante
      targetOption.baseAiConfidence = Number.isFinite(Number(ai?.confidence)) ? Number(ai.confidence) : 0;
      appliedSource = 'heuristic';
    }

    if (appliedSource !== 'none') {
      await UgapDataService.saveData(req.entrepriseDb, data, req.entrepriseId);
    }

    res.json({
      success: true,
      message: appliedSource === 'ai'
        ? 'Ligne enrichie (IA)'
        : appliedSource === 'heuristic'
          ? 'Ligne enrichie (fallback heuristique)'
          : 'Aucun enrichissement trouvé',
      data: {
        updatedOption: targetOption,
        accepted: appliedSource !== 'none',
        appliedSource,
        confidence: ai?.confidence || 0
      }
    });
  } catch (error) {
    console.error('❌ UGAP completeBaseOptionLineWithAI:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

module.exports = {
  getData,
  getUiState,
  updateUiState,
  importExcel,
  getImportStaging,
  listImportStaging,
  renameImportStaging,
  validateImportModels,
  validateImportOptions,
  applyImportAssignments,
  updateImportMinorations,
  updateImportMajorations,
  updateImportOptionsTri,
  updateImportBaseProducts,
  publishImport,
  getImportAudit,
  reintegrateImportAuditLine,
  getModels,
  getCategories,
  generateDevis,
  createCategory,
  updateCategory,
  reorderCategories,
  deleteCategory,
  clearAllCategories,
  purgePublishedData,
  clearConfigurationMappedCategories,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
  createOption,
  deleteOption,
  assignOptionsFamiliesBulk,
  updateOption,
  moveOptionToCategory,
  improveCategorization,
  getPrompts,
  updatePrompts,
  resetPrompts,
  getIaContext,
  detectSubCategories,
  addModelConfiguration,
  updateModelConfiguration,
  deleteModelConfiguration,
  updateModelImage,
  importConfigurationPdf,
  uploadConfigurationPdf,
  extractConfigurationText,
  analyzeConfigurationImage,
  convertConfigurationPdfToExcel,
  getConfigurationExcel,
  mapConfigurationExcel,
  detectExcelColors,
  updateOptionDocTemplate,
  getConfigurationPdf,
  generateCollectionWithAI,
  searchSimilarCollections,
  verifyOptionWithAI,
  testExcelExtraction,
  downloadCamelotExcel,
  convertPdfToExcel,
  downloadExcel,
  viewExcelAsHtml,
  importConfigurationFile,
  suggestFamiliesByAI,
  assignFamiliesToBusinessViewsAI,
  completeBaseOptionsWithAI,
  completeBaseOptionLineWithAI
};

async function testExcelExtraction(req, res) {
  try {
    const { modelId, configId } = req.params;
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    const model = (data.models || []).find(m => m.id === modelId);
    const config = model?.configurations?.find(c => c.id === configId);
    const excelPath = config?.pdfAnalysis?.excelFilePath;
    
    if (!excelPath || !fs.existsSync(excelPath)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Fichier Excel introuvable pour cette configuration' 
      });
    }

    console.log('🧪 Lancement des tests d\'extraction sur:', excelPath);
    
    // Récupérer aussi le chemin du PDF original si disponible
    const pdfPath = config?.pdfAnalysis?.pdfFilePath || null;
    
    const results = await ExcelExtractionTester.runAllTests(excelPath, pdfPath);

    res.json({ 
      success: true, 
      data: { 
        filePath: excelPath,
        fileName: path.basename(excelPath),
        results: results
      } 
    });
  } catch (error) {
    console.error('❌ UGAP testExcelExtraction error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Erreur serveur',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

async function verifyOptionWithAI(req, res) {
  try {
    const { categoryId, optionId, prompt } = req.body;
    
    if (!categoryId || !optionId || !prompt) {
      return res.status(400).json({ 
        success: false, 
        message: 'categoryId, optionId et prompt sont requis' 
      });
    }
    
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data || !data.categories) {
      return res.status(404).json({ 
        success: false, 
        message: 'Données non trouvées' 
      });
    }
    
    const category = data.categories.find(cat => cat.id === categoryId);
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: 'Catégorie non trouvée' 
      });
    }
    
    const option = (category.options || []).find(opt => opt.id === optionId);
    if (!option) {
      return res.status(404).json({ 
        success: false, 
        message: 'Option non trouvée' 
      });
    }
    
    // Appeler l'IA pour vérifier l'option
    const aiService = new UgapAIService(req.entrepriseDb, req.entrepriseId);
    const iaClient = await aiService.resolveAiClient();
    const aiResponse = await iaClient.sendAnalysisPrompt(prompt, { stream: false });
    
    // Parser la réponse JSON
    const aiText = aiResponse.data?.response || aiResponse.response || '';
    let recommendation = null;
    
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        recommendation = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Erreur parsing réponse IA:', parseError);
      return res.status(500).json({ 
        success: false, 
        message: 'Erreur lors du parsing de la réponse IA' 
      });
    }
    
    res.json({
      success: true,
      recommendation
    });
  } catch (error) {
    console.error('❌ UGAP verifyOptionWithAI error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Erreur serveur' 
    });
  }
}

async function downloadCamelotExcel(req, res) {
  try {
    const { modelId, configId } = req.params;
    
    console.log(`📥 Demande de téléchargement Excel Camelot: modelId=${modelId}, configId=${configId}`);
    
    // Récupérer la configuration (même méthode que mapConfigurationExcel)
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    const model = (data.models || []).find(m => m.id === modelId);
    const config = model?.configurations?.find(c => c.id === configId);
    
    if (!config || !config.pdfAnalysis) {
      console.error('❌ Configuration ou analyse PDF non trouvée');
      return res.status(404).json({ 
        success: false, 
        message: 'Configuration ou analyse PDF non trouvée' 
      });
    }
    
    const excelPath = config.pdfAnalysis.camelotExcelPath;
    const excelFileName = config.pdfAnalysis.camelotExcelFileName || `camelot_${configId}.xlsx`;
    
    console.log(`📁 Chemin Excel recherché: ${excelPath}`);
    console.log(`📄 Nom de fichier: ${excelFileName}`);
    
    if (!excelPath) {
      console.error('❌ Aucun chemin Excel sauvegardé dans pdfAnalysis');
      console.error('📋 Contenu de pdfAnalysis:', JSON.stringify(config.pdfAnalysis, null, 2));
      return res.status(404).json({ 
        success: false, 
        message: 'Fichier Excel Camelot non trouvé dans la configuration. Le mapping n\'a peut-être pas été complété ou le fichier n\'a pas été sauvegardé. Relancez le mapping pour générer un nouveau fichier.' 
      });
    }
    
    const resolvedPath = path.resolve(excelPath);
    console.log(`📁 Chemin résolu: ${resolvedPath}`);
    console.log(`✅ Fichier existe: ${fs.existsSync(resolvedPath)}`);
    
    if (!fs.existsSync(resolvedPath)) {
      console.error('❌ Fichier Excel non trouvé à l\'emplacement:', resolvedPath);
      return res.status(404).json({ 
        success: false, 
        message: `Fichier Excel Camelot non trouvé à l'emplacement: ${resolvedPath}. Relancez le mapping.` 
      });
    }
    
    // Vérifier que c'est bien un fichier
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      console.error('❌ Le chemin ne pointe pas vers un fichier');
      return res.status(400).json({ 
        success: false, 
        message: 'Le chemin ne pointe pas vers un fichier valide' 
      });
    }
    
    console.log(`✅ Envoi du fichier: ${excelFileName} (${stats.size} bytes)`);
    
    // Envoyer le fichier
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${excelFileName}"`);
    res.setHeader('Content-Length', stats.size);
    res.sendFile(resolvedPath);
  } catch (error) {
    console.error('❌ UGAP downloadCamelotExcel error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

/**
 * Convertit un PDF en Excel (outil standalone)
 */
async function convertPdfToExcel(req, res) {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier PDF fourni' });
    }
    
    const isPdf = file.mimetype === 'application/pdf' || file.originalname?.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return res.status(400).json({ success: false, message: 'Le fichier doit être un PDF' });
    }
    
    // Convertir le PDF en Excel
    const result = await PdfToExcelConverter.convert(file.path);
    
    // Construire l'URL de téléchargement
    const excelUrl = `/api/ugap/download-excel/${encodeURIComponent(result.fileName)}`;
    
    res.json({
      success: true,
      message: 'Conversion PDF vers Excel réussie',
      data: {
        excelPath: result.excelPath,
        fileName: result.fileName,
        excelUrl,
        stats: result.stats
      }
    });
  } catch (error) {
    console.error('❌ UGAP convertPdfToExcel error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

/**
 * Télécharge un fichier Excel converti
 */
async function downloadExcel(req, res) {
  try {
    const { fileName } = req.params;
    const decodedFileName = decodeURIComponent(fileName);
    
    // Chercher dans plusieurs dossiers possibles
    const possibleDirs = [
      path.join(__dirname, '../uploads/pdf-to-excel'),
      path.join(__dirname, '../uploads/camelot-mapping')
    ];
    
    let excelPath = null;
    for (const dir of possibleDirs) {
      const testPath = path.join(dir, decodedFileName);
      if (fs.existsSync(testPath)) {
        excelPath = testPath;
        break;
      }
    }
    
    if (!excelPath) {
      return res.status(404).json({ success: false, message: 'Fichier Excel introuvable' });
    }
    
    const stats = fs.statSync(excelPath);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${decodedFileName}"`);
    res.setHeader('Content-Length', stats.size);
    res.sendFile(path.resolve(excelPath));
  } catch (error) {
    console.error('❌ UGAP downloadExcel error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

/**
 * Affiche un fichier Excel en HTML dans le navigateur
 */
async function viewExcelAsHtml(req, res) {
  try {
    const { fileName } = req.params;
    const decodedFileName = decodeURIComponent(fileName);
    
    // Chercher dans plusieurs dossiers possibles
    const possibleDirs = [
      path.join(__dirname, '../uploads/pdf-to-excel'),
      path.join(__dirname, '../uploads/camelot-mapping')
    ];
    
    let excelPath = null;
    for (const dir of possibleDirs) {
      const testPath = path.join(dir, decodedFileName);
      if (fs.existsSync(testPath)) {
        excelPath = testPath;
        break;
      }
    }
    
    if (!excelPath) {
      return res.status(404).send('<html><body><h1>Fichier Excel introuvable</h1></body></html>');
    }
    
    // Lire l'Excel
    const wb = XLSX.readFile(excelPath, { cellStyles: true });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    
    // Convertir en HTML avec les couleurs
    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${decodedFileName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 10px; background: #f5f5f5; }
        table { border-collapse: collapse; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        td, th { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 12px; }
        th { background: #f0f0f0; font-weight: bold; }
        .container { overflow: auto; max-height: 90vh; }
    </style>
</head>
<body>
    <h2>${decodedFileName}</h2>
    <div class="container">
        <table>
`;
    
    // Parcourir les lignes et colonnes
    for (let r = range.s.r; r <= range.e.r; r++) {
      html += '<tr>';
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        const cell = ws[cellAddress];
        
        const cellValue = cell ? (cell.v !== undefined ? String(cell.v) : '') : '';
        const isHeader = r === range.s.r;
        
        // Récupérer la couleur de fond
        let bgColor = '';
        if (cell && cell.s && cell.s.fill) {
          const fill = cell.s.fill;
          if (fill.fgColor && fill.fgColor.rgb) {
            bgColor = `#${fill.fgColor.rgb}`;
          } else if (fill.bgColor && fill.bgColor.rgb) {
            bgColor = `#${fill.bgColor.rgb}`;
          }
        }
        
        // Si pas de couleur dans le style, essayer de récupérer depuis le workbook
        if (!bgColor && cell) {
          const cellColor = getCellColor(cell, wb);
          if (cellColor) {
            bgColor = `#${cellColor}`;
          }
        }
        
        const style = bgColor ? `background-color: ${bgColor};` : '';
        const tag = isHeader ? 'th' : 'td';
        
        html += `<${tag} style="${style}">${escapeHtml(cellValue)}</${tag}>`;
      }
      html += '</tr>';
    }
    
    html += `
        </table>
    </div>
</body>
</html>
`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('❌ UGAP viewExcelAsHtml error:', error);
    res.status(500).send(`<html><body><h1>Erreur: ${error.message}</h1></body></html>`);
  }
}

// Fonction helper pour échapper HTML
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Importe un fichier (PDF ou Excel) dans une configuration
 * Si PDF : convertit en Excel avec Camelot puis sauvegarde
 * Si Excel : sauvegarde directement
 */
async function importConfigurationFile(req, res) {
  try {
    const { modelId, configId } = req.params;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    }
    
    const isPdf = file.mimetype === 'application/pdf' || file.originalname?.toLowerCase().endsWith('.pdf');
    const isExcel = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.mimetype === 'application/vnd.ms-excel' ||
                    file.originalname?.toLowerCase().endsWith('.xlsx') ||
                    file.originalname?.toLowerCase().endsWith('.xls');
    
    if (!isPdf && !isExcel) {
      return res.status(400).json({ success: false, message: 'Le fichier doit être un PDF ou un Excel' });
    }
    
    // Récupérer la configuration
    const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Aucune donnée configurée' });
    }
    
    const model = (data.models || []).find(m => m.id === modelId);
    const config = model?.configurations?.find(c => c.id === configId);
    
    if (!model || !config) {
      return res.status(404).json({ success: false, message: 'Modèle ou configuration non trouvé' });
    }
    
    let excelPath = null;
    let excelFileName = null;
    let pdfPath = null;
    
    if (isPdf) {
      // Convertir PDF en Excel avec Camelot
      pdfPath = file.path;
      const conversionResult = await PdfToExcelConverter.convert(pdfPath);
      excelPath = conversionResult.excelPath;
      excelFileName = conversionResult.fileName;
    } else {
      // Excel directement : copier vers le répertoire de stockage
      const excelDir = path.join(__dirname, '../uploads/configurations');
      if (!fs.existsSync(excelDir)) {
        fs.mkdirSync(excelDir, { recursive: true });
      }
      
      excelFileName = `config_${configId}_${Date.now()}.xlsx`;
      excelPath = path.join(excelDir, excelFileName);
      fs.copyFileSync(file.path, excelPath);
    }
    
    // Sauvegarder les informations dans la configuration
    const analysis = {
      fileName: file.originalname,
      fileType: isPdf ? 'pdf' : 'excel',
      pdfFilePath: pdfPath || null,
      excelFilePath: excelPath,
      excelFileName: excelFileName,
      excelUrl: `/api/ugap/models/${modelId}/configurations/${configId}/excel`,
      uploadedAt: new Date(),
      imported: true
    };
    
    await UgapDataService.updateModelConfiguration(
      req.entrepriseDb,
      req.entrepriseId,
      modelId,
      configId,
      { pdfAnalysis: analysis }
    );
    
    res.json({
      success: true,
      message: isPdf ? 'PDF importé et converti en Excel avec succès' : 'Fichier Excel importé avec succès',
      data: {
        analysis,
        excelPath,
        excelFileName,
        converted: isPdf
      }
    });
  } catch (error) {
    console.error('❌ UGAP importConfigurationFile error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}
