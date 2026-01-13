/**
 * Script de nettoyage : Retire tous les utilisateurs de toutes les entreprises
 * Fichier : backend/scripts/cleanup-entity-users.js
 * 
 * Ce script retire tous les utilisateurs de toutes les entreprises pour permettre
 * une réassignation propre avec la nouvelle méthode qui crée les références dans
 * les bases d'entreprise.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const database = require('../config/database');
const { ObjectId } = require('mongodb');

async function cleanupEntityUsers() {
  try {
    console.log('🧹 Début du nettoyage des utilisateurs des entreprises...');
    
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
    
    let totalRemoved = 0;
    
    // 4. Pour chaque utilisateur, retirer toutes les entreprises
    for (const user of allUsers) {
      const userEmail = user.email || 'N/A';
      const entreprises = user.entreprises || [];
      
      if (entreprises.length === 0) {
        console.log(`  ⏭️  ${userEmail} : Aucune entreprise à retirer`);
        continue;
      }
      
      console.log(`\n👤 Traitement de ${userEmail} (${entreprises.length} entreprise(s))`);
      
      // Retirer toutes les entreprises
      const updateData = {
        entreprises: [], // Tableau vide
        updated_at: new Date()
      };
      
      // Si currentEntrepriseId était une de ces entreprises, le mettre à null
      if (user.currentEntrepriseId) {
        const currentIdStr = user.currentEntrepriseId.toString();
        const hasCurrentInEntreprises = entreprises.some(e => {
          const eId = e.entrepriseId ? e.entrepriseId.toString() : null;
          return eId === currentIdStr;
        });
        
        if (hasCurrentInEntreprises) {
          updateData.currentEntrepriseId = null;
          console.log(`  🔄 currentEntrepriseId mis à null`);
        }
      }
      
      // Mettre à jour l'utilisateur
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: updateData }
      );
      
      console.log(`  ✅ ${entreprises.length} entreprise(s) retirée(s) de ${userEmail}`);
      totalRemoved += entreprises.length;
      
      // 5. Supprimer les références dans les bases d'entreprise
      for (const entreprise of entreprises) {
        if (!entreprise.entrepriseId) continue;
        
        const entityId = entreprise.entrepriseId.toString();
        const entityName = entities.find(e => e._id.toString() === entityId)?.name || 'N/A';
        
        try {
          const entrepriseDb = await database.getEntrepriseDb(entityId);
          const entrepriseUsersCollection = entrepriseDb.collection('users');
          
          await entrepriseUsersCollection.deleteOne({ userId: user._id });
          
          console.log(`    ✅ Référence supprimée de ${entityName} (${entityId})`);
        } catch (refError) {
          console.warn(`    ⚠️  Impossible de supprimer la référence dans ${entityName}: ${refError.message}`);
        }
      }
    }
    
    console.log(`\n✅ Nettoyage terminé !`);
    console.log(`   Total : ${totalRemoved} association(s) utilisateur-entreprise supprimée(s)`);
    console.log(`\n📝 Prochaines étapes :`);
    console.log(`   1. Allez sur la page entities.php`);
    console.log(`   2. Pour chaque entreprise, cliquez sur "+ Ajouter un utilisateur"`);
    console.log(`   3. Sélectionnez les utilisateurs et réassignez-les`);
    console.log(`   4. Les références seront automatiquement créées dans les bases d'entreprise`);
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    process.exit(1);
  } finally {
    // Fermer la connexion
    await database.close();
    process.exit(0);
  }
}

// Exécuter le nettoyage
cleanupEntityUsers();
