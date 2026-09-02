/**
 * Envoie l'e-mail de confirmation après commande via lien public devis.
 */

const getBoutiqueById = require('../boutiques/getBoutiqueById');
const getClientById = require('../clients/getClientById');
const getDevisById = require('./getDevisById');
const getDevisMailSettings = require('../mail/getDevisMailSettings');
const { getMailService, resolveSmtpProfileForSender } = require('../mail/MailHelper');
const { buildGderpiMailContext } = require('../mail/gderpiMailDocumentTypes');
const resolveDevisContact = require('../pdf/resolveDevisContact');
const resolveCgvEmailUrls = require('../mail/resolveCgvEmailUrls');
const createGderpiPublicLink = require('../public/createGderpiPublicLink');
const sendCommandeClientToClient = require('../commande-client/sendCommandeClientToClient');
const renderDevisOrderConfirmationEmailHtml = require('./renderDevisOrderConfirmationEmailHtml');
const {
  buildCommandeClientViewUrl,
  buildCommandeClientDownloadUrl
} = require('../../utils/publicUrl');

function resolveRecipient(devis, client, link) {
  const fromLink = String(link?.sentTo || '').trim();
  if (fromLink) return fromLink;
  if (devis?.contactEmail) return String(devis.contactEmail).trim();
  const contact = resolveDevisContact(devis || {}, client);
  if (contact?.email) return contact.email;
  if (client?.email) return String(client.email).trim();
  return '';
}

async function sendDevisOrderConfirmationEmail(db, entrepriseId, {
  devisId,
  commandeClientId,
  modifieeParClient,
  link
}, req) {
  if (!modifieeParClient) {
    try {
      const devis = await getDevisById(db, entrepriseId, devisId);
      const client = devis?.clientId
        ? await getClientById(db, entrepriseId, devis.clientId)
        : null;
      const to = resolveRecipient(devis, client, link);
      await sendCommandeClientToClient(db, entrepriseId, commandeClientId, { to }, req);
    } catch (error) {
      console.error('GDERPI sendDevisOrderConfirmationEmail (conforme):', error.message || error);
    }
    return;
  }

  const commande = await require('../commande-client/getCommandeClientById')(db, entrepriseId, commandeClientId);
  if (!commande) return;

  const [devis, boutique, client] = await Promise.all([
    getDevisById(db, entrepriseId, devisId),
    commande.boutiqueId ? getBoutiqueById(db, entrepriseId, commande.boutiqueId) : null,
    commande.clientId ? getClientById(db, entrepriseId, commande.clientId) : null
  ]);

  const to = resolveRecipient(devis, client, link);
  if (!to) {
    console.warn('GDERPI sendDevisOrderConfirmationEmail: pas de destinataire e-mail');
    return;
  }

  const settings = await getDevisMailSettings(db, entrepriseId);
  if (!settings.mailAvailable) {
    console.warn('GDERPI sendDevisOrderConfirmationEmail: mail non configuré');
    return;
  }

  const expiresAt = new Date(Date.now() + settings.linkTtlDays * 24 * 60 * 60 * 1000);
  const { token } = await createGderpiPublicLink(db, entrepriseId, 'commande_client', commandeClientId, {
    expiresAt,
    sentTo: to
  });

  const viewUrl = buildCommandeClientViewUrl(entrepriseId, token);
  const downloadUrl = buildCommandeClientDownloadUrl(entrepriseId, token);
  const economyDownloadUrl = buildCommandeClientDownloadUrl(entrepriseId, token, { economy: true });
  const { cgvViewUrl, cgvDownloadUrl } = resolveCgvEmailUrls({ entrepriseId, boutique, devis, client });

  const { subject, html, bodyText } = renderDevisOrderConfirmationEmailHtml({
    devis,
    commande,
    boutique,
    client,
    modifieeParClient: true,
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
    subject,
    body: bodyText,
    body_html: html,
    profile,
    module_name: 'gderpi',
    entity_id: String(entrepriseId),
    context: buildGderpiMailContext({
      action: 'devis_public_order_modified',
      documentType: 'commande_client',
      documentId: commandeClientId,
      documentNumero: commande.numero,
      extra: { commandeClientId: String(commandeClientId), devisId: String(devisId) }
    })
  });

  if (!sendResult?.success) {
    console.error('GDERPI sendDevisOrderConfirmationEmail:', sendResult?.error || 'échec envoi');
  }
}

module.exports = sendDevisOrderConfirmationEmail;
