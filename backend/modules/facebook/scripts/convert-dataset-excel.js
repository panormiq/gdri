/**
 * Convertit le fichier Excel de test en JSON (module Facebook).
 * Usage: node backend/modules/facebook/scripts/convert-dataset-excel.js
 */

const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '../../../node_modules/xlsx'));

const dataDir = path.join(__dirname, '../data');
const excelPath = path.join(__dirname, '../../../source/dataset_1000_emails_entreprise_avance.xlsx');
const jsonPath = path.join(dataDir, 'dataset_1000_emails.json');
const legacyJsonPath = path.join(__dirname, '../../../source/dataset_1000_emails.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

const emails = rows
  .slice(1)
  .filter((row) => row[0] !== '' && row[0] != null)
  .map((row) => ({
    id: row[0],
    subject: String(row[1] || ''),
    text: String(row[2] || ''),
    categorie_attendue: String(row[3] || '').trim(),
    multi_intention: String(row[4] || '').trim().toLowerCase() === 'oui'
  }));

const payload = {
  total: emails.length,
  generatedAt: new Date().toISOString(),
  emails
};

const jsonContent = JSON.stringify(payload, null, 2);
fs.writeFileSync(jsonPath, jsonContent);
fs.writeFileSync(legacyJsonPath, jsonContent);
console.log(`✅ ${emails.length} emails écrits dans ${jsonPath}`);
