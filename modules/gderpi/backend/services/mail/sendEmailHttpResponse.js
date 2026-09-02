/**
 * Réponse HTTP standard après un envoi d'e-mail GDERPI.
 */

function sendEmailSuccess(res, data, fallbackMessage) {
  const payload = data && typeof data === 'object' ? data : {};
  const sentTo = String(payload.sentTo || '').trim();
  const message = sentTo
    ? 'E-mail envoyé à ' + sentTo
    : String(fallbackMessage || 'E-mail envoyé');
  res.json({
    success: true,
    message,
    data: {
      ...payload,
      sent: true,
      sentTo,
      emailId: payload.emailId || null
    }
  });
}

function sendEmailErrorStatus(error) {
  const msg = String(error?.message || '');
  if (/introuvable/i.test(msg)) return 404;
  if (/mail non configuré|serveur mail|smtp|échec envoi/i.test(msg)) return 502;
  return 400;
}

module.exports = { sendEmailSuccess, sendEmailErrorStatus };
