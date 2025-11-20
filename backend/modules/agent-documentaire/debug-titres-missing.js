/**
 * Debug : Vérifier quels titres du TOC ne sont pas trouvés dans le document
 */

const WordParser = require('./extractors/word-parser');
const ExtractToc = require('./extractors/methodes/extract-toc');
const path = require('path');
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');

async function debugTitresMissing() {
  const testFile = path.join(__dirname, 'src-test', 'MÉMOIRE TECHNIQUE CD 22VPRO - PORT DE BONIFACIO - Copie.docx');
  
  console.log('🔄 Extraction du document...\n');
  
  // Extraire le document directement
  const zip = new AdmZip(testFile);
  const documentXml = zip.getEntry('word/document.xml').getData().toString('utf8');
  
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
  
  // Extraire le TOC
  const tocResult = await ExtractToc.extract(documentObj, []);
  const toc = tocResult.toc;
  
  // Parcourir tous les paragraphes et trouver ceux qui correspondent au TOC
  const topLevelElements = WordParser.getTopLevelElements(documentObj);
  
  const foundTitles = [];
  const missingTitles = [];
  
  for (const tocEntry of toc) {
    if (tocEntry.type === 'separator') continue;
    
    const tocTitle = (tocEntry.title || '').toLowerCase().trim();
    const tocNumbering = tocEntry.numbering ? tocEntry.numbering.toLowerCase() : null;
    
    let found = false;
    
    for (const { tag, element } of topLevelElements) {
      if (tag === 'w:p') {
        const paragraphText = WordParser.extractText(element).trim();
        if (!paragraphText || paragraphText.length < 3) continue;
        
        const numberingInfo = ExtractToc.extractNumbering(paragraphText);
        const cleanText = (numberingInfo ? numberingInfo.text : paragraphText).toLowerCase().trim();
        const paragraphNumbering = numberingInfo ? numberingInfo.full : null;
        
        // Nettoyer le texte du TOC aussi (enlever PAGEREF, etc.)
        let cleanTocTitle = tocTitle;
        cleanTocTitle = cleanTocTitle.replace(/pageref\s+[^\s]+\s*\\h\d*/gi, '').trim();
        cleanTocTitle = cleanTocTitle.replace(/\\h\d*/g, '').trim();
        cleanTocTitle = cleanTocTitle.replace(/\s+\d+\s*$/, '').trim();
        
        // Vérifier correspondance exacte
        if (cleanText === cleanTocTitle) {
          found = true;
          foundTitles.push({ toc: tocEntry.title, found: paragraphText.substring(0, 60), method: 'exact' });
          break;
        }
        
        // Vérifier avec numérotation
        if (tocNumbering && paragraphNumbering) {
          const paraNum = paragraphNumbering.toLowerCase().trim();
          const tocNum = tocNumbering.toLowerCase().trim();
          if (paraNum === tocNum) {
            // Vérifier similarité
            const similarity = calculateSimilarity(cleanText, cleanTocTitle);
            if (similarity >= 0.9) {
              found = true;
              foundTitles.push({ toc: tocEntry.title, found: paragraphText.substring(0, 60), similarity, method: 'numbering+similarity' });
              break;
            }
          }
        }
        
        // Vérifier correspondance partielle stricte
        if (cleanText.includes(cleanTocTitle) || cleanTocTitle.includes(cleanText)) {
          const minLength = Math.min(cleanText.length, cleanTocTitle.length);
          const matchLength = cleanText.includes(cleanTocTitle) ? cleanTocTitle.length : cleanText.length;
          if (matchLength >= minLength * 0.95) { // 95% de correspondance
            found = true;
            foundTitles.push({ toc: tocEntry.title, found: paragraphText.substring(0, 60), method: 'partial' });
            break;
          }
        }
      }
    }
    
    if (!found) {
      missingTitles.push(tocEntry);
    }
  }
  
  console.log(`\n📊 Résultats:`);
  console.log(`   - Entrées TOC: ${toc.length}`);
  console.log(`   - Titres trouvés: ${foundTitles.length}`);
  console.log(`   - Titres manquants: ${missingTitles.length}`);
  
  if (missingTitles.length > 0) {
    console.log(`\n⚠️  Titres du TOC non trouvés dans le document:`);
    missingTitles.slice(0, 10).forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.numbering ? t.numbering + ' ' : ''}${t.title}`);
    });
  }
  
  if (foundTitles.length > 0) {
    console.log(`\n✅ Premiers titres trouvés:`);
    foundTitles.slice(0, 5).forEach((t, i) => {
      console.log(`   ${i + 1}. TOC: "${t.toc}" → Trouvé: "${t.found}..."`);
    });
  }
}

function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

debugTitresMissing().catch(console.error);

