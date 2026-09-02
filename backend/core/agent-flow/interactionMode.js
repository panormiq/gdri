/**
 * FICHIER : backend/core/agent-flow/interactionMode.js
 * RÔLE : Dérive automatic | assisted selon présence d'un bloc Validation (HITL).
 */

const flowBrickRegistry = require('./FlowBrickRegistry');
const { enrichFlowApp } = require('./appSurface');

/**
 * @param {Object} flow
 * @returns {'automatic'|'assisted'}
 */
function deriveInteractionMode(flow) {
  const brickIds = collectBrickIds(flow);
  for (const id of brickIds) {
    if (id === 'validation') return 'assisted';
    const brick = flowBrickRegistry.get(id);
    if (brick && brick.interaction === 'human') return 'assisted';
  }
  return 'automatic';
}

/**
 * @param {Object} flow
 * @returns {string[]}
 */
function collectBrickIds(flow) {
  const ids = new Set();
  if (flow && flow.trigger && flow.trigger.brickId) {
    ids.add(String(flow.trigger.brickId));
  }
  const steps = Array.isArray(flow && flow.steps) ? flow.steps : [];
  for (const step of steps) {
    if (step && step.brickId) ids.add(String(step.brickId));
  }
  const nodes = flow && flow.canvas && Array.isArray(flow.canvas.nodes) ? flow.canvas.nodes : [];
  for (const node of nodes) {
    if (node && node.brickId) ids.add(String(node.brickId));
  }
  return Array.from(ids);
}

/**
 * Mode effectif affiché / badge.
 * @param {Object} flow
 * @returns {'automatic'|'assisted'}
 */
function resolveEffectiveInteractionMode(flow) {
  const explicit = flow && flow.interactionMode;
  if (explicit === 'automatic' || explicit === 'assisted') return explicit;
  return flow && flow.derivedInteractionMode
    ? flow.derivedInteractionMode
    : deriveInteractionMode(flow || {});
}

/**
 * Enrichit un flow avec derivedInteractionMode + effectiveInteractionMode.
 * @param {Object} flow
 */
function enrichFlowModes(flow) {
  if (!flow) return flow;
  const derived = deriveInteractionMode(flow);
  return enrichFlowApp({
    ...flow,
    interactionMode: flow.interactionMode || 'auto',
    derivedInteractionMode: derived,
    effectiveInteractionMode: resolveEffectiveInteractionMode({
      ...flow,
      derivedInteractionMode: derived
    }),
    imageUrl: flow.imageUrl || null
  });
}

module.exports = {
  deriveInteractionMode,
  resolveEffectiveInteractionMode,
  enrichFlowModes,
  collectBrickIds
};
