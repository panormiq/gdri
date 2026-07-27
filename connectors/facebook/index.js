/**
 * Connecteur Facebook — webhook + poll Graph API incrémental.
 * Fichier : connectors/facebook/index.js
 *
 * Settings poll : resources (posts|comments|messages), postLimit, commentPostsToScan,
 * commentsPerPost, commentsFetchAll, commentPostIds, messageConversationsLimit,
 * messagesPerConversation, lookbackHours, pollIntervalMinutes, pageId
 * Cursor : { sinceUnix, commentsSinceUnix, messagesSinceUnix, seenIds[], lastPollAt }
 */

const { BaseConnector } = require('../../backend/core/connectors/BaseConnector');
const {
  DEFAULT_GRAPH_VERSION,
  resolveFacebookPageConfig,
  graphGet,
  graphGetAllPages,
  resolvePostFields,
  resolvePollConfig,
  resolveWebhookEvents,
  classifyFeedWebhookValue,
  postText,
  toUnix
} = require('../../backend/core/connectors/facebook-graph-helper');

const SEEN_IDS_CAP = 500;
const SAFETY_MARGIN_SEC = 5 * 60;
const COMMENT_FIELDS = 'id,message,created_time,from,message_tags';

class FacebookConnector extends BaseConnector {
  async testConnection(ctx) {
    const pageId = ctx.instance.settings?.pageId;
    if (!pageId) {
      return { success: false, message: 'pageId requis dans settings' };
    }
    try {
      const config = await resolveFacebookPageConfig(ctx.database, ctx.entrepriseId, pageId);
      const version = ctx.instance.settings?.graphVersion || DEFAULT_GRAPH_VERSION;
      await graphGet(String(config.pageId), config.pageAccessToken, { fields: 'id,name' }, version);
      return {
        success: true,
        message: `Page OK : ${config.pageName || config.pageId}`
      };
    } catch (e) {
      return { success: false, message: e.message || 'Test Facebook échoué' };
    }
  }

  async ingestPush(ctx, req) {
    const entry = req.body?.entry;
    if (!Array.isArray(entry)) return [];

    const settings = ctx.instance.settings || {};
    const allowed = new Set(resolveWebhookEvents(settings));
    const messages = [];

    for (const item of entry) {
      const pageId = item.id != null ? String(item.id) : settings.pageId;
      if (item.messaging && allowed.has('messages')) {
        for (const evt of item.messaging) {
          const text = evt.message?.text || evt.postback?.title || '';
          if (!text) continue;
          messages.push(
            this.normalize(evt, ctx.instance.mapping, {
              source: 'facebook',
              sourceRef: evt.message?.mid || null,
              text,
              author: {
                id: evt.sender?.id || null,
                name: null
              },
              metadata: { pageId, type: 'messaging', webhookEvent: 'messages' }
            })
          );
        }
      }
      if (Array.isArray(item.changes)) {
        for (const change of item.changes) {
          // feed = commentaires / posts / réactions ; mention = notifications de mention
          const field = String(change.field || '');
          if (field !== 'feed' && field !== 'mention') continue;
          const v = change.value;
          if (!v) continue;

          let eventKind = field === 'mention' ? 'notifications' : classifyFeedWebhookValue(v);
          if (!allowed.has(eventKind)) continue;

          const text = String(v.message || v.reaction_type || v.verb || '').trim();
          // Réactions / notifs sans texte utile : on passe un libellé minimal pour déclencher le flow
          const resolvedText =
            text ||
            (eventKind === 'notifications'
              ? `[notification Facebook ${v.item || v.verb || 'event'}]`
              : '');
          if (!resolvedText) continue;

          const typeMeta =
            eventKind === 'comments' ? 'comment' : eventKind === 'posts' ? 'post' : 'notification';

          messages.push(
            this.normalize(v, ctx.instance.mapping, {
              source: 'facebook',
              sourceRef: String(v.comment_id || v.post_id || v.sender_id || ''),
              text: resolvedText,
              author: {
                id: v.from?.id || v.sender_id || null,
                name: v.from?.name || null
              },
              metadata: {
                pageId,
                type: typeMeta,
                webhookEvent: eventKind,
                postId: v.post_id || null,
                verb: v.verb || null,
                item: v.item || null
              }
            })
          );
        }
      }
    }
    return messages;
  }

