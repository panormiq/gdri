    const category = resolveTutorialShapeCategory();
    const file = tutorialShapeSvgInput?.files?.[0];
    if (!file) {
      alert(
        window.workflowBuilderT(
          "alert.selectSvgFile",
          "Selectionnez un fichier SVG."
        )
      );
      return;
    }
    if (file.type && file.type !== "image/svg+xml") {
      alert(window.workflowBuilderT("alert.svgOnly", "Format SVG uniquement."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const label =
        nameValue ||
        file.name.replace(/\.svg$/i, "") ||
        window.workflowBuilderT("shape.defaultLabel", "Forme");
      const ratio = parseSvgRatioFromDataUrl(reader.result);
      const entry = {
        id: generateId("tshape-lib"),
        type: "logo",
        label,
        category,
        imageData: reader.result,
        ratio: ratio || 1,
        standard: false
      };
      tutorialShapeLibrary.push(entry);
      saveShapeLibraryToStorage();
      refreshTutorialShapeOptions();
      resetTutorialShapeForm();
      toggleTutorialShapeForm(false);
      activateTutorialShapeFromLibrary(entry);
    };
    reader.readAsDataURL(file);
  });
}

if (tutorialTitleInput) {
  tutorialTitleInput.addEventListener("input", () => {
    const shape = getActiveTutorialShape();
    if (!shape) return;
    const tutorial = ensureShapeTutorial(shape);
    tutorial.title = tutorialTitleInput.value;
    renderTutorialPreview(shape, tutorial.title);
  });
}

if (tutorialIntroInput) {
  tutorialIntroInput.addEventListener("input", () => {
    const shape = getActiveTutorialShape();
    if (!shape) return;
    const tutorial = ensureShapeTutorial(shape);
    tutorial.intro = tutorialIntroInput.value;
  });
}

if (blockWorkflowSelect) {
  blockWorkflowSelect.addEventListener("change", () => {
    const shape = getActiveTutorialShape();
    if (!shape) return;
    const selectedPath = blockWorkflowSelect.value;
    if (!selectedPath) {
      shape.workflow = null;
      return;
    }
    const entry = blockWorkflowEntries.find((item) => item.path === selectedPath);
    shape.workflow = {
      path: selectedPath,
      name: entry?.name || ""
    };
  });
}

if (exportBlockButton) {
  exportBlockButton.addEventListener("click", () => {
    const shape = getActiveTutorialShape();
    if (!shape) return;
    exportBlockJson(shape);
  });
}

if (exportBlockJsonButton) {
  exportBlockJsonButton.addEventListener("click", () => {
    const shape = getActiveTutorialShape();
    if (!shape) return;
    exportBlockJson(shape);
  });
}

if (editBlockButton) {
  editBlockButton.addEventListener("click", () => {
    if (selectedConnectionId) {
      handleWorkflowConnectionEditRequest(selectedConnectionId);
      return;
    }
    if (selectedShapeId) {
      handleWorkflowEditRequest(selectedShapeId);
    }
  });
}

if (saveBlockButton) {
  saveBlockButton.addEventListener("click", saveBlockToApi);
}

if (resetBlockButton) {
  resetBlockButton.addEventListener("click", resetTutorialForm);
}

if (addBlockCategoryButton) {
  addBlockCategoryButton.addEventListener("click", openCategoryModal);
}

if (categoryCancelButton) {
  categoryCancelButton.addEventListener("click", closeCategoryModal);
}

if (categoryCloseButton) {
  categoryCloseButton.addEventListener("click", closeCategoryModal);
}

if (categoryCreateButton) {
  categoryCreateButton.addEventListener("click", () => {
    ensureCategoryOption(categoryNameInput?.value || "");
    closeCategoryModal();
  });
}

if (categoryNameInput) {
  categoryNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      ensureCategoryOption(categoryNameInput.value);
      closeCategoryModal();
    }
  });
}

if (addTutorialStepButton) {
  addTutorialStepButton.addEventListener("click", () => {
    let shape = getActiveTutorialShape();
    if (!shape) {
      createTutorialShape(activeTutorialShapeType || "rect");
      shape = getActiveTutorialShape();
    }
    if (!shape) return;
    const tutorial = ensureShapeTutorial(shape);
    tutorial.steps.push({
      title: window.workflowBuilderT("tutorial.stepTitle", "Etape {index}", {
        index: tutorial.steps.length + 1
      }),
      items: [{ type: "text", html: "" }],
      substeps: [],
      collapsed: true
    });
    renderTutorialEditor();
  });
}

