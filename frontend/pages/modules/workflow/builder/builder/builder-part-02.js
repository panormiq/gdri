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

const t = window.workflowBuilderT || ((key, fallback) => fallback || key);

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
    .replace(/^-+|-+$/g, "") || t("slug.default", "bloc");
}

function createTutorialTemplate(title) {
  return {
    title: title || t("tutorial.defaultTitle", "Tutoriel de la forme"),
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
    blockStorageIndicator.textContent = t("blockStorage.inline", "Inline");
    blockStorageIndicator.classList.add("hidden");
    return;
  }
  blockStorageIndicator.classList.remove("hidden");
  blockStorageIndicator.textContent = shape.blockPath
    ? t("blockStorage.block", "Block")
    : t("blockStorage.inline", "Inline");
}

function updateBlockStorageIndicatorForConnection(connection) {
  if (!blockStorageIndicator) return;
  if (!connection) {
    blockStorageIndicator.textContent = t("blockStorage.inline", "Inline");
    blockStorageIndicator.classList.add("hidden");
    return;
  }
  blockStorageIndicator.classList.remove("hidden");
  blockStorageIndicator.textContent = t("blockStorage.inline", "Inline");
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
      t(
        "alert.saveOrLoadWorkflowForInline",
        "Enregistrez ou chargez un workflow pour pouvoir sauvegarder les blocs inline."
      )
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
    text: entry.label || t("shape.defaultLabel", "Forme"),
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
      label: shape.text || t("shape.defaultLabel", "Forme"),
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
    label: shape.type === "logo"
      ? t("shape.logoLabel", "Logo")
      : shape.type || t("shape.defaultLabel", "Forme"),
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
    text: t("shape.defaultLabel", "Forme"),
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
    name: workflowShape.text || t("shape.defaultLabel", "Forme"),
    shape: {
      type: workflowShape.type || "rect",
      text: workflowShape.text || t("shape.defaultLabel", "Forme"),
      width: workflowShape.width,
