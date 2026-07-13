/**

 * Envoie l'accusé de réception de commande client par e-mail (liens publics, sans pièce jointe).

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

const renderCommandeClientEmailHtml = require('./renderCommandeClientEmailHtml');

const resolveCgvEmailUrls = require('../mail/resolveCgvEmailUrls');

const resolveDevisContact = require('../pdf/resolveDevisContact');

const createGderpiPublicLink = require('../public/createGderpiPublicLink');

const {

  buildCommandeClientViewUrl,

  buildCommandeClientDownloadUrl

} = require('../../utils/publicUrl');



const COLLECTION = 'gderpi_commandes_client';

const DOC_TYPE = 'commande_client';



function resolveRecipient(commande, devis, client, payload) {

  const override = String(payload?.to || payload?.email || '').trim();

  if (override) return override;

  if (devis?.contactEmail) return String(devis.contactEmail).trim();

  const contact = resolveDevisContact(devis || {}, client);

  if (contact?.email) return contact.email;

  if (client?.email) return String(client.email).trim();

  return '';

}



async function sendCommandeClientToClient(db, entrepriseId, commandeClientId, payload, req) {

  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId);

  if (!commande) throw new Error('Commande client introuvable');

  if (commande.statut === 'annulee') {

    throw new Error('Impossible d\'envoyer l\'accusé de réception d\'une commande annulée');

  }

  if (!commande.lignes?.length) {

    throw new Error('La commande doit contenir au moins une ligne');

  }



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

  const { token } = await createGderpiPublicLink(db, entrepriseId, DOC_TYPE, commandeClientId, {

    expiresAt,

    sentTo: to

  });



  const viewUrl = buildCommandeClientViewUrl(entrepriseId, token);

  const downloadUrl = buildCommandeClientDownloadUrl(entrepriseId, token);

  const economyDownloadUrl = buildCommandeClientDownloadUrl(entrepriseId, token, { economy: true });

  const { cgvViewUrl, cgvDownloadUrl } = resolveCgvEmailUrls({ entrepriseId, boutique, devis, client });

  const customMessage = parseCustomMessageFromPayload(payload);
  const mailTemplate = resolveGderpiMailTemplate(settings, 'commande_client');

  const { subject, html, bodyText } = renderCommandeClientEmailHtml({

    commande,

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

    context: { commandeClientId: String(commandeClientId), action: 'send_commande_client' }

  });



  if (!sendResult?.success) {

    throw new Error(sendResult?.error || 'Échec envoi e-mail');

  }



  const now = new Date();

  await db.collection(COLLECTION).updateOne(

    { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },

    {

      $set: {

        dernierEnvoiCommandeClient: {

          date: now,

          to,

          subject,

          viewUrl,

          downloadUrl,

          economyDownloadUrl,

          emailId: sendResult.email_id || null

        },

        updatedAt: now

      },

      $push: {

        envoisCommandeClient: {

          date: now,

          to,

          subject,

          viewUrl,

          downloadUrl,

          economyDownloadUrl

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

    emailId: sendResult.email_id || null

  };

}



module.exports = sendCommandeClientToClient;


