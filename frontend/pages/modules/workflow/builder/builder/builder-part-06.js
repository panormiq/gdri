
const t = window.workflowBuilderT || ((key, fallback, params) => fallback || key);

async function loadWorkflowFromApi() {
  if (!workflowList) return;
  const path = workflowList.value;
  if (!path) return;
  try {
    let data = null;
    if (path.startsWith("api:")) {
      const id = path.slice(4);
      const payload = await fetchJson(`${WORKFLOW_API_BASE}/workflow/workflows/${id}`);
      data = payload?.data?.payload || payload?.data || payload;
    } else {
      const fallbackPath = /^https?:\/\//i.test(path)
        ? path
        : `${WORKFLOW_SHARED_BASE}/${path.replace(/^\.?\/*/, "")}`;
      data = await fetchJson(fallbackPath);
    }
    applyWorkflowData(data?.payload || data);
    if (workflowNameInput && workflowList.selectedOptions.length) {
      workflowNameInput.value = workflowList.selectedOptions[0].textContent;
    }
  } catch (error) {
    alert(t("alert.loadWorkflowFailed", "Impossible de charger ce workflow."));
  }
}

async function deleteWorkflowFromApi() {
  if (!workflowList) return;
  const path = workflowList.value;
  if (!path) return;
  const name = workflowList.selectedOptions?.[0]?.textContent || path;
  const confirmed = window.confirm(
    t("confirm.deleteWorkflow", "Supprimer \"{name}\" ?", { name })
  );
  if (!confirmed) return;
  try {
    if (path.startsWith("api:")) {
      const id = path.slice(4);
      await fetchJson(`${WORKFLOW_API_BASE}/workflow/workflows/${id}`, {
        method: "DELETE"
      });
    } else {
      throw new Error("delete_not_supported");
    }
    loadWorkflowList();
  } catch (error) {
    alert(t("alert.deleteWorkflowFailed", "Impossible de supprimer ce workflow."));
  }
}

async function saveWorkflowToApi() {
  syncEditingWorkflowShape();
  const name =
    (workflowNameInput?.value || "").trim() ||
    workflowList?.selectedOptions?.[0]?.textContent ||
    t("workflow.defaultName", "workflow");
  try {
    const payload = {
      name,
      payload: {
        shapes,
        connections,
        groups
      }
    };
    const selectedPath = workflowList?.value || "";
    if (selectedPath.startsWith("api:")) {
      const id = selectedPath.slice(4);
      await fetchJson(`${WORKFLOW_API_BASE}/workflow/workflows/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      await fetchJson(`${WORKFLOW_API_BASE}/workflow/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }
    loadWorkflowList();
  } catch (error) {
    alert(t("alert.saveWorkflowFailed", "Impossible d'enregistrer le workflow."));
  }
}

function createWorkflowShapeFromBlock(block, position) {
  const id = generateId("shape");
  const blockTitle =
    block?.tutorial?.title ||
    block?.name ||
    block?.shape?.text ||
    t("shape.defaultLabel", "Forme");
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
        title: step.title || t("tutorial.stepTitle", "Etape {index}", { index: index + 1 }),
        items: Array.isArray(step.items) ? step.items : [],
        collapsed: Boolean(step.collapsed),
        substeps: normalizeTutorialSteps(step.substeps || [])
      };
    }
    if (step && step.type) {
      return {
        title: t("tutorial.stepTitle", "Etape {index}", { index: index + 1 }),
        items: [step],
        collapsed: Boolean(step.collapsed),
        substeps: []
      };
    }
    return {
      title: step?.title || t("tutorial.stepTitle", "Etape {index}", { index: index + 1 }),
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
