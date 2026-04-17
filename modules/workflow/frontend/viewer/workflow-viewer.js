const workflowCanvas = document.querySelector(".workflow-canvas");
if (workflowCanvas) {
  const workflowSvg = workflowCanvas.querySelector(".workflow-lines");
  const shapesHost = workflowCanvas.querySelector(".workflow-shapes");
  const emptyState = workflowCanvas.querySelector(".workflow-empty");
  const workflowIndex = workflowCanvas.dataset.workflowIndex || "./workflows/index.json";
  const workflowSrc = workflowCanvas.dataset.workflowSrc || "./workflow.json";
  const WORKFLOW_SHARED_BASE = "../shared";
  const WORKFLOW_API_BASE =
    (window.GDRI_WORKFLOW_CONFIG && window.GDRI_WORKFLOW_CONFIG.apiBaseUrl) ||
    window.API_BASE_URL ||
    window.GDRI_API_BASE_URL ||
    "http://localhost:3000/api";
  const workflowSelect = document.getElementById("workflow-select");
    const subWorkflowToggle = document.getElementById("workflow-sub-toggle");
  const zoomResetButton = document.getElementById("workflow-zoom-reset");
  const brickTitle = document.getElementById("brick-title");
  const brickContent = document.getElementById("brick-content");
  const brickExportPdf = document.getElementById("brick-export-pdf");
  const brickExportJson = document.getElementById("brick-export-json");
  const workflowTabButton = document.querySelector(".tab-button[data-tab=\"workflow\"]");
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
  const workflowStack = [];
  let currentBrickPayload = null;
  let currentBrickTitle = "Element selectionne";
  let brickRenderToken = 0;

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
    const withPrefix = cleaned.startsWith("block/") ? cleaned : `block/${cleaned}`;
    const isRemote = /^https?:\/\//i.test(withPrefix);
    if (isRemote || withPrefix.startsWith("api:")) return withPrefix;
    return `${WORKFLOW_SHARED_BASE}/${withPrefix}`;
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
    if (path && String(path).startsWith("api:")) {
      const id = String(path).slice(4);
      const response = await fetch(`${WORKFLOW_API_BASE}/workflow/workflows/${id}`, {
        credentials: "include"
      });
      if (!response.ok) return null;
      const payload = await response.json();
      return payload?.data?.payload || payload?.data || null;
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

  async function renderShapeDetails(shape) {
    if (!brickTitle || !brickContent) return;
    const title = shape.text || shape.id || "Element";
    const blockPath = getBlockPath(shape);
    if (!blockPath && shape.tutorial) {
      renderTutorialDetails(shape.tutorial, title);
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
      renderTutorialDetails(block.tutorial, fallbackTitle);
      return;
    }
    if (shape.tutorial) {
      renderTutorialDetails(shape.tutorial, title);
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
    if (brickTitle) {
      brickTitle.textContent = "Element selectionne";
    }
    if (brickContent) {
      brickContent.innerHTML =
        "<div class=\"brick-note\">Cliquez sur un element pour afficher son detail.</div>";
    }
    updateBrickExportState({
      title: "Element selectionne",
      payload: null,
      hasContent: false
    });
  }

  function renderTutorialDetails(tutorial, fallbackTitle) {
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
      const note = document.createElement("p");
      note.className = "brick-note";
      note.textContent = "Aucune etape definie pour cette forme.";
      brickContent.appendChild(note);
      return;
    }
    const list = document.createElement("div");
    list.className = "brick-tutorial";
    steps.forEach((step, index) => {
      renderTutorialStep(step, index, list, 0);
    });
    brickContent.appendChild(list);
    updateBrickExportState({
      title: tutorial.title || fallbackTitle,
      payload: buildTutorialExportPayload(tutorial, fallbackTitle),
      hasContent: true
    });
  }

  function renderTutorialStep(step, index, host, depth) {
    const details = document.createElement("details");
    details.className = depth === 0 ? "brick-step" : "brick-substep";
    const summary = document.createElement("summary");
    summary.textContent = step.title || `Etape ${index + 1}`;
    details.appendChild(summary);

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
          text.textContent = entry.text || entry.html || "";
          body.appendChild(text);
        }
      });
    }

    if (Array.isArray(step.substeps) && step.substeps.length) {
      const sublist = document.createElement("div");
      sublist.className = "brick-substeps";
      step.substeps.forEach((substep, subIndex) => {
        renderTutorialStep(substep, subIndex + 1, sublist, depth + 1);
      });
      body.appendChild(sublist);
    }

    details.appendChild(body);
    host.appendChild(details);
  }

  function renderWorkflow(data) {
    clearWorkflow();
    if (!data || !Array.isArray(data.shapes) || !data.shapes.length) {
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    const bounds = workflowCanvas.getBoundingClientRect();
    lastBounds = bounds;
    const padding = 30;
    const maxX = Math.max(...data.shapes.map((shape) => shape.x + shape.width), 1);
    const maxY = Math.max(...data.shapes.map((shape) => shape.y + shape.height), 1);
    const scaleX = (bounds.width - padding * 2) / maxX;
    const scaleY = (bounds.height - padding * 2) / maxY;
    const scale = Math.min(scaleX, scaleY, 1);
    lastContentBounds = {
      width: maxX * scale + padding * 2,
      height: maxY * scale + padding * 2
    };

    const scaledShapes = new Map();
    workflowRenderToken += 1;
    const renderToken = workflowRenderToken;

    data.shapes.forEach((shape) => {
      const scaled = {
        ...shape,
        x: shape.x * scale + padding,
        y: shape.y * scale + padding,
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
      if (workflowPath) {
        node.classList.add("has-workflow");
        if (shape.bgColor) {
          node.style.background = colorWithAlpha(shape.bgColor, 0.7);
        }
        if (showSubWorkflows) {
          node.classList.add("has-mini");
          const mini = document.createElement("div");
          mini.className = "shape-mini";
          node.appendChild(mini);
          fetchWorkflowData(workflowPath).then((workflowData) => {
            if (renderToken !== workflowRenderToken) return;
            renderMiniWorkflow(mini, workflowData);
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
            x: point.x * scale + padding,
            y: point.y * scale + padding
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
      const rawFile = entry;
      const isRemote = /^https?:\/\//i.test(rawFile);
      const file = isRemote || rawFile.startsWith("api:")
        ? rawFile
        : `${WORKFLOW_SHARED_BASE}/${rawFile.replace(/^\.?\/*/, "")}`;
      return { id: `workflow-${index}`, name: entry, file };
    }
    if (typeof entry === "object") {
      const apiId = entry._id || entry.id;
      if (apiId && !entry.file && !entry.path && !entry.src) {
        const name = entry.name || entry.title || apiId || `Workflow ${index + 1}`;
        return { id: apiId, name, file: `api:${apiId}` };
      }
      const name = entry.name || entry.title || apiId || `Workflow ${index + 1}`;
      const rawFile = entry.file || entry.path || entry.src;
      if (!rawFile) return null;
      const isRemote = /^https?:\/\//i.test(rawFile);
      const file = isRemote || rawFile.startsWith("api:")
        ? rawFile
        : `${WORKFLOW_SHARED_BASE}/${rawFile.replace(/^\.?\/*/, "")}`;
      return { id: apiId || `workflow-${index}`, name, file };
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
      lastWorkflow = data;
      lastSource = source;
      renderWorkflow(data);
    } catch (error) {
      clearWorkflow();
      if (emptyState) {
        emptyState.textContent = `Impossible de charger ${source}.`;
      }
      emptyState.classList.remove("hidden");
    }
  }

  async function loadWorkflowIndex() {
    try {
      let payload = null;
      const useApi = workflowIndex === "api" || workflowIndex.startsWith("api:");
      if (useApi) {
        const response = await fetch(`${WORKFLOW_API_BASE}/workflow/workflows`, {
          credentials: "include"
        });
        if (!response.ok) {
          throw new Error("workflow_index_not_found");
        }
        const apiPayload = await response.json();
        if (Array.isArray(apiPayload?.data)) {
          payload = { workflows: apiPayload.data };
        } else {
          payload = apiPayload;
        }
      } else {
        const response = await fetch(workflowIndex);
        if (!response.ok) {
          throw new Error("workflow_index_not_found");
        }
        payload = await response.json();
      }
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
      const preferred =
        entries.find((entry) => entry.file === workflowSrc) || entries[0];
      if (workflowSelect) {
        workflowSelect.value = preferred.file;
      }
      await loadWorkflow(preferred.file);
    } catch (error) {
      try {
        const response = await fetch(`${WORKFLOW_SHARED_BASE}/workflows/index.json`);
        if (!response.ok) throw new Error("workflow_index_not_found");
        const payload = await response.json();
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
        const preferred =
          entries.find((entry) => entry.file === workflowSrc) || entries[0];
        if (workflowSelect) {
          workflowSelect.value = preferred.file;
        }
        await loadWorkflow(preferred.file);
      } catch (fallbackError) {
        populateSelect([]);
        await loadWorkflow(workflowSrc);
      }
    }
  }

  if (workflowSelect) {
    workflowSelect.addEventListener("change", () => {
      const value = workflowSelect.value;
      if (!value || value === lastSource) return;
      loadWorkflow(value);
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
      if (!node) return;
      const shapeId = node.dataset.shapeId;
      const shape = shapeLookup.get(shapeId);
      if (!shape) return;
      selectedShapeId = shapeId;
      shapesHost.querySelectorAll(".workflow-shape.selected")
        .forEach((el) => el.classList.remove("selected"));
      node.classList.add("selected");
      renderShapeDetails(shape);
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
      const logoUrl = new URL(`${WORKFLOW_SHARED_BASE}/assets/logotext-black.png`, window.location.href).href;
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

  loadWorkflow(workflowSrc);
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
