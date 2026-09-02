/**
 * ImapService - Gestion de la réception d'emails via IMAP
 * Fichier : backend/modules/mail/services/ImapService.js
 *
 * Objectif initial :
 * - fournir une brique générique pour se connecter en IMAP (ex. OVH) et tester la connexion
 * - permettre ensuite à d'autres modules (newsletter → posts Facebook, etc.) de récupérer les messages
 */

const { ImapFlow } = require('imapflow');

class ImapService {
  constructor(database) {
    this.database = database;
  }

  /**
   * Normalise une config IMAP venant de mail_configs.config.imap_config
   * @param {Object} rawConfig
   * @returns {{host:string, port:number, secure:boolean, auth:{user:string, pass:string}, mailbox:string}}
   */
  normalizeConfig(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object') {
      throw new Error('Configuration IMAP invalide ou manquante');
    }

    const host = rawConfig.host || rawConfig.server || rawConfig.hostname;
    const port = rawConfig.port != null ? Number(rawConfig.port) : 993;
    // OVH : SSL/TLS sur 993
    const secure = rawConfig.secure != null ? Boolean(rawConfig.secure) : true;
    const user = rawConfig.user || rawConfig.username || rawConfig.login;
    const pass = rawConfig.password || rawConfig.pass;
    const mailbox = rawConfig.mailbox || rawConfig.folder || 'INBOX';

    if (!host || !user || !pass) {
      throw new Error('Configuration IMAP incomplète (host, user, password requis)');
    }

