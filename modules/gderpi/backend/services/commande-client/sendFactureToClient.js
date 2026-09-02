/**
 * FICHIER : modules/gderpi/backend/services/commande-client/sendFactureToClient.js
 * RÔLE : Envoie une facture par e-mail au client (liens publics, sans pièce jointe).
 */

const getCommandeClientById = require('./getCommandeClientById');
const getBoutiqueById = require('../boutiques/getBoutiqueById');
const getClientById = require('../clients/getClientById');
const getDevisById = require('../devis/getDevisById');
const getDevisMailSettings = require('../mail/getDevisMailSettings');
const parseCustomMessageFromPayload = require('../mail/parseCustomMessageFromPayload');
const { parseEmailRecipientsFromPayload } = require('../mail/parseEmailRecipientsFromPayload');
const resolveGderpiMailTemplate = require('../mail/resolveGderpiMailTemplate');
const { getMailService, resolveSmtpProfileForSender } = require('../mail/MailHelper');
const { buildGderpiMailContext } = require('../mail/gderpiMailDocumentTypes');
const renderFactureEmailHtml = require('./renderFactureEmailHtml');
const resolveCgvEmailUrls = require('../mail/resolveCgvEmailUrls');
const resolveDevisContact = require('../pdf/resolveDevisContact');
const createGderpiPublicLink = require('../public/createGderpiPublicLink');
const { resolveFactureForSend } = require('../facturation/resolveFactureById');
const buildCommandeForFactureRender = require('../facturation/buildCommandeForFactureRender');
const { buildFactureViewUrl, buildFactureDownloadUrl } = require('../../utils/publicUrl');
const { buildFactureDocId } = require('../facturation/parseFactureDocId');

const COLLECTION = 'gderpi_commandes_client';
const DOC_TYPE = 'facture';
const SENDABLE_STATUTS = new Set(['facturee', 'facturee_partiellement', 'livree', 'a_facturer', 'a_livrer']);

function resolveRecipient(commande, devis, client, payload) {
  const override = String(payload?.to || payload?.email || '').trim();
  if (override) return override;
  const party = { ...(devis || {}), ...(commande || {}) };
  if (party.contactEmail) return String(party.contactEmail).trim();
  const contact = resolveDevisContact(party, client);
  if (contact?.email) return contact.email;
  if (client?.email) return String(client.email).trim();
  return '';
}

async function sendFactureToClient(db, entrepriseId, commandeClientId, payload, req) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId, { skipPipelineRepair: true });
  if (!commande) throw new Error('Commande client introuvable');

  const factureId = payload?.factureId != null ? String(payload.factureId).trim() : '';
  const facture = await resolveFactureForSend(db, entrepriseId, commandeClientId, commande, factureId);
  if (!facture) {
    throw new Error(factureId
      ? `Facture introuvable (${factureId})`
      : 'Émettez la facture avant l\'envoi au client');
  }

  if (!SENDABLE_STATUTS.has(String(commande.statut || ''))) {
    throw new Error('Commande non éligible à l\'envoi de facture à ce stade');
  }

  const renderCommande = buildCommandeForFactureRender(commande, facture);

  const [boutique, client, devis] = await Promise.all([
    commande.boutiqueId ? getBoutiqueById(db, entrepriseId, commande.boutiqueId) : null,
    commande.clientId ? getClientById(db, entrepriseId, commande.clientId) : null,
    commande.devisId ? getDevisById(db, entrepriseId, commande.devisId) : null
  ]);

  const { to: toOverride, cc } = parseEmailRecipientsFromPayload(payload);
  const to = toOverride || resolveRecipient(commande, devis, client, payload);
  if (!to) throw new Error('E-mail du contact client requis');

  const settings = await getDevisMailSettings(db, entrepriseId);
  if (!settings.mailAvailable) {
    throw new Error(settings.mailStatusMessage || 'Module mail non configuré');
  }

  const expiresAt = new Date(Date.now() + settings.linkTtlDays * 24 * 60 * 60 * 1000);
  const publicDocId = buildFactureDocId(commandeClientId, facture.id);
  const { token } = await createGderpiPublicLink(db, entrepriseId, DOC_TYPE, publicDocId, {
    expiresAt,
    sentTo: to
  });

  const viewUrl = buildFactureViewUrl(entrepriseId, token);
  const downloadUrl = buildFactureDownloadUrl(entrepriseId, token);
  const economyDownloadUrl = buildFactureDownloadUrl(entrepriseId, token, { economy: true });

  const { cgvViewUrl, cgvDownloadUrl } = resolveCgvEmailUrls({ entrepriseId, boutique, devis, client });

  const customMessage = parseCustomMessageFromPayload(payload);
  const mailTemplate = resolveGderpiMailTemplate(settings, 'facture');

  const { subject, html, bodyText } = renderFactureEmailHtml({
    commande: renderCommande,
    boutique,
    client,
    devis,
    mailTemplate,
    customMessage,
    viewUrl,
    downloadUrl,
    economyDownloadUrl,
    cgvViewUrl,
    cgvDownloadUrl
  });

  const mail = getMailService();
  await mail.init();
  const senderEmail = String(commande?.emetteurContactEmail || devis?.emetteurContactEmail || boutique?.email || '').trim();
  const profile = await resolveSmtpProfileForSender(entrepriseId, senderEmail, {
    boutiqueGenericEmail: boutique?.email || ''
  });

  const sendResult = await mail.send({
    to,
    cc: cc.length ? cc.join(', ') : null,
    subject,
    body: bodyText,
    body_html: html,
    profile,
    module_name: 'gderpi',
    entity_id: String(entrepriseId),
    context: buildGderpiMailContext({
      action: 'send_facture',
      documentType: 'facture',
      documentId: facture.id,
      documentNumero: facture.numero,
      extra: { commandeClientId: String(commandeClientId), factureId: facture.id }
    })
  });

  if (!sendResult?.success) {
    throw new Error(sendResult?.error || 'Échec envoi e-mail');
  }

  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },
    {
      $set: {
        dernierEnvoiFacture: {
          date: now,
          to,
          subject,
          viewUrl,
          downloadUrl,
          economyDownloadUrl,
          emailId: sendResult.email_id || null,
          factureId: facture.id,
          factureNumero: facture.numero
        },
        updatedAt: now
      },
      $push: {
        envoisFacture: {
          date: now,
          to,
          subject,
          viewUrl,
          downloadUrl,
          economyDownloadUrl,
          factureNumero: facture.numero,
          factureId: facture.id
        }
      }
    }
  );

  return {
    commande: await getCommandeClientById(db, entrepriseId, commandeClientId),
    sentTo: to,
    subject,
    viewUrl,
    downloadUrl,
    economyDownloadUrl,
    emailId: sendResult.email_id || null,
    factureId: facture.id
  };
}

module.exports = sendFactureToClient;
