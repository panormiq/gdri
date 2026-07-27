/**
 * FICHIER : modules/doc-hub/backend/services/documents/addDocumentFromUpload.js
 * RÔLE : Enregistre un fichier uploadé (multer) dans un projet : déplacement disque,
 *        extraction métadonnées (EXIF/date), remplacement si slot non multiple.
 *
 * DÉPEND DE : projects/getProjectById, slots/getSlotByCode, removeDocument,
 *             projectUploadDir, utils/metadataExtract
 * APPELÉ PAR : controllers/documentController.js (upload)
 */

const path = require('path');
const fs = require('fs');
const getProjectById = require('../projects/getProjectById');
const getSlotByCode = require('../slots/getSlotByCode');
const removeDocument = require('./removeDocument');
const projectUploadDir = require('./projectUploadDir');
const {
  extractFileMetadata,
  applyFilesystemDatesFromMetadata,
  resolveCaptureDate
} = require('../../utils/metadataExtract');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function addDocumentFromUpload(entrepriseDb, entrepriseId, projectId, slotCode, file, userId, extraMetadata = {}, clientFileHint = null) {
  const project = await getProjectById(entrepriseDb, projectId);
  if (!project) throw new Error('Projet introuvable');

  const slot = await getSlotByCode(entrepriseDb, slotCode);
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
      await removeDocument(entrepriseDb, existing._id.toString(), entrepriseId);
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

module.exports = addDocumentFromUpload;
