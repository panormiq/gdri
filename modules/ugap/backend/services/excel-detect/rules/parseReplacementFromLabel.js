/**
 * Parse remplacement : texte AVANT le mot-clé = nouvel objet, APRÈS = objet remplacé.
 */

const REPLACEMENT_KEYWORDS = [
  { name: 'en remplacement de', re: /\ben\s+remplacement\s+de\b/i },
  { name: 'en remplacement', re: /\ben\s+remplacement\b/i },
  { name: 'en lieu et place de', re: /\ben\s+lieu\s+et\s+place\s+de\b/i },
  { name: 'au lieu et place de', re: /\bau\s+lieu\s+et\s+place\s+de\b/i },
  { name: 'en lieu et place', re: /\ben\s+lieu\s+et\s+place\b/i },
  { name: 'au lieu et place', re: /\bau\s+lieu\s+et\s+place\b/i }
];

function stripPostesSuffix(text) {
  return String(text || '')
    .replace(/\s*-\s*postes?\s+[\d\s,etàa\-–—]+$/i, '')
    .replace(/\s+postes?\s+[\d\s,etàa\-–—]+$/i, '')
    .trim();
}

function stripMvPvPrefix(text) {
  return String(text || '')
    .replace(/^(moins-value|plus-value|plus\s+value)\s+/i, '')
    .trim();
}

function inferReplacedBaseFromNewObject(beforeNoPrefix, replacedSegment) {
  let initial = String(replacedSegment || '').trim();
  if (!/^cel(le|ui|les)?\s+de\s+base$/i.test(initial) && !/^ceux\s+de\s+base$/i.test(initial)) {
    return initial;
  }
  const before = String(beforeNoPrefix || '').trim();
  const head = before.match(/\b(flotteur|moteur|combin[ée]|sondeur|sonde|module|coque|console)\b/i);
  if (!head) return 'produit de base';
  let term = head[1].toLowerCase();
  if (term === 'sonde') term = 'sondeur';
  return `${term} de base`;
}

function cleanReplacedSegment(text) {
  const raw = stripPostesSuffix(
    String(text || '')
      .replace(/^(?:de\s+)?(?:l['']|la\s+|le\s+|les\s+)/i, '')
      .replace(/\s+fourni\s+de\s+base\s*$/i, '')
      .trim()
  );
  if (/^cel(le|ui|les)?\s+de\s+base$/i.test(raw) || /^ceux\s+de\s+base$/i.test(raw)) {
    return raw;
  }
  return raw;
}

function parseReplacementFromLabel(label) {
  const raw = String(label || '').replace(/\s+/g, ' ').trim();
  if (!raw) {
    return { keyword: '', newObject: '', replacedObject: '' };
  }

  const cleaned = stripPostesSuffix(raw);

  for (const kw of REPLACEMENT_KEYWORDS) {
    const match = cleaned.match(kw.re);
    if (!match || match.index == null) continue;

    const before = cleaned.slice(0, match.index).trim();
    const afterStart = match.index + match[0].length;
    const afterRaw = cleanReplacedSegment(cleaned.slice(afterStart));
    const newObject = stripMvPvPrefix(before);

    return {
      keyword: kw.name,
      newObject,
      replacedObject: inferReplacedBaseFromNewObject(newObject, afterRaw)
    };
  }

  if (/\bnon\s+fourniture\s+du\s+moteur\s+de\s+base\b/i.test(cleaned)) {
    return {
      keyword: 'non fourniture',
      newObject: 'moteur choisi',
      replacedObject: 'moteur de base'
    };
  }

  const nonSupply = cleaned.match(/^non\s+fourniture\s+(?:du|de\s+la|des|de\s+l[''])\s+(.+)$/i);
  if (nonSupply) {
    return {
      keyword: 'non fourniture',
      newObject: '',
      replacedObject: stripPostesSuffix(String(nonSupply[1] || '').trim())
    };
  }

  return { keyword: '', newObject: '', replacedObject: '' };
}

module.exports = parseReplacementFromLabel;
