/**
 * Test pour vérifier si les styles TOC (TM1, TM2, etc.) sont bien détectés et utilisés
 */

const WordToJson = require('./extractors/wordtojson');
const path = require('path');

async function testTocStyles() {
  const testFile = path.join(__dirname, 'src-test', 'MÉMOIRE TECHNIQUE CD 22VPRO - PORT DE BONIFACIO - Copie.docx');
  
  console.log('🔄 Extraction du document avec détection des styles TOC...\n');
  const result = await WordToJson.extract(testFile);
  
  console.log('\n📊 Résultats:');
  console.log(`   - Styles TOC détectés: ${result.tocInfo.tocStyles?.length || 0}`);
  if (result.tocInfo.tocStyles && result.tocInfo.tocStyles.length > 0) {
    console.log(`   - Liste: ${result.tocInfo.tocStyles.join(', ')}`);
  }
  
  console.log(`\n   - Styles dans la hiérarchie: ${Object.keys(result.styleHierarchy.styleToLevel).length}`);
  console.log(`   - Mapping des styles:`);
  for (const [styleId, level] of Object.entries(result.styleHierarchy.styleToLevel)) {
    console.log(`     ${styleId} → niveau ${level}`);
  }
  
  // Vérifier si les styles TMX sont dans la hiérarchie
  const tocStylesInHierarchy = result.tocInfo.tocStyles?.filter(style => 
    result.styleHierarchy.styleToLevel[style]
  ) || [];
  
  console.log(`\n   - Styles TOC dans la hiérarchie: ${tocStylesInHierarchy.length}/${result.tocInfo.tocStyles?.length || 0}`);
  if (tocStylesInHierarchy.length > 0) {
    console.log(`     ${tocStylesInHierarchy.join(', ')}`);
  } else if (result.tocInfo.tocStyles && result.tocInfo.tocStyles.length > 0) {
    console.log(`     ⚠️  Les styles TOC ne sont PAS dans la hiérarchie !`);
    console.log(`     Styles TOC détectés: ${result.tocInfo.tocStyles.join(', ')}`);
    console.log(`     Styles dans la hiérarchie: ${Object.keys(result.styleHierarchy.styleToLevel).join(', ')}`);
  }
}

testTocStyles().catch(console.error);

