/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/handleSendEmailFeedback.js
 * RÔLE : Confirme un envoi réussi (retour serveur) et affiche les erreurs côté client.
 */

(function initGderpiSendEmailFeedback(global) {
  'use strict';

  function formatSendError(err) {
    const msg = String(err?.message || 'Erreur lors de l\'envoi de l\'e-mail').trim();
    if (/mail non configuré|serveur mail/i.test(msg)) {
      return msg.replace(/\.\s*$/, '') + ' — Configuration → Mail.';
    }
    return msg;
  }

  function notifySendError(err) {
    global.GderpiStatus?.showStatus?.(formatSendError(err), 'danger');
    return false;
  }

  async function openInMailbox(emailId) {
    await global.GderpiAppNav?.('emails');
    if (emailId) await global.GderpiSentEmailsTab?.selectEmail?.(emailId);
  }

  function notifySendSuccess(res, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const data = res?.data && typeof res.data === 'object' ? res.data : {};
    if (res && res.success === false) {
      return notifySendError(new Error(res.message || 'Échec envoi e-mail'));
    }

    const sentTo = String(data.sentTo || opts.fallbackTo || '').trim();
    const label = String(opts.label || 'E-mail').trim();
    const serverMessage = String(res?.message || '').trim();
    let message = serverMessage || (sentTo ? label + ' envoyé à ' + sentTo : label + ' envoyé');
    if (message && !/[.!?]$/.test(message)) message += '.';

    const emailId = data.emailId ? String(data.emailId) : '';
    global.GderpiSentEmailsTab?.noteOutboundSend?.(data);

    const action = emailId
      ? { label: 'Voir l\'e-mail', onClick: () => openInMailbox(emailId).catch(notifySendError) }
      : null;

    global.GderpiStatus?.showStatus?.(message, 'success', action);
    global.GderpiLoading?.showSaveSuccess?.(message);
    return true;
  }

  global.GderpiSendEmailFeedback = {
    notifySendSuccess,
    notifySendError,
    formatSendError,
    openInMailbox
  };
})(window);
