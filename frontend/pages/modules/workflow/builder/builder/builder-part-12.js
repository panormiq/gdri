    hitPath.classList.add("connection-hit");
    const d = buildPathWithPoints(points);
    hitPath.setAttribute("d", d);
    hitPath.dataset.id = connection.id;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("connection-path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", connection.lineColor);
    path.setAttribute("stroke-width", "2");
    if (connection.lineStyle === "dashed") {
      path.setAttribute("stroke-dasharray", "6 4");
    }
    if (connection.lineArrow !== false) {
      const markerId = ensureArrowMarker(connectionsSvg, connection.lineColor);
      path.setAttribute("marker-end", `url(#${markerId})`);
    }
    path.dataset.id = connection.id;
    if (connection.id === selectedConnectionId) {
      path.classList.add("connection-selected");
      // #region agent log
      debugIngest({location:'tutorials/builder.js:updateConnections',message:'selectedConnectionRender',data:{id:connection.id,lineStyle:connection.lineStyle,lineArrow:connection.lineArrow,label:connection.label,markerApplied:connection.lineArrow !== false,pathD:d},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H3'});
      // #endregion
      // #region agent log
      const endInside =
        end.x >= to.x &&
        end.x <= to.x + to.width &&
        end.y >= to.y &&
        end.y <= to.y + to.height;
      debugIngest({location:'tutorials/builder.js:updateConnections',message:'selectedConnectionGeom',data:{id:connection.id,start,end,endInsideShape:endInside,svgZ:getComputedStyle(connectionsSvg).zIndex},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H6'});
      // #endregion
    }
    connectionsSvg.appendChild(hitPath);
    connectionsSvg.appendChild(path);

    if (connection.label && connection.label.trim()) {
      const mid = getPathMidPoint(points);
      const labelGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      labelGroup.classList.add("connection-label");
      labelGroup.dataset.id = connection.id;
      labelGroup.setAttribute(
        "transform",
        `translate(${mid.x + connection.labelDx}, ${mid.y + connection.labelDy})`
      );
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", "0");
      label.setAttribute("y", "0");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "middle");
      label.setAttribute("fill", connection.labelTextColor);
      const lines = String(connection.label).split(/\r?\n/);
      lines.forEach((line, index) => {
        const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        tspan.setAttribute("x", "0");
        if (index === 0) {
          tspan.setAttribute("dy", "0");
        } else {
          tspan.setAttribute("dy", "1.2em");
        }
        tspan.textContent = line;
        label.appendChild(tspan);
      });
      labelGroup.appendChild(label);
      connectionsSvg.appendChild(labelGroup);

      const bbox = label.getBBox();
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(bbox.x - labelPadding));
      rect.setAttribute("y", String(bbox.y - labelPadding));
      rect.setAttribute("width", String(bbox.width + labelPadding * 2));
      rect.setAttribute("height", String(bbox.height + labelPadding * 2));
      rect.setAttribute("rx", "4");
      rect.setAttribute("ry", "4");
      rect.setAttribute("fill", connection.labelBgColor);
      rect.setAttribute("fill-opacity", String(connection.labelOpacity));
      labelGroup.insertBefore(rect, label);
      // #region agent log
      debugIngest({location:'tutorials/builder.js:updateConnections',message:'labelRender',data:{id:connection.id,label:connection.label,mid,labelDx:connection.labelDx,labelDy:connection.labelDy},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H5'});
      // #endregion
    }

    if (connection.id === selectedConnectionId && points.length > 1) {
      points.forEach((point, index) => {
        if (!point) return;
        const handle = document.createElement("div");
        handle.className = "conn-handle";
        handle.style.left = `${point.x}px`;
        handle.style.top = `${point.y}px`;
        handle.dataset.connId = connection.id;
        if (index === 0) {
          handle.dataset.role = "start";
        } else if (index === points.length - 1) {
          handle.dataset.role = "end";
        } else {
          handle.dataset.role = "corner";
          handle.dataset.cornerIndex = index;
        }
        canvas.appendChild(handle);
      });
      const overallMid = getPathMidPoint(points);
      const overallDx = points[points.length - 1].x - points[0].x;
      const overallDy = points[points.length - 1].y - points[0].y;
      const shiftAxis = Math.abs(overallDx) >= Math.abs(overallDy) ? "y" : "x";
      const lineHandle = document.createElement("div");
      lineHandle.className = "conn-handle";
      lineHandle.style.left = `${overallMid.x}px`;
      lineHandle.style.top = `${overallMid.y}px`;
      lineHandle.dataset.connId = connection.id;
      lineHandle.dataset.role = "line";
      lineHandle.dataset.axis = shiftAxis;
      canvas.appendChild(lineHandle);
    }
  });
}

function getAnchorPoint(shape, target) {
  const centerX = shape.x + shape.width / 2;
  const centerY = shape.y + shape.height / 2;
  const targetX = target.x + target.width / 2;
  const targetY = target.y + target.height / 2;
  const dx = targetX - centerX;
  const dy = targetY - centerY;
  if (Math.abs(dx) > Math.abs(dy)) {
    const anchor = dx > 0 ? "right" : "left";
    if (shape.type === "diamond") {
      return getAnchorPointFromAnchor(shape, anchor);
    }
    return {
      x: dx > 0 ? shape.x + shape.width : shape.x,
      y: centerY
    };
  }
  const anchor = dy > 0 ? "bottom" : "top";
  if (shape.type === "diamond") {
    return getAnchorPointFromAnchor(shape, anchor);
  }
  return {
    x: centerX,
    y: dy > 0 ? shape.y + shape.height : shape.y
  };
}

function rotatePoint(point, center, angleRad) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

function getAnchorPointFromAnchor(shape, anchor) {
  const offset = 0;
  const center = {
    x: shape.x + shape.width / 2,
    y: shape.y + shape.height / 2
  };
  let point;
  switch (anchor) {
    case "tl":
      point = { x: shape.x - offset, y: shape.y - offset };
      break;
    case "tr":
      point = { x: shape.x + shape.width + offset, y: shape.y - offset };
      break;
    case "bl":
      point = { x: shape.x - offset, y: shape.y + shape.height + offset };
      break;
    case "br":
      point = { x: shape.x + shape.width + offset, y: shape.y + shape.height + offset };
      break;
    case "top":
      point = { x: shape.x + shape.width / 2, y: shape.y - offset };
      break;
    case "bottom":
      point = { x: shape.x + shape.width / 2, y: shape.y + shape.height + offset };
      break;
    case "left":
      point = { x: shape.x - offset, y: shape.y + shape.height / 2 };
      break;
    case "right":
      point = { x: shape.x + shape.width + offset, y: shape.y + shape.height / 2 };
      break;
    default:
      point = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
      break;
  }
  if (shape.type === "diamond") {
    return rotatePoint(point, center, Math.PI / 4);
  }
  return point;
}

function getExitVector(start, end, anchor) {
  if (anchor === "left") return { dx: -fixedConnectorOffset, dy: 0 };
  if (anchor === "right") return { dx: fixedConnectorOffset, dy: 0 };
  if (anchor === "top") return { dx: 0, dy: -fixedConnectorOffset };
  if (anchor === "bottom") return { dx: 0, dy: fixedConnectorOffset };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { dx: dx >= 0 ? fixedConnectorOffset : -fixedConnectorOffset, dy: 0 };
  }
  return { dx: 0, dy: dy >= 0 ? fixedConnectorOffset : -fixedConnectorOffset };
}

