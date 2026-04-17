/**
 * Service IA pour la catégorisation UGAP
 * Fichier : modules/ugap/backend/services/UgapAIService.js
 */

const path = require('path');
const iaModule = require(path.join(__dirname, '../../../ia/backend'));
const UgapDataService = require('./UgapDataService');
const { ObjectId } = require('mongodb');
const database = require(path.join(__dirname, '../../../../backend/config/database'));
const IAClient = require(path.join(__dirname, '../../../ia/backend/services/IAClient'));
const { buildClientConfigFromServer } = require(path.join(__dirname, '../../../ia/backend/services/ServerConfigHelper'));

class UgapAIService {
  constructor(db = null, entrepriseId = null, progressCallback = null) {
    this.aiService = iaModule.getIAClient({
      timeout: 600000
    });
    this._resolvedAiClients = new Map();
    this.db = db;
    this.entrepriseId = entrepriseId;
    this.progressCallback = progressCallback;
  }

  /** Client IA : LLM de l’entité (ia_llms) si disponible, sinon config globale. */
  async resolveAiClient(llmId = null) {
    const selector = llmId ? String(llmId).trim() : '';
    const key = selector ? `sel:${selector}` : 'default';
    if (this._resolvedAiClients.has(key)) return this._resolvedAiClients.get(key);

    const serverModelMatch = selector.match(/^server:([^|]+)\|model:(.+)$/i);
    if (serverModelMatch) {
      try {
        const serverId = decodeURIComponent(serverModelMatch[1] || '').trim();
        const model = decodeURIComponent(serverModelMatch[2] || '').trim();
        if (serverId) {
          const serversCol = database.getCollection('ia_servers');
          const oid = new ObjectId(serverId);
          const serverDoc = await serversCol.findOne({ _id: oid });
          if (serverDoc) {
            const flat = buildClientConfigFromServer(serverDoc);
            if (flat) {
              const pickedModel = model || flat.model || 'mistral:latest';
              const config = { ...flat, model: pickedModel };
              const c = new IAClient({
                configLoader: async () => ({ config }),
                serverUrl: config.serverUrl,
                serviceToken: config.serviceToken,
                ollamaUrl: config.ollamaUrl,
                model: pickedModel,
                timeout: 600000
              });
              this._resolvedAiClients.set(key, c);
              return c;
            }
          }
        }
      } catch (_) {
        // fallback below
      }
    }

    if (this.entrepriseId) {
      const c = await iaModule.getIAClientForEntity(
        String(this.entrepriseId),
        selector || null
      );
      if (c) {
        this._resolvedAiClients.set(key, c);
        return c;
      }
    }
    this._resolvedAiClients.set(key, this.aiService);
    return this.aiService;
  }

  sendProgress(message, type = 'info') {
    if (this.progressCallback) {
      this.progressCallback({ message, type });
    }
  }

  logPromptDebug(scope, prompt, llmSelection = '') {
    try {
      const title = `\n🧾 [UGAP IA] Prompt envoyé (${scope})`;
      const sep = '='.repeat(80);
      console.log(title);
      console.log(sep);
      console.log(`LLM sélectionné: ${llmSelection || '(non défini)'}`);
      console.log('--- PROMPT START ---');
      console.log(String(prompt || ''));
      console.log('--- PROMPT END ---');
      console.log(sep + '\n');
    } catch (_) {
      // no-op
    }
  }

  logResultDebug(scope, resultText) {
    try {
      const title = `\n📥 [UGAP IA] Résultat IA (${scope})`;
      const sep = '='.repeat(80);
      console.log(title);
      console.log(sep);
      console.log('--- RESULT START ---');
      console.log(String(resultText || ''));
      console.log('--- RESULT END ---');
      console.log(sep + '\n');
    } catch (_) {
      // no-op
    }
  }

  /**
   * Corrige les backslashes invalides dans un JSON "presque valide"
   * (cas fréquent des réponses LLM qui contiennent \_ ou \- etc.).
   */
  _repairInvalidJsonEscapes(jsonText) {
    let out = '';
    let inString = false;
    let escaped = false;
    const validEscapes = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);

    for (let i = 0; i < jsonText.length; i += 1) {
      const ch = jsonText[i];

      if (!inString) {
        if (ch === '"') inString = true;
        out += ch;
        continue;
      }

      if (escaped) {
        if (!validEscapes.has(ch)) {
          // Le "\" précédent n'était pas un escape JSON valide:
          // on le transforme en "\\" puis on garde le caractère.
          out += '\\\\';
          out += ch;
        } else {
          out += ch;
        }
        escaped = false;
        continue;
      }

      if (ch === '\\') {
        escaped = true;
        continue;
      }

      if (ch === '"') inString = false;
      out += ch;
    }

    if (escaped) {
      out += '\\\\';
    }