canvas.addEventListener("mousedown", (event) => {
  const connectionHandle = event.target.closest(".conn-handle");
  if (connectionHandle) {
    suppressCanvasClick = true;
    selectConnection(connectionHandle.dataset.connId);
    const role = connectionHandle.dataset.role;
    if (role === "start" || role === "end") {
      const connection = connections.find((c) => c.id === connectionHandle.dataset.connId);
      if (!connection) return;
      endpointDrag = {
        connId: connectionHandle.dataset.connId,
        end: role,
        attached: false,
        original: {
          from: connection.from,
          to: connection.to,
          startAnchor: connection.startAnchor,
          endAnchor: connection.endAnchor
        }
      };
    } else if (role === "line") {
      const connection = connections.find((c) => c.id === connectionHandle.dataset.connId);
      if (!connection) return;
      const from = shapes.find((s) => s.id === connection.from);
      const to = shapes.find((s) => s.id === connection.to);
      if (!from || !to) return;
      const start = connection.startAnchor
        ? getAnchorPointFromAnchor(from, connection.startAnchor)
        : getAnchorPoint(from, to);
      const end = connection.endAnchor
        ? getAnchorPointFromAnchor(to, connection.endAnchor)
        : getAnchorPoint(to, from);
      materializeConnectionPoints(connection, start, end);
      const bounds = canvas.getBoundingClientRect();
      const mouse = {
        x: Math.max(0, Math.min(event.clientX - bounds.left, bounds.width)),
        y: Math.max(0, Math.min(event.clientY - bounds.top, bounds.height))
      };
      const nodes = connection.points;
      let bestIndex = null;
      let bestDist = Infinity;
      for (let i = 0; i < nodes.length - 1; i += 1) {
        const dist = distanceToSegment(mouse, nodes[i], nodes[i + 1]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }
      if (
        bestIndex === null ||
        bestIndex === 0 ||
        bestIndex === nodes.length - 2
      ) {
        return;
      }
      segmentDrag = {
        connId: connectionHandle.dataset.connId,
        segIndex: bestIndex,
        startX: event.clientX,
        startY: event.clientY,
        startPoints: connection.points.map((p) => ({ ...p })),
        adjustNeighbors: false
      };
    } else if (role === "corner") {
      const cornerIndex = Number(connectionHandle.dataset.cornerIndex);
      const connection = connections.find((c) => c.id === connectionHandle.dataset.connId);
      if (!connection) return;
      const from = shapes.find((s) => s.id === connection.from);
      const to = shapes.find((s) => s.id === connection.to);
      if (!from || !to) return;
      const start = connection.startAnchor
        ? getAnchorPointFromAnchor(from, connection.startAnchor)
        : getAnchorPoint(from, to);
      const end = connection.endAnchor
        ? getAnchorPointFromAnchor(to, connection.endAnchor)
        : getAnchorPoint(to, from);
      materializeConnectionPoints(connection, start, end);
      cornerDrag = {
        connId: connectionHandle.dataset.connId,
        cornerIndex,
        startX: event.clientX,
        startY: event.clientY,
        startPoints: connection.points.map((p) => ({ ...p }))
      };
    } else {
      return;
    }
    event.preventDefault();
    return;
  }

  const textHandle = event.target.closest(".text-handle");
  if (textHandle) {
    const shapeId = textHandle.dataset.id;
    const shape = shapes.find((s) => s.id === shapeId);
    if (!shape) return;
    isShapeTransforming = true;
    textDrag = {
      id: shapeId,
      startX: event.clientX,
      startY: event.clientY,
      startDx: shape.textDx || 0,
      startDy: shape.textDy || 0
    };
    event.preventDefault();
    return;
  }

  const handle = event.target.closest(".resize-handle");
  const shapeEl = event.target.closest(".shape");
  if (handle && shapeEl) {
    const shape = shapes.find((s) => s.id === shapeEl.dataset.id);
    if (!shape) return;
    isShapeTransforming = true;
    resizeState = {
      id: shape.id,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: shape.width,
      startHeight: shape.height,
      startLeft: shape.x,
      startTop: shape.y,
      handle: handle.dataset.resize
    };
    event.preventDefault();
    return;
  }
  if (!shapeEl) return;

  const shapeId = shapeEl.dataset.id;
  selectShape(shapeId);
  const shape = shapes.find((s) => s.id === shapeId);
  if (!shape) return;
  isShapeTransforming = true;
  const bounds = canvas.getBoundingClientRect();
  const mouseX = event.clientX - bounds.left + (canvas.scrollLeft || 0);
  const mouseY = event.clientY - bounds.top + (canvas.scrollTop || 0);
  dragState = {
    id: shapeId,
    offsetX: mouseX - shape.x,
    offsetY: mouseY - shape.y
  };
});

connectionsSvg.addEventListener("click", (event) => {
  const path = event.target.closest("path");
  const labelGroup = event.target.closest(".connection-label");
  const targetId = path?.dataset.id || labelGroup?.dataset.id;
  if (!targetId) return;
  event.stopPropagation();
  // #region agent log
  debugIngest({location:'tutorials/builder.js:connectionsSvg.click',message:'pathClick',data:{pathId:targetId},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1'});
  // #endregion
  selectConnection(targetId);
});


connectionsSvg.addEventListener("mousedown", (event) => {
  const path = event.target.closest(".connection-path, .connection-hit");
  if (path) {
    suppressCanvasClick = true;
    event.stopPropagation();
    event.preventDefault();
    const connection = connections.find((conn) => conn.id === path.dataset.id);
    if (!connection) return;
    const from = shapes.find((s) => s.id === connection.from);
    const to = shapes.find((s) => s.id === connection.to);
    if (!from || !to) return;
    const bounds = canvas.getBoundingClientRect();
    const mouse = {
      x: Math.max(0, Math.min(event.clientX - bounds.left, bounds.width)),
      y: Math.max(0, Math.min(event.clientY - bounds.top, bounds.height))
    };
    const start = connection.startAnchor
      ? getAnchorPointFromAnchor(from, connection.startAnchor)
      : getAnchorPoint(from, to);
    const end = connection.endAnchor
      ? getAnchorPointFromAnchor(to, connection.endAnchor)
      : getAnchorPoint(to, from);
    if (Array.isArray(connection.points) && connection.points.length >= maxConnectionPoints) {
      selectConnection(connection.id);
      materializeConnectionPoints(connection, start, end);
      const nodes = connection.points;
      let bestIndex = null;
      let bestDist = Infinity;
      for (let i = 0; i < nodes.length - 1; i += 1) {
        const dist = distanceToSegment(mouse, nodes[i], nodes[i + 1]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }
      if (
        bestIndex === null ||
        bestIndex <= 1 ||
        bestIndex >= nodes.length - 3
