const S = require('../UgapImportAssignmentService');
const enrich = require('./enrichMinorationLines');

const labels = [
  "Moins-value combiné NSX 3009 XDCR en remplacement de l'HDS PRO 12 fourni de base - Postes 1, 5, 6, 7 et 8",
  "Moins-value GPSMAP 1223 en remplacement de l'HDS PRO fourni de base - Postes 5 à 7",
  "Moins-value module sondeur HDS PRO 10 en remplacement de l'HDS PRO 12 fourni de base",
  "Non fourniture du moteur de base - Poste 1",
];

labels.forEach((label) => {
  const nums = S.getSortedExplicitPosteNumbersFromLabel(label);
  console.log(nums.join(',') || 'NONE', '|', label.slice(0, 55));
});

const models = Array.from({ length: 10 }, (_, i) => ({
  id: `model_${i + 5}`,
  posteNumber: i + 1,
}));

const lines = labels.map((label, i) => ({
  rowIndex: 864 + i,
  label,
  compatibleModelIds: [],
  crosses: 0,
  displayPostes: '',
}));

const out = enrich(lines, models);
out.forEach((l) => {
  console.log('OUT', l.rowIndex, 'crosses=', l.crosses, 'postes=', l.displayPostes);
});
