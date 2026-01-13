/**
 * Script pour lister tous les templates sauvegardés
 * Usage: node list-templates.js
 */

const { MongoClient } = require('mongodb');

async function listTemplates() {
  let client;
  
  try {
    console.log('📋 Liste des templates sauvegardés...\n');
    
    // Connexion à MongoDB
    const mongoUri = 'mongodb://gdri_admin:gdri2024@localhost:27017/GDR-INNOVATION?authSource=GDR-INNOVATION';
    const dbName = 'GDR-INNOVATION';
    
    client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db(dbName);
    const collection = db.collection('templates');
    
    // Récupérer tous les templates
    const templates = await collection.find({}).sort({ 'metadata.createdAt': -1 }).toArray();
    
    if (templates.length === 0) {
      console.log('❌ Aucun template trouvé dans MongoDB');
      process.exit(0);
    }
    
    console.log(`✅ ${templates.length} template(s) trouvé(s)\n`);
    
    // Analyser les templates
    const documents = templates.filter(t => !t.namespace.includes(':'));
    const sections = templates.filter(t => t.namespace.includes(':'));
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 RÉSUMÉ`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total: ${templates.length}`);
    console.log(`Documents (sans ':'): ${documents.length}`);
    console.log(`Sections (avec ':'): ${sections.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Afficher les détails de chaque template
    templates.forEach((template, index) => {
      const isDocument = !template.namespace.includes(':');
      const type = isDocument ? '📄 DOCUMENT' : '📑 SECTION';
      
      console.log(`\n${index + 1}. ${type}`);
      console.log('   Namespace:', template.namespace);
      console.log('   Nom:', template.name || 'N/A');
      console.log('   Titre:', template.title || 'N/A');
      console.log('   Standalone:', template.isStandalone ? 'Oui' : 'Non');
      console.log('   Canvas:', template.canvas ? 'Oui' : 'Non');
      if (template.canvas?.metadata?.name) {
        console.log('   Canvas name:', template.canvas.metadata.name);
      }
      console.log('   Sections initiales:', template.initialSections ? `${template.initialSections.length} section(s)` : 'Aucune');
      console.log('   TOC:', template.initialToc ? `${template.initialToc.length} entrée(s)` : 'Aucun');
      console.log('   Formats numérotation:', template.numberingFormats ? 'Oui' : 'Non');
      console.log('   Styles:', template.styles ? 'Oui' : 'Non');
      console.log('   Document source ID:', template.sourceDocumentId || 'N/A');
      console.log('   Créé le:', template.metadata?.createdAt ? new Date(template.metadata.createdAt).toLocaleString('fr-FR') : 'N/A');
      console.log('   Modifié le:', template.metadata?.updatedAt ? new Date(template.metadata.updatedAt).toLocaleString('fr-FR') : 'N/A');
      
      // Afficher les champs du modèle si présents
      if (template.fields && template.fields.length > 0) {
        console.log('   Champs modèle:', `${template.fields.length} champ(s)`);
      }
      if (template.modelNamespace) {
        console.log('   Modèle rattaché:', template.modelNamespace);
      }
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Liste terminée');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Lancer le script
listTemplates();



