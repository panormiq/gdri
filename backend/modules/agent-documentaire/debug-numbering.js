/**
 * Debug : Examiner le contenu de numbering.xml
 */

const path = require('path');
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');

async function debugNumbering() {
  const testFile = path.join(__dirname, 'src-test', 'MÉMOIRE TECHNIQUE CD 22VPRO - PORT DE BONIFACIO - Copie.docx');
  
  console.log('🔄 Extraction de numbering.xml...\n');
  
  const zip = new AdmZip(testFile);
  const numberingXml = zip.getEntry('word/numbering.xml');
  
  if (!numberingXml) {
    console.log('❌ Fichier numbering.xml non trouvé');
    return;
  }
  
  const xmlContent = numberingXml.getData().toString('utf8');
  
  console.log('📄 Contenu de numbering.xml (premiers 2000 caractères):\n');
  console.log(xmlContent.substring(0, 2000));
  console.log('\n...\n');
  
  // Parser le XML
  const parser = new xml2js.Parser({
    explicitArray: true,
    mergeAttrs: false,
    explicitRoot: false,
    attrkey: '$',
    charkey: '_'
  });
  
  const numberingObj = await parser.parseStringPromise(xmlContent);
  
  console.log('\n📋 Structure parsée:\n');
  console.log('AbstractNums:', numberingObj['w:abstractNum']?.length || 0);
  console.log('Nums:', numberingObj['w:num']?.length || 0);
  
  // Afficher les abstractNum
  const abstractNums = numberingObj['w:abstractNum'] || [];
  for (let i = 0; i < abstractNums.length; i++) {
    const abstractNum = abstractNums[i];
    const abstractNumId = abstractNum['$']?.['w:abstractNumId'];
    const levels = abstractNum['w:lvl'] || [];
    
    console.log(`\n📑 AbstractNum ${i} (ID: ${abstractNumId}):`);
    console.log(`   ${levels.length} niveaux définis`);
    
    for (const level of levels) {
      const levelIndex = parseInt(level['$']?.['w:ilvl']) || 0;
      const numFmt = level['w:numFmt']?.[0]?.['$']?.['w:val'] || 'decimal';
      const text = level['w:lvlText']?.[0]?.['$']?.['w:val'] || '%1.';
      const start = parseInt(level['w:start']?.[0]?.['$']?.['w:val']) || 1;
      
      console.log(`   Niveau ${levelIndex}:`);
      console.log(`     - w:lvlText: "${text}"`);
      console.log(`     - w:numFmt: "${numFmt}"`);
      console.log(`     - w:start: ${start}`);
    }
  }
}

debugNumbering().catch(console.error);

