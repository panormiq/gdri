  }
  if (
    bestIndex === null ||
    bestIndex <= 1 ||
    bestIndex >= nodes.length - 3
  ) {
    return null;
  }
  const a = nodes[bestIndex];
  const b = nodes[bestIndex + 1];
  if (!a || !b) return null;
  const newPoint = a.x === b.x
    ? { x: a.x, y: mouse.y }
    : { x: mouse.x, y: a.y };
  connection.points.splice(bestIndex + 1, 0, newPoint);
  return bestIndex;
}

const t = window.workflowBuilderT || ((key, fallback) => fallback || key);

function getConnectionSnapTargets(points, excludeIndices) {
  const xTargets = [];
  const yTargets = [];
  points.forEach((point, index) => {
    if (!point) return;
    if (excludeIndices && excludeIndices.has(index)) return;
    xTargets.push(point.x);
    yTargets.push(point.y);
  });
  return { xTargets, yTargets };
}

function snapAxisValue(value, targets) {
  if (!targets.length) return value;
  const snap = pickSnap(value, targets);
  return snap.snapped ? snap.value : value;
}

function mergeOverlappingPoints(points) {
  if (!Array.isArray(points) || points.length < 2) return points;
  const merged = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = merged[merged.length - 1];
    const cur = points[i];
    if (
      Math.abs(cur.x - prev.x) <= snapThreshold &&
      Math.abs(cur.y - prev.y) <= snapThreshold
    ) {
      continue;
    }
    merged.push(cur);
  }
  return merged;
}

function simplifyAlignedPoints(points) {
  if (!Array.isArray(points) || points.length <= 5) return points;
  const simplified = points.map((point) => ({ ...point }));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i <= simplified.length - 4; i += 1) {
      const a = simplified[i];
      const b = simplified[i + 1];
      const c = simplified[i + 2];
      const d = simplified[i + 3];
      if (!a || !b || !c || !d) continue;
      const alignedX = a.x === b.x && b.x === c.x && c.x === d.x;
      const alignedY = a.y === b.y && b.y === c.y && c.y === d.y;
      if (alignedX || alignedY) {
        simplified.splice(i + 1, 1);
        changed = true;
        break;
      }
    }
  }
  return simplified;
}


function getAnchorUnderPointer(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  const anchor = element?.closest?.(".anchor");
  if (!anchor) return null;
  const shapeEl = anchor.closest(".shape");
  if (!shapeEl) return null;
  return {
    shapeId: shapeEl.dataset.id,
    anchorId: anchor.dataset.anchor
  };
}

function getPathMidPoint(points) {
  const segments = points;
  let total = 0;
  const lengths = [];
  for (let i = 0; i < segments.length - 1; i += 1) {
    const dx = segments[i + 1].x - segments[i].x;
    const dy = segments[i + 1].y - segments[i].y;
    const len = Math.hypot(dx, dy);
    lengths.push(len);
    total += len;
  }
  const half = total / 2;
  let acc = 0;
  for (let i = 0; i < lengths.length; i += 1) {
    if (acc + lengths[i] >= half) {
      const ratio = (half - acc) / lengths[i];
      return {
        x: segments[i].x + (segments[i + 1].x - segments[i].x) * ratio,
        y: segments[i].y + (segments[i + 1].y - segments[i].y) * ratio
      };
    }
    acc += lengths[i];
  }
  return segments[Math.floor(segments.length / 2)];
}

function addConnection(fromId, toId) {
  if (fromId === toId) return;
  const exists = connections.some(
    (conn) => conn.from === fromId && conn.to === toId
  );
  if (exists) return;
  connections.push({
    id: generateId("conn"),
    from: fromId,
    to: toId,
    points: [],
    auto: true,
    lineStyle: "solid",
    lineArrow: true,
    label: "",
    labelDx: 0,
    labelDy: 0,
    labelBgColor: "#ffffff",
    labelOpacity: 1,
    labelTextColor: "#1f2933"
  });
  updateConnections();
}

function applyGroupFilter() {
  const filter = groupFilter.value;
  const shapesEls = canvas.querySelectorAll(".shape");
  shapesEls.forEach((el) => {
    const shape = shapes.find((s) => s.id === el.dataset.id);
    if (!shape) return;
    const hide = filter && shape.group !== filter;
    el.style.display = hide ? "none" : "flex";
  });
  connectionsSvg.querySelectorAll("path").forEach((line) => {
    const connection = connections.find((c) => c.id === line.dataset.id);
    if (!connection) return;
    const from = shapes.find((s) => s.id === connection.from);
    const to = shapes.find((s) => s.id === connection.to);
    const hide =
      filter &&
      ((from && from.group !== filter) || (to && to.group !== filter));
    line.style.display = hide ? "none" : "block";
  });
  canvas.querySelectorAll(".conn-handle").forEach((handle) => {
    const connection = connections.find((c) => c.id === handle.dataset.connId);
    if (!connection) return;
    const from = shapes.find((s) => s.id === connection.from);
    const to = shapes.find((s) => s.id === connection.to);
    const hide =
      filter &&
      ((from && from.group !== filter) || (to && to.group !== filter));
    handle.style.display = hide ? "none" : "block";
  });
}

