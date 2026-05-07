/**
 * Service de polling pour récupérer les messages et commentaires Facebook
 * Fichier : backend/modules/facebook/services/PollingService.js
 */

const https = require('https');
const FB = require('fb');
const WebhookService = require('./WebhookService');

class PollingService {
  constructor(database) {
    this.database = database;
    this.webhookService = new WebhookService(database);
    this.graphApiVersion = 'v24.0';
    this.graphApiBase = 'graph.facebook.com';
  }

  isTokenInvalidError(error) {
    const msg = String(error && error.message ? error.message : error || '').toLowerCase();
    return msg.includes('oauth') || msg.includes('access token') || msg.includes('error validating access token') || msg.includes('code 190');
  }

  /**
   * Initialise le service
   */
  async init() {
    await this.webhookService.init();
  }

  /**
   * Récupère la date du dernier pull depuis MongoDB
   * @param {string|null} pageId - ID de page pour un curseur par page
   * @returns {Promise<Date|null>} Date du dernier pull ou null si premier pull
   */
  async getLastPullDate(pageId = null) {
    try {
      const collection = this.database.getCollection('facebook_polling');
      let lastPull = null;

      if (pageId) {
        lastPull = await collection.findOne(
          { pageId: String(pageId) },
          { sort: { last_pull_date: -1 } }
        );
      }

      // Compatibilité avec les anciens enregistrements globaux (sans pageId)
      if (!lastPull) {
        lastPull = await collection.findOne({}, { sort: { last_pull_date: -1 } });
      }
      
      if (lastPull && lastPull.last_pull_date) {
        return new Date(lastPull.last_pull_date);
      }
      return null;
    } catch (error) {
      console.error('❌ Erreur récupération dernière date de pull:', error);
      return null;
    }
  }

  /**
   * Sauvegarde la date du dernier pull dans MongoDB
   * @param {string} pageId - ID de page
   * @param {Date} date - Date du pull
   */
  async saveLastPullDate(pageId, date) {
    try {
      const collection = this.database.getCollection('facebook_polling');
      await collection.insertOne({
        pageId: String(pageId),
        last_pull_date: date,
        created_at: new Date()
      });
      console.log(`  💾 Date du dernier pull sauvegardée (${pageId}): ${date.toISOString()}`);
    } catch (error) {
      console.error('❌ Erreur sauvegarde date de pull:', error);
    }
  }

  applySinceSafetyMargin(date) {
    const safetyMarginMs = 5 * 60 * 1000;
    return new Date(date.getTime() - safetyMarginMs);
  }

  /**
   * Effectue une requête vers l'API Graph Facebook en utilisant le SDK
   * @param {string} path - Chemin de l'API (ex: /{page_id}/posts)
   * @param {string} accessToken - Token d'accès
   * @returns {Promise<Object>} Réponse de l'API
   */
  async graphApiRequest(path, accessToken) {
    try {
      // Nettoyer le path pour enlever la version si présente
      const cleanPath = path.replace(/^\/v\d+\.\d+\//, '/').replace(/^\//, '');
      
      // Extraire les query params du path
      const url = new URL(`https://graph.facebook.com/${this.graphApiVersion}/${cleanPath}`);
      const params = {};
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      
      // Utiliser le SDK Facebook avec withAccessToken
      const result = await new Promise((resolve, reject) => {
        FB.withAccessToken(accessToken).api(cleanPath, params, (res) => {
          if (!res || res.error) {
            reject(res?.error || new Error('Erreur API Graph'));
          } else {
            resolve(res);
          }
        });
      });
      
      return result;
    } catch (error) {
      console.error('Erreur SDK Facebook graphApiRequest, fallback vers HTTPS:', error.message);
      // Fallback vers requête HTTPS manuelle
      return this.graphApiRequestFallback(path, accessToken);
    }
  }

  /**
   * Fallback : requête HTTPS manuelle si le SDK échoue
   */
  async graphApiRequestFallback(path, accessToken) {
    return new Promise((resolve, reject) => {
      const url = new URL(`https://${this.graphApiBase}${path}`);
      url.searchParams.append('access_token', accessToken);

      const options = {
        hostname: this.graphApiBase,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            
            if (res.statusCode !== 200) {
              const error = jsonData.error || { message: 'Erreur inconnue', code: res.statusCode };
              reject(new Error(`API Graph Error ${error.code}: ${error.message}`));
              return;
            }
            
            resolve(jsonData);
          } catch (error) {
            reject(new Error(`Erreur parsing JSON: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Erreur requête: ${error.message}`));
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Timeout de la requête API Graph'));
      });

      req.end();
    });
  }

