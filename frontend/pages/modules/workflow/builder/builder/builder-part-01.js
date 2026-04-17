const t = window.workflowBuilderT || ((key, fallback) => fallback || key);
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

const WORKFLOW_SHARED_BASE = "../shared";
const WORKFLOW_API_BASE =
  (window.GDRI_WORKFLOW_CONFIG && window.GDRI_WORKFLOW_CONFIG.apiBaseUrl) ||
  window.API_BASE_URL ||
  window.GDRI_API_BASE_URL ||
  "http://localhost:3000/api";

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
const blockPreviewCache = new Map();
const DEBUG_INGEST_URL = "";
const defaultTutorialShapeCategory = t("shapeCategory.general", "Général");
const tutorialShapeLibraryDefaults = [
  { id: "rect", type: "rect", label: t("shape.rect", "Rectangle"), category: defaultTutorialShapeCategory, standard: true },
  { id: "diamond", type: "diamond", label: t("shape.diamond", "Losange"), category: defaultTutorialShapeCategory, standard: true },
  { id: "round", type: "round", label: t("shape.roundedRect", "Rectangle arrondi"), category: defaultTutorialShapeCategory, standard: true },
  { id: "circle", type: "circle", label: t("shape.circle", "Cercle"), category: defaultTutorialShapeCategory, standard: true },
  { id: "ellipse", type: "ellipse", label: t("shape.ellipse", "Ellipse"), category: defaultTutorialShapeCategory, standard: true }
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
