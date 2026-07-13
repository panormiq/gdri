/**
 * Résout le modèle (sujet + intro) pour un type d'e-mail GDERPI.
 */

const { DEFAULTS } = require('./gderpiMailTemplateDefaults');

function resolveGderpiMailTemplate(settings, type) {
  const key = String(type || 'devis').trim();
  const fromTemplates = settings?.templates?.[key];
  const fallback = DEFAULTS[key] || DEFAULTS.devis;

  if (key === 'devis' && settings?.subjectTemplate && !fromTemplates) {
    return {
      subjectTemplate: settings.subjectTemplate,
      introHtml: settings.introHtml
    };
  }

  return {
    subjectTemplate: String(fromTemplates?.subjectTemplate || fallback.subjectTemplate).trim() || fallback.subjectTemplate,
    introHtml: String(fromTemplates?.introHtml || fallback.introHtml).trim() || fallback.introHtml
  };
}

module.exports = resolveGderpiMailTemplate;