  /**
   * Récupère les posts de la page depuis une date donnée
   * @param {string} pageId - ID de la page Facebook
   * @param {string} accessToken - Token d'accès de la page
   * @param {Date} sinceDate - Date depuis laquelle récupérer les posts
   * @returns {Promise<Array>} Liste des posts
   */
  async getPostsSince(pageId, accessToken, sinceDate) {
    try {
      console.log(`  📥 Récupération des posts depuis ${sinceDate.toISOString()}...`);
      
      // Convertir la date en timestamp Unix
      const sinceTimestamp = Math.floor(sinceDate.getTime() / 1000);
      
      // Récupérer les posts avec les champs nécessaires (incluant mentions/tags)
      const fields = [
        'id',
        'message',
        'message_tags', // Mentions/tags dans le message
        'created_time',
        'from',
        'permalink_url',
        'comments.limit(100){id,message,message_tags,created_time,from}' // Mentions dans les commentaires
      ].join(',');
      
      const path = `/${this.graphApiVersion}/${pageId}/posts?fields=${fields}&since=${sinceTimestamp}&limit=100`;
      
      const response = await this.graphApiRequest(path, accessToken);
      
      if (!response.data || !Array.isArray(response.data)) {
        console.log('  ⚠️  Aucun post trouvé');
        return [];
      }
      
      console.log(`  ✅ ${response.data.length} post(s) récupéré(s)`);
      return response.data;
    } catch (error) {
      console.error('  ❌ Erreur récupération posts:', error.message);
      throw error;
    }
  }

  /**
   * Récupère un lot de posts récents sans filtre de date stricte.
   * Utile pour capter de nouveaux commentaires sur d'anciens posts.
   */
  async getRecentPostsForCommentCatchup(pageId, accessToken, limit = 50) {
    try {
      const fields = [
        'id',
        'message',
        'message_tags',
        'created_time',
        'from',
        'permalink_url',
        'comments.limit(100){id,message,message_tags,created_time,from}'
      ].join(',');

      const path = `/${this.graphApiVersion}/${pageId}/posts?fields=${fields}&limit=${Math.max(1, Number(limit) || 50)}`;
      const response = await this.graphApiRequest(path, accessToken);
      if (!response.data || !Array.isArray(response.data)) return [];
      return response.data;
    } catch (error) {
      console.warn('  ⚠️ Impossible de récupérer les posts récents pour rattrapage commentaires:', error.message);
      return [];
    }
  }

  /**
   * Récupère tous les commentaires d'un post
   * @param {string} postId - ID du post
   * @param {string} accessToken - Token d'accès
   * @returns {Promise<Array>} Liste des commentaires
   */
  async getAllComments(postId, accessToken, sinceDate = null) {
    try {
      const comments = [];
      const sinceParam = sinceDate
        ? `&since=${Math.floor(new Date(sinceDate).getTime() / 1000)}`
        : '';
      let nextUrl = `/${this.graphApiVersion}/${postId}/comments?fields=id,message,message_tags,created_time,from&limit=100${sinceParam}`;
      
      while (nextUrl) {
        const response = await this.graphApiRequest(nextUrl, accessToken);
        
        if (response.data && Array.isArray(response.data)) {
          comments.push(...response.data);
        }
        
        // Vérifier s'il y a une page suivante
        nextUrl = response.paging && response.paging.next 
          ? response.paging.next.replace(`https://${this.graphApiBase}`, '')
          : null;
      }
      
      return comments;
    } catch (error) {
      console.error(`  ❌ Erreur récupération commentaires pour post ${postId}:`, error.message);
      return [];
    }
  }

