/**
 * Normalise les paramètres e-mail GDERPI (modèles par type + options globales).
 */

const { MAIL_TEMPLATE_TYPES, DEFAULTS } = require('./gderpiMailTemplateDefaults');

function normalizeTemplateBlock(raw, type) {
  const def = DEFAULTS[type] || DEFAULTS.devis;
  const d = raw && typeof raw === 'object' ? raw : {};
  return {
    subjectTemplate: String(d.subjectTemplate || def.subjectTemplate).trim() || def.subjectTemplate,
    introHtml: String(d.introHtml || def.introHtml).trim() || def.introHtml
  };
}

function normalizeDevisMailSettings(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const ttl = Number(d.linkTtlDays);
  const templatesRaw = d.templates && typeof d.templates === 'object' ? { ...d.templates } : {};

  if ((d.subjectTemplate || d.introHtml) && !templatesRaw.devis) {
    templatesRaw.devis = {
      subjectTemplate: d.subjectTemplate,
      introHtml: d.introHtml
    };
  }

  const templates = {};
  MAIL_TEMPLATE_TYPES.forEach((type) => {
    templates[type] = normalizeTemplateBlock(templatesRaw[type], type);
  });

  return {
    subjectTemplate: templates.devis.subjectTemplate,
    introHtml: templates.devis.introHtml,
    templates,
    linkTtlDays: Number.isFinite(ttl) && ttl > 0 ? Math.min(Math.round(ttl), 365) : 30,
    enableAcceptLink: d.enableAcceptLink !== false,
    ccEmetteur: d.ccEmetteur === true
  };
}

module.exports = normalizeDevisMailSettings;
