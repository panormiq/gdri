/**
 * Onglet Extraction — import planche IA, cadre de sélection, détourage fond damier.
 */
(function (global) {
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  class ExtractEditor {
    constructor(options) {
      this.stageEl = options.stageEl;
      this.previewEl = options.previewEl;
      this.savedListEl = options.savedListEl;
      this.dropZoneEl = options.dropZoneEl || options.stageEl;
      this.cropInputs = options.cropInputs || {};
      this.onStatus = options.onStatus || (() => {});
      this.onBusy = options.onBusy || (() => {});
      this.onImportFile = options.onImportFile || null;
      this.onAnimateAsset = options.onAnimateAsset || null;

      this.source = null;
      this.crop = null;
      this.result = null;
      this.layout = { scale: 1, ox: 0, oy: 0, dw: 0, dh: 0 };
      this.drag = null;

      this.imgEl = null;
      this.overlayEl = null;
      this.cropRectEl = null;

      if (this.stageEl) {
        this.stageEl.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.stageEl.addEventListener('pointermove', (e) => this.onPointerMove(e));
        this.stageEl.addEventListener('pointerup', (e) => this.onPointerUp(e));
        this.stageEl.addEventListener('pointercancel', (e) => this.onPointerUp(e));
      }
      window.addEventListener('resize', () => this.renderOverlay());
      this.bindDropZone();
    }

    bindDropZone() {
      const zones = [this.dropZoneEl, this.stageEl].filter(Boolean);
      const seen = new Set();
      zones.forEach((zone) => {
        if (seen.has(zone)) return;
        seen.add(zone);

        zone.addEventListener('dragenter', (e) => {
          e.preventDefault();
          zone.classList.add('ms-extract-stage--drag');
        });
        zone.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          zone.classList.add('ms-extract-stage--drag');
        });
        zone.addEventListener('dragleave', (e) => {
          if (e.currentTarget.contains(e.relatedTarget)) return;
          zone.classList.remove('ms-extract-stage--drag');
        });
        zone.addEventListener('drop', (e) => {
          e.preventDefault();
          zone.classList.remove('ms-extract-stage--drag');
          const file = e.dataTransfer.files && e.dataTransfer.files[0];
          if (!file) return;
          if (this.onImportFile) this.onImportFile(file);
        });
      });
    }

    setSource(data) {
      this.source = {
        filename: data.filename,
        url: data.url,
        width: data.width,
        height: data.height,
        originalName: data.originalName || data.filename,
      };
      this.result = null;
      this.renderPreview(null);

      const margin = 0.12;
      const w = this.source.width;
      const h = this.source.height;
      const cw = Math.round(w * (1 - margin * 2));
      const ch = Math.round(h * (1 - margin * 2));
      this.crop = {
        x: Math.round((w - cw) / 2),
        y: Math.round((h - ch) / 2),
        width: cw,
        height: ch,
      };
      this.syncCropInputs();
      this.renderStage();
    }

    getCrop() {
      if (!this.crop || !this.source) return null;
      return {
        x: clamp(Math.round(this.crop.x), 0, this.source.width - 1),
        y: clamp(Math.round(this.crop.y), 0, this.source.height - 1),
        width: clamp(Math.round(this.crop.width), 20, this.source.width),
        height: clamp(Math.round(this.crop.height), 20, this.source.height),
      };
    }

    setCropFromInputs() {
      if (!this.source) return;
      const c = this.getCrop() || {};
      const keys = ['x', 'y', 'width', 'height'];
      keys.forEach((key) => {
        const el = this.cropInputs[key];
        if (!el) return;
        const v = Number(el.value);
        if (Number.isFinite(v)) c[key] = v;
      });
      c.width = clamp(c.width, 20, this.source.width);
      c.height = clamp(c.height, 20, this.source.height);
      c.x = clamp(c.x, 0, this.source.width - c.width);
      c.y = clamp(c.y, 0, this.source.height - c.height);
      this.crop = c;
      this.renderOverlay();
    }

    syncCropInputs() {
      if (!this.crop) return;
      Object.entries(this.cropInputs).forEach(([key, el]) => {
        if (el && this.crop[key] != null) el.value = String(Math.round(this.crop[key]));
      });
    }

    computeLayout() {
      if (!this.source) return this.layout;
      const rect = this.stageEl.getBoundingClientRect();
      const stageW = Math.max(rect.width, 200);
      const stageH = Math.max(rect.height, 200);
      const scale = Math.min(stageW / this.source.width, stageH / this.source.height);
      const dw = this.source.width * scale;
      const dh = this.source.height * scale;
      this.layout = {
        scale,
        ox: (stageW - dw) / 2,
        oy: (stageH - dh) / 2,
        dw,
        dh,
        stageW,
        stageH,
      };
      return this.layout;
    }

    imageToDisplay(crop) {
      const { scale, ox, oy } = this.computeLayout();
      return {
        x: ox + crop.x * scale,
        y: oy + crop.y * scale,
        width: crop.width * scale,
        height: crop.height * scale,
      };
    }

    displayToImage(px, py) {
      const { scale, ox, oy } = this.layout;
      return {
        x: (px - ox) / scale,
        y: (py - oy) / scale,
      };
    }

    renderStage() {
      this.stageEl.innerHTML = '';
      if (!this.source) {
        this.stageEl.innerHTML = '';
        const empty = document.createElement('p');
        empty.className = 'ms-extract-empty ms-extract-drop-hint';
        empty.innerHTML = 'Glissez-déposez une image ici<br><span>ou utilisez « Importer image »</span>';
        this.stageEl.appendChild(empty);
        return;
      }

      const wrap = document.createElement('div');
      wrap.className = 'ms-extract-stage-inner';
      wrap.style.width = '100%';
      wrap.style.height = '100%';

      this.imgEl = document.createElement('img');
      this.imgEl.className = 'ms-extract-img';
      this.imgEl.src = `${this.source.url}?v=${encodeURIComponent(this.source.filename)}`;
      this.imgEl.alt = this.source.originalName;
      this.imgEl.draggable = false;
      this.imgEl.addEventListener('load', () => this.renderOverlay());

      this.overlayEl = document.createElement('div');
      this.overlayEl.className = 'ms-extract-overlay';

      this.cropRectEl = document.createElement('div');
      this.cropRectEl.className = 'ms-extract-crop';
      ['nw', 'ne', 'sw', 'se'].forEach((h) => {
        const handle = document.createElement('span');
        handle.className = `ms-extract-handle ms-extract-handle--${h}`;
        handle.dataset.handle = h;
        this.cropRectEl.appendChild(handle);
      });
      this.overlayEl.appendChild(this.cropRectEl);

      wrap.appendChild(this.imgEl);
      wrap.appendChild(this.overlayEl);
      this.stageEl.appendChild(wrap);
      this.renderOverlay();
    }

    renderOverlay() {
      if (!this.source || !this.crop || !this.cropRectEl || !this.imgEl) return;
      const { stageW, stageH, ox, oy, dw, dh } = this.computeLayout();
      if (this.overlayEl) {
        this.overlayEl.style.width = `${stageW}px`;
        this.overlayEl.style.height = `${stageH}px`;
      }
      if (this.imgEl) {
        this.imgEl.style.width = `${dw}px`;
        this.imgEl.style.height = `${dh}px`;
        this.imgEl.style.left = `${ox}px`;
        this.imgEl.style.top = `${oy}px`;
      }
      const d = this.imageToDisplay(this.crop);
      this.cropRectEl.style.left = `${d.x}px`;
      this.cropRectEl.style.top = `${d.y}px`;
      this.cropRectEl.style.width = `${d.width}px`;
      this.cropRectEl.style.height = `${d.height}px`;
    }

    renderPreview(data) {
      if (!this.previewEl) return;
      this.previewEl.innerHTML = '';
      if (!data) {
        const p = document.createElement('p');
        p.className = 'ms-extract-empty';
        p.textContent = 'L\'aperçu apparaît après extraction.';
        this.previewEl.appendChild(p);
        return;
      }
      const meta = document.createElement('p');
      meta.className = 'ms-extract-meta';
      meta.textContent = `${data.width}×${data.height} · fond ${data.background_mode || '—'}`;
      const img = document.createElement('img');
      img.className = 'ms-extract-preview-img';
      img.src = `${data.url}?v=${encodeURIComponent(data.generatedAt || data.filename)}`;
      img.alt = data.title || 'Objet extrait';
      this.previewEl.appendChild(meta);
      this.previewEl.appendChild(img);
    }

    addSavedItem(data) {
      if (!this.savedListEl) return;
      const empty = this.savedListEl.querySelector('.ms-extract-empty');
      if (empty) empty.remove();
      const li = document.createElement('li');
      li.className = 'ms-extract-saved-item';
      li.innerHTML = `
        <img src="${data.url}?v=${encodeURIComponent(data.filename)}" alt="">
        <div class="ms-extract-saved-info">
          <span>${data.title || data.filename}</span>
          <small>${data.width}×${data.height}</small>
        </div>
        <button type="button" class="ms-btn ms-btn-ghost ms-extract-animate-btn">Animer</button>
        <a href="${data.downloadUrl || data.url}" class="ms-btn ms-btn-ghost" download>Télécharger</a>`;
      const animateBtn = li.querySelector('.ms-extract-animate-btn');
      if (animateBtn && this.onAnimateAsset) {
        animateBtn.addEventListener('click', () => this.onAnimateAsset(data));
      }
      this.savedListEl.prepend(li);
    }

    setResult(data) {
      this.result = data;
      this.renderPreview(data);
      this.addSavedItem(data);
    }

    stagePoint(e) {
      const rect = this.stageEl.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    onPointerDown(e) {
      if (!this.source || !this.crop) return;
      const handle = e.target.closest('[data-handle]');
      const cropHit = e.target.closest('.ms-extract-crop');
      if (!handle && !cropHit) return;

      const pt = this.stagePoint(e);
      const cropDisplay = this.imageToDisplay(this.crop);
      this.drag = {
        mode: handle ? 'resize' : 'move',
        handle: handle ? handle.dataset.handle : null,
        pointerId: e.pointerId,
        startPt: pt,
        origCrop: { ...this.crop },
        origDisplay: cropDisplay,
      };
      (handle || this.cropRectEl).setPointerCapture(e.pointerId);
      e.preventDefault();
    }

    onPointerMove(e) {
      if (!this.drag || e.pointerId !== this.drag.pointerId || !this.source) return;
      const pt = this.stagePoint(e);
      const dx = (pt.x - this.drag.startPt.x) / this.layout.scale;
      const dy = (pt.y - this.drag.startPt.y) / this.layout.scale;
      const o = this.drag.origCrop;

      if (this.drag.mode === 'move') {
        this.crop = {
          ...o,
          x: clamp(o.x + dx, 0, this.source.width - o.width),
          y: clamp(o.y + dy, 0, this.source.height - o.height),
        };
      } else {
        let { x, y, width, height } = o;
        const h = this.drag.handle;
        if (h.includes('e')) width = o.width + dx;
        if (h.includes('s')) height = o.height + dy;
        if (h.includes('w')) {
          x = o.x + dx;
          width = o.width - dx;
        }
        if (h.includes('n')) {
          y = o.y + dy;
          height = o.height - dy;
        }
        width = clamp(width, 40, this.source.width);
        height = clamp(height, 40, this.source.height);
        x = clamp(x, 0, this.source.width - width);
        y = clamp(y, 0, this.source.height - height);
        this.crop = { x, y, width, height };
      }
      this.syncCropInputs();
      this.renderOverlay();
    }

    onPointerUp(e) {
      if (!this.drag || e.pointerId !== this.drag.pointerId) return;
      this.drag = null;
    }
  }

  global.MediaStudioExtract = { ExtractEditor };
})(window);
