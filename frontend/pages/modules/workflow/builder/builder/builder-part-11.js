  canvas.querySelectorAll(".shape").forEach((el) => el.remove());
  shapes.forEach((shape) => {
    const node = document.createElement("div");
    node.className = `shape ${shape.type}`;
    node.dataset.id = shape.id;
    node.style.left = `${shape.x}px`;
    node.style.top = `${shape.y}px`;
    node.style.width = `${shape.width}px`;
    node.style.height = `${shape.height}px`;
    node.style.fontSize = `${shape.fontSize}px`;
    node.style.fontFamily = shape.fontFamily;
    node.style.color = shape.textColor;
    node.style.opacity = shape.opacity;
    if (shape.type === "logo" && shape.imageData) {
      const ratio =
        shape.imageRatio || parseSvgRatioFromDataUrl(shape.imageData) || 1;
      shape.imageRatio = ratio;
      if (!shape.width || !shape.height) {
        shape.height = 70;
        shape.width = Math.round(shape.height * ratio);
      }
      node.style.width = `${shape.width}px`;
      node.style.height = `${shape.height + (shape.text ? 22 : 0)}px`;
      node.style.background = "transparent";
      node.style.display = "flex";
      node.style.flexDirection = "column";
      node.style.alignItems = "center";
      node.style.justifyContent = "flex-start";

      const imageBox = document.createElement("div");
      imageBox.className = "shape-image";
      imageBox.style.width = `${shape.width}px`;
      imageBox.style.height = `${shape.height}px`;
      imageBox.style.backgroundImage = `url(${shape.imageData})`;
      imageBox.style.backgroundSize = "contain";
      imageBox.style.backgroundRepeat = "no-repeat";
      imageBox.style.backgroundPosition = "center";
      imageBox.style.backgroundColor = "#ffffff";
      node.appendChild(imageBox);

      const textSpan = document.createElement("div");
      textSpan.className = "shape-text";
      const textInner = document.createElement("div");
      textInner.className = "shape-text-inner";
      textInner.textContent = shape.text;
      textSpan.style.color = "#1f2933";
      textSpan.style.marginTop = "6px";
      const dx = shape.textDx || 0;
      const dy = shape.textDy || 0;
      if (shape.type === "diamond") {
        textSpan.style.transform = "rotate(-45deg)";
        textInner.style.transform = `translate(${dx}px, ${dy}px)`;
      } else {
        textSpan.style.transform = `translate(${dx}px, ${dy}px)`;
      }
      if (!shape.text) {
        textSpan.style.display = "none";
      }
      textSpan.appendChild(textInner);
      node.appendChild(textSpan);
    } else {
      node.style.background = shape.bgColor;
      if (shape.type === "circle" || shape.type === "ellipse") {
        node.style.display = "flex";
      }
      const textSpan = document.createElement("div");
      textSpan.className = "shape-text";
      const textInner = document.createElement("div");
      textInner.className = "shape-text-inner";
      textInner.textContent = shape.text;
      const dx = shape.textDx || 0;
      const dy = shape.textDy || 0;
      if (shape.type === "diamond") {
        textSpan.style.transform = "rotate(-45deg)";
        textInner.style.transform = `translate(${dx}px, ${dy}px)`;
      } else {
        textSpan.style.transform = `translate(${dx}px, ${dy}px)`;
      }
      textSpan.appendChild(textInner);
      node.appendChild(textSpan);
    }
    node.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      handleWorkflowEditRequest(shape.id);
    });

    if (shape.id === selectedShapeId) {
      node.classList.add("selected");
      ["tl", "tr", "bl", "br"].forEach((pos) => {
        const handle = document.createElement("div");
        handle.className = `resize-handle ${pos}`;
        handle.dataset.resize = pos;
        node.appendChild(handle);
      });
      const dx = shape.textDx || 0;
      const dy = shape.textDy || 0;
      if (shape.type !== "logo") {
        const textHandle = document.createElement("div");
        textHandle.className = "text-handle";
        textHandle.dataset.id = shape.id;
        textHandle.style.left = "50%";
        textHandle.style.top = "50%";
        if (shape.type === "diamond") {
          textHandle.style.transform = `translate(-50%, -50%) rotate(-45deg) translate(${dx}px, ${dy}px)`;
        } else {
          textHandle.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
        }
        node.appendChild(textHandle);
      }
    }

    const showAnchors =
      shape.id === selectedShapeId || pendingAnchor || endpointDrag;
    if (showAnchors) {
      renderAnchors(node, shape);
    }

    canvas.appendChild(node);
  });
  updateConnections();
  applyGroupFilter();
}

