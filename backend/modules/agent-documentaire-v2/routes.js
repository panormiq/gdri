/**
 * FICHIER : backend/modules/agent-documentaire-v2/routes.js
 * RÔLE : Routes API Agent Documentaire V2.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getTemplateService } = require('./service-container');
const HtmlRenderService = require('./services/HtmlRenderService');
const AiReviewTemplateService = require('./services/AiReviewTemplateService');
const { authenticateJWT } = require('../../config/jwt');

const aiReviewTemplateService = new AiReviewTemplateService();

const PREVIEW_PLACEHOLDERS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'seeds/ugap-preview-placeholders.json'), 'utf8')
);

function extractPreviewVariables(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  if (Object.keys(raw).some((k) => String(k).startsWith('ugap:'))) return raw;
  if (raw.variables && typeof raw.variables === 'object') return raw.variables;
  return raw;
}

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Agent Documentaire V2 OK', version: '2.0.0' });
});

router.get('/templates', async (req, res) => {
  try {
    const svc = getTemplateService();
    const scope = String(req.query.scope || '').trim();
    const filters = scope ? { scope } : {};
    const list = await svc.list(filters);
    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/templates/:namespace', async (req, res) => {
  try {
    const svc = getTemplateService();
    const doc = await svc.getByNamespace(req.params.namespace);
    if (!doc) return res.status(404).json({ success: false, error: 'Template introuvable' });
    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/templates/:namespace', async (req, res) => {
  try {
    const svc = getTemplateService();
    const saved = await svc.save(req.params.namespace, req.body || {});
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Crée un template de départ (ex. revue facture) s'il n'existe pas. */
router.post('/templates/:namespace/ensure-seed', async (req, res) => {
  try {
    const svc = getTemplateService();
    const force = !!(req.body && req.body.force);
    const saved = await svc.ensureSeedTemplate(req.params.namespace, { force });
    res.json({ success: true, data: saved, created: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Génère (ou régénère) une page de revue mail via IA, puis enregistre le template.
 * POST /templates/:namespace/generate-ai
 * body: { brief?, save?=true, entrepriseId? }
 */
router.post('/templates/:namespace/generate-ai', authenticateJWT, async (req, res) => {
  try {
    const namespace = String(req.params.namespace || '').trim();
    if (!namespace) {
      return res.status(400).json({ success: false, error: 'Namespace requis' });
    }
    const brief = String((req.body && req.body.brief) || '').trim();
    const agentContext = String((req.body && req.body.agentContext) || '').trim();
    const reviewContext = String((req.body && req.body.reviewContext) || '').trim();
    const save = !req.body || req.body.save !== false;
    const entrepriseId =
      (req.body && (req.body.entrepriseId || req.body.entityId)) ||
      (req.user && (req.user.currentEntrepriseId || req.user.entrepriseId)) ||
      null;

    const generated = await aiReviewTemplateService.generate({
      namespace,
      brief,
      agentContext,
      reviewContext,
      entrepriseId
    });

    let saved = generated.template;
    if (save) {
      const svc = getTemplateService();
      saved = await svc.save(namespace, generated.template);
    }

    res.json({
      success: true,
      data: saved,
      source: generated.source,
      iaError: generated.iaError || null,
      iaMeta: generated.iaMeta || null,
      allowedVars: generated.allowedVars,
      message:
        generated.source === 'ia'
          ? 'Page générée par IA'
          : `Page générée (modèle de secours${generated.iaError ? ` — ${generated.iaError}` : ''})`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/templates/:namespace/preview', async (req, res) => {
  try {
    const svc = getTemplateService();
    const template = req.body?.template
      ? svc.normalizeTemplate(req.body.template)
      : await svc.getByNamespace(req.params.namespace);
    if (!template) return res.status(404).json({ success: false, error: 'Template introuvable' });
    const variables = {
      ...PREVIEW_PLACEHOLDERS,
      ...extractPreviewVariables(req.body?.variables)
    };
    const html = HtmlRenderService.renderTemplate(template, variables);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
