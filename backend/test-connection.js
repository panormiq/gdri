/**
 * Test de connexion MongoDB - Backend Node.js
 * Fichier : backend/test-connection.js
 * 
 * Lancement : node backend/test-connection.js
 */

const database = require('./config/database');

async function testConnection() {
  try {
    console.log('🔄 Tentative de connexion à MongoDB...\n');
    
    // Connexion
    await database.connect();
    console.log('✅ Connexion réussie !\n');
    
    // Tester la connexion avec un ping
    const db = database.getCollection('users');
    await db.db.admin().command({ ping: 1 });
    console.log('✅ Ping MongoDB réussi !\n');
    
    // Lister les collections
    console.log('📊 Collections disponibles :');
    const collections = await db.db.listCollections().toArray();
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
    console.log('\n✅ Test de connexion terminé avec succès !\n');
    
    // Fermer la connexion
    await database.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Erreur lors du test :', error.message);
    console.error('\n💡 Vérifiez que :');
    console.error('  1. MongoDB est démarré');
    console.error('  2. L\'utilisateur "gdri_admin" existe');
    console.error('  3. Le mot de passe est correct\n');
    process.exit(1);
  }
}

// Lancer le test
testConnection();

