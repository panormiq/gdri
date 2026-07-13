/**
 * Styles « impression économique » : noir et blanc, sans fonds colorés.
 */

function renderDocumentEconomyCss() {
  return `
    body.gderpi-doc--economy { background: #fff !important; padding: 0 !important; color: #000 !important; }
    .gderpi-doc--economy .gderpi-devis-doc { box-shadow: none !important; background: #fff !important; }
    .gderpi-doc--economy .gderpi-devis-doc__client,
    .gderpi-doc--economy .gderpi-devis-doc__objet,
    .gderpi-doc--economy .gderpi-devis-doc__notes {
      background: transparent !important;
      border: none !important;
      color: #000 !important;
    }
    .gderpi-doc--economy .gderpi-devis-doc__title { color: #000 !important; }
    .gderpi-doc--economy .gderpi-devis-doc__header { border-bottom-color: #000 !important; }
    .gderpi-doc--economy table.gderpi-devis-doc__lines th {
      background: #fff !important;
      color: #000 !important;
      border: 1px solid #000;
    }
    .gderpi-doc--economy table.gderpi-devis-doc__totals tr.gderpi-devis-doc__total-ttc td {
      border-top-color: #000 !important;
    }
    .gderpi-doc--economy .gderpi-devis-doc__footer-cgv-link { color: #000 !important; }
    .gderpi-doc--economy .gderpi-devis-doc__desc,
    .gderpi-doc--economy .gderpi-devis-doc__meta,
    .gderpi-doc--economy .gderpi-devis-doc__muted { color: #333 !important; }
    .gderpi-doc--economy img,
    .gderpi-doc--economy .gderpi-devis-doc__logo {
      filter: grayscale(100%);
      -webkit-filter: grayscale(100%);
    }
    @media print {
      body.gderpi-doc--economy { background: #fff !important; }
    }
  `;
}

module.exports = renderDocumentEconomyCss;
