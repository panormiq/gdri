/**
 * Liste les e-mails envoyés par GDERPI (copies logicielles).
 */

const getGderpiSentEmailsCollection = require('./getGderpiSentEmailsCollection');
const {
  DOCUMENT_TYPES,
  serializeGderpiSentEmail
} = require('./gderpiMailDocumentTypes');

function matchesQuery(item, needle) {
  if (!needle) return true;
  const hay = [
    item.to,
    item.cc,
    item.from,
    item.subject,
    item.documentNumero,
    item.documentTypeLabel,
    item.snippet
  ].join(' ').toLowerCase();
  return hay.includes(needle);
}

async function listGderpiSentEmails(entrepriseId, filters = {}) {
  const type = String(filters.type || '').trim();
  const status = String(filters.status || '').trim();
  const q = String(filters.q || '').trim().toLowerCase();
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 80, 1), 200);
  const skip = Math.max(parseInt(filters.skip, 10) || 0, 0);

  const collection = await getGderpiSentEmailsCollection(entrepriseId);
  const query = { module_name: 'gderpi' };
  if (status) query.status = status;

  const docs = await collection.find(query).sort({ created_at: -1 }).limit(500).toArray();
  let items = docs.map((doc) => serializeGderpiSentEmail(doc, { includeBody: false }));

  const counts = { all: items.length };
  DOCUMENT_TYPES.forEach((t) => { counts[t.id] = 0; });
  counts.autre = 0;
  items.forEach((item) => {
    const key = item.documentType && counts[item.documentType] != null ? item.documentType : 'autre';
    counts[key] = (counts[key] || 0) + 1;
  });

  if (type && type !== 'all') {
    items = items.filter((item) => item.documentType === type);
  }
  if (q) items = items.filter((item) => matchesQuery(item, q));

  const total = items.length;
  return {
    items: items.slice(skip, skip + limit),
    total,
    counts,
    types: DOCUMENT_TYPES
  };
}

module.exports = listGderpiSentEmails;
