/**
 * Éditeur scène multi-calques — rendu SVG, sélection, déplacement.
 */
(function (global) {
  const STORAGE_KEY = 'gdri-media-studio-scene';

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function emptyManifest() {
    return {
      version: 1,
      title: 'Sans titre',
      canvas: { width: 1200, height: 630, background: '#ffffff' },
      layers: [],
    };
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function even(n) {
    const v = Math.round(n);
    return v % 2 === 0 ? v : v + 1;
  }

  /** Multiple de 8 — requis par Flux / latent SD3 */
  function snapFluxDim(n, min = 64, max = 768) {
    let v = Math.round(n);
    v = Math.max(min, Math.min(max, v));
    v = Math.round(v / 8) * 8;
    return Math.max(min, v);
  }

  /**
   * Taille Flux = même ratio que la bbox du calque, bornée à maxPx.
   * Évite les images 768×768 sur un calque panoramique ou étroit.
   */
  function fitSizeToBbox(bboxW, bboxH, maxPx = 768, minPx = 64) {
    let w = Math.max(bboxW, 1);
    let h = Math.max(bboxH, 1);
    const ratio = w / h;

    if (w > maxPx || h > maxPx) {
      if (w >= h) {
        w = maxPx;
        h = maxPx / ratio;
      } else {
        h = maxPx;
        w = maxPx * ratio;
      }
    }

    if (w < minPx || h < minPx) {
      if (ratio >= 1) {
        w = Math.max(w, minPx);
        h = w / ratio;
      } else {
        h = Math.max(h, minPx);
        w = h * ratio;
      }
    }

    return {
      width: snapFluxDim(w, minPx, maxPx),
      height: snapFluxDim(h, minPx, maxPx),
    };
  }

  function parseJsonFromText(text) {
    if (!text) return null;
    const raw = String(text).trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : raw;
    try {
      return JSON.parse(candidate);
    } catch {
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(candidate.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  function inferRole(layer) {
    if (layer.type === 'text') return 'text';
    if (layer.role === 'background' || layer.role === 'object') return layer.role;
    const hint = `${layer.id} ${layer.title || ''} ${layer.description || ''}`.toLowerCase();
    if (/fond|background|ciel|sky|gradient|dégradé|wallpaper|decor|scenery|paysage/.test(hint)) return 'background';
    return 'object';
  }

  function inferStatus(layer) {
    if (layer.status === 'brouillon' || layer.status === 'prompt_ready' || layer.status === 'generated') {
      return layer.status;
    }
    if (layer.asset && layer.asset.filename) return 'generated';
    if (layer.type === 'character' && String(layer.prompt || '').trim().length > 8) return 'prompt_ready';
    if (layer.type === 'image' && String(layer.prompt || '').trim().length > 24) return 'prompt_ready';
    return 'brouillon';
  }

  function getLayerTitle(layer) {
    if (!layer) return '';
    if (layer.title) return layer.title;
    if (layer.type === 'text') return (layer.content || 'Texte').slice(0, 40);
    if (layer.type === 'character') return 'Personnage';
    return layer.id || 'Calque';
  }

  function normalizeLayer(layer, index) {
    const bbox = layer.bbox || { x: 0, y: 0, width: 200, height: 120 };
    let type = 'image';
    if (layer.type === 'text') type = 'text';
    else if (layer.type === 'character') type = 'character';

    const normalized = {
      id: layer.id || uid(type === 'text' ? 'text' : (type === 'character' ? 'char' : 'img')),
      type,
      title: layer.title || '',
      description: layer.description || '',
      zIndex: layer.zIndex != null ? layer.zIndex : index,
      bbox: {
        x: Number(bbox.x) || 0,
        y: Number(bbox.y) || 0,
        width: Math.max(20, Number(bbox.width) || 200),
        height: Math.max(20, Number(bbox.height) || 120),
      },
      prompt: layer.prompt || '',
      negativePrompt: layer.negativePrompt || '',
      content: layer.content || '',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1a1a1a',
        align: 'center',
        verticalAlign: 'middle',
        ...(layer.style || {}),
      },
      asset: layer.asset || null,
      generation: layer.generation || null,
      visible: layer.visible !== false,
      locked: !!layer.locked,
      role: null,
      status: 'brouillon',
      chromaColor: layer.chromaColor || null,
    };
    normalized.role = inferRole({ ...normalized, role: layer.role });
    normalized.status = inferStatus({ ...normalized, status: layer.status });
    if (!normalized.title) {
      normalized.title = type === 'text'
        ? (normalized.content || 'Texte').slice(0, 48)
        : (type === 'character' ? 'Personnage' : normalized.id.replace(/-/g, ' '));
    }
    if (type === 'text') {
      const Text = global.MediaStudioText;
      if (Text) {
        normalized.style = Text.normalizeTextStyle(normalized.style);
        normalized.textPath = Text.normalizeTextPath(layer.textPath);
      }
    }
    if (type === 'character') {
      const Rig = global.MediaStudioRig;
      normalized.orientation = Rig ? Rig.normalizeOrientation(layer.orientation) : { facing: 'front', view: 'eye_level' };
      normalized.rig = Rig ? Rig.normalizeRig(layer.rig) : { template: 'humanoid-simple', pose: {}, showRig: true };
      normalized.rotation = Rig ? Rig.normalizeRotation(layer.rotation) : 0;
      normalized.referenceImage = layer.referenceImage && layer.referenceImage.filename
        ? {
          filename: layer.referenceImage.filename,
          url: layer.referenceImage.url || `/api/media-studio/reference/${layer.referenceImage.filename}`,
          originalName: layer.referenceImage.originalName || '',
        }
        : null;
      normalized.role = 'object';
      normalized.status = layer.status === 'prompt_ready' ? 'prompt_ready' : 'brouillon';
    }
    return normalized;
  }

  function normalizeManifest(input) {
    const base = emptyManifest();
    if (!input || typeof input !== 'object') return base;
    const canvas = input.canvas || {};
    const manifest = {
      version: 1,
      title: input.title || base.title,
      canvas: {
        width: Number(canvas.width) || base.canvas.width,
        height: Number(canvas.height) || base.canvas.height,
        background: canvas.background || base.canvas.background,
      },
      layers: Array.isArray(input.layers)
        ? input.layers.map((l, i) => normalizeLayer(l, i))
        : [],
    };
    manifest.layers.sort((a, b) => a.zIndex - b.zIndex);
    return manifest;
  }

  class SceneEditor {
    constructor(options) {
      this.svgEl = options.svgEl;
      this.layerListEl = options.layerListEl;
      this.propsBodyEl = options.propsBodyEl;
      this.titleEl = options.titleEl;
      this.canvasSizeLabel = options.canvasSizeLabel;
      this.regenBtn = options.regenBtn;
      this.onLayerSelect = options.onLayerSelect || (() => {});
      this.onManifestChange = options.onManifestChange || (() => {});
      this.onUploadReference = options.onUploadReference || null;

      this.manifest = emptyManifest();
      this.selectedLayerId = null;
      this.drag = null;

      this.layerListEl.addEventListener('click', (e) => this.onLayerListClick(e));
      this.svgEl.addEventListener('pointerdown', (e) => this.onSvgPointerDown(e));
      window.addEventListener('pointermove', (e) => this.onPointerMove(e));
      window.addEventListener('pointerup', () => this.onPointerUp());
      if (this.titleEl) {
        this.titleEl.addEventListener('change', () => {
          this.manifest.title = this.titleEl.value.trim() || 'Sans titre';
          this.persist();
        });
      }
      if (this.regenBtn) {
        this.regenBtn.addEventListener('click', () => {
          this.flushPropsFromDom();
          if (this.onRegenerateLayer) this.onRegenerateLayer(this.getSelectedLayer(), true);
        });
      }

      this.load();
      this.render();
    }

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) this.manifest = normalizeManifest(JSON.parse(raw));
      } catch {
        this.manifest = emptyManifest();
      }
    }

    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.manifest));
      } catch { /* ignore */ }
      this.onManifestChange(this.manifest);
    }

    getSelectedLayer() {
      return this.manifest.layers.find((l) => l.id === this.selectedLayerId) || null;
    }

    setManifest(manifest) {
      this.manifest = normalizeManifest(manifest);
      if (this.titleEl) this.titleEl.value = this.manifest.title;
      this.selectedLayerId = null;
      this.render();
      this.persist();
    }

    newProject() {
      this.manifest = emptyManifest();
      this.selectedLayerId = null;
      if (this.titleEl) this.titleEl.value = this.manifest.title;
      this.render();
      this.persist();
    }

    selectLayer(id, notify = true) {
      this.selectedLayerId = id;
      this.renderLayerList();
      this.renderProps();
      this.highlightSvgSelection();
      if (this.regenBtn) {
        const layer = this.getSelectedLayer();
        this.regenBtn.disabled = !layer || (layer.type !== 'image' && layer.type !== 'character');
      }
      if (notify) this.onLayerSelect(this.getSelectedLayer());
    }

    clearSelection(notify = true) {
      this.selectedLayerId = null;
      this.renderLayerList();
      this.renderProps();
      this.highlightSvgSelection();
      if (this.regenBtn) this.regenBtn.disabled = true;
      if (notify) this.onLayerSelect(null);
    }

    addTextLayer() {
      const cw = this.manifest.canvas.width;
      const ch = this.manifest.canvas.height;
      const layer = normalizeLayer({
        type: 'text',
        zIndex: this.manifest.layers.length,
        bbox: { x: cw * 0.15, y: ch * 0.4, width: cw * 0.7, height: 80 },
        content: 'Votre texte',
        style: { fontSize: 42, align: 'center' },
        textPath: global.MediaStudioText ? global.MediaStudioText.defaultTextPath() : { preset: 'straight', strength: 55 },
      }, this.manifest.layers.length);
      this.manifest.layers.push(layer);
      this.selectLayer(layer.id);
      this.render();
      this.persist();
    }

    addCharacterLayer() {
      const Rig = global.MediaStudioRig;
      if (!Rig) return;
      const cw = this.manifest.canvas.width;
      const ch = this.manifest.canvas.height;
      const h = Math.min(520, Math.round(ch * 0.82));
      const w = Math.round(h * 0.46);
      const layer = normalizeLayer({
        type: 'character',
        title: 'Personnage',
        description: 'Squelette poseable — orientation face/dos/3/4 et vue caméra.',
        zIndex: this.manifest.layers.length,
        bbox: {
          x: Math.round((cw - w) / 2),
          y: Math.round((ch - h) / 2),
          width: w,
          height: h,
        },
        orientation: Rig.defaultOrientation(),
      }, this.manifest.layers.length);
      Rig.applyOrientation(layer);
      this.manifest.layers.push(layer);
      this.selectLayer(layer.id);
      this.render();
      this.persist();
    }

    applyLayerPatch(layerId, patch) {
      const layer = this.manifest.layers.find((l) => l.id === layerId);
      if (!layer || !patch) return false;
      if (patch.title != null) layer.title = String(patch.title);
      if (patch.description != null) layer.description = String(patch.description);
      if (patch.role != null) layer.role = patch.role;
      if (patch.status != null) layer.status = patch.status;
      if (patch.prompt != null) layer.prompt = String(patch.prompt);
      if (patch.content != null) layer.content = String(patch.content);
      if (patch.style && typeof patch.style === 'object') {
        layer.style = { ...layer.style, ...patch.style };
      }
      if (patch.bbox && typeof patch.bbox === 'object') {
        layer.bbox = { ...layer.bbox, ...patch.bbox };
      }
      if (patch.rig && typeof patch.rig === 'object' && layer.type === 'character' && global.MediaStudioRig) {
        layer.rig = global.MediaStudioRig.normalizeRig({ ...layer.rig, ...patch.rig });
      }
      if (patch.textPath && layer.type === 'text' && global.MediaStudioText) {
        layer.textPath = global.MediaStudioText.normalizeTextPath({ ...layer.textPath, ...patch.textPath });
      }
      if (patch.style && layer.type === 'text' && global.MediaStudioText) {
        layer.style = global.MediaStudioText.normalizeTextStyle({ ...layer.style, ...patch.style });
      }
      if (patch.asset) layer.asset = patch.asset;
      if (patch.referenceImage !== undefined) layer.referenceImage = patch.referenceImage;
      if (patch.generation) layer.generation = patch.generation;
      layer.status = inferStatus(layer);
      const assetOnly = Object.keys(patch).every((k) => k === 'asset' || k === 'generation');
      if (assetOnly) this.renderCanvas();
      else this.render();
      this.persist();
      return true;
    }

    /** Lit les champs Propriétés dans le DOM → manifest (avant régénération). */
    flushPropsFromDom() {
      const layer = this.getSelectedLayer();
      if (!layer) return;
      const title = document.getElementById('propTitle');
      const content = document.getElementById('propContent');
      const description = document.getElementById('propDescription');
      const prompt = document.getElementById('propPrompt');
      const role = document.getElementById('propRole');
      if (title) layer.title = title.value;
      if (content) layer.content = content.value;
      if (description) layer.description = description.value;
      const charPrompt = document.getElementById('propCharPrompt');
      if (charPrompt && layer.type === 'character') {
        layer.prompt = charPrompt.value;
        layer.status = charPrompt.value.trim().length > 8 ? 'prompt_ready' : 'brouillon';
      } else if (prompt) {
        layer.prompt = prompt.value;
        layer.status = prompt.value.trim() ? 'prompt_ready' : 'brouillon';
      }
      if (role) layer.role = role.value;
      const propRotation = document.getElementById('propRotationNum');
      if (propRotation && layer.type === 'character' && global.MediaStudioRig) {
        layer.rotation = global.MediaStudioRig.normalizeRotation(propRotation.value);
      }
      const propFacing = document.getElementById('propFacing');
      const propView = document.getElementById('propView');
      if (propFacing && propView && layer.type === 'character' && global.MediaStudioRig) {
        layer.orientation = global.MediaStudioRig.normalizeOrientation({
          facing: propFacing.value,
          view: propView.value,
        });
      }
      const chromaAuto = document.getElementById('propChromaAuto');
      const chromaColor = document.getElementById('propChromaColor');
      if (chromaAuto && chromaColor && layer.type !== 'text' && layer.role !== 'background') {
        layer.chromaColor = chromaAuto.checked ? null : chromaColor.value;
      }
      if (layer.type === 'text' && global.MediaStudioText) {
        const Text = global.MediaStudioText;
        const propFont = document.getElementById('propFontFamily');
        const propWeight = document.getElementById('propFontWeight');
        const propAlign = document.getElementById('propTextAlign');
        const propPreset = document.getElementById('propTextPreset');
        const propStrength = document.getElementById('propTextStrength');
        const propPathAlign = document.getElementById('propPathAlign');
        if (propFont) layer.style = Text.normalizeTextStyle({ ...layer.style, fontId: propFont.value });
        if (propWeight) layer.style.fontWeight = propWeight.value;
        if (propAlign) layer.style.align = propAlign.value;
        if (!layer.textPath) layer.textPath = Text.defaultTextPath();
        if (propPreset) layer.textPath.preset = propPreset.value;
        if (propStrength) layer.textPath.strength = Number(propStrength.value) || 55;
        if (propPathAlign) layer.textPath.pathAlign = propPathAlign.value;
        layer.textPath = Text.normalizeTextPath(layer.textPath);
        layer.style = Text.normalizeTextStyle(layer.style);
      }
      const nums = ['propX', 'propY', 'propW', 'propH'];
      const keys = ['x', 'y', 'width', 'height'];
      nums.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el && layer.bbox) {
          layer.bbox[keys[i]] = Math.max(i < 2 ? 0 : 20, Number(el.value) || 0);
        }
      });
      this.persist();
    }

    applyFluxPrompts(fluxPrompts) {
      if (!Array.isArray(fluxPrompts)) return 0;
      let count = 0;
      fluxPrompts.forEach((item) => {
        const layer = this.manifest.layers.find((l) => l.id === item.id);
        if (!layer || layer.type !== 'image') return;
        if (item.prompt != null) layer.prompt = String(item.prompt);
        if (item.role != null) layer.role = item.role;
        if (item.chromaColor != null && item.role !== 'background') {
          layer.chromaColor = String(item.chromaColor);
        } else if (item.role === 'background') {
          layer.chromaColor = null;
        }
        layer.status = 'prompt_ready';
        count += 1;
      });
      if (count) {
        this.render();
        this.persist();
      }
      return count;
    }

    setLayerAsset(layerId, asset, generation) {
      const ok = this.applyLayerPatch(layerId, { asset, generation });
      const layer = this.manifest.layers.find((l) => l.id === layerId);
      if (layer) {
        layer.status = 'generated';
        this.persist();
        this.renderLayerList();
      }
      return ok;
    }

    moveLayer(layerId, direction) {
      const idx = this.manifest.layers.findIndex((l) => l.id === layerId);
      if (idx < 0) return;
      const swap = direction === 'up' ? idx + 1 : idx - 1;
      if (swap < 0 || swap >= this.manifest.layers.length) return;
      const zA = this.manifest.layers[idx].zIndex;
      this.manifest.layers[idx].zIndex = this.manifest.layers[swap].zIndex;
      this.manifest.layers[swap].zIndex = zA;
      this.manifest.layers.sort((a, b) => a.zIndex - b.zIndex);
      this.render();
      this.persist();
    }

    deleteLayer(layerId) {
      this.manifest.layers = this.manifest.layers.filter((l) => l.id !== layerId);
      if (this.selectedLayerId === layerId) this.clearSelection(false);
      this.render();
      this.persist();
    }

    exportSvgString(resolveImageUrl) {
      const { width, height, background } = this.manifest.canvas;
      const layers = [...this.manifest.layers].sort((a, b) => a.zIndex - b.zIndex);
      const parts = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
        `<rect width="100%" height="100%" fill="${background}"/>`,
      ];
      layers.forEach((layer) => {
        if (!layer.visible) return;
        const { x, y, width: w, height: h } = layer.bbox;
        if (layer.type === 'text') {
          const Text = global.MediaStudioText;
          if (Text) parts.push(Text.exportTextSvg(layer, escapeXml));
          else {
            const fs = layer.style.fontSize || 32;
            const anchor = layer.style.align === 'center' ? 'middle' : (layer.style.align === 'right' ? 'end' : 'start');
            const tx = layer.style.align === 'center' ? x + w / 2 : (layer.style.align === 'right' ? x + w : x);
            const ty = y + h / 2 + fs * 0.35;
            parts.push(
              `<text x="${tx}" y="${ty}" font-family="${layer.style.fontFamily}" font-size="${fs}" font-weight="${layer.style.fontWeight}" fill="${layer.style.color}" text-anchor="${anchor}">${escapeXml(layer.content)}</text>`
            );
          }
        } else if (layer.type === 'character') {
          parts.push(exportCharacterSvg(layer));
        } else if (layer.asset && layer.asset.url) {
          const href = resolveImageUrl ? resolveImageUrl(layer.asset) : layer.asset.url;
          parts.push(`<image href="${escapeXml(href)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${imagePreserveAspectRatio(layer)}"/>`);
        } else {
          parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#e8ecf4" stroke="#9aa3b5" stroke-dasharray="6 4" rx="4"/>`);
        }
      });
      parts.push('</svg>');
      return parts.join('\n');
    }

    getGenerationSize(layer) {
      if (layer.type === 'character') {
        const { width, height } = layer.bbox || { width: 280, height: 520 };
        return fitSizeToBbox(width, height, 768, 64);
      }
      if (layer.role === 'background') {
        const { width, height } = layer.bbox || { width: 512, height: 512 };
        return fitSizeToBbox(width, height, 768, 64);
      }
      return getObjectGenSize(layer);
    }

    renderCanvas() {
      const { width, height, background } = this.manifest.canvas;
      this.svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
      if (this.canvasSizeLabel) {
        this.canvasSizeLabel.textContent = `${width} × ${height}`;
      }
      if (this.titleEl && document.activeElement !== this.titleEl) {
        this.titleEl.value = this.manifest.title;
      }

      this.svgEl.innerHTML = '';
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('width', String(width));
      bg.setAttribute('height', String(height));
      bg.setAttribute('fill', background);
      bg.dataset.sceneBg = '1';
      this.svgEl.appendChild(bg);

      const sorted = [...this.manifest.layers].sort((a, b) => a.zIndex - b.zIndex);
      sorted.forEach((layer) => {
        if (!layer.visible) return;
        const g = this.createLayerGroup(layer);
        this.svgEl.appendChild(g);
      });

      this.renderLayerList();
      this.highlightSvgSelection();
    }

    render() {
      this.renderCanvas();
      this.renderProps();
    }

    createLayerGroup(layer) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.dataset.layerId = layer.id;
      g.style.cursor = layer.locked ? 'not-allowed' : 'move';

      const { x, y, width: w, height: h } = layer.bbox;

      if (layer.type === 'text') {
        const Text = global.MediaStudioText;
        if (Text) {
          Text.appendTextLayer(g, layer, {
            showPathGuide: layer.id === this.selectedLayerId,
            showPathHandle: layer.id === this.selectedLayerId && !layer.locked,
          });
        }
      } else if (layer.type === 'character') {
        const Rig = global.MediaStudioRig;
        const inner = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const rotTransform = Rig ? Rig.characterRotateTransform(layer) : '';
        if (rotTransform) inner.setAttribute('transform', rotTransform);
        this.appendCharacterRig(inner, layer);
        g.appendChild(inner);
        if (layer.id === this.selectedLayerId && !layer.locked) {
          this.appendRotationHandle(g, layer);
        }
      } else if (layer.asset && layer.asset.filename) {
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        const v = encodeURIComponent(layer.generation?.generatedAt || layer.asset.filename);
        img.setAttribute('href', `/api/media-studio/media/${encodeURIComponent(layer.asset.filename)}?v=${v}`);
        img.setAttribute('x', String(x));
        img.setAttribute('y', String(y));
        img.setAttribute('width', String(w));
        img.setAttribute('height', String(h));
        img.setAttribute('preserveAspectRatio', imagePreserveAspectRatio(layer));
        g.appendChild(img);
      } else {
        const isBrouillon = layer.status !== 'generated';
        const placeholder = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        placeholder.setAttribute('x', String(x));
        placeholder.setAttribute('y', String(y));
        placeholder.setAttribute('width', String(w));
        placeholder.setAttribute('height', String(h));
        placeholder.setAttribute('fill', layer.role === 'background' ? '#1a2a3a' : '#252b3a');
        placeholder.setAttribute('stroke', isBrouillon ? '#f0a030' : '#6c8cff');
        placeholder.setAttribute('stroke-dasharray', isBrouillon ? '10 6' : '8 4');
        placeholder.setAttribute('stroke-width', isBrouillon ? '2' : '1');
        placeholder.setAttribute('rx', '6');
        placeholder.setAttribute('opacity', '0.92');
        g.appendChild(placeholder);

        const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        titleEl.setAttribute('x', String(x + w / 2));
        titleEl.setAttribute('y', String(y + h / 2 - 8));
        titleEl.setAttribute('text-anchor', 'middle');
        titleEl.setAttribute('fill', '#e8ecf4');
        titleEl.setAttribute('font-size', '15');
        titleEl.setAttribute('font-weight', 'bold');
        titleEl.textContent = getLayerTitle(layer);
        g.appendChild(titleEl);

        const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sub.setAttribute('x', String(x + w / 2));
        sub.setAttribute('y', String(y + h / 2 + 14));
        sub.setAttribute('text-anchor', 'middle');
        sub.setAttribute('fill', '#9aa3b5');
        sub.setAttribute('font-size', '11');
        const subLabel = layer.status === 'prompt_ready'
          ? 'Prompt Flux prêt'
          : (layer.description || (layer.role === 'background' ? 'Fond' : 'Objet')).slice(0, 50);
        sub.textContent = subLabel;
        g.appendChild(sub);
      }

      return g;
    }

    appendCharacterRig(g, layer) {
      const Rig = global.MediaStudioRig;
      if (!Rig) return;
      const rig = Rig.normalizeRig(layer.rig);
      const template = Rig.getTemplate(rig.template);
      const { x, y, width: w, height: h } = layer.bbox;
      const selected = layer.id === this.selectedLayerId;

      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      hit.setAttribute('x', String(x));
      hit.setAttribute('y', String(y));
      hit.setAttribute('width', String(w));
      hit.setAttribute('height', String(h));
      hit.setAttribute('fill', 'transparent');
      hit.classList.add('ms-rig-hit');
      g.appendChild(hit);

      if (layer.asset && layer.asset.filename) {
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        const v = encodeURIComponent(layer.generation?.generatedAt || layer.asset.filename);
        img.setAttribute('href', `/api/media-studio/media/${encodeURIComponent(layer.asset.filename)}?v=${v}`);
        img.setAttribute('x', String(x));
        img.setAttribute('y', String(y));
        img.setAttribute('width', String(w));
        img.setAttribute('height', String(h));
        img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        img.setAttribute('opacity', layer.status === 'generated' ? '0.88' : '0.35');
        g.appendChild(img);
      }

      const bboxRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bboxRect.setAttribute('x', String(x));
      bboxRect.setAttribute('y', String(y));
      bboxRect.setAttribute('width', String(w));
      bboxRect.setAttribute('height', String(h));
      bboxRect.setAttribute('fill', '#1e2433');
      bboxRect.setAttribute('fill-opacity', '0.55');
      bboxRect.setAttribute('stroke', selected ? '#6c8cff' : '#f0a030');
      bboxRect.setAttribute('stroke-dasharray', '8 5');
      bboxRect.setAttribute('stroke-width', selected ? '2' : '1.5');
      bboxRect.setAttribute('rx', '6');
      bboxRect.classList.add('ms-rig-bbox');
      g.appendChild(bboxRect);

      if (rig.showRig !== false) {
        const bonesG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        bonesG.classList.add('ms-rig-bones');
        template.bones.forEach(([jointA, jointB]) => {
          const pa = Rig.jointToCanvas(layer, jointA);
          const pb = Rig.jointToCanvas(layer, jointB);
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', String(pa.x));
          line.setAttribute('y1', String(pa.y));
          line.setAttribute('x2', String(pb.x));
          line.setAttribute('y2', String(pb.y));
          line.classList.add('ms-rig-bone');
          bonesG.appendChild(line);
        });
        g.appendChild(bonesG);

        const jointsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        jointsG.classList.add('ms-rig-joints');
        Rig.listJointIds(layer).forEach((jointId) => {
          const p = Rig.jointToCanvas(layer, jointId);
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', String(p.x));
          circle.setAttribute('cy', String(p.y));
          circle.setAttribute('r', selected ? '9' : '5');
          circle.dataset.rigJoint = jointId;
          circle.classList.add('ms-rig-joint');
          if (selected) circle.classList.add('ms-rig-joint--active');
          if (template.jointLabels && template.jointLabels[jointId]) {
            circle.dataset.jointLabel = template.jointLabels[jointId];
          }
          jointsG.appendChild(circle);
        });
        g.appendChild(jointsG);
      }

      const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      titleEl.setAttribute('x', String(x + w / 2));
      titleEl.setAttribute('y', String(y + 18));
      titleEl.setAttribute('text-anchor', 'middle');
      titleEl.setAttribute('fill', '#e8ecf4');
      titleEl.setAttribute('font-size', '13');
      titleEl.setAttribute('font-weight', 'bold');
      titleEl.setAttribute('pointer-events', 'none');
      titleEl.textContent = getLayerTitle(layer);
      g.appendChild(titleEl);

      const subEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      subEl.setAttribute('x', String(x + w / 2));
      subEl.setAttribute('y', String(y + 34));
      subEl.setAttribute('text-anchor', 'middle');
      subEl.setAttribute('fill', '#9aa3b5');
      subEl.setAttribute('font-size', '10');
      subEl.setAttribute('pointer-events', 'none');
      subEl.textContent = Rig.orientationLabel(layer.orientation);
      g.appendChild(subEl);
    }

    appendRotationHandle(g, layer) {
      const { x, y, width: w } = layer.bbox;
      const cx = x + w / 2;
      const handleY = y - 28;

      const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      stem.setAttribute('x1', String(cx));
      stem.setAttribute('y1', String(y));
      stem.setAttribute('x2', String(cx));
      stem.setAttribute('y2', String(handleY));
      stem.classList.add('ms-rig-rotate-stem');
      stem.setAttribute('pointer-events', 'none');
      g.appendChild(stem);

      const knob = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      knob.setAttribute('cx', String(cx));
      knob.setAttribute('cy', String(handleY));
      knob.setAttribute('r', '10');
      knob.dataset.rigRotate = '1';
      knob.classList.add('ms-rig-rotate-handle');
      g.appendChild(knob);
    }

    clientToCanvas(clientX, clientY) {
      const rect = this.svgEl.getBoundingClientRect();
      const scaleX = this.manifest.canvas.width / rect.width;
      const scaleY = this.manifest.canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    }

    highlightSvgSelection() {
      this.svgEl.querySelectorAll('[data-layer-id]').forEach((g) => {
        const id = g.dataset.layerId;
        const layer = this.manifest.layers.find((l) => l.id === id);
        if (!layer) return;
        let outline = g.querySelector('.ms-layer-outline');
        if (id === this.selectedLayerId && layer.type !== 'character') {
          if (!outline) {
            outline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            outline.classList.add('ms-layer-outline');
            outline.setAttribute('fill', 'none');
            outline.setAttribute('stroke', '#6c8cff');
            outline.setAttribute('stroke-width', '2');
            outline.setAttribute('pointer-events', 'none');
            g.appendChild(outline);
          }
          const { x, y, width: w, height: h } = layer.bbox;
          outline.setAttribute('x', String(x));
          outline.setAttribute('y', String(y));
          outline.setAttribute('width', String(w));
          outline.setAttribute('height', String(h));
        } else if (outline) {
          outline.remove();
        }
      });
    }

    renderLayerList() {
      this.layerListEl.innerHTML = '';
      if (!this.manifest.layers.length) {
        const li = document.createElement('li');
        li.className = 'ms-layer-empty';
        li.textContent = 'Aucun calque — étape 1 : Planifier le brouillon.';
        this.layerListEl.appendChild(li);
        return;
      }
      const sorted = [...this.manifest.layers].sort((a, b) => b.zIndex - a.zIndex);
      sorted.forEach((layer) => {
        const li = document.createElement('li');
        li.className = 'ms-layer-item';
        if (layer.id === this.selectedLayerId) li.classList.add('active');
        li.dataset.layerId = layer.id;

        const icon = layer.type === 'text'
          ? 'T'
          : (layer.type === 'character' ? '⌖' : (layer.role === 'background' ? '▤' : '▣'));
        const label = getLayerTitle(layer);
        const badge = layer.type === 'text'
          ? 'texte'
          : (layer.type === 'character'
            ? (layer.status === 'generated' ? 'généré' : (layer.status === 'prompt_ready' ? 'prompt' : 'mesh'))
            : (layer.status === 'generated' ? 'généré' : (layer.status === 'prompt_ready' ? 'prompt' : 'brouillon')));

        li.innerHTML = `
          <button type="button" class="ms-layer-select" data-action="select">
            <span class="ms-layer-icon">${icon}</span>
            <span class="ms-layer-name-wrap">
              <span class="ms-layer-name">${escapeHtml(label)}</span>
              <span class="ms-layer-badge ms-layer-badge--${badge}">${badge}</span>
            </span>
          </button>
          <div class="ms-layer-item-actions">
            <button type="button" data-action="up" title="Monter">↑</button>
            <button type="button" data-action="down" title="Descendre">↓</button>
            <button type="button" data-action="delete" title="Supprimer">×</button>
          </div>`;
        this.layerListEl.appendChild(li);
      });
    }

    renderProps() {
      const layer = this.getSelectedLayer();
      if (!layer) {
        this.propsBodyEl.innerHTML = '<p class="ms-scene-props-empty">Sélectionnez un calque pour modifier ses propriétés ou discuter avec l\'IA.</p>';
        return;
      }

      const { x, y, width, height } = layer.bbox;
      if (layer.type === 'character') {
        const Rig = global.MediaStudioRig;
        const rig = Rig ? Rig.normalizeRig(layer.rig) : null;
        const template = rig ? Rig.getTemplate(rig.template) : null;
        const orient = Rig ? Rig.normalizeOrientation(layer.orientation) : { facing: 'front', view: 'eye_level' };
        const facingOpts = Rig ? Rig.FACING_OPTIONS.map((o) => (
          `<option value="${o.id}" ${o.id === orient.facing ? 'selected' : ''}>${o.label}</option>`
        )).join('') : '';
        const viewOpts = Rig ? Rig.VIEW_OPTIONS.map((o) => (
          `<option value="${o.id}" ${o.id === orient.view ? 'selected' : ''}>${o.label}</option>`
        )).join('') : '';
        this.propsBodyEl.innerHTML = `
          <label class="ms-prop-label">Titre</label>
          <input type="text" id="propTitle" class="ms-prop-input" value="${escapeHtml(layer.title || '')}">
          <p class="ms-prop-hint">Type : <strong>Personnage (mesh)</strong> · ${template ? template.label : 'humanoid'}</p>
          <label class="ms-prop-label">Description (brouillon)</label>
          <textarea id="propDescription" class="ms-prop-input" rows="2">${escapeHtml(layer.description || '')}</textarea>
          <label class="ms-prop-label">Prompt Flux — apparence du personnage</label>
          <textarea id="propCharPrompt" class="ms-prop-input" rows="3" placeholder="Ex. : femme en tailleur bleu, cheveux courts, style réaliste…">${escapeHtml(layer.prompt || '')}</textarea>
          <p class="ms-prop-hint">Orientation (face/dos/vue) ajoutée automatiquement au prompt. Détourage chroma après génération.</p>
          <label class="ms-prop-label">Photo de référence (optionnel)</label>
          <div class="ms-prop-ref">
            ${layer.referenceImage && layer.referenceImage.filename
    ? `<div class="ms-prop-ref-preview"><img src="${escapeHtml(layer.referenceImage.url)}" alt="Référence"><button type="button" id="propRefClear" class="ms-btn ms-btn-ghost">Retirer</button></div>`
    : '<p class="ms-prop-hint">Aucune photo — génération depuis le texte seul.</p>'}
            <input type="file" id="propRefFile" class="ms-prop-ref-file" accept="image/png,image/jpeg,image/webp">
            <p class="ms-prop-hint">Photo guide pour Flux (img2img). Même pose/orientation recommandée.</p>
          </div>
          <div id="propChromaWrap" class="ms-prop-chroma">
            <label class="ms-prop-label">Fond chroma (détourage)</label>
            <label class="ms-prop-chroma-auto">
              <input type="checkbox" id="propChromaAuto" ${!layer.chromaColor ? 'checked' : ''}>
              Auto — couleur hors palette du sujet
            </label>
            <div class="ms-prop-chroma-row">
              <input type="color" id="propChromaColor" class="ms-prop-color" value="${layer.chromaColor || '#FF00FF'}" ${!layer.chromaColor ? 'disabled' : ''}>
              <span class="ms-prop-chroma-swatch" style="background:${layer.chromaColor || 'transparent'}"></span>
              <span class="ms-prop-chroma-label">${layer.chromaColor ? layer.chromaColor : 'auto'}</span>
            </div>
            <p class="ms-prop-hint">Cette couleur est envoyée à Flux puis retirée par le serveur. Ne doit pas être dans le personnage.</p>
          </div>
          <label class="ms-prop-label">Orientation du corps</label>
          <select id="propFacing" class="ms-prop-input">${facingOpts}</select>
          <p class="ms-prop-hint">Face, dos, profil ou 3/4 — le personnage tourne sur lui-même.</p>
          <label class="ms-prop-label">Vue caméra</label>
          <select id="propView" class="ms-prop-input">${viewOpts}</select>
          <p class="ms-prop-hint">Niveau des yeux, plongée, vue du dessus… Change le squelette de référence.</p>
          <label class="ms-prop-label">Position (x, y, w, h)</label>
          <div class="ms-prop-grid">
            <input type="number" id="propX" value="${x}"><input type="number" id="propY" value="${y}">
            <input type="number" id="propW" value="${width}"><input type="number" id="propH" value="${height}">
          </div>
          <label class="ms-prop-label">Rotation sur la scène (°)</label>
          <div class="ms-prop-rotate-row">
            <input type="range" id="propRotation" class="ms-prop-rotate-slider" min="-180" max="180" step="1" value="${layer.rotation || 0}">
            <input type="number" id="propRotationNum" class="ms-prop-rotate-num" min="-180" max="180" step="1" value="${layer.rotation || 0}">
          </div>
          <div class="ms-prop-rotate-quick">
            <button type="button" id="propRotM90" class="ms-btn ms-btn-ghost">↺ 90°</button>
            <button type="button" id="propRot0" class="ms-btn ms-btn-ghost">0°</button>
            <button type="button" id="propRotP90" class="ms-btn ms-btn-ghost">↻ 90°</button>
          </div>
          <p class="ms-prop-hint">Rotation scène = incliner le calque sur le canvas (distinct de face/dos).</p>
          <label class="ms-prop-chroma-auto">
            <input type="checkbox" id="propShowRig" ${rig && rig.showRig !== false ? 'checked' : ''}>
            Afficher le squelette
          </label>
          <button type="button" id="propResetPose" class="ms-btn ms-btn-secondary ms-prop-reset-pose">Réinitialiser pose + orientation</button>
          <p class="ms-prop-hint ms-prop-size">${Rig ? Rig.orientationLabel(orient) : ''} · longueurs des os conservées · poignée bleue = rotation scène.</p>`;
        this.bindProp('propTitle', 'input', (v) => { layer.title = v; }, { refresh: 'listOnBlur' });
        this.bindProp('propDescription', 'input', (v) => { layer.description = v; });
        this.bindProp('propCharPrompt', 'input', (v) => {
          layer.prompt = v;
          layer.status = v.trim().length > 8 ? 'prompt_ready' : 'brouillon';
        }, { refresh: 'listOnBlur' });
        const refFile = document.getElementById('propRefFile');
        const refClear = document.getElementById('propRefClear');
        if (refFile) {
          refFile.addEventListener('change', async () => {
            const file = refFile.files && refFile.files[0];
            if (!file || !this.onUploadReference) return;
            try {
              const ref = await this.onUploadReference(file);
              layer.referenceImage = ref;
              this.persist();
              this.renderProps();
            } catch (err) {
              console.error(err);
            }
            refFile.value = '';
          });
        }
        if (refClear) {
          refClear.addEventListener('click', () => {
            layer.referenceImage = null;
            this.persist();
            this.renderProps();
          });
        }
        const applyOrient = (patch) => {
          if (!Rig) return;
          Rig.applyOrientation(layer, patch);
          this.persist();
          this.render();
        };
        const propFacing = document.getElementById('propFacing');
        const propView = document.getElementById('propView');
        if (propFacing) propFacing.addEventListener('change', () => applyOrient({ facing: propFacing.value }));
        if (propView) propView.addEventListener('change', () => applyOrient({ view: propView.value }));
        const chromaAuto = document.getElementById('propChromaAuto');
        const chromaColor = document.getElementById('propChromaColor');
        if (chromaAuto && chromaColor) {
          chromaAuto.addEventListener('change', () => {
            chromaColor.disabled = chromaAuto.checked;
            layer.chromaColor = chromaAuto.checked ? null : chromaColor.value;
            this.persist();
            this.renderProps();
          });
          chromaColor.addEventListener('input', () => {
            if (!chromaAuto.checked) {
              layer.chromaColor = chromaColor.value;
              this.persist();
            }
          });
        }
        const rotSlider = document.getElementById('propRotation');
        const rotNum = document.getElementById('propRotationNum');
        const syncRotation = (val) => {
          if (!Rig) return;
          layer.rotation = Rig.normalizeRotation(val);
          if (rotSlider && document.activeElement !== rotSlider) rotSlider.value = String(layer.rotation);
          if (rotNum && document.activeElement !== rotNum) rotNum.value = String(layer.rotation);
          this.persist();
          this.renderCanvas();
        };
        if (rotSlider) rotSlider.addEventListener('input', () => syncRotation(rotSlider.value));
        if (rotNum) rotNum.addEventListener('change', () => syncRotation(rotNum.value));
        const rotM90 = document.getElementById('propRotM90');
        const rot0 = document.getElementById('propRot0');
        const rotP90 = document.getElementById('propRotP90');
        if (rotM90) rotM90.addEventListener('click', () => syncRotation((layer.rotation || 0) - 90));
        if (rot0) rot0.addEventListener('click', () => syncRotation(0));
        if (rotP90) rotP90.addEventListener('click', () => syncRotation((layer.rotation || 0) + 90));
        const showRig = document.getElementById('propShowRig');
        if (showRig) {
          showRig.addEventListener('change', () => {
            if (!layer.rig) layer.rig = Rig.defaultCharacterRig();
            layer.rig.showRig = showRig.checked;
            this.persist();
            this.renderCanvas();
          });
        }
        const resetPose = document.getElementById('propResetPose');
        if (resetPose && Rig) {
          resetPose.addEventListener('click', () => {
            Rig.resetPose(layer);
            this.persist();
            this.render();
          });
        }
        ['propX', 'propY', 'propW', 'propH'].forEach((id, i) => {
          const keys = ['x', 'y', 'width', 'height'];
          this.bindProp(id, 'change', (v) => {
            layer.bbox[keys[i]] = Math.max(i < 2 ? 0 : 20, Number(v) || 0);
          }, { refresh: 'canvas' });
        });
      } else if (layer.type === 'text') {
        const Text = global.MediaStudioText;
        const tp = Text ? Text.normalizeTextPath(layer.textPath) : { preset: 'straight', strength: 55, pathAlign: 'middle' };
        const st = Text ? Text.normalizeTextStyle(layer.style) : layer.style;
        const fontOpts = Text ? Text.FONT_OPTIONS.map((f) => (
          `<option value="${f.id}" ${f.id === st.fontId ? 'selected' : ''}>${f.label}</option>`
        )).join('') : '';
        const presetOpts = Text ? Object.entries(Text.PRESETS).map(([id, p]) => (
          `<option value="${id}" ${id === tp.preset ? 'selected' : ''}>${p.label}</option>`
        )).join('') : '';
        const curved = Text && Text.isCurved(tp);
        this.propsBodyEl.innerHTML = `
          <label class="ms-prop-label">Titre calque</label>
          <input type="text" id="propTitle" class="ms-prop-input" value="${escapeHtml(layer.title || '')}">
          <label class="ms-prop-label">Contenu</label>
          <textarea id="propContent" class="ms-prop-input" rows="2">${escapeHtml(layer.content)}</textarea>
          <label class="ms-prop-label">Police</label>
          <select id="propFontFamily" class="ms-prop-input">${fontOpts}</select>
          <div class="ms-prop-grid ms-prop-grid--2">
            <div>
              <label class="ms-prop-label">Taille</label>
              <input type="number" id="propFontSize" class="ms-prop-input" value="${st.fontSize || 32}" min="8" max="200">
            </div>
            <div>
              <label class="ms-prop-label">Graisse</label>
              <select id="propFontWeight" class="ms-prop-input">
                <option value="bold" ${st.fontWeight === 'bold' ? 'selected' : ''}>Gras</option>
                <option value="normal" ${st.fontWeight === 'normal' ? 'selected' : ''}>Normal</option>
              </select>
            </div>
          </div>
          <label class="ms-prop-label">Couleur</label>
          <input type="color" id="propColor" class="ms-prop-color" value="${st.color || '#1a1a1a'}">
          <label class="ms-prop-label">Forme du texte</label>
          <select id="propTextPreset" class="ms-prop-input">${presetOpts}</select>
          <div id="propTextCurveOpts" ${curved ? '' : 'hidden'}>
            <label class="ms-prop-label">Courbure (${tp.strength}%)</label>
            <input type="range" id="propTextStrength" class="ms-prop-rotate-slider" min="5" max="100" step="1" value="${tp.strength}">
            <label class="ms-prop-label">Position sur le chemin</label>
            <select id="propPathAlign" class="ms-prop-input">
              <option value="start" ${tp.pathAlign === 'start' ? 'selected' : ''}>Début</option>
              <option value="middle" ${tp.pathAlign === 'middle' ? 'selected' : ''}>Centre</option>
              <option value="end" ${tp.pathAlign === 'end' ? 'selected' : ''}>Fin</option>
            </select>
            <p class="ms-prop-hint">Poignée orange sur la courbe : glisser pour ajuster la courbure.</p>
          </div>
          <label class="ms-prop-label">Alignement (ligne droite)</label>
          <select id="propTextAlign" class="ms-prop-input" ${curved ? 'disabled' : ''}>
            <option value="left" ${st.align === 'left' ? 'selected' : ''}>Gauche</option>
            <option value="center" ${st.align === 'center' ? 'selected' : ''}>Centre</option>
            <option value="right" ${st.align === 'right' ? 'selected' : ''}>Droite</option>
          </select>
          <label class="ms-prop-label">Position (x, y, w, h)</label>
          <div class="ms-prop-grid">
            <input type="number" id="propX" value="${x}"><input type="number" id="propY" value="${y}">
            <input type="number" id="propW" value="${width}"><input type="number" id="propH" value="${height}">
          </div>`;
        this.bindProp('propTitle', 'input', (v) => { layer.title = v; }, { refresh: 'listOnBlur' });
        this.bindProp('propContent', 'input', (v) => { layer.content = v; }, { refresh: 'canvas' });
        this.bindProp('propFontSize', 'change', (v) => { layer.style.fontSize = Number(v) || 32; }, { refresh: 'canvas' });
        this.bindProp('propColor', 'input', (v) => { layer.style.color = v; }, { refresh: 'canvas' });
        const syncTextStyle = () => {
          if (!Text) return;
          layer.style = Text.normalizeTextStyle(layer.style);
          this.persist();
          this.renderCanvas();
        };
        const propFont = document.getElementById('propFontFamily');
        const propWeight = document.getElementById('propFontWeight');
        const propAlign = document.getElementById('propTextAlign');
        if (propFont) propFont.addEventListener('change', () => {
          layer.style.fontId = propFont.value;
          syncTextStyle();
        });
        if (propWeight) propWeight.addEventListener('change', () => {
          layer.style.fontWeight = propWeight.value;
          syncTextStyle();
        });
        if (propAlign) propAlign.addEventListener('change', () => {
          layer.style.align = propAlign.value;
          syncTextStyle();
        });
        const propPreset = document.getElementById('propTextPreset');
        const propStrength = document.getElementById('propTextStrength');
        const propPathAlign = document.getElementById('propPathAlign');
        const curveOpts = document.getElementById('propTextCurveOpts');
        const syncTextPath = () => {
          if (!Text) return;
          if (!layer.textPath) layer.textPath = Text.defaultTextPath();
          layer.textPath = Text.normalizeTextPath(layer.textPath);
          this.persist();
          this.render();
        };
        if (propPreset) propPreset.addEventListener('change', () => {
          layer.textPath = layer.textPath || Text.defaultTextPath();
          layer.textPath.preset = propPreset.value;
          syncTextPath();
        });
        if (propStrength) propStrength.addEventListener('input', () => {
          layer.textPath = layer.textPath || Text.defaultTextPath();
          layer.textPath.strength = Number(propStrength.value) || 55;
          this.persist();
          this.renderCanvas();
        });
        if (propPathAlign) propPathAlign.addEventListener('change', () => {
          layer.textPath = layer.textPath || Text.defaultTextPath();
          layer.textPath.pathAlign = propPathAlign.value;
          syncTextPath();
        });
        ['propX', 'propY', 'propW', 'propH'].forEach((id, i) => {
          const keys = ['x', 'y', 'width', 'height'];
          this.bindProp(id, 'change', (v) => {
            layer.bbox[keys[i]] = Math.max(i < 2 ? 0 : 20, Number(v) || 0);
          }, { refresh: 'canvas' });
        });
      } else {
        const roleLabel = layer.role === 'background' ? 'Fond (image pleine)' : 'Objet (détourage auto)';
        this.propsBodyEl.innerHTML = `
          <label class="ms-prop-label">Titre</label>
          <input type="text" id="propTitle" class="ms-prop-input" value="${escapeHtml(layer.title || '')}">
          <p class="ms-prop-hint">État : <strong>${layer.status}</strong> · ${roleLabel}</p>
          <label class="ms-prop-label">Description (brouillon)</label>
          <textarea id="propDescription" class="ms-prop-input" rows="2">${escapeHtml(layer.description || '')}</textarea>
          <label class="ms-prop-label">Prompt Flux (étape 2)</label>
          <textarea id="propPrompt" class="ms-prop-input" rows="3" placeholder="Généré à l'étape « Prompts Flux »…">${escapeHtml(layer.prompt)}</textarea>
          <label class="ms-prop-label">Rôle</label>
          <select id="propRole" class="ms-prop-input">
            <option value="object" ${layer.role === 'object' ? 'selected' : ''}>Objet superposable</option>
            <option value="background" ${layer.role === 'background' ? 'selected' : ''}>Fond / décor</option>
          </select>
          <div id="propChromaWrap" class="ms-prop-chroma" ${layer.role === 'background' ? 'hidden' : ''}>
            <label class="ms-prop-label">Fond chroma (détourage)</label>
            <label class="ms-prop-chroma-auto">
              <input type="checkbox" id="propChromaAuto" ${!layer.chromaColor ? 'checked' : ''}>
              Auto — couleur hors palette du sujet
            </label>
            <div class="ms-prop-chroma-row">
              <input type="color" id="propChromaColor" class="ms-prop-color" value="${layer.chromaColor || '#FF00FF'}" ${!layer.chromaColor ? 'disabled' : ''}>
              <span class="ms-prop-chroma-swatch" style="background:${layer.chromaColor || 'transparent'}"></span>
            </div>
            <p class="ms-prop-hint">Flux dessine le sujet sur ce fond uni ; le serveur retire ensuite cette couleur. Ne doit pas apparaître dans l'objet.</p>
          </div>
          <label class="ms-prop-label">Position (x, y, w, h)</label>
          <div class="ms-prop-grid">
            <input type="number" id="propX" value="${x}"><input type="number" id="propY" value="${y}">
            <input type="number" id="propW" value="${width}"><input type="number" id="propH" value="${height}">
          </div>
          <p class="ms-prop-hint">${layer.asset ? 'Image générée.' : 'Étape 3 : Générer Flux pour produire l\'image.'}</p>
          <p class="ms-prop-hint ms-prop-size">${formatLayerSizeHint(layer)}</p>`;
        this.bindProp('propTitle', 'input', (v) => { layer.title = v; }, { refresh: 'listOnBlur' });
        this.bindProp('propDescription', 'input', (v) => { layer.description = v; });
        this.bindProp('propPrompt', 'input', (v) => {
          layer.prompt = v;
          layer.status = v.trim() ? 'prompt_ready' : 'brouillon';
        }, { refresh: 'listOnBlur' });
        this.bindProp('propRole', 'change', (v) => {
          layer.role = v;
          if (v === 'background') layer.chromaColor = null;
        }, { refresh: 'full' });
        const chromaAuto = document.getElementById('propChromaAuto');
        const chromaColor = document.getElementById('propChromaColor');
        if (chromaAuto && chromaColor) {
          chromaAuto.addEventListener('change', () => {
            chromaColor.disabled = chromaAuto.checked;
            layer.chromaColor = chromaAuto.checked ? null : chromaColor.value;
            this.persist();
            this.renderProps();
          });
          chromaColor.addEventListener('input', () => {
            if (!chromaAuto.checked) {
              layer.chromaColor = chromaColor.value;
              this.persist();
            }
          });
        }
        ['propX', 'propY', 'propW', 'propH'].forEach((id, i) => {
          const keys = ['x', 'y', 'width', 'height'];
          this.bindProp(id, 'change', (v) => {
            layer.bbox[keys[i]] = Math.max(i < 2 ? 0 : 20, Number(v) || 0);
          }, { refresh: 'canvas' });
        });
      }
    }

    bindProp(id, eventName, apply, options = {}) {
      const el = document.getElementById(id);
      if (!el) return;
      const refresh = options.refresh || 'none';

      const onEdit = () => {
        apply(el.value);
        this.persist();
        if (refresh === 'canvas') this.renderCanvas();
        else if (refresh === 'full') this.render();
        else if (refresh === 'list') this.renderLayerList();
      };

      el.addEventListener(eventName, onEdit);

      if (refresh === 'listOnBlur') {
        el.addEventListener('blur', () => {
          this.renderLayerList();
        });
      }
    }

    onLayerListClick(e) {
      const btn = e.target.closest('button');
      if (!btn) return;
      const li = e.target.closest('.ms-layer-item');
      if (!li) return;
      const layerId = li.dataset.layerId;
      const action = btn.dataset.action;
      if (action === 'select') this.selectLayer(layerId);
      else if (action === 'up') this.moveLayer(layerId, 'up');
      else if (action === 'down') this.moveLayer(layerId, 'down');
      else if (action === 'delete') this.deleteLayer(layerId);
    }

    onSvgPointerDown(e) {
      if (e.target.dataset.sceneBg === '1') {
        this.clearSelection();
        return;
      }

      const rotateEl = e.target.closest('[data-rig-rotate]');
      if (rotateEl) {
        const g = rotateEl.closest('[data-layer-id]');
        if (!g) return;
        const layer = this.manifest.layers.find((l) => l.id === g.dataset.layerId);
        if (!layer || layer.locked || layer.type !== 'character') return;
        this.selectLayer(layer.id);
        const pt = this.clientToCanvas(e.clientX, e.clientY);
        const c = global.MediaStudioRig.getBboxCenter(layer);
        this.drag = {
          mode: 'rotate',
          layerId: layer.id,
          pointerId: e.pointerId,
          origRotation: layer.rotation || 0,
          startPointerAngle: Math.atan2(pt.y - c.y, pt.x - c.x) * (180 / Math.PI),
        };
        rotateEl.setPointerCapture(e.pointerId);
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      const textPathCtrl = e.target.closest('[data-text-path-control]');
      if (textPathCtrl) {
        const g = textPathCtrl.closest('[data-layer-id]');
        if (!g) return;
        const layer = this.manifest.layers.find((l) => l.id === g.dataset.layerId);
        if (!layer || layer.locked || layer.type !== 'text') return;
        this.selectLayer(layer.id);
        this.drag = {
          mode: 'textPath',
          layerId: layer.id,
          pointerId: e.pointerId,
        };
        textPathCtrl.setPointerCapture(e.pointerId);
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      const jointEl = e.target.closest('[data-rig-joint]');
      if (jointEl) {
        const g = jointEl.closest('[data-layer-id]');
        if (!g) return;
        const layer = this.manifest.layers.find((l) => l.id === g.dataset.layerId);
        if (!layer || layer.locked || layer.type !== 'character') return;
        this.selectLayer(layer.id);
        const Rig = global.MediaStudioRig;
        this.drag = {
          mode: 'joint',
          layerId: layer.id,
          jointId: jointEl.dataset.rigJoint,
          pointerId: e.pointerId,
          rigSnapshot: Rig ? Rig.captureDragSnapshot(layer) : null,
        };
        jointEl.setPointerCapture(e.pointerId);
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      const g = e.target.closest('[data-layer-id]');
      if (!g) return;
      const layer = this.manifest.layers.find((l) => l.id === g.dataset.layerId);
      if (!layer || layer.locked) return;
      this.selectLayer(layer.id);
      if (layer.locked) return;
      this.drag = {
        mode: 'layer',
        layerId: layer.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: layer.bbox.x,
        origY: layer.bbox.y,
        pointerId: e.pointerId,
      };
      g.setPointerCapture(e.pointerId);
      e.preventDefault();
    }

    onPointerMove(e) {
      if (!this.drag || e.pointerId !== this.drag.pointerId) return;
      const layer = this.manifest.layers.find((l) => l.id === this.drag.layerId);
      if (!layer) return;

      if (this.drag.mode === 'textPath' && layer.type === 'text' && global.MediaStudioText) {
        const Text = global.MediaStudioText;
        const pt = this.clientToCanvas(e.clientX, e.clientY);
        if (!layer.textPath) layer.textPath = Text.defaultTextPath();
        layer.textPath.strength = Text.strengthFromControlY(
          layer.bbox,
          layer.textPath.preset,
          pt.y
        );
        layer.textPath = Text.normalizeTextPath(layer.textPath);
        this.renderCanvas();
        const propStrength = document.getElementById('propTextStrength');
        if (propStrength) propStrength.value = String(layer.textPath.strength);
        return;
      }

      if (this.drag.mode === 'joint' && layer.type === 'character' && global.MediaStudioRig) {
        const pt = this.clientToCanvas(e.clientX, e.clientY);
        global.MediaStudioRig.applyJointDrag(
          layer,
          this.drag.jointId,
          pt.x,
          pt.y,
          this.drag.rigSnapshot
        );
        this.renderCanvas();
        return;
      }

      if (this.drag.mode === 'rotate' && layer.type === 'character' && global.MediaStudioRig) {
        const pt = this.clientToCanvas(e.clientX, e.clientY);
        const c = global.MediaStudioRig.getBboxCenter(layer);
        const angle = Math.atan2(pt.y - c.y, pt.x - c.x) * (180 / Math.PI);
        layer.rotation = global.MediaStudioRig.normalizeRotation(
          this.drag.origRotation + (angle - this.drag.startPointerAngle)
        );
        this.renderCanvas();
        return;
      }

      if (this.drag.mode !== 'layer') return;
      const rect = this.svgEl.getBoundingClientRect();
      const scaleX = this.manifest.canvas.width / rect.width;
      const scaleY = this.manifest.canvas.height / rect.height;
      const dx = (e.clientX - this.drag.startX) * scaleX;
      const dy = (e.clientY - this.drag.startY) * scaleY;
      layer.bbox.x = Math.round(this.drag.origX + dx);
      layer.bbox.y = Math.round(this.drag.origY + dy);
      this.render();
    }

    onPointerUp() {
      if (this.drag) {
        this.drag = null;
        this.persist();
      }
    }
  }

  function detectObjectKind(layer) {
    const prompt = String(layer.prompt || '').trim().toLowerCase();
    if (prompt) {
      if (/drapeau|french flag|tricolore|tricolor|français|france flag/.test(prompt)) return 'french-flag';
      return 'generic';
    }
    const t = `${layer.id || ''} ${layer.title || ''} ${layer.description || ''}`.toLowerCase();
    if (/drapeau|french flag|tricolore|tricolor|français|france flag|flag-fr/.test(t)) return 'french-flag';
    return 'generic';
  }

  function getObjectGenSize(layer) {
    const kind = detectObjectKind(layer);
    if (kind === 'french-flag') return fitSizeToBbox(3, 2, 768, 64);
    return fitSizeToBbox(1, 1, 768, 64);
  }

  function imagePreserveAspectRatio(layer) {
    return layer.role === 'background' ? 'xMidYMid slice' : 'xMidYMid meet';
  }

  function formatLayerSizeHint(layer) {
    if (layer.role === 'background') {
      const gen = fitSizeToBbox(layer.bbox.width, layer.bbox.height, 768, 64);
      return `Fond : calque ${Math.round(layer.bbox.width)}×${Math.round(layer.bbox.height)} → Flux ${gen.width}×${gen.height}`;
    }
    const gen = getObjectGenSize(layer);
    const kind = detectObjectKind(layer);
    const label = kind === 'french-flag' ? 'objet drapeau (ratio 3:2)' : 'objet (ratio carré)';
    if (layer.generation && layer.generation.width) {
      return `${label} · généré ${layer.generation.width}×${layer.generation.height} · affiché dans la bbox`;
    }
    const chroma = layer.chromaColor ? `fond chroma ${layer.chromaColor}` : 'fond chroma auto (hors sujet)';
    return `${label} → Flux ${gen.width}×${gen.height} · ${chroma} puis détourage`;
  }

  function exportCharacterSvg(layer) {
    const Rig = global.MediaStudioRig;
    if (!Rig) return '';
    const rig = Rig.normalizeRig(layer.rig);
    const template = Rig.getTemplate(rig.template);
    const { x, y, width: w, height: h } = layer.bbox;
    const lines = [
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#9aa3b5" stroke-dasharray="6 4" rx="4"/>`,
    ];
    if (rig.showRig !== false) {
      template.bones.forEach(([jointA, jointB]) => {
        const pa = Rig.jointToCanvas(layer, jointA);
        const pb = Rig.jointToCanvas(layer, jointB);
        lines.push(`<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="#6c8cff" stroke-width="3" stroke-linecap="round"/>`);
      });
      Rig.listJointIds(layer).forEach((jointId) => {
        const p = Rig.jointToCanvas(layer, jointId);
        lines.push(`<circle cx="${p.x}" cy="${p.y}" r="6" fill="#f0a030" stroke="#1a1a1a" stroke-width="1"/>`);
      });
    }
    const body = lines.join('\n');
    const rot = Rig.characterRotateTransform(layer);
    if (rot) return `<g transform="${rot}">${body}</g>`;
    return body;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeXml(s) {
    return escapeHtml(s);
  }

  global.MediaStudioScene = {
    SceneEditor,
    emptyManifest,
    normalizeManifest,
    parseJsonFromText,
    getLayerTitle,
    inferRole,
    fitSizeToBbox,
  };
  if (global.MediaStudioText) {
    global.MediaStudioScene.Text = global.MediaStudioText;
  }
})(window);
