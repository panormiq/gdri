const canvas = document.getElementById("canvas");
const connectionsSvg = document.getElementById("connections");
const exportButton = document.getElementById("export-json");
const importInput = document.getElementById("import-json");

const propText = document.getElementById("prop-text");
const propFontSize = document.getElementById("prop-font-size");
const propFontFamily = document.getElementById("prop-font-family");
const propTextColor = document.getElementById("prop-text-color");
const propBgColor = document.getElementById("prop-bg-color");
const propOpacity = document.getElementById("prop-opacity");
const propGroup = document.getElementById("prop-group");
const deleteShapeButton = document.getElementById("delete-shape");
const shapeProps = document.getElementById("shape-props");
const connectionProps = document.getElementById("connection-props");
const propLineStyle = document.getElementById("prop-line-style");
const propLineArrow = document.getElementById("prop-line-arrow");
const propLineColor = document.getElementById("prop-line-color");
const propLineText = document.getElementById("prop-line-text");
const propLineBgColor = document.getElementById("prop-line-bg-color");
const propLineTextOpacity = document.getElementById("prop-line-text-opacity");
const propLineTextColor = document.getElementById("prop-line-text-color");
const propLineTextX = document.getElementById("prop-line-text-x");
const propLineTextY = document.getElementById("prop-line-text-y");

const groupNameInput = document.getElementById("group-name");
const addGroupButton = document.getElementById("add-group");
const groupFilter = document.getElementById("group-filter");
const clearFilterButton = document.getElementById("clear-filter");
const groupList = document.getElementById("group-list");
const logoInput = document.getElementById("logo-input");
const logoList = document.getElementById("logo-list");
const modeTabs = document.querySelectorAll(".mode-tab");
const modePanels = document.querySelectorAll(".mode-panel");
const tutorialShapeSelect = document.getElementById("tutorial-shape");
const tutorialShapeSidebar = document.getElementById("tutorial-shape-sidebar");
const tutorialShapeLibraryHost = document.getElementById("tutorial-shape-library");
const tutorialAddShapeButton = document.getElementById("add-tutorial-shape");
const tutorialShapeForm = document.getElementById("tutorial-shape-form");
const tutorialShapeNameInput = document.getElementById("tutorial-shape-name");
const tutorialShapeCategorySelect = document.getElementById("tutorial-shape-category");
const tutorialShapeNewCategoryButton = document.getElementById("tutorial-shape-new-category");
const tutorialShapeCategoryInput = document.getElementById("tutorial-shape-category-input");
const tutorialShapeSvgInput = document.getElementById("tutorial-shape-svg");
const tutorialShapeCreateButton = document.getElementById("tutorial-shape-create");
const tutorialShapeCancelButton = document.getElementById("tutorial-shape-cancel");
const tutorialTitleInput = document.getElementById("tutorial-title");
const tutorialIntroInput = document.getElementById("tutorial-intro");
const tutorialStepsHost = document.getElementById("tutorial-steps");
const addTutorialStepButton = document.getElementById("add-tutorial-step");
const tutorialPreview = document.getElementById("tutorial-preview");
const overlayTextSizeInput = document.getElementById("overlay-text-size");
const overlayTextWidthInput = document.getElementById("overlay-text-width");
const overlayTextHeightInput = document.getElementById("overlay-text-height");
const overlayTextColorInput = document.getElementById("overlay-text-color");
const overlayTextBgInput = document.getElementById("overlay-text-bg");
const exportBlockButton = document.getElementById("export-block");
const exportBlockJsonButton = document.getElementById("export-block-json");
const blockList = document.getElementById("block-list");
const blockSections = document.getElementById("block-sections");
const blockEmpty = document.getElementById("block-empty");
const refreshBlocksButton = document.getElementById("refresh-blocks");
const blockCategorySelect = document.getElementById("block-category");
const addBlockCategoryButton = document.getElementById("add-block-category");
const blockFileNameInput = document.getElementById("block-file-name");
const blockWorkflowSelect = document.getElementById("block-workflow");
const blockSaveHint = document.getElementById("block-save-hint");
const blockStorageIndicator = document.getElementById("block-storage-indicator");
const editBlockButton = document.getElementById("edit-block");
const saveBlockButton = document.getElementById("save-block");
const deleteBlockButton = document.getElementById("delete-block");
const resetBlockButton = document.getElementById("reset-block");
const categoryModal = document.getElementById("category-modal");
const categoryNameInput = document.getElementById("category-name-input");
const categoryCreateButton = document.getElementById("category-create");
const categoryCancelButton = document.getElementById("category-cancel");
const categoryCloseButton = document.getElementById("category-close");
const workflowNameInput = document.getElementById("workflow-name");
const saveWorkflowButton = document.getElementById("save-workflow");
const workflowList = document.getElementById("workflow-list");
const loadWorkflowButton = document.getElementById("load-workflow");
const sidebar = document.querySelector(".sidebar");
const sidebarResizer = document.querySelector(".sidebar-resizer");

if (sidebar && sidebarResizer) {
  const minSidebarWidth = 250;
  const maxSidebarWidth = 600;
  sidebarResizer.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebar.getBoundingClientRect().width;
    sidebarResizer.setPointerCapture(event.pointerId);

    const handleMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, startWidth + delta));
      document.documentElement.style.setProperty("--sidebar-width", `${Math.round(nextWidth)}px`);
    };

    const handleUp = () => {
      sidebarResizer.releasePointerCapture(event.pointerId);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  });
}
const deleteWorkflowButton = document.getElementById("delete-workflow");
const workflowPreviewTitle = document.getElementById("workflow-preview-title");
const workflowPreviewContent = document.getElementById("workflow-preview-content");
const previewTitle = document.getElementById("preview-title");
const previewContent = document.getElementById("preview-content");
const cropModal = document.getElementById("crop-modal");
const cropCanvas = document.getElementById("crop-canvas");
const cropApplyButton = document.getElementById("crop-apply");
const cropCancelButton = document.getElementById("crop-cancel");
const cropCloseButton = document.getElementById("crop-close");

const shapeButtons = document.querySelectorAll(".shape-btn[data-shape]");

let shapes = [];
let connections = [];
let groups = [];
let selectedShapeId = null;
let selectedConnectionId = null;
let pendingAnchor = null;
let dragState = null;
let resizeState = null;
let segmentDrag = null;
let endpointDrag = null;
let cornerDrag = null;
let lineDrag = null;
let labelDrag = null;
let textDrag = null;
let isShapeTransforming = false;
let logoLibrary = [];
let activeTutorialShapeId = null;
let activeImageStep = null;
let selectedOverlay = null;
let overlayDrag = null;
let overlayResize = null;
let cropState = null;
let activeTutorialShapeType = "rect";
let tutorialShapes = [];
let activeStepPath = null;
let tutorialStepDrag = null;
let tutorialItemDrag = null;
let blockWorkflowEntries = [];
let blockWorkflowLoaded = false;
let editingWorkflowShapeId = null;
let editingWorkflowConnectionId = null;
let suppressWorkflowShapeLoad = false;
let activeMode = "workflow";
let canvasZoom = 1;
const minCanvasZoom = 0.4;
const maxCanvasZoom = 2.5;
const canvasZoomStep = 0.1;
const blockPreviewCache = new Map();
const DEBUG_INGEST_URL = "";
const defaultTutorialShapeCategory = "Général";
const tutorialShapeLibraryDefaults = [
  { id: "rect", type: "rect", label: "Rectangle", category: defaultTutorialShapeCategory, standard: true },
  { id: "diamond", type: "diamond", label: "Losange", category: defaultTutorialShapeCategory, standard: true },
  { id: "round", type: "round", label: "Rectangle arrondi", category: defaultTutorialShapeCategory, standard: true },
  { id: "circle", type: "circle", label: "Cercle", category: defaultTutorialShapeCategory, standard: true },
  { id: "ellipse", type: "ellipse", label: "Ellipse", category: defaultTutorialShapeCategory, standard: true }
];
let tutorialShapeLibrary = [...tutorialShapeLibraryDefaults];
const tutorialShapeStorageKey = "tutorialShapeLibrary";
const tutorialShapeDefaults = {
  rect: { width: 160, height: 70 },
  diamond: { width: 120, height: 120 },
  round: { width: 160, height: 70 },
  circle: { width: 100, height: 100 },
  ellipse: { width: 160, height: 80 },
  logo: { width: 140, height: 90 },
  link: { width: 180, height: 50 }
};
const labelPadding = 5;
const maxConnectionPoints = 5;
const fixedConnectorOffset = 20;
const snapThreshold = 8;
const snapGuideX = document.createElement("div");
const snapGuideY = document.createElement("div");

snapGuideX.className = "snap-guide snap-guide-x hidden";
snapGuideY.className = "snap-guide snap-guide-y hidden";
if (canvas) {
  canvas.appendChild(snapGuideX);
  canvas.appendChild(snapGuideY);
}

let canvasSurface = null;
let canvasRoot = canvas;
if (canvas) {
  canvasSurface = document.createElement("div");
  canvasSurface.className = "canvas-surface";
  while (canvas.firstChild) {
    canvasSurface.appendChild(canvas.firstChild);
  }
  canvas.appendChild(canvasSurface);
  canvasRoot = canvasSurface;
}

function getCanvasScale() {
  return canvasZoom || 1;
}

function getCanvasMetrics() {
  const bounds = canvas.getBoundingClientRect();
  const scale = getCanvasScale();
  return {
    scale,
    bounds,
    width: bounds.width / scale,
    height: bounds.height / scale,
    scrollX: (canvas.scrollLeft || 0) / scale,
    scrollY: (canvas.scrollTop || 0) / scale
  };
}

function getCanvasPointer(event) {
  const { bounds, scale, scrollX, scrollY } = getCanvasMetrics();
  return {
    x: (event.clientX - bounds.left) / scale + scrollX,
    y: (event.clientY - bounds.top) / scale + scrollY
  };
}

function applyCanvasZoom() {
  if (!canvasSurface) return;
  canvasSurface.style.zoom = String(canvasZoom);
  updateConnections();
}

function clampCanvasZoom(nextZoom) {
  return Math.max(minCanvasZoom, Math.min(maxCanvasZoom, nextZoom));
}

function setCanvasZoom(nextZoom, anchorEvent) {
  if (!canvas) return;
  const scale = getCanvasScale();
  const targetZoom = clampCanvasZoom(nextZoom);
  if (Math.abs(targetZoom - scale) < 0.001) return;
  let anchor = null;
  if (anchorEvent) {
    anchor = getCanvasPointer(anchorEvent);
  }
  const bounds = canvas.getBoundingClientRect();
  const viewportX = anchorEvent ? anchorEvent.clientX - bounds.left : bounds.width / 2;
  const viewportY = anchorEvent ? anchorEvent.clientY - bounds.top : bounds.height / 2;
  canvasZoom = targetZoom;
  applyCanvasZoom();
  if (anchor) {
    canvas.scrollLeft = Math.max(0, anchor.x * canvasZoom - viewportX);
    canvas.scrollTop = Math.max(0, anchor.y * canvasZoom - viewportY);
  }
}

function getSnapPoints(shape) {
  return {
    x: shape.x,
    cx: shape.x + shape.width / 2,
    r: shape.x + shape.width,
    y: shape.y,
    cy: shape.y + shape.height / 2,
    b: shape.y + shape.height
  };
}

function collectSnapTargets(excludeId) {
  return shapes
    .filter((shape) => shape.id !== excludeId)
    .map((shape) => ({
      id: shape.id,
      ...getSnapPoints(shape)
    }));
}

function snapValue(value, targets) {
  let best = value;
  let bestDelta = snapThreshold + 1;
  targets.forEach((target) => {
    const delta = Math.abs(value - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = target;
    }
  });
  return bestDelta <= snapThreshold ? best : value;
}

function pickSnap(value, targets) {
  let best = { delta: Number.POSITIVE_INFINITY, target: null };
  targets.forEach((target) => {
    const delta = Math.abs(value - target);
    if (delta < best.delta) {
      best = { delta, target };
    }
  });
  if (best.delta <= snapThreshold) {
    return {
      snapped: true,
      value: best.target,
      target: best.target,
      delta: best.delta
    };
  }
  return {
    snapped: false,
    value,
    target: null,
    delta: Number.POSITIVE_INFINITY
  };
}

function updateSnapGuides(guideX, guideY) {
  if (typeof guideX === "number") {
    snapGuideX.style.left = `${guideX}px`;
    snapGuideX.classList.remove("hidden");
  } else {
    snapGuideX.classList.add("hidden");
  }

  if (typeof guideY === "number") {
    snapGuideY.style.top = `${guideY}px`;
    snapGuideY.classList.remove("hidden");
  } else {
    snapGuideY.classList.add("hidden");
  }
}

function clearSnapGuides() {
  updateSnapGuides(null, null);
}

function snapMovePosition(shape, nextX, nextY) {
  const targets = collectSnapTargets(shape.id);
  if (!targets.length) return { x: nextX, y: nextY, guideX: null, guideY: null };
  const next = {
    x: nextX,
    y: nextY,
    width: shape.width,
    height: shape.height
  };
  const nextPoints = getSnapPoints(next);
  const xTargets = [];
  const yTargets = [];
  targets.forEach((target) => {
    xTargets.push(target.x, target.cx, target.r);
    yTargets.push(target.y, target.cy, target.b);
  });
  const snapLeft = pickSnap(nextPoints.x, xTargets);
  const snapCenter = pickSnap(nextPoints.cx, xTargets);
  const snapRight = pickSnap(nextPoints.r, xTargets);
  let x = nextX;
  let guideX = null;
  if (snapLeft.delta <= snapCenter.delta && snapLeft.delta <= snapRight.delta) {
    if (snapLeft.snapped) {
      x = snapLeft.value;
      guideX = snapLeft.target;
    }
  } else if (snapCenter.delta <= snapRight.delta) {
    if (snapCenter.snapped) {
      x = snapCenter.value - next.width / 2;
      guideX = snapCenter.target;
    }
  } else {
    if (snapRight.snapped) {
      x = snapRight.value - next.width;
      guideX = snapRight.target;
    }
  }

  const snapTop = pickSnap(nextPoints.y, yTargets);
  const snapMiddle = pickSnap(nextPoints.cy, yTargets);
  const snapBottom = pickSnap(nextPoints.b, yTargets);
  let y = nextY;
  let guideY = null;
  if (snapTop.delta <= snapMiddle.delta && snapTop.delta <= snapBottom.delta) {
    if (snapTop.snapped) {
      y = snapTop.value;
      guideY = snapTop.target;
    }
  } else if (snapMiddle.delta <= snapBottom.delta) {
    if (snapMiddle.snapped) {
      y = snapMiddle.value - next.height / 2;
      guideY = snapMiddle.target;
    }
  } else {
    if (snapBottom.snapped) {
      y = snapBottom.value - next.height;
      guideY = snapBottom.target;
    }
  }
  return { x, y, guideX, guideY };
}

function snapResize(shape, next) {
  const targets = collectSnapTargets(shape.id);
  if (!targets.length) return { next, guideX: null, guideY: null };
  const points = getSnapPoints(next);
  const xTargets = [];
  const yTargets = [];
  targets.forEach((target) => {
    xTargets.push(target.x, target.cx, target.r);
    yTargets.push(target.y, target.cy, target.b);
  });

  let guideX = null;
  let guideY = null;

  if (next.edgeX === "left") {
    const snapLeft = pickSnap(points.x, xTargets);
    if (snapLeft.snapped) {
      const newWidth = next.r - snapLeft.value;
      if (newWidth >= next.minSize) {
        next.x = snapLeft.value;
        next.width = newWidth;
        guideX = snapLeft.target;
      }
    }
  } else if (next.edgeX === "right") {
    const snapRight = pickSnap(points.r, xTargets);
    if (snapRight.snapped) {
      const newWidth = snapRight.value - next.x;
      if (newWidth >= next.minSize) {
        next.width = newWidth;
        guideX = snapRight.target;
      }
    }
  } else if (next.edgeX === "center") {
    const snapCenter = pickSnap(points.cx, xTargets);
    if (snapCenter.snapped) {
      next.x = snapCenter.value - next.width / 2;
      guideX = snapCenter.target;
    }
  }

  if (next.edgeY === "top") {
    const snapTop = pickSnap(points.y, yTargets);
    if (snapTop.snapped) {
      const newHeight = next.b - snapTop.value;
      if (newHeight >= next.minSize) {
        next.y = snapTop.value;
        next.height = newHeight;
        guideY = snapTop.target;
      }
    }
  } else if (next.edgeY === "bottom") {
    const snapBottom = pickSnap(points.b, yTargets);
    if (snapBottom.snapped) {
      const newHeight = snapBottom.value - next.y;
      if (newHeight >= next.minSize) {
        next.height = newHeight;
        guideY = snapBottom.target;
      }
    }
  } else if (next.edgeY === "center") {
    const snapMiddle = pickSnap(points.cy, yTargets);
    if (snapMiddle.snapped) {
      next.y = snapMiddle.value - next.height / 2;
      guideY = snapMiddle.target;
    }
  }

  return { next, guideX, guideY };
}

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

function getSegmentMidpoints(points) {
  return points.slice(0, -1).map((a, index) => {
    const b = points[index + 1];
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      segIndex: index,
      axis: a.x === b.x ? "x" : "y"
    };
  });
}

let suppressCanvasClick = false;

function showProperties(mode) {
  if (!shapeProps || !connectionProps) return;
  if (mode === "shape") {
    shapeProps.classList.remove("hidden");
    connectionProps.classList.add("hidden");
    return;
  }
  if (mode === "connection") {
    connectionProps.classList.remove("hidden");
    shapeProps.classList.add("hidden");
    return;
  }
  connectionProps.classList.add("hidden");
  shapeProps.classList.add("hidden");
}

function generateId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "bloc";
}

function createTutorialTemplate(title) {
  return {
    title: title || "Tutoriel de la forme",
    intro: "",
    steps: [],
    conditions: []
  };
}

