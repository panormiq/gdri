const fs = require("fs");
const path = require("path");

const rootDir = __dirname;
const tutorialHtmlPath = path.join(rootDir, "tutorial.html");
const tutorialCssPath = path.join(rootDir, "tutorial.css");
const viewerScriptPath = path.join(rootDir, "workflow-viewer.js");
const outputPath = path.join(rootDir, "tutorial-standalone.html");

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function normalizeRelativePath(value) {
  return String(value || "")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function readAsDataUrl(filePath) {
  const buffer = fs.readFileSync(filePath);
  const mime = getMimeType(filePath);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function collectJsonFiles(relativeDir) {
  const startDir = path.join(rootDir, relativeDir);
  const entries = new Map();
  if (!fs.existsSync(startDir)) return entries;

  function walk(currentDir) {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    items.forEach((item) => {
      const fullPath = path.join(currentDir, item.name);
      if (item.isDirectory()) {
        walk(fullPath);
        return;
      }
      if (!item.isFile() || !item.name.endsWith(".json")) return;
      const rel = normalizeRelativePath(toPosixPath(path.relative(rootDir, fullPath)));
      entries.set(rel, readJson(fullPath));
    });
  }

  walk(startDir);
  return entries;
}

function serializeForHtml(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function getSelectedWorkflowFromHtml(html) {
  if (!html) return "";
  const workflowSelectMatch = html.match(
    /<select[^>]*id="workflow-select"[^>]*>([\s\S]*?)<\/select>/i
  );
  if (workflowSelectMatch) {
    const selectBody = workflowSelectMatch[1];
    const selectedOptionMatch = selectBody.match(/<option[^>]*selected[^>]*value="([^"]+)"/i);
    if (selectedOptionMatch) {
      return normalizeRelativePath(selectedOptionMatch[1]);
    }
    const firstOptionMatch = selectBody.match(/<option[^>]*value="([^"]+)"/i);
    if (firstOptionMatch) {
      return normalizeRelativePath(firstOptionMatch[1]);
    }
  }
  const htmlWorkflowSrcMatch = html.match(/data-workflow-src="([^"]+)"/i);
  if (htmlWorkflowSrcMatch) {
    return normalizeRelativePath(htmlWorkflowSrcMatch[1]);
  }
  return "";
}

function getSelectedWorkflowFromArgs() {
  const args = process.argv.slice(2);
  const workflowFlagIndex = args.indexOf("--workflow");
  if (workflowFlagIndex !== -1 && args[workflowFlagIndex + 1]) {
    return normalizeRelativePath(args[workflowFlagIndex + 1]);
  }
  if (args[0] && !args[0].startsWith("-")) {
    return normalizeRelativePath(args[0]);
  }
  return "";
}

