
const t = window.workflowBuilderT || ((key, fallback, params) => fallback || key);

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
  const base = createTutorialTemplate(fallbackTitle || t("shape.defaultLabel", "Forme"));
  const tutorial = {
    ...base,
    ...(block?.tutorial || {})
  };
  tutorial.title = tutorial.title || fallbackTitle || t("shape.defaultLabel", "Forme");
  tutorial.steps = normalizeTutorialSteps(tutorial.steps || []);
  if (!Array.isArray(tutorial.conditions)) {
    tutorial.conditions = [];
  }
  return tutorial;
}

function createTutorialShapeFromBlock(block, meta) {
  const type = block?.shape?.type || "rect";
  const defaults = tutorialShapeDefaults[type] || tutorialShapeDefaults.rect;
  const title =
    block?.tutorial?.title ||
    block?.name ||
    block?.shape?.text ||
    t("shape.defaultLabel", "Forme");
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
        label: entry.name || entry.id || t("block.defaultLabel", "Block"),
        imageData: entry.shape.imageData || null
      }
    : null;
  const preview = shapePreview
    ? createLibraryPreview(shapePreview)
    : createLibraryPreview({
        type: "rect",
        label: entry.name || entry.id || t("block.defaultLabel", "Block")
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
          name: entry.name || entry.id || t("block.defaultLabel", "Block"),
          category: entry.category || ""
        })
      );
      event.dataTransfer?.setData(
        "text/plain",
        entry.name || t("block.defaultLabel", "Block")
      );
    });
    card.addEventListener("click", (event) => {
      event.preventDefault();
    });
    card.addEventListener("dblclick", async (event) => {
      event.preventDefault();
      if (!hasActiveWorkflowSelection()) {
        alert(
          t(
            "alert.saveOrLoadWorkflowForInline",
            "Enregistrez ou chargez un workflow pour pouvoir sauvegarder les blocs inline."
          )
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
        alert(t("alert.loadBlockFailed", "Impossible de charger ce block."));
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
        alert(t("alert.loadBlockFailed", "Impossible de charger ce block."));
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
    setBlockSaveHint(
      t("hint.inlineOnlyLinks", "Les liens sont toujours en inline."),
      false
    );
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
    setBlockSaveHint(t("alert.fileNameRequired", "Nom de fichier obligatoire."), true);
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
      setBlockSaveHint(
        t("block.savedPath", "Enregistre: {path}", { path: data.path })
      );
      syncEditingWorkflowShape({ usePath: true });
      loadBlocks();
      return;
    }
    setBlockSaveHint(t("block.saveComplete", "Enregistrement termine."), false);
    loadBlocks();
  } catch (error) {
    setBlockSaveHint(
      t("alert.saveBlockFailed", "Impossible d'enregistrer le block."),
      true
    );
  }
}

async function loadWorkflowList() {
  if (!workflowList) return;
  workflowList.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = t("workflow.loadPlaceholder", "Charger un workflow");
  workflowList.appendChild(placeholder);
  try {
    const { payload } = await fetchWorkflowIndex();
    const entries = normalizeWorkflowIndex(payload);
    entries.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.path || "";
      option.textContent =
        entry.name || entry.id || entry.path || t("workflow.defaultLabel", "Workflow");
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
