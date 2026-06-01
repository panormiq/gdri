/**
 * Nom moteur affichable (minoration / modèle) — segment marque ou hors-bord.
 */

const MOTOR_BRAND_RE = /\b(suzuki|mercury|yamaha|honda|evinrude|tohatsu|yanmar|volvo)\b/i;

function extractMotorNameFromLabel(label, fallbackMotorization) {
  const raw = String(label || '').replace(/\s+/g, ' ').trim();
  if (!raw) {
    return String(fallbackMotorization || '').trim();
  }

  const parts = raw.split(/\s+-\s+/);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const seg = parts[i].trim();
    if (MOTOR_BRAND_RE.test(seg) || /\bhors[\s-]?bord\b/i.test(seg)) {
      return seg;
    }
  }

  const fb = String(fallbackMotorization || '').trim();
  return fb || '';
}

module.exports = extractMotorNameFromLabel;
