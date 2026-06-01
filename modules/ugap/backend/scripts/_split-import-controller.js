const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '../controllers/ugapController.js');
let s = fs.readFileSync(p, 'utf8');

const i0 = s.indexOf('async function importExcel(req, res) {');
const i1 = s.indexOf('async function getModels(req, res) {');
if (i0 < 0 || i1 < 0) throw new Error('import block markers missing');
s = s.slice(0, i0) + s.slice(i1);

const r0 = s.indexOf('async function reopenImportStaging(req, res) {');
const r1 = s.indexOf('// Clear uniquement le mapping');
if (r0 < 0 || r1 < 0) throw new Error('reopen block markers missing');
s = s.slice(0, r0) + s.slice(r1);

if (!s.includes('ugapImportController')) {
  s = s.replace(
    "const crypto = require('crypto');",
    "const crypto = require('crypto');\nconst ugapImportController = require('./ugapImportController');"
  );
}

const e0 = s.indexOf('module.exports = {');
const e1 = s.indexOf('};', e0) + 2;
let exp = s.slice(e0, e1);
const importKeys = [
  'importExcel', 'getImportStaging', 'listImportStaging', 'renameImportStaging',
  'validateImportModels', 'validateImportOptions', 'applyImportAssignments',
  'updateImportMinorations', 'updateImportMajorations', 'updateImportOptionsTri',
  'updateImportBaseProducts', 'publishImport', 'getImportAudit', 'reintegrateImportAuditLine',
  'reopenImportStaging'
];
importKeys.forEach((k) => {
  exp = exp.replace(new RegExp(`\\s*${k},?\\n`, 'g'), '');
});
if (!exp.includes('ugapImportController')) {
  exp = exp.replace('module.exports = {', 'module.exports = {\n  ...ugapImportController,');
}
s = s.slice(0, e0) + exp + s.slice(e1);
fs.writeFileSync(p, s);
console.log('lines', s.split('\n').length);
