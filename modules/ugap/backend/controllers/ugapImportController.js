/**
 * FICHIER : modules/ugap/backend/controllers/ugapImportController.js
 * RÔLE : Handlers HTTP import Excel et zone tampon (staging).
 * ENTRÉES : req.entrepriseDb, req.entrepriseId, params/body import.
 * SORTIES : JSON success/data pour routes /api/ugap/import et /imports/staging/*.
 * DÉPEND DE : UgapDataService, UgapExcelService, UgapAIService, path, fs, crypto.
 * NE PAS : catalogue publié, modèles hors staging, prompts, configurations PDF.
 * APPELÉ PAR : routes.js via ugapController (réexport).
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const UgapDataService = require('../services/UgapDataService');
const UgapExcelService = require('../services/UgapExcelService');
const UgapAIService = require('../services/UgapAIService');
const buildExcelDetectionReport = require('../services/excel-detect/buildExcelDetectionReport');

const DEFAULT_SOURCE_XLSX = path.join(__dirname, '../../source/TARIF ALU UGAP 2024(6).xlsx');

async function importExcel(req, res) {
  try {
    const filePath = DEFAULT_SOURCE_XLSX;
    const extractedData = UgapExcelService.extractData(filePath);
    const sourceBuffer = fs.readFileSync(filePath);
    const sourceFileHash = crypto.createHash('sha256').update(sourceBuffer).digest('hex');

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

    const allOptions = Array.isArray(extractedData.importOptions) && extractedData.importOptions.length
      ? extractedData.importOptions
      : (extractedData.categories || []).flatMap((cat) => cat.options || []);
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

        allOptions.forEach((opt) => {
          if (opt && typeof opt === 'object') {
            const ai = byId.get(String(opt.id || '').trim());
            if (!ai) return;
            if ((ai.confidence || 0) < minConfidence) return;
            if (ai.changeType) opt.changeType = ai.changeType;
            if (ai.initialProduct) opt.initialProduct = ai.initialProduct;
            if (ai.finalProduct) opt.finalProduct = ai.finalProduct;
          }
        });
      } catch (aiErr) {
        console.warn('⚠️ UGAP importExcel: enrichissement IA options de base ignoré:', aiErr.message || aiErr);
      }
    }

    let staging = await UgapDataService.saveImportStaging(req.entrepriseDb, req.entrepriseId, {
      ...extractedData,
      source: {
        sourceFileName: path.basename(filePath),
        sourceFileHash,
        sourceFilePath: filePath,
        importedAt: new Date()
      }
    });
    staging = await UgapDataService.finalizeImportStagingRead(req.entrepriseDb, staging);

    const refsFound = (staging.models || []).filter((m) => String(m?.refUgap || '').trim()).length;
    console.log(
      `✅ UGAP import: ${refsFound}/${(staging.models || []).length} modèle(s) avec ref UGAP (col ${extractedData.structure?.refUgapCol ?? '?'})`
    );

    res.json({
      success: true,
      message: 'Import en zone tampon réussi',
      data: {
        importId: String(staging._id),
        staging,
        status: staging.status,
        alreadyProcessed: !!staging.alreadyProcessed,
        alreadyValidated: !!staging.alreadyValidated,
        modelsCount: extractedData.models.length,
        modelsWithRefUgap: refsFound,
        refUgapCol: extractedData.structure?.refUgapCol ?? -1,
        categoriesCount: 0,
        optionsCount: allOptions.length
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
    const { staging, syncWarning = '' } = await UgapDataService.markImportModelsValidated(
      req.entrepriseDb,
      req.entrepriseId,
      importId,
      modelIds,
      modelUpdates
    );
    const warn = String(syncWarning || '').trim();
    res.json({
      success: true,
      message: warn
        ? `Validation modèles mise à jour (${warn})`
        : 'Validation modèles mise à jour',
      data: staging,
      syncWarning: warn || undefined
    });
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
    const filePath = DEFAULT_SOURCE_XLSX;
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
    const filePath = DEFAULT_SOURCE_XLSX;
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

async function reopenImportStaging(req, res) {
  try {
    const { importId } = req.params;
    const data = await UgapDataService.reopenImportStaging(
      req.entrepriseDb,
      req.entrepriseId,
      importId
    );
    res.json({
      success: true,
      message: 'Import rouvert pour reprise',
      data
    });
  } catch (error) {
    console.error('❌ UGAP reopenImportStaging error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function detectExcelPreview(req, res) {
  try {
    const requested = String(req.query?.file || req.body?.file || '').trim();
    const filePath = requested || DEFAULT_SOURCE_XLSX;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: `Fichier Excel introuvable : ${filePath}`
      });
    }
    const report = buildExcelDetectionReport(filePath);
    res.json({ success: true, data: report });
  } catch (error) {
    console.error('❌ UGAP detectExcelPreview error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur détection Excel' });
  }
}

module.exports = {
  detectExcelPreview,
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
  reopenImportStaging
};
