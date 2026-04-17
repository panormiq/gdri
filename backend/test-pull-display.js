/**
 * Script de test pour récupérer et afficher tous les posts, commentaires et mentions
 * depuis le 01/02/2026
 * 
 * Usage: node backend/test-pull-display.js
 */

const https = require('https');

const PAGE_ID = '205855939507920';
const PAGE_ACCESS_TOKEN = 'EAAK1paGqmBwBQ0MUKhZAfqNFCGr6rkNjUrWt0Xk51WQuLjhu2ZCGLj1HThDaVXmt2yE9xoT7sXJDptSZCZCgy9TXj2MopNmWT9iU8MNQtkGDWyRJ44XKGA4tuYYbUVNEejuXRgpoBvDuHtOxrTbQSGhrOH9y4G3qhjAQo2XlH8EIceiYt7AppjRV792ZBqZCl62HhDrR70AuP45GeWsTNFlZCFemVkd3C3VPgLkapYZD';
const SINCE_DATE = '2026-02-01T00:00:00Z';
const GRAPH_API_VERSION = 'v24.0';

console.log('\n🔍 ===== RÉCUPÉRATION FACEBOOK DEPUIS LE 01/02/2026 =====\n');
console.log(`📱 Page ID: ${PAGE_ID}`);
console.log(`📅 Date de début: ${SINCE_DATE}`);
console.log(`🔑 Token: ${PAGE_ACCESS_TOKEN.substring(0, 20)}...\n`);

/**
 * Effectue une requête vers l'API Graph Facebook
 */
function graphApiRequest(path, accessToken) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://graph.facebook.com${path}`);
    url.searchParams.append('access_token', accessToken);

    const options = {
      hostname: 'graph.facebook.com',
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
 * Récupère tous les posts depuis une date
 */
async function getPostsSince(sinceDate) {
  try {
    console.log('📥 Récupération des posts...');
    
    const sinceTimestamp = Math.floor(new Date(sinceDate).getTime() / 1000);
    // Demander explicitement les sous-champs de 'from'
    const fields = [
      'id',
      'message',
      'message_tags',
      'created_time',
      'from{id,name}',
      'permalink_url',
      'comments.limit(100){id,message,message_tags,created_time,from{id,name}}'
    ].join(',');
    
    const path = `/${GRAPH_API_VERSION}/${PAGE_ID}/posts?fields=${fields}&since=${sinceTimestamp}&limit=100`;
    
    const response = await graphApiRequest(path, PAGE_ACCESS_TOKEN);
    
    if (!response.data || !Array.isArray(response.data)) {
      console.log('  ⚠️  Aucun post trouvé\n');
      return [];
    }
    
    console.log(`  ✅ ${response.data.length} post(s) récupéré(s)\n`);
    return response.data;
  } catch (error) {
    console.error('  ❌ Erreur:', error.message);
    throw error;
  }
}

/**
 * Récupère tous les commentaires d'un post
 */
async function getAllComments(postId) {
  try {
    const comments = [];
    // Demander explicitement les sous-champs de 'from'
    let nextUrl = `/${GRAPH_API_VERSION}/${postId}/comments?fields=id,message,message_tags,created_time,from{id,name}&limit=100`;
    
    while (nextUrl) {
      const response = await graphApiRequest(nextUrl, PAGE_ACCESS_TOKEN);
      
      if (response.data && Array.isArray(response.data)) {
        comments.push(...response.data);
      }
      
      nextUrl = response.paging && response.paging.next 
        ? response.paging.next.replace('https://graph.facebook.com', '')
        : null;
    }
    
    return comments;
  } catch (error) {
    console.error(`  ❌ Erreur récupération commentaires: ${error.message}`);
    return [];
  }
}

/**
 * Affiche les mentions d'un message
 */
function displayMentions(messageTags, indent = '    ') {
  if (!messageTags || !Array.isArray(messageTags) || messageTags.length === 0) {
    return;
  }
  
  console.log(`${indent}📌 Mentions (${messageTags.length}):`);
  messageTags.forEach(tag => {
    console.log(`${indent}   - @${tag.name} (ID: ${tag.id}, Type: ${tag.type || 'user'})`);
  });
}

/**
 * Affiche un post
 */
function displayPost(post, index) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📝 POST #${index + 1}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`🆔 ID: ${post.id}`);
  
  // Afficher les infos de l'auteur
  if (post.from) {
    console.log(`👤 Auteur: ${post.from.name || post.from.id || 'Inconnu'} (ID: ${post.from.id || 'N/A'})`);
  } else {
    console.log(`👤 Auteur: Inconnu (champ 'from' non disponible dans la réponse API)`);
  }
  
  console.log(`📅 Date: ${post.created_time}`);
  console.log(`🔗 URL: ${post.permalink_url || 'N/A'}`);
  
  if (post.message) {
    console.log(`\n💬 Message:`);
    console.log(`   ${post.message.substring(0, 200)}${post.message.length > 200 ? '...' : ''}`);
    displayMentions(post.message_tags);
  } else {
    console.log(`\n⚠️  Pas de message texte`);
  }
}

