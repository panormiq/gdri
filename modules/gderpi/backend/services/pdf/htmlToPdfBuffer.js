/**
 * FICHIER : modules/gderpi/backend/services/pdf/htmlToPdfBuffer.js
 * RÔLE : Convertit un document HTML en buffer PDF (A4).
 *
 * ENTRÉES : html string, options { format, margin }
 * SORTIES : Buffer PDF
 *
 * DÉPEND DE : resolvePuppeteer.js
 * NE PAS : chargement devis, templates métier
 *
 * APPELÉ PAR : generateDevisPdf.js
 */

const resolvePuppeteer = require('./resolvePuppeteer');

async function htmlToPdfBuffer(html, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const puppeteer = resolvePuppeteer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(String(html || ''), {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    return await page.pdf({
      format: opts.format || 'A4',
      printBackground: opts.printBackground !== false,
      preferCSSPageSize: true,
      margin: opts.margin || {
        top: '12mm',
        right: '12mm',
        bottom: '14mm',
        left: '12mm'
      }
    });
  } finally {
    await browser.close();
  }
}

module.exports = htmlToPdfBuffer;