  async ingestPoll(ctx, cursor) {
    const settings = ctx.instance.settings || {};
    const pageId = settings.pageId ? String(settings.pageId) : null;
    if (!pageId) {
      return { messages: [], cursor: cursor || { error: 'pageId manquant' } };
    }

    let config;
    try {
      config = await resolveFacebookPageConfig(ctx.database, ctx.entrepriseId, pageId);
    } catch (e) {
      return { messages: [], cursor: { ...(cursor || {}), error: e.message, lastPollAt: new Date().toISOString() } };
    }

    const version = settings.graphVersion || DEFAULT_GRAPH_VERSION;
    const poll = resolvePollConfig(settings);
    const fields = resolvePostFields(settings).join(',');
    const seenIds = new Set(
      Array.isArray(cursor?.seenIds) ? cursor.seenIds.map(String) : []
    );

    const nowUnix = Math.floor(Date.now() / 1000);
    const windowStartUnix = Math.max(0, nowUnix - poll.lookbackHours * 3600);
    const hasCursor = Boolean(
      cursor &&
        (cursor.sinceUnix ||
          cursor.commentsSinceUnix ||
          cursor.messagesSinceUnix ||
          (Array.isArray(cursor.seenIds) && cursor.seenIds.length))
    );
    const cursorSince = hasCursor
      ? Math.max(0, Number(cursor.sinceUnix || cursor.commentsSinceUnix || 0) - SAFETY_MARGIN_SEC)
      : windowStartUnix;
    const sinceUnix = Math.max(windowStartUnix, cursorSince);

    const messages = [];
    let maxPostUnix = Number(cursor?.sinceUnix) || sinceUnix;
    let maxCommentUnix = Number(cursor?.commentsSinceUnix) || sinceUnix;
    let maxMessageUnix = Number(cursor?.messagesSinceUnix) || sinceUnix;

    if (poll.postsEnabled) {
      const response = await graphGet(
        `${pageId}/published_posts`,
        config.pageAccessToken,
        { fields, limit: String(poll.postLimit) },
        version
      );
      const posts = Array.isArray(response.data) ? response.data : [];
      for (const post of posts) {
        const id = String(post.id || '');
        if (!id || seenIds.has(id)) continue;
        const created = toUnix(post.created_time);
        if (created != null && created < sinceUnix) {
          seenIds.add(id);
          continue;
        }
        const text = postText(post);
        if (!text) {
          seenIds.add(id);
          continue;
        }
        if (created != null && created > maxPostUnix) maxPostUnix = created;
        seenIds.add(id);
        messages.push(
          this.normalize(post, ctx.instance.mapping, {
            source: 'facebook',
            sourceRef: id,
            text,
            timestamp: post.created_time || new Date().toISOString(),
            author: {
              id: post.from?.id || pageId,
              name: post.from?.name || config.pageName || pageId
            },
            metadata: {
              pageId,
              type: 'post',
              permalink_url: post.permalink_url || null,
              created_time: post.created_time || null
            }
          })
        );
      }
    }

    if (poll.commentsEnabled) {
      const commentsCursor = hasCursor
        ? Math.max(0, Number(cursor.commentsSinceUnix || cursor.sinceUnix || sinceUnix) - SAFETY_MARGIN_SEC)
        : windowStartUnix;
      const commentsSince = Math.max(windowStartUnix, commentsCursor);

      let postIds = poll.commentPostIds.slice();
      if (!postIds.length) {
        const postsRes = await graphGet(
          `${pageId}/posts`,
          config.pageAccessToken,
          { fields: 'id', limit: String(poll.commentPostsToScan) },
          version
        );
        postIds = (Array.isArray(postsRes.data) ? postsRes.data : [])
          .map((p) => String(p.id || ''))
          .filter(Boolean);
      }

      for (const postId of postIds) {
        let comments = [];
        if (poll.commentsFetchAll) {
          comments = await graphGetAllPages(
            `${postId}/comments`,
            config.pageAccessToken,
            { fields: COMMENT_FIELDS, limit: '100' },
            version,
            25
          );
        } else {
          const commentsRes = await graphGet(
            `${postId}/comments`,
            config.pageAccessToken,
            { fields: COMMENT_FIELDS, limit: String(poll.commentsPerPost) },
            version
          );
          comments = Array.isArray(commentsRes.data) ? commentsRes.data : [];
        }

        for (const comment of comments) {
          const id = String(comment.id || '');
          if (!id || seenIds.has(id)) continue;
          const created = toUnix(comment.created_time);
          if (created != null && created < commentsSince) continue;
          const text = String(comment.message || '').trim();
          if (!text) {
            seenIds.add(id);
            continue;
          }
          if (created != null && created > maxCommentUnix) maxCommentUnix = created;
          seenIds.add(id);
          messages.push(
            this.normalize(comment, ctx.instance.mapping, {
              source: 'facebook',
              sourceRef: id,
              text,
              timestamp: comment.created_time || new Date().toISOString(),
              author: {
                id: comment.from?.id || null,
                name: comment.from?.name || null
              },
              metadata: {
                pageId,
                type: 'comment',
                postId,
                created_time: comment.created_time || null
              }
            })
          );
        }
      }
    }

    if (poll.messagesEnabled) {
      const messagesCursor = hasCursor
        ? Math.max(0, Number(cursor.messagesSinceUnix || cursor.sinceUnix || sinceUnix) - SAFETY_MARGIN_SEC)
        : windowStartUnix;
      const messagesSince = Math.max(windowStartUnix, messagesCursor);

      const convRes = await graphGet(
        `${pageId}/conversations`,
        config.pageAccessToken,
        {
          fields: `id,updated_time,messages.limit(${poll.messagesPerConversation}){id,message,from,created_time}`,
          limit: String(poll.messageConversationsLimit)
        },
        version
      );
      const conversations = Array.isArray(convRes.data) ? convRes.data : [];

      for (const conv of conversations) {
        const convMessages =
          conv.messages && Array.isArray(conv.messages.data) ? conv.messages.data : [];
        for (const msg of convMessages) {
          const id = String(msg.id || '');
          if (!id || seenIds.has(id)) continue;
          const created = toUnix(msg.created_time);
          if (created != null && created < messagesSince) continue;
          const fromId = msg.from && msg.from.id != null ? String(msg.from.id) : '';
          // Ignorer les messages envoyés par la page elle-même
          if (fromId && fromId === String(pageId)) {
            seenIds.add(id);
            continue;
          }
          const text = String(msg.message || '').trim();
          if (!text) {
            seenIds.add(id);
            continue;
          }
          if (created != null && created > maxMessageUnix) maxMessageUnix = created;
          seenIds.add(id);
          messages.push(
            this.normalize(msg, ctx.instance.mapping, {
              source: 'facebook',
              sourceRef: id,
              text,
              timestamp: msg.created_time || new Date().toISOString(),
              author: {
                id: fromId || null,
                name: (msg.from && msg.from.name) || null
              },
              metadata: {
                pageId,
                type: 'messaging',
                conversationId: conv.id || null,
                created_time: msg.created_time || null
              }
            })
          );
        }
      }
    }

    const seenList = Array.from(seenIds).slice(-SEEN_IDS_CAP);
    const nextSince = Math.max(maxPostUnix, nowUnix);
    const nextCommentsSince = poll.commentsEnabled
      ? Math.max(maxCommentUnix, nowUnix)
      : Number(cursor?.commentsSinceUnix) || nextSince;
    const nextMessagesSince = poll.messagesEnabled
      ? Math.max(maxMessageUnix, nowUnix)
      : Number(cursor?.messagesSinceUnix) || nextSince;

    return {
      messages,
      cursor: {
        sinceUnix: nextSince,
        commentsSinceUnix: nextCommentsSince,
        messagesSinceUnix: nextMessagesSince,
        seenIds: seenList,
        lastPollAt: new Date().toISOString(),
        count: messages.length,
        pageId
      }
    };
  }

  async emit(ctx, operation, payload = {}) {
    if (operation === 'reply' || operation === 'emit.reply') {
      const { sendFacebookReply } = require('../../backend/core/connectors/facebook-graph-helper');
      try {
        return await sendFacebookReply(ctx.database, ctx.entrepriseId, {
          pageId: payload.pageId || ctx.instance.settings?.pageId || null,
          replyMode: payload.replyMode || 'auto',
          message: payload.message || payload.body || payload.text || '',
          commentId: payload.commentId || null,
          postId: payload.postId || null,
          recipientId: payload.recipientId || payload.psid || null,
          graphVersion: ctx.instance.settings?.graphVersion
        });
      } catch (e) {
        return { success: false, message: e.message || 'Échec réponse Facebook' };
      }
    }
    return super.emit(ctx, operation, payload);
  }
}

module.exports = FacebookConnector;
