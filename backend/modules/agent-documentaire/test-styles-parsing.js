const AdmZip = require('adm-zip');
const xml2js = require('xml2js');
const path = require('path');

const testFile = path.join(__dirname, 'src-test', 'MÉMOIRE TECHNIQUE CD 22VPRO - PORT DE BONIFACIO - Copie.docx');
const zip = new AdmZip(testFile);
const stylesXml = zip.getEntry('word/styles.xml').getData().toString('utf8');

const parser = new xml2js.Parser({
  explicitArray: true,
  mergeAttrs: false,
  explicitRoot: false,
  trim: true,
  charkey: '_',
  attrkey: '$'
});

// D'abord, chercher directement dans le XML brut
console.log('Recherche directe dans XML:');
const zepMatches = stylesXml.match(/Zep[^<]*/gi);
const titreMatches = stylesXml.match(/Titre[^<]*/gi);
console.log('Occurrences de "Zep":', zepMatches ? zepMatches.length : 0);
if (zepMatches) {
  zepMatches.slice(0, 10).forEach(m => console.log('  ', m.substring(0, 100)));
}
console.log('\nOccurrences de "Titre":', titreMatches ? titreMatches.length : 0);
if (titreMatches) {
  titreMatches.slice(0, 10).forEach(m => console.log('  ', m.substring(0, 100)));
}

console.log('\n\nParsing XML:');
parser.parseStringPromise(stylesXml).then(stylesObj => {
  console.log('Clés racine:', Object.keys(stylesObj));
  const stylesElement = stylesObj['w:styles'];
  console.log('w:styles existe?', !!stylesElement);
  if (stylesElement) {
    console.log('Type:', Array.isArray(stylesElement) ? 'array' : typeof stylesElement);
    const styles = Array.isArray(stylesElement) ? stylesElement[0] : stylesElement;
    const styleArray = styles?.['w:style'] || [];
    console.log('Total styles dans styles.xml:', styleArray.length);
    console.log('\nTous les styles:');
    styleArray.forEach(style => {
      const attrs = style['$'] || {};
      const styleId = attrs['w:styleId'];
      const styleType = attrs['w:type'];
      const nameElement = style['w:name'];
      const styleName = nameElement?.[0]?.['$']?.['w:val'] || styleId;
      
      const nextElement = style['w:next'];
      const nextStyle = nextElement?.[0]?.['$']?.['w:val'] || null;
      const basedOnElement = style['w:basedOn'];
      const basedOnStyle = basedOnElement?.[0]?.['$']?.['w:val'] || null;
      
      console.log(`  ${styleId} (${styleType}): "${styleName}" - next: ${nextStyle || 'none'} - basedOn: ${basedOnStyle || 'none'}`);
    });
    
    console.log('\n\nStyles contenant "titre" ou "zep":');
    styleArray.forEach(style => {
      const attrs = style['$'] || {};
      const styleId = attrs['w:styleId'];
      const nameElement = style['w:name'];
      const styleName = nameElement?.[0]?.['$']?.['w:val'] || styleId;
      
      if (styleId && (
        styleId.toLowerCase().includes('titre') || 
        styleId.toLowerCase().includes('zep') || 
        styleName.toLowerCase().includes('titre') || 
        styleName.toLowerCase().includes('zep')
      )) {
        const nextElement = style['w:next'];
        const nextStyle = nextElement?.[0]?.['$']?.['w:val'] || null;
        const basedOnElement = style['w:basedOn'];
        const basedOnStyle = basedOnElement?.[0]?.['$']?.['w:val'] || null;
        console.log(`  ${styleId}: "${styleName}" - next: ${nextStyle || 'none'} - basedOn: ${basedOnStyle || 'none'}`);
      }
    });
  }
}).catch(err => {
  console.error('Erreur parsing:', err.message);
  console.error(err.stack);
});

