/**
 * FICHIER : modules/ugap/backend/services/devis/UgapDevisScopeSeed.js
 * RÔLE : Initialise le scope UGAP dans l'agent documentaire (templates + collections).
 *
 * ENTRÉES : services agent documentaire (template, model)
 * SORTIES : namespaces créés / existants
 *
 * DÉPEND DE : seeds JSON agent-documentaire/scopes/ugap/
 * NE PAS : rendu devis
 *
 * APPELÉ PAR : UgapDevisRenderService
 */

const fs = require('fs');
const path = require('path');

const SCOPE_DIR = path.join(
  __dirname,
  '../../../../../backend/modules/agent-documentaire/scopes/ugap'
);

const { DEFAULT_TEMPLATE_NAMESPACE } = require('./UgapDevisSlotBindings');

function readJsonSeed(filename) {
  const filePath = path.join(SCOPE_DIR, filename);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

async function upsertModel(modelService, seed) {
  const namespace = String(seed.namespace || '').trim();
  if (!namespace) return null;

  const existing = await modelService.getModel(namespace);
  if (existing) {
    return existing;
  }

  const collection = modelService.collection;
  const doc = {
    namespace,
    name: seed.name || namespace,
    fields: Array.isArray(seed.fields) ? seed.fields : [],
    variants: Array.isArray(seed.variants) ? seed.variants : [],
    referenceFields: [],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      scope: 'ugap'
    }
  };
  await collection.insertOne(doc);
  return doc;
}

async function ensureDevisTemplate(templateService) {
  const sectionsSeed = readJsonSeed('devis-default.sections.json');
  const jsonContent = {
    sections: sectionsSeed.sections || [],
    toc: sectionsSeed.toc || [],
    metadata: {
      title: 'Modèle devis UGAP',
      documentType: 'ugap-devis',
      scope: 'ugap'
    }
  };

  const existing = await templateService.getTemplate(DEFAULT_TEMPLATE_NAMESPACE);
  if (existing) {
    return existing;
  }

  return templateService.createDocumentTemplate(DEFAULT_TEMPLATE_NAMESPACE, jsonContent, null);
}

async function ensureUgapDevisScope() {
  let agentModule;
  try {
    agentModule = require('../../../../../backend/modules/agent-documentaire');
  } catch (error) {
    throw new Error(`Module agent-documentaire indisponible: ${error.message}`);
  }

  const templateService = agentModule.getTemplateService();
  const modelService = agentModule.getModelService();

  const ligneModel = await upsertModel(modelService, readJsonSeed('ligne-devis.model.json'));
  const moteurModel = await upsertModel(modelService, readJsonSeed('node-moteur.model.json'));
  const template = await ensureDevisTemplate(templateService);

  return {
    templateNamespace: DEFAULT_TEMPLATE_NAMESPACE,
    template,
    models: {
      ligneDevis: ligneModel?.namespace || 'ugap:ligne-devis',
      nodeMoteur: moteurModel?.namespace || 'ugap:node:moteur'
    }
  };
}

module.exports = {
  ensureUgapDevisScope,
  DEFAULT_TEMPLATE_NAMESPACE
};