function renderAnchors(node, shape) {
  const positions = [
    { id: "tl", left: "0%", top: "0%" },
    { id: "tr", left: "100%", top: "0%" },
    { id: "bl", left: "0%", top: "100%" },
    { id: "br", left: "100%", top: "100%" },
    { id: "top", left: "50%", top: "0%" },
    { id: "bottom", left: "50%", top: "100%" },
    { id: "left", left: "0%", top: "50%" },
    { id: "right", left: "100%", top: "50%" }
  ];

  const shouldHideCornerAnchors = shape.id === selectedShapeId;
  positions.forEach((position) => {
    if (
      shouldHideCornerAnchors &&
      ["tl", "tr", "bl", "br"].includes(position.id)
    ) {
      return;
    }
    const anchor = document.createElement("div");
    anchor.className = "anchor";
    anchor.dataset.anchor = position.id;
    anchor.style.left = position.left;
    anchor.style.top = position.top;
    if (
      pendingAnchor &&
      pendingAnchor.shapeId === shape.id &&
      pendingAnchor.anchor === position.id
    ) {
      anchor.classList.add("active");
    }
    anchor.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      if (selectedConnectionId) {
        selectedConnectionId = null;
        showProperties("none");
      }
      handleAnchorSelection(shape.id, position.id);
    });
    node.appendChild(anchor);
  });
}

function handleAnchorSelection(shapeId, anchorId) {
  if (!pendingAnchor) {
    pendingAnchor = { shapeId, anchor: anchorId };
    renderShapes();
    return;
  }
  if (pendingAnchor.shapeId === shapeId) {
    pendingAnchor = { shapeId, anchor: anchorId };
    renderShapes();
    return;
  }
  const connection = {
    id: generateId("conn"),
    from: pendingAnchor.shapeId,
    to: shapeId,
    startAnchor: pendingAnchor.anchor,
    endAnchor: anchorId,
    points: [],
    auto: true,
    lineColor: "#0e9cef",
    lineStyle: "solid",
    lineArrow: true,
    label: "",
    labelDx: 0,
    labelDy: 0,
    labelBgColor: "#ffffff",
    labelOpacity: 1,
    labelTextColor: "#1f2933"
  };
  connections.push(connection);
  pendingAnchor = null;
  selectConnection(connection.id);
}

