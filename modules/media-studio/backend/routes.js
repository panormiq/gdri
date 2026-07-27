/**
 * Routes Studio Média
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { ObjectId } = require('mongodb');
const router = express.Router();
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const database = require(path.join(__dirname, '../../../backend/config/database'));
const ComfyUIService = require('./services/ComfyUIService');
const ChromaKeyService = require('./services/ChromaKeyService');
const ObjectExtractService = require('./services/ObjectExtractService');
const AnimationPromptService = require('./services/AnimationPromptService');
const AnimateI2vService = require('./services/AnimateI2vService');
const VideoProcessService = require('./services/VideoProcessService');
const { wrapObjectPrompt, getObjectGenerationSize, resolveChroma } = require('./services/ObjectGenerationHelper');
const { buildCharacterPrompt } = require('./services/CharacterGenerationHelper');
const { normalizeHex } = require('./services/ChromaColorService');
const studioConfig = require('./config.json');

const comfy = new ComfyUIService();
const chromaKey = new ChromaKeyService(studioConfig.chromaKey || {});
const objectExtract = new ObjectExtractService(studioConfig.extract || {});
const animationPrompt = new AnimationPromptService();
const animateI2v = new AnimateI2vService(comfy, studioConfig.i2v || {});
const videoProcess = new VideoProcessService(studioConfig.i2v?.video || {});
const UPLOADS_DIR = path.join(__dirname, '../../../backend/uploads');
const REFS_DIR = path.join(UPLOADS_DIR, 'media-studio', 'refs');
const IMPORTS_DIR = path.join(UPLOADS_DIR, 'media-studio', 'imports');
const MEDIA_DIR = path.join(UPLOADS_DIR, 'media-studio');
const CLIPS_DIR = path.join(UPLOADS_DIR, 'media-studio', 'clips');

animateI2v.setClipsDir(CLIPS_DIR);

function loadPngMeta(buffer) {
  const PNG = require(path.join(__dirname, '../../../backend/node_modules/pngjs')).PNG;
  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height };
}

function saveImportBuffer(buffer, originalName = 'import.png') {
  fs.mkdirSync(IMPORTS_DIR, { recursive: true });
  const filename = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const fullPath = path.join(IMPORTS_DIR, filename);
  fs.writeFileSync(fullPath, buffer);
  const meta = loadPngMeta(buffer);
  return {
    filename,
    fullPath,
    url: `/api/media-studio/import/${filename}`,
    originalName: path.basename(originalName),
    width: meta.width,
    height: meta.height,
  };
}

function saveReferenceBuffer(buffer, originalName = 'reference.png') {
  fs.mkdirSync(REFS_DIR, { recursive: true });
  const ext = path.extname(originalName).toLowerCase() || '.png';
  const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.png';
  const filename = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
  const fullPath = path.join(REFS_DIR, filename);
  fs.writeFileSync(fullPath, buffer);
  return {
    filename,
    fullPath,
    url: `/api/media-studio/reference/${filename}`,
    originalName: path.basename(originalName),
  };
}

function getEntityId(req) {
  const entityId = req.user && (req.user.currentEntrepriseId || req.user.entrepriseId);
  return entityId ? String(entityId) : null;
}

function getUserId(req) {
  return req.user && (req.user.user_id || req.user.sub || req.user._id)
    ? String(req.user.user_id || req.user.sub || req.user._id)
    : null;
}

router.get('/health', authenticateJWT, async (req, res) => {
  try {
    const status = await comfy.checkHealth();
    return res.json({
      success: true,
      data: {
        comfyui: status,
        defaultModel: comfy.defaultModel,
        models: comfy.listModels(),
        extract: await objectExtract.getStatus(),
        i2v: {
          defaultEngine: (studioConfig.i2v || {}).defaultEngine || 'ltx',
          ffmpeg: !!videoProcess.findFfmpeg(),
          ltx: (studioConfig.i2v || {}).ltx || {},
          status: await comfy.getI2vStatus().catch((err) => ({ ready: false, error: err.message })),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/generations', authenticateJWT, async (req, res) => {
  try {
    const entityId = getEntityId(req);
    const userId = getUserId(req);
    const col = database.getCollection('media_studio_generations');
    const items = await col
      .find({ entity_id: entityId, user_id: userId })
      .sort({ created_at: -1 })
      .limit(200)
      .toArray();
    const data = items.map((item) => ({
      ...item,
      id: String(item._id),
      _id: String(item._id),
    }));
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

function resolveGenerationFilePath(record) {
  const filename = path.basename(String((record && record.filename) || ''));
  if (!filename || filename === '.' || filename === '..') return null;
  if (record.type === 'i2v_clip') {
    const clipPath = path.join(CLIPS_DIR, filename);
    if (fs.existsSync(clipPath)) return clipPath;
  }
  const mediaPath = path.join(MEDIA_DIR, filename);
  if (fs.existsSync(mediaPath)) return mediaPath;
  return null;
}

async function deleteGenerationRecords(entityId, userId, ids) {
  const uniqueIds = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const objectIds = uniqueIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (!objectIds.length) {
    return { deleted: [], missing: uniqueIds, deletedCount: 0 };
  }

  const col = database.getCollection('media_studio_generations');
  const records = await col.find({
    _id: { $in: objectIds },
    entity_id: entityId,
    user_id: userId,
  }).toArray();

  const foundIds = new Set(records.map((r) => String(r._id)));
  const missing = uniqueIds.filter((id) => !foundIds.has(id));

  if (records.length) {
    await col.deleteMany({
      _id: { $in: records.map((r) => r._id) },
      entity_id: entityId,
      user_id: userId,
    });
  }

  for (const record of records) {
    const filePath = resolveGenerationFilePath(record);
    if (!filePath) continue;
    try {
      fs.unlinkSync(filePath);
    } catch (fileErr) {
      console.warn('[media-studio] delete file:', fileErr.message);
    }
  }

  return {
    deleted: records.map((r) => String(r._id)),
    missing,
    deletedCount: records.length,
  };
}

router.delete('/generations/:id', authenticateJWT, async (req, res) => {
  try {
    const entityId = getEntityId(req);
    const userId = getUserId(req);
    const id = String(req.params.id || '').trim();
    if (!entityId || !userId) {
      return res.status(401).json({ success: false, message: 'Authentification requise.' });
    }
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Identifiant invalide.' });
    }

    const result = await deleteGenerationRecords(entityId, userId, [id]);
    if (!result.deletedCount) {
      return res.status(404).json({ success: false, message: 'Création introuvable.' });
    }

    return res.json({
      success: true,
      data: { id: result.deleted[0], deletedCount: 1 },
    });
  } catch (error) {
    console.error('[media-studio] delete generation:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/generations/delete', authenticateJWT, async (req, res) => {
  try {
    const entityId = getEntityId(req);
    const userId = getUserId(req);
    if (!entityId || !userId) {
      return res.status(401).json({ success: false, message: 'Authentification requise.' });
    }

    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
    if (!ids.length) {
      return res.status(400).json({ success: false, message: 'Aucune création sélectionnée.' });
    }
    if (ids.length > 200) {
      return res.status(400).json({ success: false, message: 'Trop de créations sélectionnées (max 200).' });
    }

    const result = await deleteGenerationRecords(entityId, userId, ids);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[media-studio] delete generations:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/upload-reference', authenticateJWT, (req, res) => {
  try {
    const dataUrl = String((req.body && req.body.dataUrl) || '').trim();
    const originalName = String((req.body && req.body.filename) || 'reference.png');
    if (!dataUrl.startsWith('data:image/')) {
      return res.status(400).json({ success: false, message: 'Image invalide (dataUrl attendu).' });
    }
    const match = dataUrl.match(/^data:image\/[\w+.-]+;base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Format dataUrl non supporté.' });
    }
    const buffer = Buffer.from(match[1], 'base64');
    if (buffer.length > 8 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Image trop volumineuse (max 8 Mo).' });
    }
    const saved = saveReferenceBuffer(buffer, originalName);
    return res.status(201).json({
      success: true,
      data: {
        filename: saved.filename,
        url: saved.url,
        originalName: saved.originalName,
      },
    });
  } catch (error) {
    console.error('[media-studio] upload-reference:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/generate', authenticateJWT, async (req, res) => {
  try {
    const prompt = String((req.body && req.body.prompt) || '').trim();
    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Le prompt est requis.' });
    }

    const health = await comfy.checkHealth();
    if (!health.ok) {
      return res.status(503).json({
        success: false,
        message: health.message || `ComfyUI indisponible. Lancez ComfyUI Desktop puis réessayez.`,
        code: 'COMFYUI_UNAVAILABLE',
      });
    }

    const model = String((req.body && req.body.model) || '').trim() || undefined;
    const isCharacter = req.body.character === true;
    let transparent = req.body.transparent === true || req.body.layer === true || isCharacter;
    const orientation = req.body.orientation && typeof req.body.orientation === 'object'
      ? req.body.orientation
      : null;
    const referenceFilename = req.body.referenceFilename
      ? path.basename(String(req.body.referenceFilename))
      : null;
    const chromaColorInput = req.body.chromaColor != null && String(req.body.chromaColor).trim()
      ? normalizeHex(String(req.body.chromaColor).trim())
      : null;
    const layerMeta = {
      prompt,
      chromaColor: chromaColorInput,
    };
    const options = {
      model,
      width: Number(req.body.width) || undefined,
      height: Number(req.body.height) || undefined,
      seed: req.body.seed != null ? Number(req.body.seed) : undefined,
    };

    if (transparent && !isCharacter) {
      const autoSize = getObjectGenerationSize(layerMeta);
      options.width = autoSize.width;
      options.height = autoSize.height;
    }

    let chromaUsed = null;
    let generationPrompt = prompt;
    if (isCharacter) {
      generationPrompt = buildCharacterPrompt(prompt, orientation, { hasReference: !!referenceFilename });
    }
    if (transparent) {
      const wrapBase = isCharacter ? generationPrompt : prompt;
      const wrapped = wrapObjectPrompt(wrapBase, {
        ...layerMeta,
        prompt: `${prompt} ${wrapBase}`,
      });
      generationPrompt = wrapped.prompt;
      chromaUsed = wrapped.chroma;
      if (!chromaUsed || !Array.isArray(chromaUsed.rgb)) {
        chromaUsed = resolveChroma({ ...layerMeta, prompt: `${prompt} ${wrapBase}` });
      }
    }

    if (referenceFilename) {
      const refPath = path.join(REFS_DIR, referenceFilename);
      if (fs.existsSync(refPath)) {
        options.referenceImagePath = refPath;
        options.denoise = transparent
          ? Math.max(Number(req.body.referenceDenoise) || 0, 0.88)
          : (Number(req.body.referenceDenoise) || 0.72);
      }
    }

    let { buffer, imageMeta, promptId, seed, model: usedModel, width, height } = await comfy.generateImage(generationPrompt, options);

    if (transparent) {
      if (!chromaUsed || !Array.isArray(chromaUsed.rgb)) {
        return res.status(500).json({
          success: false,
          message: 'Couleur chroma introuvable pour le détourage.',
        });
      }
      try {
        const chromaResult = chromaKey.processPngBuffer(buffer, chromaUsed.rgb);
        buffer = chromaResult.buffer;
        if (chromaResult.keyDetected && chromaResult.keyUsed) {
          const [r, g, b] = chromaResult.keyUsed;
          const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
          chromaUsed = {
            ...chromaUsed,
            rgb: chromaResult.keyUsed,
            hex,
            detected: true,
          };
        }
      } catch (chromaErr) {
        console.error('[media-studio] chroma key:', chromaErr);
        return res.status(500).json({
          success: false,
          message: chromaErr.message || 'Détourage fond chroma impossible.',
        });
      }
    }

    const saved = comfy.saveToUploads(buffer, UPLOADS_DIR, transparent ? 'layer' : 'img');

    const record = {
      entity_id: getEntityId(req),
      user_id: getUserId(req),
      prompt,
      generation_prompt: generationPrompt,
      transparent,
      chroma_color: chromaUsed ? chromaUsed.hex : null,
      model: usedModel,
      url: saved.url,
      filename: saved.filename,
      seed,
      prompt_id: promptId,
      comfy_meta: imageMeta,
      width,
      height,
      created_at: new Date(),
    };

    const col = database.getCollection('media_studio_generations');
    const result = await col.insertOne(record);
    record._id = result.insertedId;

    return res.status(201).json({
      success: true,
      data: {
        id: String(result.insertedId),
        url: saved.url,
        filename: saved.filename,
        prompt,
        generation_prompt: generationPrompt,
        chroma_color: chromaUsed ? chromaUsed.hex : null,
        chroma_key_rgb: chromaUsed && chromaUsed.rgb ? chromaUsed.rgb : null,
        chroma_detected_from_image: !!(chromaUsed && chromaUsed.detected),
        seed,
        model: usedModel,
        transparent,
        used_reference: !!referenceFilename,
        width: record.width,
        height: record.height,
      },
    });
  } catch (error) {
    console.error('[media-studio] generate:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la génération.',
    });
  }
});

router.post('/upload-import', authenticateJWT, (req, res) => {
  try {
    const dataUrl = String((req.body && req.body.dataUrl) || '').trim();
    const originalName = String((req.body && req.body.filename) || 'import.png');
    if (!dataUrl.startsWith('data:image/')) {
      return res.status(400).json({ success: false, message: 'Image invalide (dataUrl attendu).' });
    }
    const match = dataUrl.match(/^data:image\/[\w+.-]+;base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Format dataUrl non supporté.' });
    }
    const buffer = Buffer.from(match[1], 'base64');
    if (buffer.length > 12 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Image trop volumineuse (max 12 Mo).' });
    }
    const saved = saveImportBuffer(buffer, originalName);
    return res.status(201).json({
      success: true,
      data: {
        filename: saved.filename,
        url: saved.url,
        originalName: saved.originalName,
        width: saved.width,
        height: saved.height,
      },
    });
  } catch (error) {
    console.error('[media-studio] upload-import:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/animate-prompt', authenticateJWT, (req, res) => {
  try {
    const prompt = String((req.body && req.body.prompt) || '').trim();
    const width = clampDim(Number(req.body.width) || 256, 32, 4096);
    const height = clampDim(Number(req.body.height) || 256, 32, 4096);
    const llmText = req.body.llmText ? String(req.body.llmText) : null;

    if (!prompt && !llmText) {
      return res.status(400).json({ success: false, message: 'prompt ou llmText requis.' });
    }

    let spec = prompt
      ? animationPrompt.parseFromRules(prompt, width, height)
      : animationPrompt.parseFromLlmText(llmText, width, height);

    if (!spec) {
      return res.status(422).json({ success: false, message: 'JSON animation LLM invalide.' });
    }

    if (prompt && llmText) {
      const llmSpec = animationPrompt.parseFromLlmText(llmText, width, height);
      if (llmSpec) spec = animationPrompt.mergeSpecs(spec, llmSpec);
    }

    const layerStub = { zonesByCadre: {}, fullEffectsByCadre: {} };
    const applied = animationPrompt.applySpecToLayer(layerStub, 'cadre', spec, width, height);

    return res.json({
      success: true,
      data: {
        spec,
        summary: spec.summary || prompt.slice(0, 80),
        pixelZones: layerStub.zonesByCadre.cadre || [],
        fullEffects: layerStub.fullEffectsByCadre.cadre || [],
        zoneCount: applied.zoneCount,
        fullEffectCount: applied.fullEffectCount,
        systemPrompt: animationPrompt.getSystemPrompt(),
      },
    });
  } catch (error) {
    console.error('[media-studio] animate-prompt:', error);
    return res.status(500).json({ success: false, message: error.message || 'Erreur animation prompt.' });
  }
});

function saveDataUrlPng(dataUrl, prefix = 'frame') {
  const m = String(dataUrl || '').match(/^data:image\/png;base64,(.+)$/i);
  if (!m) throw new Error('imageDataUrl PNG invalide (data:image/png;base64,…).');
  const buffer = Buffer.from(m[1], 'base64');
  if (buffer.length < 32) throw new Error('imageDataUrl vide.');
  if (buffer.length > 25 * 1024 * 1024) throw new Error('imageDataUrl trop volumineux (max 25 Mo).');
  fs.mkdirSync(IMPORTS_DIR, { recursive: true });
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const fullPath = path.join(IMPORTS_DIR, filename);
  fs.writeFileSync(fullPath, buffer);
  return { filename, fullPath };
}

router.post('/animate-i2v', authenticateJWT, async (req, res) => {
  try {
    const prompt = String((req.body && req.body.prompt) || '').trim();
    const sourceFilename = req.body.sourceFilename
      ? path.basename(String(req.body.sourceFilename))
      : null;
    const imageDataUrl = req.body.imageDataUrl ? String(req.body.imageDataUrl) : null;
    const layerTitle = String((req.body && req.body.layerTitle) || '').trim();
    const engine = String((req.body && req.body.engine) || 'ltx').toLowerCase();
    const effectStart = req.body.effectStart != null ? Number(req.body.effectStart) : null;

    if (!sourceFilename && !imageDataUrl) {
      return res.status(400).json({
        success: false,
        message: 'sourceFilename ou imageDataUrl requis (frame du plan).',
      });
    }
    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Décrivez le mouvement (ex. runes qui s\'illuminent).' });
    }

    const health = await comfy.checkHealth();
    if (!health.ok) {
      return res.status(503).json({
        success: false,
        message: health.message || 'ComfyUI indisponible. Lancez ComfyUI Desktop.',
        code: 'COMFYUI_UNAVAILABLE',
      });
    }

    const i2vStatus = await comfy.getI2vStatus();
    if (!i2vStatus.ready) {
      return res.status(503).json({
        success: false,
        message: i2vStatus.error
          || `Modèle LTX absent. Placez ${i2vStatus.configured} dans ${i2vStatus.checkpointsDir} puis redémarrez ComfyUI.`,
        code: 'LTX_MODEL_MISSING',
        data: i2vStatus,
      });
    }

    let source;
    if (imageDataUrl) {
      source = saveDataUrlPng(imageDataUrl, 'ltx-frame');
    } else {
      source = resolveAnimationSource(sourceFilename);
    }

    const result = await animateI2v.generateFromSourcePath(source.fullPath, {
      prompt,
      layerTitle,
      engine,
      length: req.body.length != null ? Number(req.body.length) : undefined,
      seed: req.body.seed != null ? Number(req.body.seed) : undefined,
      strength: req.body.strength != null ? Number(req.body.strength) : undefined,
      cfg: req.body.cfg != null ? Number(req.body.cfg) : undefined,
      backgroundColor: req.body.backgroundColor ? normalizeHex(String(req.body.backgroundColor)) : null,
    });

    const record = {
      entity_id: getEntityId(req),
      user_id: getUserId(req),
      type: 'i2v_clip',
      source_filename: sourceFilename || source.filename,
      frame_filename: imageDataUrl ? source.filename : null,
      effect_start: Number.isFinite(effectStart) ? effectStart : null,
      user_prompt: result.user_prompt || prompt,
      prompt: result.ltx_prompt || result.prompt,
      engine,
      chroma_color: result.background_color || null,
      background_color: result.background_color || null,
      url: result.url,
      filename: result.filename,
      width: result.width,
      height: result.height,
      duration: result.duration,
      fps: result.fps,
      seed: result.seed,
      comfy_prompt_id: result.comfy_prompt_id,
      created_at: new Date(),
    };

    const col = database.getCollection('media_studio_generations');
    const insertResult = await col.insertOne(record);
    record._id = insertResult.insertedId;

    return res.status(201).json({
      success: true,
      data: {
        id: String(insertResult.insertedId),
        ...result,
        sourceFilename: sourceFilename || source.filename,
        effectStart: Number.isFinite(effectStart) ? effectStart : null,
      },
    });
  } catch (error) {
    console.error('[media-studio] animate-i2v:', error);
    const msg = error.message || 'Erreur génération clip IA.';
    const isComfy = /ComfyUI|LTXV|node|checkpoint|ckpt_name/i.test(msg);
    return res.status(isComfy ? 502 : 500).json({
      success: false,
      message: msg,
      code: isComfy ? 'COMFYUI_I2V_FAILED' : 'I2V_FAILED',
    });
  }
});

function clampDim(n, min, max) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function resolveAnimationSource(sourceFilename) {
  const base = path.basename(String(sourceFilename || ''));
  if (!base) throw new Error('sourceFilename requis.');
  const mediaPath = path.join(MEDIA_DIR, base);
  if (fs.existsSync(mediaPath)) return { filename: base, fullPath: mediaPath };
  const importPath = path.join(IMPORTS_DIR, base);
  if (fs.existsSync(importPath)) return { filename: base, fullPath: importPath };
  throw new Error(`Fichier source introuvable: ${base}`);
}

router.post('/extract-object', authenticateJWT, async (req, res) => {
  try {
    const sourceFilename = req.body.sourceFilename
      ? path.basename(String(req.body.sourceFilename))
      : null;
    const crop = req.body.crop;
    if (!sourceFilename) {
      return res.status(400).json({ success: false, message: 'sourceFilename requis.' });
    }
    if (!crop || typeof crop !== 'object') {
      return res.status(400).json({ success: false, message: 'crop { x, y, width, height } requis.' });
    }

    const sourcePath = path.join(IMPORTS_DIR, sourceFilename);
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ success: false, message: 'Image source introuvable.' });
    }

    const sourceBuffer = fs.readFileSync(sourcePath);
    const result = await objectExtract.extractFromBuffer(sourceBuffer, {
      x: Number(crop.x) || 0,
      y: Number(crop.y) || 0,
      width: Number(crop.width) || 0,
      height: Number(crop.height) || 0,
    }, { trim: req.body.trim !== false });

    if (!result.backgroundRemoved) {
      return res.status(422).json({
        success: false,
        message: result.message || 'Détourage impossible. Vérifiez le cadre ou installez rembg (Install-RemBG.ps1).',
        code: 'BACKGROUND_NOT_DETECTED',
      });
    }

    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    const title = String((req.body && req.body.title) || '').trim() || 'Objet extrait';
    const filename = `extract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const fullPath = path.join(MEDIA_DIR, filename);
    fs.writeFileSync(fullPath, result.buffer);

    const record = {
      entity_id: getEntityId(req),
      user_id: getUserId(req),
      type: 'extract',
      title,
      source_filename: sourceFilename,
      crop: {
        x: Number(crop.x) || 0,
        y: Number(crop.y) || 0,
        width: Number(crop.width) || 0,
        height: Number(crop.height) || 0,
      },
      background_mode: result.mode,
      trimmed: result.trimmed,
      url: `/api/media-studio/media/${filename}`,
      filename,
      width: result.width,
      height: result.height,
      created_at: new Date(),
    };

    const col = database.getCollection('media_studio_generations');
    const insertResult = await col.insertOne(record);

    return res.status(201).json({
      success: true,
      data: {
        id: String(insertResult.insertedId),
        title,
        url: record.url,
        filename,
        width: result.width,
        height: result.height,
        background_mode: result.mode,
        trimmed: result.trimmed,
        generatedAt: record.created_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('[media-studio] extract-object:', error);
    return res.status(500).json({ success: false, message: error.message || 'Extraction impossible.' });
  }
});

router.get('/import/:filename', authenticateJWT, (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(IMPORTS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Import introuvable.' });
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.type('image/png');
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/reference/:filename', authenticateJWT, (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(REFS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Référence introuvable.' });
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') res.type('image/jpeg');
    else if (ext === '.webp') res.type('image/webp');
    else res.type('image/png');
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/clip/:filename', authenticateJWT, (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(CLIPS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Clip introuvable.' });
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.mp4') res.type('video/mp4');
    else if (ext === '.webm') res.type('video/webm');
    else res.type('application/octet-stream');
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/media/:filename', authenticateJWT, (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, 'media-studio', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Fichier introuvable.' });
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.type('image/png');
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/download/:filename', authenticateJWT, (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, 'media-studio', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Fichier introuvable.' });
    }
    return res.download(filePath, filename);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

function serializeProject(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    _id: String(doc._id),
    title: doc.title || 'Sans titre',
    status: doc.status || 'draft',
    manifest: doc.manifest || null,
    thumbnail: doc.thumbnail || null,
    layerCount: Array.isArray(doc.manifest && doc.manifest.layers) ? doc.manifest.layers.length : 0,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

function parseProjectObjectId(id) {
  const raw = String(id || '').trim();
  if (!ObjectId.isValid(raw)) return null;
  return new ObjectId(raw);
}

/** Liste des scènes sauvegardées de l'utilisateur */
router.get('/projects', authenticateJWT, async (req, res) => {
  try {
    const entityId = getEntityId(req);
    const userId = getUserId(req);
    if (!entityId || !userId) {
      return res.status(400).json({ success: false, message: 'Utilisateur ou entité manquant.' });
    }
    const col = database.getCollection('media_studio_projects');
    const items = await col
      .find({ entity_id: entityId, user_id: userId, status: { $ne: 'archived' } })
      .project({
        title: 1,
        status: 1,
        thumbnail: 1,
        created_at: 1,
        updated_at: 1,
        'manifest.layers': 1,
        'manifest.title': 1,
      })
      .sort({ updated_at: -1 })
      .limit(100)
      .toArray();

    return res.json({ success: true, data: items.map(serializeProject) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/** Détail d'une scène (manifest complet) */
router.get('/projects/:id', authenticateJWT, async (req, res) => {
  try {
    const entityId = getEntityId(req);
    const userId = getUserId(req);
    const oid = parseProjectObjectId(req.params.id);
    if (!oid) return res.status(400).json({ success: false, message: 'Identifiant invalide.' });
    const col = database.getCollection('media_studio_projects');
    const doc = await col.findOne({
      _id: oid,
      entity_id: entityId,
      user_id: userId,
      status: { $ne: 'archived' },
    });
    if (!doc) return res.status(404).json({ success: false, message: 'Scène introuvable.' });
    return res.json({ success: true, data: serializeProject(doc) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/** Créer une scène */
router.post('/projects', authenticateJWT, async (req, res) => {
  try {
    const entityId = getEntityId(req);
    const userId = getUserId(req);
    if (!entityId || !userId) {
      return res.status(400).json({ success: false, message: 'Utilisateur ou entité manquant.' });
    }
    const body = req.body || {};
    const manifest = body.manifest && typeof body.manifest === 'object'
      ? body.manifest
      : {
        version: 1,
        title: String(body.title || 'Sans titre').trim() || 'Sans titre',
        canvas: { width: 1200, height: 630, background: '#ffffff' },
        layers: [],
      };
    if (body.title) manifest.title = String(body.title).trim() || manifest.title || 'Sans titre';
    const now = new Date();
    const doc = {
      entity_id: entityId,
      user_id: userId,
      title: String(manifest.title || 'Sans titre').trim() || 'Sans titre',
      manifest,
      status: 'draft',
      thumbnail: body.thumbnail || null,
      created_at: now,
      updated_at: now,
    };
    const col = database.getCollection('media_studio_projects');
    const result = await col.insertOne(doc);
    doc._id = result.insertedId;
    return res.status(201).json({ success: true, data: serializeProject(doc) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/** Sauvegarder / mettre à jour une scène */
router.put('/projects/:id', authenticateJWT, async (req, res) => {
  try {
    const entityId = getEntityId(req);
    const userId = getUserId(req);
    const oid = parseProjectObjectId(req.params.id);
    if (!oid) return res.status(400).json({ success: false, message: 'Identifiant invalide.' });
    const body = req.body || {};
    const col = database.getCollection('media_studio_projects');
    const existing = await col.findOne({
      _id: oid,
      entity_id: entityId,
      user_id: userId,
      status: { $ne: 'archived' },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Scène introuvable.' });

    const update = { updated_at: new Date() };
    if (body.manifest && typeof body.manifest === 'object') {
      update.manifest = body.manifest;
      if (body.manifest.title) update.title = String(body.manifest.title).trim() || existing.title;
    }
    if (body.title != null) update.title = String(body.title).trim() || existing.title;
    if (body.status === 'draft' || body.status === 'ready') update.status = body.status;
    if (body.thumbnail !== undefined) update.thumbnail = body.thumbnail;

    await col.updateOne({ _id: oid }, { $set: update });
    const doc = await col.findOne({ _id: oid });
    return res.json({ success: true, data: serializeProject(doc) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/** Supprimer une scène */
router.delete('/projects/:id', authenticateJWT, async (req, res) => {
  try {
    const entityId = getEntityId(req);
    const userId = getUserId(req);
    const oid = parseProjectObjectId(req.params.id);
    if (!oid) return res.status(400).json({ success: false, message: 'Identifiant invalide.' });
    const col = database.getCollection('media_studio_projects');
    const result = await col.deleteOne({
      _id: oid,
      entity_id: entityId,
      user_id: userId,
    });
    if (!result.deletedCount) {
      return res.status(404).json({ success: false, message: 'Scène introuvable.' });
    }
    return res.json({ success: true, data: { id: String(oid), deleted: true } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
