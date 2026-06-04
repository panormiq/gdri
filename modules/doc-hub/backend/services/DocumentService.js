/**
 * Documents Doc-Hub
 */

const path = require('path');
const fs = require('fs');
const { ObjectId } = require('mongodb');
const ProjectService = require('./ProjectService');
const SlotService = require('./SlotService');
const {
  extractFileMetadata,
  applyFilesystemDatesFromMetadata,
  resolveCaptureDate
} = require('../utils/metadataExtract');

const UPLOAD_ROOT = path.join(__dirname, '../uploads');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function projectUploadDir(entrepriseId, projectId) {
  return path.join(UPLOAD_ROOT, String(entrepriseId), String(projectId));
}

async function listByProject(entrepriseDb, projectId, { slotCode = null, tag = null } = {}) {
  const filter = { projectId: String(projectId) };
  if (slotCode) filter.slotCode = slotCode;
  if (tag) filter.tags = tag;

  return entrepriseDb
    .collection('doc_hub_documents')
    .find(filter)
    .sort({ uploadedAt: -1 })
    .toArray();
}

async function getById(entrepriseDb, id) {
  if (!ObjectId.isValid(id)) return null;
  return entrepriseDb.collection('doc_hub_documents').findOne({ _id: new ObjectId(id) });
}

async function addFromUpload(entrepriseDb, entrepriseId, projectId, slotCode, file, userId, extraMetadata = {}, clientFileHint = null) {
  const project = await ProjectService.getById(entrepriseDb, projectId);
  if (!project) throw new Error('Projet introuvable');

  const slot = await SlotService.getByCode(entrepriseDb, slotCode);
  if (!slot) throw new Error(`Type de pièce inconnu: ${slotCode}`);

  if (slot.allowedMimeTypes?.length && !slot.allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(`Type de fichier non autorisé pour ${slot.label}`);
  }

  if (!slot.multiple) {
    const existing = await entrepriseDb.collection('doc_hub_documents').findOne({
      projectId: String(projectId),
      slotCode
    });
    if (existing) {
      await remove(entrepriseDb, existing._id.toString(), entrepriseId);
    }
  }

  const dir = projectUploadDir(entrepriseId, projectId);
  ensureDir(dir);

  const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const destPath = path.join(dir, safeName);
  fs.renameSync(file.path, destPath);

  const fileMetadata = await extractFileMetadata(destPath, file.mimetype);
  const resolved = resolveCaptureDate(fileMetadata, clientFileHint || extraMetadata.clientFileHint);
  if (resolved.captureDate) {
    fileMetadata.captureDate = resolved.captureDate;
    fileMetadata.dateSource = resolved.dateSource;
  }
  if (clientFileHint?.lastModified != null) {
    fileMetadata.clientLastModified = Number(clientFileHint.lastModified);
  }
  if (clientFileHint?.exifCaptureDate) {
    fileMetadata.clientExifCaptureDate = clientFileHint.exifCaptureDate;
  }
  if (fileMetadata.exif && Object.keys(fileMetadata.exif).length > 0) {
    fileMetadata.exifPreservedInFile = true;
  }
  applyFilesystemDatesFromMetadata(destPath, fileMetadata);

  const doc = {
    projectId: String(projectId),
    slotCode,
    filename: file.originalname,
    storagePath: destPath,
    mimeType: file.mimetype,
    size: file.size,
    captureDate: fileMetadata.captureDate || null,
    dateSource: fileMetadata.dateSource || null,
    exifPresent: Boolean(fileMetadata.exifPresent),
    metadata: { ...fileMetadata, ...extraMetadata },
    tags: Array.isArray(extraMetadata.tags) ? extraMetadata.tags : [],
    uploadedBy: userId,
    uploadedAt: new Date()
  };

  const result = await entrepriseDb.collection('doc_hub_documents').insertOne(doc);
  await entrepriseDb.collection('doc_hub_projects').updateOne(
    { _id: project._id },
    { $set: { updatedAt: new Date() } }
  );

  return { ...doc, _id: result.insertedId };
}

async function updateTags(entrepriseDb, id, tags) {
  if (!Array.isArray(tags)) throw new Error('tags doit être un tableau');
  const clean = [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))];

  const result = await entrepriseDb.collection('doc_hub_documents').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { tags: clean } },
    { returnDocument: 'after' }
  );

  return result;
}

async function remove(entrepriseDb, id, entrepriseId) {
  const doc = await getById(entrepriseDb, id);
  if (!doc) return false;

  if (doc.storagePath && fs.existsSync(doc.storagePath)) {
    try {
      fs.unlinkSync(doc.storagePath);
    } catch (err) {
      console.warn('Doc-Hub: suppression fichier:', err.message);
    }
  }

  const idStr = String(id);
  await entrepriseDb.collection('doc_hub_download_links').deleteMany({ documentId: idStr });
  await entrepriseDb.collection('doc_hub_download_links').updateMany(
    { documentIds: idStr },
    { $pull: { documentIds: idStr } }
  );

  const result = await entrepriseDb.collection('doc_hub_documents').deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}

/**
 * @param {import('mongodb').Db} entrepriseDb
 * @param {string} projectId
 * @param {string[]} documentIds
 * @param {string} entrepriseId
 * @returns {Promise<{ deleted: number, failed: string[] }>}
 */
async function removeMany(entrepriseDb, projectId, documentIds, entrepriseId) {
  const ids = [...new Set((documentIds || []).map(String).filter(Boolean))];
  let deleted = 0;
  const failed = [];

  for (const id of ids) {
    const doc = await getById(entrepriseDb, id);
    if (!doc || String(doc.projectId) !== String(projectId)) {
      failed.push(id);
      continue;
    }
    const ok = await remove(entrepriseDb, id, entrepriseId);
    if (ok) deleted++;
    else failed.push(id);
  }

  return { deleted, failed };
}

module.exports = {
  listByProject,
  getById,
  addFromUpload,
  updateTags,
  remove,
  removeMany,
  projectUploadDir,
  UPLOAD_ROOT
};