  /**
   * Convertit un post Facebook en format webhook
   * @param {Object} post - Post Facebook
   * @param {string} pageId - ID de la page
   * @returns {Object} Format webhook
   */
  convertPostToWebhookFormat(post, pageId) {
    // Extraire les mentions/tags du message
    const mentions = [];
    if (post.message_tags && Array.isArray(post.message_tags)) {
      post.message_tags.forEach(tag => {
        mentions.push({
          id: tag.id,
          name: tag.name,
          type: tag.type || 'user',
          offset: tag.offset,
          length: tag.length
        });
      });
    }
    
    return {
      object: 'page',
      entry: [{
        id: pageId,
        time: Math.floor(new Date(post.created_time).getTime() / 1000),
        changes: [{
          field: 'feed',
          value: {
            from: post.from || { id: 'unknown', name: 'Page' },
            message: post.message || '',
            message_tags: mentions.length > 0 ? mentions : undefined,
            post_id: post.id,
            created_time: Math.floor(new Date(post.created_time).getTime() / 1000),
            verb: 'add'
          }
        }]
      }]
    };
  }

  /**
   * Convertit un commentaire en format webhook
   * @param {Object} comment - Commentaire Facebook
   * @param {string} postId - ID du post
   * @param {string} pageId - ID de la page
   * @returns {Object} Format webhook
   */
  convertCommentToWebhookFormat(comment, postId, pageId) {
    // Extraire les mentions/tags du commentaire
    const mentions = [];
    if (comment.message_tags && Array.isArray(comment.message_tags)) {
      comment.message_tags.forEach(tag => {
        mentions.push({
          id: tag.id,
          name: tag.name,
          type: tag.type || 'user',
          offset: tag.offset,
          length: tag.length
        });
      });
    }
    
    return {
      object: 'page',
      entry: [{
        id: pageId,
        time: Math.floor(new Date(comment.created_time).getTime() / 1000),
        changes: [{
          field: 'feed',
          value: {
            from: comment.from || { id: 'unknown', name: 'Utilisateur' },
            message: comment.message || '',
            message_tags: mentions.length > 0 ? mentions : undefined,
            post_id: postId,
            comment_id: comment.id,
            created_time: Math.floor(new Date(comment.created_time).getTime() / 1000),
            verb: 'add',
            item: 'comment'
          }
        }]
      }]
    };
  }

