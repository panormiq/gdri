/**
 * Debug : Vérifier l'extraction de texte pour un paragraphe spécifique
 */

const WordParser = require('./extractors/word-parser');
const path = require('path');
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');

async function debugTextExtraction() {
  // Chercher le fichier .docx dans src-test
  const srcTestDir = path.join(__dirname, 'src-test');
  const files = require('fs').readdirSync(srcTestDir);
  const docxFile = files.find(f => f.endsWith('.docx') && !f.endsWith('.zip'));
  if (!docxFile) {
    console.error('❌ Aucun fichier .docx trouvé dans src-test');
    return;
  }
  const testFile = path.join(srcTestDir, docxFile);
  console.log(`📄 Fichier utilisé: ${docxFile}`);
  
  console.log('🔄 Extraction du document...\n');
  
  const zip = new AdmZip(testFile);
  const documentXml = zip.getEntry('word/document.xml').getData().toString('utf8');
  
  const parser = new xml2js.Parser({
    explicitArray: true,
    mergeAttrs: false,
    explicitRoot: false,
    trim: false,
    normalize: false,
    charkey: '_',
    attrkey: '$',
  });
  
  const documentObj = await parser.parseStringPromise(documentXml);
  
  // Parcourir tous les paragraphes et trouver celui qui contient "plaisance de Cavallo"
  const topLevelElements = WordParser.getTopLevelElements(documentObj);
  
  for (let i = 0; i < topLevelElements.length; i++) {
    const { tag, element } = topLevelElements[i];
    
    if (tag === 'w:p') {
      const text = WordParser.extractText(element);
      
      // Chercher le paragraphe qui contient "Elle peut naviguer"
      if (text && text.includes('Elle peut naviguer')) {
        console.log(`\n📝 Paragraphe trouvé à l'index ${i}:`);
        console.log(`Texte extrait: "${text}"`);
        console.log(`\nStructure XML du paragraphe:`);
        console.log(JSON.stringify(element, null, 2).substring(0, 2000));
        
        // Extraire les runs dans l'ordre depuis le XML directement
        const runsFromXml = element['w:r'] || [];
        console.log(`\n📋 ${runsFromXml.length} runs trouvés dans le XML (ordre original):`);
        for (let j = 0; j < runsFromXml.length; j++) {
          const run = runsFromXml[j];
          const runText = WordParser.extractText(run);
          console.log(`  Run ${j}: "${runText}"`);
          
          // Afficher la structure du run pour voir s'il y a des éléments spéciaux
          if (run['w:lastRenderedPageBreak']) {
            console.log(`    ⚠️  Contient w:lastRenderedPageBreak`);
          }
          if (run['w:br']) {
            console.log(`    ⚠️  Contient w:br`);
          }
          if (run['w:t']) {
            const w_t = run['w:t'];
            if (Array.isArray(w_t)) {
              w_t.forEach((t, idx) => {
                if (t['_']) {
                  console.log(`    w:t[${idx}]: "${t['_']}"`);
                }
              });
            } else if (w_t['_']) {
              console.log(`    w:t: "${w_t['_']}"`);
            }
          }
        }
        
        // Comparer avec findElementsByTag
        const runsFromFind = WordParser.findElementsByTag(element, 'w:r');
        console.log(`\n📋 ${runsFromFind.length} runs trouvés avec findElementsByTag:`);
        for (let j = 0; j < runsFromFind.length; j++) {
          const run = runsFromFind[j];
          const runText = WordParser.extractText(run);
          console.log(`  Run ${j}: "${runText}"`);
        }
        
        break;
      }
    }
  }
}

debugTextExtraction().catch(console.error);