function exportJson() {
  const payload = {
    shapes,
    connections,
    groups
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = t("workflow.exportFileName", "workflow.json");
  link.click();
  URL.revokeObjectURL(url);
}

function applyWorkflowData(data) {
  shapes = Array.isArray(data?.shapes)
    ? data.shapes.map((shape) => ({
        opacity: 1,
        ...shape
      }))
    : [];
  connections = Array.isArray(data?.connections)
    ? data.connections.map((conn) => ({
        points: [],
        auto: true,
        lineColor: "#0e9cef",
        lineStyle: "solid",
        lineArrow: true,
        startAnchor: null,
        endAnchor: null,
        label: "",
        labelDx: 0,
        labelDy: 0,
        labelBgColor: "#ffffff",
        labelOpacity: 1,
        labelTextColor: "#1f2933",
        ...conn
      }))
    : [];
  groups = Array.isArray(data?.groups) ? data.groups : [];
  refreshGroupOptions();
  if (groupFilter) {
    groupFilter.value = "";
  }
  if (propGroup) {
    propGroup.value = "";
  }
  renderShapes();
  refreshTutorialShapeOptions();
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      applyWorkflowData(data);
    } catch (error) {
      alert(t("alert.invalidJson", "JSON invalide."));
    }
  };
  reader.readAsText(file);
}

function refreshGroupOptions() {
  propGroup.innerHTML = "";
  const propPlaceholder = document.createElement("option");
  propPlaceholder.value = "";
  propPlaceholder.textContent = t("common.none", "Aucun");
  propGroup.appendChild(propPlaceholder);

  groupFilter.innerHTML = "";
  const filterPlaceholder = document.createElement("option");
  filterPlaceholder.value = "";
  filterPlaceholder.textContent = t("common.all", "Tous");
  groupFilter.appendChild(filterPlaceholder);
  groupList.innerHTML = "";
  groups.forEach((group) => {
    const opt = document.createElement("option");
    opt.value = group;
    opt.textContent = group;
    propGroup.appendChild(opt);
    const filterOpt = document.createElement("option");
    filterOpt.value = group;
    filterOpt.textContent = group;
    groupFilter.appendChild(filterOpt);
    const item = document.createElement("div");
    item.textContent = group;
    groupList.appendChild(item);
  });
}

loadShapeLibraryFromStorage();

shapeButtons.forEach((button) => {
  button.addEventListener("click", () => createShape(button.dataset.shape));
});

if (canvas) {
  canvas.addEventListener("dragover", (event) => {
    if (activeMode !== "workflow") return;
    event.preventDefault();
  });
  canvas.addEventListener("drop", (event) => {
    if (activeMode !== "workflow") return;
    event.preventDefault();
    suppressCanvasClick = true;
    const raw = event.dataTransfer?.getData("application/json");
    if (!raw) return;
    try {
      const entry = JSON.parse(raw);
      const rect = canvas.getBoundingClientRect();
      const scrollX = canvas.scrollLeft || 0;
      const scrollY = canvas.scrollTop || 0;
      const position = {
        x: event.clientX - rect.left + scrollX,
        y: event.clientY - rect.top + scrollY
      };
      if (entry.kind === "block" && entry.path) {
        fetchBlockData({ path: entry.path })
          .then((data) => {
            if (!data) return;
            createWorkflowShapeFromBlock(data, position);
          })
          .catch(() => {});
        return;
      }
      if (entry.kind === "shape") {
        addWorkflowShapeFromLibrary(entry, position);
      }
    } catch (error) {
      // ignore invalid drag payload
    }
  });
}

modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveMode(tab.dataset.mode);
  });
});

if (tutorialShapeSelect) {
  tutorialShapeSelect.addEventListener("change", () => {
    activeTutorialShapeType = tutorialShapeSelect.value || "rect";
    let shape = getTutorialShapeByType(activeTutorialShapeType);
    if (!shape) {
      createTutorialShape(activeTutorialShapeType);
      shape = getTutorialShapeByType(activeTutorialShapeType);
    }
    if (!shape) return;
    activeTutorialShapeId = shape.id;
    renderTutorialEditor();
  });
}

if (tutorialAddShapeButton) {
  tutorialAddShapeButton.addEventListener("click", () => {
    toggleTutorialShapeForm(true);
    refreshTutorialShapeCategoryOptions();
  });
}

if (tutorialShapeNewCategoryButton) {
  tutorialShapeNewCategoryButton.addEventListener("click", () => {
    if (!tutorialShapeCategoryInput || !tutorialShapeCategorySelect) return;
    tutorialShapeCategoryInput.classList.toggle("hidden");
    const isHidden = tutorialShapeCategoryInput.classList.contains("hidden");
    tutorialShapeCategorySelect.disabled = !isHidden;
    if (!isHidden) {
      tutorialShapeCategoryInput.focus();
    }
  });
}

if (tutorialShapeCancelButton) {
  tutorialShapeCancelButton.addEventListener("click", () => {
    resetTutorialShapeForm();
    toggleTutorialShapeForm(false);
  });
}

if (tutorialShapeCreateButton) {
  tutorialShapeCreateButton.addEventListener("click", () => {
    const nameValue = String(tutorialShapeNameInput?.value || "").trim();
