/**
 * Test de l'extraction du TOC (Table des matières)
 * Fichier : backend/modules/agent-documentaire/test-toc-extraction.js
 * 
 * Usage : node test-toc-extraction.js
 */

const path = require('path');
const WordToJson = require('./extractors/wordtojson');

async function testTocExtraction() {
  console.log('🧪 Test de l\'extraction du TOC\n');
  
  // Chemin vers le fichier Word de test
  const testFile = path.join(__dirname, 'src-test', 'MÉMOIRE TECHNIQUE CD 22VPRO - PORT DE BONIFACIO.docx');
  
  try {
    // Vérifier que le fichier existe
    const fs = require('fs');
    if (!fs.existsSync(testFile)) {
      console.error(`❌ Fichier de test non trouvé : ${testFile}`);
      process.exit(1);
    }
    
    console.log(`📄 Fichier de test : ${testFile}\n`);
    
    // Extraire le document Word → JSON
    console.log('🔄 Extraction du document Word...\n');
    const result = await WordToJson.extract(testFile);
    
    // Afficher les résultats
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSULTATS DE L\'EXTRACTION');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Informations générales
    console.log(`📋 Métadonnées:`);
    console.log(`   - Titre: ${result.metadata.title}`);
    console.log(`   - Créé le: ${result.metadata.createdAt}`);
    console.log(`   - Styles extraits: ${Object.keys(result.styles || {}).length}`);
    console.log(`   - Sections extraites: ${result.sections?.length || 0}`);
    console.log(`   - Images extraites: ${result.images?.length || 0}\n`);
    
    // Informations sur le TOC
    if (result.tocInfo) {
      console.log(`📑 Informations sur le TOC:`);
      console.log(`   - TOC trouvé dans le document: ${result.tocInfo.found ? 'Oui' : 'Non'}`);
      console.log(`   - Méthode utilisée: ${result.tocInfo.method}`);
      console.log(`   - Nombre d'entrées: ${result.tocInfo.entriesCount}\n`);
    }
    
    // Afficher le TOC
    if (result.toc && result.toc.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📑 TABLE DES MATIÈRES');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      for (let i = 0; i < result.toc.length; i++) {
        const entry = result.toc[i];
        const indent = '  '.repeat((entry.level || 1) - 1);
        const prefix = entry.level ? `${'  '.repeat(entry.level - 1)}${entry.level}. ` : '';
        
        console.log(`${indent}${prefix}${entry.title || entry.text || 'Sans titre'}`);
        if (entry.sectionId) {
          console.log(`${indent}   └─ Section ID: ${entry.sectionId}`);
        }
        if (entry.anchor) {
          console.log(`${indent}   └─ Ancre: ${entry.anchor}`);
        }
        if (entry.isAnnex) {
          console.log(`${indent}   └─ Type: Annexe`);
        }
        console.log('');
      }
    } else {
      console.log('⚠️  Aucune entrée dans le TOC trouvée\n');
    }
    
    // Afficher les sections
    if (result.sections && result.sections.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📄 SECTIONS EXTRAITES');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      const displaySection = (section, depth = 0) => {
        const indent = '  '.repeat(depth);
        console.log(`${indent}📌 ${section.title || 'Sans titre'}`);
        console.log(`${indent}   - ID: ${section.id}`);
        console.log(`${indent}   - Niveau: ${section.level || 1}`);
        console.log(`${indent}   - Ordre: ${section.order || 0}`);
        console.log(`${indent}   - Contenu: ${section.content?.length || 0} éléments`);
        if (section.isAnnex) {
          console.log(`${indent}   - Type: Annexe`);
        }
        console.log('');
        
        if (section.children && section.children.length > 0) {
          for (const child of section.children) {
            displaySection(child, depth + 1);
          }
        }
      };
      
      for (const section of result.sections) {
        displaySection(section);
      }
    } else {
      console.log('⚠️  Aucune section extraite\n');
    }
    
    // Sauvegarder dans un fichier JSON pour inspection
    const outputFile = path.join(__dirname, 'test-toc-output.json');
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`💾 Résultats complets sauvegardés dans : ${outputFile}`);
    
    // Sauvegarder juste le TOC
    const tocOutputFile = path.join(__dirname, 'test-toc-only.json');
    fs.writeFileSync(tocOutputFile, JSON.stringify({
      toc: result.toc,
      tocInfo: result.tocInfo
    }, null, 2));
    console.log(`💾 TOC seul sauvegardé dans : ${tocOutputFile}`);
    
    console.log('\n✅ Test terminé avec succès !\n');
    
  } catch (error) {
    console.error('\n❌ Erreur lors du test:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécuter le test
testTocExtraction();