    return out;
  }

  _chunkArray(arr, chunkSize) {
    const size = Math.max(1, Number(chunkSize) || 1);
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  _isPlaceholderFamilyResponse(text, parsedArray) {
    const t = String(text || '').toLowerCase();
    if (!Array.isArray(parsedArray) || parsedArray.length === 0) return true;
    if (t.includes('nom court de la famille') || t.includes('opt_abc') || t.includes('opt\\_abc')) return true;
    // Un modèle “qui n’a pas compris” renvoie parfois l’exemple tel quel.
    const first = parsedArray[0] || {};
    const lbl = String(first.familyLabel || first.family_label || '').toLowerCase();
    if (lbl.includes('nom court de la famille')) return true;
    return false;
  }

  _pickTextModelIfVisionSelected(llmSelection) {
    const selector = String(llmSelection || '').trim();
    const match = selector.match(/^server:([^|]+)\|model:(.+)$/i);
    if (!match) return { llmSelection: selector, forced: false };
    const serverPart = match[1] || '';
    const modelPart = decodeURIComponent(match[2] || '').trim();
    const looksVision = /\bllava\b|\bmoondream\b|\bqwen2\.5-vl\b|\bllama-vision\b/i.test(modelPart);
    if (!looksVision) return { llmSelection: selector, forced: false };
    const fallbackModel = process.env.OLLAMA_TEXT_MODEL || 'mistral:latest';
    const safeSelector = `server:${encodeURIComponent(decodeURIComponent(serverPart))}|model:${encodeURIComponent(fallbackModel)}`;
    return { llmSelection: safeSelector, forced: true };
  }

  _heuristicFamiliesForChunk(listChunk) {
    const familiesByLabel = new Map();
    const add = (label, id) => {
      const key = String(label || '').trim() || 'Famille';
      if (!familiesByLabel.has(key)) familiesByLabel.set(key, []);
      familiesByLabel.get(key).push(id);
    };

    for (const o of listChunk) {
      const name = String(o.name || '').trim();
      const n = name.toLowerCase();

      // Couleurs / RAL
      if (/^coloris\s+flotteur\s+en\s+/i.test(name)) {
        add('Couleur du flotteur', o.id);
        continue;
      }
      if (/^coloris\s+de\s+la\s+coque\s+en\s+/i.test(name)) {
        add('Couleur de la coque', o.id);
        continue;
      }
      if (/^console\s+de\s+pilotage\s+en\s+/i.test(name)) {
        add('Couleur console de pilotage', o.id);
        continue;
      }

      // Marquage “comprenant X lettres maxi”
      if (/^marquage\s+comprenant\s+\d+\s+lettres?\s+maxi\b/i.test(name)) {
        add('Marquage (nb de lettres)', o.id);
        continue;
      }

      // Postes : mêmes équipements avec poste(s) différents
      // Ex: "Seconde bande anti-ragage extérieure   Poste 1"
      // Ex: "Davier d'étrave ... Postes 2, 3, 9 et 10"
      const posteStripped = name
        .replace(/\s+postes?\s+\d+[\d\s,età\-–]*$/i, '')
        .replace(/\s+poste\s+\d+$/i, '')
        .trim();
      if (posteStripped !== name && posteStripped.length >= 8) {
        add(posteStripped, o.id);
        continue;
      }

      // Par défaut : singleton (on garde le libellé pour ne pas perdre de sens)
      add(name.slice(0, 100) || o.id, o.id);
    }

    return Array.from(familiesByLabel.entries()).map(([familyLabel, optionIds]) => ({
      familyLabel,
      optionIds,
      defaultOptionId: optionIds[0] || null
    }));
  }

  _normalizeFamilyLabel(label) {
    const s = String(label || '').trim();
    if (!s) return 'Famille';
    if (/^coloris\s+flotteur\s+en\s+/i.test(s)) return 'Couleur du flotteur';
    if (/^coloris\s+de\s+la\s+coque\s+en\s+/i.test(s)) return 'Couleur de la coque';
    if (/^console\s+de\s+pilotage\s+en\s+/i.test(s)) return 'Couleur console de pilotage';
    if (/^marquage\s+comprenant\s+\d+\s+lettres?\s+maxi\b/i.test(s)) return 'Marquage (nb de lettres)';
    return s;
  }

  _normalizeBusinessAssignation(value) {
    const v = String(value || '').trim();
    if (!v) return 'A_ASSIGNER';
    return v;
  }

  async inferFamilyBusinessView(list, family, llmSelection = null) {
    const familyLabel = String(family?.familyLabel || '').trim() || 'Famille';
    const optionIds = Array.isArray(family?.optionIds)
      ? family.optionIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    if (optionIds.length === 0) {
      return {
        assignation: 'A_ASSIGNER',
        businessView: '',
        subFamily: ''
      };
    }

    const optionIndex = new Map(
      (Array.isArray(list) ? list : [])
        .map((o) => [String(o.id || '').trim(), o])
    );
    const lines = optionIds
      .map((id, idx) => {
        const row = optionIndex.get(id);
        if (!row) return `${idx + 1}. id=${id}`;
        return `${idx + 1}. id=${id} | type=${row.lineKind || 'option'} | cat=${row.category || 'Autre'} | ${row.name || ''}`;
      })
      .join('\n');

    const prompt = `Tu es un expert métier catalogue UGAP.

Objectif:
Déterminer l'ASSIGNATION métier d'une famille d'options (et une sous-famille si pertinent).

Règles:
- Retourne une assignation exploitable côté métier (nom court, clair).
- La "vueMetier" doit être le regroupement métier principal (ex: Motorisation, Coque, Flotteurs, Console, Electronique, Remorque, Sécurité, Services, Divers).
- "sousFamille" est optionnelle (mettre chaîne vide si non pertinent).
- Ne crée pas de texte explicatif hors JSON.

Famille:
- familyLabel: ${familyLabel}
- Nombre de lignes: ${optionIds.length}

Lignes de la famille:
${lines}

Réponds UNIQUEMENT avec un JSON valide:
{
  "assignation": "Nom d'assignation métier",
  "vueMetier": "Vue métier principale",
  "sousFamille": "Sous-famille optionnelle ou chaine vide"
}`;

    try {
      const client = await this.resolveAiClient(llmSelection || null);
      const response = await client.sendAnalysisPrompt(prompt, {
        temperature: 0.05,
        max_tokens: 300
      });
      if (!response?.success) {
        throw new Error(response?.error?.message || 'Erreur IA assignation famille');
      }
      const text = String(response.data?.response || '').trim();
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error('JSON assignation introuvable');
      }
      const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
      return {
        assignation: this._normalizeBusinessAssignation(parsed.assignation || parsed.assignment || familyLabel),
        businessView: String(parsed.vueMetier || parsed.businessView || '').trim(),
        subFamily: String(parsed.sousFamille || parsed.subFamily || '').trim()
      };
    } catch (e) {
      console.warn(`⚠️ UGAP IA: fallback assignation pour "${familyLabel}" : ${e.message || e}`);
      return {
        assignation: this._normalizeBusinessAssignation(familyLabel),
        businessView: '',
        subFamily: ''
      };
    }
  }

  async detectSubCategories(options, categoryName) {
    try {
      this.sendProgress(`Préparation de l'analyse pour la catégorie "${categoryName}"...`, 'info');
      this.sendProgress(`${options.length} option(s) à analyser`, 'info');
      
      const prompt = await this.buildSubCategoryPrompt(options, categoryName);
      this.sendProgress('Envoi de la requête à l\'IA...', 'info');
      this.sendProgress('⏳ Analyse en cours...', 'progress');
      
      let streamedText = '';
      let detectedSubCategories = [];
      
      // Callback pour recevoir les chunks en temps réel
      const onChunk = (chunk) => {
        console.log(`🎯 UgapAIService.onChunk appelé:`, chunk ? `response=${!!chunk.response}, length=${chunk.response?.length || 0}` : 'chunk null');
        
        if (!chunk || !chunk.response) {
          console.log(`⚠️ UgapAIService: Chunk invalide, ignoré`);
          return;
        }
        
        const chunkText = chunk.response;
        streamedText += chunkText;
        console.log(`📦 UgapAIService: Chunk traité (${chunkText.length} chars), total accumulé: ${streamedText.length} chars`);
        console.log(`📄 UgapAIService: Contenu du chunk: "${chunkText.substring(0, 100)}${chunkText.length > 100 ? '...' : ''}"`);
        
        // Envoyer le chunk au frontend IMMÉDIATEMENT
        if (this.progressCallback) {
          console.log(`📤 UgapAIService: Envoi au progressCallback`);
          this.progressCallback({
            type: 'stream',
            streamChunk: chunkText
          });
          console.log(`✅ UgapAIService: progressCallback appelé`);
        } else {
          console.warn(`⚠️ UgapAIService: progressCallback non défini!`);
        }
        
        // Essayer de parser le JSON partiel à chaque chunk
        try {
          // Chercher un tableau JSON (commence par [)
          const firstBracket = streamedText.indexOf('[');
          const lastBracket = streamedText.lastIndexOf(']');
          
          if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
            let jsonStr = streamedText.substring(firstBracket, lastBracket + 1);
            
            // Essayer de compléter le JSON si incomplet
            const openBrackets = (jsonStr.match(/\[/g) || []).length;
            const closeBrackets = (jsonStr.match(/\]/g) || []).length;
            const openBraces = (jsonStr.match(/\{/g) || []).length;
            const closeBraces = (jsonStr.match(/\}/g) || []).length;
            
            if (openBrackets > closeBrackets) {
              jsonStr += ']'.repeat(openBrackets - closeBrackets);
            }
            if (openBraces > closeBraces) {
              jsonStr += '}'.repeat(openBraces - closeBraces);
            }
            
            try {
              const parsedArray = JSON.parse(jsonStr);
              if (Array.isArray(parsedArray) && parsedArray.length > detectedSubCategories.length) {
                // Convertir en format attendu
                detectedSubCategories = parsedArray.map(item => ({
                  name: item.name || '',
                  description: item.description || '',
                  optionIds: item.optionIds || []
                }));
                console.log(`🎯 UgapAIService: ${detectedSubCategories.length} sous-catégorie(s) détectée(s) en streaming`);
                console.log(`📋 Noms:`, detectedSubCategories.map(sc => sc.name).join(', '));
                if (this.progressCallback) {
                  this.progressCallback({
                    message: `✅ ${detectedSubCategories.length} sous-catégorie(s) détectée(s)`,
                    type: 'success',
                    partialData: detectedSubCategories,
                    isPartial: true
                  });
                }
              }
            } catch (parseError) {
              // JSON encore incomplet, continuer
            }
          }
        } catch (e) {
          // Erreur de parsing, continuer - c'est normal en streaming
        }
      };

      let llmId = null;
      if (this.db && this.entrepriseId) {
        const prompts = await UgapDataService.getPrompts(this.db, this.entrepriseId);
        llmId = prompts.subCategoryLlmId || null;
      }
      if (!llmId) {
        throw new Error('Aucun LLM configuré pour le prompt Extraction base. Sélectionnez un LLM dans Prompts IA.');
      }
      this.logPromptDebug('Extraction base / detectSubCategories', prompt, llmId);
      const client = await this.resolveAiClient(llmId);
      const response = await client.sendAnalysisPrompt(prompt, {
        temperature: 0.3,
        max_tokens: 2000
      }, onChunk);

      if (!response.success) {
        throw new Error(response.error?.message || 'Erreur lors de l\'analyse IA');
      }

      // Logs finaux avant parsing
      console.log(`\n🔍 ========== FIN DU STREAMING ==========`);
      console.log(`📝 UgapAIService: streamedText total = ${streamedText.length} chars`);
      console.log(`📝 UgapAIService: detectedSubCategories = ${detectedSubCategories.length} éléments`);
      console.log(`📋 UgapAIService: streamedText (premiers 500 chars):`);
      console.log(streamedText.substring(0, 500));
      console.log(`📋 UgapAIService: streamedText (derniers 500 chars):`);
      console.log(streamedText.substring(Math.max(0, streamedText.length - 500)));
      console.log(`📋 UgapAIService: response.data?.response = ${response.data?.response?.length || 0} chars`);
      console.log(`🔍 ========================================\n`);

      // Parser la réponse finale - utiliser streamedText qui contient TOUT
      const responseText = streamedText || response.data?.response || '';
      console.log(`\n🔍 ========== PARSING FINAL ==========`);
      console.log(`📝 UgapAIService: Longueur du texte total: ${responseText.length} chars`);
      console.log(`📝 UgapAIService: detectedSubCategories en streaming: ${detectedSubCategories.length} éléments`);
      console.log(`📋 UgapAIService: Début du texte (200 premiers chars):`);
      console.log(responseText.substring(0, 200));
      console.log(`📋 UgapAIService: Fin du texte (200 derniers chars):`);
      console.log(responseText.substring(Math.max(0, responseText.length - 200)));
      
      let finalSubCategories = detectedSubCategories.length > 0 ? detectedSubCategories : [];
      console.log(`📊 UgapAIService: finalSubCategories initial: ${finalSubCategories.length} éléments`);
      
      // Nettoyer le texte - enlever tout ce qui est avant le premier [ et après le dernier ]
      let cleanedText = responseText.trim();
      console.log(`🧹 UgapAIService: Texte après trim: ${cleanedText.length} chars`);
      
      // Chercher le premier [ et le dernier ]
      const firstBracket = cleanedText.indexOf('[');
      const lastBracket = cleanedText.lastIndexOf(']');
      console.log(`🔍 UgapAIService: Position du premier [: ${firstBracket}`);
      console.log(`🔍 UgapAIService: Position du dernier ]: ${lastBracket}`);
      
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        cleanedText = cleanedText.substring(firstBracket, lastBracket + 1);
        console.log(`🧹 UgapAIService: Texte nettoyé (${cleanedText.length} chars)`);
        console.log(`📄 UgapAIService: JSON extrait (premiers 500 chars):`);
        console.log(cleanedText.substring(0, 500));
        console.log(`📄 UgapAIService: JSON extrait (derniers 200 chars):`);
        console.log(cleanedText.substring(Math.max(0, cleanedText.length - 200)));
        
        try {
          console.log(`🔧 UgapAIService: Tentative de JSON.parse()...`);
          const parsedArray = JSON.parse(cleanedText);
          console.log(`✅ UgapAIService: JSON.parse() réussi !`);
          console.log(`📊 UgapAIService: Type du résultat: ${Array.isArray(parsedArray) ? 'Array' : typeof parsedArray}`);
          console.log(`📊 UgapAIService: Longueur du tableau: ${Array.isArray(parsedArray) ? parsedArray.length : 'N/A'}`);
          
          if (Array.isArray(parsedArray) && parsedArray.length > 0) {
            console.log(`📋 UgapAIService: Première sous-catégorie:`, JSON.stringify(parsedArray[0], null, 2));

            const normalizeOptionKey = (value) => String(value || '')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, ' ')
              .trim();

            const optionsById = new Map(options.map(opt => [opt.id, opt]));
            const optionsByName = new Map(
              options.map(opt => [normalizeOptionKey(opt.name), opt.id])
            );

            const resolveOptionId = (rawId) => {
              if (!rawId) return null;
              const trimmed = String(rawId).trim();
              if (optionsById.has(trimmed)) return trimmed;

              const idMatch = trimmed.match(/opt_\d+/i);
              if (idMatch && optionsById.has(idMatch[0])) return idMatch[0];

              const normalized = normalizeOptionKey(trimmed);
              if (optionsByName.has(normalized)) return optionsByName.get(normalized);

              return null;
            };

            // Convertir le tableau en format subCategories
            const parsedSubCategories = parsedArray.map((item, index) => {
              console.log(`🔧 UgapAIService: Conversion item ${index}:`, item.name);
              const rawOptionIds = Array.isArray(item.optionIds) ? item.optionIds : [];
              const mappedOptionIds = rawOptionIds
                .map(resolveOptionId)
                .filter(Boolean);

              if (rawOptionIds.length && mappedOptionIds.length < rawOptionIds.length) {
                const missing = rawOptionIds.filter(id => !resolveOptionId(id));
                console.warn(`⚠️ UgapAIService: optionIds non résolus pour "${item.name}":`, missing);
              }
              return {
                name: item.name || '',
                description: item.description || '',
                optionIds: mappedOptionIds
              };
            });
            
            // Vérifier que toutes les options sont incluses
            const allOptionIds = new Set();
            parsedSubCategories.forEach(sc => {
              sc.optionIds.forEach(id => allOptionIds.add(id));
            });
            
            console.log(`📊 UgapAIService: parsedSubCategories: ${parsedSubCategories.length} éléments`);
            console.log(`📊 UgapAIService: Options uniques trouvées: ${allOptionIds.size} sur ${options.length} attendues`);
            console.log(`📊 UgapAIService: finalSubCategories avant: ${finalSubCategories.length} éléments`);
            
            if (allOptionIds.size < options.length) {
              console.warn(`⚠️ UgapAIService: ${options.length - allOptionIds.size} option(s) manquante(s) dans les sous-catégories détectées`);
              console.warn(`📋 UgapAIService: Options manquantes:`, 
                options.filter(opt => !allOptionIds.has(opt.id)).map(opt => opt.name).join(', '));
            }
            
            // Utiliser le résultat le plus complet
            if (parsedSubCategories.length > finalSubCategories.length || allOptionIds.size > 0) {
              finalSubCategories = parsedSubCategories;
              console.log(`✅ UgapAIService: ${finalSubCategories.length} sous-catégorie(s) parsée(s) depuis le tableau JSON`);
              console.log(`📋 UgapAIService: Noms:`, finalSubCategories.map(sc => sc.name).join(', '));
              console.log(`📋 UgapAIService: Total options incluses: ${allOptionIds.size}/${options.length}`);
            } else {
              console.log(`⚠️ UgapAIService: parsedSubCategories (${parsedSubCategories.length}) <= finalSubCategories (${finalSubCategories.length}), on garde l'existant`);
            }
          } else {
            console.log(`⚠️ UgapAIService: Tableau vide ou invalide (Array.isArray=${Array.isArray(parsedArray)}, length=${parsedArray?.length || 0})`);
          }
        } catch (e) {
          console.log(`❌ UgapAIService: Erreur parsing JSON: ${e.message}`);
          console.log(`📄 UgapAIService: Stack trace:`, e.stack);
          console.log(`📄 UgapAIService: JSON qui a échoué (premiers 1000 chars):`);
          console.log(cleanedText.substring(0, 1000));
        }
      } else {
        console.log(`❌ UgapAIService: Pas de tableau JSON trouvé (firstBracket=${firstBracket}, lastBracket=${lastBracket})`);
        console.log(`📄 UgapAIService: Texte reçu (premiers 1000 chars):`);
        console.log(responseText.substring(0, 1000));
      }
      
      console.log(`📊 UgapAIService: finalSubCategories final: ${finalSubCategories.length} éléments`);
      
      // Filtrer les sous-catégories qui utilisent des marques (interdit)
      const forbiddenPatterns = ['suzuki', 'yamaha', 'mercury', 'oxe', '150 ch', '200 ch', '300 ch', 'essence', 'diesel'];
      const filteredSubCategories = finalSubCategories.filter(sc => {
        const nameLower = sc.name.toLowerCase();
        const hasForbiddenPattern = forbiddenPatterns.some(pattern => nameLower.includes(pattern));
        if (hasForbiddenPattern) {
          console.warn(`⚠️ UgapAIService: Sous-catégorie "${sc.name}" rejetée car elle contient une marque ou caractéristique technique`);
          this.sendProgress(`⚠️ Sous-catégorie "${sc.name}" rejetée (regroupement par marque/caractéristique interdit)`, 'warning');
          return false;
        }
        return true;
      });
      
      // Si des sous-catégories ont été rejetées, redistribuer leurs options
      if (filteredSubCategories.length < finalSubCategories.length) {
        const rejectedSubCategories = finalSubCategories.filter(sc => !filteredSubCategories.includes(sc));
        const rejectedOptionIds = new Set();
        rejectedSubCategories.forEach(sc => {
          (sc.optionIds || []).forEach(id => rejectedOptionIds.add(id));
        });
        
        console.log(`⚠️ UgapAIService: ${rejectedSubCategories.length} sous-catégorie(s) rejetée(s), ${rejectedOptionIds.size} option(s) à redistribuer`);
        
        // Redistribuer les options rejetées dans les sous-catégories existantes ou créer "Non attribuées"
        const allAssignedOptionIds = new Set();
        filteredSubCategories.forEach(sc => {
          (sc.optionIds || []).forEach(id => allAssignedOptionIds.add(id));
        });
        
        const optionsToRedistribute = options.filter(opt => 
          rejectedOptionIds.has(opt.id) && !allAssignedOptionIds.has(opt.id)
        );
        
        if (optionsToRedistribute.length > 0) {
          // Essayer de redistribuer dans les sous-catégories existantes par fonction
          const redistributed = new Set();
          optionsToRedistribute.forEach(opt => {
            // Chercher une sous-catégorie appropriée par fonction
            const optNameLower = opt.name.toLowerCase();
            let found = false;
            
            for (const sc of filteredSubCategories) {
              const scNameLower = sc.name.toLowerCase();
              // Si l'option est un moteur et la sous-catégorie est "Moteurs"
              if (optNameLower.includes('moteur') && scNameLower.includes('moteur') && !scNameLower.includes('pièce') && !scNameLower.includes('accessoire')) {
                sc.optionIds.push(opt.id);
                redistributed.add(opt.id);
                found = true;
                break;
              }
              // Si l'option est une hélice et la sous-catégorie est "Hélices"
              if (optNameLower.includes('hélice') && scNameLower.includes('hélice')) {
                sc.optionIds.push(opt.id);
                redistributed.add(opt.id);
                found = true;
                break;
              }
            }
            
            if (!found) {
              redistributed.add(opt.id);
            }
          });
          
          const stillUnassigned = optionsToRedistribute.filter(opt => !redistributed.has(opt.id));
          if (stillUnassigned.length > 0) {
            filteredSubCategories.push({
              name: 'Non attribuées',
              description: `Options non classées (${stillUnassigned.length} option(s))`,
              optionIds: stillUnassigned.map(opt => opt.id)
            });
          }
        }
        
        finalSubCategories.length = 0;
        finalSubCategories.push(...filteredSubCategories);
      }
      
      // Vérifier que toutes les options sont incluses
      const allAssignedOptionIds = new Set();
      finalSubCategories.forEach(sc => {
        (sc.optionIds || []).forEach(id => allAssignedOptionIds.add(id));
      });
      
      const missingOptions = options.filter(opt => !allAssignedOptionIds.has(opt.id));
      console.log(`📊 UgapAIService: Options assignées: ${allAssignedOptionIds.size}/${options.length}`);
      
      // Créer une sous-catégorie "Non attribuées" pour les options manquantes
      if (missingOptions.length > 0) {
        console.log(`⚠️ UgapAIService: ${missingOptions.length} option(s) non assignée(s), création d'une sous-catégorie "Non attribuées"`);
        this.sendProgress(`${missingOptions.length} option(s) non assignée(s), création d'une sous-catégorie "Non attribuées"`, 'info');
        
        finalSubCategories.push({
          name: 'Non attribuées',
          description: `Options non classées dans les autres sous-catégories (${missingOptions.length} option(s))`,
          optionIds: missingOptions.map(opt => opt.id)
        });
        
        console.log(`✅ UgapAIService: Sous-catégorie "Non attribuées" créée avec ${missingOptions.length} option(s)`);
      }
      
      console.log(`🔍 ========== FIN PARSING ==========\n`);
      
      if (finalSubCategories.length > 0) {
        const totalOptionsInSubCategories = finalSubCategories.reduce((sum, sc) => sum + (sc.optionIds || []).length, 0);
        this.sendProgress(`✅ ${finalSubCategories.length} sous-catégorie(s) détectée(s) (${totalOptionsInSubCategories}/${options.length} options)`, 'success');
        if (this.progressCallback) {
          this.progressCallback({
            message: `✅ ${finalSubCategories.length} sous-catégorie(s) détectée(s) (${totalOptionsInSubCategories}/${options.length} options)`,
            type: 'success',
            partialData: finalSubCategories,
            isFinal: true
          });
        }
      } else {
        console.log(`⚠️ UgapAIService: Aucune sous-catégorie trouvée dans la réponse finale`);
        console.log(`📋 UgapAIService: Extrait du texte: ${responseText.substring(0, 500)}...`);
        this.sendProgress('Aucune sous-catégorie détectée', 'info');
      }

      console.log(`📤 UgapAIService: Retour de ${finalSubCategories.length} sous-catégorie(s) avec ${options.length} options au total`);
      
      // DEUXIÈME PASSE : Classer les options non assignées
      const allAssignedOptionIdsSecondPass = new Set();
      finalSubCategories.forEach(sc => {
        (sc.optionIds || []).forEach(id => allAssignedOptionIdsSecondPass.add(id));
      });
      
      const unassignedOptions = options.filter(opt => !allAssignedOptionIdsSecondPass.has(opt.id));
      
      if (unassignedOptions.length > 0) {
        console.log(`\n🔄 DEUXIÈME PASSE: ${unassignedOptions.length} option(s) non assignée(s), classification avec score de confiance...`);
        this.sendProgress(`🔄 Deuxième passe: Classification de ${unassignedOptions.length} option(s) non assignée(s) avec score de confiance...`, 'info');
        
        try {
          const secondPassResults = await this.classifyUnassignedOptions(unassignedOptions, finalSubCategories, categoryName);
          
          // Intégrer les résultats de la deuxième passe
          secondPassResults.forEach(result => {
            const { subCategoryName, optionId, confidence } = result;
            
            // Trouver ou créer la sous-catégorie
            let targetSubCat = finalSubCategories.find(sc => sc.name === subCategoryName);
            if (!targetSubCat) {
              // Créer une nouvelle sous-catégorie
              targetSubCat = {
                id: `subcat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: subCategoryName,
                description: `Sous-catégorie créée lors de la deuxième passe`,
                optionIds: [],
                confidence: {}
              };
              finalSubCategories.push(targetSubCat);
            }
            
            // Ajouter l'option avec son score de confiance
            if (!targetSubCat.optionIds.includes(optionId)) {
              targetSubCat.optionIds.push(optionId);
            }
            
            // Stocker le score de confiance
            if (!targetSubCat.confidence) {
              targetSubCat.confidence = {};
            }
            targetSubCat.confidence[optionId] = confidence;
          });
          
          console.log(`✅ Deuxième passe terminée: ${secondPassResults.length} option(s) classée(s)`);
          this.sendProgress(`✅ Deuxième passe terminée: ${secondPassResults.length} option(s) classée(s)`, 'success');
        } catch (error) {
          console.error(`❌ Erreur lors de la deuxième passe:`, error);
          this.sendProgress(`⚠️ Erreur lors de la deuxième passe: ${error.message}`, 'error');
          
          // Créer quand même une sous-catégorie "Non attribuées" pour les options restantes
          const stillUnassigned = options.filter(opt => {
            const isAssigned = finalSubCategories.some(sc => 
              (sc.optionIds || []).includes(opt.id)
            );
            return !isAssigned;
          });
          
          if (stillUnassigned.length > 0) {
            finalSubCategories.push({
              id: `subcat_${Date.now()}_non_attribuee`,
              name: 'Non attribuées',
              description: `Options non classées (${stillUnassigned.length} option(s))`,
              optionIds: stillUnassigned.map(opt => opt.id),
              confidence: {}
            });
          }
        }
      }
      
      return finalSubCategories;
    } catch (error) {
      console.error('❌ UGAP AI: Erreur détection sous-catégories:', error);
      this.sendProgress(`Erreur: ${error.message}`, 'error');
      return [];
    }
  }

  async buildSubCategoryPrompt(options, categoryName) {
    const UgapDataService = require('./UgapDataService');
    
    let promptTemplate;
    if (this.db && this.entrepriseId) {
      const prompts = await UgapDataService.getPrompts(this.db, this.entrepriseId);
      promptTemplate = prompts.subCategoryPrompt;
    } else {
      promptTemplate = `Analyse les options suivantes de la catégorie "{{categoryName}}" et regroupe-les en sous-catégories logiques.

Options ({{totalOptions}} au total):
{{optionsList}}

Instructions IMPORTANTES:
1. Analyse CHAQUE option individuellement et identifie des groupes logiques (sous-catégories)
2. Chaque sous-catégorie doit regrouper des options similaires MAIS pas trop nombreuses (idéalement 5-15 options par sous-catégorie)
3. Crée des sous-catégories FINES et SPÉCIFIQUES plutôt que des groupes trop larges
4. TOUTES les {{totalOptions}} options DOIVENT être incluses dans au moins une sous-catégorie - aucune option ne doit être oubliée
5. Si une option peut appartenir à plusieurs groupes, choisis le groupe le plus spécifique
6. Les sous-catégories doivent être pertinentes et utiles pour la navigation

ATTENTION - Classification des moteurs :
- Toute option contenant "Moteur", "moteur", "Motorisation", "motorisation" DOIT être classée dans une sous-catégorie de moteurs
- Les options comme "Moteur hors-bord essence - Suzuki DF150ATX..." sont des MOTEURS et doivent être dans une sous-catégorie de moteurs
- Ne confonds pas les moteurs avec les pièces de rechange ou accessoires

INTERDICTIONS STRICTES - À NE JAMAIS FAIRE :
❌ NE JAMAIS regrouper par marque (Suzuki, Yamaha, Mercury, etc.) - C'EST INTERDIT
❌ NE JAMAIS regrouper par caractéristique technique (puissance, carburant, arbre, etc.) - Ce sont des caractéristiques, pas des catégories
❌ NE JAMAIS créer de sous-catégories comme "Moteurs Suzuki", "Moteurs Yamaha", "Moteurs 150 ch", "Moteurs essence"

RÈGLES DE REGROUPEMENT - À FAIRE :
✅ Regrouper par FONCTION ou TYPE D'USAGE uniquement
✅ Exemples CORRECTS pour la catégorie "Motorisation" :
   - "Moteurs" (TOUS les moteurs, toutes marques, toutes puissances, tous carburants confondus)
   - "Hélices" (TOUTES les hélices, tous types, toutes marques)
   - "Pièces de rechange" (toutes les pièces détachées, toutes marques)
   - "Accessoires moteurs" (tous les accessoires pour moteurs, toutes marques)
   - "Configurations jumelées" (moteurs en double/twin, toutes marques)
   - "Services et maintenance" (services, révisions, garanties)
   - "Garanties" (toutes les garanties, toutes marques)
   - "Formations" (toutes les formations, toutes marques)

PRINCIPE FONDAMENTAL : 
Une sous-catégorie doit répondre à la question "QU'EST-CE QUE C'EST ?" (fonction/usage), PAS "QUI L'A FAIT ?" (marque) ou "QUELES SONT SES CARACTÉRISTIQUES ?" (puissance, carburant, etc.)

RÉPONDS UNIQUEMENT AVEC UN TABLEAU JSON VALIDE, SANS AUCUN TEXTE AVANT OU APRÈS.
Commence directement par [ et termine par ].

Format exact:
[
  {
    "name": "Nom de la sous-catégorie",
    "description": "Description courte",
    "optionIds": ["ID_EXACT_DE_L_OPTION_1", "ID_EXACT_DE_L_OPTION_2"]
  }
]

IMPORTANT: 
- Utilise UNIQUEMENT les IDs exacts fournis dans la liste des options (format: "ID: xxx")
- Vérifie que TOUTES les {{totalOptions}} options sont incluses dans au moins une sous-catégorie
- Ne crée pas de nouveaux IDs
- La somme des optionIds dans toutes les sous-catégories doit être égale à {{totalOptions}}

Si aucune sous-catégorie pertinente ne peut être identifiée, retourne un tableau vide: [].`;
    }

    // Inclure les IDs des options dans la liste pour que l'IA les utilise
    // Afficher les premières options pour aider l'IA à comprendre le contexte
    const optionsList = options.map(opt => `- ${opt.name} (ID: ${opt.id})`).join('\n');
    const prompt = promptTemplate
      .replace(/\{\{categoryName\}\}/g, categoryName)
      .replace(/\{\{optionsList\}\}/g, optionsList)
      .replace(/\{\{totalOptions\}\}/g, options.length.toString());

    console.log(`📝 Prompt construit: ${options.length} options, longueur: ${prompt.length} caractères`);
    console.log(`📋 Exemples d'options (5 premières):`, options.slice(0, 5).map(opt => opt.name).join(', '));
    return prompt;
  }

  /**
   * Deuxième passe : Classer les options non assignées avec score de confiance
   */
  async classifyUnassignedOptions(unassignedOptions, existingSubCategories, categoryName) {
    try {
      const subCategoryNames = existingSubCategories.map(sc => sc.name).join(', ');
      
      const prompt = `Tu es un expert en classification de produits. 

Analyse les options suivantes qui n'ont pas pu être classées dans les sous-catégories existantes et détermine dans quelle sous-catégorie elles devraient être classées.

**Catégorie:** ${categoryName}
**Sous-catégories existantes:** ${subCategoryNames || 'Aucune'}

**Options à classer (${unassignedOptions.length}):**
${unassignedOptions.map(opt => `- ${opt.name} (ID: ${opt.id})`).join('\n')}

**Instructions:**
1. Pour chaque option, détermine la sous-catégorie existante la plus appropriée
2. Si aucune sous-catégorie existante ne convient, propose un nouveau nom de sous-catégorie
3. Donne un score de confiance entre 0 et 100 pour chaque classification
4. Score > 90 : Classification très certaine (vert)
5. Score 50-90 : Classification probable mais à vérifier (orange)
6. Score < 50 : Classification incertaine, nécessite vérification (rouge)

RÉPONDS UNIQUEMENT AVEC UN TABLEAU JSON VALIDE:
[
  {
    "optionId": "ID_EXACT_DE_L_OPTION",
    "subCategoryName": "Nom de la sous-catégorie (existante ou nouvelle)",
    "confidence": 85,
    "reasoning": "Explication courte de pourquoi cette classification"
  }
]`;

      this.sendProgress(`Analyse de ${unassignedOptions.length} option(s) non assignée(s)...`, 'info');
      
      // Accumuler la réponse complète
      let fullResponse = '';
      const onChunk = (chunk) => {
        if (chunk && chunk.response) {
          fullResponse += chunk.response;
          if (this.progressCallback) {
            this.progressCallback({
              type: 'stream',
              streamChunk: chunk.response
            });
          }
        }
      };
      
      let llmId = null;
      if (this.db && this.entrepriseId) {
        const prompts = await UgapDataService.getPrompts(this.db, this.entrepriseId);
        llmId = prompts.subCategoryLlmId || null;
      }
      if (!llmId) {
        throw new Error('Aucun LLM configuré pour le prompt Extraction base. Sélectionnez un LLM dans Prompts IA.');
      }
      this.logPromptDebug('Extraction base / classifyUnassignedOptions', prompt, llmId);
      const client = await this.resolveAiClient(llmId);
      const response = await client.sendAnalysisPrompt(prompt, { 
        temperature: 0.3,
        max_tokens: 2000
      }, onChunk);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Erreur lors de la deuxième passe IA');
      }
      
      const aiText = fullResponse || response.data?.response || '';
      
      // Parser la réponse
      let results = [];
      try {
        const firstBracket = aiText.indexOf('[');
        const lastBracket = aiText.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) {
          const jsonArray = aiText.substring(firstBracket, lastBracket + 1);
          results = JSON.parse(jsonArray);
        } else {
          // Essayer de parser un objet unique
          const jsonMatch = aiText.match(/\{[\s\S]*"optionId"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            results = Array.isArray(parsed) ? parsed : [parsed];
          }
        }
        
        // Valider et formater les résultats
        results = results
          .filter(r => r.optionId && r.subCategoryName && r.confidence !== undefined)
          .map(r => ({
            optionId: r.optionId,
            subCategoryName: r.subCategoryName,
            confidence: Math.max(0, Math.min(100, parseInt(r.confidence) || 50)),
            reasoning: r.reasoning || ''
          }));
        
        console.log(`✅ Deuxième passe: ${results.length} option(s) classée(s) avec scores de confiance`);
      } catch (parseError) {
        console.error(`❌ Erreur parsing deuxième passe:`, parseError);
        throw new Error('Impossible de parser la réponse de la deuxième passe: ' + parseError.message);
      }
      
      return results;
    } catch (error) {
      console.error('❌ Erreur deuxième passe:', error);
      throw error;
    }
  }

  parseJSONResponse(text) {
    try {
      // Essayer de parser directement
      return JSON.parse(text);
    } catch (e) {
      console.log(`⚠️ Parse direct échoué, recherche du JSON dans le texte...`);
      
      // Chercher le JSON entre la première { et la dernière }
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          const jsonStr = text.substring(firstBrace, lastBrace + 1);
          console.log(`🔍 Tentative parsing JSON extrait (${jsonStr.length} chars)`);
          const parsed = JSON.parse(jsonStr);
          console.log(`✅ JSON parsé avec succès`);
          return parsed;
        } catch (e2) {
          console.log(`⚠️ Erreur parsing JSON extrait: ${e2.message}`);
        }
      }
      
      // Essayer avec regex
      const jsonMatch = text.match(/\{[\s\S]*"subCategories"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          console.log(`🔍 Tentative parsing avec regex (${jsonMatch[0].length} chars)`);
          const parsed = JSON.parse(jsonMatch[0]);
          console.log(`✅ JSON parsé avec regex`);
          return parsed;
        } catch (e3) {
          console.log(`⚠️ Erreur parsing avec regex: ${e3.message}`);
        }
      }
      
      console.error('❌ Impossible de parser la réponse JSON');
      return null;
    }
  }

  async improveCategorization(options) {
    try {
      this.sendProgress(`Préparation de l'analyse...`, 'info');
      this.sendProgress(`${options.length} option(s) à analyser`, 'info');
      
      const prompt = await this.buildCategorizationPrompt(options);
      this.sendProgress('Envoi de la requête à l\'IA...', 'info');
      this.sendProgress('⏳ Analyse en cours...', 'progress');
      
      let streamedText = '';
      let detectedCategorizations = [];
      
      const onChunk = (chunk) => {
        if (!chunk || !chunk.response) return;
        
        const chunkText = chunk.response;
        streamedText += chunkText;
        
        if (this.progressCallback) {
          this.progressCallback({
            type: 'stream',
            streamChunk: chunkText
          });
        }
        
        try {
          const jsonMatch = streamedText.match(/\{[\s\S]*"categorizations"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.categorizations && Array.isArray(parsed.categorizations)) {
              if (parsed.categorizations.length > detectedCategorizations.length) {
                detectedCategorizations = parsed.categorizations;
                if (this.progressCallback) {
                  this.progressCallback({
                    message: `✅ ${detectedCategorizations.length} catégorisation(s) détectée(s)`,
                    type: 'success',
                    partialData: detectedCategorizations,
                    isPartial: true
                  });
                }
              }
            }
          }
        } catch (e) {
          // JSON incomplet
        }
      };
      
      let llmId = null;
      if (this.db && this.entrepriseId) {
        const prompts = await UgapDataService.getPrompts(this.db, this.entrepriseId);
        llmId = prompts.categorizationLlmId || null;
      }
      if (!llmId) {
        throw new Error('Aucun LLM configuré pour le prompt Catégorisation. Sélectionnez un LLM dans Prompts IA.');
      }
      this.logPromptDebug('Categorization / improveCategorization', prompt, llmId);
      const client = await this.resolveAiClient(llmId);
      const response = await client.sendAnalysisPrompt(prompt, {
        temperature: 0.2,
        max_tokens: 2000
      }, onChunk);

      if (!response.success) {
        throw new Error(response.error?.message || 'Erreur lors de l\'analyse IA');
      }

      if (detectedCategorizations.length > 0) {
        this.sendProgress(`✅ ${detectedCategorizations.length} catégorisation(s) détectée(s)`, 'success');
        if (this.progressCallback) {
          this.progressCallback({
            message: `✅ ${detectedCategorizations.length} catégorisation(s) finale(s)`,
            type: 'success',
            partialData: detectedCategorizations,
            isFinal: true
          });
        }
        return detectedCategorizations;
      }

      const responseText = response.data.response;
      const parsed = this.parseJSONResponse(responseText);
      
      let finalCategorizations = [];
      if (parsed && Array.isArray(parsed.categorizations)) {
        finalCategorizations = parsed.categorizations;
        this.sendProgress(`✅ ${finalCategorizations.length} catégorisation(s) détectée(s)`, 'success');
        if (this.progressCallback) {
          this.progressCallback({
            message: `✅ ${finalCategorizations.length} catégorisation(s) détectée(s)`,
            type: 'success',
            partialData: finalCategorizations,
            isFinal: true
          });
        }
      } else {
        this.sendProgress('Aucune catégorisation détectée', 'info');
      }

      return finalCategorizations;
    } catch (error) {
      console.error('❌ UGAP AI: Erreur amélioration catégorisation:', error);
      this.sendProgress(`Erreur: ${error.message}`, 'error');
      return [];
    }
  }

  async buildCategorizationPrompt(options) {
    const UgapDataService = require('./UgapDataService');
    
    let promptTemplate;
    if (this.db && this.entrepriseId) {
      const prompts = await UgapDataService.getPrompts(this.db, this.entrepriseId);
      promptTemplate = prompts.categorizationPrompt;
    } else {
      promptTemplate = `Analyse les options suivantes et assigne-les à des catégories pertinentes.

Options:
{{optionsList}}

Catégories existantes: Motorisation, Flotteurs, Aménagement, Électronique, Remorque, Sécurité, Services, Divers

Réponds UNIQUEMENT avec un JSON valide au format suivant:
{
  "categorizations": [
    {
      "optionName": "Nom de l'option",
      "category": "Nom de la catégorie",
      "assignation": "Nom de l'assignation (optionnel)"
    }
  ]
}`;
    }

    const optionsList = options.map(opt => `- ${opt.name}`).join('\n');
    const prompt = promptTemplate.replace(/\{\{optionsList\}\}/g, optionsList);

    return prompt;
  }

  async parseBaseModelLabelFallback(label) {
    const input = String(label || '').trim();
    if (!input) {
      return {
        modelName: '',
        motorizationBase: '',
        posteNumber: null,
        deliveryMode: ''
      };
    }

    const prompt = `Tu dois parser une ligne de configuration bateau UGAP.
Retourne UNIQUEMENT un JSON valide (sans markdown) au format exact:
{
  "modelName": "string",
  "motorizationBase": "string",
  "posteNumber": number|null,
  "deliveryMode": "string"
}

Règles:
- modelName = de début de ligne jusqu'au premier séparateur de motorisation.
- motorizationBase = motorisation de base, sans le poste ni le mode de livraison.
- posteNumber = chiffre après "Poste" (ou null si absent).
- deliveryMode = "Départ usine" si présent, sinon "".
- Nettoie les tirets isolés et espaces superflus.

Ligne à parser:
${input}`;

    try {
      const client = await this.resolveAiClient();
      const response = await client.sendAnalysisPrompt(prompt, {
        temperature: 0.1,
        max_tokens: 250
      });

      if (!response?.success) {
        throw new Error(response?.error?.message || 'Réponse IA invalide');
      }

      const text = String(response.data?.response || '').trim();
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error('JSON non trouvé dans la réponse IA');
      }

      const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
      return {
        modelName: String(parsed.modelName || '').trim(),
        motorizationBase: String(parsed.motorizationBase || '').trim(),
        posteNumber: Number.isFinite(Number(parsed.posteNumber)) ? Number(parsed.posteNumber) : null,
        deliveryMode: String(parsed.deliveryMode || '').trim()
      };
    } catch (error) {
      console.warn('⚠️ UGAP IA fallback parse base model failed:', error.message || error);
      return {
        modelName: '',
        motorizationBase: '',
        posteNumber: null,
        deliveryMode: ''
      };
    }
  }

  /**
   * Enrichit les lignes "option de base" avec produit initial/final via IA.
   * Retourne un tableau: [{ id, changeType, initialProduct, finalProduct, confidence }]
   */
  async extractBaseReplacementProducts(optionsInput) {
    const list = (optionsInput || [])
      .map((o) => ({
        id: String(o.id || '').trim(),
        name: String(o.name || '').trim()
      }))
      .filter((o) => o.id && o.name);

    if (list.length === 0) return [];

    const prompts = (this.db && this.entrepriseId)
      ? await UgapDataService.getPrompts(this.db, this.entrepriseId)
      : {};
    const llmId = prompts.minorationLlmId || prompts.subCategoryLlmId || null;
    if (!llmId) {
      throw new Error('Aucun LLM configuré (minoration/subCategory) pour l’extraction IA des options de base.');
    }

    const chunks = this._chunkArray(list, Number(process.env.UGAP_BASE_REPL_CHUNK_SIZE) || 50);
    const out = [];

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const lines = chunk.map((o, idx) => `${idx + 1}. id=${o.id} | ${o.name}`).join('\n');
      const prompt = `Tu analyses des lignes UGAP (options/minorations).

Objectif:
- Identifier pour chaque ligne:
  - changeType: "replacement" | "motor_base_non_supply" | ""
  - initialProduct: produit de base remplacé (ou "")
  - finalProduct: produit retenu/remplaçant (ou "")
  - confidence: nombre 0..1

Règles:
- Cas "Non fourniture du moteur de base": changeType="motor_base_non_supply", initialProduct="moteur de base", finalProduct="moteur choisi".
- Cas "en remplacement ...": extraire produit initial et final même si la phrase est incomplète (ex: "en remplacement HDS PRO 12 - Postes ...").
- Ne pas inventer d'IDs, utiliser exactement les id= fournis.
- Si ambigu, laisser des chaînes vides et confidence faible.

Exemples métier (à suivre):
1) "Flotteur moussé PE sans revêtement PU en remplacement de celui de base"
   -> initialProduct: "flotteur de base"
   -> finalProduct: "Flotteur moussé PE sans revêtement PU"

2) "Moins-value combiné NSX 3009 XDCR en remplacement de l'HDS PRO 12 fourni de base - Postes 1, 5, 6, 7 et 8"
   -> initialProduct: "HDS PRO 12"
   -> finalProduct: "NSX 3009 XDCR"

3) "Non fourniture du moteur de base - Poste 1"
   -> changeType: "motor_base_non_supply"
   -> initialProduct: "moteur de base"
   -> finalProduct: "moteur choisi"

4) "Moins-value GPSMAP 8412 xsv en remplacement HDS PRO 12 - Postes 1, 5, 6, 7 et 8"
   -> initialProduct: "HDS PRO 12"
   -> finalProduct: "GPSMAP 8412 xsv"

FORMAT DE RETOUR STRICT (OBLIGATOIRE):
- Réponds avec UN SEUL JSON ARRAY valide.
- AUCUN texte avant "[" ni après "]".
- 1 objet par ligne d'entrée (même id), dans n'importe quel ordre.
- Clés autorisées uniquement: id, changeType, initialProduct, finalProduct, confidence
- changeType doit être exactement l'une de: "replacement", "motor_base_non_supply", ""
- initialProduct/finalProduct: string ("" si inconnu)
- confidence: number entre 0 et 1

Réponse attendue (exemple de forme):
[
  {
    "id": "opt_xxx",
    "changeType": "replacement",
    "initialProduct": "HDS PRO 12",
    "finalProduct": "GPSMAP 8412 xsv",
    "confidence": 0.92
  }
]

Lignes:
${lines}`;

      this.logPromptDebug(`Base options / extractBaseReplacementProducts chunk ${i + 1}/${chunks.length}`, prompt, llmId);
      const client = await this.resolveAiClient(llmId);
      const response = await client.sendAnalysisPrompt(prompt, {
        temperature: 0.05,
        max_tokens: 2500
      });

      if (!response?.success) {
        throw new Error(response?.error?.message || 'Erreur IA extraction options de base');
      }
      const text = String(response.data?.response || '').trim();
      this.logResultDebug(`Base options / extractBaseReplacementProducts chunk ${i + 1}/${chunks.length}`, text);

      const firstBracket = text.indexOf('[');
      const lastBracket = text.lastIndexOf(']');
      if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) continue;

      const rawJson = text.substring(firstBracket, lastBracket + 1);
      let parsed = [];
      try {
        parsed = JSON.parse(rawJson);
      } catch (_) {
        parsed = JSON.parse(this._repairInvalidJsonEscapes(rawJson));
      }
      if (!Array.isArray(parsed)) continue;

      parsed.forEach((row) => {
        const id = String(row?.id || '').trim();
        if (!id) return;
        out.push({
          id,
          changeType: String(row?.changeType || '').trim(),
          initialProduct: String(row?.initialProduct || '').trim(),
          finalProduct: String(row?.finalProduct || '').trim(),
          confidence: Number.isFinite(Number(row?.confidence)) ? Number(row.confidence) : 0
        });
      });
    }

    return out;
  }

  /**
   * Regroupement des options / minorations en familles (variantes du même équipement).
   * @param {Array<{ id: string, name: string, category?: string, categoryName?: string, lineKind?: string }>} optionsInput
   * @returns {Promise<{ families: Array<{ familyLabel: string, optionIds: string[], defaultOptionId?: string | null }> }>}
   */
  async suggestOptionFamilies(optionsInput) {
    const list = (optionsInput || [])
      .map((o) => ({
        id: String(o.id || '').trim(),
        name: String(o.name || '').trim(),
        category: String(o.category || o.categoryName || '').trim() || 'Autre',
        lineKind: /minoration|mino/i.test(String(o.lineKind || '')) ? 'minoration' : 'option'
      }))
      .filter((o) => o.id);

    if (list.length === 0) {
      return { families: [] };
    }

    if (!this.db || !this.entrepriseId) {
      throw new Error('Contexte entreprise manquant pour charger le prompt Famille.');
    }
    const promptsDoc = await UgapDataService.getPrompts(this.db, this.entrepriseId);
    const ctxBlock = String(promptsDoc.familleContext || '').trim();
    const bodyBlock = String(promptsDoc.famillePrompt || '').trim();
    const promptTemplate = [ctxBlock, bodyBlock].filter(Boolean).join('\n\n');

    if (!promptTemplate) {
      throw new Error('Prompt Famille vide : renseignez-le dans l’onglet Prompts IA > Famille.');
    }

    if (!promptsDoc.familleLlmId) {
      throw new Error('Aucun LLM configuré pour le prompt Famille. Sélectionnez un LLM dans Prompts IA.');
    }
    const baseSelection = String(promptsDoc.familleLlmId || '').trim();
    const picked = this._pickTextModelIfVisionSelected(baseSelection);
    if (picked.forced) {
      console.warn(`⚠️ UGAP IA: LLM Famille semble être un modèle vision. Fallback automatique vers modèle texte via "${picked.llmSelection}".`);
    }

    const idSetAll = new Set(list.map((o) => o.id));
    const assigned = new Set();
    const mergedFamiliesByLabel = new Map();

    const addFamily = (familyLabel, optionIds, defaultOptionId = null) => {
      const label = this._normalizeFamilyLabel(familyLabel);
      const ids = (optionIds || []).map((x) => String(x || '').trim()).filter(Boolean);
      if (ids.length === 0) return;
      if (!mergedFamiliesByLabel.has(label)) {
        mergedFamiliesByLabel.set(label, { familyLabel: label, optionIds: [], defaultOptionId: null });
      }
      const target = mergedFamiliesByLabel.get(label);
      for (const id of ids) {
        if (!idSetAll.has(id) || assigned.has(id)) continue;
        assigned.add(id);
        target.optionIds.push(id);
      }
      const wanted = defaultOptionId != null && String(defaultOptionId).trim() !== '' ? String(defaultOptionId).trim() : null;
      if (wanted && target.optionIds.includes(wanted)) {
        target.defaultOptionId = wanted;
      } else if (!target.defaultOptionId && target.optionIds.length > 0) {
        target.defaultOptionId = target.optionIds[0];
      }
    };

    const buildPromptForChunk = (chunkList) => {
      const linesBlock = chunkList
        .map(
          (o, idx) =>
            `${idx + 1}. id=${o.id} | type=${o.lineKind} | cat=${o.category} | ${o.name}`
        )
        .join('\n');

      let prompt = promptTemplate;
      if (/\{\{\s*LISTE_LIGNES\s*\}\}/i.test(prompt) || /\{\{\s*lines\s*\}\}/i.test(prompt)) {
        prompt = prompt
          .replace(/\{\{\s*LISTE_LIGNES\s*\}\}/gi, linesBlock)
          .replace(/\{\{\s*lines\s*\}\}/gi, linesBlock);
      } else {
        prompt = `${prompt}\n\n--- Liste des lignes ---\n${linesBlock}`;
      }
      return prompt;
    };

    const parseFamiliesFromText = (text, chunkIdsSet) => {
      const firstBracket = text.indexOf('[');
      const lastBracket = text.lastIndexOf(']');
      if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
        throw new Error('Réponse IA : tableau JSON introuvable');
      }
      let parsed;
      try {
        parsed = JSON.parse(text.substring(firstBracket, lastBracket + 1));
      } catch (e) {
        const rawJson = text.substring(firstBracket, lastBracket + 1);
        const repaired = this._repairInvalidJsonEscapes(rawJson);
        parsed = JSON.parse(repaired);
        console.warn('⚠️ UGAP IA: JSON Famille réparé automatiquement (escapes invalides).');
      }
      if (!Array.isArray(parsed)) throw new Error('Réponse IA : le JSON doit être un tableau');
      if (this._isPlaceholderFamilyResponse(text, parsed)) {
        throw new Error('Réponse IA: réponse placeholder / non exploitable');
      }

      // Validation minimale: l’IA doit réutiliser des IDs réels (pas inventer) et en assigner une part significative.
      let matchedCount = 0;
      let totalMentioned = 0;
      for (const item of parsed) {
        const rawIds = Array.isArray(item.optionIds)
          ? item.optionIds
          : Array.isArray(item.option_ids)
            ? item.option_ids
            : [];
        for (const raw of rawIds) {
          totalMentioned += 1;
          const id = String(raw || '').trim();
          if (chunkIdsSet.has(id)) matchedCount += 1;
        }
      }
      if (totalMentioned > 0 && matchedCount / Math.max(1, totalMentioned) < 0.6) {
        throw new Error('Réponse IA: trop d’IDs non reconnus / inventés');
      }
      return parsed;
    };

    // Chunking: par catégorie puis paquets (évite 535 lignes d’un coup → meilleur clustering + moins lent).
    const byCategory = new Map();
    for (const o of list) {
      const key = `${o.lineKind}||${o.category || 'Autre'}`;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key).push(o);
    }
    const orderedKeys = Array.from(byCategory.keys()).sort();
    // Valeurs par défaut "safe" pour éviter les timeouts proxy (502 après ~600s).
    const maxChunkSize = Number(process.env.UGAP_FAMILLE_CHUNK_SIZE) || 80;
    const familleMaxTokens = Number(process.env.UGAP_FAMILLE_MAX_TOKENS) || 3000;

    for (const key of orderedKeys) {
      const chunked = this._chunkArray(byCategory.get(key) || [], maxChunkSize);
      for (let idx = 0; idx < chunked.length; idx += 1) {
        const chunkList = chunked[idx];
        const chunkIdsSet = new Set(chunkList.map((x) => x.id));
        const prompt = buildPromptForChunk(chunkList);

        let parsed = null;
        let text = '';
        try {
          this.logPromptDebug(`Famille / suggestOptionFamilies (chunk ${key} #${idx + 1}/${chunked.length})`, prompt, picked.llmSelection || '');
          const client = await this.resolveAiClient(picked.llmSelection || null);
          const response = await client.sendAnalysisPrompt(prompt, {
            temperature: 0.05,
            max_tokens: familleMaxTokens
          });
          if (!response.success) throw new Error(response.error?.message || 'Erreur appel IA');
          text = String(response.data?.response || '').trim();
          this.logResultDebug(`Famille / suggestOptionFamilies (chunk ${key} #${idx + 1}/${chunked.length})`, text);
          parsed = parseFamiliesFromText(text, chunkIdsSet);
        } catch (e) {
          console.warn(`⚠️ UGAP IA Famille: chunk fallback heuristique (${key} #${idx + 1}) : ${e.message || e}`);
          parsed = null;
        }

        if (parsed) {
          for (const item of parsed) {
            const label = this._normalizeFamilyLabel(item.familyLabel || item.family_label || 'Famille');
            const rawIds = Array.isArray(item.optionIds)
              ? item.optionIds
              : Array.isArray(item.option_ids)
                ? item.option_ids
                : [];
            const rawDefault =
              item.defaultOptionId ??
              item.default_option_id ??
              (typeof item.defaultOption === 'string' ? item.defaultOption : null);
            addFamily(label, rawIds, rawDefault);
          }

          // Si l'IA n'a pas couvert tout le chunk, compléter via heuristique sur les non assignés.
          const unassignedInChunk = chunkList.filter((o) => !assigned.has(o.id));
          if (unassignedInChunk.length > 0) {
            const heuristic = this._heuristicFamiliesForChunk(unassignedInChunk);
            for (const f of heuristic) {
              addFamily(f.familyLabel, f.optionIds, f.defaultOptionId);
            }
          }
        } else {
          const heuristic = this._heuristicFamiliesForChunk(chunkList);
          for (const f of heuristic) {
            addFamily(f.familyLabel, f.optionIds, f.defaultOptionId);
          }
        }
      }
    }

    // Compléter les IDs non assignés (sécurité).
    for (const id of idSetAll) {
      if (!assigned.has(id)) {
        const o = list.find((x) => x.id === id);
        addFamily(o && o.name ? o.name.slice(0, 100) : id, [id], id);
      }
    }

    const baseFamilies = Array.from(mergedFamiliesByLabel.values())
      .filter((f) => Array.isArray(f.optionIds) && f.optionIds.length > 0)
      .map((f) => ({
        familyLabel: f.familyLabel,
        optionIds: f.optionIds,
        ...(f.defaultOptionId ? { defaultOptionId: f.defaultOptionId } : {})
      }));

    const families = [];
    for (const family of baseFamilies) {
      const business = await this.inferFamilyBusinessView(list, family, picked.llmSelection || null);
      families.push({
        ...family,
        assignation: business.assignation,
        businessView: business.businessView,
        ...(business.subFamily ? { subFamily: business.subFamily } : {})
      });
    }

    try {
      console.log(`📦 [UGAP IA] Famille / suggestOptionFamilies: ${families.length} famille(s) produite(s) pour ${list.length} ligne(s).`);
      console.log(
        `📦 [UGAP IA] Famille / suggestOptionFamilies: aperçu =`,
        families.slice(0, 10).map((f) => ({
          familyLabel: f.familyLabel,
          optionIdsCount: Array.isArray(f.optionIds) ? f.optionIds.length : 0,
          optionIds: f.optionIds
        }))
      );
    } catch (_) {
      // no-op
    }

    return { families };
  }

  /**
   * Assigne des familles à des vues métier (IA), famille par famille.
   * @param {Array<{familyLabel:string, optionIds?:string[], optionLabels?:Object, assignation?:string, subFamily?:string}>} familiesInput
   * @param {Array<{id:string,label:string,keywords?:string}>} businessViewsInput
   * @returns {Promise<{assignments:Array}>}
   */
  async assignFamiliesToBusinessViews(familiesInput, businessViewsInput) {
    const families = (Array.isArray(familiesInput) ? familiesInput : [])
      .map((f, idx) => ({
        index: idx,
        familyLabel: String(f?.familyLabel || '').trim() || `Famille ${idx + 1}`,
        assignation: String(f?.assignation || '').trim(),
        subFamily: String(f?.subFamily || f?.subFamilyLabel || '').trim(),
        optionIds: Array.isArray(f?.optionIds) ? f.optionIds.map((id) => String(id || '').trim()).filter(Boolean) : [],
        optionLabels: f?.optionLabels && typeof f.optionLabels === 'object' ? f.optionLabels : {}
      }));
    const views = (Array.isArray(businessViewsInput) ? businessViewsInput : [])
      .map((v) => ({
        id: String(v?.id || '').trim(),
        label: String(v?.label || '').trim(),
        keywords: String(v?.keywords || '').trim()
      }))
      .filter((v) => v.id && v.label);

    if (families.length === 0) return { assignments: [] };
    if (views.length === 0) throw new Error('Aucune vue métier fournie pour l’assignation IA.');

    let llmId = null;
    if (this.db && this.entrepriseId) {
      const prompts = await UgapDataService.getPrompts(this.db, this.entrepriseId);
      llmId = prompts.assignationLlmId || prompts.familleLlmId || prompts.subCategoryLlmId || null;
    }
    const client = await this.resolveAiClient(llmId || null);
    const viewsBlock = views
      .map((v, i) => `${i + 1}. id=${v.id} | label=${v.label}${v.keywords ? ` | keywords=${v.keywords}` : ''}`)
      .join('\n');

    let assignationPromptTemplate = '';
    if (this.db && this.entrepriseId) {
      const prompts = await UgapDataService.getPrompts(this.db, this.entrepriseId);
      assignationPromptTemplate = String(prompts.assignationPrompt || '').trim();
    }

    const normalize = (v) => String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    const findViewByLooseMatch = (rawId, rawLabel) => {
      const idWanted = String(rawId || '').trim();
      const labelWanted = String(rawLabel || '').trim();
      if (idWanted) {
        const byId = views.find((v) => v.id === idWanted);
        if (byId) return byId;
      }
      if (labelWanted) {
        const n = normalize(labelWanted);
        const byExactLabel = views.find((v) => normalize(v.label) === n);
        if (byExactLabel) return byExactLabel;
        const byContains = views.find((v) => normalize(v.label).includes(n) || n.includes(normalize(v.label)));
        if (byContains) return byContains;
      }
      return null;
    };

    const assignments = [];
    for (const fam of families) {
      const optionLines = fam.optionIds
        .slice(0, 20)
        .map((id, i) => `${i + 1}. ${id} | ${String(fam.optionLabels?.[id] || '').trim() || 'N/A'}`)
        .join('\n');
      const defaultPrompt = `Tu dois assigner UNE famille à UNE vue métier.

Vues métier disponibles:
{{businessViews}}

Famille à classer:
- familyLabel: {{familyLabel}}
- assignation actuelle: {{assignation}}
- sousFamille: {{subFamily}}
- nombre options: {{optionsCount}}
- exemples options:
{{optionsList}}

Règles:
- Choisir exactement UNE vue métier parmi les id fournis.
- Se baser sur le sens métier de la famille et les mots-clés des vues.
- Répondre en JSON strict, sans texte autour.

Format:
{
  "businessViewId": "id_exact_si_possible",
  "businessViewLabel": "label_vue_metier",
  "confidence": 0.0,
  "reason": "explication courte"
}`;
      const tpl = assignationPromptTemplate || defaultPrompt;
      const prompt = tpl
        .replace(/\{\{businessViews\}\}/g, viewsBlock)
        .replace(/\{\{familyLabel\}\}/g, fam.familyLabel)
        .replace(/\{\{assignation\}\}/g, fam.assignation || '(vide)')
        .replace(/\{\{subFamily\}\}/g, fam.subFamily || '(vide)')
        .replace(/\{\{optionsCount\}\}/g, String(fam.optionIds.length))
        .replace(/\{\{optionsList\}\}/g, optionLines || '(aucune)');

      try {
        const response = await client.sendAnalysisPrompt(prompt, {
          temperature: 0.05,
          max_tokens: 300
        });
        if (!response?.success) throw new Error(response?.error?.message || 'Erreur IA');
        const text = String(response.data?.response || '').trim();
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
          throw new Error('JSON introuvable');
        }
        const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
        const matched = findViewByLooseMatch(
          parsed.businessViewId || parsed.viewId || '',
          parsed.businessViewLabel || parsed.vueMetier || parsed.businessView || parsed.viewLabel || ''
        );
        assignments.push({
          familyIndex: fam.index,
          familyLabel: fam.familyLabel,
          businessViewId: matched ? matched.id : '',
          businessViewLabel: matched ? matched.label : '',
          confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : null,
          reason: String(parsed.reason || '').trim(),
          source: 'ia'
        });
      } catch (e) {
        assignments.push({
          familyIndex: fam.index,
          familyLabel: fam.familyLabel,
          businessViewId: '',
          businessViewLabel: '',
          confidence: null,
          reason: String(e?.message || 'Erreur IA'),
          source: 'fallback'
        });
      }
    }

    return { assignments };
  }
}

module.exports = UgapAIService;
