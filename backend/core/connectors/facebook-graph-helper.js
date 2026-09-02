/**
 * FICHIER : backend/core/connectors/facebook-graph-helper.js
 * RÔLE : Helpers Graph API + résolution token page (dual-read facebook_configs).
 */

const https = require('https');

const DEFAULT_GRAPH_VERSION =
  String(process.env.FACEBOOK_GRAPH_VERSION || 'v21.0').trim() || 'v21.0';

const DEFAULT_POST_FIELDS = [
  'id',
  'message',
  'story',
  'created_time',
  'from',
  'permalink_url'
];

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body || '{}'));
          } catch (e) {
            reject(new Error('Réponse Graph non JSON'));
          }
        });
      })
      .on('error', reject);
  });
}

function httpsPostForm(url, data = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = new URLSearchParams();
    Object.keys(data || {}).forEach((key) => {
      if (data[key] === undefined || data[key] === null) return;
      postData.append(key, typeof data[key] === 'object' ? JSON.stringify(data[key]) : String(data[key]));
    });
    const body = postData.toString();
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          let json = {};
          try {
            json = JSON.parse(raw || '{}');
          } catch (_) {
            json = { raw };
          }
          if (res.statusCode !== 200 && res.statusCode !== 201) {
            reject(new Error((json.error && json.error.message) || `HTTP ${res.statusCode}`));
            return;
          }
          if (json.error) {
            reject(new Error(json.error.message || 'Erreur Graph API Facebook'));
            return;
          }
          resolve(json);
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * POST Graph form-urlencoded.
 * @param {string} graphPath
 * @param {string} accessToken
 * @param {Object} fields
 * @param {string} [graphVersion]
 */
async function graphPost(graphPath, accessToken, fields = {}, graphVersion = DEFAULT_GRAPH_VERSION) {
  const clean = String(graphPath || '')
    .replace(/^\/+/, '')
    .replace(new RegExp(`^${graphVersion}/`), '');
  const url = `https://graph.facebook.com/${graphVersion}/${clean}`;
  return httpsPostForm(url, { ...fields, access_token: accessToken });
}

/**
 * Envoie une réponse Facebook (commentaire, post ou message privé).
 * @param {Object} database
 * @param {string} entrepriseId
 * @param {Object} opts
 */
async function sendFacebookReply(database, entrepriseId, opts = {}) {
  const pageIdHint = opts.pageId || null;
  const config = await resolveFacebookPageConfig(database, entrepriseId, pageIdHint);
  const pageId = String(config.pageId);
  const token = config.pageAccessToken;
  const version = opts.graphVersion || DEFAULT_GRAPH_VERSION;
  const message = String(opts.message || '').trim();
  if (!message) throw new Error('Message de réponse vide');

  const mode = String(opts.replyMode || 'auto').toLowerCase();
  const commentId = opts.commentId ? String(opts.commentId) : '';
  const postId = opts.postId ? String(opts.postId) : '';
  const recipientId = opts.recipientId ? String(opts.recipientId) : '';

  let channel = mode;
  if (mode === 'auto') {
    if (commentId) channel = 'comment';
    else if (postId) channel = 'post';
    else if (recipientId) channel = 'message';
    else throw new Error('Impossible de déterminer le canal (commentId, postId ou recipientId requis)');
  }

  let response = null;
  if (channel === 'comment') {
    if (!commentId) throw new Error('commentId requis pour une réponse commentaire');
    response = await graphPost(`${commentId}/comments`, token, { message }, version);
  } else if (channel === 'post') {
    if (!postId) throw new Error('postId requis pour commenter une publication');
    response = await graphPost(`${postId}/comments`, token, { message }, version);
  } else if (channel === 'message' || channel === 'messaging') {
    if (!recipientId) throw new Error('recipientId (PSID) requis pour un message privé');
    response = await graphPost(
      'me/messages',
      token,
      {
        recipient: JSON.stringify({ id: recipientId }),
        message: JSON.stringify({ text: message })
      },
      version
    );
  } else {
    throw new Error(`Mode de réponse Facebook inconnu : ${channel}`);
  }

  return {
    success: true,
    channel,
    pageId,
    pageName: config.pageName || pageId,
    facebookResponse: response || {},
    message
  };
}

/**
 * Actions Graph sur un objet (commentaire / post) : masquer, aimer, supprimer.
 * @param {Object} database
 * @param {string} entrepriseId
 * @param {Object} opts
 */
async function facebookObjectAction(database, entrepriseId, opts = {}) {
  const pageIdHint = opts.pageId || null;
  const config = await resolveFacebookPageConfig(database, entrepriseId, pageIdHint);
  const token = config.pageAccessToken;
  const version = opts.graphVersion || DEFAULT_GRAPH_VERSION;
  const objectId = String(opts.objectId || opts.commentId || opts.postId || opts.sourceRef || '').trim();
  if (!objectId) throw new Error('ID Facebook (sourceRef) requis');
  const action = String(opts.action || '').toLowerCase();
  let response = null;
  if (action === 'hide' || action === 'hide-comment') {
    response = await graphPost(objectId, token, { is_hidden: true }, version);
  } else if (action === 'unhide') {
    response = await graphPost(objectId, token, { is_hidden: false }, version);
  } else if (action === 'like') {
    response = await graphPost(`${objectId}/likes`, token, {}, version);
  } else if (action === 'delete') {
    response = await graphPost(objectId, token, { method: 'delete' }, version);
  } else {
    throw new Error(`Action Facebook inconnue : ${action}`);
  }
  return {
    success: true,
    action,
    objectId,
    pageId: String(config.pageId),
    facebookResponse: response || {}
  };
}

/**
 * Publie un post sur le fil de la page (texte / lien / image).
 * @param {Object} database
 * @param {string} entrepriseId
 * @param {Object} opts
 */
async function publishFacebookPost(database, entrepriseId, opts = {}) {
  const pageIdHint = opts.pageId || null;
  const config = await resolveFacebookPageConfig(database, entrepriseId, pageIdHint);
  const pageId = String(config.pageId);
  const token = config.pageAccessToken;
  const version = opts.graphVersion || DEFAULT_GRAPH_VERSION;

  const message = String(opts.message || '').trim();
  const link = String(opts.link || opts.linkUrl || '').trim();
  const imageUrl = String(opts.imageUrl || opts.image_url || '').trim();
  const isPublished =
    opts.published === undefined ||
    opts.published === true ||
    opts.published === 'true' ||
    opts.published === 1;

  if (!message && !link && !imageUrl) {
    throw new Error('Indiquez au moins un message, un lien ou une image pour publier');
  }

  let response = null;
  if (imageUrl) {
    const photoData = {
      url: imageUrl,
      published: isPublished ? 'true' : 'false'
    };
    if (message) photoData.message = message;
    response = await graphPost(`${pageId}/photos`, token, photoData, version);
  } else {
    const feedData = {
      published: isPublished ? 'true' : 'false'
    };
    if (message) feedData.message = message;
    if (link) feedData.link = link;
    response = await graphPost(`${pageId}/feed`, token, feedData, version);
  }

  return {
    success: true,
    channel: 'publish',
    pageId,
    pageName: config.pageName || pageId,
    postId: (response && (response.id || response.post_id)) || null,
    facebookResponse: response || {},
    message,
    link: link || null,
    imageUrl: imageUrl || null,
    published: isPublished
  };
}

/**
 * @param {Object} database
 * @param {string} entrepriseId
 * @param {string|null} pageIdHint
 * @returns {Promise<Object>} document facebook_configs
 */
async function resolveFacebookPageConfig(database, entrepriseId, pageIdHint = null) {
  const eid = String(entrepriseId || '');
  if (!eid) throw new Error('entrepriseId requis');

  const fbCol = database.getCollection('facebook_configs');
  let config = null;

  if (pageIdHint) {
    config = await fbCol.findOne({ entrepriseId: eid, pageId: String(pageIdHint) });
  }

  if (!config) {
    const inst = await database.getCollection('connector_instances').findOne({
      entrepriseId: eid,
      connectorId: 'facebook',
      enabled: { $ne: false },
      ...(pageIdHint ? { 'settings.pageId': String(pageIdHint) } : {})
    });
    if (inst && inst.settings && inst.settings.pageId) {
      config = await fbCol.findOne({
        entrepriseId: eid,
        pageId: String(inst.settings.pageId)
      });
    }
  }

  if (!config) {
    config = await fbCol.findOne({
      entrepriseId: eid,
      pageAccessToken: { $exists: true, $nin: [null, ''] }
    });
  }

  if (!config || !config.pageAccessToken) {
    throw new Error('Aucune page Facebook avec token pour cette entité (facebook_configs).');
  }

  return config;
}

/**
 * @param {string} graphPath ex. "1056.../published_posts"
 * @param {string} accessToken
 * @param {Object} params
 * @param {string} [graphVersion]
 */
async function graphGet(graphPath, accessToken, params = {}, graphVersion = DEFAULT_GRAPH_VERSION) {
  const clean = String(graphPath || '')
    .replace(/^\/+/, '')
    .replace(new RegExp(`^${graphVersion}/`), '');
  const qs = new URLSearchParams({
    access_token: accessToken,
    ...Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    )
  });
  const url = `https://graph.facebook.com/${graphVersion}/${clean}?${qs.toString()}`;
  return graphGetAbsolute(url);
}

