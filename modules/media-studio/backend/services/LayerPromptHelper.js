/**
 * @deprecated Utiliser ObjectGenerationHelper — conservé pour compatibilité.
 */
const { wrapObjectPrompt, CHROMA_BG } = require('./ObjectGenerationHelper');

function wrapForLayer(prompt, options = {}) {
  return wrapObjectPrompt(prompt, options);
}

module.exports = { wrapForLayer, CHROMA_HINT: CHROMA_BG };
