/**
 * Script pour régénérer un document spécifique
 * Usage: node regenerate-document.js <documentId> [filename]
 * 
 * Exemples:
 *   node regenerate-document.js 695c31689d3dcfc2ca28d5c3
 *   node regenerate-document.js 695c31689d3dcfc2ca28d5c3 "chemin/vers/fichier.docx"
 */

const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

// Configuration MongoDB
const mongoUri = 'mongodb://gdri_admin:gdri2024@localhost:27017/GDR-INNOVATION?authSource=GDR-INNOVATION';
const dbName = 'GDR-INNOVATION';

async function regenerateDocument(documentId, filename = null) {
  let client;
  
  try {
    console.log('🔄 Régénération du document...');
    console.log(`   Document ID: ${documentId}`);
    
    // Connexion à MongoDB
    console.log('\n🔗 Connexion à MongoDB...');
    client = new MongoClient(mongoUri);
    await client.connect();
    console.log('✅ Connecté à MongoDB');
    
    const db = client.db(dbName);
    const collection = db.collection('documents');
    
    // Récupérer le document existant
    const objectId = ObjectId.isValid(documentId) ? new ObjectId(documentId) : documentId;
    const existingDoc = await collection.findOne({ _id: objectId });
    
    if (!existingDoc) {
      throw new Error(`Document ${documentId} non trouvé`);
    }
    
    console.log(`✅ Document trouvé: ${existingDoc.title || 'Sans titre'}`);
    console.log(`   Fichier Word original: ${existingDoc.word_file_path || 'N/A'}`);
    
    // Déterminer le fichier Word à utiliser
    const wordFilePath = filename 
      ? path.resolve(filename)
      : existingDoc.word_file_path;
    
    if (!wordFilePath) {
      throw new Error('Aucun fichier Word trouvé. Spécifiez un fichier avec: node regenerate-document.js <documentId> <filename>');
    }
    
    // Vérifier que le fichier existe
    const fs = require('fs').promises;
    try {
      await fs.access(wordFilePath);
      console.log(`✅ Fichier Word trouvé: ${wordFilePath}`);
    } catch (err) {
      throw new Error(`Fichier Word non trouvé: ${wordFilePath}`);
    }
    
    // Importer le service d'extraction
    const WordToJson = require('./extractors/wordtojson');
    
    // Extraire le document Word → JSON
    console.log('\n🔄 Extraction du document Word...');
    const jsonContent = await WordToJson.extract(wordFilePath);
    
    console.log('✅ Extraction terminée !');
    console.log('📊 Sections:', jsonContent.sections ? jsonContent.sections.length : 0);
    console.log('📑 TOC:', jsonContent.toc ? jsonContent.toc.length : 0);
    console.log('🖼️  Images:', jsonContent.images ? jsonContent.images.length : 0);
    
    // Préserver le canvas existant si disponible
    if (existingDoc.json_content?.canvas) {
      console.log('✅ Préservation du canvas existant');
      jsonContent.canvas = existingDoc.json_content.canvas;
    }
    
    // Mettre à jour le document
    console.log('\n💾 Mise à jour du document dans MongoDB...');
    const updateResult = await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          json_content: jsonContent,
          word_file_path: wordFilePath,
          original_filename: path.basename(wordFilePath),
          'metadata.updatedAt': new Date(),
          'metadata.version': (existingDoc.metadata?.version || 0) + 1
        }
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log('✅ Document régénéré avec succès !');
      console.log('\n📋 Résumé:');
      console.log(`   - Document ID: ${documentId}`);
      console.log(`   - Sections: ${jsonContent.sections ? jsonContent.sections.length : 0}`);
      console.log(`   - TOC entries: ${jsonContent.toc ? jsonContent.toc.length : 0}`);
      console.log(`   - Images: ${jsonContent.images ? jsonContent.images.length : 0}`);
      console.log(`   - Images stockées dans: backend/modules/agent-documentaire/storage/images/${documentId}/`);
    } else {
      console.log('⚠️  Aucune modification effectuée');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Connexion MongoDB fermée');
    }
    process.exit(0);
  }
}

// Récupérer les arguments
const documentId = process.argv[2];
const filename = process.argv[3] || null;

if (!documentId) {
  console.error('❌ Usage: node regenerate-document.js <documentId> [filename]');
  console.error('   Exemple: node regenerate-document.js 695c31689d3dcfc2ca28d5c3');
  process.exit(1);
}

regenerateDocument(documentId, filename);


