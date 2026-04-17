const XLSX = require('xlsx');
const path = require('path');

try {
    const filePath = path.join(__dirname, 'modules/ugap/source/TARIF ALU UGAP 2024(6).xlsx');
    console.log('Lecture du fichier:', filePath);
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const ws = workbook.Sheets[sheetName];
    
    // Lire les données brutes (tableau de tableaux)
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    
    console.log('\n--- ANALYSE STRUCTURE (30 premières lignes) ---');
    console.log('Total lignes:', data.length);
    
    // Afficher les 30 premières lignes avec index
    for (let i = 0; i < Math.min(30, data.length); i++) {
        const row = data[i];
        // Remplacer les valeurs vides par "." pour la lisibilité
        const formattedRow = row.map(cell => {
            if (cell === undefined || cell === null || cell === '') return '.';
            return String(cell).substring(0, 15); // Tronquer pour affichage
        });
        console.log(`Row ${i}: [${formattedRow.join(' | ')}]`);
    }
    
    console.log('\n--- RECHERCHE MOTS CLES ---');
    // Chercher "Modèle", "Prix", "Option", noms de bateaux connus (ex: "620")
    data.slice(0, 20).forEach((row, rIdx) => {
        row.forEach((cell, cIdx) => {
            if (!cell) return;
            const s = String(cell).toLowerCase();
            if (s.includes('modèle') || s.includes('model') || s.includes('prix') || s.includes('price') || s.includes('620') || s.includes('750')) {
                console.log(`Trouvé "${cell}" en [${rIdx}, ${cIdx}]`);
            }
        });
    });

} catch (error) {
    console.error('Erreur:', error.message);
}
