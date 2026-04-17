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

const t = window.workflowBuilderT || ((key, fallback) => fallback || key);

function createTutorialShapeFromConnection(connection) {
  if (!connection) return null;
  const defaults = tutorialShapeDefaults.link || tutorialShapeDefaults.rect;
  const title =
    connection?.tutorial?.title ||
    connection?.label ||
    connection?.id ||
    t("connection.defaultLabel", "Lien");
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
  const title =
    block?.tutorial?.title ||
    block?.name ||
    block?.shape?.text ||
    t("shape.defaultLabel", "Forme");
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
    text.textContent = entry.label || entry.type || t("shape.defaultLabel", "Forme");
    preview.appendChild(text);
  }
  return preview;
}

function createBlockPreview(block, fallbackLabel) {
  const entry = {
    type: block?.shape?.type || "rect",
    label:
      block?.tutorial?.title ||
      block?.name ||
      fallbackLabel ||
      t("block.defaultLabel", "Block"),
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
    caption.textContent = entry.label || t("shape.defaultLabel", "Forme");
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
          label: entry.label || t("shape.defaultLabel", "Forme"),
          imageData: entry.imageData || null
        })
      );
      event.dataTransfer?.setData("text/plain", entry.label || t("shape.defaultLabel", "Forme"));
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
