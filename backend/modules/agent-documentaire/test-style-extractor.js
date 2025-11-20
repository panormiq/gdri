/**
 * Test de l'extracteur de styles
 * Fichier : backend/modules/agent-documentaire/test-style-extractor.js
 * 
 * Usage : node test-style-extractor.js
 */

const path = require('path');
const AdmZip = require('adm-zip');
const StyleExtractor = require('./extractors/style-extractor');

async function testStyleExtractor() {
  console.log('🧪 Test de l\'extracteur de styles\n');
  
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
    
    // Ouvrir le fichier Word (ZIP)
    const zip = new AdmZip(testFile);
    const zipEntries = zip.getEntries();
    
    // Chercher word/styles.xml
    let stylesXml = null;
    for (const entry of zipEntries) {
      if (entry.entryName === 'word/styles.xml') {
        stylesXml = entry.getData().toString('utf8');
        console.log('✅ word/styles.xml trouvé\n');
        break;
      }
    }
    
    if (!stylesXml) {
      console.warn('⚠️  word/styles.xml non trouvé, test avec styles par défaut\n');
    }
    
    // Extraire les styles
    console.log('📋 Extraction des styles...\n');
    const styles = await StyleExtractor.extract(stylesXml);
    
    // Afficher les résultats
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSULTATS DE L\'EXTRACTION');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`Nombre de styles extraits : ${Object.keys(styles).length}\n`);
    
    // Afficher chaque style
    for (const [styleId, style] of Object.entries(styles)) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📌 Style ID: ${styleId}`);
      console.log(`   Nom: ${style.name}`);
      console.log(`   Type: ${style.type}`);
      
      // Propriétés de paragraphe
      if (style.paragraph) {
        console.log(`\n   📝 Propriétés de paragraphe:`);
        console.log(`      - Alignement: ${style.paragraph.alignment}`);
        console.log(`      - Espacement avant: ${style.paragraph.spacing.before}pt`);
        console.log(`      - Espacement après: ${style.paragraph.spacing.after}pt`);
        console.log(`      - Interligne: ${style.paragraph.spacing.line}`);
        console.log(`      - Indentation gauche: ${style.paragraph.indentation.left}pt`);
        console.log(`      - Indentation droite: ${style.paragraph.indentation.right}pt`);
        console.log(`      - Indentation première ligne: ${style.paragraph.indentation.firstLine}pt`);
      }
      
      // Propriétés de run (formatage)
      if (style.run) {
        console.log(`\n   ✏️  Propriétés de formatage:`);
        console.log(`      - Gras: ${style.run.bold ? 'Oui' : 'Non'}`);
        console.log(`      - Italique: ${style.run.italic ? 'Oui' : 'Non'}`);
        console.log(`      - Souligné: ${style.run.underline ? 'Oui' : 'Non'}`);
        console.log(`      - Taille: ${style.run.fontSize}pt`);
        console.log(`      - Police: ${style.run.fontFamily}`);
        console.log(`      - Couleur: ${style.run.color}`);
        console.log(`      - Majuscules: ${style.run.caps ? 'Oui' : 'Non'}`);
      }
      
      console.log('');
    }
    
    // Afficher un résumé
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📈 RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const styleTypes = {};
    for (const style of Object.values(styles)) {
      styleTypes[style.type] = (styleTypes[style.type] || 0) + 1;
    }
    
    console.log('Types de styles trouvés:');
    for (const [type, count] of Object.entries(styleTypes)) {
      console.log(`  - ${type}: ${count}`);
    }
    
    // Styles de paragraphe spéciaux
    const headingStyles = Object.keys(styles).filter(id => id.startsWith('Heading'));
    if (headingStyles.length > 0) {
      console.log(`\n🎯 Styles de titre trouvés: ${headingStyles.join(', ')}`);
    }
    
    // Sauvegarder dans un fichier JSON pour inspection
    const outputFile = path.join(__dirname, 'test-styles-output.json');
    fs.writeFileSync(outputFile, JSON.stringify(styles, null, 2));
    console.log(`\n💾 Résultats sauvegardés dans : ${outputFile}`);
    
    console.log('\n✅ Test terminé avec succès !\n');
    
  } catch (error) {
    console.error('\n❌ Erreur lors du test:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécuter le test
testStyleExtractor();

