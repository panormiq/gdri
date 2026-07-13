/**
 * Envoie une commande fournisseur par e-mail au fournisseur (liens publics, sans pièce jointe).
 */

const getCommandeFournisseurById = require('./getCommandeFournisseurById');
const buildCommandeFournisseurHtmlContext = require('../pdf/buildCommandeFournisseurHtmlContext');
const getDevisMailSettings = require('../mail/getDevisMailSettings');
const parseCustomMessageFromPayload = require('../mail/parseCustomMessageFromPayload');
const { parseEmailRecipientsFromPayload } = require('../mail/parseEmailRecipientsFromPayload');
const resolveGderpiMailTemplate = require('../mail/resolveGderpiMailTemplate');
const { getMailService, resolveSmtpProfileForSender } = require('../mail/MailHelper');
const renderCommandeFournisseurEmailHtml = require('./renderCommandeFournisseurEmailHtml');
const createGderpiPublicLink = require('../public/createGderpiPublicLink');
const {
  buildCommandeFournisseurViewUrl,
  buildCommandeFournisseurDownloadUrl
} = require('../../utils/publicUrl');

const COLLECTION = 'gderpi_commandes_fournisseur';
const DOC_TYPE = 'commande_fournisseur';

function resolveRecipient(fournisseur, payload) {
  const override = String(payload?.to || payload?.email || '').trim();
  if (override) return override;
  if (fournisseur?.email) return String(fournisseur.email).trim();
  const contacts = Array.isArray(fournisseur?.contacts) ? fournisseur.contacts : [];
  const principal = contacts.find((c) => c.principal) || contacts[0];
  if (principal?.email) return String(principal.email).trim();
  return '';
}

async function sendCommandeFournisseurToFournisseur(db, entrepriseId, commandeFournisseurId, payload = {}, req = null) {
  const commande = await getCommandeFournisseurById(db, entrepriseId, commandeFournisseurId);
  if (!commande) throw new Error('Commande fournisseur introuvable');
  if (commande.statut === 'annulee') {
    throw new Error('Impossible d\'envoyer une commande fournisseur annulée');
  }
  if (!commande.lignes?.length) {
    throw new Error('La commande doit contenir au moins une ligne');
  }

  const context = await buildCommandeFournisseurHtmlContext(db, entrepriseId, commande, req);
  const { boutique, fournisseur } = context;
  if (!fournisseur) throw new Error('Fournisseur introuvable pour cette commande');

  const { to: toOverride, cc } = parseEmailRecipientsFromPayload(payload);
  const to = toOverride || resolveRecipient(fournisseur, payload);
  if (!to) {
    throw new Error('E-mail du contact fournisseur requis — ajoutez un contact principal avec e-mail sur la fiche fournisseur');
  }

  const settings = await getDevisMailSettings(db, entrepriseId);
  if (!settings.mailAvailable) {
    throw new Error(settings.mailStatusMessage || 'Module mail non configuré');
  }

  const expiresAt = new Date(Date.now() + settings.linkTtlDays * 24 * 60 * 60 * 1000);
  const { token } = await createGderpiPublicLink(db, entrepriseId, DOC_TYPE, commandeFournisseurId, {
    expiresAt,
    sentTo: to
  });

  const viewUrl = buildCommandeFournisseurViewUrl(entrepriseId, token);
  const downloadUrl = buildCommandeFournisseurDownloadUrl(entrepriseId, token);

  const customMessage = parseCustomMessageFromPayload(payload);
  const mailTemplate = resolveGderpiMailTemplate(settings, 'commande_fournisseur');

  const { subject, html, bodyText } = renderCommandeFournisseurEmailHtml({
    commande,
    boutique,
    fournisseur,
    mailTemplate,
    customMessage,
    viewUrl,
    downloadUrl
  });

  const mail = getMailService();
  await mail.init();
  const senderEmail = String(boutique?.email || '').trim();
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
      commandeFournisseurId: String(commandeFournisseurId),
      action: 'send_commande_fournisseur'
    }
  });

  if (!sendResult?.success) {
    throw new Error(sendResult?.error || 'Échec envoi e-mail');
  }

  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeFournisseurId: String(commandeFournisseurId).trim() },
    {
      $set: {
        dernierEnvoiFournisseur: {
          date: now,
          to,
          subject,
          viewUrl,
          downloadUrl,
          emailId: sendResult.email_id || null
        },
        updatedAt: now
      },
      $push: {
        envoisFournisseur: {
          date: now,
          to,
          subject,
          viewUrl,
          downloadUrl,
          emailId: sendResult.email_id || null
        }
      }
    }
  );

  return {
    commande: await getCommandeFournisseurById(db, entrepriseId, commandeFournisseurId),
    sentTo: to,
    subject,
    viewUrl,
    downloadUrl,
    emailId: sendResult.email_id || null
  };
}

module.exports = sendCommandeFournisseurToFournisseur;
