/**
 * Wrapper sendMail pour compatibilité (ex. doc-template)
 * Fichier : modules/mail/backend/mailService.js
 */

const mailModule = require('./index');

/**
 * Envoie un email (API template/context/variables ou body/body_html)
 * @param {Object} options - { to, subject, body?, body_html?, template?, context?, variables? }
 * @returns {Promise<Object>} { success, email_id?, error? }
 */
async function sendMail(options) {
  const mail = mailModule.getMailService();
  const body = options.body || (options.template && (options.context || options.variables)
    ? `[Template: ${options.template}]\n${JSON.stringify(options.context || options.variables, null, 2)}`
    : options.template ? `[Template: ${options.template}]` : '');
  const body_html = options.body_html || null;
  return mail.send({
    to: options.to,
    subject: options.subject,
    body,
    body_html,
    module_name: options.module_name || 'mail',
    entity_id: options.entity_id || null
  });
}

module.exports = { sendMail };