function buildFixedPoints(start, end, startAnchor, endAnchor) {
  const startVector = getExitVector(start, end, startAnchor);
  const endVector = getExitVector(end, start, endAnchor);
  const startFixed = {
    x: start.x + startVector.dx,
    y: start.y + startVector.dy
  };
  const endFixed = {
    x: end.x + endVector.dx,
    y: end.y + endVector.dy
  };
  return { startFixed, endFixed };
}

function buildBasePoints(start, end, startAnchor, endAnchor) {
  const { startFixed, endFixed } = buildFixedPoints(
    start,
    end,
    startAnchor,
    endAnchor
  );
  const sameRow = Math.abs(startFixed.y - endFixed.y) < 1;
  const sameCol = Math.abs(startFixed.x - endFixed.x) < 1;
  const points = [start, startFixed];
  if (sameRow) {
    points.push({ x: (startFixed.x + endFixed.x) / 2, y: startFixed.y });
  } else if (sameCol) {
    points.push({ x: startFixed.x, y: (startFixed.y + endFixed.y) / 2 });
  } else {
    points.push({ x: startFixed.x, y: endFixed.y });
  }
  points.push(endFixed, end);
  return ensureOrthogonal(points);
}

function normalizeConnectionPoints(connection, start, end, options = {}) {
  const preview = options.preview === true;
  const basePoints = buildBasePoints(
    start,
    end,
    connection.startAnchor,
    connection.endAnchor
  );

  if (connection.auto) {
    return basePoints;
  }

  if (!Array.isArray(connection.points) || connection.points.length < 5) {
    if (preview) {
      return basePoints;
    }
    connection.points = basePoints;
    return connection.points;
  }

  const corners = ensureOrthogonal(connection.points);
  if (corners.length < 5) {
    if (preview) {
      return basePoints;
    }
    connection.points = basePoints;
    return connection.points;
  }

  const adjusted = corners.map((point) => ({ ...point }));
  adjusted[0] = start;
  adjusted[adjusted.length - 1] = end;
  adjusted[1] = basePoints[1];
  adjusted[adjusted.length - 2] = basePoints[basePoints.length - 2];
  const normalized = ensureOrthogonal(adjusted);
  if (!preview) {
    connection.points = normalized;
  }
  return normalized;
}

function materializeConnectionPoints(connection, start, end) {
  if (connection.auto) {
    connection.auto = false;
    connection.points = buildBasePoints(
      start,
      end,
      connection.startAnchor,
      connection.endAnchor
    );
  }
  normalizeConnectionPoints(connection, start, end);
}

function resetConnectionPointsToBase(connection, start, end) {
  connection.points = buildBasePoints(
    start,
    end,
    connection.startAnchor,
    connection.endAnchor
  );
  connection.auto = false;
  return connection.points;
}

function enforceMaxConnectionPoints(connection, start, end) {
  if (!Array.isArray(connection.points)) return false;
  if (connection.points.length <= maxConnectionPoints) return false;
  resetConnectionPointsToBase(connection, start, end);
  return true;
}

function buildPathWithPoints(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function distanceToSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) {
    return Math.hypot(apx, apy);
  }
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
  const projX = a.x + abx * t;
  const projY = a.y + aby * t;
  return Math.hypot(point.x - projX, point.y - projY);
}

function insertSplitPoint(connection, mouse) {
  const nodes = connection.points;
  if (!Array.isArray(nodes) || nodes.length >= maxConnectionPoints) {
    return null;
  }
  let bestIndex = null;
  let bestDist = Infinity;
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const dist = distanceToSegment(mouse, nodes[i], nodes[i + 1]);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
