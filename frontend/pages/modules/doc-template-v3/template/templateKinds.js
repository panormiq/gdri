/**
 * Un template = un modèle. Le kind est obligatoire : il choisit l’éditeur.
 * prompt → texte IA ; html → page / mail ; word → sections ; canvas → A4.
 */
export const TEMPLATE_KINDS = [
  {
    id: 'prompt',
    label: 'Prompt IA',
    description: 'Page du contrat du bloc (prompt / contexte / RAG). Sortie et données d’entrée en onglets.',
  },
  {
    id: 'html',
    label: 'HTML',
    description: 'Page HTML libre, pour un rendu web, un mail ou un export.',
  },
  {
    id: 'word',
    label: 'Word',
    description: 'Document structuré : sections, titres, import Word.',
  },
  {
    id: 'canvas',
    label: 'Canvas A4',
    description: 'Mise en page libre : facture, devis, zones et guides.',
  },
];

export const ALLOWED_TEMPLATE_KINDS = TEMPLATE_KINDS.map((k) => k.id);

import {
  assemblePromptContent,
  emptyPromptConfig,
} from './promptPresets.js?v=tpl-loop-4';

const DEFAULT_PROMPT_CFG = emptyPromptConfig();
export const DEFAULT_PROMPT_COLLECTION = {
  alias: 'prompt',
  fields: [],
};
export const DEFAULT_PROMPT_CONTENT = assemblePromptContent(DEFAULT_PROMPT_CFG);

export function normalizeTemplateKind(template) {
  const raw = String(
    (typeof template === 'string' ? template : (template && (template.kind || template.type))) || ''
  ).toLowerCase();
  if (raw === 'canvas' || raw === 'a4') return 'canvas';
  if (raw === 'html') return 'html';
  if (raw === 'prompt') return 'prompt';
  if (raw === 'word') return 'word';
  return raw && ALLOWED_TEMPLATE_KINDS.includes(raw) ? raw : 'word';
}

export function kindLabel(kind) {
  const id = normalizeTemplateKind(kind);
  const found = TEMPLATE_KINDS.find((k) => k.id === id);
  return found ? found.label : 'Word';
}

/** Chemin SPA vers l’éditeur. Le kind stocké choisit Prompt / HTML / Word ; Canvas est externe. */
export function editorPath(kind, id) {
  const k = normalizeTemplateKind(kind);
  const safeId = encodeURIComponent(String(id || ''));
  if (k === 'canvas') return null;
  return `/templates/edit/${safeId}`;
}

