/**
 * Convertit le fichier Excel de test en JSON
 * Usage: node modules/analyse-intention/backend/scripts/convert-dataset-excel.js
 */

const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '../../../../backend/node_modules/xlsx'));

const excelPath = path.join(__dirname, '../../../../backend/source/dataset_1000_emails_entreprise_avance.xlsx');
const jsonPath = path.join(__dirname, '../../../../backend/source/dataset_1000_emails.json');

const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

const emails = rows
  .slice(1)
  .filter((row) => row[0] !== '' && row[0] != null)
  .map((row) => ({
    id: row[0],
    subject: String(row[1] || ''),
    text: String(row[2] || '')
  }));

const payload = {
  total: emails.length,
  generatedAt: new Date().toISOString(),
  emails
};

fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
console.log(`✅ ${emails.length} emails écrits dans ${jsonPath}`);
