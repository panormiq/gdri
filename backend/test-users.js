/**
 * Test des utilisateurs MongoDB
 * Fichier : backend/test-users.js
 * 
 * Lancement : node backend/test-users.js
 */

const database = require('./config/database');
const User = require('./models/User');

async function testUsers() {
  try {
    console.log('🔄 Connexion à MongoDB...\n');
    
    await database.connect();
    console.log('✅ Connecté !\n');
    
    // Lister tous les utilisateurs
    const collection = database.getCollection('users');
    const users = await collection.find({}).toArray();
    
    console.log(`📊 Nombre d'utilisateurs : ${users.length}\n`);
    
    if (users.length > 0) {
      console.log('👥 Utilisateurs dans la base :\n');
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   - Rôle : ${user.role}`);
        console.log(`   - Statut : ${user.status}`);
        console.log(`   - Entity ID : ${user.entity_id ? user.entity_id : 'null'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  Aucun utilisateur trouvé dans la base de données\n');
    }
    
    await database.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Erreur :', error.message);
    process.exit(1);
  }
}

testUsers();