function deepClone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function debugIngest(payload) {
  if (!DEBUG_INGEST_URL) return;
  fetch(DEBUG_INGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

function parseSvgRatioFromDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  if (!dataUrl.startsWith("data:image/svg+xml")) return null;
  let raw = "";
  try {
    if (dataUrl.includes(";base64,")) {
      raw = atob(dataUrl.split(";base64,")[1]);
    } else {
      raw = decodeURIComponent(dataUrl.split(",")[1] || "");
    }
  } catch (error) {
    return null;
  }
  if (!raw) return null;
  const parseSize = (value) => {
    if (!value) return null;
    if (/%/.test(value)) return null;
    const num = parseFloat(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  };
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (svg) {
      const viewBox = svg.getAttribute("viewBox");
      if (viewBox) {
        const parts = viewBox.trim().split(/\s+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          return parts[2] / parts[3];
        }
      }
      const width = parseSize(svg.getAttribute("width"));
      const height = parseSize(svg.getAttribute("height"));
      if (width && height) return width / height;
    }
  } catch (error) {
    // ignore parser errors
  }
  const viewBoxMatch = raw.match(/viewBox=["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["']/i);
  if (viewBoxMatch) {
    const width = Number(viewBoxMatch[3]);
    const height = Number(viewBoxMatch[4]);
    if (width > 0 && height > 0) return width / height;
  }
  const widthMatch = raw.match(/width=["']([\d.]+)(px)?["']/i);
  const heightMatch = raw.match(/height=["']([\d.]+)(px)?["']/i);
  if (widthMatch && heightMatch) {
    const width = Number(widthMatch[1]);
    const height = Number(heightMatch[1]);
    if (width > 0 && height > 0) return width / height;
  }
  return null;
}

function updateBlockStorageIndicator(shape) {
  if (!blockStorageIndicator) return;
  if (!shape) {
    blockStorageIndicator.textContent = "Inline";
    blockStorageIndicator.classList.add("hidden");
    return;
  }
  blockStorageIndicator.classList.remove("hidden");
  blockStorageIndicator.textContent = shape.blockPath ? "Block" : "Inline";
}

function updateBlockStorageIndicatorForConnection(connection) {
  if (!blockStorageIndicator) return;
  if (!connection) {
    blockStorageIndicator.textContent = "Inline";
    blockStorageIndicator.classList.add("hidden");
    return;
  }
  blockStorageIndicator.classList.remove("hidden");
  blockStorageIndicator.textContent = "Inline";
}

function updateEditButtonState() {
  if (!editBlockButton) return;
  editBlockButton.disabled = !selectedShapeId && !selectedConnectionId;
}

function toggleTutorialShapeSidebarLock(locked) {
  if (!tutorialShapeSidebar) return;
  tutorialShapeSidebar.classList.toggle("locked", Boolean(locked));
}

function isEditingConnection() {
  return Boolean(editingWorkflowConnectionId);
}

function hasActiveWorkflowSelection() {
  return Boolean((workflowNameInput?.value || "").trim() || workflowList?.value);
}

function handleWorkflowEditRequest(shapeId) {
  if (!hasActiveWorkflowSelection()) {
    alert(
      "Enregistrez ou chargez un workflow pour pouvoir sauvegarder les blocs inline."
    );
  }
  if (shapeId) {
    selectShape(shapeId);
  }
  setActiveMode("tutorial");
}

function handleWorkflowConnectionEditRequest(connectionId) {
  const targetId = connectionId || selectedConnectionId;
  if (!targetId) return;
  if (connectionId) {
    selectConnection(connectionId);
  }
  suppressWorkflowShapeLoad = true;
  setActiveMode("tutorial");
  suppressWorkflowShapeLoad = false;
  loadWorkflowConnectionIntoEditor(targetId);
}

function openEmptyBlockEditorFromShape(entry) {
  if (!entry) return;
  const ratio =
    Number(entry.ratio) || parseSvgRatioFromDataUrl(entry.imageData) || 1;
  const shape = createTutorialShape(entry.type || "rect", {
    text: entry.label || "Forme",
    imageData: entry.imageData || null
  });
  if (entry.imageData) {
    shape.imageRatio = ratio;
    shape.imageHeight = 70;
    shape.width = Math.round(shape.imageHeight * ratio);
    shape.height = shape.imageHeight;
  }
  shape.tutorial = createTutorialTemplate(shape.text);
  shape.blockId = "";
  shape.blockPath = "";
  shape.blockCategory = "";
  shape.blockFileName = "";
  shape.workflow = null;
  tutorialShapes = [shape];
  activeTutorialShapeId = shape.id;
  activeTutorialShapeType = shape.type || "rect";
  ensureTutorialShapeType(activeTutorialShapeType);
  suppressWorkflowShapeLoad = true;
  setActiveMode("tutorial");
  suppressWorkflowShapeLoad = false;
  renderTutorialEditor();
}

function normalizeTutorialShapeCategory(value) {
  return String(value || "").trim() || defaultTutorialShapeCategory;
}

function ensureTutorialShapeLibraryEntry(shape) {
  if (!shape) return null;
  const category = normalizeTutorialShapeCategory(shape.category);
  if (shape.imageData) {
    const existing = tutorialShapeLibrary.find(
      (entry) => entry.imageData && entry.imageData === shape.imageData
    );
    if (existing) return existing;
    const entry = {
      id: generateId("tshape-lib"),
      type: shape.type || "logo",
      label: shape.text || "Forme",
      category,
      imageData: shape.imageData,
      standard: false
    };
    tutorialShapeLibrary.push(entry);
    return entry;
  }
  const existing = tutorialShapeLibrary.find(
    (entry) => entry.standard && entry.type === shape.type
  );
  if (existing) return existing;
  const entry = {
    id: shape.type || generateId("tshape-lib"),
    type: shape.type || "rect",
    label: shape.type === "logo" ? "Logo" : shape.type || "Forme",
    category,
    standard: true
  };
  tutorialShapeLibrary.push(entry);
  return entry;
}

function createTutorialShape(type, overrides = {}) {
  const config = tutorialShapeDefaults[type] || tutorialShapeDefaults.rect;
  const shape = {
    id: generateId("tshape"),
    type: type || "rect",
    width: config.width,
    height: config.height,
    text: "Forme",
    fontSize: 14,
    fontFamily: "Segoe UI",
    textColor: "#ffffff",
    bgColor: "#0e9cef",
    opacity: 1,
    imageData: null,
    libraryId: ""
  };
  Object.assign(shape, overrides);
  shape.tutorial = createTutorialTemplate(shape.text);
  tutorialShapes.push(shape);
  return shape;
}

function createTutorialShapeFromWorkflowShape(workflowShape) {
  if (!workflowShape) return null;
  const block = {
    id: workflowShape.blockId || "",
    name: workflowShape.text || "Forme",
    shape: {
      type: workflowShape.type || "rect",
      text: workflowShape.text || "Forme",
      width: workflowShape.width,
      height: workflowShape.height,
      fontSize: workflowShape.fontSize,
      fontFamily: workflowShape.fontFamily,
      textColor: workflowShape.textColor,
      bgColor: workflowShape.bgColor,
      opacity: workflowShape.opacity,
      imageData: workflowShape.imageData || null
    },
    tutorial: workflowShape.tutorial || null,
    workflow: workflowShape.workflow || null
  };
  return createTutorialShapeFromBlock(block, {
    path: workflowShape.blockPath || "",
    category: workflowShape.blockCategory || "",
    fileName: workflowShape.blockFileName || ""
  });
}

function createTutorialShapeFromConnection(connection) {
  if (!connection) return null;
  const defaults = tutorialShapeDefaults.link || tutorialShapeDefaults.rect;
  const title =
    connection?.tutorial?.title || connection?.label || connection?.id || "Lien";
  const shape = {
    id: generateId("tshape"),
    type: "link",
    width: defaults.width,
    height: defaults.height,
    text: connection?.label || title,
    fontSize: 14,
    fontFamily: "Segoe UI",
    textColor: connection?.labelTextColor || connection?.lineColor || "#0e9cef",
    bgColor: "transparent",
    opacity: 1,
    imageData: null,
    blockId: "",
    blockPath: "",
    blockCategory: "",
    blockFileName: "",
    workflow: null
  };
  const base = createTutorialTemplate(title);
  const tutorial = {
    ...base,
    ...(connection?.tutorial || {})
  };
  tutorial.title = tutorial.title || title;
  tutorial.steps = normalizeTutorialSteps(tutorial.steps || []);
  if (!Array.isArray(tutorial.conditions)) {
    tutorial.conditions = [];
  }
  shape.tutorial = tutorial;
  return shape;
}

function applyBlockToWorkflowShape(shape, block) {
  if (!shape || !block) return;
  const defaults = tutorialShapeDefaults[block?.shape?.type] || tutorialShapeDefaults.rect;
  const title = block?.tutorial?.title || block?.name || block?.shape?.text || "Forme";
  shape.type = block?.shape?.type || "rect";
  shape.width = block?.shape?.width || defaults.width;
  shape.height = block?.shape?.height || defaults.height;
  shape.text = block?.shape?.text || title;
  shape.fontSize = block?.shape?.fontSize || 14;
  shape.fontFamily = block?.shape?.fontFamily || "Segoe UI";
  shape.textColor = block?.shape?.textColor || "#ffffff";
  shape.bgColor = block?.shape?.bgColor || "#0e9cef";
  shape.opacity = block?.shape?.opacity ?? 1;
  shape.imageData = block?.shape?.imageData || null;
  shape.workflow = normalizeBlockWorkflow(block?.workflow);
  shape.tutorial = block?.tutorial
    ? {
        ...block.tutorial,
        steps: normalizeTutorialSteps(block.tutorial.steps || [])
      }
    : createTutorialTemplate(title);
}

function syncEditingWorkflowShape(options = {}) {
  if (!editingWorkflowShapeId) return;
  const workflowShape = shapes.find((shape) => shape.id === editingWorkflowShapeId);
  const tutorialShape = getActiveTutorialShape();
  if (!workflowShape || !tutorialShape) return;
  const usePath =
    typeof options.usePath === "boolean"
      ? options.usePath
      : Boolean(tutorialShape.blockPath);
  Object.assign(workflowShape, {
    type: tutorialShape.type,
    text: tutorialShape.text,
    width: tutorialShape.width,
    height: tutorialShape.height,
    fontSize: tutorialShape.fontSize,
    fontFamily: tutorialShape.fontFamily,
    textColor: tutorialShape.textColor,
    bgColor: tutorialShape.bgColor,
    opacity: tutorialShape.opacity,
    imageData: tutorialShape.imageData || null,
    workflow: normalizeBlockWorkflow(tutorialShape.workflow)
  });
  if (usePath) {
    workflowShape.blockId = tutorialShape.blockId || workflowShape.blockId || "";
    workflowShape.blockPath = tutorialShape.blockPath || workflowShape.blockPath || "";
    workflowShape.blockCategory =
      tutorialShape.blockCategory || workflowShape.blockCategory || "";
    workflowShape.blockFileName =
      tutorialShape.blockFileName || workflowShape.blockFileName || "";
    workflowShape.tutorial = null;
  } else {
    workflowShape.blockId = "";
    workflowShape.blockPath = "";
    workflowShape.blockCategory = "";
    workflowShape.blockFileName = "";
    workflowShape.tutorial = deepClone(ensureShapeTutorial(tutorialShape));
  }
  renderShapes();
  updateBlockStorageIndicator(workflowShape);
  if (workflowShape.tutorial) {
    renderBlockPreviewForTargets(workflowShape.tutorial, workflowShape.text || workflowShape.id);
  } else {
    clearBlockPreview();
  }
}

function syncEditingWorkflowConnection() {
  if (!editingWorkflowConnectionId) return;
  const connection = connections.find(
    (item) => item.id === editingWorkflowConnectionId
  );
  const tutorialShape = getActiveTutorialShape();
  if (!connection || !tutorialShape) return;
  connection.tutorial = deepClone(ensureShapeTutorial(tutorialShape));
  renderBlockPreviewForTargets(
    connection.tutorial,
    connection.label || tutorialShape.text || connection.id
  );
}

async function loadWorkflowShapeIntoEditor(shapeId) {
  const workflowShape = shapes.find((shape) => shape.id === shapeId);
  if (!workflowShape) return;
  editingWorkflowShapeId = workflowShape.id;
  editingWorkflowConnectionId = null;
  toggleTutorialShapeSidebarLock(false);
  let tutorialShape = null;
  if (workflowShape.blockPath) {
    try {
      const data = await fetchBlockData({ path: workflowShape.blockPath });
      if (data) {
        tutorialShape = createTutorialShapeFromBlock(data, {
          path: workflowShape.blockPath,
          category: workflowShape.blockCategory || "",
          fileName: workflowShape.blockFileName || ""
        });
      }
    } catch (error) {
      tutorialShape = null;
    }
  }
  if (!tutorialShape) {
    tutorialShape = createTutorialShapeFromWorkflowShape(workflowShape);
  }
  if (!tutorialShape) return;
  tutorialShapes = [tutorialShape];
  activeTutorialShapeId = tutorialShape.id;
  activeTutorialShapeType = tutorialShape.type || "rect";
  ensureTutorialShapeType(activeTutorialShapeType);
  renderTutorialEditor();
}

function loadWorkflowConnectionIntoEditor(connectionId) {
  const connection = connections.find((item) => item.id === connectionId);
  if (!connection) return;
  editingWorkflowShapeId = null;
  editingWorkflowConnectionId = connection.id;
  const tutorialShape = createTutorialShapeFromConnection(connection);
  if (!tutorialShape) return;
  tutorialShapes = [tutorialShape];
  activeTutorialShapeId = tutorialShape.id;
  activeTutorialShapeType = "link";
  toggleTutorialShapeSidebarLock(true);
  renderTutorialEditor();
}

 

function getTutorialShapeByType(type) {
  return tutorialShapes.find((shape) => shape.type === type);
}

function getActiveTutorialShapeLibraryId() {
  if (activeMode === "workflow") {
    const shape = shapes.find((item) => item.id === selectedShapeId);
    if (!shape) return "";
    if (shape.imageData) {
      const match = tutorialShapeLibrary.find(
        (entry) => entry.imageData && entry.imageData === shape.imageData
      );
      return match ? match.id : "";
    }
    const entry = tutorialShapeLibrary.find(
      (item) => item.standard && item.type === shape.type
    );
    return entry ? entry.id : "";
  }
  const shape = getActiveTutorialShape();
  if (!shape) return "";
  if (shape.libraryId) return shape.libraryId;
  const entry = tutorialShapeLibrary.find(
    (item) => item.standard && item.type === shape.type
  );
  return entry ? entry.id : "";
}

function refreshTutorialShapeCategoryOptions(selectedCategory) {
  if (!tutorialShapeCategorySelect) return;
  const categories = new Set([defaultTutorialShapeCategory]);
  tutorialShapeLibrary.forEach((entry) => {
    categories.add(normalizeTutorialShapeCategory(entry.category));
  });
  const ordered = Array.from(categories).sort((a, b) => {
    if (a === defaultTutorialShapeCategory) return -1;
    if (b === defaultTutorialShapeCategory) return 1;
    return a.localeCompare(b, "fr");
  });
  tutorialShapeCategorySelect.innerHTML = "";
  ordered.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    tutorialShapeCategorySelect.appendChild(option);
  });
  tutorialShapeCategorySelect.value =
    selectedCategory && ordered.includes(selectedCategory)
      ? selectedCategory
      : defaultTutorialShapeCategory;
}

function createLibraryPreview(entry) {
  const preview = document.createElement("div");
  preview.className = `shape-preview ${entry.type || "rect"}`;
  preview.style.background = "#0e9cef";
  preview.style.color = "#ffffff";
  preview.style.fontFamily = "Segoe UI";
  preview.style.fontSize = "12px";
  if (entry.imageData) {
    preview.classList.add("image-preview");
    const ratio =
      Number(entry.ratio) || parseSvgRatioFromDataUrl(entry.imageData) || 1;
    preview.style.width = `${Math.round(46 * ratio)}px`;
    preview.style.backgroundImage = `url(${entry.imageData})`;
    preview.style.backgroundSize = "contain";
    preview.style.backgroundRepeat = "no-repeat";
    preview.style.backgroundPosition = "center";
    preview.style.backgroundColor = "#ffffff";
  }
  if (!entry.imageData) {
    const text = document.createElement("div");
    text.className = "shape-preview-text";
    text.textContent = entry.label || entry.type || "Forme";
    preview.appendChild(text);
  }
  return preview;
}

function createBlockPreview(block, fallbackLabel) {
  const entry = {
    type: block?.shape?.type || "rect",
    label: block?.tutorial?.title || block?.name || fallbackLabel || "Block",
    imageData: block?.shape?.imageData || null
  };
  return createLibraryPreview(entry);
}

function renderTutorialShapeItem(entry, activeEntryId, host) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "tutorial-shape-item";
  if (entry.id === activeEntryId) {
    card.classList.add("active");
  }
  const preview = createLibraryPreview(entry);
  card.appendChild(preview);
  if (entry.imageData) {
    const caption = document.createElement("span");
    caption.className = "tutorial-shape-caption";
    caption.textContent = entry.label || "Forme";
    const width = preview.style.width;
    if (width) {
      caption.style.width = width;
    }
    card.appendChild(caption);
  }
  if (activeMode === "workflow") {
    card.draggable = true;
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData(
        "application/json",
        JSON.stringify({
          kind: "shape",
          id: entry.id,
          type: entry.type || "rect",
          label: entry.label || "Forme",
          imageData: entry.imageData || null
        })
      );
      event.dataTransfer?.setData("text/plain", entry.label || "Forme");
    });
    card.addEventListener("dblclick", (event) => {
      event.preventDefault();
      openEmptyBlockEditorFromShape(entry);
    });
  } else {
    card.addEventListener("click", () => {
      activateTutorialShapeFromLibrary(entry);
    });
  }
  host.appendChild(card);
}

function loadShapeLibraryFromStorage() {
  try {
    const raw = localStorage.getItem(tutorialShapeStorageKey);
    if (!raw) return;
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return;
    let updated = false;
    entries.forEach((entry) => {
      if (!entry || entry.standard) return;
      if (!entry.id || !entry.type) return;
      if (tutorialShapeLibrary.some((item) => item.id === entry.id)) return;
      if (entry.imageData && (!entry.ratio || !Number.isFinite(Number(entry.ratio)))) {
        const ratio = parseSvgRatioFromDataUrl(entry.imageData);
        if (ratio) {
          entry.ratio = ratio;
          updated = true;
        }
      }
      tutorialShapeLibrary.push({
        ...entry,
        category: normalizeTutorialShapeCategory(entry.category),
        standard: false
      });
    });
    if (updated) {
      saveShapeLibraryToStorage();
    }
  } catch (error) {
    // ignore invalid stored data
  }
}

function saveShapeLibraryToStorage() {
  try {
    const custom = tutorialShapeLibrary.filter((entry) => !entry.standard);
    localStorage.setItem(tutorialShapeStorageKey, JSON.stringify(custom));
  } catch (error) {
    // ignore storage failures
  }
}

function renderTutorialShapeLibrary() {
  if (!tutorialShapeLibraryHost) return;
  tutorialShapeLibraryHost.innerHTML = "";
  const activeEntryId = getActiveTutorialShapeLibraryId();
  const categories = new Map();
  tutorialShapeLibrary.forEach((entry) => {
    const category = normalizeTutorialShapeCategory(entry.category);
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category).push(entry);
  });
  const generalEntries = categories.get(defaultTutorialShapeCategory) || [];
  if (generalEntries.length) {
    const group = document.createElement("div");
    group.className = "tutorial-shape-group";
    const title = document.createElement("div");
    title.textContent = defaultTutorialShapeCategory;
    title.className = "tutorial-hint";
    group.appendChild(title);
    const items = document.createElement("div");
    items.className = "tutorial-shape-items";
    generalEntries.forEach((entry) => {
      renderTutorialShapeItem(entry, activeEntryId, items);
    });
    group.appendChild(items);
    tutorialShapeLibraryHost.appendChild(group);
  }
  Array.from(categories.keys())
    .filter((key) => key !== defaultTutorialShapeCategory)
    .sort((a, b) => a.localeCompare(b, "fr"))
    .forEach((category) => {
      const entries = categories.get(category) || [];
      if (!entries.length) return;
      const group = document.createElement("div");
      group.className = "tutorial-shape-group";
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = category;
      details.appendChild(summary);
      const items = document.createElement("div");
      items.className = "tutorial-shape-items";
      entries.forEach((entry) => {
        renderTutorialShapeItem(entry, activeEntryId, items);
      });
      details.appendChild(items);
      group.appendChild(details);
      tutorialShapeLibraryHost.appendChild(group);
    });
}

function activateTutorialShapeFromLibrary(entry) {
  if (!entry) return;
  let shape = null;
  if (entry.standard) {
    shape = getTutorialShapeByType(entry.type);
  } else {
    shape = tutorialShapes.find((item) => item.libraryId === entry.id);
  }
  if (!shape) {
    shape = createTutorialShape(entry.type || "rect", {
      text: entry.label || "Forme",
      imageData: entry.imageData || null,
      libraryId: entry.id
    });
  }
  if (!shape) return;
  activeTutorialShapeId = shape.id;
  activeTutorialShapeType = shape.type || "rect";
  renderTutorialEditor();
}

function addWorkflowShapeFromLibrary(entry, position) {
  if (!entry) return;
  const shape = createShape(entry.imageData ? "logo" : entry.type || "rect");
  if (!shape) return;
  if (entry.imageData) {
    shape.imageData = entry.imageData;
    shape.text = entry.label || "Forme";
    const ratio =
      Number(entry.ratio) || parseSvgRatioFromDataUrl(entry.imageData) || 1;
    shape.imageRatio = ratio;
    shape.imageHeight = 70;
    shape.width = Math.round(shape.imageHeight * ratio);
    shape.height = shape.imageHeight;
  } else if (entry.label) {
    shape.text = entry.label;
  }
  if (position) {
    shape.x = position.x - shape.width / 2;
    shape.y = position.y - shape.height / 2;
  }
  renderShapes();
  selectShape(shape.id);
}

function toggleTutorialShapeForm(visible) {
  if (!tutorialShapeForm) return;
  tutorialShapeForm.classList.toggle("hidden", !visible);
}

function resetTutorialShapeForm() {
  if (tutorialShapeNameInput) tutorialShapeNameInput.value = "";
  if (tutorialShapeSvgInput) tutorialShapeSvgInput.value = "";
  if (tutorialShapeCategoryInput) {
    tutorialShapeCategoryInput.value = "";
    tutorialShapeCategoryInput.classList.add("hidden");
  }
  if (tutorialShapeCategorySelect) {
    tutorialShapeCategorySelect.disabled = false;
  }
}

function resolveTutorialShapeCategory() {
  if (
    tutorialShapeCategoryInput &&
    !tutorialShapeCategoryInput.classList.contains("hidden")
  ) {
    return normalizeTutorialShapeCategory(tutorialShapeCategoryInput.value);
  }
  return normalizeTutorialShapeCategory(tutorialShapeCategorySelect?.value);
}

function normalizeBlockIndex(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.blocks)) return payload.blocks;
  return [];
}

function normalizeBlockEntry(entry, index) {
  if (!entry) return null;
  if (typeof entry === "string") {
    return { id: `block-${index}`, name: entry, file: entry };
  }
  if (typeof entry === "object") {
    const name = entry.name || entry.title || entry.id || `Block ${index + 1}`;
    const file = entry.file || entry.path || entry.src;
    if (!file) return null;
    return {
      id: entry.id || `block-${index}`,
      name,
      file,
      path: entry.path || null,
      category: entry.category || null,
      shape: entry.shape || null
    };
  }
  return null;
}

function normalizeBlockSection(section, index) {
  if (!section) return null;
  if (typeof section === "string") {
    return {
      id: `section-${index}`,
      name: section,
      source: section,
      blocks: []
    };
  }
  if (typeof section === "object") {
    const name = section.name || section.title || section.id || `Categorie ${index + 1}`;
    const rawBlocks = normalizeBlockIndex(section.blocks || section.items || section.entries);
    return {
      id: section.id || `section-${index}`,
      name,
      source: section.file || section.index || section.path || section.src || null,
      blocks: rawBlocks.map(normalizeBlockEntry).filter(Boolean)
    };
  }
  return null;
}

function normalizeBlockSections(payload) {
  if (!payload) return [];
  const rawSections = payload.sections || payload.categories;
  if (Array.isArray(rawSections)) {
    return rawSections.map(normalizeBlockSection).filter(Boolean);
  }
  const entries = normalizeBlockIndex(payload)
    .map(normalizeBlockEntry)
    .filter(Boolean);
  if (!entries.length) return [];
  return [
    {
      id: "blocks",
      name: payload?.name || "Blocks personnalises",
      source: null,
      blocks: entries
    }
  ];
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error("request_failed");
  }
  return response.json();
}

function setBlockSaveHint(message, isError) {
  if (!blockSaveHint) return;
  blockSaveHint.textContent = message || "";
  blockSaveHint.style.color = isError ? "#ef4444" : "";
}

function toggleBlockSaveControls(enabled) {
  const disabled = !enabled;
  if (blockCategorySelect) blockCategorySelect.disabled = disabled;
  if (addBlockCategoryButton) addBlockCategoryButton.disabled = disabled;
  if (blockFileNameInput) blockFileNameInput.disabled = disabled;
  if (blockWorkflowSelect) blockWorkflowSelect.disabled = disabled;
  if (saveBlockButton) saveBlockButton.disabled = disabled;
  if (blockSaveHint) {
    const hint = "Les liens sont toujours en inline.";
    if (disabled) {
      setBlockSaveHint(hint, false);
    } else if (blockSaveHint.textContent === hint) {
      setBlockSaveHint("");
    }
  }
}

function syncBlockCategoryOptions(sections, selectedId) {
  if (!blockCategorySelect) return;
  blockCategorySelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choisir une categorie";
  blockCategorySelect.appendChild(placeholder);
  sections.forEach((section) => {
    const option = document.createElement("option");
    option.value = section.name || section.id || "";
    option.textContent = section.name || section.id || "Categorie";
    blockCategorySelect.appendChild(option);
  });
  if (selectedId) {
    blockCategorySelect.value = selectedId;
  }
}

