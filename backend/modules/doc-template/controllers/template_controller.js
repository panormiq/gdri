// backend/controllers/template_controller.js
const { ObjectId } = require('mongodb');

const ALLOWED_KINDS = ['word', 'canvas', 'html', 'prompt'];

function normalizeKind(raw) {
  const kind = String(raw || '').toLowerCase();
  return ALLOWED_KINDS.includes(kind) ? kind : '';
}

function pickContractMeta(body) {
  if (!body || typeof body !== 'object') return {};
  const out = {};
  const src = (body.blockContract && typeof body.blockContract === 'object')
    ? body.blockContract
    : ((body.promptConfig && body.promptConfig.contract && typeof body.promptConfig.contract === 'object')
      ? body.promptConfig.contract
      : null);
  if (src) {
    const brickId = String(src.brickId || '').trim();
    if (brickId) {
      out.blockContract = {
        brickId,
        version: String(src.version || '1.0.0')
      };
    }
  }
  if (body.fills && typeof body.fills === 'object') out.fills = body.fills;
  if (body.promptConfig && typeof body.promptConfig === 'object') out.promptConfig = body.promptConfig;
  return out;
}

/**
 * 🔹 Templates CRUD
 */

const getAllTemplates = async (req, res) => {
  try {
    const kinds = String(req.query.kinds || req.query.kind || '')
      .split(',')
      .map((s) => String(s || '').trim().toLowerCase())
      .filter(Boolean);
    const query = {};
    if (kinds.length) {
      query.kind = { $in: kinds };
    }
    const templates = await req.entrepriseDb
      .collection('templates')
      .find(query)
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
    const { name, kind, generalStyles, structure, content, defaultCollection, additionalCollections, promptConfig, inputSources } = req.body;
    const entrepriseId = req.entrepriseId || req.user.currentEntrepriseId || req.user.entrepriseId;

    console.log("💡 createTemplate body :", req.body);

    // 🔒 Champs obligatoires
    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Le nom est obligatoire"
      });
    }

    const requestedKind = normalizeKind(kind);
    if (!requestedKind) {
      return res.status(400).json({
        success: false,
        error: 'Le type de template est obligatoire (word, canvas, html ou prompt)'
      });
    }

    // 🔹 Document final
    const templateDoc = {
      name,
      kind: requestedKind,
      generalStyles: generalStyles || {},
      structure: structure || {},
      content: content || '',
      defaultCollection: defaultCollection || null,
      additionalCollections: additionalCollections || [],
      inputSources: Array.isArray(inputSources) ? inputSources : [],

      entrepriseId: entrepriseId && ObjectId.isValid(String(entrepriseId)) && String(entrepriseId).length === 24
        ? new ObjectId(entrepriseId)
        : entrepriseId,

      createdAt: now,
      updatedAt: now
    };
    Object.assign(templateDoc, pickContractMeta(req.body));
    if (requestedKind === 'prompt' && promptConfig && typeof promptConfig === 'object' && !templateDoc.promptConfig) {
      templateDoc.promptConfig = promptConfig;
    }

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
    const existing = await req.entrepriseDb
      .collection('templates')
      .findOne({ _id: new ObjectId(req.params.id) });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template non trouvé' });
    }

    const { _id, kind: bodyKind, ...bodyWithoutId } = req.body;
    const lockedKind = normalizeKind(existing.kind) || normalizeKind(bodyKind) || 'word';

    const updateData = {
      ...bodyWithoutId,
      kind: lockedKind,
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
