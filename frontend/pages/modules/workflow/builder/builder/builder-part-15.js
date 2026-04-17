      ) {
        updateConnections();
        return;
      }
      segmentDrag = {
        connId: connection.id,
        segIndex: bestIndex,
        startX: event.clientX,
        startY: event.clientY,
        startPoints: connection.points.map((p) => ({ ...p })),
        adjustNeighbors: false
      };
      updateConnections();
      return;
    }
    materializeConnectionPoints(connection, start, end);
    const splitIndex = insertSplitPoint(connection, mouse);
    if (splitIndex === null) return;
    selectConnection(connection.id);
    segmentDrag = {
      connId: connection.id,
      segIndex: splitIndex,
      startX: event.clientX,
      startY: event.clientY,
      startPoints: connection.points.map((p) => ({ ...p })),
      adjustNeighbors: false
    };
    updateConnections();
    return;
  }
  if (event.button !== 0) return;
  const labelGroup = event.target.closest(".connection-label");
  if (!labelGroup) return;
  event.stopPropagation();
  event.preventDefault();
  const connection = connections.find((conn) => conn.id === labelGroup.dataset.id);
  if (!connection) return;
  selectConnection(connection.id);
  labelDrag = {
    connId: connection.id,
    startX: event.clientX,
    startY: event.clientY,
    startDx: connection.labelDx || 0,
    startDy: connection.labelDy || 0
  };
});

