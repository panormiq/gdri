/**
 * Simulateur de recherche web utilisant des sources publiques gratuites
 * Fichier : modules/ugap/backend/services/WebSearchSimulator.js
 */

const https = require('https');
const http = require('http');

class WebSearchSimulator {
  constructor() {
    this.cache = new Map(); // Cache simple pour éviter les requêtes répétées
  }

  /**
   * Simule une recherche web en utilisant Wikipedia et d'autres sources publiques
   * @param {string} query - Terme de recherche
   * @param {number} maxResults - Nombre maximum de résultats
   * @returns {Promise<Array>} - Tableau de résultats simulés
   */
  async search(query, maxResults = 5) {
    try {
      // Vérifier le cache
      const cacheKey = query.toLowerCase().trim();
      if (this.cache.has(cacheKey)) {
        console.log(`📦 Résultat en cache pour: ${query}`);
        return this.cache.get(cacheKey);
      }

      console.log(`🔍 Recherche web simulée pour: "${query}"`);

      const results = [];

      // 1. Recherche Wikipedia (API publique gratuite)
      try {
        const wikiResults = await this.searchWikipedia(query);
        results.push(...wikiResults);
      } catch (error) {
        console.warn('⚠️ Erreur Wikipedia:', error.message);
      }

      // 2. Recherche DuckDuckGo Instant Answer (API publique gratuite)
      try {
        const ddgResults = await this.searchDuckDuckGo(query);
        results.push(...ddgResults);
      } catch (error) {
        console.warn('⚠️ Erreur DuckDuckGo:', error.message);
      }

      // 3. Si pas assez de résultats, générer des résultats simulés basés sur le contexte
      if (results.length < maxResults) {
        const simulatedResults = this.generateSimulatedResults(query, maxResults - results.length);
        results.push(...simulatedResults);
      }

      // Limiter aux maxResults
      const finalResults = results.slice(0, maxResults);

      // Mettre en cache
      this.cache.set(cacheKey, finalResults);

      console.log(`✅ ${finalResults.length} résultat(s) trouvé(s) pour "${query}"`);
      return finalResults;
    } catch (error) {
      console.error('❌ Erreur lors de la recherche web simulée:', error);
      // En cas d'erreur, retourner des résultats simulés basiques
      return this.generateSimulatedResults(query, maxResults);
    }
  }

