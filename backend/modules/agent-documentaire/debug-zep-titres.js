/**
 * Debug : Vérifier combien de titres avec style Zep-TitreX sont détectés
 */

const WordToJson = require('./extractors/wordtojson');
const WordParser = require('./extractors/word-parser');
const StyleHierarchy = require('./extractors/style-hierarchy');
const path = require('path');
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');

async function debugZepTitres() {
  const testFile = path.join(__dirname, 'src-test', 'MÉMOIRE TECHNIQUE CD 22VPRO - PORT DE BONIFACIO - Copie.docx');
  
  // Extraire le document
  const zip = new AdmZip(testFile);
  const documentXml = zip.getEntry('word/document.xml').getData().toString('utf8');
  const stylesXml = zip.getEntry('word/styles.xml').getData().toString('utf8');
  
  // Parser
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
  const StyleExtractor = require('./extractors/style-extractor');
  const documentStyles = await StyleExtractor.extract(stylesXml);
  const styleHierarchy = StyleHierarchy.analyze(documentStyles);
  
  // Extraire le TOC
  const ExtractToc = require('./extractors/methodes/extract-toc');
  const tocResult = await ExtractToc.extract(documentObj, []);
  
  // Parcourir tous les paragraphes et trouver ceux avec style Zep-TitreX
  const topLevelElements = WordParser.getTopLevelElements(documentObj);
  const zepTitres = [];
  
  for (let i = 0; i < topLevelElements.length; i++) {
    const { tag, element } = topLevelElements[i];
    
    if (tag === 'w:p') {
      const styleId = WordParser.getParagraphStyle(element);
      if (styleId && (styleId.includes('Zep') || styleId.includes('Titre'))) {
        const text = WordParser.extractText(element).trim();
        const isHeading = StyleHierarchy.isHeading(styleId, styleHierarchy);
        const level = isHeading ? StyleHierarchy.getHeadingLevel(styleId, styleHierarchy) : null;
        
        // Vérifier si c'est dans le TOC
        const ExtractToc2 = require('./extractors/methodes/extract-toc');
        const numberingInfo = ExtractToc2.extractNumbering(text);
        const cleanText = (numberingInfo ? numberingInfo.text : text).toLowerCase().trim();
        
        const inToc = tocResult.toc.find(entry => {
          const entryTitle = (entry.title || '').toLowerCase().trim();
          return entryTitle === cleanText || entryTitle.includes(cleanText) || cleanText.includes(entryTitle);
        });
        
        zepTitres.push({
          index: i,
          styleId: styleId,
          level: level,
          text: text.substring(0, 60),
          inToc: !!inToc,
          tocTitle: inToc ? inToc.title : null
        });
      }
    }
  }
  
  console.log(`\n📊 Résultats:`);
  console.log(`   - Titres avec style Zep-TitreX/TitreX détectés: ${zepTitres.length}`);
  console.log(`   - Entrées TOC: ${tocResult.toc.length}`);
  console.log(`   - Titres dans le TOC: ${zepTitres.filter(t => t.inToc).length}`);
  console.log(`   - Titres PAS dans le TOC: ${zepTitres.filter(t => !t.inToc).length}`);
  
  if (zepTitres.filter(t => !t.inToc).length > 0) {
    console.log(`\n⚠️  Titres avec style Zep-TitreX mais PAS dans le TOC:`);
    zepTitres.filter(t => !t.inToc).forEach((t, i) => {
      console.log(`   ${i + 1}. [${t.styleId}] niveau ${t.level}: "${t.text}..."`);
    });
  }
  
  // Afficher les premiers titres
  console.log(`\n📋 Premiers titres détectés:`);
  zepTitres.slice(0, 10).forEach((t, i) => {
    console.log(`   ${i + 1}. [${t.styleId}] niveau ${t.level} ${t.inToc ? '✓' : '✗'}: "${t.text}..."`);
  });
}

debugZepTitres().catch(console.error);

