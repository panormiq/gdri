/**
 * Moteur hors-bord (tag catalogue / majo moteur) — pas d’heuristique « moteur » / « motorisation ».
 */
function isHorsBordMotorLine(label) {
  return /\bhors[\s-]?bord\b/i.test(String(label || ''));
}

module.exports = isHorsBordMotorLine;
