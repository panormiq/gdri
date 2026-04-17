/**
 * Script de test pour vérifier le chargement du service IA
 */

const path = require('path');

console.log('🔍 Test du chargement du service IA UGAP...\n');

try {
  console.log('1. Test du chargement de UgapAIService...');
  const UgapAIService = require('./backend/services/UgapAIService');
  console.log('   ✅ UgapAIService chargé');
  
  console.log('2. Test de l\'instanciation...');
  const aiService = new UgapAIService();
  console.log('   ✅ Instance créée');
  
  console.log('3. Test du chargement du module IA...');
  const iaModule = require(path.join(__dirname, '../ia/backend'));
  const client = iaModule.getIAClient();
  console.log('   ✅ Module IA chargé, client:', !!client);
  
  console.log('4. Test du chargement de UgapDataService...');
  const UgapDataService = require('./backend/services/UgapDataService');
  console.log('   ✅ UgapDataService chargé');
  
  console.log('\n✅ Tous les tests sont passés !');
} catch (error) {
  console.error('\n❌ Erreur:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
