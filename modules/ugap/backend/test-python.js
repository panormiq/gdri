/**
 * Script de test pour vérifier que Python et les librairies sont disponibles
 */

const { getPythonServer } = require('./services/PythonExtractionServer');

async function testPython() {
  console.log('🔍 Test de détection Python...\n');
  
  try {
    const server = getPythonServer();
    
    // Détecter Python
    console.log('1. Détection de Python...');
    const pythonPath = await server.detectPython();
    console.log(`   ✅ Python trouvé: ${pythonPath}\n`);
    
    // Tester Tabula
    console.log('2. Test de Tabula (tabula-py)...');
    const tabulaAvailable = await server.checkTabula();
    if (tabulaAvailable) {
      console.log('   ✅ Tabula est disponible\n');
    } else {
      console.log('   ❌ Tabula n\'est pas disponible');
      console.log('   💡 Installez avec: pip install tabula-py\n');
    }
    
    // Tester Camelot
    console.log('3. Test de Camelot (camelot-py)...');
    const camelotAvailable = await server.checkCamelot();
    if (camelotAvailable) {
      console.log('   ✅ Camelot est disponible\n');
    } else {
      console.log('   ❌ Camelot n\'est pas disponible');
      console.log('   💡 Installez avec: pip install camelot-py[cv]\n');
    }
    
    console.log('✅ Tests terminés');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

testPython();
