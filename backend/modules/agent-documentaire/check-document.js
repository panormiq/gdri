/**
 * Script pour vérifier le contenu du document en base
 */

const { MongoClient } = require('mongodb');

async function checkDocument() {
  let client;
  
  try {
    console.log('🔍 Vérification du document en base...\n');
    
    // Connexion à MongoDB
    const mongoUri = 'mongodb://gdri_admin:gdri2024@localhost:27017/GDR-INNOVATION?authSource=GDR-INNOVATION';
    const dbName = 'GDR-INNOVATION';
    
    client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db(dbName);
    const collection = db.collection('documents'); // Même collection que le backend
    
    // Récupérer le document
    const document = await collection.findOne({ _id: 'default-test' });
    
    if (!document) {
      console.log('❌ Document "default-test" non trouvé dans MongoDB');
      process.exit(1);
    }
    
    console.log('✅ Document trouvé !');
    console.log('📋 Titre:', document.title);
    console.log('📄 Fichier:', document.original_filename);
    console.log('\n📊 Contenu JSON:');
    console.log('   - sections:', document.json_content.sections ? `${document.json_content.sections.length} sections` : 'NULL ou undefined');
    console.log('   - toc:', document.json_content.toc ? `${document.json_content.toc.length} entrées` : 'NULL');
    console.log('   - images:', document.json_content.images ? `${document.json_content.images.length} images` : 'NULL');
    
    if (document.json_content.sections) {
      console.log('\n📑 Aperçu des sections:');
      document.json_content.sections.slice(0, 5).forEach((section, index) => {
        console.log(`   ${index + 1}. [Niveau ${section.level}] ${section.title || '(Sans titre)'}`);
        if (section.children && section.children.length > 0) {
          console.log(`      → ${section.children.length} sous-section(s)`);
        }
      });
      if (document.json_content.sections.length > 5) {
        console.log(`   ... et ${document.json_content.sections.length - 5} autres sections`);
      }
    } else {
      console.log('\n⚠️  PROBLÈME: sections est NULL ou undefined !');
      console.log('Le document doit être réextrait correctement.');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
    process.exit(0);
  }
}

checkDocument();

