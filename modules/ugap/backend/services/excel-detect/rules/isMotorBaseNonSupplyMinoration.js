/**
 * Minoration « non fourniture du moteur de base » — le nom vient du moteur déjà extrait.
 */
function isMotorBaseNonSupplyMinoration(label) {
  return /\bnon\s+fourniture\s+(?:du|des)\s+(?:\d+\s+)?moteurs?\s+de\s+base\b/i.test(
    String(label || '')
  );
}

module.exports = isMotorBaseNonSupplyMinoration;
