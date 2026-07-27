/**
 * FICHIER : modules/doc-hub/backend/services/diffusions/createAndSendDiffusion.js
 * RÔLE : Crée une diffusion, génère les liens de téléchargement (bundle ou par
 *        fichier) et envoie le mail au destinataire.
 *
 * ENTRÉES : payload { recipientEmail, subject, message, documentIds, tags, slotCode,
 *           linkTtlDays, maxDownloadsPerLink, groupSingleLink }
 * SORTIES : { diffusionId, linksCount, linkMode, mail }
 *
 * DÉPEND DE : resolveDiffusionDocumentIds, links/createBundleLink,
 *             links/createLinksForDocuments, mail/*, utils/publicUrl
 * APPELÉ PAR : controllers/diffusionController.js (create)
 */

const config = require('../../config.json');
const resolveDiffusionDocumentIds = require('./resolveDiffusionDocumentIds');
const createBundleLink = require('../links/createBundleLink');
const createLinksForDocuments = require('../links/createLinksForDocuments');
const getMailService = require('../mail/getMailService');
const resolveSmtpProfile = require('../mail/resolveSmtpProfile');
const { buildDownloadUrl, getPublicApiBaseUrl } = require('../../utils/publicUrl');

async function createAndSendDiffusion(entrepriseDb, entrepriseId, projectId, payload, userId) {
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

  const docs = await resolveDiffusionDocumentIds(entrepriseDb, projectId, { documentIds, tags, slotCode });
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
    const bundle = await createBundleLink(
      entrepriseDb,
      entrepriseId,
      diffusionId,
      docIds,
      { expiresAt, maxDownloads: maxDownloadsPerLink, label: subject || 'documents' }
    );
    if (bundle) links = [bundle];
  } else {
    links = await createLinksForDocuments(
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

module.exports = createAndSendDiffusion;
