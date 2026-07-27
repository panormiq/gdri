/**
 * FICHIER : backend/core/connectors/fetchLatestFacebookPost.js
 * RÔLE : Dernier post publié (mode test manuel) — hors curseur de poll.
 */

const {
  DEFAULT_GRAPH_VERSION,
  resolveFacebookPageConfig,
  graphGet,
  postText
} = require('./facebook-graph-helper');

/**
 * @param {Object} database
 * @param {string} entrepriseId
 * @param {string|null} pageIdHint
 */
async function fetchLatestFacebookPost(database, entrepriseId, pageIdHint = null) {
  const config = await resolveFacebookPageConfig(database, entrepriseId, pageIdHint);
  const pageId = String(config.pageId);
  const fields = ['id', 'message', 'created_time', 'permalink_url', 'story'].join(',');

  const response = await graphGet(
    `${pageId}/published_posts`,
    config.pageAccessToken,
    { fields, limit: '5' },
    DEFAULT_GRAPH_VERSION
  );

  const posts = Array.isArray(response.data) ? response.data : [];
  const post = posts.find((p) => postText(p)) || posts[0];
  if (!post) {
    throw new Error('Aucun post publié trouvé sur la page Facebook.');
  }

  const text = postText(post);
  if (!text) {
    throw new Error("Le dernier post n'a pas de texte analysable (message/story vide).");
  }

  return {
    text,
    subject: `Post FB ${post.id}`,
    from: config.pageName || pageId,
    messageId: post.id,
    channel: 'facebook',
    pageId,
    permalink_url: post.permalink_url || null,
    created_time: post.created_time || null
  };
}

module.exports = { fetchLatestFacebookPost };
