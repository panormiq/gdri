/**
 * FICHIER : backend/modules/agent-documentaire-v2/services/PdfRenderService.js
 * RÔLE : Génération PDF depuis HTML canvas (Puppeteer).
 */

const path = require('path');
const fs = require('fs');

const PUPPETEER_PATHS = [
  'puppeteer',
  path.join(__dirname, '../../agent-documentaire/node_modules/puppeteer'),
  path.join(__dirname, '../../../node_modules/puppeteer')
];

const CHROME_PATHS_WIN = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);

function loadPuppeteer() {
  let lastError = null;
  for (const candidate of PUPPETEER_PATHS) {
    try {
      return require(candidate);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `Puppeteer indisponible (${lastError?.message || 'module introuvable'}). `
    + 'Exécutez : cd backend/modules/agent-documentaire && npm install'
  );
}

function resolveExecutablePath() {
  const custom = String(process.env.PUPPETEER_EXECUTABLE_PATH || '').trim();
  if (custom && fs.existsSync(custom)) return custom;
  if (process.platform === 'win32') {
    for (const candidate of CHROME_PATHS_WIN) {
      if (candidate && fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function buildLaunchStrategies() {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-accelerated-2d-canvas',
    '--disable-features=site-per-process',
    '--font-render-hinting=none'
  ];

  const base = {
    headless: true,
    args,
    timeout: 120000,
    protocolTimeout: 180000
  };

  const executablePath = resolveExecutablePath();
  const strategies = [];

  if (executablePath) {
    strategies.push({ ...base, executablePath });
  }
  strategies.push({ ...base });
  if (process.platform === 'win32') {
    strategies.push({ ...base, channel: 'chrome' });
  }

  return strategies;
}

function optimizeHtmlForPdf(html) {
  return String(html || '')
    .replace(/background:\s*#e2e8f0/gi, 'background:#fff')
    .replace(/padding:\s*20px/gi, 'padding:0')
    .replace(/box-shadow:\s*[^;]+;/gi, '');
}

function normalizePdfError(error) {
  const msg = String(error?.message || error || 'Erreur PDF');
  if (/Target closed|TargetCloseError|Protocol error/i.test(msg)) {
    return new Error(
      'Le moteur PDF (Chrome) s\'est arrêté pendant la génération. '
      + 'Réessayez ; si le problème persiste, installez Google Chrome sur le serveur '
      + 'ou définissez PUPPETEER_EXECUTABLE_PATH.'
    );
  }
  if (/Could not find Chrome|Failed to launch|browser process/i.test(msg)) {
    return new Error(
      'Chromium/Chrome introuvable pour la génération PDF. '
      + 'Installez Google Chrome ou exécutez : cd backend/modules/agent-documentaire && npx puppeteer browsers install chrome'
    );
  }
  return error instanceof Error ? error : new Error(msg);
}

async function launchBrowser(puppeteer) {
  const strategies = buildLaunchStrategies();
  let lastError = null;
  for (const options of strategies) {
    try {
      return await puppeteer.launch(options);
    } catch (err) {
      lastError = err;
    }
  }
  throw normalizePdfError(lastError || new Error('Impossible de lancer Chrome'));
}

class PdfRenderService {
  static async generatePdfFromHtml(html, pageConfig = {}, options = {}) {
    const puppeteer = loadPuppeteer();
    let browser = null;
    let page = null;

    try {
      browser = await launchBrowser(puppeteer);
      page = await browser.newPage();
      page.setDefaultNavigationTimeout(120000);
      page.setDefaultTimeout(120000);

      await page.setViewport({
        width: 794,
        height: 1123,
        deviceScaleFactor: 1
      });

      const safeHtml = optimizeHtmlForPdf(html);
      await page.setContent(safeHtml, { waitUntil: 'load', timeout: 120000 });
      await new Promise((resolve) => setTimeout(resolve, 800));

      const margins = pageConfig.margins || {};
      const useZeroMargin = options.zeroMargin !== false;

      const pdfBytes = await page.pdf({
        format: options.format || pageConfig.format || 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        scale: 1,
        margin: useZeroMargin
          ? { top: '0', right: '0', bottom: '0', left: '0' }
          : {
            top: `${margins.top || 0}mm`,
            right: `${margins.right || 0}mm`,
            bottom: `${margins.bottom || 0}mm`,
            left: `${margins.left || 0}mm`
          }
      });

      return Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes);
    } catch (error) {
      throw normalizePdfError(error);
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (_) {
          /* ignore */
        }
      }
      if (browser) {
        try {
          await browser.close();
        } catch (_) {
          /* ignore */
        }
      }
    }
  }
}

module.exports = PdfRenderService;
