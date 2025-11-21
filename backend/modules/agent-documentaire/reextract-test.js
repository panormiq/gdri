/**
 * Script pour forcer la réextraction du document de test
 */

const path = require('path');
const fs = require('fs').promises;
const WordToJson = require('./extractors/wordtojson');
const { MongoClient } = require('mongodb');
const config = require('./config.json');

async function reextract() {
  let client;
  
  try {
    console.log('🔄 Réextraction du document de test...');
    
    // Chemin vers le fichier Word de test
    const testFile = path.join(__dirname, 'src-test', 'MÉMOIRE TECHNIQUE CD 22VPRO - PORT DE BONIFACIO.docx');
    
    console.log('📄 Fichier:', testFile);
    
    // Extraire le document Word → JSON
    console.log('🔄 Extraction du document Word...');
    const jsonContent = await WordToJson.extract(testFile);
    
    console.log('✅ Extraction terminée !');
    console.log('📊 Sections:', jsonContent.sections ? jsonContent.sections.length : 0);
    console.log('📑 TOC:', jsonContent.toc ? jsonContent.toc.length : 0);
    console.log('🖼️  Images:', jsonContent.images ? jsonContent.images.length : 0);
    
    // Copier les images vers le dossier default-test
    if (jsonContent.images && jsonContent.images.length > 0) {
      console.log('\n📷 Copie des images vers default-test...');
      const imagesPath = path.resolve(__dirname, config.imagesPath);
      const sourceDocId = path.basename(testFile, '.docx');
      const sourceDir = path.join(imagesPath, sourceDocId);
      const targetDir = path.join(imagesPath, 'default-test');
      
      await fs.mkdir(targetDir, { recursive: true });
      
      for (const image of jsonContent.images) {
        const sourcePath = path.join(sourceDir, image.name);
        const targetPath = path.join(targetDir, image.name);
        try {
          await fs.copyFile(sourcePath, targetPath);
          console.log(`  ✅ ${image.name}`);
        } catch (err) {
          console.log(`  ⚠️  ${image.name} (erreur: ${err.message})`);
        }
      }
      console.log('✅ Images copiées avec succès');
    }
    
    console.log('\n🔍 DEBUG - Vérification avant sauvegarde:');
    console.log('   - Type de sections:', typeof jsonContent.sections);
    console.log('   - Sections est Array:', Array.isArray(jsonContent.sections));
    console.log('   - Sections value:', jsonContent.sections);
    
    // Connexion à MongoDB
    console.log('\n🔗 Connexion à MongoDB...');
    const mongoUri = 'mongodb://gdri_admin:gdri2024@localhost:27017/GDR-INNOVATION?authSource=GDR-INNOVATION';
    const dbName = 'GDR-INNOVATION';
    
    client = new MongoClient(mongoUri);
    await client.connect();
    console.log('✅ Connecté à MongoDB');
    
    const db = client.db(dbName);
    const collection = db.collection('documents'); // ← CORRECTION : même collection que le backend !
    
    // Créer le document
    const document = {
      _id: 'default-test',
      title: jsonContent.metadata?.title || 'Document test',
      original_filename: path.basename(testFile),
      word_file_path: testFile,
      json_content: jsonContent,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        status: 'test',
      },
      lockable_properties: {}
    };
    
    // Supprimer l ancien document pour forcer un remplacement complet
    console.log('Suppression de l ancien document...');
    const deleteResult = await collection.deleteOne({ _id: 'default-test' });
    console.log('Supprime:', deleteResult.deletedCount, 'document(s)');
    
    // Inserer le nouveau document
    console.log('Sauvegarde dans MongoDB...');
    await collection.insertOne(document);
    
    console.log('Document sauvegarde avec succes !');
    console.log('\n📋 Résumé:');
    console.log('   - Sections:', jsonContent.sections ? jsonContent.sections.length : 0);
    console.log('   - TOC entries:', jsonContent.toc ? jsonContent.toc.length : 0);
    console.log('   - Images:', jsonContent.images ? jsonContent.images.length : 0);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Connexion MongoDB fermée');
    }
    process.exit(0);
  }
}

reextract();

