  }
  return "#0e9cef";
}

const t = window.workflowBuilderT || ((key, fallback) => fallback || key);

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
      if (tutorialStepDrag.path.length !== 1) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    tutorialStepsHost.addEventListener("drop", (event) => {
      if (!tutorialStepDrag) return;
      if (tutorialStepDrag.path.length !== 1) return;
      event.preventDefault();
      const shapeRef = getActiveTutorialShape();
      const steps = getStepsCollectionByPath(shapeRef, []);
      if (!steps) return;
      moveArrayItem(steps, tutorialStepDrag.path[0], steps.length);
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
    const fromParent = tutorialStepDrag.path.slice(0, -1);
    const toParent = path.slice(0, -1);
    if (!isSamePath(fromParent, toParent)) return;
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
    const fromParent = tutorialStepDrag.path.slice(0, -1);
    const toParent = path.slice(0, -1);
    if (!isSamePath(fromParent, toParent)) return;
    event.preventDefault();
    event.stopPropagation();
    stepCard.classList.remove("drag-over");
    const shapeRef = getActiveTutorialShape();
    const steps = getStepsCollectionByPath(shapeRef, toParent);
    if (!steps) return;
    moveArrayItem(steps, tutorialStepDrag.path[tutorialStepDrag.path.length - 1], stepIndex);
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
  dragHandle.title = t("tutorial.moveStep", "Deplacer l'etape");
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
  titleInput.value =
    step.title ||
    t("tutorial.stepTitle", "Etape {index}", { index: stepIndex + 1 });
  titleInput.placeholder = t("tutorial.stepNamePlaceholder", "Nom de l'etape");
  titleInput.addEventListener("input", () => {
    step.title = titleInput.value;
  });

  const removeButton = document.createElement("button");
  removeButton.className = "shape-btn";
  removeButton.textContent = t("common.delete", "Supprimer");
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
    if (!isSamePath(tutorialItemDrag.stepPath, path)) return;
    if (event.target !== itemsHost) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });
  itemsHost.addEventListener("drop", (event) => {
    if (!tutorialItemDrag) return;
    if (!isSamePath(tutorialItemDrag.stepPath, path)) return;
    if (event.target !== itemsHost) return;
    event.preventDefault();
    const shapeRef = getActiveTutorialShape();
    const stepRef = getTutorialStepByPath(shapeRef, path);
    if (!stepRef?.items) return;
    moveArrayItem(stepRef.items, tutorialItemDrag.itemIndex, stepRef.items.length);
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
      const fromParent = tutorialStepDrag.path.slice(0, -1);
      if (!isSamePath(fromParent, path)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    subHost.addEventListener("drop", (event) => {
      if (!tutorialStepDrag) return;
      const fromParent = tutorialStepDrag.path.slice(0, -1);
      if (!isSamePath(fromParent, path)) return;
      event.preventDefault();
      const shapeRef = getActiveTutorialShape();
      const steps = getStepsCollectionByPath(shapeRef, path);
      if (!steps) return;
      moveArrayItem(steps, tutorialStepDrag.path[tutorialStepDrag.path.length - 1], steps.length);
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

function getStepsCollectionByPath(shape, parentPath) {
  if (!shape?.tutorial?.steps) return null;