  /**
   * Recherche sur Wikipedia via l'API publique
   */
  async searchWikipedia(query) {
    return new Promise((resolve, reject) => {
      const searchQuery = encodeURIComponent(query);
      const url = `https://fr.wikipedia.org/api/rest_v1/page/summary/${searchQuery}`;

      https.get(url, { timeout: 5000 }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const json = JSON.parse(data);
              resolve([{
                title: json.title || query,
                snippet: json.extract || json.description || '',
                url: json.content_urls?.desktop?.page || `https://fr.wikipedia.org/wiki/${searchQuery}`,
                source: 'Wikipedia'
              }]);
            } else {
              // Essayer une recherche plus générale
              this.searchWikipediaGeneral(query).then(resolve).catch(reject);
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Recherche générale sur Wikipedia (si la page exacte n'existe pas)
   */
  async searchWikipediaGeneral(query) {
    return new Promise((resolve, reject) => {
      const searchQuery = encodeURIComponent(query);
      const url = `https://fr.wikipedia.org/api/rest_v1/page/search/${searchQuery}?limit=1`;

      https.get(url, { timeout: 5000 }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const json = JSON.parse(data);
              if (json.pages && json.pages.length > 0) {
                const page = json.pages[0];
                resolve([{
                  title: page.title || query,
                  snippet: page.snippet || '',
                  url: page.url || '',
                  source: 'Wikipedia'
                }]);
              } else {
                resolve([]);
              }
            } else {
              resolve([]);
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Recherche DuckDuckGo Instant Answer (API publique)
   */
  async searchDuckDuckGo(query) {
    return new Promise((resolve, reject) => {
      const searchQuery = encodeURIComponent(query);
      const url = `https://api.duckduckgo.com/?q=${searchQuery}&format=json&no_html=1&skip_disambig=1`;

      https.get(url, { timeout: 5000 }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const json = JSON.parse(data);
              const results = [];

              // Abstract (résumé)
              if (json.Abstract) {
                results.push({
                  title: json.Heading || query,
                  snippet: json.Abstract,
                  url: json.AbstractURL || '',
                  source: 'DuckDuckGo'
                });
              }

              // Related Topics
              if (json.RelatedTopics && json.RelatedTopics.length > 0) {
                json.RelatedTopics.slice(0, 2).forEach(topic => {
                  if (topic.Text) {
                    results.push({
                      title: topic.Text.split(' - ')[0] || query,
                      snippet: topic.Text,
                      url: topic.FirstURL || '',
                      source: 'DuckDuckGo'
                    });
                  }
                });
              }

              resolve(results);
            } else {
              resolve([]);
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Génère des résultats simulés basés sur le contexte
   */
  generateSimulatedResults(query, count) {
    const results = [];
    
    // Mots-clés communs pour différents types de produits
    const keywords = query.toLowerCase().split(/\s+/);
    
    // Générer des snippets basés sur les mots-clés
    for (let i = 0; i < count; i++) {
      const snippet = this.generateContextualSnippet(keywords);
      results.push({
        title: `${query} - Caractéristiques principales`,
        snippet: snippet,
        url: `#simulated-${i}`,
        source: 'Simulation contextuelle'
      });
    }

    return results;
  }

  /**
   * Génère un snippet contextuel basé sur les mots-clés
   */
  generateContextualSnippet(keywords) {
    const snippets = [];

    // Détecter le type de produit/service
    if (keywords.some(k => ['moteur', 'motorisation', 'moteur'].includes(k))) {
      snippets.push('Les moteurs marins nécessitent généralement des informations sur la puissance, le type de carburant, la consommation, les dimensions, le poids, et les caractéristiques techniques spécifiques.');
    }
    if (keywords.some(k => ['hélice', 'propulsion'].includes(k))) {
      snippets.push('Les hélices sont caractérisées par leur diamètre, leur pas, leur nombre de pales, leur matériau, et leur compatibilité avec différents types de moteurs.');
    }
    if (keywords.some(k => ['flotteur', 'coque', 'bateau'].includes(k))) {
      snippets.push('Les flotteurs et coques nécessitent des informations sur les dimensions, le matériau, la capacité de charge, la résistance, et les caractéristiques de flottabilité.');
    }
    if (keywords.some(k => ['pièce', 'accessoire', 'rechange'].includes(k))) {
      snippets.push('Les pièces de rechange et accessoires nécessitent généralement des références techniques, des numéros de série, des compatibilités, et des spécifications de montage.');
    }

    // Snippet générique si rien ne correspond
    if (snippets.length === 0) {
      snippets.push(`Les produits de type "${keywords.join(' ')}" nécessitent généralement des informations sur leurs caractéristiques techniques, dimensions, matériaux, compatibilités, et spécifications d'utilisation.`);
    }

    return snippets.join(' ');
  }

  /**
   * Formate les résultats pour être inclus dans un prompt IA
   */
  formatResultsForPrompt(results) {
    if (!results || results.length === 0) {
      return '';
    }

    let formatted = '\n\n**Informations trouvées via recherche web :**\n';
    
    results.forEach((result, index) => {
      formatted += `\n${index + 1}. **${result.title}** (Source: ${result.source})\n`;
      formatted += `   ${result.snippet.substring(0, 300)}${result.snippet.length > 300 ? '...' : ''}\n`;
      if (result.url && !result.url.startsWith('#')) {
        formatted += `   URL: ${result.url}\n`;
      }
    });

    formatted += '\nUtilise ces informations pour enrichir ta proposition de structure de collection.\n';

    return formatted;
  }
}

module.exports = WebSearchSimulator;
