/**
 * Nom de bloc → namespace (slug) pour les tokens {{slug.champ}}.
 * Fichier : backend/core/agent-flow/nodeNamespace.js
 */

const { loopKeysMatch } = require('./dataTable');

function slugify(raw, fallback) {
  const s = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return s || fallback || 'bloc';
}

/** `action -to`, `{{action.to}}`, `action . to` → `action.to` */
function normalizeNsPath(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();
  s = s.replace(/\s*[-–—]\s*/g, '.').replace(/\s*\.\s*/g, '.').replace(/\s+/g, '.');
  s = s.replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
  return s;
}

function uniqueSlug(base, nodes, nodeId) {
  let slug = String(base || '').trim() || 'bloc';
  const taken = (Array.isArray(nodes) ? nodes : [])
    .filter((n) => n && n.id !== nodeId)
    .map((n) => String(n.slug || '').trim())
    .filter(Boolean);
  if (taken.indexOf(slug) === -1) return slug;
  let i = 2;
  while (taken.indexOf(`${slug}_${i}`) !== -1) i += 1;
  return `${slug}_${i}`;
}

function ensureNodeSlug(node, nodes) {
  if (!node || typeof node !== 'object') return '';
  const fallback = slugify(node.brickId || 'bloc', 'bloc');
  let slug = String(node.slug || '').trim();
  if (!slug) {
    const nm = String(node.name || '').trim();
    if (node.brickId === 'data' && (!nm || nm === 'Entrées' || nm === 'Données')) {
      slug = 'donnees';
    } else {
      slug = slugify(nm || node.brickId, node.brickId === 'data' ? 'donnees' : fallback);
    }
  }
  slug = uniqueSlug(slug, nodes, node.id);
  node.slug = slug;
  return slug;
}

function ensureAllSlugs(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  list.forEach((n) => ensureNodeSlug(n, list));
  return list;
}

function namespaceBag(previous) {
  const prev = previous && typeof previous === 'object' ? previous : {};
  return prev.__ns && typeof prev.__ns === 'object' ? prev.__ns : {};
}

function nsOrder(previous) {
  const prev = previous && typeof previous === 'object' ? previous : {};
  if (Array.isArray(prev.__nsOrder) && prev.__nsOrder.length) {
    return prev.__nsOrder.map((s) => String(s || '').trim()).filter(Boolean);
  }
  return Object.keys(namespaceBag(prev));
}

/**
 * Vue previous limitée aux namespaces d’une branche (ancêtres).
 * Les extractions parallèles sœurs ne fuient pas dans {{…}} ni dans le preview.
 */
function scopePreviousToSlugs(previous, slugs) {
  const allowed = new Set(
    (Array.isArray(slugs) ? slugs : []).map((s) => String(s || '').trim()).filter(Boolean)
  );
  const prev = previous && typeof previous === 'object' ? previous : {};
  const ns = namespaceBag(prev);
  const nextNs = {};
  const order = [];
  nsOrder(prev).forEach((slug) => {
    if (!allowed.has(slug) || !ns[slug] || nextNs[slug]) return;
    nextNs[slug] = ns[slug];
    order.push(slug);
  });
  Object.keys(ns).forEach((slug) => {
    if (!allowed.has(slug) || nextNs[slug]) return;
    nextNs[slug] = ns[slug];
    order.push(slug);
  });
  const last = order.length ? nextNs[order[order.length - 1]] : null;
  const base = last && typeof last === 'object' ? { ...last } : {};
  delete base.__ns;
  delete base.__nsOrder;
  return { ...base, __ns: nextNs, __nsOrder: order };
}

const FIELD_ALIASES = {
  body: ['body', 'response', 'text', 'message', 'texte', 'corps'],
  text: ['text', 'body', 'response', 'message', 'texte', 'corps'],
  texte: ['text', 'texte', 'body', 'corps'],
  corps: ['body', 'corps', 'text', 'texte'],
  response: ['response', 'body', 'text'],
  message: ['message', 'body', 'text', 'response'],
  from: ['from', 'expediteur', 'expéditeur', 'auteur'],
  expediteur: ['from', 'expediteur', 'auteur'],
  auteur: ['from', 'auteur', 'expediteur'],
  subject: ['subject', 'sujet'],
  sujet: ['subject', 'sujet'],
  to: ['to', 'destinataire'],
  destinataire: ['to', 'destinataire'],
  name: ['name', 'nom', 'title', 'label'],
  nom: ['name', 'nom', 'title', 'label'],
  intention: ['intention', 'intention_principale'],
  intention_principale: ['intention_principale', 'intention'],
  confiance: ['confiance', 'confidence'],
  confidence: ['confidence', 'confiance'],
  resume: ['resume', 'résumé', 'summary'],
  résumé: ['resume', 'résumé', 'summary']
};

