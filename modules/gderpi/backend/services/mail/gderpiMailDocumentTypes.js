/**
 * Types de documents des e-mails GDERPI (filtre boîte d'envoi).
 */

const DOCUMENT_TYPES = [
  { id: 'devis', label: 'Devis' },
  { id: 'commande_client', label: 'Commande client' },
  { id: 'facture', label: 'Facture' },
  { id: 'avoir', label: 'Avoir' },
  { id: 'commande_fournisseur', label: 'Commande fournisseur' }
];

const ACTION_TO_TYPE = {
  send_devis: 'devis',
  send_commande_client: 'commande_client',
  send_facture: 'facture',
  send_avoir: 'avoir',
  send_commande_fournisseur: 'commande_fournisseur',
  devis_public_order_modified: 'commande_client'
};

const TYPE_SET = new Set(DOCUMENT_TYPES.map((t) => t.id));

function inferDocumentType(context) {
  const ctx = context && typeof context === 'object' ? context : {};
  if (ctx.documentType && TYPE_SET.has(String(ctx.documentType))) {
    return String(ctx.documentType);
  }
  if (ctx.action && ACTION_TO_TYPE[ctx.action]) return ACTION_TO_TYPE[ctx.action];
  if (ctx.avoirId) return 'avoir';
  if (ctx.factureId) return 'facture';
  if (ctx.commandeFournisseurId) return 'commande_fournisseur';
  if (ctx.commandeClientId) return 'commande_client';
  if (ctx.devisId) return 'devis';
  return 'autre';
}

function documentTypeLabel(type) {
  const found = DOCUMENT_TYPES.find((t) => t.id === type);
  return found ? found.label : 'Autre';
}

function resolveDocumentId(context, type) {
  const ctx = context && typeof context === 'object' ? context : {};
  if (ctx.documentId) return String(ctx.documentId);
  if (type === 'devis') return ctx.devisId ? String(ctx.devisId) : '';
  if (type === 'commande_client') return ctx.commandeClientId ? String(ctx.commandeClientId) : '';
  if (type === 'facture') return ctx.factureId ? String(ctx.factureId) : '';
  if (type === 'avoir') return ctx.avoirId ? String(ctx.avoirId) : '';
  if (type === 'commande_fournisseur') {
    return ctx.commandeFournisseurId ? String(ctx.commandeFournisseurId) : '';
  }
  return '';
}

function resolveOpenDocument(context, type) {
  const ctx = context && typeof context === 'object' ? context : {};
  if (type === 'devis') {
    return { nav: 'devis', id: ctx.devisId || ctx.documentId || '' };
  }
  if (type === 'commande_client' || type === 'facture' || type === 'avoir') {
    return { nav: type === 'commande_client' ? 'commandes' : 'facturation', id: ctx.commandeClientId || '' };
  }
  if (type === 'commande_fournisseur') {
    return { nav: 'achats', id: ctx.commandeFournisseurId || ctx.documentId || '' };
  }
  return { nav: '', id: '' };
}

function buildGderpiMailContext({ action, documentType, documentId, documentNumero, extra } = {}) {
  const type = documentType && TYPE_SET.has(documentType) ? documentType : inferDocumentType({ action, ...extra });
  return {
    action: action || undefined,
    documentType: type,
    documentId: documentId != null && String(documentId).trim() ? String(documentId).trim() : undefined,
    documentNumero: documentNumero != null && String(documentNumero).trim()
      ? String(documentNumero).trim()
      : undefined,
    ...(extra && typeof extra === 'object' ? extra : {})
  };
}

function formatFrom(from) {
  if (!from) return '';
  if (typeof from === 'string') return from;
  const name = String(from.name || '').trim();
  const email = String(from.email || '').trim();
  if (name && email) return name + ' <' + email + '>';
  return email || name;
}

function formatRecipients(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value);
}

function serializeGderpiSentEmail(doc, { includeBody = false } = {}) {
  const ctx = doc.context && typeof doc.context === 'object' ? doc.context : {};
  const documentType = inferDocumentType(ctx);
  const open = resolveOpenDocument(ctx, documentType);
  const item = {
    id: doc._id ? String(doc._id) : '',
    status: doc.status || 'pending',
    to: formatRecipients(doc.to),
    cc: formatRecipients(doc.cc),
    from: formatFrom(doc.from),
    subject: doc.subject || '',
    error: doc.error || null,
    sentAt: doc.sent_at || doc.created_at || null,
    createdAt: doc.created_at || null,
    documentType,
    documentTypeLabel: documentTypeLabel(documentType),
    documentId: resolveDocumentId(ctx, documentType),
    documentNumero: ctx.documentNumero || '',
    openNav: open.nav,
    openId: open.id,
    context: {
      action: ctx.action || '',
      devisId: ctx.devisId || '',
      commandeClientId: ctx.commandeClientId || '',
      commandeFournisseurId: ctx.commandeFournisseurId || '',
      factureId: ctx.factureId || '',
      avoirId: ctx.avoirId || ''
    }
  };
  if (includeBody) {
    item.bodyHtml = doc.body_html || '';
    item.bodyText = doc.body || '';
  } else {
    const snippet = String(doc.body || '').replace(/\s+/g, ' ').trim();
    item.snippet = snippet.length > 140 ? snippet.slice(0, 137) + '…' : snippet;
  }
  return item;
}

module.exports = {
  DOCUMENT_TYPES,
  inferDocumentType,
  documentTypeLabel,
  buildGderpiMailContext,
  serializeGderpiSentEmail
};