  /**
   * Effectue un pull complet des messages et commentaires
   * @param {string} pageId - ID de la page Facebook
   * @param {string} accessToken - Token d'accès de la page
   * @param {Date|null} sinceDate - Date depuis laquelle récupérer (null = depuis 01/01/2026)
   * @returns {Promise<Object>} Résultat du pull
   */
  async pullMessages(pageId, accessToken, sinceDate = null, options = {}) {
    try {
      const onProgress = options && typeof options.onProgress === 'function' ? options.onProgress : null;
      const emitProgress = (payload) => {
        if (!onProgress) return;
        try { onProgress(payload || {}); } catch (_) {}
      };
      console.log('\n🔄 ===== DÉBUT DU PULL FACEBOOK =====');
      console.log(`  ⏰ Timestamp: ${new Date().toISOString()}`);
      
      // Déterminer la date de début
      let startDate = sinceDate;
      if (!startDate) {
        // Récupérer la dernière date de pull
          const lastPullDate = await this.getLastPullDate(pageId);
        if (lastPullDate) {
          startDate = lastPullDate;
          console.log(`  📅 Dernier pull: ${startDate.toISOString()}`);
        } else {
          // Premier pull : depuis le 01/02/2026
          startDate = new Date('2026-02-01T00:00:00Z');
          console.log(`  📅 Premier pull: depuis le 01/02/2026`);
        }
      } else {
        console.log(`  📅 Date spécifiée: ${startDate.toISOString()}`);
      }
      
      // Marge de sécurité pour éviter les trous (latence webhook/réseau/écriture)
      const safeStartDate = this.applySinceSafetyMargin(startDate);
      console.log(`  🛟 Fenêtre sécurisée: depuis ${safeStartDate.toISOString()}`);
      emitProgress({
        phase: 'fetching',
        message: 'Récupération des données Facebook',
        sinceDateUsed: safeStartDate.toISOString()
      });

      // Récupérer les posts créés depuis la date + un lot récent pour capter
      // les nouveaux commentaires sur d'anciens posts.
      const postsSince = await this.getPostsSince(pageId, accessToken, safeStartDate);
      const recentPosts = await this.getRecentPostsForCommentCatchup(pageId, accessToken, 50);
      const postsById = new Map();
      postsSince.forEach((p) => { if (p && p.id) postsById.set(String(p.id), p); });
      recentPosts.forEach((p) => { if (p && p.id && !postsById.has(String(p.id))) postsById.set(String(p.id), p); });
      const posts = Array.from(postsById.values());
      emitProgress({
        phase: 'fetching',
        message: 'Posts récupérés',
        postsCount: posts.length,
        sinceDateUsed: safeStartDate.toISOString()
      });
      
      let totalMessages = 0;
      let totalComments = 0;
      let postsWithCommentSignals = 0;
      let postsWhereCommentsUnavailable = 0;
      let aiDiscovered = 0;
      let aiProcessed = 0;
      
      // Traiter chaque post
      for (const post of posts) {
        // Traiter le message du post seulement s'il est dans la fenêtre temporelle
        const postCreatedAt = post && post.created_time ? new Date(post.created_time) : null;
        if (post.message && postCreatedAt && postCreatedAt >= safeStartDate) {
          aiDiscovered++;
          emitProgress({
            phase: 'processing',
            message: 'Traitement IA en cours',
            ai: { processed: aiProcessed, total: aiDiscovered }
          });
          const webhookData = this.convertPostToWebhookFormat(post, pageId);
          await this.webhookService.processWebhook(webhookData);
          totalMessages++;
          aiProcessed++;
          emitProgress({
            phase: 'processing',
            message: 'Traitement IA en cours',
            ai: { processed: aiProcessed, total: aiDiscovered }
          });
          
          // Logger les mentions si présentes
          if (post.message_tags && post.message_tags.length > 0) {
            console.log(`    📌 ${post.message_tags.length} mention(s) dans le post ${post.id}`);
          }
        }
        
        // Récupérer et traiter les commentaires
        const inlineComments = post && post.comments && Array.isArray(post.comments.data)
          ? post.comments.data
          : null;
        const inlineCount = inlineComments ? inlineComments.length : 0;
        const summaryCount = post && post.comments && post.comments.summary && Number.isFinite(Number(post.comments.summary.total_count))
          ? Number(post.comments.summary.total_count)
          : null;
        const hasPagingNext = Boolean(post && post.comments && post.comments.paging && post.comments.paging.next);
        const hasCommentSignal = hasPagingNext || (summaryCount != null && summaryCount > 0);
        if (hasCommentSignal) {
          postsWithCommentSignals++;
        }

        // Si comments.data est vide mais que Facebook signale des commentaires (summary/paging),
        // forcer une requête dédiée pour éviter de rater des commentaires.
        const shouldFetchAllComments = !inlineComments || inlineCount === 0 || hasPagingNext || (summaryCount != null && summaryCount > inlineCount);
        const commentsSource = shouldFetchAllComments
          ? await this.getAllComments(post.id, accessToken, safeStartDate)
          : inlineComments;
        if (hasCommentSignal && (!commentsSource || commentsSource.length === 0)) {
          postsWhereCommentsUnavailable++;
        }

        for (const comment of commentsSource || []) {
          const commentCreatedAt = comment && comment.created_time ? new Date(comment.created_time) : null;
          if (comment.message && commentCreatedAt && commentCreatedAt >= safeStartDate) {
            aiDiscovered++;
            emitProgress({
              phase: 'processing',
              message: 'Traitement IA en cours',
              ai: { processed: aiProcessed, total: aiDiscovered }
            });
            const webhookData = this.convertCommentToWebhookFormat(comment, post.id, pageId);
            await this.webhookService.processWebhook(webhookData);
            totalComments++;
            aiProcessed++;
            emitProgress({
              phase: 'processing',
              message: 'Traitement IA en cours',
              ai: { processed: aiProcessed, total: aiDiscovered }
            });
            
            // Logger les mentions si présentes
            if (comment.message_tags && comment.message_tags.length > 0) {
              console.log(`      📌 ${comment.message_tags.length} mention(s) dans le commentaire ${comment.id}`);
            }
          }
        }
      }
      
      // Sauvegarder la date du pull seulement si des éléments ont réellement été traités.
      // Sinon, on risque de déplacer le curseur et de masquer des messages manqués.
      const pullDate = new Date();
      const processedCount = Number(totalMessages || 0) + Number(totalComments || 0);
      if (processedCount > 0) {
        await this.saveLastPullDate(pageId, pullDate);
      } else {
        console.log('  ℹ️ Aucun message/commentaire traité : curseur de pull conservé (pas d\'avance de fenêtre).');
      }

      // Mettre à jour lastInteractionAt et lastPullAt dans facebook_configs pour cette page
      let lastInteractionAt = pullDate;
      for (const post of posts) {
        if (post.created_time) {
          const d = new Date(post.created_time);
          if (d > lastInteractionAt) lastInteractionAt = d;
        }
        if (post.comments && post.comments.data) {
          for (const c of post.comments.data) {
            if (c.created_time) {
              const d = new Date(c.created_time);
              if (d > lastInteractionAt) lastInteractionAt = d;
            }
          }
        }
      }
      try {
        const configCollection = this.database.getCollection('facebook_configs');
        const updateSet = {
          lastPullAttemptAt: pullDate,
          updated_at: pullDate
        };
        if (processedCount > 0) {
          updateSet.lastInteractionAt = lastInteractionAt;
          updateSet.lastPullAt = pullDate;
          updateSet.lastWebhookProcessedAt = pullDate;
        }
        await configCollection.updateOne(
          { $or: [{ pageId }, { pageId: String(pageId) }] },
          {
            $set: updateSet
          }
        );
      } catch (err) {
        console.error('  ⚠️ Mise à jour lastInteraction config:', err.message);
      }
      
      console.log(`\n✅ Pull terminé:`);
      console.log(`  📊 ${posts.length} post(s) traité(s)`);
      console.log(`  💬 ${totalMessages} message(s) de post`);
      console.log(`  💬 ${totalComments} commentaire(s)`);
      console.log(`  📅 Prochain pull depuis: ${pullDate.toISOString()}`);
      console.log('==========================================\n');
      
      return {
        success: true,
        postsCount: posts.length,
        messagesCount: totalMessages,
        commentsCount: totalComments,
        lastPullDate: pullDate,
        effectiveSinceDate: safeStartDate,
        diagnostics: {
          postsWithCommentSignals,
          postsWhereCommentsUnavailable
        },
        progress: {
          aiProcessed,
          aiDiscovered
        }
      };
    } catch (error) {
      console.error('\n❌ Erreur lors du pull:', error);
      console.error('Stack:', error.stack);
      if (this.isTokenInvalidError(error)) {
        try {
          const configCollection = this.database.getCollection('facebook_configs');
          await configCollection.updateOne(
            { $or: [{ pageId }, { pageId: String(pageId) }] },
            {
              $set: {
                tokenStatus: 'reauth_required',
                tokenLastError: String(error.message || 'token_invalid'),
                tokenLastErrorAt: new Date(),
                updated_at: new Date()
              }
            }
          );
        } catch (innerErr) {
          console.warn('⚠️ Impossible de marquer tokenStatus reauth_required:', innerErr.message);
        }
      }
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = PollingService;
