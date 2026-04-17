}

const t = window.workflowBuilderT || ((key, fallback, params) => fallback || key);

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
      text: entry.label || t("shape.defaultLabel", "Forme"),
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
    shape.text = entry.label || t("shape.defaultLabel", "Forme");
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
    const rawFile = entry;
    const isRemote = /^https?:\/\//i.test(rawFile);
    const file = isRemote
      ? rawFile
      : `${WORKFLOW_SHARED_BASE}/${rawFile.replace(/^\.?\/*/, "")}`;
    return { id: `block-${index}`, name: entry, file };
  }
  if (typeof entry === "object") {
    const name =
      entry.name ||
      entry.title ||
      entry.id ||
      t("block.indexLabel", "Block {index}", { index: index + 1 });
    const rawFile = entry.file || entry.path || entry.src;
    if (!rawFile) return null;
    const isRemote = /^https?:\/\//i.test(rawFile);
    const file = isRemote || rawFile.startsWith("api:")
      ? rawFile
      : `${WORKFLOW_SHARED_BASE}/${rawFile.replace(/^\.?\/*/, "")}`;
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
    const rawSource = section;
    const isRemote = /^https?:\/\//i.test(rawSource);
    const source = isRemote
      ? rawSource
      : `${WORKFLOW_SHARED_BASE}/${rawSource.replace(/^\.?\/*/, "")}`;
    return {
      id: `section-${index}`,
      name: section,
      source,
      blocks: []
    };
  }
  if (typeof section === "object") {
    const name =
      section.name ||
      section.title ||
      section.id ||
      t("category.indexLabel", "Categorie {index}", { index: index + 1 });
    const rawBlocks = normalizeBlockIndex(section.blocks || section.items || section.entries);
    const rawSource = section.file || section.index || section.path || section.src || null;
    const source = rawSource
      ? (/^https?:\/\//i.test(rawSource) || rawSource.startsWith("api:")
        ? rawSource
        : `${WORKFLOW_SHARED_BASE}/${rawSource.replace(/^\.?\/*/, "")}`)
      : null;
    return {
      id: section.id || `section-${index}`,
      name,
      source,
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
      name: payload?.name || t("blocks.customSection", "Blocks personnalises"),
      source: null,
      blocks: entries
    }
  ];
}

async function fetchJson(url, options) {
  const response = await fetch(url, { credentials: "include", ...options });
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
    const hint = t("hint.inlineOnlyLinks", "Les liens sont toujours en inline.");
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
  placeholder.textContent = t("category.choose", "Choisir une categorie");
  blockCategorySelect.appendChild(placeholder);
  sections.forEach((section) => {
    const option = document.createElement("option");
    option.value = section.name || section.id || "";
    option.textContent =
      section.name || section.id || t("category.defaultLabel", "Categorie");
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
    const payload = await fetchJson(`${WORKFLOW_SHARED_BASE}/block/index.json`);
    return { payload, source: "json" };
  }
}

async function fetchWorkflowIndex() {
  try {
    const payload = await fetchJson(`${WORKFLOW_API_BASE}/workflow/workflows`);
    if (Array.isArray(payload?.data)) {
      return { payload: { workflows: payload.data }, source: "api" };
    }
    return { payload, source: "api" };
  } catch (error) {
    const payload = await fetchJson(`${WORKFLOW_SHARED_BASE}/workflows/index.json`);
    return { payload, source: "json" };
  }
}

function normalizeWorkflowEntry(entry, index) {
  if (!entry) return null;
  if (typeof entry === "string") {
    const path = entry;
    return { id: `workflow-${index}`, name: entry, path };
  }
  if (typeof entry === "object") {
    const apiId = entry._id || entry.id;
    if (apiId && !entry.path && !entry.file && !entry.src) {
      const name = entry.name || entry.title || apiId || `Workflow ${index + 1}`;
      return { id: apiId, name, path: `api:${apiId}` };
    }
    const name = entry.name || entry.title || apiId || `Workflow ${index + 1}`;
    const rawPath = entry.path || entry.file || entry.src;
    if (!rawPath) return null;
    const isRemote = /^https?:\/\//i.test(rawPath);
    const path = isRemote || rawPath.startsWith("api:")
      ? rawPath
      : `${WORKFLOW_SHARED_BASE}/${rawPath.replace(/^\.?\/*/, "")}`;
    return { id: apiId || `workflow-${index}`, name, path };
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
  placeholder.textContent = t("workflow.noneOption", "Aucun workflow");
  blockWorkflowSelect.appendChild(placeholder);
  try {
    const { payload } = await fetchWorkflowIndex();
    blockWorkflowEntries = normalizeWorkflowIndex(payload);
    blockWorkflowEntries.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.path;
    option.textContent =
      entry.name || entry.path || t("workflow.defaultLabel", "Workflow");
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
