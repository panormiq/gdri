const workflowCanvas = document.querySelector(".workflow-canvas");
if (workflowCanvas) {
  const workflowSvg = workflowCanvas.querySelector(".workflow-lines");
  const shapesHost = workflowCanvas.querySelector(".workflow-shapes");
  const emptyState = workflowCanvas.querySelector(".workflow-empty");
  const workflowIndex = workflowCanvas.dataset.workflowIndex || "./workflows/index.json";
  const workflowSrc = workflowCanvas.dataset.workflowSrc || "./workflow.json";
  const inlineExport = window.__WORKFLOW_EXPORT__ || null;
  const inlineWorkflows = inlineExport?.workflows
    ? new Map(Object.entries(inlineExport.workflows))
    : null;
  const inlineBlocks = inlineExport?.blocks
    ? new Map(Object.entries(inlineExport.blocks))
    : null;
  const inlineIndexPayload = inlineExport?.workflowIndex || null;
  const inlineLogos = inlineExport?.logos || null;
  const workflowSelect = document.getElementById("workflow-select");
  const workflowStorageKey = "medicapp.workflow.selected";
  const subWorkflowToggle = document.getElementById("workflow-sub-toggle");
  const workflowExportHtml = document.getElementById("workflow-export-html");
  const workflowExportHtmlCompressed = document.getElementById("workflow-export-html-compressed");
  const zoomResetButton = document.getElementById("workflow-zoom-reset");
  const brickTitle = document.getElementById("brick-title");
  const brickContent = document.getElementById("brick-content");
  const brickExportPdf = document.getElementById("brick-export-pdf");
  const brickExportJson = document.getElementById("brick-export-json");
  const workflowTabButton = document.querySelector(".tab-button[data-tab=\"workflow\"]");
  const workflowOutline = document.querySelector(".workflow-outline");
  const workflowOutlineList = workflowOutline?.querySelector(".outline-list");
  const workflowOutlineEmpty = workflowOutline?.querySelector(".outline-empty");
  let lastWorkflow = null;
  let lastSource = null;
  let shapeLookup = new Map();
  let selectedShapeId = null;
  let lastBounds = null;
  let lastContentBounds = null;
  let lastScaledShapes = new Map();
  let zoomActive = false;
  let zoomScale = 1;
  let zoomTranslate = { x: 0, y: 0 };
  let zoomMode = "none";
  let pendingZoomScale = null;
  let workflowRenderToken = 0;
  const workflowCache = new Map();
  const workflowInflight = new Map();
  const blockCache = new Map();
  const blockInflight = new Map();
  const workflowNameMap = new Map();
  const workflowFileSet = new Set();
  let showSubWorkflows = true;
  if (typeof inlineExport?.settings?.showSubWorkflows === "boolean") {
    showSubWorkflows = inlineExport.settings.showSubWorkflows;
  }
  const workflowStack = [];
  let currentBrickPayload = null;
  let currentBrickTitle = "Selectionner un element";
  let brickRenderToken = 0;
  let outlineRenderToken = 0;
  const outlineMaxDepth = 2;

  function ensureOrthogonal(points) {
    const result = [];
    points.forEach((point) => {
      if (!result.length) {
        result.push({ x: point.x, y: point.y });
        return;
      }
      const prev = result[result.length - 1];
      if (prev.x !== point.x && prev.y !== point.y) {
        result.push({ x: prev.x, y: point.y });
      }
      result.push({ x: point.x, y: point.y });
    });
    return result.filter((point, index) => {
      if (!index) return true;
      const prev = result[index - 1];
      return prev.x !== point.x || prev.y !== point.y;
    });
  }

  function getPointDistance(a, b) {
    if (!a || !b) return Infinity;
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return Infinity;
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) return Infinity;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function getConnectionLineColor(connection) {
    if (connection?.lineColor && String(connection.lineColor).trim()) {
      return connection.lineColor;
    }
    return "#0e9cef";
  }

  // Builds a stable, ASCII-only filename suffix from a title.
  function slugifyTitle(value) {
    return String(value || "brick")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "brick";
  }

  function sanitizeTextColor(value) {
    const trimmed = String(value || "").trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
      return trimmed;
    }
    return "";
  }

  function formatTutorialText(value) {
    const raw = String(value || "");
    let safe = raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    safe = safe.replace(/\[color:([^\]]+)\]([\s\S]*?)\[\/color\]/g, (match, color, content) => {
      const cleaned = sanitizeTextColor(color);
      if (!cleaned) return content;
      return `<span style="color:${cleaned}">${content}</span>`;
    });
    safe = safe.replace(/\[size:(\d{1,3})\]([\s\S]*?)\[\/size\]/g, (match, size, content) => {
      const px = Math.min(Math.max(parseInt(size, 10) || 14, 8), 72);
      return `<span style="font-size:${px}px">${content}</span>`;
    });
    safe = safe.replace(/==(.+?)==/g, "<mark>$1</mark>");
    safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, "$1<em>$2</em>");
    safe = safe.replace(/\n/g, "<br>");
    return safe;
  }

  function formatHeaderTitle(value) {
    return String(value || "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getShapeTitle(shape) {
    return shape?.text || shape?.id || "Element";
  }

  function sortShapesForOutline(shapes) {
    const items = Array.isArray(shapes) ? [...shapes] : [];
    return items.sort((a, b) => {
      if (!a || !b) return 0;
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
  }

  function getStepAnchorId(shapeId, path) {
    if (!shapeId || !Array.isArray(path) || !path.length) return "";
    return `step-${shapeId}-${path.join("-")}`;
  }

  function toggleOutlineEmpty(message) {
    if (!workflowOutlineEmpty || !workflowOutlineList) return;
    if (message) {
      workflowOutlineEmpty.textContent = message;
      workflowOutlineEmpty.classList.remove("hidden");
      workflowOutlineList.innerHTML = "";
      return;
    }
    workflowOutlineEmpty.classList.add("hidden");
  }

  function clearOutline() {
    if (!workflowOutlineList) return;
    workflowOutlineList.innerHTML = "";
    toggleOutlineEmpty("Aucun sommaire pour le moment.");
  }

  function updateOutlineActive({ shapeId, stepId } = {}) {
    if (!workflowOutlineList) return;
    workflowOutlineList
      .querySelectorAll(".outline-link.active")
      .forEach((button) => button.classList.remove("active"));
    if (stepId) {
      const stepButton = workflowOutlineList.querySelector(
        `.outline-link[data-step-id="${stepId}"]`
      );
      if (stepButton) {
        stepButton.classList.add("active");
        return;
      }
    }
    if (shapeId) {
      const shapeButton = workflowOutlineList.querySelector(
        `.outline-link[data-shape-id="${shapeId}"]`
      );
      if (shapeButton) {
        shapeButton.classList.add("active");
      }
    }
  }

  function expandDetailsToStep(stepEl) {
    let current = stepEl;
    while (current && current !== brickContent) {
      if (current.tagName === "DETAILS") {
        current.open = true;
      }
      current = current.parentElement;
    }
  }

  async function selectShapeById(shapeId, options = {}) {
    if (!shapeId) return;
    const shape = shapeLookup.get(shapeId);
    if (!shape) return;
    selectedShapeId = shapeId;
    shapesHost.querySelectorAll(".workflow-shape.selected")
      .forEach((el) => el.classList.remove("selected"));
    const node = shapesHost.querySelector(`[data-shape-id="${shapeId}"]`);
    if (node) node.classList.add("selected");
    await renderShapeDetails(shape);
    updateOutlineActive({ shapeId, stepId: options.stepId });
    if (options.scrollToStepId && brickContent) {
      const stepEl = document.getElementById(options.scrollToStepId);
      if (stepEl) {
        expandDetailsToStep(stepEl);
        stepEl.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    if (options.scrollToShape && workflowCanvas) {
      workflowCanvas.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function fetchText(path) {
    return fetch(path).then((response) => {
      if (!response.ok) {
        throw new Error("fetch_failed");
      }
      return response.text();
    });
  }

  function fetchDataUrl(path) {
    return fetch(path)
      .then((response) => {
        if (!response.ok) {
          throw new Error("fetch_failed");
        }
        return response.blob();
      })
      .then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }));
  }

  // Converts tutorial data into a JSON-friendly export payload.
  function buildTutorialExportPayload(tutorial, fallbackTitle) {
    const steps = Array.isArray(tutorial?.steps) ? tutorial.steps : [];
    return {
      title: tutorial?.title || fallbackTitle || "Element",
      intro: tutorial?.intro || "",
      steps: steps.map((step) => normalizeTutorialStep(step))
    };
  }

  // Normalizes tutorial steps to keep the exported JSON consistent.
  function normalizeTutorialStep(step) {
    const items = Array.isArray(step?.items)
      ? step.items.map((entry) => normalizeTutorialItem(entry))
      : step?.type
        ? [normalizeTutorialItem(step)]
        : [];
    const payload = {
      title: step?.title || "",
      items
    };
    if (Array.isArray(step?.substeps) && step.substeps.length) {
      payload.substeps = step.substeps.map((substep) => normalizeTutorialStep(substep));
    }
    return payload;
  }

  // Sanitizes an individual tutorial item for JSON export.
  function normalizeTutorialItem(entry) {
    if (entry?.type === "image") {
      return {
        type: "image",
        src: entry.src || "",
        widthPercent: entry.widthPercent ?? 80,
        overlays: Array.isArray(entry.overlays) ? entry.overlays : []
      };
    }
    return {
      type: entry?.type || "text",
      text: entry?.text || entry?.html || ""
    };
  }

  // Enables/disables export buttons based on whether we have content.
  function setExportButtonsEnabled(enabled) {
    if (brickExportPdf) brickExportPdf.disabled = !enabled;
    if (brickExportJson) brickExportJson.disabled = !enabled;
  }

  // Updates the current brick payload used for exports.
  function updateBrickExportState({ title, payload, hasContent }) {
    currentBrickTitle = title || "Element";
    currentBrickPayload = payload || null;
    setExportButtonsEnabled(Boolean(hasContent));
  }

  // Builds a minimal, printable HTML document for PDF export.
  function buildPrintHtml(title, contentHtml, logoUrl) {
    return `<!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            @page { margin: 12mm 12mm 20mm 12mm; }
            * { box-sizing: border-box; }
            body { font-family: "Segoe UI", Arial, sans-serif; color: #1f2933; margin: 0; padding: 16px 16px 28mm; counter-reset: page 1; }
            h1 { margin: 0 0 10px; font-size: 20px; }
            .print-header { padding: 18px 16px 16px; border-radius: 12px; background: #0e9cef; color: #ffffff; }
            .print-header-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
            .print-header img { height: 84px; width: auto; display: block; }
            .print-header-guide { font-size: 28px; font-weight: 700; }
            .print-header-title { margin-top: 8px; font-size: 36px; font-weight: 700; text-align: center; }
            .print-header + .print-body { margin-top: 10px; }
            .brick-note { color: #52606d; margin: 0 0 6px; }
            .brick-tutorial { display: grid; gap: 10px; margin-top: 4px; }
            details { border-radius: 12px; background: #ffffff; border: 1px solid #e4e9f0; overflow: hidden; }
            summary { cursor: default; font-weight: 600; padding: 12px 14px; list-style: none; background: #e6f5fd; }
            summary::-webkit-details-marker { display: none; }
            .brick-step-body { padding: 10px 14px; color: #334e68; display: grid; gap: 8px; }
            .brick-step-text { color: #334e68; line-height: 1.5; }
            .brick-step-image { position: relative; margin: 0 auto; }
            .brick-step-image img { width: 100%; max-height: 80vh; display: block; border-radius: 10px; border: 1px solid #e0e6ed; object-fit: contain; }
            .brick-overlay-layer { position: absolute; inset: 0; pointer-events: none; }
            .brick-overlay { position: absolute; border: 2px solid #ff3b30; border-radius: 6px; background: rgba(255, 59, 48, 0.05); }
            .brick-overlay.circle { border-radius: 999px; }
            .brick-overlay.pointer { border-radius: 0; clip-path: polygon(0 50%, 70% 0, 70% 30%, 100% 30%, 100% 70%, 70% 70%, 70% 100%); background: transparent; }
            .brick-substeps { margin-top: 8px; padding-left: 12px; border-left: 2px dashed rgba(14, 156, 239, 0.35); display: grid; gap: 8px; }
            details, .brick-step, .brick-substep, .brick-step-image {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .print-footer {
              position: fixed;
              left: 12mm;
              right: 12mm;
              bottom: 0mm;
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              color: #6b7280;
            }
            .print-page-number::after {
              content: counter(page);
            }
          </style>
        </head>
        <body>
          <header class="print-header">
            <div class="print-header-row">
              ${logoUrl ? `<img src="${logoUrl}" alt="Medicapp">` : "<span></span>"}
              <div class="print-header-guide">Guide</div>
            </div>
            <div class="print-header-title">${title}</div>
          </header>
          <section class="print-body">${contentHtml}</section>
          <footer class="print-footer">
            <div>Procédure Medicapp - ce document a été créé par Medicapp Connect</div>
            <div class="print-page-number">Page </div>
          </footer>
        </body>
      </html>`;
  }

  // Applies page breaks before large images to avoid splitting them.
  function applyImagePageBreaks(doc) {
    const pageHeight =
      doc.documentElement?.clientHeight || doc.body?.clientHeight || 0;
    if (!pageHeight) return;
    const images = Array.from(doc.querySelectorAll(".brick-step-image"));
    images.forEach((image) => {
      const rect = image.getBoundingClientRect();
      const offsetTop = rect.top + (doc.defaultView?.scrollY || 0);
      const positionOnPage = offsetTop % pageHeight;
      const threshold = pageHeight * 0.95;
      if (rect.height >= threshold || positionOnPage + rect.height > threshold) {
        image.style.breakBefore = "page";
        image.style.pageBreakBefore = "always";
      }
    });
  }

  // Waits for images in a document to load before printing.
  function waitForImages(doc) {
    const images = Array.from(doc?.images || []);
    if (!images.length) return Promise.resolve();
    return Promise.all(images.map((img) => (
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        })
    ))).then(() => {});
  }

  // Triggers a download for a string payload.
  function downloadTextFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function isDataImageUrl(value) {
    return typeof value === "string" && value.startsWith("data:image/");
  }

  function compressDataUrl(dataUrl, scale = 0.6, quality = 0.5) {
    return new Promise((resolve) => {
      if (!isDataImageUrl(dataUrl)) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const tryCompress = (nextScale, mime, nextQuality) => {
          const width = Math.max(1, Math.round(img.width * nextScale));
          const height = Math.max(1, Math.round(img.height * nextScale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return dataUrl;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          if (typeof nextQuality === "number") {
            return canvas.toDataURL(mime, nextQuality);
          }
          return canvas.toDataURL(mime);
        };
        const candidateJpeg = tryCompress(scale, "image/jpeg", quality);
        const candidateJpegSmall = tryCompress(0.5, "image/jpeg", 0.5);
        const candidatePng = tryCompress(scale, "image/png");
        const candidatePngSmall = tryCompress(0.5, "image/png");
        const candidates = [
          candidateJpeg,
          candidateJpegSmall,
          candidatePng,
          candidatePngSmall,
          dataUrl
        ].filter(Boolean);
        const best = candidates.reduce((smallest, current) => (
          current.length < smallest.length ? current : smallest
        ), candidates[0]);
        resolve(best || dataUrl);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function compressTutorialImagesInBlocks(blocks, options = {}) {
    const scale = Number.isFinite(options.scale) ? options.scale : 0.6;
    const quality = Number.isFinite(options.quality) ? options.quality : 0.5;
    const compressStep = async (step) => {
      const items = Array.isArray(step?.items) ? step.items : [];
      await Promise.all(items.map(async (item) => {
        if (item?.type !== "image" || !item.src) return;
        item.src = await compressDataUrl(item.src, scale, quality);
      }));
      const substeps = Array.isArray(step?.substeps) ? step.substeps : [];
      await Promise.all(substeps.map((substep) => compressStep(substep)));
    };
    await Promise.all(Object.values(blocks).map(async (block) => {
      if (block?.shape?.imageData) {
        block.shape.imageData = await compressDataUrl(block.shape.imageData, scale, quality);
      }
      const steps = Array.isArray(block?.tutorial?.steps) ? block.tutorial.steps : [];
      await Promise.all(steps.map((step) => compressStep(step)));
    }));
  }

  async function compressWorkflowImages(workflows, options = {}) {
    const scale = Number.isFinite(options.scale) ? options.scale : 0.6;
    const quality = Number.isFinite(options.quality) ? options.quality : 0.5;
    await Promise.all(Object.values(workflows).map(async (workflow) => {
      const shapes = Array.isArray(workflow?.shapes) ? workflow.shapes : [];
      await Promise.all(shapes.map(async (shape) => {
        if (!shape?.imageData) return;
        shape.imageData = await compressDataUrl(shape.imageData, scale, quality);
      }));
    }));
  }

  async function exportSelectedWorkflowHtml({ compressImages = false } = {}) {
    const selectedPath = lastSource || workflowSelect?.value || workflowSrc;
    if (!selectedPath) {
      alert("Aucun workflow selectionne.");
      return;
    }
    const workflowData = (lastWorkflow && lastSource === selectedPath)
      ? lastWorkflow
      : await fetchWorkflowSource(selectedPath);
    if (!workflowData) {
      alert("Impossible de charger le workflow selectionne.");
      return;
    }
    const workflowName =
      workflowSelect?.selectedOptions?.[0]?.textContent ||
      lastWorkflow?.name ||
      lastWorkflow?.title ||
      workflowData?.name ||
      workflowData?.title ||
      selectedPath;

    const [css, viewerScript, logoBlack, logoWhite] = await Promise.all([
      fetchText("./tutorial.css"),
      fetchText("./workflow-viewer.js"),
      fetchDataUrl("./assets/logotext-black.png").catch(() => ""),
      fetchDataUrl("./assets/logotext-white.png").catch(() => "")
    ]);
    const safeViewerScript = viewerScript.replace(/<\/script>/gi, "<\\/script>");

    const workflows = {};
    const workflowQueue = [normalizeWorkflowPath(selectedPath)];
    const visited = new Set();
    while (workflowQueue.length) {
      const currentPath = workflowQueue.shift();
      if (!currentPath || visited.has(currentPath)) continue;
      visited.add(currentPath);
      const data = currentPath === normalizeWorkflowPath(selectedPath)
        ? workflowData
        : await fetchWorkflowSource(currentPath);
      if (!data) continue;
      workflows[currentPath] = data;
      (data.shapes || []).forEach((shape) => {
        const childPath = normalizeWorkflowPath(getWorkflowPath(shape));
        if (childPath) workflowQueue.push(childPath);
      });
    }

    const blockPaths = new Set();
    Object.values(workflows).forEach((data) => {
      (data.shapes || []).forEach((shape) => {
        const blockPath = getBlockPath(shape);
        if (blockPath) blockPaths.add(blockPath);
      });
    });
    const blocks = {};
    await Promise.all(Array.from(blockPaths).map(async (blockPath) => {
      const block = await fetchBlockData(blockPath);
      if (block) {
        blocks[blockPath] = block;
      }
    }));
    if (compressImages) {
      await Promise.all([
        compressWorkflowImages(workflows, { scale: 0.6, quality: 0.5 }),
        compressTutorialImagesInBlocks(blocks, { scale: 0.6, quality: 0.5 })
      ]);
    }

    const exportData = {
      workflows,
      blocks,
      workflowIndex: [],
      settings: { showSubWorkflows: false },
      logos: { black: logoBlack, white: logoWhite }
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
  position: relative;
  height: 360px;
}
.workflow-zoom-reset {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  border: none;
  background: #0e9cef;
  color: #ffffff;
  padding: 8px 12px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.18);
}
.workflow-zoom-reset:disabled {
  opacity: 0.6;
  cursor: default;
}
.workflow-legend {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 999px;
  font-size: 12px;
  color: #1f2933;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.15);
}
.workflow-legend-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.65);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
}
    `;

    const logoTag = logoBlack
      ? `<img src="${logoBlack}" alt="Medicapp">`
      : "<span></span>";

    const workflowHeaderTitle = formatHeaderTitle(workflowName) || workflowName;
    const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${workflowHeaderTitle}</title>
    <style>
${css}
${extraCss}
    </style>
  </head>
  <body>
    <main class="page">
      <header class="print-header">
        <div class="print-header-row">
          ${logoTag}
          <div class="print-header-guide">Guide</div>
        </div>
        <div class="print-header-title">${workflowHeaderTitle}</div>
      </header>

      <section class="workflow-page">
        <div class="workflow-area">
          <div class="workflow-main">
            <div class="workflow-canvas" data-workflow-index="" data-workflow-src="${selectedPath}">
              <button id="workflow-zoom-reset" class="workflow-zoom-reset" type="button" disabled>Dezoomer</button>
              <div class="workflow-legend">
                <span class="workflow-legend-icon" aria-hidden="true">▤</span>
                <span>Double-cliquez sur un bloc avec ce pictogramme pour ouvrir le sous-workflow.</span>
              </div>
              <svg class="workflow-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
                    <path d="M0,0 L10,5 L0,10 Z" fill="#0e9cef"></path>
                  </marker>
                </defs>
              </svg>
              <div class="workflow-shapes"></div>
              <div class="workflow-empty hidden">Aucun workflow charge.</div>
            </div>

            <div class="brick-panel">
              <div class="brick-header">
                <h3 id="brick-title">Selectionner un element</h3>
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
      window.__WORKFLOW_EXPORT__ = ${JSON.stringify(exportData).replace(/</g, "\\u003c")};
    </script>
    <script>
${safeViewerScript}
    </script>
  </body>
</html>`;

    const filename = `workflow-${slugifyTitle(workflowName)}.html`;
    downloadTextFile(html, filename, "text/html");
  }

  function isArrowEnabled(connection) {
    if (!connection) return false;
    const value = connection.lineArrow;
    if (value === false || value === 0) return false;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "false" || normalized === "0" || normalized === "no") {
        return false;
      }
    }
    return true;
  }

  function isDashed(connection) {
    if (!connection) return false;
    const value = connection.lineStyle;
    if (typeof value === "string") {
      return value.trim().toLowerCase() === "dashed";
    }
    return value === "dashed";
  }

  function ensureArrowMarker(svg, color) {
    if (!svg) return "arrow";
    const markerEl = svg.querySelector("marker#arrow");
    if (color === "#0e9cef" && markerEl) {
      const markerPath = markerEl.querySelector("path");
      if (markerPath) {
        markerPath.setAttribute("fill", color);
      }
      return "arrow";
    }
    const defs = svg.querySelector("defs") || (() => {
      const defsEl = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svg.appendChild(defsEl);
      return defsEl;
    })();
    const id = `arrow-${Math.abs(hashString(color))}`;
    let marker = defs.querySelector(`marker#${id}`);
    if (!marker) {
      marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
      marker.setAttribute("id", id);
      marker.setAttribute("markerWidth", "10");
      marker.setAttribute("markerHeight", "10");
      marker.setAttribute("refX", "10");
      marker.setAttribute("refY", "5");
      marker.setAttribute("orient", "auto");
      marker.setAttribute("markerUnits", "userSpaceOnUse");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M0,0 L10,5 L0,10 Z");
      path.setAttribute("fill", color);
      marker.appendChild(path);
      defs.appendChild(marker);
    }
    return id;
  }

  function shouldUseRawPoints(start, end, points) {
    if (!points || points.length < 2) return false;
    const threshold = 18;
    const first = points[0];
    const last = points[points.length - 1];
    return (
      getPointDistance(first, start) <= threshold &&
      getPointDistance(last, end) <= threshold
    );
  }

  function getAnchorPoint(shape, target) {
    const centerX = shape.x + shape.width / 2;
    const centerY = shape.y + shape.height / 2;
    const targetX = target.x + target.width / 2;
    const targetY = target.y + target.height / 2;
    const dx = targetX - centerX;
    const dy = targetY - centerY;
    if (Math.abs(dx) > Math.abs(dy)) {
      return {
        x: dx > 0 ? shape.x + shape.width : shape.x,
        y: centerY
      };
    }
    return {
      x: centerX,
      y: dy > 0 ? shape.y + shape.height : shape.y
    };
  }

  function getAnchorPointFromAnchor(shape, anchor) {
    const offset = 0;
    switch (anchor) {
      case "tl":
        return { x: shape.x - offset, y: shape.y - offset };
      case "tr":
        return { x: shape.x + shape.width + offset, y: shape.y - offset };
      case "bl":
        return { x: shape.x - offset, y: shape.y + shape.height + offset };
      case "br":
        return { x: shape.x + shape.width + offset, y: shape.y + shape.height + offset };
      case "top":
        return { x: shape.x + shape.width / 2, y: shape.y - offset };
      case "bottom":
        return { x: shape.x + shape.width / 2, y: shape.y + shape.height + offset };
      case "left":
        return { x: shape.x - offset, y: shape.y + shape.height / 2 };
      case "right":
        return { x: shape.x + shape.width + offset, y: shape.y + shape.height / 2 };
      default:
        return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
    }
  }

  function getExitVector(start, end, anchor) {
    const fixedConnectorOffset = 20;
    if (anchor === "left") return { dx: -fixedConnectorOffset, dy: 0 };
    if (anchor === "right") return { dx: fixedConnectorOffset, dy: 0 };
    if (anchor === "top") return { dx: 0, dy: -fixedConnectorOffset };
    if (anchor === "bottom") return { dx: 0, dy: fixedConnectorOffset };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { dx: dx >= 0 ? fixedConnectorOffset : -fixedConnectorOffset, dy: 0 };
    }
    return { dx: 0, dy: dy >= 0 ? fixedConnectorOffset : -fixedConnectorOffset };
  }

  function buildFixedPoints(start, end, startAnchor, endAnchor) {
    const startVector = getExitVector(start, end, startAnchor);
    const endVector = getExitVector(end, start, endAnchor);
    const startFixed = {
      x: start.x + startVector.dx,
      y: start.y + startVector.dy
    };
    const endFixed = {
      x: end.x + endVector.dx,
      y: end.y + endVector.dy
    };
    return { startFixed, endFixed };
  }

  function buildBasePoints(start, end, startAnchor, endAnchor) {
    const { startFixed, endFixed } = buildFixedPoints(
      start,
      end,
      startAnchor,
      endAnchor
    );
    const sameRow = Math.abs(startFixed.y - endFixed.y) < 1;
    const sameCol = Math.abs(startFixed.x - endFixed.x) < 1;
    const points = [start, startFixed];
    if (sameRow) {
      points.push({ x: (startFixed.x + endFixed.x) / 2, y: startFixed.y });
    } else if (sameCol) {
      points.push({ x: startFixed.x, y: (startFixed.y + endFixed.y) / 2 });
    } else {
      points.push({ x: startFixed.x, y: endFixed.y });
    }
    points.push(endFixed, end);
    return ensureOrthogonal(points);
  }

  function buildPathWithPoints(points) {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
  }

  function getPathMidPoint(points) {
    let total = 0;
    const lengths = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      const len = Math.hypot(dx, dy);
      lengths.push(len);
      total += len;
    }
    const half = total / 2;
    let acc = 0;
    for (let i = 0; i < lengths.length; i += 1) {
      if (acc + lengths[i] >= half) {
        const ratio = (half - acc) / lengths[i];
        return {
          x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
          y: points[i].y + (points[i + 1].y - points[i].y) * ratio
        };
      }
      acc += lengths[i];
    }
    return points[Math.floor(points.length / 2)];
  }

  function clearWorkflow() {
    shapesHost.innerHTML = "";
    Array.from(workflowSvg.querySelectorAll("path, g"))
      .filter((el) => !el.closest("defs"))
      .forEach((el) => el.remove());
    shapeLookup = new Map();
  }

  function getWorkflowLabel(shape) {
    if (!shape) return "";
    if (typeof shape.workflow === "string") return shape.workflow;
    if (shape.workflow && typeof shape.workflow === "object") {
      return shape.workflow.name || shape.workflow.title || shape.workflow.path || "";
    }
    return shape.workflowName || "";
  }

  function colorWithAlpha(color, alpha) {
    if (!color || !color.startsWith("#")) return color;
    const hex = color.replace("#", "");
    if (hex.length !== 6) return color;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function getWorkflowPath(shape) {
    if (!shape) return "";
    if (typeof shape.workflow === "string") return shape.workflow;
    if (shape.workflow && typeof shape.workflow === "object") {
      const direct =
        shape.workflow.path || shape.workflow.file || shape.workflow.src || "";
      if (direct) return direct;
      const byName = workflowNameMap.get(
        shape.workflow.name || shape.workflow.title || shape.workflow.id || ""
      );
      return byName || "";
    }
    const byName = workflowNameMap.get(getWorkflowLabel(shape));
    return shape.workflowPath || byName || "";
  }

  function resolveWorkflowPath(shape) {
    const direct = getWorkflowPath(shape);
    if (!direct) return "";
    if (!workflowFileSet.size) return direct;
    if (workflowFileSet.has(direct)) return direct;
    const label = getWorkflowLabel(shape);
    return workflowNameMap.get(label) || direct;
  }

  function normalizeBlockPath(path) {
    const cleaned = String(path || "")
      .replace(/^\.\/+/, "")
      .replace(/^\/+/, "")
      .trim();
    if (!cleaned) return "";
    return cleaned.startsWith("block/") ? cleaned : `block/${cleaned}`;
  }

  function normalizeWorkflowPath(path) {
    return String(path || "")
      .replace(/^\.\/+/, "")
      .replace(/^\/+/, "")
      .trim();
  }

  async function hydrateWorkflowSubflows(data) {
    if (!data || !Array.isArray(data.shapes)) return false;
    let changed = false;
    await Promise.all(data.shapes.map(async (shape) => {
      if (shape?.workflow) return;
      const blockPath = getBlockPath(shape);
      if (!blockPath) return;
      const block = await fetchBlockData(blockPath);
      if (!block?.workflow) return;
      shape.workflow = block.workflow;
      changed = true;
    }));
    return changed;
  }

  function resolveWorkflowPathFromBlock(block) {
    if (!block?.workflow) return "";
    if (typeof block.workflow === "string") {
      const normalized = normalizeWorkflowPath(block.workflow);
      return normalized || workflowNameMap.get(block.workflow) || "";
    }
    if (typeof block.workflow === "object") {
      const direct = normalizeWorkflowPath(
        block.workflow.path || block.workflow.file || block.workflow.src || ""
      );
      if (direct) return direct;
      const name =
        block.workflow.name || block.workflow.title || block.workflow.id || "";
      return workflowNameMap.get(name) || "";
    }
    return "";
  }

  function normalizeInlinePath(path) {
    return String(path || "")
      .replace(/^\.\/+/, "")
      .replace(/^\/+/, "")
      .trim();
  }

  function getInlineWorkflow(path) {
    if (!inlineWorkflows) return null;
    const key = normalizeInlinePath(path);
    return inlineWorkflows.get(key) || null;
  }

  function getInlineBlock(path) {
    if (!inlineBlocks) return null;
    const key = normalizeBlockPath(path);
    return inlineBlocks.get(key) || null;
  }

  function getBlockPath(shape) {
    if (!shape) return "";
    const direct = normalizeBlockPath(shape.blockPath);
    if (direct) return direct;
    const category = String(shape.blockCategory || "").replace(/^\/+|\/+$/g, "");
    let fileName = String(shape.blockFileName || "").replace(/^\/+|\/+$/g, "");
    if (!fileName) return "";
    if (!fileName.endsWith(".json")) {
      fileName += ".json";
    }
    return normalizeBlockPath(category ? `${category}/${fileName}` : fileName);
  }

  async function fetchBlockData(path) {
    if (!path) return null;
    const inlineBlock = getInlineBlock(path);
    if (inlineBlock) return inlineBlock;
    if (blockInflight.has(path)) return blockInflight.get(path);
    const promise = fetch(path, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((data) => {
        blockCache.set(path, data);
        blockInflight.delete(path);
        return data;
      });
    blockInflight.set(path, promise);
    return promise;
  }

  async function fetchWorkflowData(path) {
    if (!path) return null;
    if (workflowCache.has(path)) return workflowCache.get(path);
    if (workflowInflight.has(path)) return workflowInflight.get(path);
    const promise = fetchWorkflowSource(path)
      .catch(() => null)
      .then((data) => {
        workflowCache.set(path, data);
        workflowInflight.delete(path);
        return data;
      });
    workflowInflight.set(path, promise);
    return promise;
  }

  async function fetchWorkflowSource(path) {
    const inlineWorkflow = getInlineWorkflow(path);
    if (inlineWorkflow) {
      return inlineWorkflow;
    }
    const response = await fetch(path);
    if (response.ok) {
      return response.json();
    }
    return null;
  }

  function renderMiniWorkflow(host, data) {
    if (!host) return;
    host.innerHTML = "";
    if (!data || !Array.isArray(data.shapes) || !data.shapes.length) {
      const note = document.createElement("div");
      note.className = "mini-empty";
      note.textContent = "Workflow introuvable";
      host.appendChild(note);
      return;
    }
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) {
      requestAnimationFrame(() => renderMiniWorkflow(host, data));
      return;
    }
    const padding = 6;
    const maxX = Math.max(...data.shapes.map((shape) => shape.x + shape.width), 1);
    const maxY = Math.max(...data.shapes.map((shape) => shape.y + shape.height), 1);
    const scaleX = (width - padding * 2) / maxX;
    const scaleY = (height - padding * 2) / maxY;
    const scale = Math.min(scaleX, scaleY, 1);

    const scaledShapes = new Map();
    data.shapes.forEach((shape) => {
      scaledShapes.set(shape.id, {
        ...shape,
        x: shape.x * scale + padding,
        y: shape.y * scale + padding,
        width: shape.width * scale,
        height: shape.height * scale
      });
    });

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("shape-mini-lines");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    host.appendChild(svg);

    (data.connections || []).forEach((connection) => {
      const from = scaledShapes.get(connection.from);
      const to = scaledShapes.get(connection.to);
      if (!from || !to) return;
      const lineColor = getConnectionLineColor(connection);
      const start = connection.startAnchor
        ? getAnchorPointFromAnchor(from, connection.startAnchor)
        : getAnchorPoint(from, to);
      const end = connection.endAnchor
        ? getAnchorPointFromAnchor(to, connection.endAnchor)
        : getAnchorPoint(to, from);
      const basePoints = buildBasePoints(
        start,
        end,
        connection.startAnchor,
        connection.endAnchor
      );
      const points = ensureOrthogonal(basePoints);
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", buildPathWithPoints(points));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", lineColor || "rgba(31, 41, 51, 0.5)");
      path.setAttribute("stroke-width", "1.5");
      if (isDashed(connection)) {
        path.setAttribute("stroke-dasharray", "4 3");
      }
      svg.appendChild(path);
    });

    data.shapes.forEach((shape) => {
      const scaled = scaledShapes.get(shape.id);
      if (!scaled) return;
      const node = document.createElement("div");
      node.className = `mini-shape ${shape.type || "rect"}`;
      node.style.left = `${scaled.x}px`;
      node.style.top = `${scaled.y}px`;
      node.style.width = `${scaled.width}px`;
      node.style.height = `${scaled.height}px`;
      node.style.opacity = shape.opacity ?? 1;
      node.style.background = shape.bgColor || "rgba(14, 156, 239, 0.4)";
      if (shape.type === "logo" && shape.imageData) {
        node.style.backgroundImage = `url(${shape.imageData})`;
        node.style.backgroundSize = "contain";
        node.style.backgroundRepeat = "no-repeat";
        node.style.backgroundPosition = "center";
        node.style.backgroundColor = "#ffffff";
      }
      host.appendChild(node);
    });
  }

  function applyZoomTransform() {
    if (!workflowSvg || !shapesHost) return;
    if (!zoomActive) {
      workflowSvg.style.transform = "";
      shapesHost.style.transform = "";
      return;
    }
    const transform = `translate(${zoomTranslate.x}px, ${zoomTranslate.y}px) scale(${zoomScale})`;
    workflowSvg.style.transform = transform;
    shapesHost.style.transform = transform;
  }

  function setZoomCentered(scale) {
    if (!lastBounds) return;
    const content = lastContentBounds || {
      width: lastBounds.width,
      height: lastBounds.height
    };
    const fitScale = Math.min(
      lastBounds.width / content.width,
      lastBounds.height / content.height,
      1.5
    );
    zoomScale = Math.min(scale, fitScale);
    const contentWidth = content.width * zoomScale;
    const contentHeight = content.height * zoomScale;
    const centerX = (lastBounds.width - contentWidth) / 2;
    const centerY = (lastBounds.height - contentHeight) / 2;
    const minX = Math.min(0, lastBounds.width - contentWidth);
    const minY = Math.min(0, lastBounds.height - contentHeight);
    zoomTranslate = {
      x: Math.min(0, Math.max(centerX, minX)),
      y: Math.min(0, Math.max(centerY, minY))
    };
    zoomActive = true;
    zoomMode = "center";
    applyZoomTransform();
    if (zoomResetButton) {
      zoomResetButton.disabled = false;
    }
  }

  function resetZoom() {
    zoomActive = false;
    zoomMode = "none";
    zoomScale = 1;
    zoomTranslate = { x: 0, y: 0 };
    applyZoomTransform();
    if (zoomResetButton) {
      zoomResetButton.disabled = true;
    }
  }

  function zoomToShape(shapeId) {
    if (!shapeId || !lastBounds) return;
    const shape = lastScaledShapes.get(shapeId);
    if (!shape) return;
    zoomScale = 1.8;
    const centerX = shape.x + shape.width / 2;
    const centerY = shape.y + shape.height / 2;
    zoomTranslate = {
      x: lastBounds.width / 2 - centerX * zoomScale,
      y: lastBounds.height / 2 - centerY * zoomScale
    };
    zoomActive = true;
    zoomMode = "shape";
    applyZoomTransform();
    if (zoomResetButton) {
      zoomResetButton.disabled = false;
    }
  }

  function selectWorkflowByPath(path) {
    if (!workflowSelect || !path) return;
    const option = Array.from(workflowSelect.options)
      .find((entry) => entry.value === path);
    if (option) {
      workflowSelect.value = path;
    }
  }

  function readStoredWorkflow() {
    try {
      return localStorage.getItem(workflowStorageKey) || "";
    } catch (error) {
      return "";
    }
  }

  function storeWorkflow(path) {
    try {
      if (!path) return;
      localStorage.setItem(workflowStorageKey, path);
    } catch (error) {
      // ignore storage failures
    }
  }

  async function renderShapeDetails(shape) {
    if (!brickTitle || !brickContent) return;
    const title = shape.text || shape.id || "Element";
    const blockPath = getBlockPath(shape);
    if (!blockPath && shape.tutorial) {
      renderTutorialDetails(shape.tutorial, title, shape.id);
      return;
    }
    if (!blockPath) {
      brickTitle.textContent = title;
      brickContent.innerHTML = `<p class="brick-note">${title}</p>`;
      updateBrickExportState({
        title,
        payload: { title, content: title },
        hasContent: true
      });
      return;
    }
    const token = ++brickRenderToken;
    brickTitle.textContent = title;
    brickContent.innerHTML =
      "<p class=\"brick-note\">Chargement du block...</p>";
    updateBrickExportState({ title, payload: null, hasContent: false });
    const block = await fetchBlockData(blockPath);
    if (token !== brickRenderToken) return;
    if (block?.tutorial) {
      const fallbackTitle = block.tutorial.title || block.name || title;
      renderTutorialDetails(block.tutorial, fallbackTitle, shape.id);
      return;
    }
    if (shape.tutorial) {
      renderTutorialDetails(shape.tutorial, title, shape.id);
      return;
    }
    brickTitle.textContent = title;
    brickContent.innerHTML =
      "<p class=\"brick-note\">Aucun contenu de block disponible.</p>";
    updateBrickExportState({ title, payload: null, hasContent: false });
  }

  function clearSelection() {
    selectedShapeId = null;
    shapesHost?.querySelectorAll(".workflow-shape.selected")
      .forEach((el) => el.classList.remove("selected"));
    updateOutlineActive({});
    if (brickTitle) {
      brickTitle.textContent = "Selectionner un element";
    }
    if (brickContent) {
      brickContent.innerHTML =
        "<div class=\"brick-note\">Cliquez sur un element pour afficher ses informations.</div>";
    }
    updateBrickExportState({
      title: "Selectionner un element",
      payload: null,
      hasContent: false
    });
  }

  function renderTutorialDetails(tutorial, fallbackTitle, shapeId) {
    brickTitle.textContent = tutorial.title || fallbackTitle;
    brickContent.innerHTML = "";
    if (tutorial.intro) {
      const intro = document.createElement("p");
      intro.className = "brick-note";
      intro.textContent = tutorial.intro;
      brickContent.appendChild(intro);
    }
    const steps = Array.isArray(tutorial.steps) ? tutorial.steps : [];
    if (!steps.length) {
      return;
    }
    const list = document.createElement("div");
    list.className = "brick-tutorial";
    steps.forEach((step, index) => {
      renderTutorialStep(step, index, list, 0, shapeId, [index + 1]);
    });
    brickContent.appendChild(list);
    updateBrickExportState({
      title: tutorial.title || fallbackTitle,
      payload: buildTutorialExportPayload(tutorial, fallbackTitle),
      hasContent: true
    });
  }

  function renderTutorialStep(step, index, host, depth, shapeId, path) {
    const details = document.createElement("details");
    details.className = depth === 0 ? "brick-step" : "brick-substep";
    const summary = document.createElement("summary");
    summary.textContent = step.title || `Etape ${index + 1}`;
    details.appendChild(summary);
    const stepId = getStepAnchorId(shapeId, path);
    if (stepId) {
      details.id = stepId;
    }

    const body = document.createElement("div");
    body.className = "brick-step-body";
    const items = Array.isArray(step.items)
      ? step.items
      : step.type
        ? [step]
        : [];

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "brick-note";
      empty.textContent = "Aucun contenu dans cette etape.";
      body.appendChild(empty);
    } else {
      items.forEach((entry) => {
        if (entry.type === "image") {
          if (!entry.src) {
            const empty = document.createElement("p");
            empty.className = "brick-note";
            empty.textContent = "Capture manquante pour cette etape.";
            body.appendChild(empty);
            return;
          }
          const imageWrap = document.createElement("div");
          imageWrap.className = "brick-step-image";
          imageWrap.style.width = `${entry.widthPercent || 80}%`;
          const img = document.createElement("img");
          img.src = entry.src || "";
          imageWrap.appendChild(img);
          const overlayLayer = document.createElement("div");
          overlayLayer.className = "brick-overlay-layer";
          (entry.overlays || []).forEach((overlay) => {
            const overlayEl = document.createElement("div");
            overlayEl.className = `brick-overlay ${overlay.type || "rect"}`;
            overlayEl.style.left = `${overlay.x || 0}%`;
            overlayEl.style.top = `${overlay.y || 0}%`;
            overlayEl.style.width = `${overlay.width || 10}%`;
            overlayEl.style.height = `${overlay.height || 10}%`;
            overlayEl.style.borderColor = overlay.color || "#ff3b30";
            overlayLayer.appendChild(overlayEl);
          });
          imageWrap.appendChild(overlayLayer);
          body.appendChild(imageWrap);
        } else {
          const text = document.createElement("div");
          text.className = "brick-step-text";
          text.innerHTML = formatTutorialText(entry.text || entry.html || "");
          body.appendChild(text);
        }
      });
    }

    if (Array.isArray(step.substeps) && step.substeps.length) {
      const sublist = document.createElement("div");
      sublist.className = "brick-substeps";
      step.substeps.forEach((substep, subIndex) => {
        renderTutorialStep(
          substep,
          subIndex,
          sublist,
          depth + 1,
          shapeId,
          [...path, subIndex + 1]
        );
      });
      body.appendChild(sublist);
    }

    details.appendChild(body);
    host.appendChild(details);
  }

  function createOutlineButton(label, options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `outline-link${options.secondary ? " secondary" : ""}`;
    button.textContent = label;
    if (options.shapeId) button.dataset.shapeId = options.shapeId;
    if (options.stepId) button.dataset.stepId = options.stepId;
    if (options.workflowPath) button.dataset.workflowPath = options.workflowPath;
    return button;
  }

  function appendTutorialOutlineSteps(steps, host, shapeId, workflowPath, pathPrefix) {
    if (!Array.isArray(steps) || !steps.length) return;
    steps.forEach((step, index) => {
      const path = [...pathPrefix, index + 1];
      const title = step?.title || `Etape ${index + 1}`;
      const item = document.createElement("li");
      const button = createOutlineButton(title, {
        secondary: true,
        shapeId,
        stepId: getStepAnchorId(shapeId, path),
        workflowPath
      });
      item.appendChild(button);
      if (Array.isArray(step?.substeps) && step.substeps.length) {
        const sublist = document.createElement("ul");
        sublist.className = "outline-sublist";
        appendTutorialOutlineSteps(step.substeps, sublist, shapeId, workflowPath, path);
        item.appendChild(sublist);
      }
      host.appendChild(item);
    });
  }

  async function buildOutlineForWorkflowData(data, host, depth, workflowPath, visited) {
    if (!data || !Array.isArray(data.shapes) || !host) return;
    const shapes = sortShapesForOutline(data.shapes);
    await Promise.all(shapes.map(async (shape) => {
      const item = document.createElement("li");
      const title = getShapeTitle(shape);
      const button = createOutlineButton(title, {
        shapeId: shape.id,
        workflowPath
      });
      item.appendChild(button);
      const sublist = document.createElement("ul");
      sublist.className = "outline-sublist";

      const blockPath = getBlockPath(shape);
      const blockData = blockPath ? await fetchBlockData(blockPath) : null;
      const tutorial = blockData?.tutorial || shape?.tutorial || null;
      if (tutorial?.steps?.length) {
        appendTutorialOutlineSteps(tutorial.steps, sublist, shape.id, workflowPath, []);
      }

      const childWorkflowPath = resolveWorkflowPath(shape)
        || resolveWorkflowPathFromBlock(blockData);
      if (childWorkflowPath) {
        const childLabel = formatHeaderTitle(getWorkflowLabel(shape)) || "Sous workflow";
        const childItem = document.createElement("li");
        const childButton = createOutlineButton(`Sous workflow: ${childLabel}`, {
          secondary: true,
          workflowPath: childWorkflowPath
        });
        childItem.appendChild(childButton);
        if (depth < outlineMaxDepth && !visited.has(childWorkflowPath)) {
          visited.add(childWorkflowPath);
          const childList = document.createElement("ul");
          childList.className = "outline-sublist";
          const childData = await fetchWorkflowData(childWorkflowPath);
          if (childData?.shapes?.length) {
            await buildOutlineForWorkflowData(
              childData,
              childList,
              depth + 1,
              childWorkflowPath,
              visited
            );
            childItem.appendChild(childList);
          }
        }
        sublist.appendChild(childItem);
      }

      if (sublist.childElementCount) {
        item.appendChild(sublist);
      }
      host.appendChild(item);
    }));
  }

  async function buildWorkflowOutline(data, workflowPath) {
    if (!workflowOutlineList) return;
    const renderToken = ++outlineRenderToken;
    workflowOutlineList.innerHTML = "";
    if (!data || !Array.isArray(data.shapes) || !data.shapes.length) {
      toggleOutlineEmpty("Aucun sommaire pour le moment.");
      return;
    }
    toggleOutlineEmpty("");
    const visited = new Set();
    if (workflowPath) visited.add(workflowPath);
    await buildOutlineForWorkflowData(data, workflowOutlineList, 0, workflowPath, visited);
    if (renderToken !== outlineRenderToken) return;
  }

  async function navigateToOutlineTarget({ workflowPath, shapeId, stepId } = {}) {
    if (!workflowPath) {
      await selectShapeById(shapeId, {
        scrollToStepId: stepId,
        stepId,
        scrollToShape: true
      });
      return;
    }
    if (workflowPath !== lastSource) {
      if (lastSource && lastSource !== workflowPath) {
        workflowStack.push(lastSource);
      }
      pendingZoomScale = 1.5;
      selectWorkflowByPath(workflowPath);
      await loadWorkflow(workflowPath);
    }
    if (shapeId) {
      await selectShapeById(shapeId, {
        scrollToStepId: stepId,
        stepId,
        scrollToShape: true
      });
      return;
    }
    if (workflowCanvas) {
      workflowCanvas.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function renderWorkflow(data) {
    clearWorkflow();
    if (!data || !Array.isArray(data.shapes) || !data.shapes.length) {
      emptyState.classList.remove("hidden");
      clearOutline();
      return;
    }
    emptyState.classList.add("hidden");

    const bounds = workflowCanvas.getBoundingClientRect();
    lastBounds = bounds;
    const paddingX = 30;
    const paddingTop = 50;
    const paddingBottom = 50;
    const minX = Math.min(...data.shapes.map((shape) => shape.x));
    const minY = Math.min(...data.shapes.map((shape) => shape.y));
    const maxX = Math.max(...data.shapes.map((shape) => shape.x + shape.width), 1);
    const maxY = Math.max(...data.shapes.map((shape) => shape.y + shape.height), 1);
    const contentWidthRaw = Math.max(maxX - minX, 1);
    const contentHeightRaw = Math.max(maxY - minY, 1);
    const scaleX = (bounds.width - paddingX * 2) / contentWidthRaw;
    const scaleY = (bounds.height - paddingTop - paddingBottom) / contentHeightRaw;
    const scale = Math.min(scaleX, scaleY, 1);
    const contentWidth = contentWidthRaw * scale;
    const contentHeight = contentHeightRaw * scale;
    const offsetX = Math.max(paddingX, (bounds.width - contentWidth) / 2);
    const offsetY = Math.max(paddingTop, (bounds.height - contentHeight) / 2);
    lastContentBounds = {
      width: contentWidth + offsetX * 2,
      height: contentHeight + paddingTop + paddingBottom
    };

    const scaledShapes = new Map();
    workflowRenderToken += 1;
    const renderToken = workflowRenderToken;

    data.shapes.forEach((shape) => {
      const scaled = {
        ...shape,
        x: (shape.x - minX) * scale + offsetX,
        y: (shape.y - minY) * scale + offsetY,
        width: shape.width * scale,
        height: shape.height * scale
      };
      scaledShapes.set(shape.id, scaled);
      shapeLookup.set(shape.id, shape);

      const node = document.createElement("div");
      node.className = `workflow-shape ${shape.type || "rect"}`;
      node.dataset.shapeId = shape.id;
      node.style.left = `${scaled.x}px`;
      node.style.top = `${scaled.y}px`;
      node.style.width = `${scaled.width}px`;
      node.style.height = `${scaled.height}px`;
      node.style.opacity = shape.opacity ?? 1;
      if (shape.bgColor) {
        node.style.background = shape.bgColor;
      }
      if (shape.textColor) {
        node.style.color = shape.textColor;
      }
      if (shape.type === "logo" && shape.imageData) {
        node.style.backgroundImage = `url(${shape.imageData})`;
        node.style.backgroundSize = "contain";
        node.style.backgroundRepeat = "no-repeat";
        node.style.backgroundPosition = "center";
        node.style.backgroundColor = "#ffffff";
      }

      const textEl = document.createElement("div");
      textEl.className = "shape-text";
      textEl.textContent = shape.text || "";
      if (shape.type === "logo" && !shape.text) {
        textEl.style.display = "none";
      }
      node.appendChild(textEl);
      const workflowPath = resolveWorkflowPath(shape);
      const applyWorkflowDecoration = (path) => {
        if (!path) return;
        node.classList.add("has-workflow");
        if (shape.bgColor) {
          node.style.background = colorWithAlpha(shape.bgColor, 0.7);
        }
        if (showSubWorkflows) {
          node.classList.add("has-mini");
          const mini = document.createElement("div");
          mini.className = "shape-mini";
          node.appendChild(mini);
          fetchWorkflowData(path).then((workflowData) => {
            if (renderToken !== workflowRenderToken) return;
            if (!node.isConnected) return;
            renderMiniWorkflow(mini, workflowData);
          });
        }
      };
      if (workflowPath) {
        applyWorkflowDecoration(workflowPath);
      } else {
        const blockPath = getBlockPath(shape);
        if (blockPath) {
          fetchBlockData(blockPath).then((block) => {
            if (renderToken !== workflowRenderToken) return;
            const blockWorkflowPath = resolveWorkflowPathFromBlock(block);
            applyWorkflowDecoration(blockWorkflowPath);
          });
        }
      }
      if (shape.id === selectedShapeId) {
        node.classList.add("selected");
      }
      shapesHost.appendChild(node);
    });

    lastScaledShapes = scaledShapes;

    const svgWidth = bounds.width;
    const svgHeight = bounds.height;
    workflowSvg.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);

    (data.connections || []).forEach((connection) => {
      const from = scaledShapes.get(connection.from);
      const to = scaledShapes.get(connection.to);
      if (!from || !to) return;
      const lineColor = getConnectionLineColor(connection);
      const start = connection.startAnchor
        ? getAnchorPointFromAnchor(from, connection.startAnchor)
        : getAnchorPoint(from, to);
      const end = connection.endAnchor
        ? getAnchorPointFromAnchor(to, connection.endAnchor)
        : getAnchorPoint(to, from);
      const basePoints = buildBasePoints(
        start,
        end,
        connection.startAnchor,
        connection.endAnchor
      );
      const rawPoints = Array.isArray(connection.points) && connection.points.length >= 2
        ? connection.points
        : basePoints;
      const scaledRawPoints = Array.isArray(rawPoints)
        ? rawPoints.map((point) => ({
            x: (point.x - minX) * scale + offsetX,
            y: (point.y - minY) * scale + offsetY
          }))
        : [];
      const normalizedRawPoints = ensureOrthogonal(scaledRawPoints);
      const points = shouldUseRawPoints(start, end, normalizedRawPoints)
        ? normalizedRawPoints
        : basePoints;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", buildPathWithPoints(points));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", lineColor);
      path.setAttribute("stroke-width", "2");
      if (isDashed(connection)) {
        path.setAttribute("stroke-dasharray", "6 4");
      }
      if (isArrowEnabled(connection)) {
        const markerId = ensureArrowMarker(workflowSvg, lineColor);
        path.setAttribute("marker-end", `url(#${markerId})`);
      }
      workflowSvg.appendChild(path);

      if (connection.label && String(connection.label).trim()) {
        const mid = getPathMidPoint(points);
        const labelGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", String(mid.x + (connection.labelDx || 0)));
        label.setAttribute("y", String(mid.y + (connection.labelDy || 0)));
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("dominant-baseline", "middle");
        label.setAttribute("fill", connection.labelTextColor || "#1f2933");
        label.textContent = connection.label;
        labelGroup.appendChild(label);
        workflowSvg.appendChild(labelGroup);
      }
    });

    if (pendingZoomScale) {
      setZoomCentered(pendingZoomScale);
      pendingZoomScale = null;
      return;
    }
    if (
      zoomActive &&
      zoomMode === "shape" &&
      selectedShapeId &&
      !lastScaledShapes.has(selectedShapeId)
    ) {
      resetZoom();
    } else {
      applyZoomTransform();
    }
  }

  function normalizeIndexPayload(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.workflows)) return payload.workflows;
    return [];
  }

  function normalizeWorkflowEntry(entry, index) {
    if (!entry) return null;
    if (typeof entry === "string") {
      return { id: `workflow-${index}`, name: entry, file: entry };
    }
    if (typeof entry === "object") {
      const name = entry.name || entry.title || entry.id || `Workflow ${index + 1}`;
      const file = entry.file || entry.path || entry.src;
      if (!file) return null;
      return { id: entry.id || `workflow-${index}`, name, file };
    }
    return null;
  }

  function populateSelect(entries) {
    if (!workflowSelect) return;
    workflowSelect.innerHTML = "";
    if (!entries.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Aucun workflow";
      workflowSelect.appendChild(option);
      workflowSelect.disabled = true;
      return;
    }
    workflowSelect.disabled = false;
    entries.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.file;
      option.textContent = entry.name;
      workflowSelect.appendChild(option);
    });
  }

  async function loadWorkflow(source) {
    try {
      const data = await fetchWorkflowSource(source);
      if (!data) {
        throw new Error("workflow_not_found");
      }
      await hydrateWorkflowSubflows(data);
      lastWorkflow = data;
      lastSource = source;
      renderWorkflow(data);
      buildWorkflowOutline(data, source);
    } catch (error) {
      clearWorkflow();
      clearOutline();
      if (emptyState) {
        emptyState.textContent = `Impossible de charger ${source}.`;
      }
      emptyState.classList.remove("hidden");
    }
  }

  async function loadWorkflowIndex() {
    try {
      const payload = inlineIndexPayload || await (async () => {
        const response = await fetch(workflowIndex);
        if (!response.ok) {
          throw new Error("workflow_index_not_found");
        }
        return response.json();
      })();
      const entries = normalizeIndexPayload(payload)
        .map(normalizeWorkflowEntry)
        .filter(Boolean);
      if (!entries.length) {
        populateSelect([]);
        await loadWorkflow(workflowSrc);
        return;
      }
      populateSelect(entries);
      workflowNameMap.clear();
      workflowFileSet.clear();
      entries.forEach((entry) => {
        if (!entry?.file) return;
        if (entry.name) workflowNameMap.set(entry.name, entry.file);
        if (entry.id) workflowNameMap.set(entry.id, entry.file);
        workflowFileSet.add(entry.file);
      });
      const stored = readStoredWorkflow();
      const preferred =
        entries.find((entry) => entry.file === stored) ||
        entries.find((entry) => entry.file === workflowSrc) ||
        entries[0];
      if (workflowSelect) {
        workflowSelect.value = preferred.file;
      }
      storeWorkflow(preferred.file);
      await loadWorkflow(preferred.file);
    } catch (error) {
      populateSelect([]);
      await loadWorkflow(workflowSrc);
    }
  }

  if (workflowSelect) {
    workflowSelect.addEventListener("change", () => {
      const value = workflowSelect.value;
      if (!value || value === lastSource) return;
      loadWorkflow(value);
      storeWorkflow(value);
    });
  }

  if (workflowExportHtml) {
    workflowExportHtml.addEventListener("click", () => {
      exportSelectedWorkflowHtml().catch(() => {
        alert("Export HTML impossible.");
      });
    });
  }

  if (workflowExportHtmlCompressed) {
    workflowExportHtmlCompressed.addEventListener("click", () => {
      exportSelectedWorkflowHtml({ compressImages: true }).catch(() => {
        alert("Export HTML compresse impossible.");
      });
    });
  }

  if (subWorkflowToggle) {
    const syncToggleLabel = () => {
      subWorkflowToggle.textContent = showSubWorkflows
        ? "Masquer les sous workflows"
        : "Afficher les sous workflows";
      subWorkflowToggle.classList.toggle("is-active", showSubWorkflows);
    };
    syncToggleLabel();
    subWorkflowToggle.addEventListener("click", () => {
      showSubWorkflows = !showSubWorkflows;
      syncToggleLabel();
      if (lastWorkflow) {
        renderWorkflow(lastWorkflow);
      }
    });
  }

  if (shapesHost) {
    shapesHost.addEventListener("click", (event) => {
      const node = event.target.closest(".workflow-shape");
      if (!node) {
        clearSelection();
        return;
      }
      const shapeId = node.dataset.shapeId;
      selectShapeById(shapeId, { scrollToShape: false });
    });
    shapesHost.addEventListener("dblclick", (event) => {
      const node = event.target.closest(".workflow-shape");
      if (!node) return;
      const shapeId = node.dataset.shapeId;
      const shape = shapeLookup.get(shapeId);
      const workflowPath = resolveWorkflowPath(shape);
      if (!workflowPath) return;
      if (lastSource && lastSource !== workflowPath) {
        workflowStack.push(lastSource);
      }
      pendingZoomScale = 1.5;
      selectWorkflowByPath(workflowPath);
      loadWorkflow(workflowPath);
    });
  }

  if (workflowOutline) {
    workflowOutline.addEventListener("click", (event) => {
      const button = event.target.closest(".outline-link");
      if (!button) return;
      event.preventDefault();
      const workflowPath = button.dataset.workflowPath || "";
      const shapeId = button.dataset.shapeId || "";
      const stepId = button.dataset.stepId || "";
      navigateToOutlineTarget({
        workflowPath: workflowPath || lastSource,
        shapeId,
        stepId
      });
    });
  }

  if (zoomResetButton) {
    zoomResetButton.disabled = true;
    zoomResetButton.addEventListener("click", () => {
      const previous = workflowStack.pop();
      resetZoom();
      if (previous) {
        selectWorkflowByPath(previous);
        loadWorkflow(previous);
      }
    });
  }

  if (workflowTabButton) {
    workflowTabButton.addEventListener("click", () => {
      if (lastWorkflow) {
        renderWorkflow(lastWorkflow);
      }
    });
  }

  if (brickExportPdf) {
    brickExportPdf.addEventListener("click", () => {
      if (!brickContent || !brickTitle) return;
      const title = brickTitle.textContent || currentBrickTitle || "Brick";
      const contentClone = brickContent.cloneNode(true);
      contentClone.querySelectorAll("details").forEach((details) => {
        details.open = true;
      });
      const printWindow = window.open("", "_blank");
      if (!printWindow) return;
      const logoUrl =
        inlineLogos?.black ||
        new URL("./assets/logotext-black.png", window.location.href).href;
      const html = buildPrintHtml(title, contentClone.innerHTML, logoUrl);
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      waitForImages(printWindow.document).then(() => {
        applyImagePageBreaks(printWindow.document);
        printWindow.focus();
        printWindow.print();
      });
    });
  }

  if (brickExportJson) {
    brickExportJson.addEventListener("click", () => {
      if (!brickContent) return;
      const title = currentBrickTitle || brickTitle?.textContent || "brick";
      const payload = currentBrickPayload || {
        title,
        content: brickContent.textContent?.trim() || ""
      };
      const filename = `${slugifyTitle(title)}.json`;
      const content = JSON.stringify(payload, null, 2);
      downloadTextFile(content, filename, "application/json");
    });
  }

  loadWorkflowIndex();
  window.addEventListener("resize", () => {
    if (lastWorkflow) {
      renderWorkflow(lastWorkflow);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clearSelection();
    }
  });
}
