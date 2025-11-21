/**
 * Script pour vérifier les positions des images dans MongoDB
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://gdri_admin:gdri2024@localhost:27017/GDR-INNOVATION?authSource=GDR-INNOVATION';
const DB_NAME = 'GDR-INNOVATION';

async function checkImagesPosition() {
  let client;
  
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    const collection = db.collection('documents');
    
    const doc = await collection.findOne({ _id: 'default-test' });
    
    if (!doc) {
      console.log('Document default-test NOT FOUND !');
      return;
    }
    
    console.log('Document trouve !');
    console.log('Metadata updatedAt:', doc.metadata?.updatedAt);
    
    // Compter les images et leurs positions
    let imageCount = 0;
    let absoluteCount = 0;
    let inlineCount = 0;
    
    function checkContent(items) {
      if (!Array.isArray(items)) return;
      
      items.forEach(item => {
        if (item.type === 'image') {
          imageCount++;
          if (item.position?.isAbsolute === true) {
            absoluteCount++;
            console.log(`IMAGE ABSOLUTE: ${item.name} - x:${item.position.x}, y:${item.position.y}`);
          } else {
            inlineCount++;
          }
        }
      });
    }
    
    function traverseSections(sections) {
      if (!Array.isArray(sections)) return;
      
      sections.forEach(section => {
        checkContent(section.content);
        traverseSections(section.children);
      });
    }
    
    traverseSections(doc.json_content?.sections);
    
    console.log('\nRESULTATS:');
    console.log('Total images:', imageCount);
    console.log('Images ABSOLUTE:', absoluteCount);
    console.log('Images INLINE:', inlineCount);
    
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    if (client) await client.close();
  }
}

checkImagesPosition();

