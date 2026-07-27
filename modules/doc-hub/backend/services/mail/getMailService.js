/**
 * FICHIER : modules/doc-hub/backend/services/mail/getMailService.js
 * RÔLE : Accès au service mail du module mail (modules/mail/backend).
 */

const path = require('path');

function getMailService() {
  const mailModule = require(path.join(__dirname, '../../../../mail/backend/index'));
  return mailModule.getMailService();
}

module.exports = getMailService;