/**
 * Affiche un commentaire
 */
function displayComment(comment, index) {
  console.log(`\n  ─${'─'.repeat(76)}`);
  console.log(`  💬 COMMENTAIRE #${index + 1}`);
  console.log(`  ─${'─'.repeat(76)}`);
  console.log(`  🆔 ID: ${comment.id}`);
  
  // Afficher les infos de l'auteur avec debug si manquant
  if (comment.from) {
    console.log(`  👤 Auteur: ${comment.from.name || comment.from.id || 'Inconnu'} (ID: ${comment.from.id || 'N/A'})`);
  } else {
    console.log(`  👤 Auteur: Inconnu`);
    console.log(`     💡 Note: Facebook peut masquer les infos selon les paramètres de confidentialité`);
    console.log(`     💡 Les utilisateurs peuvent choisir de ne pas partager leur nom publiquement`);
  }
  
  console.log(`  📅 Date: ${comment.created_time}`);
  
  if (comment.message) {
    console.log(`  💬 Message:`);
    console.log(`     ${comment.message.substring(0, 150)}${comment.message.length > 150 ? '...' : ''}`);
    displayMentions(comment.message_tags, '     ');
  } else {
    console.log(`  ⚠️  Pas de message texte`);
  }
}

/**
 * Fonction principale
 */
async function main() {
  try {
    // Récupérer les posts
    const posts = await getPostsSince(SINCE_DATE);
    
    if (posts.length === 0) {
      console.log('✅ Aucun post trouvé depuis le 01/02/2026');
      return;
    }
    
    let totalComments = 0;
    let totalMentions = 0;
    let commentsWithoutAuthor = 0;
    
    // Traiter chaque post
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      
      // Afficher le post
      displayPost(post, i);
      
      // Compter les mentions du post
      if (post.message_tags && post.message_tags.length > 0) {
        totalMentions += post.message_tags.length;
      }
      
      // Récupérer et afficher les commentaires
      let comments = [];
      
      if (post.comments && post.comments.data) {
        // Commentaires déjà dans la réponse
        comments = post.comments.data;
      } else {
        // Récupérer les commentaires séparément
        console.log(`\n  📥 Récupération des commentaires...`);
        comments = await getAllComments(post.id);
      }
      
      if (comments.length > 0) {
        console.log(`\n  📊 ${comments.length} commentaire(s) trouvé(s):`);
        totalComments += comments.length;
        
        comments.forEach((comment, idx) => {
          displayComment(comment, idx);
          
          // Compter les commentaires sans auteur
          if (!comment.from) {
            commentsWithoutAuthor++;
          }
          
          // Compter les mentions du commentaire
          if (comment.message_tags && comment.message_tags.length > 0) {
            totalMentions += comment.message_tags.length;
          }
        });
      } else {
        console.log(`\n  ℹ️  Aucun commentaire`);
      }
    }
    
    // Résumé
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`📊 RÉSUMÉ`);
    console.log(`${'='.repeat(80)}`);
    console.log(`📝 Posts: ${posts.length}`);
    console.log(`💬 Commentaires: ${totalComments}`);
    console.log(`   ⚠️  Commentaires sans auteur: ${commentsWithoutAuthor}`);
    console.log(`📌 Mentions totales: ${totalMentions}`);
    console.log(`📅 Période: depuis le ${SINCE_DATE}`);
    console.log(`\n💡 Note: Si des auteurs sont "Inconnu", c'est normal.`);
    console.log(`   Facebook peut masquer les infos selon les paramètres de confidentialité.`);
    console.log(`${'='.repeat(80)}\n`);
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Lancer le script
main();
