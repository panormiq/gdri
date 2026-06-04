/**
 * Diffusions (envoi mail + liens) — Doc-Hub
 */

const { ObjectId } = require('mongodb');
const config = require('../config.json');
const DocumentService = require('./DocumentService');
const DownloadLinkService = require('./DownloadLinkService');
const { getMailService, resolveSmtpProfile, smtpProfileLabel } = require('./MailHelper');
const { buildDownloadUrl, getPublicApiBaseUrl } = require('../utils/publicUrl');

async function resolveDocumentIds(entrepriseDb, projectId, { documentIds = [], tags = [], slotCode = null }) {
  let docs = await DocumentService.listByProject(entrepriseDb, projectId, { slotCode, tag: null });

  if (tags.length > 0) {
    docs = docs.filter((d) => (d.tags || []).some((t) => tags.includes(t)));
  }

  if (documentIds.length > 0) {
    const idSet = new Set(documentIds.map(String));
    docs = docs.filter((d) => idSet.has(d._id.toString()));
  }

  return docs;
}

async function createAndSend(entrepriseDb, entrepriseId, projectId, payload, userId) {
  const {
    recipientEmail,
    subject,
    message = '',
    documentIds = [],
    tags = [],
    slotCode = null,
    linkTtlDays = config.defaultLinkTtlDays || 7,
    maxDownloadsPerLink = null,
    groupSingleLink = true
  } = payload;

  if (!recipientEmail || !subject) {
    throw new Error('recipientEmail et subject sont requis');
  }

  const docs = await resolveDocumentIds(entrepriseDb, projectId, { documentIds, tags, slotCode });
  if (docs.length === 0) {
    throw new Error('Aucun document sélectionné pour cette diffusion');
  }

  const expiresAt = new Date(Date.now() + Number(linkTtlDays) * 24 * 60 * 60 * 1000);
  const now = new Date();
  const docIds = docs.map((d) => d._id.toString());
  // Archive ZIP : octets identiques + date d’origine dans l’entrée (restaurée à l’extraction Windows)
  const useBundle = groupSingleLink !== false;

  const publicDownloadBase = getPublicApiBaseUrl();

  const diffusion = {
    projectId: String(projectId),
    recipientEmail: String(recipientEmail).trim(),
    subject: String(subject).trim(),
    message: String(message),
    documentIds: docIds,
    tags: Array.isArray(tags) ? tags : [],
    selectionMode: documentIds.length ? 'manual' : tags.length ? 'by_tag' : 'all',
    linkMode: useBundle ? 'bundle' : 'per_file',
    publicDownloadBase,
    linkExpiresAt: expiresAt,
    maxDownloadsPerLink: maxDownloadsPerLink ?? null,
    sentAt: null,
    status: 'pending',
    createdBy: userId,
    createdAt: now
  };

  const insert = await entrepriseDb.collection('doc_hub_diffusions').insertOne(diffusion);
  const diffusionId = insert.insertedId.toString();

  let links = [];
  if (useBundle) {
    const bundle = await DownloadLinkService.createBundleLink(
      entrepriseDb,
      entrepriseId,
      diffusionId,
      docIds,
      { expiresAt, maxDownloads: maxDownloadsPerLink, label: subject || 'documents' }
    );
    if (bundle) links = [bundle];
  } else {
    links = await DownloadLinkService.createLinksForDocuments(
      entrepriseDb,
      entrepriseId,
      diffusionId,
      docIds,
      { expiresAt, maxDownloads: maxDownloadsPerLink }
    );
  }

  const linkLines = links
    .map((l) => {
      if (l.type === 'bundle') {
        return `- Archive (${l.documentCount} fichier(s)) : ${buildDownloadUrl(l.token)}`;
      }
      return `- ${l.filename}: ${buildDownloadUrl(l.token)}`;
    })
    .join('\n');

  const expiresLabel = expiresAt.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const bodyText = [
    message,
    '',
    useBundle
      ? `Téléchargement groupé (${docs.length} fichier(s)) :`
      : 'Documents disponibles au téléchargement :',
    linkLines,
    '',
    `Ce lien expire le ${expiresLabel}. Ne le transférez pas.`,
    '',
    '— Envoyé via Doc-Hub / GDRI'
  ]
    .filter(Boolean)
    .join('\n');

  const bodyHtml = `
    <p>${message ? message.replace(/\n/g, '<br>') : 'Veuillez trouver ci-dessous les documents demandés.'}</p>
    <ul>
      ${links
        .map((l) => {
          const label =
            l.type === 'bundle'
              ? `Télécharger l'archive (${l.documentCount} fichier(s))`
              : l.filename;
          return `<li><a href="${buildDownloadUrl(l.token)}">${label}</a></li>`;
        })
        .join('')}
    </ul>
    <p><small>Ce lien personnel expire le ${expiresLabel}. Ne le transférez pas.</small></p>
    <p><small>— Doc-Hub / GDRI</small></p>
  `;

  let mailResult;
  try {
    const mail = getMailService();
    const smtpProfile = await resolveSmtpProfile(entrepriseId);

    mailResult = await mail.send({
      to: recipientEmail,
      subject,
      body: bodyText,
      body_html: bodyHtml,
      profile: smtpProfile,
      module_name: 'mail',
      entity_id: entrepriseId,
      context: { user_id: userId, project_id: projectId, diffusion_id: diffusionId }
    });
  } catch (err) {
    await entrepriseDb.collection('doc_hub_diffusions').updateOne(
      { _id: insert.insertedId },
      { $set: { status: 'failed', error: err.message, updatedAt: new Date() } }
    );
    throw new Error('Envoi mail échoué: ' + err.message);
  }

  await entrepriseDb.collection('doc_hub_diffusions').updateOne(
    { _id: insert.insertedId },
    {
      $set: {
        status: mailResult.success ? 'sent' : 'failed',
        sentAt: mailResult.success ? new Date() : null,
        emailId: mailResult.email_id || null,
        error: mailResult.error || null,
        smtpProfile: mailResult.profile_used || null,
        updatedAt: new Date()
      }
    }
  );

  return {
    diffusionId,
    linksCount: links.length,
    linkMode: useBundle ? 'bundle' : 'per_file',
    mail: mailResult
  };
}

async function listByProject(entrepriseDb, projectId) {
  return listByProjectWithTrace(entrepriseDb, projectId);
}

async function listByProjectWithTrace(entrepriseDb, projectId) {
  const { ObjectId } = require('mongodb');
  const diffusions = await entrepriseDb
    .collection('doc_hub_diffusions')
    .find({ projectId: String(projectId) })
    .sort({ createdAt: -1 })
    .toArray();

  const linksCol = entrepriseDb.collection('doc_hub_download_links');
  const docsCol = entrepriseDb.collection('doc_hub_documents');

  const enriched = [];
  for (const d of diffusions) {
    const diffusionId = d._id.toString();
    const links = await linksCol.find({ diffusionId }).toArray();
    const documentIds = Array.isArray(d.documentIds) ? d.documentIds : [];

    const documentPreview = [];
    for (const id of documentIds.slice(0, 8)) {
      try {
        const doc = await docsCol.findOne({ _id: new ObjectId(id) });
        if (doc) documentPreview.push({ id, filename: doc.filename, slotCode: doc.slotCode });
      } catch {
        /* skip invalid id */
      }
    }

    enriched.push({
      ...d,
      _id: diffusionId,
      smtpProfileLabel: smtpProfileLabel(d.smtpProfile),
      documentsCount: documentIds.length,
      documentPreview,
      trace: {
        linksCount: links.length,
        totalDownloads: links.reduce((sum, l) => sum + (l.downloadCount || 0), 0),
        links: links.map((l) => ({
          type: l.type || 'file',
          downloadCount: l.downloadCount || 0,
          maxDownloads: l.maxDownloads ?? null,
          expiresAt: l.expiresAt,
          revokedAt: l.revokedAt,
          lastDownloadAt: l.lastDownloadAt || null,
          documentIds: l.documentIds || (l.documentId ? [l.documentId] : [])
        }))
      }
    });
  }

  return enriched;
}

async function revoke(entrepriseDb, diffusionId) {
  const result = await entrepriseDb.collection('doc_hub_diffusions').updateOne(
    { _id: new ObjectId(diffusionId) },
    { $set: { status: 'revoked', revokedAt: new Date() } }
  );
  if (result.matchedCount === 0) return false;
  await DownloadLinkService.revokeByDiffusion(entrepriseDb, diffusionId);
  return true;
}

module.exports = {
  createAndSend,
  listByProject,
  listByProjectWithTrace,
  revoke,
  buildDownloadUrl
};
