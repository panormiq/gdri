/**
 * Extrait destinataire principal (override) et copies depuis le payload d'envoi.
 */

function splitEmails(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v || '').trim()).filter(Boolean);
  }
  return String(value)
    .split(/[;,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseEmailRecipientsFromPayload(payload) {
  const to = String(payload?.to || payload?.email || '').trim();
  const cc = splitEmails(payload?.cc ?? payload?.copyTo ?? payload?.additionalTo);
  return { to, cc };
}

module.exports = { parseEmailRecipientsFromPayload, splitEmails };