function parseBlockPath(path) {
  if (!path) return { category: "", fileName: "" };
  const clean = path.replace(/^\.?\/*/, "").replace(/^block\//, "");
  const parts = clean.split("/");
  if (parts.length === 1) {
    return { category: "general", fileName: parts[0] };
  }
  const fileName = parts.pop();
  const category = parts.join("/");
  return { category, fileName };
}

async function fetchBlockIndex() {
  try {
    const payload = await fetchJson("./api/blocks.php?action=list");
    return { payload, source: "api" };
  } catch (error) {
    const payload = await fetchJson("./block/index.json");
    return { payload, source: "json" };
  }
}

async function fetchWorkflowIndex() {
  try {
    const payload = await fetchJson("./api/workflows.php?action=list");
    return { payload, source: "api" };
  } catch (error) {
    const payload = await fetchJson("./workflows/index.json");
    return { payload, source: "json" };
  }
}

function normalizeWorkflowEntry(entry, index) {
  if (!entry) return null;
  if (typeof entry === "string") {
    return { id: `workflow-${index}`, name: entry, path: entry };
  }
  if (typeof entry === "object") {
    const name = entry.name || entry.title || entry.id || `Workflow ${index + 1}`;
    const path = entry.path || entry.file || entry.src;
    if (!path) return null;
    return { id: entry.id || `workflow-${index}`, name, path };
  }
  return null;
}

function normalizeWorkflowIndex(payload) {
  const entries = Array.isArray(payload?.workflows) ? payload.workflows : [];
  return entries.map(normalizeWorkflowEntry).filter(Boolean);
}

function normalizeBlockWorkflow(workflow) {
  if (!workflow) return null;
  if (typeof workflow === "string") {
    return { path: workflow, name: "" };
  }
  if (typeof workflow === "object") {
    const path = workflow.path || workflow.file || workflow.src || "";
    const name = workflow.name || workflow.title || workflow.id || "";
    if (!path && !name) return null;
    return { path, name };
  }
  return null;
}

function syncBlockWorkflowSelection(shape) {
  if (!blockWorkflowSelect) return;
  const workflow = normalizeBlockWorkflow(shape?.workflow);
  blockWorkflowSelect.value = workflow?.path || "";
}

async function loadBlockWorkflowOptions(selectedPath) {
  if (!blockWorkflowSelect) return;
  blockWorkflowSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Aucun workflow";
  blockWorkflowSelect.appendChild(placeholder);
  try {
    const { payload } = await fetchWorkflowIndex();
    blockWorkflowEntries = normalizeWorkflowIndex(payload);
    blockWorkflowEntries.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.path;
      option.textContent = entry.name || entry.path || "Workflow";
      blockWorkflowSelect.appendChild(option);
    });
    if (selectedPath) {
      blockWorkflowSelect.value = selectedPath;
    }
    blockWorkflowLoaded = true;
  } catch (error) {
    blockWorkflowEntries = [];
    blockWorkflowLoaded = true;
  }
}

async function fetchBlockData(entry) {
  if (!entry) return null;
  if (entry.path) {
    const path = encodeURIComponent(entry.path);
    return fetchJson(`./api/blocks.php?action=read&path=${path}`);
  }
  if (entry.file) {
    return fetchJson(entry.file);
  }
  return null;
}

async function resolveBlockSection(section) {
  if (!section) return null;
  if (section.blocks && section.blocks.length) return section;
  if (!section.source) return { ...section, blocks: [] };
  try {
    const response = await fetch(section.source);
    if (!response.ok) throw new Error("block_section_not_found");
    const payload = await response.json();
    const entries = normalizeBlockIndex(payload)
      .map(normalizeBlockEntry)
      .filter(Boolean);
    return { ...section, blocks: entries };
  } catch (error) {
    return { ...section, blocks: [] };
  }
}

function ensureTutorialShapeType(type) {
  if (!type) return;
  if (type === "logo") return;
  ensureTutorialShapeLibraryEntry({ type, text: type });
}

function buildTutorialFromBlock(block, fallbackTitle) {
  const base = createTutorialTemplate(fallbackTitle || "Forme");
  const tutorial = {
    ...base,
    ...(block?.tutorial || {})
  };
  tutorial.title = tutorial.title || fallbackTitle || "Forme";
  tutorial.steps = normalizeTutorialSteps(tutorial.steps || []);
  if (!Array.isArray(tutorial.conditions)) {
    tutorial.conditions = [];
  }
  return tutorial;
}

function createTutorialShapeFromBlock(block, meta) {
  const type = block?.shape?.type || "rect";
  const defaults = tutorialShapeDefaults[type] || tutorialShapeDefaults.rect;
  const title = block?.tutorial?.title || block?.name || block?.shape?.text || "Forme";
  const shape = {
    id: generateId("tshape"),
    type,
    width: block?.shape?.width || defaults.width,
    height: block?.shape?.height || defaults.height,
    text: block?.shape?.text || title,
    fontSize: block?.shape?.fontSize || 14,
    fontFamily: block?.shape?.fontFamily || "Segoe UI",
    textColor: block?.shape?.textColor || "#ffffff",
    bgColor: block?.shape?.bgColor || "#0e9cef",
    opacity: block?.shape?.opacity ?? 1,
    imageData: block?.shape?.imageData || null,
    blockId: block?.id || "",
    blockPath: meta?.path || "",
    blockCategory: meta?.category || "",
    blockFileName: meta?.fileName || "",
    workflow: normalizeBlockWorkflow(block?.workflow)
  };
  shape.tutorial = buildTutorialFromBlock(block, title);
  return shape;
}

function loadBlockIntoEditor(block, meta) {
  if (!block) return;
  const shape = createTutorialShapeFromBlock(block, meta);
  const libraryEntry = ensureTutorialShapeLibraryEntry(shape);
  if (libraryEntry) {
    shape.libraryId = libraryEntry.id;
  }
  tutorialShapes = [shape];
  activeTutorialShapeId = shape.id;
  activeTutorialShapeType = shape.type || "rect";
  ensureTutorialShapeType(activeTutorialShapeType);
  editingWorkflowShapeId = null;
  suppressWorkflowShapeLoad = true;
  setActiveMode("tutorial");
  suppressWorkflowShapeLoad = false;
  renderBlockPreviewForTargets(shape.tutorial, shape.text || shape.id);
}

function updateBlockMetadataFields(shape) {
  if (!shape) return;
  let category = shape.blockCategory || "";
  let fileName = shape.blockFileName || "";
  if (shape.blockPath && (!category || !fileName)) {
    const parsed = parseBlockPath(shape.blockPath);
    category = category || parsed.category;
    fileName = fileName || parsed.fileName;
  }
  if (blockCategorySelect) {
    if (
      category &&
      !Array.from(blockCategorySelect.options).some(
        (option) => option.value === category
      )
    ) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      blockCategorySelect.appendChild(option);
    }
    blockCategorySelect.value = category || "";
  }
  if (blockFileNameInput) {
    blockFileNameInput.value = fileName || "";
  }
  setBlockSaveHint("");
}

function renderBlockItem(entry) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "block-item";
  const shapePreview = entry.shape
    ? {
        type: entry.shape.type || "rect",
        label: entry.name || entry.id || "Block",
        imageData: entry.shape.imageData || null
      }
    : null;
  const preview = shapePreview
    ? createLibraryPreview(shapePreview)
    : createLibraryPreview({
        type: "rect",
        label: entry.name || entry.id || "Block"
      });
  card.appendChild(preview);
  const entryPath = entry.path || entry.file || "";
  const cached = entryPath ? blockPreviewCache.get(entryPath) : null;
  const applyPreview = (block) => {
    if (!block) return;
    const previewNode = createBlockPreview(block, entry.name || entry.id);
    card.replaceChildren(previewNode);
    if (entryPath) {
      blockPreviewCache.set(entryPath, {
        block,
        previewNode: previewNode.cloneNode(true)
      });
    }
  };
  if (cached?.block) {
    applyPreview(cached.block);
  } else if (entryPath && !shapePreview) {
    fetchBlockData(entry)
      .then((data) => {
        applyPreview(data);
      })
      .catch(() => {});
  }
  if (activeMode === "workflow") {
    card.draggable = true;
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData(
        "application/json",
        JSON.stringify({
          kind: "block",
          path: entry.path || entry.file || "",
          name: entry.name || entry.id || "Block",
          category: entry.category || ""
        })
      );
      event.dataTransfer?.setData("text/plain", entry.name || "Block");
    });
    card.addEventListener("click", (event) => {
      event.preventDefault();
    });
    card.addEventListener("dblclick", async (event) => {
      event.preventDefault();
      if (!hasActiveWorkflowSelection()) {
        alert(
          "Enregistrez ou chargez un workflow pour pouvoir sauvegarder les blocs inline."
        );
      }
      try {
        const data = cached?.block || (await fetchBlockData(entry));
        if (!data) return;
        const parsed = parseBlockPath(entryPath);
        loadBlockIntoEditor(data, {
          path: entry.path || entry.file || "",
          category: entry.category || parsed.category || "",
          fileName: parsed.fileName || ""
        });
      } catch (error) {
        alert("Impossible de charger ce block.");
      }
    });
  } else {
    card.addEventListener("click", async () => {
      try {
        const data = await fetchBlockData(entry);
        if (!data) return;
        const parsed = parseBlockPath(entryPath);
        loadBlockIntoEditor(data, {
          path: entry.path || entry.file || "",
          category: entry.category || parsed.category || "",
          fileName: parsed.fileName || ""
        });
      } catch (error) {
        alert("Impossible de charger ce block.");
      }
    });
  }
  return card;
}

function renderBlockSection(section) {
  if (!blockSections) return;
  const details = document.createElement("details");
  details.className = "block-section";
  details.open = true;
  const summary = document.createElement("summary");
  summary.textContent = section.name;
  const list = document.createElement("div");
  list.className = "block-list";
  section.blocks.forEach((entry) => {
    list.appendChild(renderBlockItem(entry));
  });
  details.appendChild(summary);
  details.appendChild(list);
  blockSections.appendChild(details);
}

async function loadBlocks() {
  if (!blockList && !blockSections) return;
  if (blockList) {
    blockList.innerHTML = "";
  }
  if (blockSections) {
    blockSections.innerHTML = "";
  }
  blockEmpty?.classList.add("hidden");
  try {
    const { payload } = await fetchBlockIndex();
    const sections = normalizeBlockSections(payload);
    const resolvedSections = await Promise.all(
      sections.map((section) => resolveBlockSection(section))
    );
    const visibleSections = resolvedSections.filter(
      (section) => section && section.blocks && section.blocks.length
    );
    if (!visibleSections.length) {
      blockEmpty?.classList.remove("hidden");
      return;
    }
    const activeShape = getActiveTutorialShape();
    const selectedCategory = activeShape?.blockCategory || "";
    syncBlockCategoryOptions(visibleSections, selectedCategory);
    if (blockSections) {
      visibleSections.forEach((section) => {
        renderBlockSection(section);
      });
      return;
    }
    visibleSections.forEach((section) => {
      section.blocks.forEach((entry) => {
        blockList.appendChild(renderBlockItem(entry));
      });
    });
  } catch (error) {
    blockEmpty?.classList.remove("hidden");
  }
}

async function saveBlockToApi() {
  if (isEditingConnection()) {
    setBlockSaveHint("Les liens sont toujours en inline.", false);
    return;
  }
  const shape = getActiveTutorialShape();
  if (!shape) return;
  const payload = buildBlockPayload(shape);
  const category = (blockCategorySelect?.value || "").trim();
  let fileName = (blockFileNameInput?.value || "").trim();
  if (!fileName) {
    fileName = payload.id || slugify(payload.name || "");
  }
  if (!fileName) {
    setBlockSaveHint("Nom de fichier obligatoire.", true);
    return;
  }
  const normalizedName = fileName.endsWith(".json")
    ? fileName
    : `${fileName}.json`;
  try {
    const data = await fetchJson("./api/blocks.php?action=save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        filename: normalizedName,
        data: payload
      })
    });
    if (data?.path) {
      shape.blockPath = data.path;
      const parsed = parseBlockPath(data.path);
      shape.blockCategory = parsed.category;
      shape.blockFileName = parsed.fileName;
      updateBlockMetadataFields(shape);
      setBlockSaveHint(`Enregistre: ${data.path}`);
      syncEditingWorkflowShape({ usePath: true });
      loadBlocks();
      return;
    }
    setBlockSaveHint("Enregistrement termine.", false);
    loadBlocks();
  } catch (error) {
    setBlockSaveHint("Impossible d'enregistrer le block.", true);
  }
}

async function deleteBlockFromApi() {
  const shape = getActiveTutorialShape();
  if (!shape) return;
  const path = shape.blockPath || "";
  if (!path) {
    setBlockSaveHint("Aucun block enregistre a supprimer.", true);
    return;
  }
  const confirmed = window.confirm("Supprimer ce block ?");
  if (!confirmed) return;
  try {
    await fetchJson(`./api/blocks.php?action=delete&path=${encodeURIComponent(path)}`);
    setBlockSaveHint("Block supprime.", false);
    shape.blockId = "";
    shape.blockPath = "";
    shape.blockCategory = "";
    shape.blockFileName = "";
    updateBlockMetadataFields(shape);
    loadBlocks();
  } catch (error) {
    setBlockSaveHint("Impossible de supprimer le block.", true);
  }
}

async function loadWorkflowList() {
  if (!workflowList) return;
  workflowList.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Charger un workflow";
  workflowList.appendChild(placeholder);
  try {
    const { payload } = await fetchWorkflowIndex();
    const entries = Array.isArray(payload?.workflows) ? payload.workflows : [];
    entries.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.path || entry.file || "";
      option.textContent = entry.name || entry.id || entry.path || "Workflow";
      workflowList.appendChild(option);
    });
  } catch (error) {
    // ignore when backend not available
  }
  if (blockWorkflowSelect) {
    const activeShape = getActiveTutorialShape();
    const selectedPath = normalizeBlockWorkflow(activeShape?.workflow)?.path || "";
    await loadBlockWorkflowOptions(selectedPath);
  }
}

async function loadWorkflowFromApi() {
  if (!workflowList) return;
  const path = workflowList.value;
  if (!path) return;
  try {
    let data = null;
    try {
      data = await fetchJson(
        `./api/workflows.php?action=read&path=${encodeURIComponent(path)}`
      );
    } catch (apiError) {
      data = await fetchJson(path);
    }
    applyWorkflowData(data);
    if (workflowNameInput) {
      const loadedName = (data?.name || data?.title || "").trim();
      if (loadedName) {
        workflowNameInput.value = loadedName;
      } else if (workflowList.selectedOptions.length) {
        workflowNameInput.value = workflowList.selectedOptions[0].textContent;
      }
    }
  } catch (error) {
    alert("Impossible de charger ce workflow.");
  }
}

async function deleteWorkflowFromApi() {
  if (!workflowList) return;
  const path = workflowList.value;
  if (!path) return;
  const name = workflowList.selectedOptions?.[0]?.textContent || path;
  const confirmed = window.confirm(`Supprimer "${name}" ?`);
  if (!confirmed) return;
  try {
    await fetchJson(
      `./api/workflows.php?action=delete&path=${encodeURIComponent(path)}`
    );
    loadWorkflowList();
  } catch (error) {
    alert("Impossible de supprimer ce workflow.");
  }
}

async function saveWorkflowToApi() {
  syncEditingWorkflowShape();
  const name =
    (workflowNameInput?.value || "").trim() ||
    workflowList?.selectedOptions?.[0]?.textContent ||
    "workflow";
  const filename = `${slugify(name || "workflow")}.json`;
  try {
    await fetchJson("./api/workflows.php?action=save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename,
        data: {
          name,
          shapes,
          connections,
          groups
        }
      })
    });
    loadWorkflowList();
  } catch (error) {
    alert("Impossible d'enregistrer le workflow.");
  }
}

function createWorkflowShapeFromBlock(block, position) {
  const id = generateId("shape");
  const blockTitle = block?.tutorial?.title || block?.name || block?.shape?.text || "Forme";
  const shape = {
    id,
    type: block?.shape?.type || "rect",
    x: 120,
    y: 120,
    width: block?.shape?.width || 160,
    height: block?.shape?.height || 70,
    text: blockTitle,
    fontSize: block?.shape?.fontSize || 14,
    fontFamily: block?.shape?.fontFamily || "Segoe UI",
    textColor: block?.shape?.textColor || "#ffffff",
    bgColor: block?.shape?.bgColor || "#0e9cef",
    opacity: block?.shape?.opacity ?? 1,
    group: "",
    imageData: block?.shape?.imageData || null,
    workflow: normalizeBlockWorkflow(block?.workflow)
  };
  if (shape.imageData) {
    const ratio = parseSvgRatioFromDataUrl(shape.imageData);
    if (ratio) {
      shape.imageRatio = ratio;
    }
  }
  if (position) {
    shape.x = position.x - shape.width / 2;
    shape.y = position.y - shape.height / 2;
  }
  if (block?.tutorial) {
    shape.tutorial = {
      ...block.tutorial,
      steps: normalizeTutorialSteps(block.tutorial.steps || [])
    };
  }
  shapes.push(shape);
  renderShapes();
  selectShape(id);
}


function ensureShapeTutorial(shape) {
  if (!shape.tutorial) {
    shape.tutorial = createTutorialTemplate(shape.text);
  }
  if (!Array.isArray(shape.tutorial.steps)) {
    shape.tutorial.steps = [];
  } else if (needsTutorialNormalization(shape.tutorial.steps)) {
    shape.tutorial.steps = normalizeTutorialSteps(shape.tutorial.steps);
  }
  if (!Array.isArray(shape.tutorial.conditions)) {
    shape.tutorial.conditions = [];
  }
  return shape.tutorial;
}


function needsTutorialNormalization(steps) {
  if (!Array.isArray(steps)) return true;
  return steps.some((step) => step && step.type);
}

function normalizeTutorialSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.map((step, index) => {
    if (step && step.items) {
      return {
        title: step.title || `Etape ${index + 1}`,
        items: Array.isArray(step.items) ? step.items : [],
        collapsed: Boolean(step.collapsed),
        substeps: normalizeTutorialSteps(step.substeps || [])
      };
    }
    if (step && step.type) {
      return {
        title: `Etape ${index + 1}`,
        items: [step],
        collapsed: Boolean(step.collapsed),
        substeps: []
      };
    }
    return {
      title: step?.title || `Etape ${index + 1}`,
      items: [],
      collapsed: Boolean(step?.collapsed),
      substeps: normalizeTutorialSteps(step?.substeps || [])
    };
  });
}

function setActiveMode(mode) {
  activeMode = mode;
  modeTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });
  modePanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.mode === mode);
  });
  if (tutorialShapeSidebar) {
    tutorialShapeSidebar.classList.toggle("hidden", mode === "preview");
  }
  if (mode !== "tutorial") {
    syncEditingWorkflowShape();
    syncEditingWorkflowConnection();
    editingWorkflowShapeId = null;
    editingWorkflowConnectionId = null;
    toggleTutorialShapeForm(false);
    toggleTutorialShapeSidebarLock(false);
  }
  if (mode === "tutorial") {
    refreshTutorialShapeOptions();
    if (editingWorkflowConnectionId) {
      renderTutorialEditor();
      return;
    }
    if (selectedShapeId && !suppressWorkflowShapeLoad) {
      void loadWorkflowShapeIntoEditor(selectedShapeId);
      return;
    }
    renderTutorialEditor();
    return;
  }
  if (mode === "workflow") {
    refreshTutorialShapeOptions();
  }
}

function refreshTutorialShapeOptions() {
  renderTutorialShapeLibrary();
  refreshTutorialShapeCategoryOptions();
}

function getActiveTutorialShape() {
  if (activeTutorialShapeId) {
    return tutorialShapes.find((shape) => shape.id === activeTutorialShapeId);
  }
  return getTutorialShapeByType(activeTutorialShapeType) || tutorialShapes[0];
}

function applyInlineStyle(container, styles) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;
  const span = document.createElement("span");
  Object.assign(span.style, styles);
  span.appendChild(range.extractContents());
  range.insertNode(span);
  selection.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(span);
  nextRange.collapse(false);
  selection.addRange(nextRange);
}

function normalizeTextStepHtml(html) {
  return html.replace(/<div>|<\/div>|<br>/gi, " ").trim();
}

function applyTextareaWrap(textarea, prefix, suffix) {
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const value = textarea.value || "";
  const before = value.slice(0, start);
  const selection = value.slice(start, end) || "";
  const after = value.slice(end);
  const nextValue = `${before}${prefix}${selection}${suffix}${after}`;
  textarea.value = nextValue;
  textarea.focus();
  const caret = start + prefix.length + selection.length + suffix.length;
  textarea.setSelectionRange(caret, caret);
  return nextValue;
}

function applyTextareaWrapWithCaret(textarea, prefix, suffix) {
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const value = textarea.value || "";
  const before = value.slice(0, start);
  const selection = value.slice(start, end) || "";
  const after = value.slice(end);
  const nextValue = `${before}${prefix}${selection}${suffix}${after}`;
  textarea.value = nextValue;
  textarea.focus();
  const hasSelection = Boolean(selection.length);
  const caret = hasSelection
    ? start + prefix.length + selection.length + suffix.length
    : start + prefix.length;
  textarea.setSelectionRange(caret, caret);
  return nextValue;
}

function resizeImageDataUrl(dataUrl, scale = 1) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== "string") {
      resolve(dataUrl);
      return;
    }
    const normalizedScale = Math.max(0.1, Math.min(1, Number(scale) || 1));
    if (normalizedScale === 1) {
      resolve(dataUrl);
      return;
    }
    const mimeMatch = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);/);
    const mime = mimeMatch?.[1] || "image/png";
    const img = new Image();
    img.onload = () => {
      const width = Math.max(1, Math.round(img.width * normalizedScale));
      const height = Math.max(1, Math.round(img.height * normalizedScale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      if (mime === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL(mime));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
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

function closeCropModal() {
  if (!cropModal) return;
  cropModal.classList.add("hidden");
  cropState = null;
}

function openCropModal(imageSrc, onApply) {
  if (!cropModal || !cropCanvas) return;
  const ctx = cropCanvas.getContext("2d");
  if (!ctx) return;
  const img = new Image();
  img.onload = () => {
    const maxWidth = 640;
    const scale = Math.min(1, maxWidth / img.width);
    cropCanvas.width = img.width * scale;
    cropCanvas.height = img.height * scale;
    ctx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    ctx.drawImage(img, 0, 0, cropCanvas.width, cropCanvas.height);
    cropState = {
      image: img,
      scale,
      startX: 0,
      startY: 0,
      endX: cropCanvas.width,
      endY: cropCanvas.height,
      dragging: false,
      onApply
    };
    cropModal.classList.remove("hidden");
    drawCropSelection();
  };
  img.src = imageSrc;
}

function closeCategoryModal() {
  if (!categoryModal) return;
  categoryModal.classList.add("hidden");
}

function openCategoryModal() {
  if (!categoryModal || !categoryNameInput) return;
  categoryNameInput.value = "";
  categoryModal.classList.remove("hidden");
  categoryNameInput.focus();
}

function ensureCategoryOption(name) {
  if (!blockCategorySelect) return;
  const normalized = String(name || "").trim();
  if (!normalized) return;
  const exists = Array.from(blockCategorySelect.options).some(
    (option) => option.value === normalized
  );
  if (!exists) {
    const option = document.createElement("option");
    option.value = normalized;
    option.textContent = normalized;
    blockCategorySelect.appendChild(option);
  }
  blockCategorySelect.value = normalized;
  const shape = getActiveTutorialShape();
  if (shape) {
    shape.blockCategory = normalized;
  }
}

function drawCropSelection() {
  if (!cropState || !cropCanvas) return;
  const ctx = cropCanvas.getContext("2d");
  if (!ctx) return;
  const { image, scale, startX, startY, endX, endY } = cropState;
  ctx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  ctx.drawImage(image, 0, 0, cropCanvas.width, cropCanvas.height);
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(endX - startX);
  const h = Math.abs(endY - startY);
  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.25)";
  ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
  ctx.clearRect(x, y, w, h);
  ctx.strokeStyle = "#0e9cef";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
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
    marker.setAttribute("markerWidth", "12");
    marker.setAttribute("markerHeight", "12");
    marker.setAttribute("refX", "12");
    marker.setAttribute("refY", "6");
    marker.setAttribute("orient", "auto");
    marker.setAttribute("markerUnits", "userSpaceOnUse");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M0,0 L12,6 L0,12 Z");
    path.setAttribute("fill", color);
    marker.appendChild(path);
    defs.appendChild(marker);
  }
  return id;
}

function renderTutorialEditor() {
  if (!tutorialStepsHost) return;
  let shape = getActiveTutorialShape();
  if (!shape) {
    createTutorialShape(activeTutorialShapeType || "rect");
    shape = getActiveTutorialShape();
  }
  if (!shape) return;
  const editingConnection = isEditingConnection();
  activeTutorialShapeId = shape.id;
  activeTutorialShapeType = shape.type || "rect";
  if (tutorialShapeSelect) {
    tutorialShapeSelect.value = shape.type || "rect";
  }
  const tutorial = ensureShapeTutorial(shape);
  if (tutorialTitleInput) {
    tutorialTitleInput.value = tutorial.title || "";
  }
  if (tutorialIntroInput) {
    tutorialIntroInput.value = tutorial.intro || "";
  }
  toggleTutorialShapeSidebarLock(editingConnection);
  toggleBlockSaveControls(!editingConnection);
  if (!editingConnection) {
    updateBlockMetadataFields(shape);
    if (!blockWorkflowLoaded) {
      const workflow = normalizeBlockWorkflow(shape?.workflow);
      loadBlockWorkflowOptions(workflow?.path || "");
    } else {
      syncBlockWorkflowSelection(shape);
    }
  } else {
    if (blockCategorySelect) blockCategorySelect.value = "";
    if (blockFileNameInput) blockFileNameInput.value = "";
    if (blockWorkflowSelect) blockWorkflowSelect.value = "";
  }
  if (!tutorialStepsHost.dataset.dndReady) {
    tutorialStepsHost.dataset.dndReady = "true";
    tutorialStepsHost.addEventListener("dragover", (event) => {
      if (!tutorialStepDrag) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    tutorialStepsHost.addEventListener("drop", (event) => {
      if (!tutorialStepDrag) return;
      event.preventDefault();
      const shapeRef = getActiveTutorialShape();
      moveStepBetweenParents(shapeRef, tutorialStepDrag.path, [], shapeRef?.tutorial?.steps?.length || 0);
      renderTutorialEditor();
    });
  }
  tutorialStepsHost.innerHTML = "";
  tutorial.steps.forEach((step, stepIndex) => {
    renderTutorialStep(step, [stepIndex], tutorialStepsHost);
  });
  renderTutorialPreview(shape, tutorial.title);
  renderBlockPreviewForTargets(tutorial, tutorial.title || shape.text || shape.id);
  renderTutorialShapeLibrary();
}

function ensureStepItems(step) {
  if (!Array.isArray(step.items) || !step.items.length) {
    step.items = [{ type: "text", html: "" }];
  }
}

function renderTutorialStep(step, path, host) {
  const stepIndex = path[path.length - 1];
  const stepCard = document.createElement("div");
  stepCard.className = "tutorial-step";
  stepCard.dataset.index = String(stepIndex);
  stepCard.dataset.path = path.join(".");
  stepCard.draggable = false;
  stepCard.addEventListener("dragover", (event) => {
    if (!tutorialStepDrag) return;
    const toParent = path.slice(0, -1);
    if (isSamePath(tutorialStepDrag.path, path)) return;
    if (isSamePath(tutorialStepDrag.path, toParent)) return;
    if (isPathAncestor(tutorialStepDrag.path, toParent)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    stepCard.classList.add("drag-over");
  });
  stepCard.addEventListener("dragleave", (event) => {
    if (!stepCard.contains(event.relatedTarget)) {
      stepCard.classList.remove("drag-over");
    }
  });
  stepCard.addEventListener("drop", (event) => {
    if (!tutorialStepDrag) return;
    const toParent = path.slice(0, -1);
    if (isSamePath(tutorialStepDrag.path, path)) return;
    if (isSamePath(tutorialStepDrag.path, toParent)) return;
    if (isPathAncestor(tutorialStepDrag.path, toParent)) return;
    event.preventDefault();
    event.stopPropagation();
    stepCard.classList.remove("drag-over");
    const shapeRef = getActiveTutorialShape();
    moveStepBetweenParents(shapeRef, tutorialStepDrag.path, toParent, stepIndex);
    renderTutorialEditor();
  });

  const header = document.createElement("div");
  header.className = "tutorial-step-header drag-zone";
  header.addEventListener("click", () => {
    activeStepPath = [...path];
  });
  const dragHandle = document.createElement("button");
  dragHandle.type = "button";
  dragHandle.className = "shape-btn drag-handle";
  dragHandle.textContent = "↕";
  dragHandle.title = "Deplacer l'etape";
  dragHandle.draggable = true;
  dragHandle.addEventListener("dragstart", (event) => {
    tutorialStepDrag = { path: [...path] };
    stepCard.classList.add("dragging");
    event.dataTransfer.setData("text/plain", "tutorial-step");
    event.dataTransfer.effectAllowed = "move";
  });
  dragHandle.addEventListener("dragend", () => {
    stepCard.classList.remove("dragging", "drag-over");
    tutorialStepDrag = null;
  });
  const titleInput = document.createElement("input");
  titleInput.className = "tutorial-step-title";
  titleInput.type = "text";
  titleInput.value = step.title || `Etape ${stepIndex + 1}`;
  titleInput.placeholder = "Nom de l'etape";
  titleInput.addEventListener("input", () => {
    step.title = titleInput.value;
  });

  const removeButton = document.createElement("button");
  removeButton.className = "shape-btn";
  removeButton.textContent = "Supprimer";
  removeButton.addEventListener("click", () => {
    removeStepByPath(path);
    renderTutorialEditor();
  });

  header.appendChild(dragHandle);
  header.appendChild(titleInput);
  const toggleButton = document.createElement("button");
  toggleButton.className = "shape-btn toggle-step";
  toggleButton.type = "button";
  toggleButton.textContent = step.collapsed ? "▼" : "▲";
  toggleButton.title = step.collapsed ? "Deplier" : "Replier";
  toggleButton.addEventListener("click", () => {
    step.collapsed = !step.collapsed;
    renderTutorialEditor();
  });
  header.appendChild(toggleButton);
  header.appendChild(removeButton);
  stepCard.appendChild(header);

  const body = document.createElement("div");
  body.className = "tutorial-step-body";

  const addRow = document.createElement("div");
  addRow.className = "tutorial-step-actions";
  const addLineButton = document.createElement("button");
  addLineButton.className = "shape-btn";
  addLineButton.textContent = "Ajouter texte";
  const addImageButton = document.createElement("button");
  addImageButton.className = "shape-btn";
  addImageButton.textContent = "Ajouter image";
  const addSubstepButton = document.createElement("button");
  addSubstepButton.className = "shape-btn";
  addSubstepButton.textContent = "Ajouter sous-etape";
  addRow.appendChild(addLineButton);
  addRow.appendChild(addImageButton);
  addRow.appendChild(addSubstepButton);
  body.appendChild(addRow);

  const itemsHost = document.createElement("div");
  itemsHost.className = "tutorial-step-items";
  itemsHost.dataset.stepPath = path.join(".");
  itemsHost.addEventListener("dragover", (event) => {
    if (!tutorialItemDrag) return;
    if (event.target !== itemsHost) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });
  itemsHost.addEventListener("drop", (event) => {
    if (!tutorialItemDrag) return;
    if (event.target !== itemsHost) return;
    event.preventDefault();
    const shapeRef = getActiveTutorialShape();
    moveItemBetweenSteps(
      shapeRef,
      tutorialItemDrag.stepPath,
      tutorialItemDrag.itemIndex,
      path,
      getTutorialStepByPath(shapeRef, path)?.items?.length || 0
    );
    renderTutorialEditor();
  });
  body.appendChild(itemsHost);

  if (step.collapsed) {
    stepCard.classList.add("collapsed");
  }
  stepCard.appendChild(body);

  ensureStepItems(step);

  addLineButton.addEventListener("click", () => {
    step.items.push({ type: "text", html: "" });
    renderTutorialEditor();
  });

  addImageButton.addEventListener("click", () => {
    step.items.push({
      type: "image",
      src: "",
      widthPercent: 80,
      overlays: []
    });
    renderTutorialEditor();
  });

  addSubstepButton.addEventListener("click", () => {
    if (!Array.isArray(step.substeps)) {
      step.substeps = [];
    }
    step.substeps.push({
      title: `Sous-etape ${step.substeps.length + 1}`,
      items: [{ type: "text", html: "" }],
      substeps: [],
      collapsed: true
    });
    renderTutorialEditor();
  });

  step.items.forEach((item, itemIndex) => {
    if (item.type === "image") {
      renderImageItem(itemsHost, getActiveTutorialShape(), item, path, itemIndex);
    } else {
      renderTextItem(itemsHost, getActiveTutorialShape(), item, path, itemIndex);
    }
  });

  if (Array.isArray(step.substeps) && step.substeps.length) {
    const subHost = document.createElement("div");
    subHost.className = "tutorial-substeps";
    subHost.dataset.parentPath = path.join(".");
    subHost.addEventListener("dragover", (event) => {
      if (!tutorialStepDrag) return;
      if (isSamePath(tutorialStepDrag.path, path)) return;
      if (isPathAncestor(tutorialStepDrag.path, path)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    subHost.addEventListener("drop", (event) => {
      if (!tutorialStepDrag) return;
      if (isSamePath(tutorialStepDrag.path, path)) return;
      if (isPathAncestor(tutorialStepDrag.path, path)) return;
      event.preventDefault();
      const shapeRef = getActiveTutorialShape();
      moveStepBetweenParents(
        shapeRef,
        tutorialStepDrag.path,
        path,
        getStepsCollectionByPath(shapeRef, path)?.length || 0
      );
      renderTutorialEditor();
    });
    step.substeps.forEach((substep, subIndex) => {
      renderTutorialStep(substep, [...path, subIndex], subHost);
    });
    body.appendChild(subHost);
  }

  host.appendChild(stepCard);
}

function removeStepByPath(path) {
  const shape = getActiveTutorialShape();
  if (!shape?.tutorial?.steps) return;
  if (path.length === 1) {
    shape.tutorial.steps.splice(path[0], 1);
    return;
  }
  const [parentIndex, childIndex] = path;
  const parent = shape.tutorial.steps[parentIndex];
  if (!parent?.substeps) return;
  parent.substeps.splice(childIndex, 1);
}

function getTutorialStepByPath(shape, path) {
  if (!shape?.tutorial?.steps || !Array.isArray(path)) return null;
  let current = shape.tutorial.steps;
  let step = null;
  path.forEach((index, depth) => {
    step = current?.[index];
    if (!step) return;
    if (depth < path.length - 1) {
      current = step.substeps;
    }
  });
  return step;
}

function isSamePath(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function isPathAncestor(ancestor, target) {
  if (!Array.isArray(ancestor) || !Array.isArray(target)) return false;
  if (ancestor.length >= target.length) return false;
  return ancestor.every((value, index) => value === target[index]);
}

function getStepsCollectionByPath(shape, parentPath) {
  if (!shape?.tutorial?.steps) return null;
  if (!Array.isArray(parentPath) || parentPath.length === 0) {
    return shape.tutorial.steps;
  }
  let current = shape.tutorial.steps;
  for (let i = 0; i < parentPath.length; i += 1) {
    const index = parentPath[i];
    const step = current?.[index];
    if (!step) return null;
    if (!Array.isArray(step.substeps)) step.substeps = [];
    if (i === parentPath.length - 1) {
      return step.substeps;
    }
    current = step.substeps;
  }
  return null;
}

function moveArrayItem(list, fromIndex, toIndex) {
  if (!Array.isArray(list)) return;
  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || fromIndex >= list.length) return;
  if (toIndex < 0 || toIndex > list.length) return;
  let targetIndex = toIndex;
  if (fromIndex < toIndex) {
    targetIndex -= 1;
  }
  const [moved] = list.splice(fromIndex, 1);
  list.splice(targetIndex, 0, moved);
}

function moveStepBetweenParents(shape, fromPath, toParentPath, toIndex) {
  if (!shape) return;
  if (!Array.isArray(fromPath) || fromPath.length === 0) return;
  const fromParent = fromPath.slice(0, -1);
  const fromIndex = fromPath[fromPath.length - 1];
  const fromList = getStepsCollectionByPath(shape, fromParent);
  const toList = getStepsCollectionByPath(shape, toParentPath);
  if (!fromList || !toList) return;
  if (fromList === toList) {
    moveArrayItem(fromList, fromIndex, toIndex);
    return;
  }
  const [moved] = fromList.splice(fromIndex, 1);
  if (!moved) return;
  const targetIndex = Math.max(0, Math.min(toIndex, toList.length));
  toList.splice(targetIndex, 0, moved);
}

function moveItemBetweenSteps(shape, fromStepPath, fromIndex, toStepPath, toIndex) {
  if (!shape) return;
  const fromStep = getTutorialStepByPath(shape, fromStepPath);
  const toStep = getTutorialStepByPath(shape, toStepPath);
  if (!fromStep?.items || !toStep) return;
  if (!Array.isArray(toStep.items)) {
    toStep.items = [];
  }
  if (fromStep === toStep) {
    moveArrayItem(fromStep.items, fromIndex, toIndex);
    return;
  }
  const [moved] = fromStep.items.splice(fromIndex, 1);
  if (!moved) return;
  const targetIndex = Math.max(0, Math.min(toIndex, toStep.items.length));
  toStep.items.splice(targetIndex, 0, moved);
}

function isDragHandleTarget(target) {
  if (!target) return false;
  const element = target.nodeType === 3 ? target.parentElement : target;
  if (!element) return false;
  if (element.closest && element.closest(".drag-handle")) return true;
  const dragZone = element.closest && element.closest(".drag-zone");
  if (!dragZone) return false;
  const interactive = element.closest("input, textarea, select, button");
  return !interactive;
}

function renderTutorialPreview(shape, titleOverride) {
  if (!tutorialPreview) return;
  tutorialPreview.innerHTML = "";
  if (!shape) return;
  const preview = document.createElement("div");
  preview.className = `shape-preview ${shape.type || "rect"}`;
  preview.style.background = shape.bgColor || "#0e9cef";
  preview.style.color = shape.textColor || "#ffffff";
  preview.style.fontFamily = shape.fontFamily || "Segoe UI";
  preview.style.fontSize = `${shape.fontSize || 14}px`;
  preview.style.opacity = shape.opacity ?? 1;
  preview.style.width = `${Math.max(120, Math.min(220, shape.width || 160))}px`;
  preview.style.height = `${Math.max(60, Math.min(160, shape.height || 70))}px`;
  if (shape.imageData) {
    preview.style.backgroundImage = `url(${shape.imageData})`;
    preview.style.backgroundSize = "contain";
    preview.style.backgroundRepeat = "no-repeat";
    preview.style.backgroundPosition = "center";
    preview.style.backgroundColor = "#ffffff";
  }

  const text = document.createElement("div");
  text.className = "shape-preview-text";
  text.textContent = titleOverride || shape.text || "Forme";
  preview.appendChild(text);
  tutorialPreview.appendChild(preview);
}

function renderTutorialDetailsPreview(tutorial, fallbackTitle, titleEl, contentEl) {
  if (!titleEl || !contentEl) return;
  titleEl.textContent = tutorial?.title || fallbackTitle || "Apercu";
  contentEl.innerHTML = "";
  if (tutorial?.intro) {
    const intro = document.createElement("p");
    intro.className = "brick-note";
    intro.textContent = tutorial.intro;
    contentEl.appendChild(intro);
  }
  const steps = Array.isArray(tutorial?.steps) ? tutorial.steps : [];
  if (!steps.length) {
    const note = document.createElement("p");
    note.className = "brick-note";
    note.textContent = "Aucune etape definie pour cette forme.";
    contentEl.appendChild(note);
    return;
  }
  const list = document.createElement("div");
  list.className = "brick-tutorial";
  steps.forEach((step, index) => {
    renderTutorialDetailsStep(step, index, list, 0);
  });
  contentEl.appendChild(list);
}

function renderTutorialDetailsStep(step, index, host, depth) {
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
          overlayEl.style.color = overlay.color || "#ff3b30";
          if (overlay.type === "text") {
            const textColor = overlay.textColor || overlay.color || "#ff3b30";
            overlayEl.textContent = overlay.text || "";
            overlayEl.style.color = textColor;
            overlayEl.style.borderColor = textColor;
            overlayEl.style.fontSize = `${overlay.textSize || 12}px`;
            overlayEl.style.backgroundColor =
              overlay.textBgColor || "rgba(255, 255, 255, 0.85)";
          }
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
      renderTutorialDetailsStep(substep, subIndex + 1, sublist, depth + 1);
    });
    body.appendChild(sublist);
  }

  details.appendChild(body);
  host.appendChild(details);
}

function renderBlockPreviewForTargets(tutorial, fallbackTitle) {
  if (workflowPreviewTitle && workflowPreviewContent) {
    renderTutorialDetailsPreview(
      tutorial,
      fallbackTitle,
      workflowPreviewTitle,
      workflowPreviewContent
    );
  }
  if (previewTitle && previewContent) {
    renderTutorialDetailsPreview(tutorial, fallbackTitle, previewTitle, previewContent);
  }
}

function clearBlockPreview() {
  const message = "Cliquez sur un block pour afficher son rendu.";
  if (workflowPreviewTitle) workflowPreviewTitle.textContent = "Apercu";
  if (workflowPreviewContent) {
    workflowPreviewContent.innerHTML = "";
    workflowPreviewContent.textContent = message;
  }
  if (previewTitle) previewTitle.textContent = "Apercu";
  if (previewContent) {
    previewContent.innerHTML = "";
    previewContent.textContent = message;
  }
}

function buildBlockPayload(shape) {
  const tutorial = ensureShapeTutorial(shape);
  const title = tutorial.title || shape.text || shape.id;
  const id = shape.blockId || slugify(title);
  return {
    version: 1,
    id,
    name: title || "Forme",
    shape: {
      type: shape.type,
      text: shape.text,
      width: shape.width,
      height: shape.height,
      fontSize: shape.fontSize,
      fontFamily: shape.fontFamily,
      textColor: shape.textColor,
      bgColor: shape.bgColor,
      opacity: shape.opacity,
      imageData: shape.imageData || null
    },
    workflow: normalizeBlockWorkflow(shape.workflow),
    tutorial
  };
}

function exportBlockJson(shape) {
  if (!shape) return;
  const payload = buildBlockPayload(shape);
  shape.blockId = payload.id;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${payload.name ? slugify(payload.name) : payload.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function resetTutorialForm() {
  let shape = getActiveTutorialShape();
  if (!shape) {
    createTutorialShape(activeTutorialShapeType || "rect");
    shape = getActiveTutorialShape();
  }
  if (!shape) return;
  shape.tutorial = {
    title: "",
    intro: "",
    steps: [],
    conditions: []
  };
  shape.blockId = "";
  shape.blockPath = "";
  shape.blockCategory = "";
  shape.blockFileName = "";
  shape.workflow = null;
  activeStepPath = null;
  activeImageStep = null;
  selectedOverlay = null;
  overlayDrag = null;
  overlayResize = null;
  updateBlockMetadataFields(shape);
  renderTutorialEditor();
}

function renderTextItem(itemsHost, shape, item, stepPath, itemIndex) {
  if (!item.html && item.text) {
    item.html = item.text;
  }
  const wrapper = document.createElement("div");
  wrapper.className = "tutorial-item";
  wrapper.draggable = false;
  wrapper.addEventListener("dragover", (event) => {
    if (!tutorialItemDrag) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    wrapper.classList.add("drag-over");
  });
  wrapper.addEventListener("dragleave", (event) => {
    if (!wrapper.contains(event.relatedTarget)) {
      wrapper.classList.remove("drag-over");
    }
  });
  wrapper.addEventListener("drop", (event) => {
    if (!tutorialItemDrag) return;
    event.preventDefault();
    event.stopPropagation();
    wrapper.classList.remove("drag-over");
    const shapeRef = getActiveTutorialShape();
    moveItemBetweenSteps(
      shapeRef,
      tutorialItemDrag.stepPath,
      tutorialItemDrag.itemIndex,
      stepPath,
      itemIndex
    );
    renderTutorialEditor();
  });

  const toolbar = document.createElement("div");
  toolbar.className = "tutorial-step-toolbar drag-zone";

  const dragHandle = document.createElement("button");
  dragHandle.type = "button";
  dragHandle.className = "drag-handle";
  dragHandle.textContent = "↕";
  dragHandle.title = "Deplacer le contenu";
  dragHandle.draggable = true;
  dragHandle.addEventListener("dragstart", (event) => {
    tutorialItemDrag = { stepPath: [...stepPath], itemIndex };
    wrapper.classList.add("dragging");
    event.dataTransfer.setData("text/plain", "tutorial-item");
    event.dataTransfer.effectAllowed = "move";
  });
  dragHandle.addEventListener("dragend", () => {
    wrapper.classList.remove("dragging", "drag-over");
    tutorialItemDrag = null;
  });
  const boldButton = document.createElement("button");
  boldButton.type = "button";
  boldButton.textContent = "Gras";
  const italicButton = document.createElement("button");
  italicButton.type = "button";
  italicButton.textContent = "Italique";
  const highlightButton = document.createElement("button");
  highlightButton.type = "button";
  highlightButton.textContent = "Surligne";
  const sizeSelect = document.createElement("select");
  [12, 14, 16, 18, 20, 24].forEach((size) => {
    const option = document.createElement("option");
    option.value = String(size);
    option.textContent = `${size}px`;
    sizeSelect.appendChild(option);
  });
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = "#000000";
  colorInput.title = "Couleur du texte";
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Supprimer";
  removeButton.addEventListener("click", () => {
    const shapeRef = tutorialShapes.find((s) => s.id === shape.id);
    if (!shapeRef) return;
    const step = getTutorialStepByPath(shapeRef, stepPath);
    if (!step?.items) return;
    step.items.splice(itemIndex, 1);
    renderTutorialEditor();
  });

  const editor = document.createElement("textarea");
  editor.className = "tutorial-textarea";
  editor.rows = 3;
  editor.value = item.text || item.html || "";
  editor.addEventListener("input", () => {
    item.text = editor.value;
  });
  editor.addEventListener("focus", () => {
    activeImageStep = null;
  });

  boldButton.addEventListener("click", () => {
    editor.focus();
    item.text = applyTextareaWrap(editor, "**", "**");
  });
  italicButton.addEventListener("click", () => {
    editor.focus();
    item.text = applyTextareaWrap(editor, "*", "*");
  });
  highlightButton.addEventListener("click", () => {
    editor.focus();
    item.text = applyTextareaWrap(editor, "==", "==");
  });
  sizeSelect.addEventListener("change", () => {
    editor.focus();
    item.text = applyTextareaWrap(editor, `[size:${sizeSelect.value}]`, "[/size]");
  });
  colorInput.addEventListener("change", () => {
    editor.focus();
    item.text = applyTextareaWrapWithCaret(
      editor,
      `[color:${colorInput.value}]`,
      "[/color]"
    );
  });

  toolbar.appendChild(dragHandle);
  toolbar.appendChild(boldButton);
  toolbar.appendChild(italicButton);
  toolbar.appendChild(highlightButton);
  toolbar.appendChild(sizeSelect);
  toolbar.appendChild(colorInput);
  toolbar.appendChild(removeButton);
  wrapper.appendChild(toolbar);
  wrapper.appendChild(editor);
  itemsHost.appendChild(wrapper);
}

function ensureImageItem(item) {
  if (!item.src) {
    item.src = "";
  }
  if (!item.widthPercent) {
    item.widthPercent = 80;
  }
  if (item.heightPercent == null) {
    item.heightPercent = 0;
  }
  if (!Array.isArray(item.overlays)) {
    item.overlays = [];
  }
}

function renderImageItem(itemsHost, shape, item, stepPath, itemIndex) {
  ensureImageItem(item);
  const wrapper = document.createElement("div");
  wrapper.className = "tutorial-item";
  wrapper.draggable = false;
  wrapper.addEventListener("dragover", (event) => {
    if (!tutorialItemDrag) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    wrapper.classList.add("drag-over");
  });
  wrapper.addEventListener("dragleave", (event) => {
    if (!wrapper.contains(event.relatedTarget)) {
      wrapper.classList.remove("drag-over");
    }
  });
  wrapper.addEventListener("drop", (event) => {
    if (!tutorialItemDrag) return;
    event.preventDefault();
    event.stopPropagation();
    wrapper.classList.remove("drag-over");
    const shapeRef = tutorialShapes.find((s) => s.id === shape.id);
    moveItemBetweenSteps(
      shapeRef,
      tutorialItemDrag.stepPath,
      tutorialItemDrag.itemIndex,
      stepPath,
      itemIndex
    );
    renderTutorialEditor();
  });
  const toolbar = document.createElement("div");
  toolbar.className = "tutorial-step-toolbar drag-zone";

  const dragHandle = document.createElement("button");
  dragHandle.type = "button";
  dragHandle.className = "drag-handle";
  dragHandle.textContent = "↕";
  dragHandle.title = "Deplacer le contenu";
  dragHandle.draggable = true;
  dragHandle.addEventListener("dragstart", (event) => {
    tutorialItemDrag = { stepPath: [...stepPath], itemIndex };
    wrapper.classList.add("dragging");
    event.dataTransfer.setData("text/plain", "tutorial-item");
    event.dataTransfer.effectAllowed = "move";
  });
  dragHandle.addEventListener("dragend", () => {
    wrapper.classList.remove("dragging", "drag-over");
    tutorialItemDrag = null;
  });
  const addRectButton = document.createElement("button");
  addRectButton.type = "button";
  addRectButton.textContent = "Rectangle";
  const addCircleButton = document.createElement("button");
  addCircleButton.type = "button";
  addCircleButton.textContent = "Cercle";
  const addPointerButton = document.createElement("button");
  addPointerButton.type = "button";
  addPointerButton.textContent = "Pointe";
  const addArrowButton = document.createElement("button");
  addArrowButton.type = "button";
  addArrowButton.textContent = "Fleche";
  const addTextButton = document.createElement("button");
  addTextButton.type = "button";
  addTextButton.textContent = "Texte";
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = "#ff3b30";
  const widthSelect = document.createElement("select");
  const widthPresets = [60, 70, 80, 90, 100];
  widthPresets.forEach((size) => {
    const option = document.createElement("option");
    option.value = String(size);
    option.textContent = `${size}%`;
    widthSelect.appendChild(option);
  });
  const customWidthOption = document.createElement("option");
  customWidthOption.value = "custom";
  customWidthOption.textContent = "Perso";
  widthSelect.appendChild(customWidthOption);
  widthSelect.value = String(item.widthPercent || 80);
  const widthRange = document.createElement("input");
  widthRange.type = "range";
  widthRange.min = "20";
  widthRange.max = "100";
  widthRange.step = "1";
  widthRange.value = String(item.widthPercent || 80);
  widthRange.title = "Taille image";
  const heightRange = document.createElement("input");
  heightRange.type = "range";
  heightRange.min = "20";
  heightRange.max = "100";
  heightRange.step = "1";
  heightRange.value = String(item.heightPercent || 60);
  heightRange.title = "Hauteur image (affichage)";
  const heightAutoButton = document.createElement("button");
  heightAutoButton.type = "button";
  heightAutoButton.textContent = "H auto";
  const resizeRange = document.createElement("input");
  resizeRange.type = "range";
  resizeRange.min = "30";
  resizeRange.max = "100";
  resizeRange.step = "5";
  resizeRange.value = "100";
  resizeRange.title = "Redimensionner l'image (resolution)";
  const resizeButton = document.createElement("button");
  resizeButton.type = "button";
  resizeButton.textContent = "Redimensionner";
  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.placeholder = "Texte";
  textInput.className = "compact-input overlay-text-input hidden";

  const fileLabel = document.createElement("label");
  fileLabel.className = "shape-btn";
  fileLabel.textContent = "Choisir image";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  fileLabel.appendChild(fileInput);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Supprimer";
  removeButton.addEventListener("click", () => {
    const shapeRef = tutorialShapes.find((s) => s.id === shape.id);
    if (!shapeRef) return;
    const stepRef = getTutorialStepByPath(shapeRef, stepPath);
    if (!stepRef?.items) return;
    stepRef.items.splice(itemIndex, 1);
    renderTutorialEditor();
  });

  toolbar.appendChild(dragHandle);
  toolbar.appendChild(addRectButton);
  toolbar.appendChild(addCircleButton);
  toolbar.appendChild(addPointerButton);
  toolbar.appendChild(addArrowButton);
  toolbar.appendChild(addTextButton);
  toolbar.appendChild(colorInput);
  toolbar.appendChild(widthRange);
  toolbar.appendChild(widthSelect);
  toolbar.appendChild(heightRange);
  toolbar.appendChild(heightAutoButton);
  toolbar.appendChild(resizeRange);
  toolbar.appendChild(resizeButton);
  toolbar.appendChild(textInput);
  toolbar.appendChild(fileLabel);
  toolbar.appendChild(removeButton);

  const imageBox = document.createElement("div");
  imageBox.className = "tutorial-image-box";
  const imageFrame = document.createElement("div");
  imageFrame.className = "tutorial-image-frame";
  imageFrame.style.width = `${item.widthPercent || 80}%`;
  if (item.heightPercent) {
    imageFrame.style.height = `${item.heightPercent}%`;
  }
  const img = document.createElement("img");
  img.src = item.src || "";
  img.addEventListener("dblclick", () => {
    if (!item.src) return;
    openCropModal(item.src, (cropped) => {
      item.src = cropped;
      renderTutorialEditor();
    });
  });
  const placeholder = document.createElement("div");
  placeholder.className = "tutorial-image-placeholder";
  placeholder.textContent =
    "Glissez une capture ici ou collez avec Ctrl+V.";

  const overlayLayer = document.createElement("div");
  overlayLayer.className = "overlay-layer";

  function getSelectedOverlayForItem() {
    if (
      selectedOverlay &&
      selectedOverlay.shapeId === shape.id &&
      isSamePath(selectedOverlay.stepPath, stepPath) &&
      selectedOverlay.itemIndex === itemIndex
    ) {
      return item.overlays.find((overlayItem) => overlayItem.id === selectedOverlay.overlayId) || null;
    }
    return null;
  }

  function refreshTextInput() {
    const current = getSelectedOverlayForItem();
    if (current?.type === "text") {
      textInput.classList.remove("hidden");
      textInput.value = current.text || "";
    } else {
      textInput.classList.add("hidden");
      textInput.value = "";
    }
  }

  function refreshOverlayTextProps() {
    const current = getSelectedOverlayForItem();
    const isText = current?.type === "text";
    if (overlayTextSizeInput) {
      overlayTextSizeInput.disabled = !isText;
      overlayTextSizeInput.value = isText ? current.textSize || 12 : 12;
    }
    if (overlayTextWidthInput) {
      overlayTextWidthInput.disabled = !isText;
      overlayTextWidthInput.value = isText ? current.width || 30 : 30;
    }
    if (overlayTextHeightInput) {
      overlayTextHeightInput.disabled = !isText;
      overlayTextHeightInput.value = isText ? current.height || 12 : 12;
    }
    if (overlayTextColorInput) {
      overlayTextColorInput.disabled = !isText;
      overlayTextColorInput.value = isText ? current.textColor || "#ff3b30" : "#ff3b30";
    }
    if (overlayTextBgInput) {
      overlayTextBgInput.disabled = !isText;
      overlayTextBgInput.value = isText ? current.textBgColor || "#ffffff" : "#ffffff";
    }
  }

  const currentOverlay = getSelectedOverlayForItem();
  if (currentOverlay?.color) {
    colorInput.value = currentOverlay.color;
  }
  refreshTextInput();
  refreshOverlayTextProps();

  if (!item.src) {
    img.classList.add("hidden");
  } else {
    placeholder.classList.add("hidden");
  }

  imageFrame.appendChild(img);
  imageFrame.appendChild(overlayLayer);
  imageBox.appendChild(imageFrame);
  imageBox.appendChild(placeholder);

  function setStepImage(dataUrl) {
    item.src = dataUrl;
    img.src = dataUrl;
    img.classList.remove("hidden");
    placeholder.classList.add("hidden");
  }

  function addOverlay(type) {
    const overlay = {
      id: generateId("overlay"),
      type,
      x: 10,
      y: 10,
      width: type === "text" ? 30 : type === "arrow" ? 35 : 20,
      height: type === "text" ? 12 : type === "arrow" ? 8 : 20,
      color: colorInput.value
    };
    if (type === "text") {
      overlay.text = "Texte";
    }
    if (type === "arrow") {
      overlay.startX = 10;
      overlay.startY = 10;
      overlay.endX = 40;
      overlay.endY = 20;
    }
    item.overlays.push(overlay);
    selectedOverlay = {
      shapeId: shape.id,
      stepPath: [...stepPath],
      itemIndex,
      overlayId: overlay.id
    };
    renderTutorialEditor();
  }

  addRectButton.addEventListener("click", () => addOverlay("rect"));
  addCircleButton.addEventListener("click", () => addOverlay("circle"));
  addPointerButton.addEventListener("click", () => addOverlay("pointer"));
  addArrowButton.addEventListener("click", () => addOverlay("arrow"));
  addTextButton.addEventListener("click", () => addOverlay("text"));

  colorInput.addEventListener("change", () => {
    const overlay = getSelectedOverlayForItem();
    if (!overlay) return;
    overlay.color = colorInput.value;
    renderTutorialEditor();
  });

  textInput.addEventListener("input", () => {
    const overlay = getSelectedOverlayForItem();
    if (!overlay || overlay.type !== "text") return;
    overlay.text = textInput.value;
    const selectedEl = overlayLayer.querySelector(".overlay-item.selected");
    if (selectedEl) {
      selectedEl.textContent = overlay.text || "";
    }
  });

  if (overlayTextSizeInput) {
    overlayTextSizeInput.addEventListener("input", () => {
      const overlay = getSelectedOverlayForItem();
      if (!overlay || overlay.type !== "text") return;
      overlay.textSize = Number(overlayTextSizeInput.value) || 12;
      renderTutorialEditor();
    });
  }

  if (overlayTextWidthInput) {
    overlayTextWidthInput.addEventListener("input", () => {
      const overlay = getSelectedOverlayForItem();
      if (!overlay || overlay.type !== "text") return;
      const nextWidth = Number(overlayTextWidthInput.value) || 30;
      overlay.width = Math.max(4, Math.min(100, nextWidth));
      renderTutorialEditor();
    });
  }

  if (overlayTextHeightInput) {
    overlayTextHeightInput.addEventListener("input", () => {
      const overlay = getSelectedOverlayForItem();
      if (!overlay || overlay.type !== "text") return;
      const nextHeight = Number(overlayTextHeightInput.value) || 12;
      overlay.height = Math.max(4, Math.min(100, nextHeight));
      renderTutorialEditor();
    });
  }

  if (overlayTextColorInput) {
    overlayTextColorInput.addEventListener("input", () => {
      const overlay = getSelectedOverlayForItem();
      if (!overlay || overlay.type !== "text") return;
      overlay.textColor = overlayTextColorInput.value;
      renderTutorialEditor();
    });
  }

  if (overlayTextBgInput) {
    overlayTextBgInput.addEventListener("input", () => {
      const overlay = getSelectedOverlayForItem();
      if (!overlay || overlay.type !== "text") return;
      overlay.textBgColor = overlayTextBgInput.value;
      renderTutorialEditor();
    });
  }

  widthSelect.addEventListener("change", () => {
    if (widthSelect.value === "custom") return;
    item.widthPercent = Number(widthSelect.value);
    widthRange.value = String(item.widthPercent);
    imageFrame.style.width = `${item.widthPercent}%`;
  });
  widthRange.addEventListener("input", () => {
    item.widthPercent = Number(widthRange.value);
    imageFrame.style.width = `${item.widthPercent}%`;
    widthSelect.value = widthPresets.includes(item.widthPercent)
      ? String(item.widthPercent)
      : "custom";
  });

  heightRange.addEventListener("input", () => {
    item.heightPercent = Number(heightRange.value);
    imageFrame.style.height = `${item.heightPercent}%`;
  });

  heightAutoButton.addEventListener("click", () => {
    item.heightPercent = 0;
    imageFrame.style.height = "";
  });

  resizeButton.addEventListener("click", async () => {
    if (!item.src) return;
    const scale = Number(resizeRange.value) / 100;
    const resized = await resizeImageDataUrl(item.src, scale);
    item.src = resized;
    resizeRange.value = "100";
    renderTutorialEditor();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setStepImage(reader.result);
    };
    reader.readAsDataURL(file);
  });

  imageBox.addEventListener("click", () => {
    activeImageStep = { shapeId: shape.id, stepPath: [...stepPath], itemIndex };
  });

  imageBox.addEventListener("dragover", (event) => {
    event.preventDefault();
    imageBox.classList.add("dragging");
  });

  imageBox.addEventListener("dragleave", () => {
    imageBox.classList.remove("dragging");
  });

  imageBox.addEventListener("drop", (event) => {
    event.preventDefault();
    imageBox.classList.remove("dragging");
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setStepImage(reader.result);
    };
    reader.readAsDataURL(file);
  });

  function getArrowBounds(overlay, minWidth, minHeight) {
    const minX = Math.min(overlay.startX, overlay.endX);
    const minY = Math.min(overlay.startY, overlay.endY);
    const maxX = Math.max(overlay.startX, overlay.endX);
    const maxY = Math.max(overlay.startY, overlay.endY);
    let x = minX;
    let y = minY;
    let width = Math.max(0.1, maxX - minX);
    let height = Math.max(0.1, maxY - minY);

    if (width < minWidth) {
      const pad = (minWidth - width) / 2;
      x -= pad;
      width = minWidth;
    }
    if (height < minHeight) {
      const pad = (minHeight - height) / 2;
      y -= pad;
      height = minHeight;
    }

    if (width > 100) {
      x = 0;
      width = 100;
    } else {
      if (x < 0) x = 0;
      if (x + width > 100) x = 100 - width;
    }
    if (height > 100) {
      y = 0;
      height = 100;
    } else {
      if (y < 0) y = 0;
      if (y + height > 100) y = 100 - height;
    }

    return { x, y, width, height };
  }

  function updateArrowOverlay(overlay, overlayEl, imageBounds) {
    const safeBounds = imageBounds || { width: 0, height: 0 };
    const imageWidth = safeBounds.width || 100;
    const imageHeight = safeBounds.height || 100;
    overlayEl.style.left = "0%";
    overlayEl.style.top = "0%";
    overlayEl.style.width = "100%";
    overlayEl.style.height = "100%";
    overlayEl.style.borderColor = overlay.color || "#ff3b30";
    overlayEl.style.color = overlay.color || "#ff3b30";
    overlayEl.innerHTML = "";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${imageWidth} ${imageHeight}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.overflow = "visible";
    svg.style.position = "absolute";
    svg.style.inset = "0";
    svg.style.pointerEvents = "none";
    svg.style.zIndex = "5";

    const startX = (overlay.startX / 100) * imageWidth;
    const startY = (overlay.startY / 100) * imageHeight;
    const endX = (overlay.endX / 100) * imageWidth;
    const endY = (overlay.endY / 100) * imageHeight;
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.hypot(dx, dy);
    let angle = 0;
    if (length > 0.01) {
      angle = Math.atan2(dy, dx);
    }

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", `${startX}`);
    line.setAttribute("y1", `${startY}`);
    line.setAttribute("x2", `${endX}`);
    line.setAttribute("y2", `${endY}`);
    line.setAttribute("stroke", overlay.color || "#ff3b30");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(line);
    overlayEl.appendChild(svg);

    if (length > 0.01) {
      const headLength = Math.min(6, Math.max(3.5, length * 0.05));
      const headWidth = Math.max(3, headLength * 0.8);
      const arrowHead = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      const halfWidth = headWidth / 2;
      arrowHead.setAttribute(
        "points",
        `0,0 ${-headLength},${-halfWidth} ${-headLength},${halfWidth}`
      );
      arrowHead.setAttribute("fill", overlay.color || "#ff3b30");
      arrowHead.setAttribute(
        "transform",
        `translate(${endX} ${endY}) rotate(${(angle * 180) / Math.PI})`
      );
      svg.appendChild(arrowHead);
    }

    const startHandle = document.createElement("div");
    startHandle.className = "overlay-arrow-handle start";
    startHandle.dataset.point = "start";
    startHandle.style.left = `${overlay.startX}%`;
    startHandle.style.top = `${overlay.startY}%`;
    startHandle.style.borderColor = overlay.color || "#ff3b30";
    overlayEl.appendChild(startHandle);

    const endHandle = document.createElement("div");
    endHandle.className = "overlay-arrow-handle end";
    endHandle.dataset.point = "end";
    endHandle.style.left = `${overlay.endX}%`;
    endHandle.style.top = `${overlay.endY}%`;
    endHandle.style.borderColor = overlay.color || "#ff3b30";
    overlayEl.appendChild(endHandle);
  }

  item.overlays.forEach((overlay) => {
    const overlayEl = document.createElement("div");
    overlayEl.className = `overlay-item ${overlay.type}`;
    overlayEl.style.color = overlay.color || "#ff3b30";
    if (
      selectedOverlay &&
      selectedOverlay.shapeId === shape.id &&
      isSamePath(selectedOverlay.stepPath, stepPath) &&
      selectedOverlay.itemIndex === itemIndex &&
      selectedOverlay.overlayId === overlay.id
    ) {
      overlayEl.classList.add("selected");
    }
    if (overlay.type === "arrow") {
      updateArrowOverlay(overlay, overlayEl, imageFrame.getBoundingClientRect());
    } else {
      overlayEl.style.left = `${overlay.x}%`;
      overlayEl.style.top = `${overlay.y}%`;
      overlayEl.style.width = `${overlay.width}%`;
      overlayEl.style.height = `${overlay.height}%`;
      overlayEl.style.borderColor = overlay.color || "#ff3b30";
      if (overlay.type === "pointer") {
        overlayEl.style.backgroundColor = "transparent";
      } else if (overlay.type === "text") {
        const textColor = overlay.textColor || overlay.color || "#ff3b30";
        overlayEl.style.color = textColor;
        overlayEl.style.borderColor = textColor;
        overlayEl.style.backgroundColor =
          overlay.textBgColor || colorWithAlpha(textColor, 0.08);
        overlayEl.style.fontSize = `${overlay.textSize || 12}px`;
        overlayEl.textContent = overlay.text || "";
      } else {
        overlayEl.style.backgroundColor = colorWithAlpha(overlay.color || "#ff3b30", 0.08);
      }
    }

    overlayEl.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      selectedOverlay = {
        shapeId: shape.id,
        stepPath: [...stepPath],
        itemIndex,
        overlayId: overlay.id
      };
      document.querySelectorAll(".overlay-item.selected")
        .forEach((el) => el.classList.remove("selected"));
      overlayEl.classList.add("selected");
      refreshTextInput();
      refreshOverlayTextProps();
      const bounds = imageFrame.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = overlay.x;
      const startTop = overlay.y;
      const startArrow = {
        startX: overlay.startX,
        startY: overlay.startY,
        endX: overlay.endX,
        endY: overlay.endY
      };
      const arrowHandle = event.target.closest(".overlay-arrow-handle");
      const handleMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (overlay.type === "arrow") {
          const deltaX = (dx / bounds.width) * 100;
          const deltaY = (dy / bounds.height) * 100;
          if (arrowHandle) {
            if (arrowHandle.dataset.point === "start") {
              overlay.startX = Math.max(0, Math.min(100, startArrow.startX + deltaX));
              overlay.startY = Math.max(0, Math.min(100, startArrow.startY + deltaY));
            } else {
              overlay.endX = Math.max(0, Math.min(100, startArrow.endX + deltaX));
              overlay.endY = Math.max(0, Math.min(100, startArrow.endY + deltaY));
            }
          } else {
            overlay.startX = Math.max(0, Math.min(100, startArrow.startX + deltaX));
            overlay.startY = Math.max(0, Math.min(100, startArrow.startY + deltaY));
            overlay.endX = Math.max(0, Math.min(100, startArrow.endX + deltaX));
            overlay.endY = Math.max(0, Math.min(100, startArrow.endY + deltaY));
          }
          updateArrowOverlay(overlay, overlayEl);
          return;
        }
        const nextLeft =
          ((startLeft / 100) * bounds.width + dx) / bounds.width * 100;
        const nextTop =
          ((startTop / 100) * bounds.height + dy) / bounds.height * 100;
        overlay.x = Math.max(0, Math.min(100 - overlay.width, nextLeft));
        overlay.y = Math.max(0, Math.min(100 - overlay.height, nextTop));
        overlayEl.style.left = `${overlay.x}%`;
        overlayEl.style.top = `${overlay.y}%`;
      };
      const handleUp = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        overlayDrag = null;
      };
      overlayDrag = { overlay };
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    });

    if (overlay.type !== "arrow") {
      const resizeHandle = document.createElement("div");
      resizeHandle.className = "overlay-resize";
      resizeHandle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const bounds = imageFrame.getBoundingClientRect();
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = overlay.width;
        const startHeight = overlay.height;
        selectedOverlay = {
          shapeId: shape.id,
          stepPath: [...stepPath],
          itemIndex,
          overlayId: overlay.id
        };
        document.querySelectorAll(".overlay-item.selected")
          .forEach((el) => el.classList.remove("selected"));
        overlayEl.classList.add("selected");
        const handleMove = (moveEvent) => {
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;
          const nextWidth =
            ((startWidth / 100) * bounds.width + dx) / bounds.width * 100;
          const nextHeight =
            ((startHeight / 100) * bounds.height + dy) / bounds.height * 100;
          overlay.width = Math.max(4, Math.min(100, nextWidth));
          overlay.height = Math.max(4, Math.min(100, nextHeight));
          overlayEl.style.width = `${overlay.width}%`;
          overlayEl.style.height = `${overlay.height}%`;
        };
        const handleUp = () => {
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
          overlayResize = null;
        };
        overlayResize = { overlay };
        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
      });
      overlayEl.appendChild(resizeHandle);
    }
    overlayLayer.appendChild(overlayEl);
  });

  wrapper.appendChild(toolbar);
  wrapper.appendChild(imageBox);
  itemsHost.appendChild(wrapper);
}

function createShape(type) {
  const id = generateId("shape");
  const isGroupBox = type === "group-box";
  const isLogo = type === "logo";
  const isMedicapp = type === "medicapp";
  const shapeType = isMedicapp ? "rect" : type;
  const shape = {
    id,
    type: shapeType,
    x: 80 + shapes.length * 20,
    y: 80 + shapes.length * 20,
    width: isGroupBox ? 260 : shapeType === "diamond" ? 120 : shapeType === "circle" ? 100 : 160,
    height: isGroupBox ? 160 : shapeType === "diamond" ? 120 : shapeType === "circle" ? 100 : 70,
    text: isGroupBox ? "Groupe" : isMedicapp ? "Forme Medicapp" : "Nouvel element",
    fontSize: 14,
    fontFamily: "Segoe UI",
    textColor: isGroupBox ? "#1f2933" : "#ffffff",
    bgColor: isGroupBox ? "rgba(14, 156, 239, 0.1)" : "#0e9cef",
    opacity: isGroupBox ? 0.35 : 1,
    group: "",
    imageData: isLogo ? "" : null,
    blockId: ""
  };
  shapes.push(shape);
  renderShapes();
  selectShape(id);
  refreshTutorialShapeOptions();
  return shape;
}

function renderShapes() {
  canvasRoot.querySelectorAll(".shape").forEach((el) => el.remove());
  shapes.forEach((shape) => {
    const node = document.createElement("div");
    node.className = `shape ${shape.type}`;
    node.dataset.id = shape.id;
    node.style.left = `${shape.x}px`;
    node.style.top = `${shape.y}px`;
    node.style.width = `${shape.width}px`;
    node.style.height = `${shape.height}px`;
    node.style.fontSize = `${shape.fontSize}px`;
    node.style.fontFamily = shape.fontFamily;
    node.style.color = shape.textColor;
    node.style.opacity = shape.opacity;
    if (shape.type === "logo" && shape.imageData) {
      const ratio =
        shape.imageRatio || parseSvgRatioFromDataUrl(shape.imageData) || 1;
      shape.imageRatio = ratio;
      if (!shape.width || !shape.height) {
        shape.height = 70;
        shape.width = Math.round(shape.height * ratio);
      }
      node.style.width = `${shape.width}px`;
      node.style.height = `${shape.height + (shape.text ? 22 : 0)}px`;
      node.style.background = "transparent";
      node.style.display = "flex";
      node.style.flexDirection = "column";
      node.style.alignItems = "center";
      node.style.justifyContent = "flex-start";

      const imageBox = document.createElement("div");
      imageBox.className = "shape-image";
      imageBox.style.width = `${shape.width}px`;
      imageBox.style.height = `${shape.height}px`;
      imageBox.style.backgroundImage = `url(${shape.imageData})`;
      imageBox.style.backgroundSize = "contain";
      imageBox.style.backgroundRepeat = "no-repeat";
      imageBox.style.backgroundPosition = "center";
      imageBox.style.backgroundColor = "#ffffff";
      node.appendChild(imageBox);

      const textSpan = document.createElement("div");
      textSpan.className = "shape-text";
      const textInner = document.createElement("div");
      textInner.className = "shape-text-inner";
      textInner.textContent = shape.text;
      textSpan.style.color = "#1f2933";
      textSpan.style.marginTop = "6px";
      const dx = shape.textDx || 0;
      const dy = shape.textDy || 0;
      if (shape.type === "diamond") {
        textSpan.style.transform = "rotate(-45deg)";
        textInner.style.transform = `translate(${dx}px, ${dy}px)`;
      } else {
        textSpan.style.transform = `translate(${dx}px, ${dy}px)`;
      }
      if (!shape.text) {
        textSpan.style.display = "none";
      }
      textSpan.appendChild(textInner);
      node.appendChild(textSpan);
    } else {
      node.style.background = shape.bgColor;
      if (shape.type === "circle" || shape.type === "ellipse") {
        node.style.display = "flex";
      }
      const textSpan = document.createElement("div");
      textSpan.className = "shape-text";
      const textInner = document.createElement("div");
      textInner.className = "shape-text-inner";
      textInner.textContent = shape.text;
      const dx = shape.textDx || 0;
      const dy = shape.textDy || 0;
      if (shape.type === "diamond") {
        textSpan.style.transform = "rotate(-45deg)";
        textInner.style.transform = `translate(${dx}px, ${dy}px)`;
      } else {
        textSpan.style.transform = `translate(${dx}px, ${dy}px)`;
      }
      textSpan.appendChild(textInner);
      node.appendChild(textSpan);
    }
    node.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      handleWorkflowEditRequest(shape.id);
    });

    if (shape.id === selectedShapeId) {
      node.classList.add("selected");
      ["tl", "tr", "bl", "br"].forEach((pos) => {
        const handle = document.createElement("div");
        handle.className = `resize-handle ${pos}`;
        handle.dataset.resize = pos;
        node.appendChild(handle);
      });
      const dx = shape.textDx || 0;
      const dy = shape.textDy || 0;
      if (shape.type !== "logo") {
        const textHandle = document.createElement("div");
        textHandle.className = "text-handle";
        textHandle.dataset.id = shape.id;
        textHandle.style.left = "50%";
        textHandle.style.top = "50%";
        if (shape.type === "diamond") {
          textHandle.style.transform = `translate(-50%, -50%) rotate(-45deg) translate(${dx}px, ${dy}px)`;
        } else {
          textHandle.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
        }
        node.appendChild(textHandle);
      }
    }

    const showAnchors =
      shape.id === selectedShapeId || pendingAnchor || endpointDrag;
    if (showAnchors) {
      renderAnchors(node, shape);
    }

    canvasRoot.appendChild(node);
  });
  updateConnections();
  applyGroupFilter();
}

function renderAnchors(node, shape) {
  const positions = [
    { id: "tl", left: "0%", top: "0%" },
    { id: "tr", left: "100%", top: "0%" },
    { id: "bl", left: "0%", top: "100%" },
    { id: "br", left: "100%", top: "100%" },
    { id: "top", left: "50%", top: "0%" },
    { id: "bottom", left: "50%", top: "100%" },
    { id: "left", left: "0%", top: "50%" },
    { id: "right", left: "100%", top: "50%" }
  ];

  const shouldHideCornerAnchors = shape.id === selectedShapeId;
  positions.forEach((position) => {
    if (
      shouldHideCornerAnchors &&
      ["tl", "tr", "bl", "br"].includes(position.id)
    ) {
      return;
    }
    const anchor = document.createElement("div");
    anchor.className = "anchor";
    anchor.dataset.anchor = position.id;
    anchor.style.left = position.left;
    anchor.style.top = position.top;
    if (
      pendingAnchor &&
      pendingAnchor.shapeId === shape.id &&
      pendingAnchor.anchor === position.id
    ) {
      anchor.classList.add("active");
    }
    anchor.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      if (selectedConnectionId) {
        selectedConnectionId = null;
        showProperties("none");
      }
      handleAnchorSelection(shape.id, position.id);
    });
    node.appendChild(anchor);
  });
}

function handleAnchorSelection(shapeId, anchorId) {
  if (!pendingAnchor) {
    pendingAnchor = { shapeId, anchor: anchorId };
    renderShapes();
    return;
  }
  if (pendingAnchor.shapeId === shapeId) {
    pendingAnchor = { shapeId, anchor: anchorId };
    renderShapes();
    return;
  }
  const connection = {
    id: generateId("conn"),
    from: pendingAnchor.shapeId,
    to: shapeId,
    startAnchor: pendingAnchor.anchor,
    endAnchor: anchorId,
    points: [],
    auto: true,
    lineColor: "#0e9cef",
    lineStyle: "solid",
    lineArrow: true,
    label: "",
    labelDx: 0,
    labelDy: 0,
    labelBgColor: "#ffffff",
    labelOpacity: 1,
    labelTextColor: "#1f2933"
  };
  connections.push(connection);
  pendingAnchor = null;
  selectConnection(connection.id);
}

function selectConnection(id) {
  selectedConnectionId = id;
  selectedShapeId = null;
  const connection = connections.find((conn) => conn.id === id);
  // #region agent log
  debugIngest({location:'tutorials/builder.js:selectConnection',message:'selectConnection',data:{id,hasConnection:Boolean(connection)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1'});
  // #endregion
  if (!connection) {
    showProperties("none");
    updateBlockStorageIndicatorForConnection(null);
    updateEditButtonState();
    return;
  }
  propLineStyle.value = connection.lineStyle || "solid";
  propLineArrow.value = String(connection.lineArrow !== false);
  propLineColor.value = getConnectionLineColor(connection);
  propLineText.value = connection.label || "";
  propLineBgColor.value = connection.labelBgColor || "#ffffff";
  propLineTextOpacity.value = Math.round((connection.labelOpacity ?? 1) * 100);
  propLineTextColor.value = connection.labelTextColor || "#1f2933";
  propLineTextX.value = connection.labelDx || 0;
  propLineTextY.value = connection.labelDy || 0;
  showProperties("connection");
  updateBlockStorageIndicatorForConnection(connection);
  if (connection.tutorial) {
    renderBlockPreviewForTargets(
      connection.tutorial,
      connection.label || connection.id
    );
  } else {
    clearBlockPreview();
  }
  updateEditButtonState();
  // #region agent log
  debugIngest({location:'tutorials/builder.js:selectConnection',message:'connectionPropsShown',data:{id,connectionHidden:connectionProps.classList.contains("hidden"),shapeHidden:shapeProps.classList.contains("hidden")},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H8'});
  // #endregion
  renderShapes();
  updateConnections();
}

function selectShape(id) {
  selectedShapeId = id;
  selectedConnectionId = null;
  const shape = shapes.find((s) => s.id === id);
  // #region agent log
  debugIngest({location:'tutorials/builder.js:selectShape',message:'selectShape',data:{id,hasShape:Boolean(shape),connectionPropsHidden:connectionProps.classList.contains("hidden")},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H7'});
  // #endregion
  if (!shape) {
    clearSelection();
    return;
  }
  propText.value = shape.text;
  propFontSize.value = shape.fontSize;
  propFontFamily.value = shape.fontFamily;
  propTextColor.value = shape.textColor;
  propBgColor.value = shape.bgColor;
  propOpacity.value = Math.round(shape.opacity * 100);
  propGroup.value = shape.group || "";
  showProperties("shape");
  updateBlockStorageIndicator(shape);
  updateEditButtonState();
  if (shape.tutorial) {
    renderBlockPreviewForTargets(shape.tutorial, shape.text || shape.id);
  } else {
    clearBlockPreview();
  }
  // #region agent log
  debugIngest({location:'tutorials/builder.js:selectShape',message:'shapePropsShown',data:{id,connectionHidden:connectionProps.classList.contains("hidden"),shapeHidden:shapeProps.classList.contains("hidden")},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H7'});
  // #endregion
  renderShapes();
}

function clearSelection() {
  selectedShapeId = null;
  selectedConnectionId = null;
  pendingAnchor = null;
  propText.value = "";
  updateBlockStorageIndicator(null);
  clearBlockPreview();
  showProperties("none");
  updateEditButtonState();
  renderShapes();
}

function updateSelectedShape(updates) {
  const shape = shapes.find((s) => s.id === selectedShapeId);
  if (!shape) return;
  Object.assign(shape, updates);
  renderShapes();
}

function updateConnections() {
  connectionsSvg
    .querySelectorAll(".connection-path, .connection-label, .connection-hit")
    .forEach((line) => line.remove());
  canvasRoot.querySelectorAll(".conn-handle").forEach((handle) => handle.remove());
  const surfaceBounds = canvasSurface?.getBoundingClientRect() || canvas.getBoundingClientRect();
  const scale = getCanvasScale();
  const width = surfaceBounds.width / scale;
  const height = surfaceBounds.height / scale;
  connectionsSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  // #region agent log
  const markerEl = connectionsSvg.querySelector("marker#arrow");
  const svgStyle = getComputedStyle(connectionsSvg);
  debugIngest({location:'tutorials/builder.js:updateConnections',message:'updateConnections',data:{connectionsCount:connections.length,selectedConnectionId,markerExists:Boolean(markerEl),markerAttrs:markerEl?{markerWidth:markerEl.getAttribute("markerWidth"),markerHeight:markerEl.getAttribute("markerHeight"),refX:markerEl.getAttribute("refX"),refY:markerEl.getAttribute("refY"),markerUnits:markerEl.getAttribute("markerUnits")}:null,svgZ:svgStyle.zIndex,svgOverflow:svgStyle.overflow,svgPointerEvents:svgStyle.pointerEvents},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H2'});
  // #endregion
  connections.forEach((connection) => {
    const from = shapes.find((s) => s.id === connection.from);
    const to = shapes.find((s) => s.id === connection.to);
    if (!from || !to) return;
    connection.lineStyle = connection.lineStyle || "solid";
    if (connection.lineArrow === undefined) {
      connection.lineArrow = true;
    }
    if (!connection.label) {
      connection.label = "";
    }
    connection.lineColor = getConnectionLineColor(connection);
    if (!connection.labelBgColor) {
      connection.labelBgColor = "#ffffff";
    }
    if (!connection.labelTextColor) {
      connection.labelTextColor = "#1f2933";
    }
    if (connection.labelOpacity === undefined) {
      connection.labelOpacity = 1;
    }
    if (connection.labelDx === undefined) {
      connection.labelDx = 0;
    }
    if (connection.labelDy === undefined) {
      connection.labelDy = 0;
    }
    const start = connection.startAnchor
      ? getAnchorPointFromAnchor(from, connection.startAnchor)
      : getAnchorPoint(from, to);
    const end = connection.endAnchor
      ? getAnchorPointFromAnchor(to, connection.endAnchor)
      : getAnchorPoint(to, from);
    const isEditingConnection =
      (segmentDrag && segmentDrag.connId === connection.id) ||
      (cornerDrag && cornerDrag.connId === connection.id) ||
      (lineDrag && lineDrag.connId === connection.id) ||
      (endpointDrag && endpointDrag.connId === connection.id);
    const points = isEditingConnection && Array.isArray(connection.points) && connection.points.length
      ? connection.points
      : normalizeConnectionPoints(connection, start, end, {
          preview: isShapeTransforming
        });
    const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hitPath.classList.add("connection-hit");
    const d = buildPathWithPoints(points);
    hitPath.setAttribute("d", d);
    hitPath.dataset.id = connection.id;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("connection-path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", connection.lineColor);
    path.setAttribute("stroke-width", "2");
    if (connection.lineStyle === "dashed") {
      path.setAttribute("stroke-dasharray", "6 4");
    }
    if (connection.lineArrow !== false) {
      const markerId = ensureArrowMarker(connectionsSvg, connection.lineColor);
      path.setAttribute("marker-end", `url(#${markerId})`);
    }
    path.dataset.id = connection.id;
    if (connection.id === selectedConnectionId) {
      path.classList.add("connection-selected");
      // #region agent log
      debugIngest({location:'tutorials/builder.js:updateConnections',message:'selectedConnectionRender',data:{id:connection.id,lineStyle:connection.lineStyle,lineArrow:connection.lineArrow,label:connection.label,markerApplied:connection.lineArrow !== false,pathD:d},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H3'});
      // #endregion
      // #region agent log
      const endInside =
        end.x >= to.x &&
        end.x <= to.x + to.width &&
        end.y >= to.y &&
        end.y <= to.y + to.height;
      debugIngest({location:'tutorials/builder.js:updateConnections',message:'selectedConnectionGeom',data:{id:connection.id,start,end,endInsideShape:endInside,svgZ:getComputedStyle(connectionsSvg).zIndex},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H6'});
      // #endregion
    }
    connectionsSvg.appendChild(hitPath);
    connectionsSvg.appendChild(path);

    if (connection.label && connection.label.trim()) {
      const mid = getPathMidPoint(points);
      const labelGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      labelGroup.classList.add("connection-label");
      labelGroup.dataset.id = connection.id;
      labelGroup.setAttribute(
        "transform",
        `translate(${mid.x + connection.labelDx}, ${mid.y + connection.labelDy})`
      );
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", "0");
      label.setAttribute("y", "0");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "middle");
      label.setAttribute("fill", connection.labelTextColor);
      const lines = String(connection.label).split(/\r?\n/);
      lines.forEach((line, index) => {
        const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        tspan.setAttribute("x", "0");
        if (index === 0) {
          tspan.setAttribute("dy", "0");
        } else {
          tspan.setAttribute("dy", "1.2em");
        }
        tspan.textContent = line;
        label.appendChild(tspan);
      });
      labelGroup.appendChild(label);
      connectionsSvg.appendChild(labelGroup);

      const bbox = label.getBBox();
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(bbox.x - labelPadding));
      rect.setAttribute("y", String(bbox.y - labelPadding));
      rect.setAttribute("width", String(bbox.width + labelPadding * 2));
      rect.setAttribute("height", String(bbox.height + labelPadding * 2));
      rect.setAttribute("rx", "4");
      rect.setAttribute("ry", "4");
      rect.setAttribute("fill", connection.labelBgColor);
      rect.setAttribute("fill-opacity", String(connection.labelOpacity));
      labelGroup.insertBefore(rect, label);
      // #region agent log
      debugIngest({location:'tutorials/builder.js:updateConnections',message:'labelRender',data:{id:connection.id,label:connection.label,mid,labelDx:connection.labelDx,labelDy:connection.labelDy},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H5'});
      // #endregion
    }

    if (connection.id === selectedConnectionId && points.length > 1) {
      points.forEach((point, index) => {
        if (!point) return;
        const handle = document.createElement("div");
        handle.className = "conn-handle";
        handle.style.left = `${point.x}px`;
        handle.style.top = `${point.y}px`;
        handle.dataset.connId = connection.id;
        if (index === 0) {
          handle.dataset.role = "start";
        } else if (index === points.length - 1) {
          handle.dataset.role = "end";
        } else {
          handle.dataset.role = "corner";
          handle.dataset.cornerIndex = index;
        }
        canvasRoot.appendChild(handle);
      });
      const overallMid = getPathMidPoint(points);
      const overallDx = points[points.length - 1].x - points[0].x;
      const overallDy = points[points.length - 1].y - points[0].y;
      const shiftAxis = Math.abs(overallDx) >= Math.abs(overallDy) ? "y" : "x";
      const lineHandle = document.createElement("div");
      lineHandle.className = "conn-handle";
      lineHandle.style.left = `${overallMid.x}px`;
      lineHandle.style.top = `${overallMid.y}px`;
      lineHandle.dataset.connId = connection.id;
      lineHandle.dataset.role = "line";
      lineHandle.dataset.axis = shiftAxis;
      canvasRoot.appendChild(lineHandle);
    }
  });
}

function getAnchorPoint(shape, target) {
  const centerX = shape.x + shape.width / 2;
  const centerY = shape.y + shape.height / 2;
  const targetX = target.x + target.width / 2;
  const targetY = target.y + target.height / 2;
  const dx = targetX - centerX;
  const dy = targetY - centerY;
  if (Math.abs(dx) > Math.abs(dy)) {
    const anchor = dx > 0 ? "right" : "left";
    if (shape.type === "diamond") {
      return getAnchorPointFromAnchor(shape, anchor);
    }
    return {
      x: dx > 0 ? shape.x + shape.width : shape.x,
      y: centerY
    };
  }
  const anchor = dy > 0 ? "bottom" : "top";
  if (shape.type === "diamond") {
    return getAnchorPointFromAnchor(shape, anchor);
  }
  return {
    x: centerX,
    y: dy > 0 ? shape.y + shape.height : shape.y
  };
}

function rotatePoint(point, center, angleRad) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

function getAnchorPointFromAnchor(shape, anchor) {
  const offset = 0;
  const center = {
    x: shape.x + shape.width / 2,
    y: shape.y + shape.height / 2
  };
  let point;
  switch (anchor) {
    case "tl":
      point = { x: shape.x - offset, y: shape.y - offset };
      break;
    case "tr":
      point = { x: shape.x + shape.width + offset, y: shape.y - offset };
      break;
    case "bl":
      point = { x: shape.x - offset, y: shape.y + shape.height + offset };
      break;
    case "br":
      point = { x: shape.x + shape.width + offset, y: shape.y + shape.height + offset };
      break;
    case "top":
      point = { x: shape.x + shape.width / 2, y: shape.y - offset };
      break;
    case "bottom":
      point = { x: shape.x + shape.width / 2, y: shape.y + shape.height + offset };
      break;
    case "left":
      point = { x: shape.x - offset, y: shape.y + shape.height / 2 };
      break;
    case "right":
      point = { x: shape.x + shape.width + offset, y: shape.y + shape.height / 2 };
      break;
    default:
      point = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
      break;
  }
  if (shape.type === "diamond") {
    return rotatePoint(point, center, Math.PI / 4);
  }
  return point;
}

function getExitVector(start, end, anchor) {
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

function normalizeConnectionPoints(connection, start, end, options = {}) {
  const preview = options.preview === true;
  const basePoints = buildBasePoints(
    start,
    end,
    connection.startAnchor,
    connection.endAnchor
  );

  if (connection.auto) {
    return basePoints;
  }

  if (!Array.isArray(connection.points) || connection.points.length < 5) {
    if (preview) {
      return basePoints;
    }
    connection.points = basePoints;
    return connection.points;
  }

  const corners = ensureOrthogonal(connection.points);
  if (corners.length < 5) {
    if (preview) {
      return basePoints;
    }
    connection.points = basePoints;
    return connection.points;
  }

  const adjusted = corners.map((point) => ({ ...point }));
  adjusted[0] = start;
  adjusted[adjusted.length - 1] = end;
  adjusted[1] = basePoints[1];
  adjusted[adjusted.length - 2] = basePoints[basePoints.length - 2];
  const normalized = ensureOrthogonal(adjusted);
  if (!preview) {
    connection.points = normalized;
  }
  return normalized;
}

function materializeConnectionPoints(connection, start, end) {
  if (connection.auto) {
    connection.auto = false;
    connection.points = buildBasePoints(
      start,
      end,
      connection.startAnchor,
      connection.endAnchor
    );
  }
  normalizeConnectionPoints(connection, start, end);
}

function resetConnectionPointsToBase(connection, start, end) {
  connection.points = buildBasePoints(
    start,
    end,
    connection.startAnchor,
    connection.endAnchor
  );
  connection.auto = false;
  return connection.points;
}

function enforceMaxConnectionPoints(connection, start, end) {
  if (!Array.isArray(connection.points)) return false;
  if (connection.points.length <= maxConnectionPoints) return false;
  resetConnectionPointsToBase(connection, start, end);
  return true;
}

function buildPathWithPoints(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function distanceToSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) {
    return Math.hypot(apx, apy);
  }
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
  const projX = a.x + abx * t;
  const projY = a.y + aby * t;
  return Math.hypot(point.x - projX, point.y - projY);
}

function insertSplitPoint(connection, mouse) {
  const nodes = connection.points;
  if (!Array.isArray(nodes) || nodes.length >= maxConnectionPoints) {
    return null;
  }
  let bestIndex = null;
  let bestDist = Infinity;
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const dist = distanceToSegment(mouse, nodes[i], nodes[i + 1]);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  if (
    bestIndex === null ||
    bestIndex <= 1 ||
    bestIndex >= nodes.length - 3
  ) {
    return null;
  }
  const a = nodes[bestIndex];
  const b = nodes[bestIndex + 1];
  if (!a || !b) return null;
  const newPoint = a.x === b.x
    ? { x: a.x, y: mouse.y }
    : { x: mouse.x, y: a.y };
  connection.points.splice(bestIndex + 1, 0, newPoint);
  return bestIndex;
}

function getConnectionSnapTargets(points, excludeIndices) {
  const xTargets = [];
  const yTargets = [];
  points.forEach((point, index) => {
    if (!point) return;
    if (excludeIndices && excludeIndices.has(index)) return;
    xTargets.push(point.x);
    yTargets.push(point.y);
  });
  return { xTargets, yTargets };
}

function snapAxisValue(value, targets) {
  if (!targets.length) return value;
  const snap = pickSnap(value, targets);
  return snap.snapped ? snap.value : value;
}

function mergeOverlappingPoints(points) {
  if (!Array.isArray(points) || points.length < 2) return points;
  const merged = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = merged[merged.length - 1];
    const cur = points[i];
    if (
      Math.abs(cur.x - prev.x) <= snapThreshold &&
      Math.abs(cur.y - prev.y) <= snapThreshold
    ) {
      continue;
    }
    merged.push(cur);
  }
  return merged;
}

function simplifyAlignedPoints(points) {
  if (!Array.isArray(points) || points.length <= 5) return points;
  const simplified = points.map((point) => ({ ...point }));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i <= simplified.length - 4; i += 1) {
      const a = simplified[i];
      const b = simplified[i + 1];
      const c = simplified[i + 2];
      const d = simplified[i + 3];
      if (!a || !b || !c || !d) continue;
      const alignedX = a.x === b.x && b.x === c.x && c.x === d.x;
      const alignedY = a.y === b.y && b.y === c.y && c.y === d.y;
      if (alignedX || alignedY) {
        simplified.splice(i + 1, 1);
        changed = true;
        break;
      }
    }
  }
  return simplified;
}


function getAnchorUnderPointer(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  const anchor = element?.closest?.(".anchor");
  if (!anchor) return null;
  const shapeEl = anchor.closest(".shape");
  if (!shapeEl) return null;
  return {
    shapeId: shapeEl.dataset.id,
    anchorId: anchor.dataset.anchor
  };
}

function getPathMidPoint(points) {
  const segments = points;
  let total = 0;
  const lengths = [];
  for (let i = 0; i < segments.length - 1; i += 1) {
    const dx = segments[i + 1].x - segments[i].x;
    const dy = segments[i + 1].y - segments[i].y;
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
        x: segments[i].x + (segments[i + 1].x - segments[i].x) * ratio,
        y: segments[i].y + (segments[i + 1].y - segments[i].y) * ratio
      };
    }
    acc += lengths[i];
  }
  return segments[Math.floor(segments.length / 2)];
}

function addConnection(fromId, toId) {
  if (fromId === toId) return;
  const exists = connections.some(
    (conn) => conn.from === fromId && conn.to === toId
  );
  if (exists) return;
  connections.push({
    id: generateId("conn"),
    from: fromId,
    to: toId,
    points: [],
    auto: true,
    lineStyle: "solid",
    lineArrow: true,
    label: "",
    labelDx: 0,
    labelDy: 0,
    labelBgColor: "#ffffff",
    labelOpacity: 1,
    labelTextColor: "#1f2933"
  });
  updateConnections();
}

function applyGroupFilter() {
  const filter = groupFilter.value;
  const shapesEls = canvasRoot.querySelectorAll(".shape");
  shapesEls.forEach((el) => {
    const shape = shapes.find((s) => s.id === el.dataset.id);
    if (!shape) return;
    const hide = filter && shape.group !== filter;
    el.style.display = hide ? "none" : "flex";
  });
  connectionsSvg.querySelectorAll("path").forEach((line) => {
    const connection = connections.find((c) => c.id === line.dataset.id);
    if (!connection) return;
    const from = shapes.find((s) => s.id === connection.from);
    const to = shapes.find((s) => s.id === connection.to);
    const hide =
      filter &&
      ((from && from.group !== filter) || (to && to.group !== filter));
    line.style.display = hide ? "none" : "block";
  });
  canvas.querySelectorAll(".conn-handle").forEach((handle) => {
    const connection = connections.find((c) => c.id === handle.dataset.connId);
    if (!connection) return;
    const from = shapes.find((s) => s.id === connection.from);
    const to = shapes.find((s) => s.id === connection.to);
    const hide =
      filter &&
      ((from && from.group !== filter) || (to && to.group !== filter));
    handle.style.display = hide ? "none" : "block";
  });
}

function exportJson() {
  const payload = {
    shapes,
    connections,
    groups
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "workflow.json";
  link.click();
  URL.revokeObjectURL(url);
}

function applyWorkflowData(data) {
  shapes = Array.isArray(data?.shapes)
    ? data.shapes.map((shape) => ({
        opacity: 1,
        ...shape
      }))
    : [];
  connections = Array.isArray(data?.connections)
    ? data.connections.map((conn) => ({
        points: [],
        auto: true,
        lineColor: "#0e9cef",
        lineStyle: "solid",
        lineArrow: true,
        startAnchor: null,
        endAnchor: null,
        label: "",
        labelDx: 0,
        labelDy: 0,
        labelBgColor: "#ffffff",
        labelOpacity: 1,
        labelTextColor: "#1f2933",
        ...conn
      }))
    : [];
  groups = Array.isArray(data?.groups) ? data.groups : [];
  refreshGroupOptions();
  if (groupFilter) {
    groupFilter.value = "";
  }
  if (propGroup) {
    propGroup.value = "";
  }
  renderShapes();
  refreshTutorialShapeOptions();
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      applyWorkflowData(data);
    } catch (error) {
      alert("JSON invalide.");
    }
  };
  reader.readAsText(file);
}

function refreshGroupOptions() {
  propGroup.innerHTML = '<option value="">Aucun</option>';
  groupFilter.innerHTML = '<option value="">Tous</option>';
  groupList.innerHTML = "";
  groups.forEach((group) => {
    const opt = document.createElement("option");
    opt.value = group;
    opt.textContent = group;
    propGroup.appendChild(opt);
    const filterOpt = document.createElement("option");
    filterOpt.value = group;
    filterOpt.textContent = group;
    groupFilter.appendChild(filterOpt);
    const item = document.createElement("div");
    item.textContent = group;
    groupList.appendChild(item);
  });
}

loadShapeLibraryFromStorage();

shapeButtons.forEach((button) => {
  button.addEventListener("click", () => createShape(button.dataset.shape));
});

if (canvas) {
  canvas.addEventListener("dragover", (event) => {
    if (activeMode !== "workflow") return;
    event.preventDefault();
  });
  canvas.addEventListener("wheel", (event) => {
    if (activeMode !== "workflow") return;
    if (!event.ctrlKey) return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    const nextZoom = canvasZoom + direction * canvasZoomStep;
    setCanvasZoom(nextZoom, event);
  }, { passive: false });
  canvas.addEventListener("drop", (event) => {
    if (activeMode !== "workflow") return;
    event.preventDefault();
    suppressCanvasClick = true;
    const raw = event.dataTransfer?.getData("application/json");
    if (!raw) return;
    try {
      const entry = JSON.parse(raw);
      const position = getCanvasPointer(event);
      if (entry.kind === "block" && entry.path) {
        fetchBlockData({ path: entry.path })
          .then((data) => {
            if (!data) return;
            createWorkflowShapeFromBlock(data, position);
          })
          .catch(() => {});
        return;
      }
      if (entry.kind === "shape") {
        addWorkflowShapeFromLibrary(entry, position);
      }
    } catch (error) {
      // ignore invalid drag payload
    }
  });
}

modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveMode(tab.dataset.mode);
  });
});

if (tutorialShapeSelect) {
  tutorialShapeSelect.addEventListener("change", () => {
    activeTutorialShapeType = tutorialShapeSelect.value || "rect";
    let shape = getTutorialShapeByType(activeTutorialShapeType);
    if (!shape) {
      createTutorialShape(activeTutorialShapeType);
      shape = getTutorialShapeByType(activeTutorialShapeType);
    }
    if (!shape) return;
    activeTutorialShapeId = shape.id;
    renderTutorialEditor();
  });
}

if (tutorialAddShapeButton) {
  tutorialAddShapeButton.addEventListener("click", () => {
    toggleTutorialShapeForm(true);
    refreshTutorialShapeCategoryOptions();
  });
}

if (tutorialShapeNewCategoryButton) {
  tutorialShapeNewCategoryButton.addEventListener("click", () => {
    if (!tutorialShapeCategoryInput || !tutorialShapeCategorySelect) return;
    tutorialShapeCategoryInput.classList.toggle("hidden");
    const isHidden = tutorialShapeCategoryInput.classList.contains("hidden");
    tutorialShapeCategorySelect.disabled = !isHidden;
    if (!isHidden) {
      tutorialShapeCategoryInput.focus();
    }
  });
}

if (tutorialShapeCancelButton) {
  tutorialShapeCancelButton.addEventListener("click", () => {
    resetTutorialShapeForm();
    toggleTutorialShapeForm(false);
  });
}

if (tutorialShapeCreateButton) {
  tutorialShapeCreateButton.addEventListener("click", () => {
    const nameValue = String(tutorialShapeNameInput?.value || "").trim();
    const category = resolveTutorialShapeCategory();
    const file = tutorialShapeSvgInput?.files?.[0];
    if (!file) {
      alert("Selectionnez un fichier SVG.");
      return;
    }
    if (file.type && file.type !== "image/svg+xml") {
      alert("Format SVG uniquement.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const label = nameValue || file.name.replace(/\.svg$/i, "") || "Forme";
      const ratio = parseSvgRatioFromDataUrl(reader.result);
      const entry = {
        id: generateId("tshape-lib"),
        type: "logo",
        label,
        category,
        imageData: reader.result,
        ratio: ratio || 1,
        standard: false
      };
      tutorialShapeLibrary.push(entry);
      saveShapeLibraryToStorage();
      refreshTutorialShapeOptions();
      resetTutorialShapeForm();
      toggleTutorialShapeForm(false);
      activateTutorialShapeFromLibrary(entry);
    };
    reader.readAsDataURL(file);
  });
}

if (tutorialTitleInput) {
  tutorialTitleInput.addEventListener("input", () => {
    const shape = getActiveTutorialShape();
    if (!shape) return;
    const tutorial = ensureShapeTutorial(shape);
    tutorial.title = tutorialTitleInput.value;
    renderTutorialPreview(shape, tutorial.title);
  });
}

if (tutorialIntroInput) {
  tutorialIntroInput.addEventListener("input", () => {
    const shape = getActiveTutorialShape();
    if (!shape) return;
    const tutorial = ensureShapeTutorial(shape);
    tutorial.intro = tutorialIntroInput.value;
  });
}

if (blockCategorySelect) {
  blockCategorySelect.addEventListener("change", () => {
    const shape = getActiveTutorialShape();
    if (!shape) return;
    shape.blockCategory = blockCategorySelect.value || "";
  });
}

if (blockFileNameInput) {
  blockFileNameInput.addEventListener("input", () => {
    const shape = getActiveTutorialShape();
    if (!shape) return;
    const value = (blockFileNameInput.value || "").trim();
    if (!value) {
      shape.blockId = "";
      shape.blockPath = "";
      shape.blockFileName = "";
      setBlockSaveHint("Nom vide: un nouveau block sera cree.", false);
      return;
    }
    shape.blockFileName = value;
  });
}

if (blockWorkflowSelect) {
  blockWorkflowSelect.addEventListener("change", () => {
    const shape = getActiveTutorialShape();
    if (!shape) return;
    const selectedPath = blockWorkflowSelect.value;
    if (!selectedPath) {
      shape.workflow = null;
      if (editingWorkflowShapeId) {
        syncEditingWorkflowShape({ usePath: true });
      }
      return;
    }
    const entry = blockWorkflowEntries.find((item) => item.path === selectedPath);
    shape.workflow = {
      path: selectedPath,
      name: entry?.name || ""
    };
    if (editingWorkflowShapeId) {
      syncEditingWorkflowShape({ usePath: true });
    }
  });
}

if (exportBlockButton) {
  exportBlockButton.addEventListener("click", () => {
    const shape = getActiveTutorialShape();
    if (!shape) return;
    exportBlockJson(shape);
  });
}

if (exportBlockJsonButton) {
  exportBlockJsonButton.addEventListener("click", () => {
    const shape = getActiveTutorialShape();
    if (!shape) return;
    exportBlockJson(shape);
  });
}

if (editBlockButton) {
  editBlockButton.addEventListener("click", () => {
    if (selectedConnectionId) {
      handleWorkflowConnectionEditRequest(selectedConnectionId);
      return;
    }
    if (selectedShapeId) {
      handleWorkflowEditRequest(selectedShapeId);
    }
  });
}

if (saveBlockButton) {
  saveBlockButton.addEventListener("click", saveBlockToApi);
}

if (deleteBlockButton) {
  deleteBlockButton.addEventListener("click", deleteBlockFromApi);
}

if (resetBlockButton) {
  resetBlockButton.addEventListener("click", resetTutorialForm);
}

if (addBlockCategoryButton) {
  addBlockCategoryButton.addEventListener("click", openCategoryModal);
}

if (categoryCancelButton) {
  categoryCancelButton.addEventListener("click", closeCategoryModal);
}

if (categoryCloseButton) {
  categoryCloseButton.addEventListener("click", closeCategoryModal);
}

if (categoryCreateButton) {
  categoryCreateButton.addEventListener("click", () => {
    ensureCategoryOption(categoryNameInput?.value || "");
    closeCategoryModal();
  });
}

if (categoryNameInput) {
  categoryNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      ensureCategoryOption(categoryNameInput.value);
      closeCategoryModal();
    }
  });
}

if (addTutorialStepButton) {
  addTutorialStepButton.addEventListener("click", () => {
    let shape = getActiveTutorialShape();
    if (!shape) {
      createTutorialShape(activeTutorialShapeType || "rect");
      shape = getActiveTutorialShape();
    }
    if (!shape) return;
    const tutorial = ensureShapeTutorial(shape);
    tutorial.steps.push({
      title: `Etape ${tutorial.steps.length + 1}`,
      items: [{ type: "text", html: "" }],
      substeps: [],
      collapsed: true
    });
    renderTutorialEditor();
  });
}

canvas.addEventListener("mousedown", (event) => {
  const connectionHandle = event.target.closest(".conn-handle");
  if (connectionHandle) {
    suppressCanvasClick = true;
    selectConnection(connectionHandle.dataset.connId);
    const role = connectionHandle.dataset.role;
    if (role === "start" || role === "end") {
      const connection = connections.find((c) => c.id === connectionHandle.dataset.connId);
      if (!connection) return;
      endpointDrag = {
        connId: connectionHandle.dataset.connId,
        end: role,
        attached: false,
        original: {
          from: connection.from,
          to: connection.to,
          startAnchor: connection.startAnchor,
          endAnchor: connection.endAnchor
        }
      };
    } else if (role === "line") {
      const connection = connections.find((c) => c.id === connectionHandle.dataset.connId);
      if (!connection) return;
      const from = shapes.find((s) => s.id === connection.from);
      const to = shapes.find((s) => s.id === connection.to);
      if (!from || !to) return;
      const start = connection.startAnchor
        ? getAnchorPointFromAnchor(from, connection.startAnchor)
        : getAnchorPoint(from, to);
      const end = connection.endAnchor
        ? getAnchorPointFromAnchor(to, connection.endAnchor)
        : getAnchorPoint(to, from);
      materializeConnectionPoints(connection, start, end);
      const metrics = getCanvasMetrics();
      const pointer = getCanvasPointer(event);
      const mouse = {
        x: Math.max(0, Math.min(pointer.x, metrics.width)),
        y: Math.max(0, Math.min(pointer.y, metrics.height))
      };
      const nodes = connection.points;
      let bestIndex = null;
      let bestDist = Infinity;
      for (let i = 0; i < nodes.length - 1; i += 1) {
        const dist = distanceToSegment(mouse, nodes[i], nodes[i + 1]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }
      if (
        bestIndex === null ||
        bestIndex === 0 ||
        bestIndex === nodes.length - 2
      ) {
        return;
      }
      segmentDrag = {
        connId: connectionHandle.dataset.connId,
        segIndex: bestIndex,
        startX: pointer.x,
        startY: pointer.y,
        startPoints: connection.points.map((p) => ({ ...p })),
        adjustNeighbors: false
      };
    } else if (role === "corner") {
      const cornerIndex = Number(connectionHandle.dataset.cornerIndex);
      const connection = connections.find((c) => c.id === connectionHandle.dataset.connId);
      if (!connection) return;
      const from = shapes.find((s) => s.id === connection.from);
      const to = shapes.find((s) => s.id === connection.to);
      if (!from || !to) return;
      const start = connection.startAnchor
        ? getAnchorPointFromAnchor(from, connection.startAnchor)
        : getAnchorPoint(from, to);
      const end = connection.endAnchor
        ? getAnchorPointFromAnchor(to, connection.endAnchor)
        : getAnchorPoint(to, from);
      materializeConnectionPoints(connection, start, end);
      const pointer = getCanvasPointer(event);
      cornerDrag = {
        connId: connectionHandle.dataset.connId,
        cornerIndex,
        startX: pointer.x,
        startY: pointer.y,
        startPoints: connection.points.map((p) => ({ ...p }))
      };
    } else {
      return;
    }
    event.preventDefault();
    return;
  }

  const textHandle = event.target.closest(".text-handle");
  if (textHandle) {
    const shapeId = textHandle.dataset.id;
    const shape = shapes.find((s) => s.id === shapeId);
    if (!shape) return;
    isShapeTransforming = true;
    const pointer = getCanvasPointer(event);
    textDrag = {
      id: shapeId,
      startX: pointer.x,
      startY: pointer.y,
      startDx: shape.textDx || 0,
      startDy: shape.textDy || 0
    };
    event.preventDefault();
    return;
  }

  const handle = event.target.closest(".resize-handle");
  const shapeEl = event.target.closest(".shape");
  if (handle && shapeEl) {
    const shape = shapes.find((s) => s.id === shapeEl.dataset.id);
    if (!shape) return;
    isShapeTransforming = true;
    const pointer = getCanvasPointer(event);
    resizeState = {
      id: shape.id,
      startX: pointer.x,
      startY: pointer.y,
      startWidth: shape.width,
      startHeight: shape.height,
      startLeft: shape.x,
      startTop: shape.y,
      handle: handle.dataset.resize
    };
    event.preventDefault();
    return;
  }
  if (!shapeEl) return;

  const shapeId = shapeEl.dataset.id;
  selectShape(shapeId);
  const shape = shapes.find((s) => s.id === shapeId);
  if (!shape) return;
  isShapeTransforming = true;
  const pointer = getCanvasPointer(event);
  dragState = {
    id: shapeId,
    offsetX: pointer.x - shape.x,
    offsetY: pointer.y - shape.y
  };
});

connectionsSvg.addEventListener("click", (event) => {
  const path = event.target.closest("path");
  const labelGroup = event.target.closest(".connection-label");
  const targetId = path?.dataset.id || labelGroup?.dataset.id;
  if (!targetId) return;
  event.stopPropagation();
  // #region agent log
  debugIngest({location:'tutorials/builder.js:connectionsSvg.click',message:'pathClick',data:{pathId:targetId},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1'});
  // #endregion
  selectConnection(targetId);
});


connectionsSvg.addEventListener("mousedown", (event) => {
  const path = event.target.closest(".connection-path, .connection-hit");
  if (path) {
    suppressCanvasClick = true;
    event.stopPropagation();
    event.preventDefault();
    const connection = connections.find((conn) => conn.id === path.dataset.id);
    if (!connection) return;
    const from = shapes.find((s) => s.id === connection.from);
    const to = shapes.find((s) => s.id === connection.to);
    if (!from || !to) return;
    const metrics = getCanvasMetrics();
    const pointer = getCanvasPointer(event);
    const mouse = {
      x: Math.max(0, Math.min(pointer.x, metrics.width)),
      y: Math.max(0, Math.min(pointer.y, metrics.height))
    };
    const start = connection.startAnchor
      ? getAnchorPointFromAnchor(from, connection.startAnchor)
      : getAnchorPoint(from, to);
    const end = connection.endAnchor
      ? getAnchorPointFromAnchor(to, connection.endAnchor)
      : getAnchorPoint(to, from);
    if (Array.isArray(connection.points) && connection.points.length >= maxConnectionPoints) {
      selectConnection(connection.id);
      materializeConnectionPoints(connection, start, end);
      const nodes = connection.points;
      let bestIndex = null;
      let bestDist = Infinity;
      for (let i = 0; i < nodes.length - 1; i += 1) {
        const dist = distanceToSegment(mouse, nodes[i], nodes[i + 1]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }
      if (
        bestIndex === null ||
        bestIndex <= 1 ||
        bestIndex >= nodes.length - 3
      ) {
        updateConnections();
        return;
      }
      segmentDrag = {
        connId: connection.id,
        segIndex: bestIndex,
        startX: pointer.x,
        startY: pointer.y,
        startPoints: connection.points.map((p) => ({ ...p })),
        adjustNeighbors: false
      };
      updateConnections();
      return;
    }
    materializeConnectionPoints(connection, start, end);
    const splitIndex = insertSplitPoint(connection, mouse);
    if (splitIndex === null) return;
    selectConnection(connection.id);
    segmentDrag = {
      connId: connection.id,
      segIndex: splitIndex,
      startX: pointer.x,
      startY: pointer.y,
      startPoints: connection.points.map((p) => ({ ...p })),
      adjustNeighbors: false
    };
    updateConnections();
    return;
  }
  if (event.button !== 0) return;
  const labelGroup = event.target.closest(".connection-label");
  if (!labelGroup) return;
  event.stopPropagation();
  event.preventDefault();
  const connection = connections.find((conn) => conn.id === labelGroup.dataset.id);
  if (!connection) return;
  selectConnection(connection.id);
  const pointer = getCanvasPointer(event);
  labelDrag = {
    connId: connection.id,
    startX: pointer.x,
    startY: pointer.y,
    startDx: connection.labelDx || 0,
    startDy: connection.labelDy || 0
  };
});

document.addEventListener("mousemove", (event) => {
  if (textDrag) {
    const shape = shapes.find((s) => s.id === textDrag.id);
    if (shape) {
      const pointer = getCanvasPointer(event);
      shape.textDx = textDrag.startDx + (pointer.x - textDrag.startX);
      shape.textDy = textDrag.startDy + (pointer.y - textDrag.startY);
      renderShapes();
    }
  }
  if (dragState) {
    const shape = shapes.find((s) => s.id === dragState.id);
    if (!shape) return;
    const metrics = getCanvasMetrics();
    const pointer = getCanvasPointer(event);
    let nextX = Math.max(
      0,
      Math.min(pointer.x - dragState.offsetX, metrics.width + metrics.scrollX - 20)
    );
    let nextY = Math.max(
      0,
      Math.min(pointer.y - dragState.offsetY, metrics.height + metrics.scrollY - 20)
    );
    const snapped = snapMovePosition(shape, nextX, nextY);
    nextX = Math.max(0, Math.min(snapped.x, metrics.width + metrics.scrollX - 20));
    nextY = Math.max(0, Math.min(snapped.y, metrics.height + metrics.scrollY - 20));
    shape.x = nextX;
    shape.y = nextY;
    updateSnapGuides(snapped.guideX, snapped.guideY);
    renderShapes();
  }

  if (resizeState) {
    const shape = shapes.find((s) => s.id === resizeState.id);
    if (!shape) return;
    const pointer = getCanvasPointer(event);
    const deltaX = pointer.x - resizeState.startX;
    const deltaY = pointer.y - resizeState.startY;
    const minSize = 50;
    const next = {
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      r: shape.x + shape.width,
      b: shape.y + shape.height,
      minSize,
      edgeX: null,
      edgeY: null
    };
    if (shape.type === "diamond") {
      let proj = 0;
      if (resizeState.handle === "br") {
        proj = (deltaX + deltaY) / Math.SQRT2;
      } else if (resizeState.handle === "tl") {
        proj = (-deltaX - deltaY) / Math.SQRT2;
      } else if (resizeState.handle === "tr") {
        proj = (deltaX - deltaY) / Math.SQRT2;
      } else if (resizeState.handle === "bl") {
        proj = (-deltaX + deltaY) / Math.SQRT2;
      }
      const size = Math.max(minSize, resizeState.startWidth + proj);
      next.width = size;
      next.height = size;
      if (resizeState.handle.includes("l")) {
        next.x = resizeState.startLeft + (resizeState.startWidth - size);
        next.edgeX = "left";
      } else if (resizeState.handle.includes("r")) {
        next.edgeX = "right";
      } else {
        next.edgeX = "center";
      }
      if (resizeState.handle.includes("t")) {
        next.y = resizeState.startTop + (resizeState.startHeight - size);
        next.edgeY = "top";
      } else if (resizeState.handle.includes("b")) {
        next.edgeY = "bottom";
      } else {
        next.edgeY = "center";
      }
    } else {
      if (resizeState.handle.includes("r")) {
        next.width = Math.max(minSize, resizeState.startWidth + deltaX);
        next.edgeX = "right";
      }
      if (resizeState.handle.includes("l")) {
        next.width = Math.max(minSize, resizeState.startWidth - deltaX);
        next.x = resizeState.startLeft + deltaX;
        next.edgeX = "left";
      }
      if (resizeState.handle.includes("b")) {
        next.height = Math.max(minSize, resizeState.startHeight + deltaY);
        next.edgeY = "bottom";
      }
      if (resizeState.handle.includes("t")) {
        next.height = Math.max(minSize, resizeState.startHeight - deltaY);
        next.y = resizeState.startTop + deltaY;
        next.edgeY = "top";
      }
      if (!next.edgeX) next.edgeX = "center";
      if (!next.edgeY) next.edgeY = "center";
    }
    if (shape.type === "logo" && shape.imageRatio) {
      const ratio = shape.imageRatio || 1;
      if (resizeState.handle.includes("l") || resizeState.handle.includes("r")) {
        next.height = Math.max(minSize, Math.round(next.width / ratio));
      } else if (resizeState.handle.includes("t") || resizeState.handle.includes("b")) {
        next.width = Math.max(minSize, Math.round(next.height * ratio));
      }
      if (resizeState.handle.includes("l")) {
        next.x = resizeState.startLeft + (resizeState.startWidth - next.width);
      }
      if (resizeState.handle.includes("t")) {
        next.y = resizeState.startTop + (resizeState.startHeight - next.height);
      }
    }
    next.r = next.x + next.width;
    next.b = next.y + next.height;
    const snapped = snapResize(shape, next);
    shape.x = snapped.next.x;
    shape.y = snapped.next.y;
    shape.width = snapped.next.width;
    shape.height = snapped.next.height;
    updateSnapGuides(snapped.guideX, snapped.guideY);
    renderShapes();
  }

  if (segmentDrag) {
    const connection = connections.find((c) => c.id === segmentDrag.connId);
    if (!connection) return;
    const idx = segmentDrag.segIndex;
    const a = segmentDrag.startPoints[idx];
    const b = segmentDrag.startPoints[idx + 1];
    if (!a || !b) return;
    const pointer = getCanvasPointer(event);
    const dx = pointer.x - segmentDrag.startX;
    const dy = pointer.y - segmentDrag.startY;
    const skipPrev = idx - 1 === 1;
    const skipNext = idx + 2 === segmentDrag.startPoints.length - 2;
    if (a.x === b.x) {
      let shift = dx;
      const exclude = new Set([idx, idx + 1]);
      if (segmentDrag.adjustNeighbors) {
        exclude.add(idx - 1);
        exclude.add(idx + 2);
      }
      const { xTargets } = getConnectionSnapTargets(connection.points, exclude);
      const snappedX = snapAxisValue(a.x + shift, xTargets);
      shift = snappedX - a.x;
      connection.points[idx].x = a.x + shift;
      connection.points[idx + 1].x = b.x + shift;
      if (segmentDrag.adjustNeighbors) {
        const prev = segmentDrag.startPoints[idx - 1];
        const next = segmentDrag.startPoints[idx + 2];
        if (prev && prev.x === a.x && !skipPrev) {
          connection.points[idx - 1].x = prev.x + shift;
        }
        if (next && next.x === b.x && !skipNext) {
          connection.points[idx + 2].x = next.x + shift;
        }
      }
    } else if (a.y === b.y) {
      let shift = dy;
      const exclude = new Set([idx, idx + 1]);
      if (segmentDrag.adjustNeighbors) {
        exclude.add(idx - 1);
        exclude.add(idx + 2);
      }
      const { yTargets } = getConnectionSnapTargets(connection.points, exclude);
      const snappedY = snapAxisValue(a.y + shift, yTargets);
      shift = snappedY - a.y;
      connection.points[idx].y = a.y + shift;
      connection.points[idx + 1].y = b.y + shift;
      if (segmentDrag.adjustNeighbors) {
        const prev = segmentDrag.startPoints[idx - 1];
        const next = segmentDrag.startPoints[idx + 2];
        if (prev && prev.y === a.y && !skipPrev) {
          connection.points[idx - 1].y = prev.y + shift;
        }
        if (next && next.y === b.y && !skipNext) {
          connection.points[idx + 2].y = next.y + shift;
        }
      }
    }
    connection.auto = false;
    updateConnections();
  }

  if (lineDrag) {
    const connection = connections.find((c) => c.id === lineDrag.connId);
    if (!connection) return;
    const pointer = getCanvasPointer(event);
    const dx = pointer.x - lineDrag.startX;
    const dy = pointer.y - lineDrag.startY;
    const points = lineDrag.startPoints.map((p) => ({ ...p }));
    const startIndex = 2;
    const endIndex = points.length - 3;
    if (startIndex <= endIndex) {
      if (lineDrag.axis === "x") {
        for (let i = startIndex; i <= endIndex; i += 1) {
          points[i].x += dx;
        }
      } else {
        for (let i = startIndex; i <= endIndex; i += 1) {
          points[i].y += dy;
        }
      }
    }
    connection.auto = false;
    updateConnections();
  }

  if (cornerDrag) {
    const connection = connections.find((c) => c.id === cornerDrag.connId);
    if (!connection) return;
    const metrics = getCanvasMetrics();
    const pointer = getCanvasPointer(event);
    const mouseX = Math.max(0, Math.min(pointer.x, metrics.width));
    const mouseY = Math.max(0, Math.min(pointer.y, metrics.height));
    const idx = cornerDrag.cornerIndex;
    const startPoint = cornerDrag.startPoints[idx];
    if (!startPoint) return;
    const prev = cornerDrag.startPoints[idx - 1];
    const next = cornerDrag.startPoints[idx + 1];
    const isPrevFixed = idx - 1 === 1;
    const isNextFixed = idx + 1 === cornerDrag.startPoints.length - 2;
    let newX = mouseX;
    let newY = mouseY;
    const alignTol = 0.5;
    const prevVertical = prev && Math.abs(prev.x - startPoint.x) <= alignTol;
    const prevHorizontal = prev && Math.abs(prev.y - startPoint.y) <= alignTol;
    const nextVertical = next && Math.abs(next.x - startPoint.x) <= alignTol;
    const nextHorizontal = next && Math.abs(next.y - startPoint.y) <= alignTol;
    if (prev) {
      if (prevVertical && isPrevFixed) {
        newX = prev.x;
      } else if (prevHorizontal && isPrevFixed) {
        newY = prev.y;
      }
    }
    if (next) {
      if (nextVertical && isNextFixed) {
        newX = next.x;
      } else if (nextHorizontal && isNextFixed) {
        newY = next.y;
      }
    }
    connection.points[idx] = { x: newX, y: newY };
    if (prev && !isPrevFixed) {
      if (prevVertical) {
        connection.points[idx - 1].x = newX;
      } else if (prevHorizontal) {
        connection.points[idx - 1].y = newY;
      }
    }
    if (next && !isNextFixed) {
      if (nextVertical) {
        connection.points[idx + 1].x = newX;
      } else if (nextHorizontal) {
        connection.points[idx + 1].y = newY;
      }
    }
    connection.auto = false;
    updateConnections();
  }

  if (overlayDrag || overlayResize) {
    // overlay drag handled by pointer events
  }

  if (endpointDrag) {
    const connection = connections.find((c) => c.id === endpointDrag.connId);
    if (!connection) return;
    const anchorHit = getAnchorUnderPointer(event);
    if (anchorHit) {
      endpointDrag.attached = true;
      if (endpointDrag.end === "start") {
        connection.from = anchorHit.shapeId;
        connection.startAnchor = anchorHit.anchorId;
      } else {
        connection.to = anchorHit.shapeId;
        connection.endAnchor = anchorHit.anchorId;
      }
      updateConnections();
    }
  }

  if (labelDrag) {
    const connection = connections.find((c) => c.id === labelDrag.connId);
    if (!connection) return;
    const pointer = getCanvasPointer(event);
    connection.labelDx = labelDrag.startDx + (pointer.x - labelDrag.startX);
    connection.labelDy = labelDrag.startDy + (pointer.y - labelDrag.startY);
    if (selectedConnectionId === connection.id) {
      propLineTextX.value = Math.round(connection.labelDx);
      propLineTextY.value = Math.round(connection.labelDy);
    }
    updateConnections();
  }
});

document.addEventListener("mouseup", () => {
  const editedConnId = segmentDrag?.connId || cornerDrag?.connId || lineDrag?.connId;
  if (editedConnId) {
    const connection = connections.find((conn) => conn.id === editedConnId);
    if (connection && Array.isArray(connection.points)) {
      connection.points = simplifyAlignedPoints(
        mergeOverlappingPoints(connection.points)
      );
    }
  }
  dragState = null;
  resizeState = null;
  segmentDrag = null;
  cornerDrag = null;
  lineDrag = null;
  labelDrag = null;
  textDrag = null;
  overlayDrag = null;
  overlayResize = null;
  clearSnapGuides();
  renderShapes();
  updateConnections();
  if (endpointDrag) {
    const connection = connections.find((c) => c.id === endpointDrag.connId);
    if (connection && !endpointDrag.attached) {
      connection.from = endpointDrag.original.from;
      connection.to = endpointDrag.original.to;
      connection.startAnchor = endpointDrag.original.startAnchor;
      connection.endAnchor = endpointDrag.original.endAnchor;
      updateConnections();
    }
    endpointDrag = null;
  }
  isShapeTransforming = false;
  setTimeout(() => {
    suppressCanvasClick = false;
  }, 0);
});

canvas.addEventListener("click", (event) => {
  if (suppressCanvasClick) return;
  if (
    !event.target.closest(".shape") &&
    !event.target.closest(".conn-handle") &&
    !event.target.closest("path")
  ) {
    clearSelection();
  }
});

canvas.addEventListener("dblclick", (event) => {
  const shapeEl = event.target.closest(".shape");
  if (!shapeEl) return;
  event.stopPropagation();
  handleWorkflowEditRequest(shapeEl.dataset.id);
});

propText.addEventListener("input", (event) => {
  updateSelectedShape({ text: event.target.value });
});

propFontSize.addEventListener("input", (event) => {
  updateSelectedShape({ fontSize: Number(event.target.value) });
});

propFontFamily.addEventListener("change", (event) => {
  updateSelectedShape({ fontFamily: event.target.value });
});

propTextColor.addEventListener("input", (event) => {
  updateSelectedShape({ textColor: event.target.value });
});

propBgColor.addEventListener("input", (event) => {
  updateSelectedShape({ bgColor: event.target.value });
});

propOpacity.addEventListener("input", (event) => {
  updateSelectedShape({ opacity: Number(event.target.value) / 100 });
});

propLineStyle.addEventListener("change", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.lineStyle = event.target.value;
  // #region agent log
  debugIngest({location:'tutorials/builder.js:propLineStyle',message:'lineStyleChange',data:{id:selectedConnectionId,value:event.target.value},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4'});
  // #endregion
  updateConnections();
});

propLineArrow.addEventListener("change", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.lineArrow = event.target.value === "true";
  // #region agent log
  debugIngest({location:'tutorials/builder.js:propLineArrow',message:'lineArrowChange',data:{id:selectedConnectionId,value:event.target.value},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4'});
  // #endregion
  updateConnections();
});

propLineColor.addEventListener("input", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.lineColor = event.target.value;
  updateConnections();
});

propLineText.addEventListener("input", (event) => {
  // #region agent log
  debugIngest({location:'tutorials/builder.js:propLineText',message:'lineTextInput',data:{selectedConnectionId,value:event.target.value,shapePropsHidden:shapeProps.classList.contains("hidden"),connectionPropsHidden:connectionProps.classList.contains("hidden")},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H5'});
  // #endregion
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.label = event.target.value;
  updateConnections();
});

propLineBgColor.addEventListener("input", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.labelBgColor = event.target.value;
  updateConnections();
});

propLineTextOpacity.addEventListener("input", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.labelOpacity = Number(event.target.value) / 100;
  updateConnections();
});

propLineTextColor.addEventListener("input", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.labelTextColor = event.target.value;
  updateConnections();
});

propLineTextX.addEventListener("input", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.labelDx = Number(event.target.value);
  updateConnections();
});

propLineTextY.addEventListener("input", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.labelDy = Number(event.target.value);
  updateConnections();
});

propGroup.addEventListener("change", (event) => {
  updateSelectedShape({ group: event.target.value });
  applyGroupFilter();
});

deleteShapeButton.addEventListener("click", () => {
  if (selectedShapeId) {
    const removedId = selectedShapeId;
    shapes = shapes.filter((shape) => shape.id !== removedId);
    connections = connections.filter(
      (conn) => conn.from !== removedId && conn.to !== removedId
    );
    selectedShapeId = null;
    selectedConnectionId = null;
    renderShapes();
    return;
  }
  if (selectedConnectionId) {
    connections = connections.filter((conn) => conn.id !== selectedConnectionId);
    selectedConnectionId = null;
    connectionProps.classList.add("hidden");
    updateConnections();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  const activeTag = document.activeElement?.tagName?.toLowerCase();
  if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
    return;
  }
  if (selectedOverlay) {
    const shape = tutorialShapes.find((item) => item.id === selectedOverlay.shapeId);
    const step = getTutorialStepByPath(shape, selectedOverlay.stepPath);
    const entry = step?.items?.[selectedOverlay.itemIndex];
    if (entry?.overlays) {
      entry.overlays = entry.overlays.filter((ov) => ov.id !== selectedOverlay.overlayId);
      selectedOverlay = null;
      renderTutorialEditor();
      return;
    }
  }
  if (
    Array.isArray(activeStepPath) &&
    tutorialShapes.length &&
    document.querySelector(".mode-tab.active")?.dataset.mode === "tutorial"
  ) {
    removeStepByPath(activeStepPath);
    activeStepPath = null;
    renderTutorialEditor();
    return;
  }
  deleteShapeButton.click();
});

exportButton.addEventListener("click", exportJson);

importInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    importJson(file);
    event.target.value = "";
  }
});

if (saveWorkflowButton) {
  saveWorkflowButton.addEventListener("click", saveWorkflowToApi);
}

if (loadWorkflowButton) {
  loadWorkflowButton.addEventListener("click", loadWorkflowFromApi);
}
if (deleteWorkflowButton) {
  deleteWorkflowButton.addEventListener("click", deleteWorkflowFromApi);
}

if (workflowList) {
  workflowList.addEventListener("change", () => {
    if (!workflowNameInput) return;
    const option = workflowList.selectedOptions?.[0];
    if (option && option.value) {
      workflowNameInput.value = option.textContent || "";
    }
  });
}

addGroupButton.addEventListener("click", () => {
  const name = groupNameInput.value.trim();
  if (!name || groups.includes(name)) return;
  groups.push(name);
  groupNameInput.value = "";
  refreshGroupOptions();
});

groupFilter.addEventListener("change", applyGroupFilter);

clearFilterButton.addEventListener("click", () => {
  groupFilter.value = "";
  applyGroupFilter();
});

refreshGroupOptions();
if (modeTabs.length) {
  setActiveMode("workflow");
}
updateEditButtonState();
if (refreshBlocksButton) {
  refreshBlocksButton.addEventListener("click", loadBlocks);
}
loadBlocks();
loadWorkflowList();

window.addEventListener("resize", () => {
  updateConnections();
});

if (cropCanvas) {
  cropCanvas.addEventListener("mousedown", (event) => {
    if (!cropState) return;
    const rect = cropCanvas.getBoundingClientRect();
    cropState.dragging = true;
    cropState.startX = event.clientX - rect.left;
    cropState.startY = event.clientY - rect.top;
    cropState.endX = cropState.startX;
    cropState.endY = cropState.startY;
    drawCropSelection();
  });

  cropCanvas.addEventListener("mousemove", (event) => {
    if (!cropState || !cropState.dragging) return;
    const rect = cropCanvas.getBoundingClientRect();
    cropState.endX = event.clientX - rect.left;
    cropState.endY = event.clientY - rect.top;
    drawCropSelection();
  });

  cropCanvas.addEventListener("mouseup", () => {
    if (!cropState) return;
    cropState.dragging = false;
    drawCropSelection();
  });
}

if (cropApplyButton) {
  cropApplyButton.addEventListener("click", () => {
    if (!cropState) return;
    const { image, scale, startX, startY, endX, endY, onApply } = cropState;
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);
    if (w < 5 || h < 5) {
      closeCropModal();
      return;
    }
    const sx = x / scale;
    const sy = y / scale;
    const sw = w / scale;
    const sh = h / scale;
    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    const outCtx = out.getContext("2d");
    if (!outCtx) return;
    outCtx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    const cropped = out.toDataURL("image/png");
    onApply(cropped);
    closeCropModal();
  });
}

if (cropCancelButton) {
  cropCancelButton.addEventListener("click", closeCropModal);
}

if (cropCloseButton) {
  cropCloseButton.addEventListener("click", closeCropModal);
}

document.addEventListener("paste", (event) => {
  if (!activeImageStep) return;
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (!imageItem) return;
  const file = imageItem.getAsFile();
  if (!file) return;
  const shape = tutorialShapes.find((s) => s.id === activeImageStep.shapeId);
  if (!shape || !shape.tutorial || !Array.isArray(shape.tutorial.steps)) return;
  const step = getTutorialStepByPath(shape, activeImageStep.stepPath);
  if (!step || !Array.isArray(step.items)) return;
  const item = step.items[activeImageStep.itemIndex];
  if (!item || item.type !== "image") return;
  const reader = new FileReader();
  reader.onload = () => {
    item.src = reader.result;
    renderTutorialEditor();
  };
  reader.readAsDataURL(file);
});

logoInput.addEventListener("change", (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const entry = {
        name: file.name.replace(".svg", ""),
        data: reader.result
      };
      logoLibrary.push(entry);
      renderLogoList();
    };
    reader.readAsDataURL(file);
  });
  event.target.value = "";
});

function renderLogoList() {
  logoList.innerHTML = "";
  logoLibrary.forEach((logo) => {
    const row = document.createElement("div");
    row.className = "logo-item";
    const img = document.createElement("img");
    img.src = logo.data;
    img.alt = logo.name;
    const button = document.createElement("button");
    button.className = "shape-btn";
    button.textContent = "Inserer";
    button.addEventListener("click", () => {
      const id = generateId("shape");
      const shape = {
        id,
        type: "logo",
        x: 120,
        y: 120,
        width: 120,
        height: 80,
        text: "",
        fontSize: 12,
        fontFamily: "Segoe UI",
        textColor: "#1f2933",
        bgColor: "#ffffff",
        opacity: 1,
        group: "",
        imageData: logo.data
      };
      shapes.push(shape);
      renderShapes();
      selectShape(id);
    });
    const label = document.createElement("span");
    label.textContent = logo.name;
    row.appendChild(img);
    row.appendChild(label);
    row.appendChild(button);
    logoList.appendChild(row);
  });
}
