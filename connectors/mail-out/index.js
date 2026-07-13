/**
 * Connecteur Mail sortant — emit via infra Mail (SMTP).
 */

const path = require('path');
const { BaseConnector } = require('../../backend/core/connectors/BaseConnector');
const { loadMailConfigForConnector, listMailAccounts } = require('../../backend/core/connectors/mail-infra-helper');

function getMailService() {
  const mailModule = require(path.join(__dirname, '../../modules/mail/backend'));
  return mailModule.getMailService();
}

class MailOutConnector extends BaseConnector {
  async testConnection(ctx) {
    const accountRef = ctx.instance.settings?.accountRef;
    if (!accountRef) {
      return { success: false, message: 'Compte mail (accountRef) requis' };
    }
    const config = await loadMailConfigForConnector(ctx.database, ctx.entrepriseId);
    if (!config) {
      return { success: false, message: 'Aucun compte mail — configurez Paramètres > Connecteurs > Mail' };
    }
    const accounts = listMailAccounts(config);
    const found = accounts.find((a) => a.id === String(accountRef) || a.email === String(accountRef));
    if (!found) {
      return { success: false, message: `Compte « ${accountRef} » introuvable` };
    }
    if (!found.hasSmtp) {
      return { success: false, message: 'Ce compte n\'a pas de profil SMTP configuré' };
    }
    return {
      success: true,
      message: `Compte sortant OK : ${found.email}`
    };
  }

  async emit(ctx, operation, payload = {}) {
    if (operation !== 'mail' && operation !== 'emit.mail') {
      return { success: false, message: `Opération ${operation} non supportée` };
    }

    const accountRef = ctx.instance.settings?.accountRef;
    const to = payload.to || payload.recipient;
    const subject = payload.subject || payload.title || 'Message GDRI';
    const body = payload.body || payload.text || payload.message || '';
    const bodyHtml = payload.body_html || payload.html || null;

    if (!accountRef) {
      return { success: false, message: 'accountRef requis dans les paramètres de l\'instance' };
    }
    if (!to || !body) {
      return { success: false, message: 'to et body requis dans le payload' };
    }

    const prefix = String(ctx.instance.settings?.defaultSubjectPrefix || '').trim();
    const finalSubject = prefix ? `${prefix} ${subject}`.trim() : subject;

    const attachments = [];
    const attachPath = payload.attachmentPath || payload.filePath;
    if (attachPath) {
      attachments.push({
        filename: payload.attachmentName || payload.fileName || attachPath,
        path: attachPath
      });
    }
    if (Array.isArray(payload.attachments)) {
      payload.attachments.forEach((a) => {
        if (a && (a.path || a.filename)) attachments.push(a);
      });
    }

    const mail = getMailService();
    await mail.init();
    const result = await mail.send({
      to,
      subject: finalSubject,
      body,
      body_html: bodyHtml,
      attachments,
      profile: String(accountRef),
      module_name: 'mail',
      entity_id: ctx.entrepriseId
    });

    return {
      success: !!result.success,
      message: result.success ? 'Email envoyé' : (result.error || 'Échec envoi'),
      data: { email_id: result.email_id || null }
    };
  }
}

module.exports = MailOutConnector;
