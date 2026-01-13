/**
 * Script MongoDB pour créer une base de données d'entreprise de manière sécurisée
 * 
 * Ce script doit être exécuté avec un utilisateur admin MongoDB (pas gdri_admin)
 * Usage: mongosh < create-entreprise-database-secure.js
 */

// Configuration
const ENTREPRISE_ID = process.argv[2] || '690881831bcb9fec6fec6f03a242'; // Remplacer par l'ID réel
const ADMIN_USER = 'gdri_admin_setup'; // Utilisateur admin séparé
const ADMIN_PASSWORD = 'CHANGER_EN_PRODUCTION'; // Changer en production

// Se connecter en tant qu'admin
use('admin');
db.auth(ADMIN_USER, ADMIN_PASSWORD);

// Nom de la base de données
const dbName = `GDR-ENTREPRISE-${ENTREPRISE_ID}`;
const entrepriseDb = db.getSiblingDB(dbName);

print(`🏗️  Création de la base ${dbName}...`);

// Créer les collections initiales
entrepriseDb.createCollection('collections');
entrepriseDb.createCollection('templates');
entrepriseDb.createCollection('documents');
entrepriseDb.createCollection('_init');

print(`✅ Base ${dbName} créée avec succès`);

// Créer un utilisateur spécifique pour cette base (OPTIONNEL mais recommandé)
const appUser = `gdri_app_${ENTREPRISE_ID.replace(/[^a-zA-Z0-9]/g, '_')}`;
const appPassword = generateRandomPassword(); // À implémenter

entrepriseDb.createUser({
  user: appUser,
  pwd: appPassword,
  roles: [
    { role: 'readWrite', db: dbName },
    { role: 'dbAdmin', db: dbName }
  ]
});

print(`✅ Utilisateur ${appUser} créé pour la base ${dbName}`);
print(`⚠️  Mot de passe: ${appPassword} (à sauvegarder de manière sécurisée)`);

// Alternative : Donner les permissions à gdri_admin pour cette base uniquement
print(`🔐 Attribution des permissions à gdri_admin pour ${dbName}...`);

db.grantRolesToUser('gdri_admin', [
  { role: 'readWrite', db: dbName },
  { role: 'dbAdmin', db: dbName }
]);

print(`✅ Permissions accordées à gdri_admin pour ${dbName}`);

// Fonction pour générer un mot de passe aléatoire
function generateRandomPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 32; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