async function graphGetAbsolute(url) {
  const response = await httpsGetJson(url);
  if (response.error) {
    throw new Error(response.error.message || 'Erreur Graph API Facebook');
  }
  return response;
}

/**
 * Paginer un endpoint Graph jusqu'à épuisement (ou maxPages).
 * @returns {Promise<Object[]>}
 */
async function graphGetAllPages(graphPath, accessToken, params = {}, graphVersion = DEFAULT_GRAPH_VERSION, maxPages = 20) {
  const items = [];
  let response = await graphGet(graphPath, accessToken, params, graphVersion);
  let pages = 0;
  while (response && pages < maxPages) {
    pages += 1;
    if (Array.isArray(response.data)) items.push(...response.data);
    const next = response.paging && response.paging.next ? String(response.paging.next) : '';
    if (!next) break;
    response = await graphGetAbsolute(next);
  }
  return items;
}

function normalizeIdList(raw) {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x || '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Config poll détaillée (posts / commentaires / MP séparés).
 */
function flagEnabled(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return value === true || value === 'true' || value === 1 || value === '1';
}

function resolvePollConfig(settings = {}) {
  const resources = resolveResources(settings);
  const postsEnabled = resources.includes('posts');
  const commentsEnabled = resources.includes('comments');
  const messagesEnabled = resources.includes('messages');
  const useLookback = flagEnabled(settings.pollByDate, true);
  const useCount = flagEnabled(settings.pollByCount, true);

  return {
    postsEnabled,
    commentsEnabled,
    messagesEnabled,
    resources,
    useLookback,
    useCount,
    postLimit: useCount
      ? clampLimit(settings.postLimit != null ? settings.postLimit : settings.limit, 25, 50)
      : 50,
    commentPostsToScan: useCount
      ? clampLimit(
        settings.commentPostsToScan != null ? settings.commentPostsToScan : settings.commentCatchupLimit,
        20,
        50
      )
      : 50,
    commentsPerPost: useCount
      ? clampLimit(
        settings.commentsPerPost != null ? settings.commentsPerPost : settings.commentsPerPostLimit,
        50,
        100
      )
      : 100,
    commentsFetchAll: settings.commentsFetchAll === true || settings.commentsFetchAll === '1' || settings.commentsFetchAll === 1,
    commentPostIds: normalizeIdList(settings.commentPostIds),
    messageConversationsLimit: useCount
      ? clampLimit(settings.messageConversationsLimit, 10, 50)
      : 50,
    messagesPerConversation: useCount
      ? clampLimit(settings.messagesPerConversation, 20, 50)
      : 50,
    lookbackHours: resolveLookbackHours(settings),
    pollIntervalMinutes: clampLimit(settings.pollIntervalMinutes, 15, 1440)
  };
}

function clampLimit(raw, fallback = 25, max = 50) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), 1), max);
}

