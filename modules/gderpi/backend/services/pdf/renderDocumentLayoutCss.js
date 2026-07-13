/**
 * Espacement document et pied de page légal (RCS, capital) sur toutes les pages à l'impression.
 */

function renderDocumentLayoutCss() {
  return `
    @page { size: A4; margin: 10mm 12mm 18mm 12mm; }
    body { padding: 12px; }
    .gderpi-devis-doc__sheet {
      padding: 8mm 14mm 10mm;
    }
    .gderpi-devis-doc__header {
      gap: 16px 24px;
      margin-bottom: 16px;
      padding-bottom: 12px;
    }
    .gderpi-devis-doc__logo { max-height: 56px; }
    .gderpi-devis-doc__client { margin-top: 10px; padding: 10px 12px; }
    .gderpi-devis-doc__objet {
      margin: 0 0 14px;
      font-size: 12px;
      line-height: 1.45;
      color: #334155;
    }
    .gderpi-devis-doc__objet strong {
      color: #64748b;
      font-weight: 700;
    }
    .gderpi-devis-doc__page-footer {
      page-break-inside: avoid;
    }
    @media print {
      body { padding: 0; }
      .gderpi-devis-doc {
        box-shadow: none;
        max-width: none;
      }
      .gderpi-devis-doc__sheet {
        min-height: calc(297mm - 28mm);
        padding: 0 0 18mm;
      }
      .gderpi-devis-doc__page-footer {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 6px 12mm 0;
        background: #fff;
        border-top: 1px solid #e2e8f0;
      }
      .gderpi-devis-doc__sheet-spacer {
        min-height: 20mm;
      }
    }
  `;
}

module.exports = renderDocumentLayoutCss;
