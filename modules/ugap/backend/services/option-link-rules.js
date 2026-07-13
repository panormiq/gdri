/**
 * FICHIER : modules/ugap/backend/services/option-link-rules.js
 * RÔLE : Normalisation et heuristiques des règles de liaison entre options.
 */

const LINK_TYPES = new Set(['incompatibility', 'complementary', 'auto_add', 'requires', 'variant_fit', 'equivalent_base']);

function normalizeIdList(raw) {
  return [...new Set(
    (Array.isArray(raw) ? raw : [])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
  )];
}

function normalizeOptionLinkRule(rule, index = 0) {
  const source = rule && typeof rule === 'object' ? rule : {};
  const type = String(source.type || '').trim();
  const safeType = LINK_TYPES.has(type) ? type : 'requires';
  const sourceOptionIds = normalizeIdList(source.sourceOptionIds || source.optionIdsA || source.leftOptionIds);
  const targetOptionIds = normalizeIdList(source.targetOptionIds || source.optionIdsB || source.rightOptionIds);
  const id = String(source.id || '').trim()
    || `link_${safeType}_${index}_${Date.now()}`;
  return {
    id,
    type: safeType,
    sourceOptionIds,
    targetOptionIds,
    message: source.message != null ? String(source.message).trim() : '',
    label: source.label != null ? String(source.label).trim() : '',
    source: ['manual', 'heuristic', 'import_ibp', 'system'].includes(String(source.source || ''))
      ? String(source.source)
      : 'manual',
  };
}

function normalizeOptionLinkRules(rules) {
  if (!Array.isArray(rules)) return [];
  return rules
    .map((rule, index) => normalizeOptionLinkRule(rule, index))
    .filter((rule) => {
      if (rule.type === 'equivalent_base') {
        const members = normalizeIdList([...rule.sourceOptionIds, ...rule.targetOptionIds]);
        return members.length >= 2;
      }
      return rule.sourceOptionIds.length && rule.targetOptionIds.length;
    });
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function flattenCatalogOptions(categories) {
  const out = [];
  (Array.isArray(categories) ? categories : []).forEach((cat) => {
    (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
      if (opt && typeof opt === 'object') out.push(opt);
    });
  });
  return out;
}

function findOptionById(categories, optionId) {
  const oid = String(optionId || '').trim();
  if (!oid) return null;
  return flattenCatalogOptions(categories).find((opt) => String(opt?.id || '').trim() === oid) || null;
}

function scoreNameMatch(hay, needle) {
  const h = normalizeText(hay);
  const n = normalizeText(needle);
  if (!h || !n || n.length < 4) return 0;
  if (h.includes(n)) return n.length;
  return 0;
}

/** Propositions à partir des libellés (« reliée à », « pour console », « pour VHF … »). */
function suggestHeuristicLinkRules(categories) {
  const options = flattenCatalogOptions(categories);
  const byName = options.map((opt) => ({
    id: String(opt?.id || '').trim(),
    name: String(opt?.name || '').trim(),
  })).filter((row) => row.id && row.name);

  const suggestions = [];
  const seen = new Set();

  const pushSuggestion = (payload) => {
    const key = [
      payload.type,
      ...(payload.sourceOptionIds || []).sort(),
      ...(payload.targetOptionIds || []).sort(),
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push(normalizeOptionLinkRule({
      ...payload,
      id: `suggest_${suggestions.length}_${Date.now()}`,
      source: 'heuristic',
    }, suggestions.length));
  };

  byName.forEach((child) => {
    const name = child.name;

    const linkedTo = name.match(/reli[eé]e?\s+(?:à|a)\s+(?:la\s+)?(.+)$/i);
    if (linkedTo) {
      const parentHint = linkedTo[1].trim();
      const parent = byName
        .filter((row) => row.id !== child.id)
        .map((row) => ({ row, score: scoreNameMatch(row.name, parentHint) }))
        .filter((hit) => hit.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (parent) {
        pushSuggestion({
          type: 'requires',
          sourceOptionIds: [parent.row.id],
          targetOptionIds: [child.id],
          label: `${child.name} → requiert ${parent.row.name}`,
          message: `Cette option nécessite ${parent.row.name}.`,
        });
      }
    }

    const forVhf = name.match(/\bpour\s+VHF\s+([A-Za-z0-9\-]+)/i);
    if (forVhf) {
      const token = forVhf[1];
      const parent = byName
        .filter((row) => row.id !== child.id && /\bvhf\b/i.test(row.name))
        .map((row) => ({ row, score: scoreNameMatch(row.name, token) }))
        .filter((hit) => hit.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (parent) {
        pushSuggestion({
          type: 'requires',
          sourceOptionIds: [parent.row.id],
          targetOptionIds: [child.id],
          label: `${child.name} → VHF ${token}`,
          message: `Compatible avec ${parent.row.name}.`,
        });
      }
    }

    const consoleMatch = name.match(/\bconsole\s+(?:polyester\s+|alu\s+)?([A-Za-z]?\d{3,4})/i)
      || name.match(/\b(?:T-top|Arceau)[^—–-]*\b([A-Z]?\d{3,4})\b/i);
    if (consoleMatch) {
      const code = consoleMatch[1];
      const parent = byName
        .filter((row) => row.id !== child.id && /\bconsole\b/i.test(row.name))
        .map((row) => ({ row, score: scoreNameMatch(row.name, code) }))
        .filter((hit) => hit.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (parent) {
        pushSuggestion({
          type: 'variant_fit',
          sourceOptionIds: [parent.row.id],
          targetOptionIds: [child.id],
          label: `${child.name} → variante recommandée pour ${parent.row.name}`,
          message: `Variante recommandée pour ${parent.row.name}.`,
        });
      }
    }
  });

  return suggestions;
}

module.exports = {
  LINK_TYPES,
  normalizeOptionLinkRules,
  normalizeOptionLinkRule,
  suggestHeuristicLinkRules,
  flattenCatalogOptions,
  findOptionById,
};
