/**
 * Exporte toutes les sections extraites dans un fichier JSON
 */

const WordToJson = require('./extractors/wordtojson');
const path = require('path');
const fs = require('fs');

async function exportSections() {
  const testFile = path.join(__dirname, 'src-test', 'MÉMOIRE TECHNIQUE CD 22VPRO - PORT DE BONIFACIO - Copie.docx');
  
  console.log('🔄 Extraction du document...\n');
  const result = await WordToJson.extract(testFile);
  
  // Fonction pour aplatir toutes les sections (premier niveau + enfants)
  function flattenSections(sections, level = 0) {
    const flattened = [];
    for (const section of sections) {
      const sectionInfo = {
        id: section.id,
        type: section.type,
        title: section.title,
        numbering: section.numbering,
        level: section.level,
        isAnnex: section.isAnnex,
        contentCount: section.content ? section.content.length : 0,
        childrenCount: section.children ? section.children.length : 0,
        indent: '  '.repeat(level)
      };
      flattened.push(sectionInfo);
      
      if (section.children && section.children.length > 0) {
        const children = flattenSections(section.children, level + 1);
        flattened.push(...children);
      }
    }
    return flattened;
  }
  
  const allSections = flattenSections(result.sections);
  
  // Créer un objet avec toutes les informations
  const exportData = {
    metadata: {
      totalSections: allSections.length,
      topLevelSections: result.sections.length,
      tocEntries: result.toc.length, // Nombre d'entrées TOC pour référence
      difference: result.toc.length - allSections.length,
      stylesDetected: Object.keys(result.styleHierarchy.styleToLevel).length,
      styleMapping: result.styleHierarchy.styleToLevel
    },
    // TOC retiré - les sections contiennent déjà toute l'information nécessaire
    sections: allSections,
    sectionsHierarchical: result.sections
  };
  
  // Sauvegarder dans un fichier
  const outputFile = path.join(__dirname, 'sections-export.json');
  fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2));
  
  console.log(`✅ ${allSections.length} sections exportées dans : ${outputFile}`);
  console.log(`\n📊 Statistiques:`);
  console.log(`   - Sections de premier niveau: ${result.sections.length}`);
  console.log(`   - Total sections (avec sous-sections): ${allSections.length}`);
  console.log(`   - Entrées TOC: ${result.toc.length}`);
  console.log(`   - Différence: ${result.toc.length - allSections.length}`);
  console.log(`\n📋 Premières sections:`);
  allSections.slice(0, 20).forEach((s, i) => {
    console.log(`${i + 1}. ${s.indent}${s.numbering ? s.numbering + ' ' : ''}${s.title} (level ${s.level}, ${s.contentCount} éléments, ${s.childrenCount} enfants)`);
  });
  
  // Vérifier les doublons potentiels avec le TOC
  console.log(`\n🔍 Vérification des doublons TOC/Sections:`);
  const tocTitles = new Set(result.toc.map(e => e.title?.toLowerCase().trim()).filter(Boolean));
  const sectionTitles = allSections.map(s => s.title?.toLowerCase().trim()).filter(Boolean);
  
  let duplicates = 0;
  for (const sectionTitle of sectionTitles) {
    if (tocTitles.has(sectionTitle)) {
      duplicates++;
    }
  }
  
  console.log(`   - Sections qui correspondent au TOC: ${duplicates}`);
  console.log(`   - Sections uniques (pas dans TOC): ${allSections.length - duplicates}`);
}

exportSections().catch(console.error);