    return {
      host,
      port,
      secure,
      auth: { user, pass },
      mailbox
    };
  }

  /**
   * Teste simplement la connexion IMAP (sans rien lire).
   * @param {Object} rawConfig - imap_config brut depuis Mongo
   * @returns {Promise<{success:boolean, message:string}>}
   */
  async testConnection(rawConfig) {
    let client;
    try {
      const cfg = this.normalizeConfig(rawConfig);
      client = new ImapFlow({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.auth
      });

      await client.connect();
      // Verrouiller la mailbox juste pour vérifier l'accès
      await client.getMailboxLock(cfg.mailbox);
      await client.logout();

      return {
        success: true,
        message: `Connexion IMAP OK sur ${cfg.host}:${cfg.port}, boîte ${cfg.mailbox}`
      };
    } catch (error) {
      if (client) {
        try {
          await client.logout();
        } catch (_) {
          // ignore
        }
      }
      return {
        success: false,
        message: `Erreur IMAP: ${error.message}`
      };
    }
  }

  filenameFromNode(node) {
    const sources = [
      (node && node.dispositionParameters) || {},
      (node && node.parameters) || {}
    ];
    for (let s = 0; s < sources.length; s += 1) {
      const obj = sources[s];
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i += 1) {
        const key = String(keys[i] || '').toLowerCase();
        if (key === 'filename' || key === 'name' || key.indexOf('filename') === 0 || key.indexOf('name') === 0) {
          const raw = obj[keys[i]];
          if (raw) return this.decodeRfc2231Name(raw);
        }
      }
    }
    return null;
  }

  decodeRfc2231Name(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    const m = s.match(/^[^']*'[^']*'(.*)$/);
    if (!m) return s;
    try {
      return decodeURIComponent(m[1].replace(/\+/g, '%20'));
    } catch (_) {
      return m[1] || s;
    }
  }

  nodeLooksAttached(node) {
    const mime = this.mimeTypeOfNode(node);
    if (mime.type === 'multipart') return false;
    const disposition = String((node && node.disposition) || '').toLowerCase();
    const filename = this.filenameFromNode(node);
    const isTextBody = mime.type === 'text'
      && (mime.subtype === 'plain' || mime.subtype === 'html' || mime.subtype === 'x-amp-html');
    if (disposition === 'attachment') return true;
    if (isTextBody && disposition !== 'attachment') return false;
    if (disposition === 'inline' && mime.type === 'image') return false;
    if (filename && !isTextBody) return true;
    if (mime.type === 'application' || mime.type === 'message') return true;
    if (mime.type === 'image' && disposition !== 'inline') return true;
    return false;
  }

  /**
   * Collecte les parties pièce jointe depuis bodyStructure ImapFlow.
   * ImapFlow pose `type: "application/pdf"` (pas type + subtype séparés).
   * Un mail qui EST un PDF (pas multipart) n'a souvent pas de `part`.
   * @param {Object} node
   * @param {Array} out
   */
  collectAttachmentParts(node, out = []) {
    if (!node || typeof node !== 'object') return out;

    if (Array.isArray(node.childNodes) && node.childNodes.length) {
      for (const child of node.childNodes) {
        this.collectAttachmentParts(child, out);
      }
      const mime = this.mimeTypeOfNode(node);
      if (mime.type === 'message' && this.nodeLooksAttached(node)) {
        const part = node.part != null && String(node.part).trim() !== '' ? String(node.part) : '';
        out.push({
          part,
          filename: String(this.filenameFromNode(node) || `message-${part || 'root'}.eml`),
          contentType: `${mime.type}/${mime.subtype || 'rfc822'}`,
          size: Number(node.size) || 0
        });
      }
      return out;
    }

    if (!this.nodeLooksAttached(node)) return out;

    const mime = this.mimeTypeOfNode(node);
    const part = node.part != null && String(node.part).trim() !== '' ? String(node.part) : '';
    const filename = this.filenameFromNode(node)
      || `part-${part || 'root'}.${mime.subtype && mime.subtype !== '?' ? mime.subtype : 'bin'}`;
    out.push({
      part,
      filename: String(filename),
      contentType: `${mime.type || 'application'}/${mime.subtype || 'octet-stream'}`,
      size: Number(node.size) || 0
    });
    return out;
  }

  async streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  decodeQuotedPrintable(str) {
    const compact = String(str || '').replace(/=\r?\n/g, '');
    const bytes = [];
    for (let i = 0; i < compact.length; i += 1) {
      if (compact[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(compact.slice(i + 1, i + 3))) {
        bytes.push(parseInt(compact.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(compact.charCodeAt(i) & 0xff);
      }
    }
    return Buffer.from(bytes).toString('utf8');
  }

  stripHtml(html) {
    return String(html || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  normalizeMailBody(buf, meta = {}) {
    let raw = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf || '');
    if (/=[0-9A-Fa-f]{2}/.test(raw)) {
      try { raw = this.decodeQuotedPrintable(raw); } catch (_) { /* garder brut */ }
    }
    const ctype = String((meta && (meta.contentType || meta.type)) || '').toLowerCase();
    if (ctype.indexOf('html') >= 0 || /<html|<body|<div|<p[\s>/]/i.test(raw)) {
      raw = this.stripHtml(raw);
    }
    return raw.replace(/\s+/g, ' ').trim().slice(0, 8000);
  }

  async downloadPartText(client, uid, part) {
    const downloaded = await client.download(uid, part, { uid: true });
    if (!downloaded || !downloaded.content) return '';
    const buf = await this.streamToBuffer(downloaded.content);
    return this.normalizeMailBody(buf, downloaded.meta || {});
  }

  mimeTypeOfNode(node) {
    const rawType = String((node && node.type) || '').toLowerCase().trim();
    let subtype = String((node && node.subtype) || '').toLowerCase().trim();
    let type = rawType;
    if (rawType.indexOf('/') >= 0) {
      const bits = rawType.split('/');
      type = bits[0] || '';
      if (!subtype) subtype = bits[1] || '';
    }
    return { type, subtype };
  }

  looksLikeRawMime(text) {
    const s = String(text || '');
    return /Content-Type\s*:/i.test(s)
      || /Content-Transfer-Encoding\s*:/i.test(s)
      || /------=_Part_/i.test(s)
      || /----_NmP-/i.test(s)
      || /boundary=/i.test(s);
  }

  readFetchedBodyPart(msg, key) {
    const parts = msg && msg.bodyParts;
    if (!parts) return null;
    const want = String(key || '').toLowerCase();
    if (typeof parts.get === 'function') {
      for (const [k, v] of parts) {
        if (String(k).toLowerCase() === want) return v;
      }
      return null;
    }
    if (typeof parts === 'object') {
      const hit = Object.keys(parts).find((k) => String(k).toLowerCase() === want);
      return hit ? parts[hit] : null;
    }
    return null;
  }

  imapTextFetchQuery() {
    return {
      uid: true,
      envelope: true,
      bodyStructure: true,
      // Texte seulement — les PJ sont téléchargées après le FETCH (sinon deadlock IMAP).
      bodyParts: ['1.1.1', '1.1', '1', '1.2', 'TEXT']
    };
  }

  collectTextPartIds(node, out = []) {
    if (!node || typeof node !== 'object') return out;
    if (Array.isArray(node.childNodes) && node.childNodes.length) {
      node.childNodes.forEach((child) => this.collectTextPartIds(child, out));
      return out;
    }
    const mime = this.mimeTypeOfNode(node);
    const disposition = String(node.disposition || '').toLowerCase();
    if (disposition === 'attachment') return out;
    if (mime.type === 'text' || mime.subtype === 'plain' || mime.subtype === 'html') {
      out.push({
        part: node.part != null && String(node.part).trim() !== '' ? String(node.part) : '',
        subtype: mime.subtype || 'plain',
        encoding: String(node.encoding || '').toLowerCase()
      });
    }
    return out;
  }

  describeStructure(node) {
    if (!node || typeof node !== 'object') return 'none';
    const type = `${String(node.type || '?').toLowerCase()}/${String(node.subtype || '?').toLowerCase()}`;
    const part = node.part != null ? String(node.part) : '-';
    if (Array.isArray(node.childNodes) && node.childNodes.length) {
      return `${part}:${type}[${node.childNodes.map((c) => this.describeStructure(c)).join(',')}]`;
    }
    return `${part}:${type}`;
  }

  textFromRfc822(buf) {
    const raw = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf || '');
    const split = raw.search(/\r?\n\r?\n/);
    const headers = split >= 0 ? raw.slice(0, split) : '';
    const body = split >= 0 ? raw.slice(split).replace(/^\r?\n\r?\n/, '') : raw;
    const ctLine = (headers.match(/content-type:\s*([^\r\n]+)/i) || [])[1] || '';
    const boundary = (ctLine.match(/boundary="?([^";\r\n]+)"?/i) || [])[1];
    if (!boundary) {
      const nested = /content-type:\s*multipart/i.test(raw) || /^--/m.test(raw.trim());
      if (nested && raw !== body) return this.textFromMimeBlob(raw);
      return this.normalizeMailBody(body || raw, { contentType: ctLine });
    }
    const chunks = body.split('--' + boundary);
    let html = '';
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const idx = chunk.search(/\r?\n\r?\n/);
      if (idx < 0) continue;
      const h = chunk.slice(0, idx);
      const b = chunk.slice(idx).replace(/^\r?\n\r?\n/, '').replace(/\r?\n--\s*$/, '').trim();
      if (/content-disposition:\s*attachment/i.test(h)) continue;
      if (/content-type:\s*multipart/i.test(h)) {
        const nested = this.textFromRfc822(chunk.trim() + (chunk.endsWith('\n') ? '' : '\n'));
        if (nested && !this.looksLikeRawMime(nested)) return nested;
        continue;
      }
      if (/content-type:\s*text\/plain/i.test(h)) {
        const text = this.normalizeMailBody(b, { contentType: 'text/plain' });
        if (text && !this.looksLikeRawMime(text)) return text;
      }
      if (!html && /content-type:\s*text\/html/i.test(h)) html = b;
    }
    if (html) return this.normalizeMailBody(html, { contentType: 'text/html' });
    return '';
  }

  textFromMimeBlob(buf) {
    const raw = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf || '');
    let bound = (raw.match(/boundary="?([^";\r\n]+)"?/i) || [])[1] || '';
    if (!bound) bound = (raw.match(/^--([^\r\n]+)/m) || [])[1] || '';
    if (bound) {
      const parsed = this.textFromRfc822(
        `Content-Type: multipart/mixed; boundary="${bound}"\r\n\r\n${raw}`
      );
      if (parsed && !this.looksLikeRawMime(parsed)) return parsed;
    }
    if (/^\s*content-type\s*:/i.test(raw)) {
      const parsed = this.textFromRfc822(raw);
      if (parsed && !this.looksLikeRawMime(parsed)) return parsed;
    }
    return this.normalizeMailBody(raw, { contentType: 'text/plain' });
  }

  async downloadPartBuffer(client, uid, part) {
    const res = await client.fetchOne(String(uid), { bodyParts: [part] }, { uid: true });
    return this.readFetchedBodyPart(res, part);
  }

  async resolveMailText(client, msg) {
    const tried = [];
    const found = this.collectTextPartIds(msg && msg.bodyStructure);
    const keys = [];
    found.filter((p) => p.subtype === 'plain' && p.part).forEach((p) => keys.push(p.part));
    ['1.1.1', '1.1', '1'].forEach((k) => keys.push(k));
    found.filter((p) => p.subtype !== 'plain' && p.part).forEach((p) => keys.push(p.part));
    ['1.2', '2'].forEach((k) => keys.push(k));
    keys.push('TEXT');
    const seen = {};
    for (let i = 0; i < keys.length; i += 1) {
      const key = String(keys[i] || '').trim();
      if (!key || seen[key.toLowerCase()]) continue;
      seen[key.toLowerCase()] = true;
      tried.push(key);
      let buf = this.readFetchedBodyPart(msg, key);
      if ((!buf || !buf.length) && client && msg && msg.uid) {
        try {
          buf = await this.downloadPartBuffer(client, msg.uid, key);
        } catch (err) {
          tried.push(`${key}!${err && err.message ? err.message : 'err'}`);
        }
      }
      if (!buf || !buf.length) continue;
      const looksHtml = found.some((p) => p.part === key && p.subtype === 'html')
        || key === '1.2'
        || key === '2';
      let text = this.normalizeMailBody(buf, { contentType: looksHtml ? 'text/html' : 'text/plain' });
      if (this.looksLikeRawMime(text) || this.looksLikeRawMime(Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf || ''))) {
        text = this.textFromMimeBlob(buf);
      }
      if (text && !this.looksLikeRawMime(text)) return { text, part: key, tried };
    }
    if (client && msg && msg.uid) {
      try {
        const res = await client.fetchOne(String(msg.uid), {
          source: { maxLength: 200000 }
        }, { uid: true });
        const src = res && res.source;
        const text = src ? this.textFromRfc822(src) : '';
        tried.push('source');
        if (text) return { text, part: 'source', tried };
      } catch (err) {
        tried.push(`source!${err && err.message ? err.message : 'err'}`);
      }
    }
    return { text: '', part: null, tried };
  }

  async downloadMessageAttachments(client, msg, parts) {
    const list = Array.isArray(parts) ? parts : [];
    const attachments = [];
    const uid = msg && msg.uid;
    if (!uid || !client || !list.length) return attachments;

    for (const partInfo of list) {
      try {
        const partKey = partInfo && partInfo.part != null ? String(partInfo.part).trim() : '';
        const downloaded = partKey
          ? await client.download(String(uid), partKey, { uid: true })
          : await client.download(String(uid), false, { uid: true });
        if (!downloaded || !downloaded.content) continue;
        const content = await this.streamToBuffer(downloaded.content);
        if (!content || !content.length) continue;
        const meta = downloaded.meta || {};
        const metaName = meta.filename || meta.name || (partInfo && partInfo.filename);
        attachments.push({
          filename: String(metaName || (partInfo && partInfo.filename) || `attachment-${attachments.length + 1}`),
          contentType: meta.contentType || (partInfo && partInfo.contentType) || 'application/octet-stream',
          size: content.length,
          content
        });
      } catch (err) {
        console.warn(
          `  ⚠️ IMAP PJ uid=${uid} part=${partInfo && partInfo.part}:`,
          err && err.message
        );
      }
    }
    return attachments;
  }

  async hydrateFetchedMessage(client, msg, includeAttachments) {
    const fromAddr = msg.envelope?.from?.[0];
    const fromEmail = fromAddr?.address || '';
    const fromName = fromAddr?.name || fromEmail;
    const subject = msg.envelope?.subject || '(sans sujet)';
    const resolved = await this.resolveMailText(client, msg);
    const text = resolved.text || '';
    const parts = includeAttachments && msg.bodyStructure
      ? this.collectAttachmentParts(msg.bodyStructure, [])
      : [];
    const attachments = includeAttachments
      ? await this.downloadMessageAttachments(client, msg, parts)
      : [];

    return {
      uid: msg.uid,
      messageId: msg.envelope?.messageId || String(msg.uid),
      subject,
      fromEmail,
      fromName,
      text,
      date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
      attachments,
      attachmentParts: parts.map((p) => p && p.filename).filter(Boolean),
      textPart: resolved.part,
      textTried: resolved.tried,
      structure: this.describeStructure(msg.bodyStructure)
    };
  }

  parseSearchDate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  buildSearchQuery(options = {}) {
    const query = {};
    let has = false;
    if (options.unseenOnly) {
      query.seen = false;
      has = true;
    }
    if (options.sinceUid && options.sinceUid > 0) {
      query.uid = `${options.sinceUid + 1}:*`;
      has = true;
    }
    if (options.fromContains) {
      query.from = options.fromContains;
      has = true;
    }
    if (options.subjectContains) {
      query.subject = options.subjectContains;
      has = true;
    }
    if (options.sinceDate) {
      query.since = options.sinceDate;
      has = true;
    }
    if (options.beforeDate) {
      query.before = options.beforeDate;
      has = true;
    }
    if (!has) query.all = true;
    return query;
  }

  async searchUids(client, query, { fromContains, subjectContains } = {}) {
    try {
      const found = await client.search(query, { uid: true });
      return Array.isArray(found) ? found.map(Number).filter(Boolean) : [];
    } catch (err) {
      if (!fromContains && !subjectContains) throw err;
      const fallback = { ...query };
      delete fallback.from;
      delete fallback.subject;
      console.warn('  ⚠️ IMAP SEARCH from/subject non supporté, repli date/flags :', err.message);
      const found = await client.search(fallback, { uid: true });
      return Array.isArray(found) ? found.map(Number).filter(Boolean) : [];
    }
  }

  /**
   * Lit des messages IMAP via SEARCH (expéditeur, sujet, date, non lus) puis FETCH limité.
   * @param {Object} rawConfig
   * @param {{
   *   unseenOnly?: boolean,
   *   limit?: number,
   *   sinceUid?: number|null,
   *   includeAttachments?: boolean,
   *   fromContains?: string,
   *   subjectContains?: string,
   *   since?: Date|string|null,
   *   before?: Date|string|null,
   *   newestFirst?: boolean
   * }} [options]
   */
  async fetchMessages(rawConfig, options = {}) {
    const cfg = this.normalizeConfig(rawConfig);
    const unseenOnly = options.unseenOnly === true;
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const sinceUid = options.sinceUid != null ? Number(options.sinceUid) : null;
    const includeAttachments = options.includeAttachments === true;
    const fromContains = String(options.fromContains || '').trim();
    const subjectContains = String(options.subjectContains || '').trim();
    const sinceDate = this.parseSearchDate(options.since);
    const beforeDate = this.parseSearchDate(options.before);
    const newestFirst = options.newestFirst === true;

    let client;
    try {
      client = new ImapFlow({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.auth
      });
      await client.connect();
      const lock = await client.getMailboxLock(cfg.mailbox, { readOnly: true });
      try {
        const query = this.buildSearchQuery({
          unseenOnly,
          sinceUid,
          fromContains,
          subjectContains,
          sinceDate,
          beforeDate
        });
        let uids = await this.searchUids(client, query, { fromContains, subjectContains });
        if (!uids.length) return [];
        uids.sort((a, b) => (newestFirst ? b - a : a - b));
        uids = uids.slice(0, limit);
        return this.hydrateUidList(client, uids, includeAttachments);
      } finally {
        lock.release();
      }
    } finally {
      if (client) {
        try { await client.logout(); } catch (_) { /* ignore */ }
      }
    }
  }

  async hydrateUidList(client, uids, includeAttachments) {
    const list = (Array.isArray(uids) ? uids : []).map(Number).filter(Boolean);
    if (!list.length) return [];
    const range = list.join(',');
    const rawByUid = new Map();
    for await (const msg of client.fetch(range, this.imapTextFetchQuery(), { uid: true })) {
      rawByUid.set(Number(msg.uid), msg);
    }
    const byUid = new Map();
    for (const uid of list) {
      const raw = rawByUid.get(uid);
      if (!raw) continue;
      byUid.set(uid, await this.hydrateFetchedMessage(client, raw, includeAttachments));
    }
    return list.map((uid) => byUid.get(uid)).filter(Boolean);
  }

  /**
   * N messages les plus récents de la boîte (séquence IMAP), sans UNSEEN / SINCE / FROM.
   * Chemin « Max messages = 3 » du bloc Données.
   */
  async fetchLatest(rawConfig, limit, options = {}) {
    const cfg = this.normalizeConfig(rawConfig);
    const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const includeAttachments = options.includeAttachments === true;
    let client;
    try {
      client = new ImapFlow({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.auth
      });
      await client.connect();
      const lock = await client.getMailboxLock(cfg.mailbox, { readOnly: true });
      try {
        const exists = Number(client.mailbox && client.mailbox.exists) || 0;
        if (!exists) {
          return {
            messages: [],
            meta: {
              host: cfg.host,
              mailbox: cfg.mailbox,
              mailboxExists: 0,
              range: null,
              fetched: 0,
              take
            }
          };
        }
        const fromSeq = Math.max(1, exists - take + 1);
        const rawMsgs = [];
        for await (const msg of client.fetch(`${fromSeq}:${exists}`, this.imapTextFetchQuery())) {
          rawMsgs.push(msg);
        }
        const fetched = [];
        for (const msg of rawMsgs) {
          fetched.push(await this.hydrateFetchedMessage(client, msg, includeAttachments));
        }
        fetched.sort((a, b) => Number(b.uid) - Number(a.uid));
        return {
          messages: fetched.slice(0, take),
          meta: {
            host: cfg.host,
            mailbox: cfg.mailbox,
            mailboxExists: exists,
            range: `${fromSeq}:${exists}`,
            fetched: fetched.length,
            take
          }
        };
      } finally {
        lock.release();
      }
    } finally {
      if (client) {
        try { await client.logout(); } catch (_) { /* ignore */ }
      }
    }
  }

  findFirstTextPart(node) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node.childNodes) && node.childNodes.length) {
      for (const child of node.childNodes) {
        const found = this.findFirstTextPart(child);
        if (found) return found;
      }
      return null;
    }
    const mime = this.mimeTypeOfNode(node);
    const disposition = String(node.disposition || '').toLowerCase();
    if (mime.type === 'text' && mime.subtype === 'plain' && disposition !== 'attachment') {
      return node.part ? String(node.part) : 'TEXT';
    }
    if (mime.type === 'text' && mime.subtype === 'html' && disposition !== 'attachment') {
      return node.part ? String(node.part) : 'TEXT';
    }
    return null;
  }

  /**
   * Marque un message comme lu.
   * @param {Object} rawConfig
   * @param {number|string} uid
   */
  async markSeen(rawConfig, uid) {
    return this.withMailbox(rawConfig, async (client) => {
      const n = Number(uid);
      if (!n) throw new Error('UID IMAP invalide');
      await client.messageFlagsAdd(n, ['\\Seen'], { uid: true });
      return { success: true, uid: n, action: 'seen' };
    });
  }

  /**
   * Marque un message comme non lu.
   * @param {Object} rawConfig
   * @param {number|string} uid
   */
  async markUnseen(rawConfig, uid) {
    return this.withMailbox(rawConfig, async (client) => {
      const n = Number(uid);
      if (!n) throw new Error('UID IMAP invalide');
      await client.messageFlagsRemove(n, ['\\Seen'], { uid: true });
      return { success: true, uid: n, action: 'unseen' };
    });
  }

  /**
   * Déplace un message vers un autre dossier IMAP.
   * @param {Object} rawConfig
   * @param {number|string} uid
   * @param {string} destination
   */
  async moveMessage(rawConfig, uid, destination) {
    const dest = String(destination || '').trim();
    if (!dest) throw new Error('Dossier IMAP de destination requis');
    return this.withMailbox(rawConfig, async (client) => {
      const n = Number(uid);
      if (!n) throw new Error('UID IMAP invalide');
      await client.messageMove(n, dest, { uid: true });
      return { success: true, uid: n, action: 'move', mailbox: dest };
    });
  }

  /**
   * Supprime un message IMAP (flag Deleted + expunge via messageDelete).
   * @param {Object} rawConfig
   * @param {number|string} uid
   */
  async deleteMessage(rawConfig, uid) {
    return this.withMailbox(rawConfig, async (client) => {
      const n = Number(uid);
      if (!n) throw new Error('UID IMAP invalide');
      await client.messageDelete(n, { uid: true });
      return { success: true, uid: n, action: 'delete' };
    });
  }

  /**
   * @param {Object} rawConfig
   * @param {(client: import('imapflow').ImapFlow) => Promise<any>} fn
   */
  async withMailbox(rawConfig, fn) {
    const cfg = this.normalizeConfig(rawConfig);
    let client;
    try {
      client = new ImapFlow({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.auth
      });
      await client.connect();
      const lock = await client.getMailboxLock(cfg.mailbox);
      try {
        return await fn(client, cfg);
      } finally {
        lock.release();
      }
    } finally {
      if (client) {
        try { await client.logout(); } catch (_) { /* ignore */ }
      }
    }
  }
}

module.exports = ImapService;