document.addEventListener("mousemove", (event) => {
  if (textDrag) {
    const shape = shapes.find((s) => s.id === textDrag.id);
    if (shape) {
      shape.textDx = textDrag.startDx + (event.clientX - textDrag.startX);
      shape.textDy = textDrag.startDy + (event.clientY - textDrag.startY);
      renderShapes();
    }
  }
  if (dragState) {
    const shape = shapes.find((s) => s.id === dragState.id);
    if (!shape) return;
    const bounds = canvas.getBoundingClientRect();
    const scrollX = canvas.scrollLeft || 0;
    const scrollY = canvas.scrollTop || 0;
    const mouseX = event.clientX - bounds.left + scrollX;
    const mouseY = event.clientY - bounds.top + scrollY;
    let nextX = Math.max(0, Math.min(mouseX - dragState.offsetX, bounds.width + scrollX - 20));
    let nextY = Math.max(0, Math.min(mouseY - dragState.offsetY, bounds.height + scrollY - 20));
    const snapped = snapMovePosition(shape, nextX, nextY);
    nextX = Math.max(0, Math.min(snapped.x, bounds.width + scrollX - 20));
    nextY = Math.max(0, Math.min(snapped.y, bounds.height + scrollY - 20));
    shape.x = nextX;
    shape.y = nextY;
    updateSnapGuides(snapped.guideX, snapped.guideY);
    renderShapes();
  }

  if (resizeState) {
    const shape = shapes.find((s) => s.id === resizeState.id);
    if (!shape) return;
    const deltaX = event.clientX - resizeState.startX;
    const deltaY = event.clientY - resizeState.startY;
    const minSize = 50;
    const next = {
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      r: shape.x + shape.width,
      b: shape.y + shape.height,
      minSize,
      edgeX: null,
      edgeY: null
    };
    if (shape.type === "diamond") {
      let proj = 0;
      if (resizeState.handle === "br") {
        proj = (deltaX + deltaY) / Math.SQRT2;
      } else if (resizeState.handle === "tl") {
        proj = (-deltaX - deltaY) / Math.SQRT2;
      } else if (resizeState.handle === "tr") {
        proj = (deltaX - deltaY) / Math.SQRT2;
      } else if (resizeState.handle === "bl") {
        proj = (-deltaX + deltaY) / Math.SQRT2;
      }
      const size = Math.max(minSize, resizeState.startWidth + proj);
      next.width = size;
      next.height = size;
      if (resizeState.handle.includes("l")) {
        next.x = resizeState.startLeft + (resizeState.startWidth - size);
        next.edgeX = "left";
      } else if (resizeState.handle.includes("r")) {
        next.edgeX = "right";
      } else {
        next.edgeX = "center";
      }
      if (resizeState.handle.includes("t")) {
        next.y = resizeState.startTop + (resizeState.startHeight - size);
        next.edgeY = "top";
      } else if (resizeState.handle.includes("b")) {
        next.edgeY = "bottom";
      } else {
        next.edgeY = "center";
      }
    } else {
      if (resizeState.handle.includes("r")) {
        next.width = Math.max(minSize, resizeState.startWidth + deltaX);
        next.edgeX = "right";
      }
      if (resizeState.handle.includes("l")) {
        next.width = Math.max(minSize, resizeState.startWidth - deltaX);
        next.x = resizeState.startLeft + deltaX;
        next.edgeX = "left";
      }
      if (resizeState.handle.includes("b")) {
        next.height = Math.max(minSize, resizeState.startHeight + deltaY);
        next.edgeY = "bottom";
      }
      if (resizeState.handle.includes("t")) {
        next.height = Math.max(minSize, resizeState.startHeight - deltaY);
        next.y = resizeState.startTop + deltaY;
        next.edgeY = "top";
      }
      if (!next.edgeX) next.edgeX = "center";
      if (!next.edgeY) next.edgeY = "center";
    }
    if (shape.type === "logo" && shape.imageRatio) {
      const ratio = shape.imageRatio || 1;
      if (resizeState.handle.includes("l") || resizeState.handle.includes("r")) {
        next.height = Math.max(minSize, Math.round(next.width / ratio));
      } else if (resizeState.handle.includes("t") || resizeState.handle.includes("b")) {
        next.width = Math.max(minSize, Math.round(next.height * ratio));
      }
      if (resizeState.handle.includes("l")) {
        next.x = resizeState.startLeft + (resizeState.startWidth - next.width);
      }
      if (resizeState.handle.includes("t")) {
        next.y = resizeState.startTop + (resizeState.startHeight - next.height);
      }
    }
    next.r = next.x + next.width;
    next.b = next.y + next.height;
    const snapped = snapResize(shape, next);
    shape.x = snapped.next.x;
    shape.y = snapped.next.y;
    shape.width = snapped.next.width;
    shape.height = snapped.next.height;
    updateSnapGuides(snapped.guideX, snapped.guideY);
    renderShapes();
  }

  if (segmentDrag) {
    const connection = connections.find((c) => c.id === segmentDrag.connId);
    if (!connection) return;
    const idx = segmentDrag.segIndex;
    const a = segmentDrag.startPoints[idx];
    const b = segmentDrag.startPoints[idx + 1];
    if (!a || !b) return;
    const dx = event.clientX - segmentDrag.startX;
    const dy = event.clientY - segmentDrag.startY;
    const skipPrev = idx - 1 === 1;
    const skipNext = idx + 2 === segmentDrag.startPoints.length - 2;
    if (a.x === b.x) {
      let shift = dx;
      const exclude = new Set([idx, idx + 1]);
      if (segmentDrag.adjustNeighbors) {
        exclude.add(idx - 1);
        exclude.add(idx + 2);
      }
      const { xTargets } = getConnectionSnapTargets(connection.points, exclude);
      const snappedX = snapAxisValue(a.x + shift, xTargets);
      shift = snappedX - a.x;
      connection.points[idx].x = a.x + shift;
      connection.points[idx + 1].x = b.x + shift;
      if (segmentDrag.adjustNeighbors) {
        const prev = segmentDrag.startPoints[idx - 1];
        const next = segmentDrag.startPoints[idx + 2];
        if (prev && prev.x === a.x && !skipPrev) {
          connection.points[idx - 1].x = prev.x + shift;
        }
        if (next && next.x === b.x && !skipNext) {
          connection.points[idx + 2].x = next.x + shift;
        }
      }
    } else if (a.y === b.y) {
      let shift = dy;
      const exclude = new Set([idx, idx + 1]);
      if (segmentDrag.adjustNeighbors) {
        exclude.add(idx - 1);
        exclude.add(idx + 2);
      }
      const { yTargets } = getConnectionSnapTargets(connection.points, exclude);
      const snappedY = snapAxisValue(a.y + shift, yTargets);
      shift = snappedY - a.y;
      connection.points[idx].y = a.y + shift;
      connection.points[idx + 1].y = b.y + shift;
      if (segmentDrag.adjustNeighbors) {
        const prev = segmentDrag.startPoints[idx - 1];
        const next = segmentDrag.startPoints[idx + 2];
        if (prev && prev.y === a.y && !skipPrev) {
          connection.points[idx - 1].y = prev.y + shift;
        }
        if (next && next.y === b.y && !skipNext) {
          connection.points[idx + 2].y = next.y + shift;
        }
      }
    }
    connection.auto = false;
    updateConnections();
  }

  if (lineDrag) {
    const connection = connections.find((c) => c.id === lineDrag.connId);
    if (!connection) return;
    const dx = event.clientX - lineDrag.startX;
    const dy = event.clientY - lineDrag.startY;
    const points = lineDrag.startPoints.map((p) => ({ ...p }));
    const startIndex = 2;
    const endIndex = points.length - 3;
    if (startIndex <= endIndex) {
      if (lineDrag.axis === "x") {
        for (let i = startIndex; i <= endIndex; i += 1) {
          points[i].x += dx;
        }
      } else {
        for (let i = startIndex; i <= endIndex; i += 1) {
          points[i].y += dy;
        }
      }
    }
    connection.auto = false;
    updateConnections();
  }

  if (cornerDrag) {
    const connection = connections.find((c) => c.id === cornerDrag.connId);
    if (!connection) return;
    const bounds = canvas.getBoundingClientRect();
    const mouseX = Math.max(0, Math.min(event.clientX - bounds.left, bounds.width));
    const mouseY = Math.max(0, Math.min(event.clientY - bounds.top, bounds.height));
    const idx = cornerDrag.cornerIndex;
    const startPoint = cornerDrag.startPoints[idx];
    if (!startPoint) return;
    const prev = cornerDrag.startPoints[idx - 1];
    const next = cornerDrag.startPoints[idx + 1];
    const isPrevFixed = idx - 1 === 1;
    const isNextFixed = idx + 1 === cornerDrag.startPoints.length - 2;
    let newX = mouseX;
    let newY = mouseY;
    const alignTol = 0.5;
    const prevVertical = prev && Math.abs(prev.x - startPoint.x) <= alignTol;
    const prevHorizontal = prev && Math.abs(prev.y - startPoint.y) <= alignTol;
    const nextVertical = next && Math.abs(next.x - startPoint.x) <= alignTol;
    const nextHorizontal = next && Math.abs(next.y - startPoint.y) <= alignTol;
    if (prev) {
      if (prevVertical && isPrevFixed) {
        newX = prev.x;
      } else if (prevHorizontal && isPrevFixed) {
        newY = prev.y;
      }
    }
    if (next) {
      if (nextVertical && isNextFixed) {
        newX = next.x;
      } else if (nextHorizontal && isNextFixed) {
        newY = next.y;
      }
    }
    connection.points[idx] = { x: newX, y: newY };
    if (prev && !isPrevFixed) {
      if (prevVertical) {
        connection.points[idx - 1].x = newX;
      } else if (prevHorizontal) {
        connection.points[idx - 1].y = newY;
      }
    }
    if (next && !isNextFixed) {
      if (nextVertical) {
        connection.points[idx + 1].x = newX;
      } else if (nextHorizontal) {
        connection.points[idx + 1].y = newY;
      }
    }
    connection.auto = false;
    updateConnections();
  }

  if (overlayDrag || overlayResize) {
    // overlay drag handled by pointer events
  }

  if (endpointDrag) {
    const connection = connections.find((c) => c.id === endpointDrag.connId);
    if (!connection) return;
    const anchorHit = getAnchorUnderPointer(event);
    if (anchorHit) {
      endpointDrag.attached = true;
      if (endpointDrag.end === "start") {
        connection.from = anchorHit.shapeId;
        connection.startAnchor = anchorHit.anchorId;
      } else {
        connection.to = anchorHit.shapeId;
        connection.endAnchor = anchorHit.anchorId;
      }
      updateConnections();
    }
  }

  if (labelDrag) {
    const connection = connections.find((c) => c.id === labelDrag.connId);
    if (!connection) return;
    connection.labelDx = labelDrag.startDx + (event.clientX - labelDrag.startX);
    connection.labelDy = labelDrag.startDy + (event.clientY - labelDrag.startY);
    if (selectedConnectionId === connection.id) {
      propLineTextX.value = Math.round(connection.labelDx);
      propLineTextY.value = Math.round(connection.labelDy);
    }
    updateConnections();
  }
});

document.addEventListener("mouseup", () => {
  const editedConnId = segmentDrag?.connId || cornerDrag?.connId || lineDrag?.connId;
  if (editedConnId) {
    const connection = connections.find((conn) => conn.id === editedConnId);
    if (connection && Array.isArray(connection.points)) {
      connection.points = simplifyAlignedPoints(
        mergeOverlappingPoints(connection.points)
      );
    }
  }
  dragState = null;
