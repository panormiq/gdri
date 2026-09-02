/**
 * Critères de lecture IMAP pour mail-in (agent Données + instance connecteur).
 */

function clampInt(raw, fallback, min, max) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

function containsInsensitive(haystack, needle) {
  const n = String(needle || '').trim().toLowerCase();
  if (!n) return true;
  return String(haystack || '').toLowerCase().includes(n);
}

function resolveLookbackHours(settings = {}) {
  if (settings.lookbackHours != null && settings.lookbackHours !== '') {
    return clampInt(settings.lookbackHours, 168, 1, 2160);
  }
  return 168;
}

function mailSettingsFromDataConfig(config = {}, base = {}) {
  const next = { ...(base && typeof base === 'object' ? base : {}) };
  if (config.mailbox != null && String(config.mailbox).trim()) {
    next.mailbox = String(config.mailbox).trim();
  }
    if (config.unseenOnly !== undefined) next.unseenOnly = config.unseenOnly === true;
  if (config.fromContains !== undefined) next.fromContains = String(config.fromContains || '');
  if (config.subjectContains !== undefined) next.subjectContains = String(config.subjectContains || '');
  if (config.lookbackHours !== undefined) next.lookbackHours = config.lookbackHours;
  if (config.pollByDate !== undefined) next.pollByDate = config.pollByDate === true;
  if (config.pollByCount !== undefined) next.pollByCount = config.pollByCount !== false;
  if (config.pollLimit !== undefined) next.pollLimit = config.pollLimit;
  else if (config.limit !== undefined) next.pollLimit = config.limit;
  return next;
}

/**
 * @param {Object} settings instance.settings ou config bloc Données
 * @returns {{
 *   unseenOnly: boolean,
 *   fromContains: string,
 *   subjectContains: string,
 *   lookbackHours: number,
 *   pollByDate: boolean,
 *   pollByCount: boolean,
 *   pollLimit: number,
 *   since: Date|null,
 *   includeAttachments: boolean,
 *   mailbox: string
 * }}
 */
function resolveMailPollQuery(settings = {}) {
  const pollByDate = settings.pollByDate === true;
  const pollByCount = settings.pollByCount !== false;
  const unseenOnly = settings.unseenOnly === true;
  const lookbackHours = resolveLookbackHours(settings);
  const pollLimit = clampInt(settings.pollLimit ?? settings.limit, 20, 1, 100);
  const fromContains = String(settings.fromContains || '').trim();
  const subjectContains = String(settings.subjectContains || '').trim();
  let since = null;
  if (pollByDate && lookbackHours) {
    since = new Date(Date.now() - lookbackHours * 3600 * 1000);
  }
  return {
    unseenOnly,
    fromContains,
    subjectContains,
    lookbackHours,
    pollByDate,
    pollByCount,
    pollLimit,
    since,
    includeAttachments: settings.includeAttachments !== false,
    mailbox: String(settings.mailbox || '').trim()
  };
}

function mailQueryFingerprint(query) {
  const q = query && typeof query === 'object' ? query : {};
  return [
    q.unseenOnly ? '1' : '0',
    String(q.fromContains || ''),
    String(q.subjectContains || ''),
    q.pollByDate ? '1' : '0',
    String(q.lookbackHours || ''),
    q.pollByCount ? '1' : '0',
    String(q.pollLimit || ''),
    String(q.mailbox || '')
  ].join('|');
}

function overlayMailInstanceFromDataConfig(instance, config) {
  if (!instance || typeof instance !== 'object') return instance;
  const cfg = config && typeof config === 'object' ? config : {};
  const settings = mailSettingsFromDataConfig(cfg, instance.settings || {});
  return {
    ...instance,
    settings: {
      ...settings,
      unseenOnly: cfg.unseenOnly === true,
      pollByDate: cfg.pollByDate === true,
      pollByCount: cfg.pollByCount !== false,
      fromContains: String(cfg.fromContains || ''),
      subjectContains: String(cfg.subjectContains || ''),
      pollLimit: cfg.pollLimit != null ? cfg.pollLimit : (cfg.limit != null ? cfg.limit : settings.pollLimit),
      includeAttachments: true,
      _agentRead: true
    },
    cursor: null
  };
}

function messageMatchesMailQuery(message, query) {
  if (!query) return true;
  const meta = (message && message.metadata && typeof message.metadata === 'object')
    ? message.metadata
    : {};
  const author = (message && message.author && typeof message.author === 'object')
    ? message.author
    : {};
  const fromHay = [
    message && message.from,
    author.email,
    author.name,
    meta.fromEmail,
    meta.fromName
  ].filter(Boolean).join(' ');
  if (!containsInsensitive(fromHay, query.fromContains)) return false;
  const subject = (message && message.subject) || meta.subject || '';
  if (!containsInsensitive(subject, query.subjectContains)) return false;
  if (query.pollByDate && query.since) {
    const raw = (message && (message.timestamp || message.date)) || meta.date || meta.timestamp;
    const ts = raw ? Date.parse(raw) : NaN;
    if (Number.isFinite(ts) && ts < query.since.getTime()) return false;
  }
  if (query.mailbox) {
    const box = String(meta.mailbox || '').trim();
    if (box && box.toLowerCase() !== query.mailbox.toLowerCase()) return false;
  }
  return true;
}

module.exports = {
  clampInt,
  containsInsensitive,
  resolveLookbackHours,
  resolveMailPollQuery,
  mailSettingsFromDataConfig,
  mailQueryFingerprint,
  overlayMailInstanceFromDataConfig,
  messageMatchesMailQuery
};
