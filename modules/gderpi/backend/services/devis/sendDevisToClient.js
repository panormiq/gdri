/**

 * Envoie un devis par e-mail au client (liens publics, sans pièce jointe).

 */



const getDevisById = require('./getDevisById');

const getBoutiqueById = require('../boutiques/getBoutiqueById');

const getClientById = require('../clients/getClientById');

const changeDevisStatus = require('./changeDevisStatus');

const getDevisMailSettings = require('../mail/getDevisMailSettings');
const parseCustomMessageFromPayload = require('../mail/parseCustomMessageFromPayload');
const { parseEmailRecipientsFromPayload } = require('../mail/parseEmailRecipientsFromPayload');
const resolveGderpiMailTemplate = require('../mail/resolveGderpiMailTemplate');

const { getMailService, resolveSmtpProfileForSender } = require('../mail/MailHelper');

const createDevisPublicLink = require('./createDevisPublicLink');

const renderDevisEmailHtml = require('./renderDevisEmailHtml');

const resolveCgvEmailUrls = require('../mail/resolveCgvEmailUrls');
const resolveDevisContact = require('../pdf/resolveDevisContact');

const {

  buildDevisViewUrl,

  buildDevisDownloadUrl,

  buildDevisAcceptUrl

} = require('../../utils/publicUrl');



const COLLECTION = 'gderpi_devis';



function resolveRecipient(devis, client, payload) {
  const override = String(payload?.to || payload?.email || '').trim();
  if (override) return override;
  if (devis?.contactEmail) return String(devis.contactEmail).trim();
  const contact = resolveDevisContact(devis || {}, client);
  if (contact?.email) return contact.email;
  if (client?.email) return String(client.email).trim();
  return '';
}



async function sendDevisToClient(db, entrepriseId, devisId, payload, req) {

  const devis = await getDevisById(db, entrepriseId, devisId);

  if (!devis) throw new Error('Devis introuvable');



  const statut = devis.statut;

  if (!['brouillon', 'envoye'].includes(statut)) {

    throw new Error('Seuls les devis en brouillon ou envoyés peuvent être transmis au client');

  }

  if (!devis.clientId) throw new Error('Client requis avant envoi du devis');

  if (!devis.lignes?.length) throw new Error('Au moins une ligne requise avant envoi');

  const [boutique, client] = await Promise.all([
    devis.boutiqueId ? getBoutiqueById(db, entrepriseId, devis.boutiqueId) : null,
    devis.clientId ? getClientById(db, entrepriseId, devis.clientId) : null
  ]);

  const { to: toOverride, cc } = parseEmailRecipientsFromPayload(payload);
  const to = toOverride || resolveRecipient(devis, client, payload);

  if (!to) throw new Error('E-mail du contact client requis');

  const settings = await getDevisMailSettings(db, entrepriseId);

  if (!settings.mailAvailable) {

    throw new Error(settings.mailStatusMessage || 'Module mail non configuré');

  }



  const expiresAt = new Date(Date.now() + settings.linkTtlDays * 24 * 60 * 60 * 1000);

  const { token } = await createDevisPublicLink(db, entrepriseId, devisId, { expiresAt, sentTo: to });



  const viewUrl = buildDevisViewUrl(entrepriseId, token);

  const downloadUrl = buildDevisDownloadUrl(entrepriseId, token);

  const economyDownloadUrl = buildDevisDownloadUrl(entrepriseId, token, { economy: true });

  const acceptUrl = settings.enableAcceptLink ? buildDevisAcceptUrl(entrepriseId, token) : null;

  const { cgvViewUrl, cgvDownloadUrl } = resolveCgvEmailUrls({ entrepriseId, boutique, devis, client });

  const customMessage = parseCustomMessageFromPayload(payload);
  const mailTemplate = resolveGderpiMailTemplate(settings, 'devis');

  const { subject, html, bodyText } = renderDevisEmailHtml({

    devis,

    boutique,

    client,

    settings,

    mailTemplate,

    customMessage,

    viewUrl,

    downloadUrl,

    economyDownloadUrl,

    acceptUrl,

    cgvViewUrl,

    cgvDownloadUrl

  });



  const mail = getMailService();

  await mail.init();

  const senderEmail = String(devis.emetteurContactEmail || boutique?.email || '').trim();

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

    context: { devisId: String(devisId), action: 'send_devis' }

  });



  if (!sendResult?.success) {

    throw new Error(sendResult?.error || 'Échec envoi e-mail');

  }



  const now = new Date();

  let updatedDevis = devis;



  if (statut === 'brouillon') {

    updatedDevis = await changeDevisStatus(db, entrepriseId, devisId, 'envoye');

  }



  await db.collection(COLLECTION).updateOne(

    { entrepriseId: String(entrepriseId), devisId: String(devisId).trim() },

    {

      $set: {

        dernierEnvoiClient: {

          date: now,

          to,

          subject,

          viewUrl,

          downloadUrl,

          economyDownloadUrl,

          acceptUrl,

          emailId: sendResult.email_id || null

        },

        updatedAt: now

      },

      $push: {

        envoisClient: {

          date: now,

          to,

          subject,

          viewUrl,

          downloadUrl,

          economyDownloadUrl,

          acceptUrl: acceptUrl || null

        }

      }

    }

  );



  updatedDevis = await getDevisById(db, entrepriseId, devisId);



  return {

    devis: updatedDevis,

    sentTo: to,

    subject,

    viewUrl,

    downloadUrl,

    economyDownloadUrl,

    acceptUrl,

    emailId: sendResult.email_id || null

  };

}



module.exports = sendDevisToClient;


