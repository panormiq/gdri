/**
 * Script pour afficher le prompt actuellement utilisé
 * Usage: node modules/ugap/backend/scripts/show-current-prompt.js [entrepriseId]
 */

const path = require('path');
const Database = require(path.join(__dirname, '../../../../backend/config/database'));
const UgapDataService = require('../services/UgapDataService');

async function showCurrentPrompt() {
  const entrepriseId = process.argv[2] || '696413816d982079e5b2cdd7'; // ID par défaut depuis les logs
  
  let entrepriseDb = null;
  
  try {
    console.log('🔗 Connexion à MongoDB...');
    await Database.connect();
    entrepriseDb = await Database.getEntrepriseDb(entrepriseId);
    
    console.log(`\n📋 Récupération du prompt pour l'entreprise: ${entrepriseId}\n`);
    
    // Récupérer le prompt actuel
    const prompts = await UgapDataService.getPrompts(entrepriseDb, entrepriseId);
    
    console.log('═'.repeat(80));
    console.log('📝 PROMPT ACTUELLEMENT UTILISÉ POUR LA DÉTECTION DE SOUS-CATÉGORIES');
    console.log('═'.repeat(80));
    console.log('\n' + prompts.subCategoryPrompt);
    console.log('\n' + '═'.repeat(80));
    
    // Vérifier si c'est un prompt personnalisé ou le prompt par défaut
    const collection = entrepriseDb.collection('ugap_prompts');
    const document = await collection.findOne({ entrepriseId });
    
    if (document) {
      console.log('\n📌 STATUT: Prompt personnalisé stocké en base de données');
      console.log(`   Modifié le: ${document.updatedAt || document.createdAt || 'Date inconnue'}`);
    } else {
      console.log('\n📌 STATUT: Prompt par défaut (aucun prompt personnalisé en base)');
    }
    
    // Vérifier si le prompt contient les mauvais exemples
    const promptText = prompts.subCategoryPrompt.toLowerCase();
    const hasBadExamples = 
      promptText.includes('par marque') || 
      promptText.includes('suzuki, yamaha') ||
      promptText.includes('par puissance') ||
      promptText.includes('par type');
    
    if (hasBadExamples) {
      console.log('\n⚠️  ATTENTION: Ce prompt contient encore des exemples de regroupement par marque/caractéristique !');
      console.log('   → Utilisez le bouton "Réinitialiser aux valeurs par défaut" dans l\'interface admin');
      console.log('   → Ou utilisez: node modules/ugap/backend/scripts/reset-prompts.js');
    } else {
      console.log('\n✅ Le prompt semble correct (pas de regroupement par marque)');
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    if (Database) {
      await Database.close();
    }
  }
}

showCurrentPrompt();