function selectConnection(id) {
  selectedConnectionId = id;
  selectedShapeId = null;
  const connection = connections.find((conn) => conn.id === id);
  // #region agent log
  debugIngest({location:'tutorials/builder.js:selectConnection',message:'selectConnection',data:{id,hasConnection:Boolean(connection)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1'});
  // #endregion
  if (!connection) {
    showProperties("none");
    updateBlockStorageIndicatorForConnection(null);
    updateEditButtonState();
    return;
  }
  propLineStyle.value = connection.lineStyle || "solid";
  propLineArrow.value = String(connection.lineArrow !== false);
  propLineColor.value = getConnectionLineColor(connection);
  propLineText.value = connection.label || "";
  propLineBgColor.value = connection.labelBgColor || "#ffffff";
  propLineTextOpacity.value = Math.round((connection.labelOpacity ?? 1) * 100);
  propLineTextColor.value = connection.labelTextColor || "#1f2933";
  propLineTextX.value = connection.labelDx || 0;
  propLineTextY.value = connection.labelDy || 0;
  showProperties("connection");
  updateBlockStorageIndicatorForConnection(connection);
  if (connection.tutorial) {
    renderBlockPreviewForTargets(
      connection.tutorial,
      connection.label || connection.id
    );
  } else {
    clearBlockPreview();
  }
  updateEditButtonState();
  // #region agent log
  debugIngest({location:'tutorials/builder.js:selectConnection',message:'connectionPropsShown',data:{id,connectionHidden:connectionProps.classList.contains("hidden"),shapeHidden:shapeProps.classList.contains("hidden")},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H8'});
  // #endregion
  renderShapes();
  updateConnections();
}

function selectShape(id) {
  selectedShapeId = id;
  selectedConnectionId = null;
  const shape = shapes.find((s) => s.id === id);
  // #region agent log
  debugIngest({location:'tutorials/builder.js:selectShape',message:'selectShape',data:{id,hasShape:Boolean(shape),connectionPropsHidden:connectionProps.classList.contains("hidden")},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H7'});
  // #endregion
  if (!shape) {
    clearSelection();
    return;
  }
  propText.value = shape.text;
  propFontSize.value = shape.fontSize;
  propFontFamily.value = shape.fontFamily;
  propTextColor.value = shape.textColor;
  propBgColor.value = shape.bgColor;
  propOpacity.value = Math.round(shape.opacity * 100);
  propGroup.value = shape.group || "";
  showProperties("shape");
  updateBlockStorageIndicator(shape);
  updateEditButtonState();
  if (shape.tutorial) {
    renderBlockPreviewForTargets(shape.tutorial, shape.text || shape.id);
  } else {
    clearBlockPreview();
  }
  // #region agent log
  debugIngest({location:'tutorials/builder.js:selectShape',message:'shapePropsShown',data:{id,connectionHidden:connectionProps.classList.contains("hidden"),shapeHidden:shapeProps.classList.contains("hidden")},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H7'});
  // #endregion
  renderShapes();
}

function clearSelection() {
  selectedShapeId = null;
  selectedConnectionId = null;
  pendingAnchor = null;
  propText.value = "";
  updateBlockStorageIndicator(null);
  clearBlockPreview();
  showProperties("none");
  updateEditButtonState();
  renderShapes();
}

function updateSelectedShape(updates) {
  const shape = shapes.find((s) => s.id === selectedShapeId);
  if (!shape) return;
  Object.assign(shape, updates);
  renderShapes();
}

function updateConnections() {
  connectionsSvg
    .querySelectorAll(".connection-path, .connection-label, .connection-hit")
    .forEach((line) => line.remove());
  canvas.querySelectorAll(".conn-handle").forEach((handle) => handle.remove());
  const { width, height } = canvas.getBoundingClientRect();
  connectionsSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  // #region agent log
  const markerEl = connectionsSvg.querySelector("marker#arrow");
  const svgStyle = getComputedStyle(connectionsSvg);
  debugIngest({location:'tutorials/builder.js:updateConnections',message:'updateConnections',data:{connectionsCount:connections.length,selectedConnectionId,markerExists:Boolean(markerEl),markerAttrs:markerEl?{markerWidth:markerEl.getAttribute("markerWidth"),markerHeight:markerEl.getAttribute("markerHeight"),refX:markerEl.getAttribute("refX"),refY:markerEl.getAttribute("refY"),markerUnits:markerEl.getAttribute("markerUnits")}:null,svgZ:svgStyle.zIndex,svgOverflow:svgStyle.overflow,svgPointerEvents:svgStyle.pointerEvents},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H2'});
  // #endregion
  connections.forEach((connection) => {
    const from = shapes.find((s) => s.id === connection.from);
    const to = shapes.find((s) => s.id === connection.to);
    if (!from || !to) return;
    connection.lineStyle = connection.lineStyle || "solid";
    if (connection.lineArrow === undefined) {
      connection.lineArrow = true;
    }
    if (!connection.label) {
      connection.label = "";
    }
    connection.lineColor = getConnectionLineColor(connection);
    if (!connection.labelBgColor) {
      connection.labelBgColor = "#ffffff";
    }
    if (!connection.labelTextColor) {
      connection.labelTextColor = "#1f2933";
    }
    if (connection.labelOpacity === undefined) {
      connection.labelOpacity = 1;
    }
    if (connection.labelDx === undefined) {
      connection.labelDx = 0;
    }
    if (connection.labelDy === undefined) {
      connection.labelDy = 0;
    }
    const start = connection.startAnchor
      ? getAnchorPointFromAnchor(from, connection.startAnchor)
      : getAnchorPoint(from, to);
    const end = connection.endAnchor
      ? getAnchorPointFromAnchor(to, connection.endAnchor)
      : getAnchorPoint(to, from);
    const isEditingConnection =
      (segmentDrag && segmentDrag.connId === connection.id) ||
      (cornerDrag && cornerDrag.connId === connection.id) ||
      (lineDrag && lineDrag.connId === connection.id) ||
      (endpointDrag && endpointDrag.connId === connection.id);
    const points = isEditingConnection && Array.isArray(connection.points) && connection.points.length
      ? connection.points
      : normalizeConnectionPoints(connection, start, end, {
          preview: isShapeTransforming
        });
    const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
