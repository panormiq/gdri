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
