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

  toolbar.appendChild(dragHandle);
  toolbar.appendChild(boldButton);
  toolbar.appendChild(italicButton);
  toolbar.appendChild(highlightButton);
  toolbar.appendChild(sizeSelect);
  toolbar.appendChild(removeButton);
  wrapper.appendChild(toolbar);
  wrapper.appendChild(editor);
  itemsHost.appendChild(wrapper);
}

const t = window.workflowBuilderT || ((key, fallback) => fallback || key);

function ensureImageItem(item) {
  if (!item.src) {
    item.src = "";
  }
  if (!item.widthPercent) {
    item.widthPercent = 80;
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
    const shapeRef = tutorialShapes.find((s) => s.id === shape.id);
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
  const addRectButton = document.createElement("button");
  addRectButton.type = "button";
  addRectButton.textContent = t("shape.rect", "Rectangle");
  const addCircleButton = document.createElement("button");
  addCircleButton.type = "button";
  addCircleButton.textContent = t("shape.circle", "Cercle");
  const addPointerButton = document.createElement("button");
  addPointerButton.type = "button";
  addPointerButton.textContent = t("overlay.pointer", "Pointe");
  const addArrowButton = document.createElement("button");
  addArrowButton.type = "button";
  addArrowButton.textContent = t("overlay.arrow", "Fleche");
  const addTextButton = document.createElement("button");
  addTextButton.type = "button";
  addTextButton.textContent = t("overlay.text", "Texte");
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = "#ff3b30";
  const widthSelect = document.createElement("select");
  [60, 70, 80, 90, 100].forEach((size) => {
    const option = document.createElement("option");
    option.value = String(size);
    option.textContent = `${size}%`;
    widthSelect.appendChild(option);
  });
  widthSelect.value = String(item.widthPercent || 80);
  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.placeholder = t("overlay.text", "Texte");
  textInput.className = "compact-input overlay-text-input hidden";

  const fileLabel = document.createElement("label");
  fileLabel.className = "shape-btn";
  fileLabel.textContent = t("image.choose", "Choisir image");
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  fileLabel.appendChild(fileInput);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = t("common.delete", "Supprimer");
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
  toolbar.appendChild(widthSelect);
  toolbar.appendChild(textInput);
  toolbar.appendChild(fileLabel);
  toolbar.appendChild(removeButton);

  const imageBox = document.createElement("div");
  imageBox.className = "tutorial-image-box";
  const imageFrame = document.createElement("div");
  imageFrame.className = "tutorial-image-frame";
  imageFrame.style.width = `${item.widthPercent || 80}%`;
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
  placeholder.textContent = t(
    "image.dropHint",
    "Glissez une capture ici ou collez avec Ctrl+V."
  );

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
  imageBox.appendChild(imageFrame);
  imageBox.appendChild(overlayLayer);
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
      overlay.text = t("overlay.text", "Texte");
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
