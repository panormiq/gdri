  resizeState = null;
  segmentDrag = null;
  cornerDrag = null;
  lineDrag = null;
  labelDrag = null;
  textDrag = null;
  overlayDrag = null;
  overlayResize = null;
  clearSnapGuides();
  renderShapes();
  updateConnections();
  if (endpointDrag) {
    const connection = connections.find((c) => c.id === endpointDrag.connId);
    if (connection && !endpointDrag.attached) {
      connection.from = endpointDrag.original.from;
      connection.to = endpointDrag.original.to;
      connection.startAnchor = endpointDrag.original.startAnchor;
      connection.endAnchor = endpointDrag.original.endAnchor;
      updateConnections();
    }
    endpointDrag = null;
  }
  isShapeTransforming = false;
  setTimeout(() => {
    suppressCanvasClick = false;
  }, 0);
});

canvas.addEventListener("click", (event) => {
  if (suppressCanvasClick) return;
  if (
    !event.target.closest(".shape") &&
    !event.target.closest(".conn-handle") &&
    !event.target.closest("path")
  ) {
    clearSelection();
  }
});

canvas.addEventListener("dblclick", (event) => {
  const shapeEl = event.target.closest(".shape");
  if (!shapeEl) return;
  event.stopPropagation();
  handleWorkflowEditRequest(shapeEl.dataset.id);
});

propText.addEventListener("input", (event) => {
  updateSelectedShape({ text: event.target.value });
});

propFontSize.addEventListener("input", (event) => {
  updateSelectedShape({ fontSize: Number(event.target.value) });
});

propFontFamily.addEventListener("change", (event) => {
  updateSelectedShape({ fontFamily: event.target.value });
});

propTextColor.addEventListener("input", (event) => {
  updateSelectedShape({ textColor: event.target.value });
});

propBgColor.addEventListener("input", (event) => {
  updateSelectedShape({ bgColor: event.target.value });
});

propOpacity.addEventListener("input", (event) => {
  updateSelectedShape({ opacity: Number(event.target.value) / 100 });
});

propLineStyle.addEventListener("change", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.lineStyle = event.target.value;
  // #region agent log
  debugIngest({location:'tutorials/builder.js:propLineStyle',message:'lineStyleChange',data:{id:selectedConnectionId,value:event.target.value},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4'});
  // #endregion
  updateConnections();
});

propLineArrow.addEventListener("change", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.lineArrow = event.target.value === "true";
  // #region agent log
  debugIngest({location:'tutorials/builder.js:propLineArrow',message:'lineArrowChange',data:{id:selectedConnectionId,value:event.target.value},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4'});
  // #endregion
  updateConnections();
});

propLineColor.addEventListener("input", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.lineColor = event.target.value;
  updateConnections();
});

propLineText.addEventListener("input", (event) => {
  // #region agent log
  debugIngest({location:'tutorials/builder.js:propLineText',message:'lineTextInput',data:{selectedConnectionId,value:event.target.value,shapePropsHidden:shapeProps.classList.contains("hidden"),connectionPropsHidden:connectionProps.classList.contains("hidden")},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H5'});
  // #endregion
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.label = event.target.value;
  updateConnections();
});

propLineBgColor.addEventListener("input", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.labelBgColor = event.target.value;
  updateConnections();
});

propLineTextOpacity.addEventListener("input", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.labelOpacity = Number(event.target.value) / 100;
  updateConnections();
});

propLineTextColor.addEventListener("input", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.labelTextColor = event.target.value;
  updateConnections();
});

propLineTextX.addEventListener("input", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.labelDx = Number(event.target.value);
  updateConnections();
});

propLineTextY.addEventListener("input", (event) => {
  if (!selectedConnectionId) return;
  const connection = connections.find((conn) => conn.id === selectedConnectionId);
  if (!connection) return;
  connection.labelDy = Number(event.target.value);
  updateConnections();
});

propGroup.addEventListener("change", (event) => {
  updateSelectedShape({ group: event.target.value });
  applyGroupFilter();
});

