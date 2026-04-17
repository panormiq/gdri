(() => {
  const t = window.workflowBuilderT || ((key, fallback) => fallback || key);

  const tabs = Array.from(document.querySelectorAll(".builder-tab"));
  const panels = Array.from(document.querySelectorAll(".builder-panel"));
  const addBlockButton = document.getElementById("add-block");
  const exportButton = document.getElementById("export-json");
  const importInput = document.getElementById("import-json");
  const zoomResetButton = document.getElementById("zoom-reset");
  const canvas = document.getElementById("workflow-canvas");
  const viewport = document.getElementById("workflow-viewport");
  const previewHost = document.getElementById("block-preview");
  const treeHost = document.getElementById("block-tree");
  const editorBody = document.getElementById("editor-body");

  const state = {
    blocks: {},
    rootIds: [],
    selectedId: null,
    mode: "workflow",
    zoom: { active: false, scale: 1.6 }
  };

  const blockSize = { width: 160, height: 64 };

  const createId = () => `block-${Math.random().toString(36).slice(2, 9)}`;

  const createBlock = ({ name, x, y, parentId } = {}) => {
    const id = createId();
    const block = {
      id,
      name: name || t("workflow.blockDefaultName", "Bloc"),
      x: Number.isFinite(x) ? x : 80 + state.rootIds.length * 20,
      y: Number.isFinite(y) ? y : 80 + state.rootIds.length * 20,
      items: [],
      steps: [],
      children: [],
      parentId: parentId || null
    };
    state.blocks[id] = block;
    if (parentId) {
      const parent = state.blocks[parentId];
      if (parent && !parent.children.includes(id)) {
        parent.children.push(id);
      }
    } else {
      state.rootIds.push(id);
    }
    return block;
  };

  const ensureSelection = () => {
    if (state.selectedId && state.blocks[state.selectedId]) return;
    state.selectedId = state.rootIds[0] || null;
  };

  const setMode = (mode) => {
    state.mode = mode;
    tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.mode === mode);
    });
    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.mode === mode);
    });
    render();
  };

  const selectBlock = (id) => {
    if (!id || !state.blocks[id]) return;
    state.selectedId = id;
    render();
  };

  const renderCanvas = () => {
    canvas.innerHTML = "";
    Object.values(state.blocks).forEach((block) => {
      const node = document.createElement("div");
      node.className = "workflow-block";
      if (block.id === state.selectedId) node.classList.add("selected");
      node.style.left = `${block.x}px`;
      node.style.top = `${block.y}px`;
      node.textContent = block.name;
      node.dataset.id = block.id;

      node.addEventListener("click", (event) => {
        event.stopPropagation();
        selectBlock(block.id);
      });

      node.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        toggleZoom(block);
      });

      node.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        const startX = event.clientX;
        const startY = event.clientY;
        const originX = block.x;
        const originY = block.y;
        node.setPointerCapture(event.pointerId);
        node.style.cursor = "grabbing";

        const handleMove = (moveEvent) => {
          const dx = (moveEvent.clientX - startX) / (state.zoom.active ? state.zoom.scale : 1);
          const dy = (moveEvent.clientY - startY) / (state.zoom.active ? state.zoom.scale : 1);
          block.x = Math.max(0, originX + dx);
          block.y = Math.max(0, originY + dy);
          node.style.left = `${block.x}px`;
          node.style.top = `${block.y}px`;
        };

        const handleUp = () => {
          node.releasePointerCapture(event.pointerId);
          node.style.cursor = "grab";
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
      });

      canvas.appendChild(node);
    });
  };

  const renderPreview = () => {
    previewHost.innerHTML = "";
    const block = state.blocks[state.selectedId];
    if (!block) {
      previewHost.textContent = t("preview.empty", "Selectionnez un block.");
      return;
    }

    const title = document.createElement("div");
    title.className = "preview-card";
    title.innerHTML = `<strong>${block.name}</strong>`;
    previewHost.appendChild(title);

    if (block.items.length) {
      block.items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "preview-card";
        if (item.type === "text") {
          card.textContent = item.value || "";
        } else if (item.type === "image") {
          const img = document.createElement("img");
          img.src = item.value || "";
          img.alt = "";
          card.appendChild(img);
        }
        previewHost.appendChild(card);
      });
    }

    if (block.steps.length) {
      block.steps.forEach((step, index) => {
        const card = document.createElement("div");
        card.className = "preview-card";
        const heading = document.createElement("strong");
        heading.textContent =
          step.title || t("editor.stepTitle", "Etape {index}", { index: index + 1 });
        card.appendChild(heading);
        (step.items || []).forEach((item) => {
          if (item.type === "text") {
            const p = document.createElement("p");
            p.textContent = item.value || "";
            card.appendChild(p);
          } else if (item.type === "image") {
            const img = document.createElement("img");
            img.src = item.value || "";
            img.alt = "";
            card.appendChild(img);
          }
        });
        previewHost.appendChild(card);
      });
    }

    if (block.children.length) {
      const childCard = document.createElement("div");
      childCard.className = "preview-card";
      const label = document.createElement("div");
      label.className = "badge";
      label.textContent = t("preview.subBlocks", "Sous-blocks");
      childCard.appendChild(label);
      block.children.forEach((childId) => {
        const child = state.blocks[childId];
        if (!child) return;
        const row = document.createElement("div");
        row.textContent = `• ${child.name}`;
        childCard.appendChild(row);
      });
      previewHost.appendChild(childCard);
    }
  };

  const renderTree = () => {
    treeHost.innerHTML = "";
    const renderNode = (id, depth) => {
      const block = state.blocks[id];
      if (!block) return;
      const item = document.createElement("div");
      item.className = "tree-item";
      if (id === state.selectedId) item.classList.add("selected");
      item.style.paddingLeft = `${8 + depth * 14}px`;
      item.textContent = block.name;
      item.addEventListener("click", () => selectBlock(id));
      treeHost.appendChild(item);
      block.children.forEach((childId) => renderNode(childId, depth + 1));
    };
    state.rootIds.forEach((id) => renderNode(id, 0));
  };

  const renderEditor = () => {
    editorBody.innerHTML = "";
    const block = state.blocks[state.selectedId];
    if (!block) {
      editorBody.textContent = t("editor.selectHint", "Selectionnez un block.");
      return;
    }

    const infoSection = document.createElement("div");
    infoSection.className = "editor-section";

    const nameRow = document.createElement("div");
    nameRow.className = "editor-row";
    const nameLabel = document.createElement("label");
    nameLabel.textContent = t("editor.nameLabel", "Nom");
    const nameInput = document.createElement("input");
    nameInput.value = block.name;
    nameInput.addEventListener("input", () => {
      block.name = nameInput.value;
      render();
    });
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(nameInput);

    const actionRow = document.createElement("div");
    actionRow.className = "editor-item-actions";
    const addChildButton = document.createElement("button");
    addChildButton.className = "ghost";
    addChildButton.textContent = t("editor.addChild", "Ajouter sous-block");
    addChildButton.addEventListener("click", () => {
      const child = createBlock({ parentId: block.id });
      child.name = `${t("workflow.blockDefaultName", "Bloc")} ${Object.keys(state.blocks).length}`;
      render();
    });
    actionRow.appendChild(addChildButton);

    infoSection.appendChild(nameRow);
    infoSection.appendChild(actionRow);
    editorBody.appendChild(infoSection);

    const itemsSection = document.createElement("div");
    itemsSection.className = "editor-section";
    const itemsTitle = document.createElement("div");
    itemsTitle.className = "badge";
    itemsTitle.textContent = t("editor.itemsTitle", "Contenu");
    itemsSection.appendChild(itemsTitle);

    const itemsHost = document.createElement("div");
    itemsHost.className = "editor-items";
    block.items.forEach((item, index) => {
      itemsHost.appendChild(renderItemEditor(item, () => {
        block.items.splice(index, 1);
        render();
      }));
    });

    const addTextButton = document.createElement("button");
    addTextButton.className = "ghost";
    addTextButton.textContent = t("editor.addText", "Ajouter texte");
    addTextButton.addEventListener("click", () => {
      block.items.push({ type: "text", value: "" });
      render();
    });
    const addImageButton = document.createElement("button");
    addImageButton.className = "ghost";
    addImageButton.textContent = t("editor.addImage", "Ajouter image");
    addImageButton.addEventListener("click", () => {
      block.items.push({ type: "image", value: "" });
      render();
    });

    itemsSection.appendChild(itemsHost);
    itemsSection.appendChild(addTextButton);
    itemsSection.appendChild(addImageButton);
    editorBody.appendChild(itemsSection);

    const stepsSection = document.createElement("div");
    stepsSection.className = "editor-section";
    const stepsTitle = document.createElement("div");
    stepsTitle.className = "badge";
    stepsTitle.textContent = t("editor.stepsTitle", "Etapes");
    stepsSection.appendChild(stepsTitle);

    block.steps.forEach((step, stepIndex) => {
      const stepCard = document.createElement("div");
      stepCard.className = "editor-item";
      const stepTitleRow = document.createElement("div");
      stepTitleRow.className = "editor-row";
      const stepLabel = document.createElement("label");
      stepLabel.textContent = t("editor.stepTitleLabel", "Titre de l'etape");
      const stepInput = document.createElement("input");
      stepInput.value =
        step.title || t("editor.stepTitle", "Etape {index}", { index: stepIndex + 1 });
      stepInput.addEventListener("input", () => {
        step.title = stepInput.value;
        render();
      });
      stepTitleRow.appendChild(stepLabel);
      stepTitleRow.appendChild(stepInput);
      stepCard.appendChild(stepTitleRow);

      const stepItemsHost = document.createElement("div");
      stepItemsHost.className = "editor-items";
      (step.items || []).forEach((item, itemIndex) => {
        stepItemsHost.appendChild(renderItemEditor(item, () => {
          step.items.splice(itemIndex, 1);
          render();
        }));
      });

      const stepActions = document.createElement("div");
      stepActions.className = "editor-item-actions";
      const addStepText = document.createElement("button");
      addStepText.className = "ghost";
      addStepText.textContent = t("editor.addText", "Ajouter texte");
      addStepText.addEventListener("click", () => {
        step.items = step.items || [];
        step.items.push({ type: "text", value: "" });
        render();
      });
      const addStepImage = document.createElement("button");
      addStepImage.className = "ghost";
      addStepImage.textContent = t("editor.addImage", "Ajouter image");
      addStepImage.addEventListener("click", () => {
        step.items = step.items || [];
        step.items.push({ type: "image", value: "" });
        render();
      });
      const removeStepButton = document.createElement("button");
      removeStepButton.className = "ghost";
      removeStepButton.textContent = t("common.delete", "Supprimer");
      removeStepButton.addEventListener("click", () => {
        block.steps.splice(stepIndex, 1);
        render();
      });
      stepActions.appendChild(addStepText);
      stepActions.appendChild(addStepImage);
      stepActions.appendChild(removeStepButton);

      stepCard.appendChild(stepItemsHost);
      stepCard.appendChild(stepActions);
      stepsSection.appendChild(stepCard);
    });

    const addStepButton = document.createElement("button");
    addStepButton.className = "ghost";
    addStepButton.textContent = t("editor.addStep", "Ajouter etape");
    addStepButton.addEventListener("click", () => {
      block.steps.push({ title: "", items: [] });
      render();
    });

    stepsSection.appendChild(addStepButton);
    editorBody.appendChild(stepsSection);
  };

  const renderItemEditor = (item, onRemove) => {
    const card = document.createElement("div");
    card.className = "editor-item";
    const row = document.createElement("div");
    row.className = "editor-row";
    const label = document.createElement("label");
    label.textContent =
      item.type === "image"
        ? t("editor.itemImageLabel", "URL image")
        : t("editor.itemTextLabel", "Texte");
    const input = document.createElement(item.type === "text" ? "textarea" : "input");
    input.value = item.value || "";
    input.addEventListener("input", () => {
      item.value = input.value;
    });
    row.appendChild(label);
    row.appendChild(input);
    card.appendChild(row);

    const actions = document.createElement("div");
    actions.className = "editor-item-actions";
    const removeButton = document.createElement("button");
    removeButton.className = "ghost";
    removeButton.textContent = t("common.delete", "Supprimer");
    removeButton.addEventListener("click", onRemove);
    actions.appendChild(removeButton);
    card.appendChild(actions);
    return card;
  };

  const toggleZoom = (block) => {
    if (!viewport || !canvas) return;
    state.zoom.active = !state.zoom.active;
    if (!state.zoom.active) {
      canvas.style.transform = "scale(1)";
      canvas.classList.remove("zoomed");
      return;
    }
    const scale = state.zoom.scale;
    const centerX = block.x + blockSize.width / 2;
    const centerY = block.y + blockSize.height / 2;
    canvas.classList.add("zoomed");
    canvas.style.transformOrigin = `${centerX}px ${centerY}px`;
    canvas.style.transform = `scale(${scale})`;
    const targetLeft = centerX * scale - viewport.clientWidth / 2;
    const targetTop = centerY * scale - viewport.clientHeight / 2;
    viewport.scrollLeft = Math.max(0, targetLeft);
    viewport.scrollTop = Math.max(0, targetTop);
  };

  const resetZoom = () => {
    state.zoom.active = false;
    canvas.style.transform = "scale(1)";
    canvas.classList.remove("zoomed");
  };

  const exportJson = () => {
    const payload = {
      blocks: state.blocks,
      rootIds: state.rootIds
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "workflow.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importJson = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== "object") return;
        state.blocks = data.blocks || {};
        state.rootIds = data.rootIds || [];
        ensureSelection();
        render();
      } catch (error) {
        alert(t("common.invalidJson", "JSON invalide."));
      }
    };
    reader.readAsText(file);
  };

  const render = () => {
    ensureSelection();
    renderCanvas();
    renderPreview();
    renderTree();
    renderEditor();
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
  });

  addBlockButton?.addEventListener("click", () => {
    const block = createBlock({});
    block.name = `${t("workflow.blockDefaultName", "Bloc")} ${Object.keys(state.blocks).length}`;
    selectBlock(block.id);
  });

  exportButton?.addEventListener("click", exportJson);

  importInput?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    importJson(file);
    event.target.value = "";
  });

  zoomResetButton?.addEventListener("click", resetZoom);

  canvas?.addEventListener("click", () => {
    state.selectedId = null;
    render();
  });

  createBlock({ name: `${t("workflow.blockDefaultName", "Bloc")} 1` });
  ensureSelection();
  render();
})();
