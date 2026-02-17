/**
 * Service IA pour la catégorisation UGAP
 * Fichier : modules/ugap/backend/services/UgapAIService.js
 */

const path = require('path');
const AIService = require(path.join(__dirname, '../../../../backend/modules/analyse-intention/services/AIService'));

class UgapAIService {
  constructor(db = null, entrepriseId = null, progressCallback = null) {
    this.aiService = new AIService({
      ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'mistral:latest',
      timeout: 600000
    });
    this.db = db;
    this.entrepriseId = entrepriseId;
    this.progressCallback = progressCallback;
  }

  sendProgress(message, type = 'info') {
    if (this.progressCallback) {
      this.progressCallback({ message, type });
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

      const response = await this.aiService.sendAnalysisPrompt(prompt, {
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
      
      const response = await this.aiService.sendAnalysisPrompt(prompt, { 
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
      
      const response = await this.aiService.sendAnalysisPrompt(prompt, {
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
      "subCategory": "Nom de la sous-catégorie (optionnel)"
    }
  ]
}`;
    }

    const optionsList = options.map(opt => `- ${opt.name}`).join('\n');
    const prompt = promptTemplate.replace(/\{\{optionsList\}\}/g, optionsList);

    return prompt;
  }
}

module.exports = UgapAIService;
