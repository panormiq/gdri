/**
 * Texte SVG — polices, texte sur chemin (presets + courbure).
 */
(function (global) {
  const FONT_OPTIONS = [
    { id: 'arial', label: 'Arial', family: 'Arial, Helvetica, sans-serif' },
    { id: 'georgia', label: 'Georgia (serif)', family: 'Georgia, "Times New Roman", serif' },
    { id: 'impact', label: 'Impact', family: 'Impact, Haettenschweiler, Arial Black, sans-serif' },
    { id: 'trebuchet', label: 'Trebuchet', family: '"Trebuchet MS", Verdana, sans-serif' },
    { id: 'verdana', label: 'Verdana', family: 'Verdana, Geneva, sans-serif' },
    { id: 'courier', label: 'Courier (mono)', family: '"Courier New", Courier, monospace' },
  ];

  const PRESETS = {
    straight: { label: 'Ligne droite', curved: false },
    arcUp: { label: 'Arc ↑', curved: true },
    arcDown: { label: 'Arc ↓', curved: true },
    wave: { label: 'Vague', curved: true },
    circle: { label: 'Bandeau courbe', curved: true },
  };

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function findFontByFamily(family) {
    const f = String(family || '').toLowerCase();
    return FONT_OPTIONS.find((o) => f.includes(o.id) || f.includes(o.label.toLowerCase())) || null;
  }

  function normalizeTextStyle(style = {}) {
    const found = style.fontId
      ? FONT_OPTIONS.find((o) => o.id === style.fontId)
      : findFontByFamily(style.fontFamily);
    const font = found || FONT_OPTIONS[0];
    return {
      fontId: font.id,
      fontFamily: font.family,
      fontSize: clamp(Number(style.fontSize) || 32, 8, 200),
      fontWeight: style.fontWeight === 'normal' ? 'normal' : 'bold',
      color: style.color || '#1a1a1a',
      align: ['left', 'center', 'right'].includes(style.align) ? style.align : 'center',
      letterSpacing: Number(style.letterSpacing) || 0,
    };
  }

  function normalizeTextPath(textPath = {}) {
    const preset = PRESETS[textPath.preset] ? textPath.preset : 'straight';
    return {
      preset,
      strength: clamp(Number(textPath.strength != null ? textPath.strength : 55), 0, 100),
      showGuide: textPath.showGuide !== false,
      pathAlign: ['start', 'middle', 'end'].includes(textPath.pathAlign) ? textPath.pathAlign : 'middle',
    };
  }

  function isCurved(textPath) {
    const tp = normalizeTextPath(textPath);
    return tp.preset !== 'straight';
  }

  function buildPathD(bbox, textPath) {
    const { x, y, width: w, height: h } = bbox;
    const bw = Math.max(w, 20);
    const bh = Math.max(h, 20);
    const s = normalizeTextPath(textPath).strength / 100;
    const pad = Math.min(8, bw * 0.04);
    const left = x + pad;
    const right = x + bw - pad;
    const midX = x + bw / 2;
    const midY = y + bh / 2;

    switch (normalizeTextPath(textPath).preset) {
      case 'arcUp': {
        const cy = y + bh * (0.72 - s * 0.62);
        return `M ${left} ${y + bh * 0.88} Q ${midX} ${cy} ${right} ${y + bh * 0.88}`;
      }
      case 'arcDown': {
        const cy = y + bh * (0.28 + s * 0.62);
        return `M ${left} ${y + bh * 0.12} Q ${midX} ${cy} ${right} ${y + bh * 0.12}`;
      }
      case 'wave': {
        const amp = bh * 0.14 * Math.max(0.15, s);
        return [
          `M ${left} ${midY}`,
          `C ${x + bw * 0.28} ${midY - amp}, ${x + bw * 0.45} ${midY + amp}, ${midX} ${midY}`,
          `S ${x + bw * 0.82} ${midY - amp} ${right} ${midY}`,
        ].join(' ');
      }
      case 'circle': {
        const rx = bw / 2 - pad;
        const ry = bh * (0.22 + s * 0.28);
        const cy = y + bh * 0.58;
        return `M ${left} ${cy} A ${rx} ${ry} 0 0 1 ${right} ${cy}`;
      }
      default:
        return `M ${left} ${midY} L ${right} ${midY}`;
    }
  }

  function getPathControlPoint(bbox, textPath) {
    const tp = normalizeTextPath(textPath);
    if (tp.preset === 'straight' || tp.preset === 'wave' || tp.preset === 'circle') return null;
    const { x, y, width: w, height: h } = bbox;
    const s = tp.strength / 100;
    const midX = x + w / 2;
    if (tp.preset === 'arcUp') {
      return { x: midX, y: y + h * (0.72 - s * 0.62), role: 'strength' };
    }
    if (tp.preset === 'arcDown') {
      return { x: midX, y: y + h * (0.28 + s * 0.62), role: 'strength' };
    }
    return null;
  }

  function strengthFromControlY(bbox, preset, canvasY) {
    const { y, height: h } = bbox;
    const bh = Math.max(h, 20);
    if (preset === 'arcUp') {
      const t = (y + bh * 0.72 - canvasY) / (bh * 0.62);
      return clamp(Math.round(t * 100), 5, 100);
    }
    if (preset === 'arcDown') {
      const t = (canvasY - (y + bh * 0.28)) / (bh * 0.62);
      return clamp(Math.round(t * 100), 5, 100);
    }
    return 55;
  }

  function straightAnchor(style) {
    if (style.align === 'left') return 'start';
    if (style.align === 'right') return 'end';
    return 'middle';
  }

  function pathStartOffset(textPath) {
    const a = normalizeTextPath(textPath).pathAlign;
    if (a === 'start') return '0%';
    if (a === 'end') return '100%';
    return '50%';
  }

  function pathTextAnchor(textPath) {
    const a = normalizeTextPath(textPath).pathAlign;
    if (a === 'start') return 'start';
    if (a === 'end') return 'end';
    return 'middle';
  }

  function appendTextLayer(parentG, layer, options = {}) {
    if (!layer || layer.type !== 'text') return;
    const { x, y, width: w, height: h } = layer.bbox;
    const style = normalizeTextStyle(layer.style);
    const textPath = normalizeTextPath(layer.textPath);
    const curved = isCurved(textPath);
    const showGuide = options.showPathGuide && textPath.showGuide && curved;

    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hit.setAttribute('x', String(x));
    hit.setAttribute('y', String(y));
    hit.setAttribute('width', String(w));
    hit.setAttribute('height', String(h));
    hit.setAttribute('fill', 'transparent');
    hit.classList.add('ms-text-hit');
    parentG.appendChild(hit);

    if (curved) {
      const pathId = `ms-tpath-${layer.id}`;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('id', pathId);
      path.setAttribute('d', buildPathD(layer.bbox, textPath));
      path.setAttribute('fill', 'none');
      if (showGuide) {
        path.setAttribute('stroke', '#6c8cff');
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('stroke-dasharray', '5 4');
        path.setAttribute('opacity', '0.85');
      } else {
        path.setAttribute('stroke', 'none');
      }
      path.setAttribute('pointer-events', 'none');
      parentG.appendChild(path);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('font-family', style.fontFamily);
      text.setAttribute('font-size', String(style.fontSize));
      text.setAttribute('font-weight', style.fontWeight);
      text.setAttribute('fill', style.color);
      if (style.letterSpacing) text.setAttribute('letter-spacing', String(style.letterSpacing));
      text.setAttribute('pointer-events', 'none');

      const tp = document.createElementNS('http://www.w3.org/2000/svg', 'textPath');
      tp.setAttribute('href', `#${pathId}`);
      tp.setAttribute('startOffset', pathStartOffset(textPath));
      tp.setAttribute('text-anchor', pathTextAnchor(textPath));
      tp.setAttribute('dominant-baseline', 'middle');
      tp.textContent = layer.content || '';
      text.appendChild(tp);
      parentG.appendChild(text);

      if (options.showPathHandle) {
        const cp = getPathControlPoint(layer.bbox, textPath);
        if (cp) {
          const knob = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          knob.setAttribute('cx', String(cp.x));
          knob.setAttribute('cy', String(cp.y));
          knob.setAttribute('r', '8');
          knob.dataset.textPathControl = '1';
          knob.classList.add('ms-text-path-handle');
          parentG.appendChild(knob);
        }
      }
    } else {
      const fs = style.fontSize;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const anchor = straightAnchor(style);
      const tx = style.align === 'center' ? x + w / 2 : (style.align === 'right' ? x + w - 4 : x + 4);
      const ty = y + h / 2 + fs * 0.35;
      text.setAttribute('x', String(tx));
      text.setAttribute('y', String(ty));
      text.setAttribute('font-family', style.fontFamily);
      text.setAttribute('font-size', String(fs));
      text.setAttribute('font-weight', style.fontWeight);
      text.setAttribute('fill', style.color);
      text.setAttribute('text-anchor', anchor);
      if (style.letterSpacing) text.setAttribute('letter-spacing', String(style.letterSpacing));
      text.setAttribute('pointer-events', 'none');
      text.textContent = layer.content || '';
      parentG.appendChild(text);
    }
  }

  function exportTextSvg(layer, escapeXml) {
    const style = normalizeTextStyle(layer.style);
    const textPath = normalizeTextPath(layer.textPath);
    const content = escapeXml(layer.content || '');
    const fs = style.fontSize;
    const { x, y, width: w, height: h } = layer.bbox;

    if (isCurved(textPath)) {
      const pathId = `export-tpath-${layer.id}`;
      const d = buildPathD(layer.bbox, textPath);
      return [
        `<path id="${pathId}" d="${d}" fill="none"/>`,
        `<text font-family="${style.fontFamily}" font-size="${fs}" font-weight="${style.fontWeight}" fill="${style.color}"${style.letterSpacing ? ` letter-spacing="${style.letterSpacing}"` : ''}>`,
        `<textPath href="#${pathId}" startOffset="${pathStartOffset(textPath)}" text-anchor="${pathTextAnchor(textPath)}">${content}</textPath>`,
        '</text>',
      ].join('');
    }

    const anchor = straightAnchor(style);
    const tx = style.align === 'center' ? x + w / 2 : (style.align === 'right' ? x + w - 4 : x + 4);
    const ty = y + h / 2 + fs * 0.35;
    return `<text x="${tx}" y="${ty}" font-family="${style.fontFamily}" font-size="${fs}" font-weight="${style.fontWeight}" fill="${style.color}" text-anchor="${anchor}"${style.letterSpacing ? ` letter-spacing="${style.letterSpacing}"` : ''}>${content}</text>`;
  }

  function defaultTextPath() {
    return normalizeTextPath({});
  }

  global.MediaStudioText = {
    FONT_OPTIONS,
    PRESETS,
    normalizeTextStyle,
    normalizeTextPath,
    defaultTextPath,
    isCurved,
    buildPathD,
    getPathControlPoint,
    strengthFromControlY,
    appendTextLayer,
    exportTextSvg,
  };
})(window);
