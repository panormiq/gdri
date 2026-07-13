/**
 * FICHIER : modules/ugap/backend/services/devis/UgapDevisRenderService.js
 * RÔLE : Orchestre la génération PDF devis UGAP via Agent Documentaire V2.
 *
 * ENTRÉES : req entreprise + payload configurateur
 * SORTIES : Buffer PDF, métadonnées document
 *
 * DÉPEND DE : UgapDataService, UgapDevisSettingsService, computeDevisPricing,
 *             buildDevisVariables, agent-documentaire-v2
 * NE PAS : routes Express
 *
 * APPELÉ PAR : ugapController.renderDevis
 */

const UgapDataService = require('../UgapDataService');
const UgapDevisSettingsService = require('../UgapDevisSettingsService');
const UgapClientsService = require('../UgapClientsService');
const { computeDevisPricing } = require('./computeDevisPricing');
const { buildDevisVariables } = require('./buildDevisVariables');
const { resolveTemplateNamespace, DEFAULT_TEMPLATE_NAMESPACE } = require('./UgapDevisSlotBindings');
const {
  optionToLine,
  buildDevisRenderTableLines,
  buildDevisDisplayTableLines,
  renderDevisTableHtml,
  columnsFromTableConfig,
  normalizeTableConfig,
  findDevisTableConfigInTemplate
} = require('./renderDevisTableHtml');
const HtmlRenderService = require('../../../../../backend/modules/agent-documentaire-v2/services/HtmlRenderService');
const PdfRenderService = require('../../../../../backend/modules/agent-documentaire-v2/services/PdfRenderService');

function getAdv2TemplateService() {
  const adv2 = require('../../../../../backend/modules/agent-documentaire-v2');
  const svc = adv2.getTemplateService();
  if (!svc) {
    throw new Error('Agent Documentaire V2 non initialisé (redémarrer le backend)');
  }
  return svc;
}

function resolveCommercial(settings, commercialId) {
  const id = String(commercialId || '').trim();
  const list = Array.isArray(settings?.commerciaux) ? settings.commerciaux : [];
  if (!id) return list.find((c) => c.actif !== false) || list[0] || null;
  return list.find((c) => c.id === id) || null;
}

async function resolveTemplateNamespaceForEntreprise(templateService, entrepriseId, db, explicitNamespace) {
  if (db) {
    const UgapDevisTemplateService = require('./UgapDevisTemplateService');
    return UgapDevisTemplateService.resolveNamespaceForRender(
      templateService,
      db,
      entrepriseId,
      explicitNamespace
    );
  }
  const scoped = resolveTemplateNamespace(entrepriseId);
  if (scoped !== DEFAULT_TEMPLATE_NAMESPACE) {
    const custom = await templateService.getByNamespace(scoped);
    if (custom) return scoped;
  }
  return DEFAULT_TEMPLATE_NAMESPACE;
}

async function resolveClientInfo(req, clientId, clientInfo) {
  if (clientInfo && typeof clientInfo === 'object' && Object.keys(clientInfo).length > 0) {
    return clientInfo;
  }
  const id = String(clientId || '').trim();
  if (!id) return clientInfo || null;
  try {
    const client = await UgapClientsService.getById(req.entrepriseDb, req.entrepriseId, id);
    return client || clientInfo || null;
  } catch (_) {
    return clientInfo || null;
  }
}

async function renderDevisPdf(req, body = {}) {
  const {
    modelId,
    configId,
    selectedOptions,
    use5Percent = true,
    clientInfo: rawClientInfo,
    clientId,
    commercialId,
    devisName
  } = body;

  const data = await UgapDataService.getData(req.entrepriseDb, req.entrepriseId);
  const pricing = computeDevisPricing(data, {
    modelId,
    selectedOptions,
    billableOptionIds: body.billableOptionIds,
    fivePercentOptions: body.fivePercentOptions,
    fivePercentCustomOptions: body.fivePercentCustomOptions,
    use5Percent,
    devisOptionCategories: body.devisOptionCategories,
    devisModelCategory: body.devisModelCategory
  });
  if (!pricing.ok) {
    const err = new Error(pricing.message || 'Erreur calcul devis');
    err.status = pricing.status || 400;
    err.violations = pricing.violations;
    throw err;
  }

  const settings = await UgapDevisSettingsService.getSettings(req.entrepriseDb, req.entrepriseId);
  const commercial = resolveCommercial(settings, commercialId);
  const clientInfo = await resolveClientInfo(req, clientId, rawClientInfo);
  const variables = buildDevisVariables({
    entrepriseInfo: settings.entrepriseInfo,
    clientInfo,
    commercial,
    pricing,
    devisName,
    devisShortName: body.devisShortName,
    entrepriseId: req.entrepriseId
  });

  const templateService = getAdv2TemplateService();
  const templateNamespace = await resolveTemplateNamespaceForEntreprise(
    templateService,
    req.entrepriseId,
    req.entrepriseDb,
    body.templateNamespace
  );
  const template = await templateService.getByNamespace(templateNamespace);
  if (!template) {
    throw new Error(`Template devis introuvable (${templateNamespace})`);
  }

  const tablePayload = {
    ...pricing.data,
    configName: String(body.configName || body.devisName || '').trim()
  };
  const showIncludedLines = body.showIncludedLines === true;
  const displayOptionIds = Array.isArray(body.displayOptionIds) ? body.displayOptionIds : [];
  const tableLines = showIncludedLines && displayOptionIds.length
    ? buildDevisDisplayTableLines(data, tablePayload, displayOptionIds, body.devisOptionCategories)
    : buildDevisRenderTableLines(tablePayload);
  const lines = tableLines.map((opt) => optionToLine(opt, opt.category));
  const tableColumns = columnsFromTableConfig(
    normalizeTableConfig(findDevisTableConfigInTemplate(template))
  );
  variables['ugap:lignes.rows'] = lines;
  variables['ugap:lignes.table'] = renderDevisTableHtml(lines, tableColumns, normalizeTableConfig(findDevisTableConfigInTemplate(template)));

  const clientLabel = variables['ugap:client.nom'] || 'Client';
  const devisNumero = variables['ugap:devis.numero'] || 'devis';
  const title = `Devis ${devisNumero} — ${clientLabel}`;

  const html = HtmlRenderService.renderTemplate(template, variables);
  const pdfBuffer = await PdfRenderService.generatePdfFromHtml(html, template.page);

  return {
    templateNamespace,
    devisNumero,
    title,
    pricing: pricing.data,
    pdfBuffer
  };
}

async function getTemplateEditorInfo(req) {
  const templateService = getAdv2TemplateService();
  const templateNamespace = await resolveTemplateNamespaceForEntreprise(
    templateService,
    req.entrepriseId,
    req.entrepriseDb
  );
  await templateService.getByNamespace(templateNamespace);

  return {
    templateNamespace,
    editorPath: '/pages/modules/document-agent-v2/editor.php'
  };
}

module.exports = {
  renderDevisPdf,
  getTemplateEditorInfo,
  getAdv2TemplateService
};