function formatHeaderTitle(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const html = fs.existsSync(tutorialHtmlPath)
  ? fs.readFileSync(tutorialHtmlPath, "utf8")
  : "";
const css = fs.readFileSync(tutorialCssPath, "utf8");
const viewerJs = fs.readFileSync(viewerScriptPath, "utf8");

const workflows = collectJsonFiles("workflows");
const blocks = collectJsonFiles("block");
const workflowRootPath = path.join(rootDir, "workflow.json");
const workflowIndexPath = path.join(rootDir, "workflows", "index.json");

if (fs.existsSync(workflowRootPath)) {
  workflows.set("workflow.json", readJson(workflowRootPath));
}

const selectedFromArgs = getSelectedWorkflowFromArgs();
const selectedFromHtml = getSelectedWorkflowFromHtml(html);
const selectedWorkflow = selectedFromArgs && workflows.has(selectedFromArgs)
  ? selectedFromArgs
  : selectedFromHtml && workflows.has(selectedFromHtml)
    ? selectedFromHtml
    : workflows.has("workflow.json")
      ? "workflow.json"
      : workflows.keys().next().value || "";

const selectedWorkflowData = selectedWorkflow
  ? workflows.get(selectedWorkflow)
  : null;
const filteredWorkflows = new Map();
if (selectedWorkflow && selectedWorkflowData) {
  filteredWorkflows.set(selectedWorkflow, selectedWorkflowData);
}

const workflowTitle = selectedWorkflowData?.name
  || selectedWorkflowData?.title
  || (selectedWorkflow ? path.basename(selectedWorkflow, ".json") : "Workflow");
const workflowHeaderTitle = formatHeaderTitle(workflowTitle) || workflowTitle;

const exportData = {
  workflows: Object.fromEntries(filteredWorkflows),
  blocks: Object.fromEntries(blocks),
  workflowIndex: [],
  settings: {
    showSubWorkflows: false
  },
  logos: {
    white: readAsDataUrl(path.join(rootDir, "assets", "logotext-white.png")),
    black: readAsDataUrl(path.join(rootDir, "assets", "logotext-black.png"))
  }
};

const extraCss = `
.page {
  max-width: 31.5cm;
  margin: 0 auto;
  padding: 24px 24px 60px;
}
.print-header {
  padding: 18px 16px 16px;
  border-radius: 16px;
  background: #0e9cef;
  color: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}
.print-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.print-header img {
  height: 64px;
  width: auto;
  display: block;
}
.print-header-guide {
  font-size: 24px;
  font-weight: 700;
}
.print-header-title {
  margin-top: 8px;
  font-size: 32px;
  font-weight: 700;
  text-align: center;
}
.print-footer {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #6b7280;
  margin-top: 24px;
}
.workflow-page {
  margin-top: 18px;
}
.workflow-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
}
.workflow-area {
  max-width: 3300px;
}
.workflow-canvas {
  height: 360px;
}
`;

const logoUrl = exportData.logos.black || "";

const htmlOutput = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Workflow Medicapp</title>
    <style>
${css}
${extraCss}
    </style>
  </head>
  <body>
    <main class="page">
      <header class="print-header">
        <div class="print-header-row">
          ${logoUrl ? `<img src="${logoUrl}" alt="Medicapp">` : "<span></span>"}
          <div class="print-header-guide">Guide</div>
        </div>
        <div class="print-header-title" id="workflow-page-title">${workflowHeaderTitle}</div>
      </header>

      <section class="workflow-page">
        <div class="workflow-area">
          <div class="workflow-main">
            <div class="workflow-toolbar">
              <button id="workflow-zoom-reset" type="button">Dezoomer</button>
            </div>
            <div class="workflow-canvas" data-workflow-index="" data-workflow-src="${selectedWorkflow}">
              <svg class="workflow-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
                    <path d="M0,0 L10,5 L0,10 Z" fill="#0e9cef"></path>
                  </marker>
                </defs>
              </svg>
              <div class="workflow-shapes"></div>
              <div class="workflow-empty hidden">
                Aucun workflow charge.
              </div>
            </div>

            <div class="brick-panel">
              <div class="brick-header">
                <h3 id="brick-title">Selectionner un element</h3>
                <div class="brick-actions">
                  <button id="brick-export-pdf" type="button" disabled>Exporter en PDF</button>
                  <button id="brick-export-json" type="button" disabled>Exporter en JSON</button>
                </div>
              </div>
              <div id="brick-content" class="brick-note">Cliquez sur un element pour afficher ses informations.</div>
            </div>
          </div>

          <aside class="workflow-outline">
            <div class="outline-header">
              <h3>Sommaire</h3>
            </div>
            <div class="outline-body">
              <p class="outline-empty">Aucun sommaire pour le moment.</p>
              <ul class="outline-list"></ul>
            </div>
          </aside>
        </div>
      </section>

      <footer class="print-footer">
        <div>Procedure Medicapp - ce document a ete cree par Medicapp Connect.</div>
      </footer>
    </main>
    <script>
      window.__WORKFLOW_EXPORT__ = ${serializeForHtml(exportData)};
    </script>
    <script>
${viewerJs}
    </script>
  </body>
</html>`;

fs.writeFileSync(outputPath, htmlOutput, "utf8");
console.log(`Generated ${outputPath}`);
