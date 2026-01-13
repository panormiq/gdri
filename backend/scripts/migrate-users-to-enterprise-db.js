/**
 * Script de migration : Remplir la collection users dans chaque base d'entreprise
 * Fichier : backend/scripts/migrate-users-to-enterprise-db.js
 * 
 * Ce script crée une référence des utilisateurs dans chaque base d'entreprise
 * pour améliorer les performances et éviter de surcharger la base principale.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const database = require('../config/database');
const { ObjectId } = require('mongodb');

async function migrateUsersToEnterpriseDb() {
  try {
    console.log('🚀 Début de la migration des utilisateurs vers les bases d\'entreprise...');
    
    // 1. Connexion à la base principale
    const db = await database.connect();
    const usersCollection = db.collection('users');
    const entitiesCollection = db.collection('entities');
    
    // 2. Récupérer toutes les entités
    const entities = await entitiesCollection.find({}).toArray();
    console.log(`📋 ${entities.length} entité(s) trouvée(s)`);
    
    // 3. Récupérer tous les utilisateurs
    const allUsers = await usersCollection.find({}).toArray();
    console.log(`👤 ${allUsers.length} utilisateur(s) trouvé(s)`);
    
    // 4. Pour chaque entité, créer/mettre à jour la collection users dans sa base
    for (const entity of entities) {
      const entityId = entity._id.toString();
      const entityName = entity.name || 'N/A';
      
      console.log(`\n🏢 Traitement de l'entité: ${entityName} (ID: ${entityId})`);
      
      try {
        // Obtenir la base d'entreprise
        const entrepriseDb = await database.getEntrepriseDb(entityId);
        const entrepriseUsersCollection = entrepriseDb.collection('users');
        
        // Créer la collection users si elle n'existe pas
        try {
          await entrepriseDb.createCollection('users');
          await entrepriseUsersCollection.createIndex({ userId: 1 }, { unique: true });
          console.log(`  ✅ Collection users créée avec index unique sur userId`);
        } catch (error) {
          if (error.code !== 48 && error.codeName !== 'NamespaceExists') {
            // L'index existe peut-être déjà
            try {
              await entrepriseUsersCollection.createIndex({ userId: 1 }, { unique: true });
            } catch (idxError) {
              // L'index existe déjà, c'est OK
              if (idxError.code !== 85 && idxError.codeName !== 'IndexOptionsConflict') {
                console.warn(`  ⚠️  Impossible de créer l'index: ${idxError.message}`);
              }
            }
          }
        }
        
        // Trouver les utilisateurs de cette entité
        let usersCount = 0;
        for (const user of allUsers) {
          const entreprises = user.entreprises || [];
          
          // Vérifier si l'utilisateur appartient à cette entité
          const belongsToEntity = entreprises.some(e => {
            if (!e || !e.entrepriseId) return false;
            const eId = typeof e.entrepriseId === 'string' 
              ? e.entrepriseId 
              : e.entrepriseId.toString();
            return eId === entityId;
          });
          
          if (belongsToEntity) {
            // Trouver le rôle dans cette entreprise
            const userEntreprise = entreprises.find(e => {
              if (!e || !e.entrepriseId) return false;
              const eId = typeof e.entrepriseId === 'string' 
                ? e.entrepriseId 
                : e.entrepriseId.toString();
              return eId === entityId;
            });
            
            const userRole = userEntreprise?.role || 'user';
            
            // Créer une référence légère
            const userReference = {
              userId: user._id instanceof ObjectId ? user._id : new ObjectId(user._id),
              email: user.email || 'N/A',
              role: userRole,
              addedAt: userEntreprise?.joinedAt || new Date(),
              updatedAt: new Date()
            };
            
            // Upsert dans la base d'entreprise
            await entrepriseUsersCollection.updateOne(
              { userId: userReference.userId },
              { $set: userReference },
              { upsert: true }
            );
            
            usersCount++;
            console.log(`  ✅ Référence créée pour: ${user.email} (role: ${userRole})`);
          }
        }
        
        console.log(`  📊 Total: ${usersCount} utilisateur(s) migré(s) pour ${entityName}`);
        
      } catch (error) {
        console.error(`  ❌ Erreur pour l'entité ${entityName}:`, error.message);
        // Continuer avec les autres entités
      }
    }
    
    console.log('\n✅ Migration terminée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    // Fermer la connexion
    await database.close();
    process.exit(0);
  }
}

// Exécuter la migration
migrateUsersToEnterpriseDb();
