/**
 * Point d'entrée détection Excel UGAP (réexport fonctions).
 */

module.exports = {
  isCrossMarker: require('./isCrossMarker'),
  detectModelColumns: require('./detectModelColumns'),
  detectExcelColumns: require('./detectExcelColumns'),
  detectModels: require('./detectModels'),
  parseBaseModelLabel: require('./parseBaseModelLabel'),
  resolveImportLineKind: require('./resolveImportLineKind'),
  extractModelRecapRow: require('./extractModelRecapRow'),
  enrichMinorationLines: require('./enrichMinorationLines'),
  buildBaseOptions: require('./buildBaseOptions'),
  buildBaseOptionFromMinoration: require('./buildBaseOptionFromMinoration'),
  buildExcelDetectionReport: require('./buildExcelDetectionReport'),
  rules: {
    isPrLine: require('./rules/isPrLine'),
    isMinorationLine: require('./rules/isMinorationLine'),
    isMajorationLine: require('./rules/isMajorationLine'),
    isHorsBordMotorLine: require('./rules/isHorsBordMotorLine'),
    isMotorBaseNonSupplyMinoration: require('./rules/isMotorBaseNonSupplyMinoration'),
    parseReplacementFromLabel: require('./rules/parseReplacementFromLabel'),
    extractMotorNameFromLabel: require('./rules/extractMotorNameFromLabel')
  }
};
