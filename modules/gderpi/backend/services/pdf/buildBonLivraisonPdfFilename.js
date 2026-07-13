function buildBonLivraisonPdfFilename(bon) {
  const raw = String(bon?.numero || bon?.id || 'bl').trim();
  const safe = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'bl';
  return `bl-${safe}.pdf`;
}

module.exports = buildBonLivraisonPdfFilename;
