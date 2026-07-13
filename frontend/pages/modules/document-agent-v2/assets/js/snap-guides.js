/**
 * FICHIER : frontend/pages/modules/document-agent-v2/assets/js/snap-guides.js
 * RÔLE : Aimants + lignes de construction (guides).
 */
(function initAdv2Snap(global) {
  'use strict';

  function getAnchors(rect) {
    const { x, y, w, h } = rect;
    return {
      left: x,
      hCenter: x + w / 2,
      right: x + w,
      top: y,
      vCenter: y + h / 2,
      bottom: y + h
    };
  }

  function nodePageRect(node, nodeMap) {
    const l = node.layout || {};
    const x = Number(l.x) || 0;
    const y = Number(l.y) || 0;
    const w = Number(l.width) || 0;
    const h = Number(l.height) || 0;
    if (!node?.parentId) return { x, y, w, h };
    const parent = nodeMap.get(node.parentId);
    if (!parent) return { x, y, w, h };
    const pr = nodePageRect(parent, nodeMap);
    return { x: pr.x + x, y: pr.y + y, w, h };
  }

  function uniqueTargets(list) {
    return [...new Set(list.map((n) => Math.round(n * 100) / 100))];
  }

  function parseResizeDir(dir) {
    const d = dir || 'se';
    return {
      west: d === 'w' || d === 'nw' || d === 'sw',
      east: d === 'e' || d === 'ne' || d === 'se',
      north: d === 'n' || d === 'ne' || d === 'nw',
      south: d === 's' || d === 'se' || d === 'sw'
    };
  }

  function collectSnapTargets(page, nodes, guides, excludeId, margins) {
    const targets = { x: [], y: [], guidesX: [], guidesY: [] };
    const pw = page.widthMm;
    const ph = page.heightMm;
    const m = margins || { top: 0, right: 0, bottom: 0, left: 0 };

    if (page.snap?.snapToPage !== false) {
      targets.x.push(0, m.left, pw / 2, pw - m.right, pw);
      targets.y.push(0, m.top, ph / 2, ph - m.bottom, ph);
    }

    if (page.snap?.snapToGuides !== false) {
      (guides?.vertical || []).forEach((v) => {
        const n = Number(v);
        targets.x.push(n);
        targets.guidesX.push(n);
      });
      (guides?.horizontal || []).forEach((v) => {
        const n = Number(v);
        targets.y.push(n);
        targets.guidesY.push(n);
      });
    }

    if (page.snap?.snapToNodes !== false) {
      const nodeMap = new Map((nodes || []).map((n) => [n.id, n]));
      (nodes || []).forEach((node) => {
        if (!node || node.id === excludeId) return;
        const r = nodePageRect(node, nodeMap);
        const a = getAnchors(r);
        targets.x.push(a.left, a.hCenter, a.right);
        targets.y.push(a.top, a.vCenter, a.bottom);
      });
    }

    return {
      x: uniqueTargets(targets.x),
      y: uniqueTargets(targets.y),
      guidesX: uniqueTargets(targets.guidesX),
      guidesY: uniqueTargets(targets.guidesY)
    };
  }

  function collectLocalSnapTargets(parentRect, siblings, guides, page, excludeId) {
    const targets = {
      x: [0, parentRect.w / 2, parentRect.w],
      y: [0, parentRect.h / 2, parentRect.h],
      guidesX: [],
      guidesY: []
    };

    (siblings || []).forEach((node) => {
      if (!node || node.id === excludeId) return;
      const l = node.layout || {};
      const r = {
        x: Number(l.x) || 0,
        y: Number(l.y) || 0,
        w: Number(l.width) || 0,
        h: Number(l.height) || 0
      };
      const a = getAnchors(r);
      targets.x.push(a.left, a.hCenter, a.right);
      targets.y.push(a.top, a.vCenter, a.bottom);
    });

    if (page.snap?.snapToGuides !== false) {
      (guides?.vertical || []).forEach((v) => {
        const local = Number(v) - parentRect.x;
        targets.x.push(local);
        targets.guidesX.push(local);
      });
      (guides?.horizontal || []).forEach((v) => {
        const local = Number(v) - parentRect.y;
        targets.y.push(local);
        targets.guidesY.push(local);
      });
    }

    return {
      x: uniqueTargets(targets.x),
      y: uniqueTargets(targets.y),
      guidesX: uniqueTargets(targets.guidesX),
      guidesY: uniqueTargets(targets.guidesY)
    };
  }

  /** Meilleur snap sur un seul axe ; priorityTargets testés en premier (guides). */
  function snapAxis(anchorValues, targets, threshold, priorityTargets) {
    let best = { delta: 0, target: null, anchor: null };

    const tryList = (list) => {
      if (!list?.length) return;
      anchorValues.forEach((anchorVal) => {
        list.forEach((target) => {
          const delta = target - anchorVal;
          if (Math.abs(delta) <= threshold) {
            if (best.target === null || Math.abs(delta) < Math.abs(best.delta)) {
              best = { delta, target, anchor: anchorVal };
            }
          }
        });
      });
    };

    if (priorityTargets?.length) {
      tryList(priorityTargets);
      if (best.target != null) return best;
    }
    tryList(targets);
    return best;
  }

  function buildSnapLinesForRect(finalAnchors, snapX, snapY, offsetX, offsetY) {
    const ox = offsetX || 0;
    const oy = offsetY || 0;
    const lines = [];
    if (snapX.target != null) {
      lines.push({ type: 'v', at: Math.round((snapX.target + ox) * 100) / 100 });
      lines.push({ type: 'h', at: Math.round((finalAnchors.top + oy) * 100) / 100 });
      lines.push({ type: 'h', at: Math.round((finalAnchors.bottom + oy) * 100) / 100 });
    }
    if (snapY.target != null) {
      lines.push({ type: 'h', at: Math.round((snapY.target + oy) * 100) / 100 });
      lines.push({ type: 'v', at: Math.round((finalAnchors.left + ox) * 100) / 100 });
      lines.push({ type: 'v', at: Math.round((finalAnchors.right + ox) * 100) / 100 });
    }
    return lines;
  }

  function applySnapResizeCore(rect, dir, targets, page, minSize) {
    const threshold = Number(page.snap?.thresholdMm) || 2;
    const minW = minSize?.w ?? 1;
    const minH = minSize?.h ?? 1;
    const edges = parseResizeDir(dir);

    let x = rect.x;
    let y = rect.y;
    let w = rect.w;
    let h = rect.h;
    let snapX = { delta: 0, target: null };
    let snapY = { delta: 0, target: null };

    if (edges.west) {
      snapX = snapAxis([x], targets.x, threshold, targets.guidesX);
      if (snapX.target != null) {
        const newX = x + snapX.delta;
        const newW = w - snapX.delta;
        if (newW >= minW) {
          x = newX;
          w = newW;
        } else {
          snapX = { delta: 0, target: null };
        }
      }
    } else if (edges.east) {
      const right = x + w;
      snapX = snapAxis([right], targets.x, threshold, targets.guidesX);
      if (snapX.target != null) {
        const newW = w + snapX.delta;
        if (newW >= minW) {
          w = newW;
        } else {
          snapX = { delta: 0, target: null };
        }
      }
    }

    if (edges.north) {
      snapY = snapAxis([y], targets.y, threshold, targets.guidesY);
      if (snapY.target != null) {
        const newY = y + snapY.delta;
        const newH = h - snapY.delta;
        if (newH >= minH) {
          y = newY;
          h = newH;
        } else {
          snapY = { delta: 0, target: null };
        }
      }
    } else if (edges.south) {
      const bottom = y + h;
      snapY = snapAxis([bottom], targets.y, threshold, targets.guidesY);
      if (snapY.target != null) {
        const newH = h + snapY.delta;
        if (newH >= minH) {
          h = newH;
        } else {
          snapY = { delta: 0, target: null };
        }
      }
    }

    const moved = {
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      w: Math.round(w * 100) / 100,
      h: Math.round(h * 100) / 100
    };
    const finalAnchors = getAnchors(moved);
    return { rect: moved, lines: buildSnapLinesForRect(finalAnchors, snapX, snapY, 0, 0), snapX, snapY };
  }

  function collectGuideSnapTargets(page, guides, zoneRect, guideAxis, excludeIndex) {
    const targets = { x: [], y: [] };
    const pw = page.widthMm || 210;
    const ph = page.heightMm || 297;
    const m = page.margins || { top: 0, right: 0, bottom: 0, left: 0 };

    if (page.snap?.snapToPage !== false) {
      targets.x.push(0, m.left, pw / 2, pw - m.right, pw);
      targets.y.push(0, m.top, ph / 2, ph - m.bottom, ph);
    }

    if (zoneRect) {
      const a = getAnchors(zoneRect);
      if (guideAxis === 'v') {
        targets.x.push(a.left, a.hCenter, a.right);
      } else {
        targets.y.push(a.top, a.vCenter, a.bottom);
      }
    }

    if (page.snap?.snapToGuides !== false) {
      (guides?.vertical || []).forEach((v, index) => {
        if (guideAxis === 'v' && index === excludeIndex) return;
        targets.x.push(Number(v));
      });
      (guides?.horizontal || []).forEach((v, index) => {
        if (guideAxis === 'h' && index === excludeIndex) return;
        targets.y.push(Number(v));
      });
    }

    return { x: uniqueTargets(targets.x), y: uniqueTargets(targets.y) };
  }

  function applySnapGuide(axis, mm, page, guides, zoneRect, excludeIndex) {
    const threshold = Number(page.snap?.thresholdMm) || 2;
    if (page.snap?.enabled === false) {
      return { mm: Math.round(mm * 100) / 100, lines: [] };
    }

    const targets = collectGuideSnapTargets(page, guides, zoneRect, axis, excludeIndex);
    const list = axis === 'v' ? targets.x : targets.y;
    let bestTarget = null;
    let bestDelta = null;

    list.forEach((target) => {
      const delta = target - mm;
      if (Math.abs(delta) <= threshold) {
        if (bestDelta === null || Math.abs(delta) < Math.abs(bestDelta)) {
          bestDelta = delta;
          bestTarget = target;
        }
      }
    });

    const snapped = bestTarget != null
      ? Math.round(bestTarget * 100) / 100
      : Math.round(mm * 100) / 100;

    const lines = [];
    if (bestTarget != null) {
      lines.push({ type: axis === 'v' ? 'v' : 'h', at: snapped });
      if (zoneRect) {
        const a = getAnchors(zoneRect);
        if (axis === 'v' && (
          Math.abs(a.left - snapped) <= threshold
          || Math.abs(a.hCenter - snapped) <= threshold
          || Math.abs(a.right - snapped) <= threshold
        )) {
          lines.push({ type: 'h', at: a.top });
          lines.push({ type: 'h', at: a.bottom });
        }
        if (axis === 'h' && (
          Math.abs(a.top - snapped) <= threshold
          || Math.abs(a.vCenter - snapped) <= threshold
          || Math.abs(a.bottom - snapped) <= threshold
        )) {
          lines.push({ type: 'v', at: a.left });
          lines.push({ type: 'v', at: a.right });
        }
      }
    }

    return { mm: snapped, lines };
  }

  function applySnapRect(rect, page, nodes, guides, excludeId) {
    const threshold = Number(page.snap?.thresholdMm) || 2;
    if (page.snap?.enabled === false) return { rect, lines: [] };

    const targets = collectSnapTargets(page, nodes, guides, excludeId, page.margins);
    const anchors = getAnchors(rect);

    const snapX = snapAxis(
      [anchors.left, anchors.hCenter, anchors.right],
      targets.x,
      threshold,
      targets.guidesX
    );
    const snapY = snapAxis(
      [anchors.top, anchors.vCenter, anchors.bottom],
      targets.y,
      threshold,
      targets.guidesY
    );

    const moved = { ...rect };
    if (snapX.target != null) {
      moved.x = Math.round((rect.x + snapX.delta) * 100) / 100;
    }
    if (snapY.target != null) {
      moved.y = Math.round((rect.y + snapY.delta) * 100) / 100;
    }

    const finalAnchors = getAnchors(moved);
    const lines = buildSnapLinesForRect(finalAnchors, snapX, snapY, 0, 0);
    return { rect: moved, lines };
  }

  function applySnapRectLocal(rect, parentPageRect, siblings, guides, page, excludeId) {
    const threshold = Number(page.snap?.thresholdMm) || 2;
    if (page.snap?.enabled === false) return { rect, lines: [] };

    const targets = collectLocalSnapTargets(parentPageRect, siblings, guides, page, excludeId);
    const anchors = getAnchors(rect);

    const snapX = snapAxis(
      [anchors.left, anchors.hCenter, anchors.right],
      targets.x,
      threshold,
      targets.guidesX
    );
    const snapY = snapAxis(
      [anchors.top, anchors.vCenter, anchors.bottom],
      targets.y,
      threshold,
      targets.guidesY
    );

    const moved = { ...rect };
    if (snapX.target != null) {
      moved.x = Math.round((rect.x + snapX.delta) * 100) / 100;
    }
    if (snapY.target != null) {
      moved.y = Math.round((rect.y + snapY.delta) * 100) / 100;
    }

    const finalAnchors = getAnchors(moved);
    const lines = buildSnapLinesForRect(
      finalAnchors,
      snapX,
      snapY,
      parentPageRect.x,
      parentPageRect.y
    );
    return { rect: moved, lines };
  }

  function applySnapResizeRect(rect, dir, page, nodes, guides, excludeId, minSize) {
    if (page.snap?.enabled === false) return { rect, lines: [] };
    const targets = collectSnapTargets(page, nodes, guides, excludeId, page.margins);
    return applySnapResizeCore(rect, dir, targets, page, minSize);
  }

  function applySnapResizeRectLocal(rect, dir, parentPageRect, siblings, guides, page, excludeId, minSize) {
    if (page.snap?.enabled === false) return { rect, lines: [] };
    const targets = collectLocalSnapTargets(parentPageRect, siblings, guides, page, excludeId);
    const result = applySnapResizeCore(rect, dir, targets, page, minSize);
    const finalAnchors = getAnchors(result.rect);
    return {
      rect: result.rect,
      lines: buildSnapLinesForRect(
        finalAnchors,
        result.snapX,
        result.snapY,
        parentPageRect.x,
        parentPageRect.y
      )
    };
  }

  global.Adv2Snap = {
    applySnapRect,
    applySnapRectLocal,
    applySnapResizeRect,
    applySnapResizeRectLocal,
    applySnapGuide,
    collectSnapTargets,
    nodePageRect
  };
}(window));
