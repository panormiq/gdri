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

const t = window.workflowBuilderT || ((key, fallback) => fallback || key);

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
  text.textContent = titleOverride || shape.text || t("shape.defaultLabel", "Forme");
  preview.appendChild(text);
  tutorialPreview.appendChild(preview);
}

function renderTutorialDetailsPreview(tutorial, fallbackTitle, titleEl, contentEl) {
  if (!titleEl || !contentEl) return;
  titleEl.textContent = tutorial?.title || fallbackTitle || t("preview.title", "Apercu");
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
    note.textContent = t(
      "tutorial.noSteps",
      "Aucune etape definie pour cette forme."
    );
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
  summary.textContent =
    step.title || t("tutorial.stepTitle", "Etape {index}", { index: index + 1 });
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
    empty.textContent = t("tutorial.stepEmpty", "Aucun contenu dans cette etape.");
    body.appendChild(empty);
  } else {
    items.forEach((entry) => {
      if (entry.type === "image") {
        if (!entry.src) {
          const empty = document.createElement("p");
          empty.className = "brick-note";
          empty.textContent = t(
            "tutorial.stepMissingCapture",
            "Capture manquante pour cette etape."
          );
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
            overlayEl.textContent = overlay.text || "";
            overlayEl.style.backgroundColor = "rgba(255, 255, 255, 0.85)";
          }
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
  const message = t(
    "preview.empty",
    "Cliquez sur un block pour afficher son rendu."
  );
  if (workflowPreviewTitle) {
    workflowPreviewTitle.textContent = t("preview.title", "Apercu");
  }
  if (workflowPreviewContent) {
    workflowPreviewContent.innerHTML = "";
    workflowPreviewContent.textContent = message;
  }
  if (previewTitle) previewTitle.textContent = t("preview.title", "Apercu");
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
    name: title || t("shape.defaultLabel", "Forme"),
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
    if (!isSamePath(tutorialItemDrag.stepPath, stepPath)) return;
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
    if (!isSamePath(tutorialItemDrag.stepPath, stepPath)) return;
    event.preventDefault();
    event.stopPropagation();
    wrapper.classList.remove("drag-over");
    const shapeRef = getActiveTutorialShape();
    const stepRef = getTutorialStepByPath(shapeRef, stepPath);
    if (!stepRef?.items) return;
    moveArrayItem(stepRef.items, tutorialItemDrag.itemIndex, itemIndex);
    renderTutorialEditor();
  });

  const toolbar = document.createElement("div");
  toolbar.className = "tutorial-step-toolbar drag-zone";

  const dragHandle = document.createElement("button");
  dragHandle.type = "button";
  dragHandle.className = "drag-handle";
  dragHandle.textContent = "↕";
  dragHandle.title = t("tutorial.moveItem", "Deplacer le contenu");
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
  boldButton.textContent = t("editor.bold", "Gras");
  const italicButton = document.createElement("button");
  italicButton.type = "button";
  italicButton.textContent = t("editor.italic", "Italique");
  const highlightButton = document.createElement("button");
  highlightButton.type = "button";
  highlightButton.textContent = t("editor.highlight", "Surligne");
  const sizeSelect = document.createElement("select");
  [12, 14, 16, 18, 20, 24].forEach((size) => {
    const option = document.createElement("option");
    option.value = String(size);
    option.textContent = `${size}px`;
    sizeSelect.appendChild(option);
  });
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = t("common.delete", "Supprimer");
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
