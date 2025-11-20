/**
 * Debug : Compter combien de titres avec style Zep-TitreX on trouve
 */

const WordParser = require('./extractors/word-parser');
const StyleHierarchy = require('./extractors/style-hierarchy');
const StyleExtractor = require('./extractors/style-extractor');
const path = require('path');
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');

async function debugCountTitres() {
  const testFile = path.join(__dirname, 'src-test', 'MÉMOIRE TECHNIQUE CD 22VPRO - PORT DE BONIFACIO - Copie.docx');
  
  console.log('🔄 Extraction du document...\n');
  
  // Extraire le document directement
  const zip = new AdmZip(testFile);
  const documentXml = zip.getEntry('word/document.xml').getData().toString('utf8');
  const stylesXml = zip.getEntry('word/styles.xml').getData().toString('utf8');
  
  const parser = new xml2js.Parser({
    explicitArray: true,
    mergeAttrs: false,
    explicitRoot: false,
    trim: true,
    normalize: true,
    charkey: '_',
    attrkey: '$',
  });
  
  const documentObj = await parser.parseStringPromise(documentXml);
  
  // Extraire les styles
  const documentStyles = await StyleExtractor.extract(stylesXml);
  const styleHierarchy = StyleHierarchy.analyze(documentStyles);
  
  // Parcourir tous les paragraphes
  const topLevelElements = WordParser.getTopLevelElements(documentObj);
  
  const titres = {
    titre1: [],
    titre2: [],
    titre3: [],
    autres: []
  };
  
  for (const { tag, element } of topLevelElements) {
    if (tag === 'w:p') {
      const styleId = WordParser.getParagraphStyle(element);
      if (styleId && StyleHierarchy.isHeading(styleId, styleHierarchy)) {
        const level = StyleHierarchy.getHeadingLevel(styleId, styleHierarchy);
        const text = WordParser.extractText(element).trim();
        const styleName = documentStyles[styleId]?.name || styleId;
        
        if (level === 1) {
          titres.titre1.push({ styleId, styleName, text: text.substring(0, 50) });
        } else if (level === 2) {
          titres.titre2.push({ styleId, styleName, text: text.substring(0, 50) });
        } else if (level === 3) {
          titres.titre3.push({ styleId, styleName, text: text.substring(0, 50) });
        } else {
          titres.autres.push({ styleId, styleName, level, text: text.substring(0, 50) });
        }
      }
    }
  }
  
  console.log(`\n📊 Résultats:`);
  console.log(`   - Titre1: ${titres.titre1.length}`);
  console.log(`   - Titre2: ${titres.titre2.length}`);
  console.log(`   - Titre3: ${titres.titre3.length}`);
  console.log(`   - Autres niveaux: ${titres.autres.length}`);
  console.log(`   - TOTAL: ${titres.titre1.length + titres.titre2.length + titres.titre3.length + titres.autres.length}`);
  
  console.log(`\n📋 Premiers Titre1:`);
  titres.titre1.slice(0, 5).forEach((t, i) => {
    console.log(`   ${i + 1}. [${t.styleName}] "${t.text}..."`);
  });
  
  console.log(`\n📋 Premiers Titre2:`);
  titres.titre2.slice(0, 5).forEach((t, i) => {
    console.log(`   ${i + 1}. [${t.styleName}] "${t.text}..."`);
  });
}

debugCountTitres().catch(console.error);