deleteShapeButton.addEventListener("click", () => {
  if (selectedShapeId) {
    const removedId = selectedShapeId;
    shapes = shapes.filter((shape) => shape.id !== removedId);
    connections = connections.filter(
      (conn) => conn.from !== removedId && conn.to !== removedId
    );
    selectedShapeId = null;
    selectedConnectionId = null;
    renderShapes();
    return;
  }
  if (selectedConnectionId) {
    connections = connections.filter((conn) => conn.id !== selectedConnectionId);
    selectedConnectionId = null;
    connectionProps.classList.add("hidden");
    updateConnections();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  const activeTag = document.activeElement?.tagName?.toLowerCase();
  if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
    return;
  }
  if (selectedOverlay) {
    const shape = tutorialShapes.find((item) => item.id === selectedOverlay.shapeId);
    const step = getTutorialStepByPath(shape, selectedOverlay.stepPath);
    const entry = step?.items?.[selectedOverlay.itemIndex];
    if (entry?.overlays) {
      entry.overlays = entry.overlays.filter((ov) => ov.id !== selectedOverlay.overlayId);
      selectedOverlay = null;
      renderTutorialEditor();
      return;
    }
  }
  if (
    Array.isArray(activeStepPath) &&
    tutorialShapes.length &&
    document.querySelector(".mode-tab.active")?.dataset.mode === "tutorial"
  ) {
    removeStepByPath(activeStepPath);
    activeStepPath = null;
    renderTutorialEditor();
    return;
  }
  deleteShapeButton.click();
});

exportButton.addEventListener("click", exportJson);

importInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    importJson(file);
    event.target.value = "";
  }
});

if (saveWorkflowButton) {
  saveWorkflowButton.addEventListener("click", saveWorkflowToApi);
}

if (loadWorkflowButton) {
  loadWorkflowButton.addEventListener("click", loadWorkflowFromApi);
}
if (deleteWorkflowButton) {
  deleteWorkflowButton.addEventListener("click", deleteWorkflowFromApi);
}

if (workflowList) {
  workflowList.addEventListener("change", () => {
    if (!workflowNameInput) return;
    const option = workflowList.selectedOptions?.[0];
    if (option && option.value) {
      workflowNameInput.value = option.textContent || "";
    }
  });
}

addGroupButton.addEventListener("click", () => {
  const name = groupNameInput.value.trim();
  if (!name || groups.includes(name)) return;
  groups.push(name);
  groupNameInput.value = "";
  refreshGroupOptions();
});

groupFilter.addEventListener("change", applyGroupFilter);

clearFilterButton.addEventListener("click", () => {
  groupFilter.value = "";
  applyGroupFilter();
});

refreshGroupOptions();
if (modeTabs.length) {
  setActiveMode("workflow");
}
updateEditButtonState();
if (refreshBlocksButton) {
  refreshBlocksButton.addEventListener("click", loadBlocks);
}
loadBlocks();
loadWorkflowList();

window.addEventListener("resize", () => {
  updateConnections();
});

if (cropCanvas) {
  cropCanvas.addEventListener("mousedown", (event) => {
    if (!cropState) return;
    const rect = cropCanvas.getBoundingClientRect();
    cropState.dragging = true;
    cropState.startX = event.clientX - rect.left;
    cropState.startY = event.clientY - rect.top;
    cropState.endX = cropState.startX;
    cropState.endY = cropState.startY;
    drawCropSelection();
  });

  cropCanvas.addEventListener("mousemove", (event) => {
    if (!cropState || !cropState.dragging) return;
    const rect = cropCanvas.getBoundingClientRect();
    cropState.endX = event.clientX - rect.left;
    cropState.endY = event.clientY - rect.top;
    drawCropSelection();
  });

  cropCanvas.addEventListener("mouseup", () => {
    if (!cropState) return;
    cropState.dragging = false;
    drawCropSelection();
  });
}

if (cropApplyButton) {
  cropApplyButton.addEventListener("click", () => {
    if (!cropState) return;
    const { image, scale, startX, startY, endX, endY, onApply } = cropState;
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);
    if (w < 5 || h < 5) {
      closeCropModal();
      return;
    }
    const sx = x / scale;
    const sy = y / scale;
    const sw = w / scale;
    const sh = h / scale;
    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    const outCtx = out.getContext("2d");
    if (!outCtx) return;
    outCtx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    const cropped = out.toDataURL("image/png");
    onApply(cropped);
    closeCropModal();
  });
}

if (cropCancelButton) {
  cropCancelButton.addEventListener("click", closeCropModal);
}

if (cropCloseButton) {
  cropCloseButton.addEventListener("click", closeCropModal);
}

document.addEventListener("paste", (event) => {
  if (!activeImageStep) return;
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (!imageItem) return;
  const file = imageItem.getAsFile();
  if (!file) return;
  const shape = tutorialShapes.find((s) => s.id === activeImageStep.shapeId);
  if (!shape || !shape.tutorial || !Array.isArray(shape.tutorial.steps)) return;
  const step = getTutorialStepByPath(shape, activeImageStep.stepPath);
  if (!step || !Array.isArray(step.items)) return;
  const item = step.items[activeImageStep.itemIndex];
  if (!item || item.type !== "image") return;
  const reader = new FileReader();
  reader.onload = () => {
    item.src = reader.result;
    renderTutorialEditor();
  };
  reader.readAsDataURL(file);
});
