      overlay.textBgColor = overlayTextBgInput.value;
      renderTutorialEditor();
    });
  }

  widthSelect.addEventListener("change", () => {
    item.widthPercent = Number(widthSelect.value);
    imageFrame.style.width = `${item.widthPercent}%`;
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setStepImage(reader.result);
    };
    reader.readAsDataURL(file);
  });

  imageBox.addEventListener("click", () => {
    activeImageStep = { shapeId: shape.id, stepPath: [...stepPath], itemIndex };
  });

  imageBox.addEventListener("dragover", (event) => {
    event.preventDefault();
    imageBox.classList.add("dragging");
  });

  imageBox.addEventListener("dragleave", () => {
    imageBox.classList.remove("dragging");
  });

  imageBox.addEventListener("drop", (event) => {
    event.preventDefault();
    imageBox.classList.remove("dragging");
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setStepImage(reader.result);
    };
    reader.readAsDataURL(file);
  });

  function getArrowBounds(overlay, minWidth, minHeight) {
    const minX = Math.min(overlay.startX, overlay.endX);
    const minY = Math.min(overlay.startY, overlay.endY);
    const maxX = Math.max(overlay.startX, overlay.endX);
    const maxY = Math.max(overlay.startY, overlay.endY);
    let x = minX;
    let y = minY;
    let width = Math.max(0.1, maxX - minX);
    let height = Math.max(0.1, maxY - minY);

    if (width < minWidth) {
      const pad = (minWidth - width) / 2;
      x -= pad;
      width = minWidth;
    }
    if (height < minHeight) {
      const pad = (minHeight - height) / 2;
      y -= pad;
      height = minHeight;
    }

    if (width > 100) {
      x = 0;
      width = 100;
    } else {
      if (x < 0) x = 0;
      if (x + width > 100) x = 100 - width;
    }
    if (height > 100) {
      y = 0;
      height = 100;
    } else {
      if (y < 0) y = 0;
      if (y + height > 100) y = 100 - height;
    }

    return { x, y, width, height };
  }

  function updateArrowOverlay(overlay, overlayEl, imageBounds) {
    const safeBounds = imageBounds || { width: 0, height: 0 };
    const imageWidth = safeBounds.width || 100;
    const imageHeight = safeBounds.height || 100;
    overlayEl.style.left = "0%";
    overlayEl.style.top = "0%";
    overlayEl.style.width = "100%";
    overlayEl.style.height = "100%";
    overlayEl.style.borderColor = overlay.color || "#ff3b30";
    overlayEl.style.color = overlay.color || "#ff3b30";
    overlayEl.innerHTML = "";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${imageWidth} ${imageHeight}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.overflow = "visible";
    svg.style.position = "absolute";
    svg.style.inset = "0";
    svg.style.pointerEvents = "none";
    svg.style.zIndex = "5";

    const startX = (overlay.startX / 100) * imageWidth;
    const startY = (overlay.startY / 100) * imageHeight;
    const endX = (overlay.endX / 100) * imageWidth;
    const endY = (overlay.endY / 100) * imageHeight;
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.hypot(dx, dy);
    let angle = 0;
    if (length > 0.01) {
      angle = Math.atan2(dy, dx);
    }

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", `${startX}`);
    line.setAttribute("y1", `${startY}`);
    line.setAttribute("x2", `${endX}`);
    line.setAttribute("y2", `${endY}`);
    line.setAttribute("stroke", overlay.color || "#ff3b30");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(line);
    overlayEl.appendChild(svg);

    if (length > 0.01) {
      const headLength = Math.min(6, Math.max(3.5, length * 0.05));
      const headWidth = Math.max(3, headLength * 0.8);
      const arrowHead = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      const halfWidth = headWidth / 2;
      arrowHead.setAttribute(
        "points",
        `0,0 ${-headLength},${-halfWidth} ${-headLength},${halfWidth}`
      );
      arrowHead.setAttribute("fill", overlay.color || "#ff3b30");
      arrowHead.setAttribute(
        "transform",
        `translate(${endX} ${endY}) rotate(${(angle * 180) / Math.PI})`
      );
      svg.appendChild(arrowHead);
    }

    const startHandle = document.createElement("div");
    startHandle.className = "overlay-arrow-handle start";
    startHandle.dataset.point = "start";
    startHandle.style.left = `${overlay.startX}%`;
    startHandle.style.top = `${overlay.startY}%`;
    startHandle.style.borderColor = overlay.color || "#ff3b30";
    overlayEl.appendChild(startHandle);

    const endHandle = document.createElement("div");
    endHandle.className = "overlay-arrow-handle end";
    endHandle.dataset.point = "end";
    endHandle.style.left = `${overlay.endX}%`;
    endHandle.style.top = `${overlay.endY}%`;
    endHandle.style.borderColor = overlay.color || "#ff3b30";
    overlayEl.appendChild(endHandle);
  }

  item.overlays.forEach((overlay) => {
    const overlayEl = document.createElement("div");
    overlayEl.className = `overlay-item ${overlay.type}`;
    overlayEl.style.color = overlay.color || "#ff3b30";
    if (
      selectedOverlay &&
      selectedOverlay.shapeId === shape.id &&
      isSamePath(selectedOverlay.stepPath, stepPath) &&
      selectedOverlay.itemIndex === itemIndex &&
      selectedOverlay.overlayId === overlay.id
    ) {
      overlayEl.classList.add("selected");
    }
    if (overlay.type === "arrow") {
      updateArrowOverlay(overlay, overlayEl, imageBox.getBoundingClientRect());
    } else {
      overlayEl.style.left = `${overlay.x}%`;
      overlayEl.style.top = `${overlay.y}%`;
      overlayEl.style.width = `${overlay.width}%`;
      overlayEl.style.height = `${overlay.height}%`;
      overlayEl.style.borderColor = overlay.color || "#ff3b30";
      if (overlay.type === "pointer") {
        overlayEl.style.backgroundColor = "transparent";
      } else if (overlay.type === "text") {
        const textColor = overlay.textColor || overlay.color || "#ff3b30";
        overlayEl.style.color = textColor;
        overlayEl.style.borderColor = textColor;
        overlayEl.style.backgroundColor =
          overlay.textBgColor || colorWithAlpha(textColor, 0.08);
        overlayEl.style.fontSize = `${overlay.textSize || 12}px`;
        overlayEl.textContent = overlay.text || "";
      } else {
        overlayEl.style.backgroundColor = colorWithAlpha(overlay.color || "#ff3b30", 0.08);
      }
    }

    overlayEl.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      selectedOverlay = {
        shapeId: shape.id,
        stepPath: [...stepPath],
        itemIndex,
        overlayId: overlay.id
      };
      document.querySelectorAll(".overlay-item.selected")
        .forEach((el) => el.classList.remove("selected"));
      overlayEl.classList.add("selected");
      refreshTextInput();
      refreshOverlayTextProps();
      const bounds = imageBox.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = overlay.x;
      const startTop = overlay.y;
      const startArrow = {
        startX: overlay.startX,
        startY: overlay.startY,
        endX: overlay.endX,
        endY: overlay.endY
      };
      const arrowHandle = event.target.closest(".overlay-arrow-handle");
      const handleMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (overlay.type === "arrow") {
          const deltaX = (dx / bounds.width) * 100;
          const deltaY = (dy / bounds.height) * 100;
          if (arrowHandle) {
            if (arrowHandle.dataset.point === "start") {
              overlay.startX = Math.max(0, Math.min(100, startArrow.startX + deltaX));
              overlay.startY = Math.max(0, Math.min(100, startArrow.startY + deltaY));
            } else {
              overlay.endX = Math.max(0, Math.min(100, startArrow.endX + deltaX));
              overlay.endY = Math.max(0, Math.min(100, startArrow.endY + deltaY));
            }
          } else {
            overlay.startX = Math.max(0, Math.min(100, startArrow.startX + deltaX));
            overlay.startY = Math.max(0, Math.min(100, startArrow.startY + deltaY));
            overlay.endX = Math.max(0, Math.min(100, startArrow.endX + deltaX));
            overlay.endY = Math.max(0, Math.min(100, startArrow.endY + deltaY));
          }
          updateArrowOverlay(overlay, overlayEl);
          return;
        }
        const nextLeft =
          ((startLeft / 100) * bounds.width + dx) / bounds.width * 100;
        const nextTop =
          ((startTop / 100) * bounds.height + dy) / bounds.height * 100;
        overlay.x = Math.max(0, Math.min(100 - overlay.width, nextLeft));
        overlay.y = Math.max(0, Math.min(100 - overlay.height, nextTop));
        overlayEl.style.left = `${overlay.x}%`;
        overlayEl.style.top = `${overlay.y}%`;
      };
      const handleUp = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        overlayDrag = null;
      };
      overlayDrag = { overlay };
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    });

    if (overlay.type !== "arrow") {
      const resizeHandle = document.createElement("div");
      resizeHandle.className = "overlay-resize";
      resizeHandle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const bounds = imageBox.getBoundingClientRect();
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = overlay.width;
        const startHeight = overlay.height;
        selectedOverlay = {
          shapeId: shape.id,
          stepPath: [...stepPath],
          itemIndex,
          overlayId: overlay.id
        };
        document.querySelectorAll(".overlay-item.selected")
          .forEach((el) => el.classList.remove("selected"));
        overlayEl.classList.add("selected");
        const handleMove = (moveEvent) => {
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;
          const nextWidth =
            ((startWidth / 100) * bounds.width + dx) / bounds.width * 100;
          const nextHeight =
            ((startHeight / 100) * bounds.height + dy) / bounds.height * 100;
          overlay.width = Math.max(4, Math.min(100, nextWidth));
          overlay.height = Math.max(4, Math.min(100, nextHeight));
          overlayEl.style.width = `${overlay.width}%`;
          overlayEl.style.height = `${overlay.height}%`;
        };
        const handleUp = () => {
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
          overlayResize = null;
        };
        overlayResize = { overlay };
        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
      });
      overlayEl.appendChild(resizeHandle);
    }
    overlayLayer.appendChild(overlayEl);
  });

  wrapper.appendChild(toolbar);
  wrapper.appendChild(imageBox);
  itemsHost.appendChild(wrapper);
}

