/**
 * FICHIER : modules/gderpi/backend/services/commande-client/sendAvoirToClient.js
 * RÔLE : Envoie un avoir par e-mail au client (liens publics, sans pièce jointe).
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
const renderAvoirEmailHtml = require('./renderAvoirEmailHtml');
const resolveCgvEmailUrls = require('../mail/resolveCgvEmailUrls');
const resolveDevisContact = require('../pdf/resolveDevisContact');
const createGderpiPublicLink = require('../public/createGderpiPublicLink');
const resolveFactureById = require('../facturation/resolveFactureById');
const resolveAvoirById = require('../facturation/resolveAvoirById');
const buildCommandeForAvoirRender = require('../facturation/buildCommandeForAvoirRender');
const { buildAvoirViewUrl, buildAvoirDownloadUrl } = require('../../utils/publicUrl');
const { buildAvoirDocId } = require('../facturation/parseAvoirDocId');

const COLLECTION = 'gderpi_commandes_client';
const DOC_TYPE = 'avoir';
const SENDABLE_STATUTS = new Set(['facturee', 'facturee_partiellement', 'livree', 'a_facturer', 'a_livrer']);

function resolveRecipient(commande, devis, client, payload) {
  const override = String(payload?.to || payload?.email || '').trim();
  if (override) return override;
  if (devis?.contactEmail) return String(devis.contactEmail).trim();
  const contact = resolveDevisContact(devis || {}, client);
  if (contact?.email) return contact.email;
  if (client?.email) return String(client.email).trim();
  return '';
}

async function sendAvoirToClient(db, entrepriseId, commandeClientId, payload, req) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId, { skipPipelineRepair: true });
  if (!commande) throw new Error('Commande client introuvable');

  const factureId = payload?.factureId != null ? String(payload.factureId).trim() : '';
  const avoirId = payload?.avoirId != null ? String(payload.avoirId).trim() : '';
  if (!factureId || !avoirId) throw new Error('Avoir introuvable');

  const facture = resolveFactureById(commande, factureId);
  if (!facture) throw new Error('Facture introuvable');

  const avoir = resolveAvoirById(facture, avoirId);
  if (!avoir) throw new Error('Avoir introuvable');

  if (!SENDABLE_STATUTS.has(String(commande.statut || ''))) {
    throw new Error('Commande non éligible à l\'envoi d\'avoir à ce stade');
  }

  const renderCommande = buildCommandeForAvoirRender(commande, facture, avoir);

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
  const publicDocId = buildAvoirDocId(commandeClientId, facture.id, avoir.id);
  const { token } = await createGderpiPublicLink(db, entrepriseId, DOC_TYPE, publicDocId, {
    expiresAt,
    sentTo: to
  });

  const viewUrl = buildAvoirViewUrl(entrepriseId, token);
  const downloadUrl = buildAvoirDownloadUrl(entrepriseId, token);
  const economyDownloadUrl = buildAvoirDownloadUrl(entrepriseId, token, { economy: true });

  const { cgvViewUrl, cgvDownloadUrl } = resolveCgvEmailUrls({ entrepriseId, boutique, devis, client });

  const customMessage = parseCustomMessageFromPayload(payload);
  const mailTemplate = resolveGderpiMailTemplate(settings, 'avoir');

  const { subject, html, bodyText } = renderAvoirEmailHtml({
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
  const senderEmail = String(devis?.emetteurContactEmail || boutique?.email || '').trim();
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
    context: {
      commandeClientId: String(commandeClientId),
      factureId: facture.id,
      avoirId: avoir.id,
      action: 'send_avoir'
    }
  });

  if (!sendResult?.success) {
    throw new Error(sendResult?.error || 'Échec envoi e-mail');
  }

  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },
    {
      $set: {
        dernierEnvoiAvoir: {
          date: now,
          to,
          subject,
          viewUrl,
          downloadUrl,
          economyDownloadUrl,
          emailId: sendResult.email_id || null,
          factureId: facture.id,
          factureNumero: facture.numero,
          avoirId: avoir.id,
          avoirNumero: avoir.numero
        },
        updatedAt: now
      },
      $push: {
        envoisAvoir: {
          date: now,
          to,
          subject,
          viewUrl,
          downloadUrl,
          economyDownloadUrl,
          factureNumero: facture.numero,
          factureId: facture.id,
          avoirNumero: avoir.numero,
          avoirId: avoir.id
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
    factureId: facture.id,
    avoirId: avoir.id
  };
}

module.exports = sendAvoirToClient;