/** Fenêtre de temps poll : hours (ou days * 24), défaut 7 j, max 90 j. */
function resolveLookbackHours(settings = {}, fallbackHours = 168, maxHours = 2160) {
  if (settings == null || typeof settings !== 'object') {
    return clampLimit(fallbackHours, fallbackHours, maxHours);
  }
  if (settings.lookbackHours != null && settings.lookbackHours !== '') {
    return clampLimit(settings.lookbackHours, fallbackHours, maxHours);
  }
  if (settings.lookbackDays != null && settings.lookbackDays !== '') {
    return clampLimit(Number(settings.lookbackDays) * 24, fallbackHours, maxHours);
  }
  return clampLimit(fallbackHours, fallbackHours, maxHours);
}

function resolvePostFields(settings) {
  if (Array.isArray(settings.postFields) && settings.postFields.length) {
    return settings.postFields.map(String);
  }
  if (typeof settings.postFields === 'string' && settings.postFields.trim()) {
    return settings.postFields.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_POST_FIELDS.slice();
}

function resolveResources(settings) {
  const raw = settings.resources;
  if (Array.isArray(raw) && raw.length) {
    return raw.map(String).filter((r) => ['posts', 'comments', 'messages'].includes(r));
  }
  return ['posts'];
}

const WEBHOOK_EVENT_TYPES = ['comments', 'messages', 'posts', 'notifications'];

/**
 * Événements webhook acceptés (temps réel).
 * Défaut : commentaires + messages privés.
 * @param {Object} settings
 * @returns {string[]}
 */
function resolveWebhookEvents(settings = {}) {
  const raw = settings && (settings.webhookEvents || settings.pushEvents);
  if (Array.isArray(raw) && raw.length) {
    const list = raw.map(String).filter((e) => WEBHOOK_EVENT_TYPES.includes(e));
    if (list.length) return list;
  }
  // Rétrocompat : dériver depuis resources si présent
  if (settings && Array.isArray(settings.resources) && settings.resources.length) {
    const derived = [];
    if (settings.resources.includes('comments')) derived.push('comments');
    if (settings.resources.includes('posts')) derived.push('posts');
    if (settings.resources.includes('messages')) derived.push('messages');
    if (derived.length) return derived;
  }
  return ['comments', 'messages'];
}

/**
 * Classe un événement feed Meta → comments | posts | notifications.
 * @param {Object} value change.value
 * @returns {'comments'|'posts'|'notifications'}
 */
function classifyFeedWebhookValue(value) {
  if (!value || typeof value !== 'object') return 'notifications';
  const item = String(value.item || '').toLowerCase();
  if (value.comment_id || item === 'comment') return 'comments';
  if (['status', 'post', 'photo', 'video', 'share', 'album'].includes(item) && !value.comment_id) {
    return 'posts';
  }
  if (item === 'reaction' || item === 'like' || value.reaction_type) return 'notifications';
  // Publication sans comment_id mais avec message texte
  if (!value.comment_id && (value.post_id || value.message)) return 'posts';
  return 'notifications';
}

function postText(post) {
  return String((post && (post.message || post.story)) || '').trim();
}

function toUnix(dateLike) {
  if (!dateLike) return null;
  const t = new Date(dateLike).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor(t / 1000);
}

module.exports = {
  DEFAULT_GRAPH_VERSION,
  DEFAULT_POST_FIELDS,
  WEBHOOK_EVENT_TYPES,
  httpsGetJson,
  httpsPostForm,
  resolveFacebookPageConfig,
  graphGet,
  graphGetAbsolute,
  graphGetAllPages,
  graphPost,
  sendFacebookReply,
  facebookObjectAction,
  publishFacebookPost,
  clampLimit,
  resolveLookbackHours,
  resolvePostFields,
  resolveResources,
  resolvePollConfig,
  resolveWebhookEvents,
  classifyFeedWebhookValue,
  normalizeIdList,
  postText,
  toUnix
};
