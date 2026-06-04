const DocumentService = require('../services/DocumentService');

async function list(req, res) {
  try {
    const { slotCode, tag } = req.query;
    const docs = await DocumentService.listByProject(req.entrepriseDb, req.params.id, {
      slotCode: slotCode || null,
      tag: tag || null
    });
    res.json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function upload(req, res) {
  try {
    const slotCode = req.body.slotCode || req.query.slotCode;
    if (!slotCode) {
      return res.status(400).json({ success: false, message: 'slotCode requis' });
    }

    const files = req.files?.length ? req.files : req.file ? [req.file] : [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
    }

    let extraMetadata = {};
    if (req.body.metadata) {
      try {
        extraMetadata = typeof req.body.metadata === 'string' ? JSON.parse(req.body.metadata) : req.body.metadata;
      } catch {
        return res.status(400).json({ success: false, message: 'metadata JSON invalide' });
      }
    }

    let clientFileMeta = [];
    if (req.body.clientFileMeta) {
      try {
        clientFileMeta =
          typeof req.body.clientFileMeta === 'string'
            ? JSON.parse(req.body.clientFileMeta)
            : req.body.clientFileMeta;
        if (!Array.isArray(clientFileMeta)) clientFileMeta = [];
      } catch {
        return res.status(400).json({ success: false, message: 'clientFileMeta JSON invalide' });
      }
    }

    const created = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const hint = pickClientFileHint(file, clientFileMeta, i);
      const doc = await DocumentService.addFromUpload(
        req.entrepriseDb,
        req.entrepriseId,
        req.params.id,
        slotCode,
        file,
        req.userId,
        extraMetadata,
        hint
      );
      created.push(doc);
    }

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Doc-Hub upload:', error);
    res.status(400).json({ success: false, message: error.message });
  }
}

async function updateTags(req, res) {
  try {
    const tags = req.body.tags;
    if (!Array.isArray(tags)) {
      return res.status(400).json({ success: false, message: 'tags doit être un tableau de codes' });
    }

    const catalog = await req.entrepriseDb.collection('doc_hub_tags').find({}).toArray();
    const allowed = new Set(catalog.map((t) => t.code));
    const invalid = tags.filter((t) => !allowed.has(t));
    if (invalid.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Tags inconnus : ${invalid.join(', ')}. Utilisez le catalogue ou créez-les via Gérer les tags.`
      });
    }

    const doc = await DocumentService.updateTags(req.entrepriseDb, req.params.id, tags);
    if (!doc) return res.status(404).json({ success: false, message: 'Document introuvable' });
    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function remove(req, res) {
  try {
    const ok = await DocumentService.remove(req.entrepriseDb, req.params.id, req.entrepriseId);
    if (!ok) return res.status(404).json({ success: false, message: 'Document introuvable' });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function bulkRemove(req, res) {
  try {
    const documentIds = req.body.documentIds;
    if (!Array.isArray(documentIds) || !documentIds.length) {
      return res.status(400).json({ success: false, message: 'documentIds (tableau) requis' });
    }

    const result = await DocumentService.removeMany(
      req.entrepriseDb,
      req.params.id,
      documentIds,
      req.entrepriseId
    );

    if (result.deleted === 0 && result.failed.length) {
      return res.status(404).json({
        success: false,
        message: 'Aucun document supprimé',
        data: result
      });
    }

    res.json({
      success: true,
      message: `${result.deleted} document(s) supprimé(s)`,
      data: result
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

function pickClientFileHint(file, metaList, index) {
  if (!Array.isArray(metaList) || !metaList.length) return null;
  const entry = metaList[index];
  if (entry && (!entry.originalName || entry.originalName === file.originalname)) {
    return entry;
  }
  return metaList.find((m) => m && m.originalName === file.originalname) || null;
}

module.exports = { list, upload, updateTags, remove, bulkRemove };