const t = window.workflowBuilderT || ((key, fallback) => fallback || key);

function createShape(type) {
  const id = generateId("shape");
  const isGroupBox = type === "group-box";
  const isLogo = type === "logo";
  const isMedicapp = type === "medicapp";
  const shapeType = isMedicapp ? "rect" : type;
  const shape = {
    id,
    type: shapeType,
    x: 80 + shapes.length * 20,
    y: 80 + shapes.length * 20,
    width: isGroupBox ? 260 : shapeType === "diamond" ? 120 : shapeType === "circle" ? 100 : 160,
    height: isGroupBox ? 160 : shapeType === "diamond" ? 120 : shapeType === "circle" ? 100 : 70,
    text: isGroupBox
      ? t("group.defaultLabel", "Groupe")
      : isMedicapp
      ? t("shape.medicappLabel", "Forme Medicapp")
      : t("shape.newLabel", "Nouvel element"),
    fontSize: 14,
    fontFamily: "Segoe UI",
    textColor: isGroupBox ? "#1f2933" : "#ffffff",
    bgColor: isGroupBox ? "rgba(14, 156, 239, 0.1)" : "#0e9cef",
    opacity: isGroupBox ? 0.35 : 1,
    group: "",
    imageData: isLogo ? "" : null,
    blockId: ""
  };
  shapes.push(shape);
  renderShapes();
  selectShape(id);
  refreshTutorialShapeOptions();
  return shape;
}

function renderShapes() {