function readFromBag(bag, pathStr) {
  if (!bag || typeof bag !== 'object') return undefined;
  const raw = String(pathStr || '').trim();
  if (!raw) return bag;
  if (raw === '__ns' || raw === '__nsOrder') return undefined;
  if (Object.prototype.hasOwnProperty.call(bag, raw)) return bag[raw];
  const parts = raw.split('.');
  let cur = bag;
  for (let i = 0; i < parts.length; i += 1) {
    if (cur == null || typeof cur !== 'object') return undefined;
    if (parts[i] in cur) {
      cur = cur[parts[i]];
      continue;
    }
    const part = parts[i];
    const aliases = FIELD_ALIASES[part]
      || FIELD_ALIASES[String(part).toLowerCase()]
      || FIELD_ALIASES[String(part).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()];
    if (i === parts.length - 1 && Array.isArray(aliases)) {
      let hit = undefined;
      for (let a = 0; a < aliases.length; a += 1) {
        if (aliases[a] in cur) {
          hit = cur[aliases[a]];
          break;
        }
      }
      if (hit !== undefined) return hit;
    }
    return undefined;
  }
  return cur;
}

function splitNsPath(pathStr, ns) {
  const raw = String(pathStr || '').trim();
  if (!raw) return null;
  const keys = Object.keys(ns || {}).sort((a, b) => b.length - a.length);
  const dot = raw.indexOf('.');
  const root = dot >= 0 ? raw.slice(0, dot) : raw;
  const rest = dot >= 0 ? raw.slice(dot + 1) : '';
  for (let i = 0; i < keys.length; i += 1) {
    const slug = keys[i];
    if (raw === slug) return { slug, rest: '' };
    if (raw.indexOf(`${slug}.`) === 0) {
      return { slug, rest: raw.slice(slug.length + 1) };
    }
    if (loopKeysMatch(root, slug)) {
      return { slug, rest };
    }
  }
  return null;
}

function isEmptyNsValue(found) {
  if (found === undefined || found === null) return true;
  if (found === '') return true;
  if (Array.isArray(found) && !found.length) return true;
  return false;
}

function readKeyInOrder(ns, order, key, skipEmpty) {
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const found = readFromBag(ns[order[i]], key);
    if (found === undefined) continue;
    if (skipEmpty && isEmptyNsValue(found)) continue;
    return found;
  }
  return undefined;
}

/**
 * Lecture uniquement dans __ns[slug]. Chemin `slug.champ` ou champ court (dernier bloc).
 * Un champ court ignore les valeurs vides des blocs récents (ex. routage.to = "")
 * pour ne pas masquer un {{champs.to}} amont.
 */
function readFromNamespaces(previous, pathStr) {
  const raw = normalizeNsPath(pathStr);
  if (!raw) return undefined;
  const ns = namespaceBag(previous);
  const order = nsOrder(previous);
  const split = splitNsPath(raw, ns);
  if (split) {
    const bag = ns[split.slug];
    if (!split.rest) return bag;
    const fromNs = readFromBag(bag, split.rest);
    if (fromNs !== undefined) return fromNs;
  }
  const direct = readKeyInOrder(ns, order, raw, true);
  if (direct !== undefined) return direct;
  if (raw.indexOf('.') === -1 && FIELD_ALIASES[raw]) {
    const aliases = FIELD_ALIASES[raw];
    for (let a = 0; a < aliases.length; a += 1) {
      if (aliases[a] === raw) continue;
      const found = readKeyInOrder(ns, order, aliases[a], true);
      if (found !== undefined && found !== '') return found;
    }
  }
  return undefined;
}

module.exports = {
  slugify,
  uniqueSlug,
  ensureNodeSlug,
  ensureAllSlugs,
  namespaceBag,
  nsOrder,
  scopePreviousToSlugs,
  splitNsPath,
  readFromBag,
  readFromNamespaces,
  normalizeNsPath,
  FIELD_ALIASES
};
