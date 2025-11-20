/**
 * Test de l'extraction complète Word → JSON
 * Fichier : backend/modules/agent-documentaire/test-full-extraction.js
 * 
 * Usage : node test-full-extraction.js
 */

const path = require('path');
const WordToJson = require('./extractors/wordtojson');

async function testFullExtraction() {
  console.log('🧪 Test de l\'extraction complète Word → JSON\n');
  
  // Chemin vers le fichier Word de test
  const testFile = path.join(__dirname, 'src-test', 'MÉMOIRE TECHNIQUE CD 22VPRO - PORT DE BONIFACIO - Copie.docx');
  
  try {
    // Vérifier que le fichier existe
    const fs = require('fs');
    if (!fs.existsSync(testFile)) {
      console.error(`❌ Fichier de test non trouvé : ${testFile}`);
      process.exit(1);
    }
    
    console.log(`📄 Fichier de test : ${testFile}\n`);
    
    // Extraire le document Word → JSON
    console.log('🔄 Extraction complète du document Word...\n');
    const startTime = Date.now();
    const result = await WordToJson.extract(testFile);
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // Afficher les résultats
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSULTATS DE L\'EXTRACTION COMPLÈTE');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Informations générales
    console.log(`📋 Métadonnées:`);
    console.log(`   - Titre: ${result.metadata.title}`);
    console.log(`   - Créé le: ${result.metadata.createdAt}`);
    console.log(`   - Durée d'extraction: ${duration}s`);
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
    
    // Statistiques sur les sections
    if (result.sections && result.sections.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📄 STATISTIQUES DES SECTIONS');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      let totalParagraphs = 0;
      let totalHeadings = 0;
      let totalImages = 0;
      let totalTables = 0;
      let introductionCount = 0;
      let annexCount = 0;
      
      const countContent = (section) => {
        if (section.type === 'introduction') {
          introductionCount++;
        }
        if (section.isAnnex) {
          annexCount++;
        }
        
        if (section.content) {
          for (const item of section.content) {
            if (item.type === 'paragraph') {
              totalParagraphs++;
            } else if (item.type === 'heading') {
              totalHeadings++;
            } else if (item.type === 'image') {
              totalImages++;
            } else if (item.type === 'table') {
              totalTables++;
            }
          }
        }
        
        if (section.children) {
          for (const child of section.children) {
            countContent(child);
          }
        }
      };
      
      for (const section of result.sections) {
        countContent(section);
      }
      
      console.log(`   - Sections totales: ${result.sections.length}`);
      console.log(`   - Sections introduction: ${introductionCount}`);
      console.log(`   - Sections annexes: ${annexCount}`);
      console.log(`   - Paragraphes: ${totalParagraphs}`);
      console.log(`   - Titres: ${totalHeadings}`);
      console.log(`   - Images: ${totalImages}`);
      console.log(`   - Tableaux: ${totalTables}\n`);
      
      // Afficher quelques sections en détail
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📄 PREMIÈRES SECTIONS');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      for (let i = 0; i < Math.min(5, result.sections.length); i++) {
        const section = result.sections[i];
        console.log(`${i + 1}. ${section.title || 'Sans titre'}`);
        console.log(`   - Type: ${section.type}`);
        console.log(`   - Niveau: ${section.level || 'N/A'}`);
        console.log(`   - Numérotation: ${section.numbering || 'N/A'}`);
        console.log(`   - Contenu: ${section.content?.length || 0} éléments`);
        if (section.isAnnex) {
          console.log(`   - Type: Annexe`);
        }
        console.log('');
      }
    }
    
    // Statistiques sur les images
    if (result.images && result.images.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🖼️  STATISTIQUES DES IMAGES');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      console.log(`   - Nombre d'images: ${result.images.length}`);
      console.log(`   - Premières images:`);
      for (let i = 0; i < Math.min(3, result.images.length); i++) {
        const img = result.images[i];
        console.log(`     ${i + 1}. ${img.name} (${img.path})`);
      }
      console.log('');
    }
    
    // Aperçu du TOC
    if (result.toc && result.toc.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📑 APERÇU DU TOC (10 premières entrées)');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      for (let i = 0; i < Math.min(10, result.toc.length); i++) {
        const entry = result.toc[i];
        if (entry.type === 'separator') {
          console.log(`   ─── ${entry.label} ───`);
        } else {
          const indent = '  '.repeat((entry.level || 1) - 1);
          const numbering = entry.numbering ? `${entry.numbering} ` : '';
          console.log(`${indent}${numbering}${entry.title || 'Sans titre'}`);
          if (entry.isAnnex) {
            console.log(`${indent}   └─ Type: Annexe`);
          }
        }
      }
      console.log('');
    }
    
    // Sauvegarder dans un fichier JSON pour inspection
    const outputFile = path.join(__dirname, 'test-full-extraction-output.json');
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`💾 Résultats complets sauvegardés dans : ${outputFile}`);
    
    // Sauvegarder un résumé
    const summaryFile = path.join(__dirname, 'test-full-extraction-summary.json');
    const summary = {
      metadata: result.metadata,
      stats: {
        stylesCount: Object.keys(result.styles || {}).length,
        sectionsCount: result.sections?.length || 0,
        tocEntriesCount: result.toc?.length || 0,
        imagesCount: result.images?.length || 0,
        extractionDuration: `${duration}s`
      },
      tocInfo: result.tocInfo,
      sectionsPreview: result.sections?.slice(0, 5).map(s => ({
        title: s.title,
        type: s.type,
        level: s.level,
        numbering: s.numbering,
        contentCount: s.content?.length || 0
      })) || []
    };
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`💾 Résumé sauvegardé dans : ${summaryFile}`);
    
    console.log('\n✅ Test terminé avec succès !\n');
    
  } catch (error) {
    console.error('\n❌ Erreur lors du test:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécuter le test
testFullExtraction();

