/**
 * Évaluation expressions cron (5 champs) + presets.
 * Fichier : backend/core/agent-flow/CronEvaluator.js
 */

/**
 * @param {Object} triggerConfig
 * @returns {string} Expression cron "m h dom month dow"
 */
function resolveCronExpression(triggerConfig = {}) {
  const preset = triggerConfig.preset || 'custom';
  const minute = clamp(Number(triggerConfig.minute), 0, 59, 0);
  const hour = clamp(Number(triggerConfig.hour), 0, 23, 3);
  const dayOfWeek = clamp(Number(triggerConfig.dayOfWeek), 0, 6, 0);
  const dayOfMonth = clamp(Number(triggerConfig.dayOfMonth), 1, 31, 1);

  if (preset === 'daily') return `${minute} ${hour} * * *`;
  if (preset === 'weekly') return `${minute} ${hour} * * ${dayOfWeek}`;
  if (preset === 'monthly') return `${minute} ${hour} ${dayOfMonth} * *`;

  const cron = String(triggerConfig.cron || triggerConfig.schedule || '0 3 * * 0').trim();
  return cron;
}

function clamp(n, min, max, fallback) {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function matchPart(part, value) {
  if (part === '*') return true;
  if (/^\d+$/.test(part)) return Number(part) === value;

  if (part.includes(',')) {
    return part.split(',').some((p) => matchPart(p.trim(), value));
  }

  if (part.includes('-')) {
    const [a, b] = part.split('-').map((x) => Number(x.trim()));
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return value >= a && value <= b;
    }
  }

  if (part.startsWith('*/')) {
    const step = Number(part.slice(2));
    return Number.isFinite(step) && step > 0 && value % step === 0;
  }

  return false;
}

/**
 * @param {string} expression
 * @param {Date} date
 * @returns {boolean}
 */
function cronMatches(expression, date) {
  const parts = String(expression).trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const minute = date.getMinutes();
  const hour = date.getHours();
  const dom = date.getDate();
  const month = date.getMonth() + 1;
  const dow = date.getDay();

  return matchPart(parts[0], minute)
    && matchPart(parts[1], hour)
    && matchPart(parts[2], dom)
    && matchPart(parts[3], month)
    && matchPart(parts[4], dow);
}

/**
 * @param {Object} triggerConfig
 * @param {Date} [date]
 */
function shouldTriggerNow(triggerConfig, date = new Date()) {
  const expr = resolveCronExpression(triggerConfig);
  return cronMatches(expr, date);
}

/**
 * Libellé lisible pour l'UI orchestrateur.
 * @param {Object} triggerConfig
 */
function describeSchedule(triggerConfig = {}) {
  const preset = triggerConfig.preset || 'custom';
  const hour = String(triggerConfig.hour ?? 3).padStart(2, '0');
  const minute = String(triggerConfig.minute ?? 0).padStart(2, '0');
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  if (preset === 'daily') return `Tous les jours à ${hour}:${minute}`;
  if (preset === 'weekly') {
    const dow = days[triggerConfig.dayOfWeek ?? 0] || 'dimanche';
    return `Chaque ${dow} à ${hour}:${minute}`;
  }
  if (preset === 'monthly') {
    return `Le ${triggerConfig.dayOfMonth || 1} de chaque mois à ${hour}:${minute}`;
  }
  return resolveCronExpression(triggerConfig);
}

module.exports = {
  resolveCronExpression,
  cronMatches,
  shouldTriggerNow,
  describeSchedule
};
