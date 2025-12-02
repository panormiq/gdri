/**
 * Script pour remettre toutes les sections en 'structural'
 * 
 * Usage: node backend/modules/agent-documentaire/scripts/reset-all-sections-to-structural.js
 * 
 * Ce script parcourt tous les documents et remet toutes les sections optionnelles
 * en sections structurelles.
 */

const path = require('path');
const database = require('../../../config/database');

/**
 * Parcourt récursivement toutes les sections et les remet en structural
 * @param {Array} sections - Tableau de sections
 * @returns {Object} Statistiques des modifications
 */
function resetSectionsToStructural(sections) {
  if (!Array.isArray(sections)) {
    return { modified: 0, total: 0 };
  }

  let modified = 0;
  let total = 0;

  sections.forEach(section => {
    total++;
    
    // Si la section est optionnelle, la remettre en structural
    if (section.structure === 'optional') {
      section.structure = 'structural';
      section.actif = true; // Les sections structurelles sont toujours actives
      section.parent = null; // Pas de parent pour les sections structurelles
      section.category = null; // Pas de catégorie pour les sections structurelles
      modified++;
      console.log(`  ✅ Section "${section.title || section.id}" remise en structural`);
    }

    // Parcourir récursivement les enfants
    if (Array.isArray(section.children) && section.children.length > 0) {
      const childStats = resetSectionsToStructural(section.children);
      modified += childStats.modified;
      total += childStats.total;
    }
  });

  return { modified, total };
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log('🚀 Démarrage du script de réinitialisation des sections...\n');

    // Connexion à MongoDB
    console.log('📡 Connexion à MongoDB...');
    await database.connect();
    const collection = database.getCollection('documents');

    // Récupérer tous les documents
    console.log('📄 Récupération de tous les documents...');
    const documents = await collection.find({}).toArray();
    console.log(`   Trouvé ${documents.length} document(s)\n`);

    if (documents.length === 0) {
      console.log('ℹ️  Aucun document trouvé. Rien à faire.');
      await database.close();
      return;
    }

    let totalDocumentsModified = 0;
    let totalSectionsModified = 0;
    let totalSectionsTotal = 0;

    // Parcourir chaque document
    for (const document of documents) {
      console.log(`\n📄 Traitement du document: ${document._id}`);
      
      if (!document.json_content || !Array.isArray(document.json_content.sections)) {
        console.log('   ⚠️  Pas de sections à traiter');
        continue;
      }

      // Compter les sections avant modification
      const sectionsBefore = document.json_content.sections.length;
      
      // Réinitialiser toutes les sections en structural
      const stats = resetSectionsToStructural(document.json_content.sections);
      
      totalSectionsModified += stats.modified;
      totalSectionsTotal += stats.total;

      if (stats.modified > 0) {
        // Mettre à jour le document dans MongoDB
        document.metadata = document.metadata || {};
        document.metadata.updatedAt = new Date();
        document.metadata.version = (document.metadata.version || 0) + 1;

        await collection.updateOne(
          { _id: document._id },
          { $set: document }
        );

        totalDocumentsModified++;
        console.log(`   ✅ Document mis à jour: ${stats.modified} section(s) modifiée(s) sur ${stats.total}`);
      } else {
        console.log(`   ℹ️  Aucune modification nécessaire (toutes les sections sont déjà structural)`);
      }
    }

    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`   Documents traités: ${documents.length}`);
    console.log(`   Documents modifiés: ${totalDocumentsModified}`);
    console.log(`   Sections totales: ${totalSectionsTotal}`);
    console.log(`   Sections modifiées: ${totalSectionsModified}`);
    console.log('='.repeat(60));
    console.log('\n✅ Script terminé avec succès !');

    // Fermer la connexion
    await database.close();

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'exécution du script:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécuter le script
main();

