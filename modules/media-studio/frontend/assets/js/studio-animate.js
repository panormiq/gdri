/**
 * Scène animation — calques, cadres temporels, zone de sortie OBS.
 */
(function (global) {
  const MAX_DURATION = 120;
  const DEFAULT_DURATION = 20;
  const DEFAULT_OUTPUT = { x: 240, y: 135, width: 1920, height: 1080 };
  const DEFAULT_WORKSPACE = { width: 2400, height: 1350 };
  const DEFAULT_BG = '#141820';

  function KF() {
    return global.MediaStudioKeyframes || null;
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function degToRad(deg) {
    return (deg || 0) * (Math.PI / 180);
  }

  function getLayerRotation(layer) {
    return Number(layer.rotation) || 0;
  }

  function localToGlobal(layer, lx, ly) {
    const w = layer.width;
    const h = layer.height;
    const cx = layer.x + w / 2;
    const cy = layer.y + h / 2;
    const rot = degToRad(getLayerRotation(layer));
    const rx = lx - w / 2;
    const ry = ly - h / 2;
    return {
      x: cx + Math.cos(rot) * rx - Math.sin(rot) * ry,
      y: cy + Math.sin(rot) * rx + Math.cos(rot) * ry,
    };
  }

  function globalToLocal(layer, gx, gy) {
    const w = layer.width;
    const h = layer.height;
    const cx = layer.x + w / 2;
    const cy = layer.y + h / 2;
    const rot = degToRad(getLayerRotation(layer));
    const dx = gx - cx;
    const dy = gy - cy;
    const cos = Math.cos(-rot);
    const sin = Math.sin(-rot);
    const rx = cos * dx - sin * dy;
    const ry = sin * dx + cos * dy;
    return { x: rx + w / 2, y: ry + h / 2 };
  }

  function setLayerSizeWithAnchor(layer, anchorLocal, anchorGlobal, newW, newH) {
    const min = 24;
    layer.width = Math.max(min, Math.round(newW));
    layer.height = Math.max(min, Math.round(newH));
    const rot = degToRad(getLayerRotation(layer));
    const rx = anchorLocal.x - layer.width / 2;
    const ry = anchorLocal.y - layer.height / 2;
    const cx = anchorGlobal.x - (Math.cos(rot) * rx - Math.sin(rot) * ry);
    const cy = anchorGlobal.y - (Math.sin(rot) * rx + Math.cos(rot) * ry);
    layer.x = Math.round(cx - layer.width / 2);
    layer.y = Math.round(cy - layer.height / 2);
  }

  const HANDLE_ANCHORS = {
    nw: { x: 1, y: 1 },
    n: { x: 0.5, y: 1 },
    ne: { x: 0, y: 1 },
    e: { x: 0, y: 0.5 },
    se: { x: 0, y: 0 },
    s: { x: 0.5, y: 0 },
    sw: { x: 1, y: 0 },
    w: { x: 1, y: 0.5 },
  };

  function applyResizeFromPointer(layer, handleId, pt, transform) {
    const { orig, anchorGlobal } = transform;
    const workLayer = {
      ...layer,
      x: orig.x,
      y: orig.y,
      width: orig.width,
      height: orig.height,
      rotation: orig.rotation,
    };
    const local = globalToLocal(workLayer, pt.x, pt.y);
    const spec = HANDLE_ANCHORS[handleId];
    if (!spec) return;

    let newW = orig.width;
    let newH = orig.height;

    if (handleId === 'se') {
      newW = local.x;
      newH = local.y;
    } else if (handleId === 'nw') {
      newW = orig.width - local.x;
      newH = orig.height - local.y;
    } else if (handleId === 'ne') {
      newW = local.x;
      newH = orig.height - local.y;
    } else if (handleId === 'sw') {
      newW = orig.width - local.x;
      newH = local.y;
    } else if (handleId === 'e') {
      newW = local.x;
      newH = orig.height;
    } else if (handleId === 'w') {
      newW = orig.width - local.x;
      newH = orig.height;
    } else if (handleId === 's') {
      newW = orig.width;
      newH = local.y;
    } else if (handleId === 'n') {
      newW = orig.width;
      newH = orig.height - local.y;
    }

    const anchorLocal = {
      x: spec.x * newW,
      y: spec.y * newH,
    };
    setLayerSizeWithAnchor(layer, anchorLocal, anchorGlobal, newW, newH);
  }

  const TRANSFORM_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'rotate'];

  function hitLayerAtPoint(layers, pt) {
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const l = layers[i];
      if (!l.img) continue;
      const local = globalToLocal(l, pt.x, pt.y);
      if (local.x >= 0 && local.x <= l.width && local.y >= 0 && local.y <= l.height) return l;
    }
    return null;
  }

  function defaultCadres(durationSec) {
    const half = durationSec / 2;
    return [
      { id: uid('cadre'), label: 'Cadre 1', start: 0, end: half },
      { id: uid('cadre'), label: 'Cadre 2', start: half, end: durationSec },
    ];
  }

  function getCadreAtTime(scene, tSec) {
    const hit = (scene.cadres || []).find((c) => tSec >= c.start && tSec < c.end);
    if (hit) return hit;
    const list = scene.cadres || [];
    return list.length ? list[list.length - 1] : { id: '_', start: 0, end: 1 };
  }

  function getLayerZones(layer, cadreId) {
    if (!layer.zonesByCadre) layer.zonesByCadre = {};
    if (cadreId && layer.zonesByCadre[cadreId]) return layer.zonesByCadre[cadreId];
    if (Array.isArray(layer.zones) && layer.zones.length) return layer.zones;
    return [];
  }

  function pickMimeType(preferObsAlpha) {
    const types = preferObsAlpha
      ? ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm']
      : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    return types.find((t) => {
      try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
    }) || 'video/webm';
  }

  function crc32(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i += 1) {
      c ^= buf[i];
      for (let k = 0; k < 8; k += 1) {
        c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
      }
    }
    return (~c) >>> 0;
  }

  function le16(n) { return Uint8Array.from([n & 255, (n >> 8) & 255]); }
  function le32(n) { return Uint8Array.from([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]); }

  function concatParts(parts) {
    const total = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    parts.forEach((p) => { out.set(p, o); o += p.length; });
    return out;
  }

  function buildZipStore(entries) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    entries.forEach(({ name, data }) => {
      const nameBytes = enc.encode(name);
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length + data.length);
      local.set([0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 0, 0], 0);
      local.set(le32(crc), 14);
      local.set(le32(data.length), 18);
      local.set(le32(data.length), 22);
      local.set(le16(nameBytes.length), 26);
      local.set(nameBytes, 30);
      local.set(data, 30 + nameBytes.length);
      parts.push(local);
      central.push({ nameBytes, crc, size: data.length, offset });
      offset += local.length;
    });
    const centralStart = offset;
    central.forEach(({ nameBytes, crc, size, offset: off }) => {
      const cen = new Uint8Array(46 + nameBytes.length);
      cen.set([0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0], 0);
      cen.set(le32(crc), 16);
      cen.set(le32(size), 20);
      cen.set(le32(size), 24);
      cen.set(le16(nameBytes.length), 28);
      cen.set(le32(off), 42);
      cen.set(nameBytes, 46);
      parts.push(cen);
      offset += cen.length;
    });
    const end = new Uint8Array(22);
    end.set([0x50, 0x4b, 0x05, 0x06], 0);
    end.set(le16(central.length), 8);
    end.set(le16(central.length), 10);
    end.set(le32(offset - centralStart), 12);
    end.set(le32(centralStart), 16);
    parts.push(end);
    return new Blob([concatParts(parts)], { type: 'application/zip' });
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function loadImage(url, filename) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image illisible'));
      img.src = `${url}?v=${encodeURIComponent(filename || url)}`;
    });
  }

  function getLayerFullEffects(layer, cadreId) {
    if (!layer.fullEffectsByCadre) return [];
    return layer.fullEffectsByCadre[cadreId] || [];
  }

  function getLayerVideoClip(layer, cadreId) {
    if (!layer.videoClipsByCadre || !cadreId) return null;
    return layer.videoClipsByCadre[cadreId] || null;
  }

  async function loadVideoClip(url) {
    const blobUrlFromFetch = async () => {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`Clip HTTP ${res.status}`);
      const blob = await res.blob();
      if (!blob.size) throw new Error('Clip vide');
      return URL.createObjectURL(blob);
    };

    const attachVideo = (src, revoke) => new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.onloadedmetadata = () => resolve({ video, revoke });
      video.onerror = () => {
        if (revoke) URL.revokeObjectURL(revoke);
        reject(new Error('Clip vidéo illisible.'));
      };
      video.src = src;
    });

    try {
      const blobUrl = await blobUrlFromFetch();
      const { video } = await attachVideo(blobUrl, blobUrl);
      video._blobUrl = blobUrl;
      return video;
    } catch (_) {
      const { video } = await attachVideo(url, null);
      return video;
    }
  }

  function seekVideoTo(video, timeSec) {
    const dur = video.duration || 2;
    const t = Math.max(0, Math.min(timeSec, dur - 0.034));
    if (Math.abs(video.currentTime - t) < 0.025) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        video.removeEventListener('seeked', done);
        resolve();
      };
      video.addEventListener('seeked', done);
      video.currentTime = t;
      setTimeout(resolve, 180);
    });
  }

  function syncVideoClipTime(clip, localT) {
    if (!clip || !clip.video) return;
    const dur = clip.duration || clip.video.duration || 2;
    const t = localT % dur;
    if (clip.video.readyState >= 2 && Math.abs(clip.video.currentTime - t) > 0.04) {
      clip.video.currentTime = Math.min(t, dur - 0.034);
    }
  }

  async function syncSceneVideos(scene, tSec) {
    const tasks = [];
    const K = KF();
    (scene.layers || []).forEach((layer) => {
      if (!layer.img) return;
      const ltx = K ? K.getLtxEffectAt(layer, tSec) : null;
      if (ltx && ltx.video) {
        const localT = tSec - (Number(ltx.start) || 0);
        const dur = ltx.duration || ltx.video.duration || 2;
        tasks.push(seekVideoTo(ltx.video, Math.min(localT, dur - 0.034)));
        return;
      }
      const assignedCadre = layer.cadreId
        ? (scene.cadres || []).find((c) => c.id === layer.cadreId)
        : getCadreAtTime(scene, tSec);
      if (!assignedCadre || tSec < assignedCadre.start || tSec >= assignedCadre.end) return;
      const clip = getLayerVideoClip(layer, assignedCadre.id);
      if (!clip || !clip.video) return;
      const localT = tSec - assignedCadre.start;
      const dur = clip.duration || clip.video.duration || 2;
      tasks.push(seekVideoTo(clip.video, localT % dur));
    });
    await Promise.all(tasks);
  }

  function easeInOut(u) {
    const t = clamp(u, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function getCameraState(scene, tSec, durationSec) {
    const cam = scene.camera;
    if (!cam || !cam.enabled) return { dx: 0, dy: 0, scale: 1 };
    const e = easeInOut(tSec / Math.max(0.001, durationSec));
    return {
      dx: (Number(cam.panX) || 0) * e,
      dy: (Number(cam.panY) || 0) * e,
      scale: 1 + (Number(cam.zoom) || 0) * e,
    };
  }

  function getLayerTravelOffset(layer, cadre, tSec) {
    if (!layer.travelByCadre || !cadre) return { x: 0, y: 0 };
    const travel = layer.travelByCadre[cadre.id];
    if (!travel) return { x: 0, y: 0 };
    const localDur = Math.max(0.1, cadre.end - cadre.start);
    const e = easeInOut((tSec - cadre.start) / localDur);
    return {
      x: (Number(travel.dx) || 0) * e,
      y: (Number(travel.dy) || 0) * e,
    };
  }

  function applyFullEffectTransform(ctx, w, h, effect, tSec, durationSec) {
    const speed = effect.speed || 1;
    const phase = (tSec / durationSec) * speed * Math.PI * 2;
    switch (effect.type) {
      case 'pulse': {
        const s = 1 + (effect.amount || 0.04) * Math.sin(phase);
        ctx.translate(w / 2, h / 2);
        ctx.scale(s, s);
        ctx.translate(-w / 2, -h / 2);
        break;
      }
      case 'float':
        ctx.translate(0, Math.sin(phase) * (effect.amount || 8));
        break;
      case 'shake':
        ctx.translate(
          Math.sin(phase * 3.2) * (effect.amount || 3),
          Math.cos(phase * 2.1) * (effect.amount || 2) * 0.6
        );
        break;
      case 'rotate':
        ctx.translate(w / 2, h / 2);
        ctx.rotate(((effect.amount || 5) * Math.PI) / 180 * Math.sin(phase));
        ctx.translate(-w / 2, -h / 2);
        break;
      default:
        break;
    }
  }

  function renderLayerContent(ctx, img, zones, fullEffects, tSec, durationSec, animateEffects) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (animateEffects && fullEffects && fullEffects.length) {
      fullEffects.forEach((eff) => applyFullEffectTransform(ctx, w, h, eff, tSec, durationSec));
    }
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
    if (!animateEffects) return;
    if (zones.length) {
      zones.filter((z) => z.type === 'button').forEach((z, i) => drawButtonZone(ctx, img, z, tSec, durationSec, i));
      zones.filter((z) => z.type === 'glow').forEach((z, i) => drawGlowZone(ctx, img, z, tSec, durationSec, i));
    }
  }

  function drawGlowZone(ctx, img, zone, tSec, durationSec, index) {
    const { x, y, width, height } = zone;
    const phase = (tSec / durationSec) * 3 * (zone.speed || 1) * Math.PI * 2 + (zone.phase ?? index * 0.7);
    const intensity = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(phase));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.drawImage(img, x, y, width, height, x, y, width, height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255, 190, 90, ${0.12 + intensity * 0.38})`;
    ctx.fillRect(x, y, width, height);
    ctx.shadowColor = `rgba(255, 210, 120, ${0.35 + intensity * 0.55})`;
    ctx.shadowBlur = 4 + intensity * 22;
    ctx.drawImage(img, x, y, width, height, x, y, width, height);
    ctx.restore();
  }

  function drawButtonZone(ctx, img, zone, tSec, durationSec, index) {
    const { x, y, width, height } = zone;
    const phase = (tSec / durationSec) * 4 * (zone.speed || 1) * Math.PI * 2 + (zone.phase ?? index * 1.4);
    const press = Math.max(0, Math.sin(phase));
    const dy = press * (zone.depth || 5);
    const scale = 1 - press * 0.05;
    const cx = x + width / 2;
    const cy = y + height / 2;
    ctx.save();
    ctx.clearRect(x - 2, y - 2, width + 4, height + dy + 4);
    ctx.translate(cx, cy + dy * 0.5);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.drawImage(img, x, y, width, height, x, y, width, height);
    ctx.restore();
  }

  function renderComposedFrame(ctx, scene, tSec, durationSec, options = {}) {
    const ws = scene.workspace;
    const out = scene.output;
    const crop = options.cropOutput === true;
    const cw = crop ? out.width : ws.width;
    const ch = crop ? out.height : ws.height;
    const K = KF();

    if (options.transparent) ctx.clearRect(0, 0, cw, ch);
    else {
      ctx.fillStyle = scene.background || DEFAULT_BG;
      ctx.fillRect(0, 0, cw, ch);
    }

    ctx.save();
    if (crop) ctx.translate(-out.x, -out.y);

    (scene.layers || []).forEach((layer) => {
      if (!layer.img || !layer.img.complete) return;
      const iw = layer.img.naturalWidth;
      const ih = layer.img.naturalHeight;

      const ltx = K ? K.getLtxEffectAt(layer, tSec) : null;
      // Pendant l'effet LTX : pose figée au début (évite double motion / couture)
      const poseT = ltx ? (Number(ltx.start) || 0) : tSec;
      let pose;
      if (options.liveLayerId && options.liveLayerId === layer.id) {
        pose = {
          x: layer.x, y: layer.y, width: layer.width, height: layer.height,
          rotation: getLayerRotation(layer),
        };
      } else if (K) {
        pose = K.getLayerPoseAt(layer, poseT);
      } else {
        pose = {
          x: layer.x, y: layer.y, width: layer.width, height: layer.height,
          rotation: getLayerRotation(layer),
        };
      }

      const assignedCadre = layer.cadreId
        ? (scene.cadres || []).find((c) => c.id === layer.cadreId)
        : getCadreAtTime(scene, tSec);
      const zones = assignedCadre ? getLayerZones(layer, assignedCadre.id) : [];
      const fullEffects = assignedCadre ? getLayerFullEffects(layer, assignedCadre.id) : [];
      const videoClip = !ltx && assignedCadre ? getLayerVideoClip(layer, assignedCadre.id) : null;
      const inWindow = assignedCadre && tSec >= assignedCadre.start && tSec < assignedCadre.end;
      const localDur = assignedCadre ? Math.max(0.1, assignedCadre.end - assignedCadre.start) : 1;
      const localT = inWindow ? tSec - assignedCadre.start : 0;
      const animate = !ltx && inWindow && (videoClip || zones.length > 0 || fullEffects.length > 0);

      ctx.save();
      const rot = pose.rotation || 0;
      const cx = pose.x + pose.width / 2;
      const cy = pose.y + pose.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(degToRad(rot));
      ctx.translate(-pose.width / 2, -pose.height / 2);
      ctx.scale(pose.width / iw, pose.height / ih);

      if (ltx && ltx.video) {
        const localLtx = tSec - (Number(ltx.start) || 0);
        syncVideoClipTime(ltx, localLtx);
        if (ltx.video.readyState >= 2) {
          ctx.drawImage(ltx.video, 0, 0, iw, ih);
        } else {
          ctx.drawImage(layer.img, 0, 0, iw, ih);
        }
      } else if (animate && videoClip && videoClip.video) {
        syncVideoClipTime(videoClip, localT);
        if (videoClip.video.readyState >= 2) {
          ctx.drawImage(videoClip.video, 0, 0, iw, ih);
        } else {
          ctx.drawImage(layer.img, 0, 0, iw, ih);
        }
      } else {
        renderLayerContent(ctx, layer.img, zones, fullEffects, localT, localDur, animate);
      }
      ctx.restore();
    });
    ctx.restore();
  }

  function splitCadresEvenly(scene, durationSec) {
    const n = Math.max(1, (scene.cadres || []).length);
    const seg = durationSec / n;
    scene.cadres.forEach((c, i) => {
      c.start = i * seg;
      c.end = (i + 1) * seg;
    });
  }

  function assignLayersToCadres(scene) {
    (scene.layers || []).forEach((layer, i) => {
      const c = scene.cadres[i % scene.cadres.length];
      if (c) layer.cadreId = c.id;
    });
  }

  function isMechanicalMotionPrompt(text) {
    return /pisto|tir|feu|balle|chargeur|cartouch|magazine|bouton|couliss|gliss|gâchette|gachette|recul|arme/i.test(String(text || ''));
  }

  class AnimationEditor {
    constructor(options) {
      this.stageEl = options.stageEl;
      this.zoneListEl = options.zoneListEl;
      this.layerListEl = options.layerListEl;
      this.cadreListEl = options.cadreListEl;
      this.assetListEl = options.assetListEl;
      this.toolGlowBtn = options.toolGlowBtn;
      this.toolButtonBtn = options.toolButtonBtn;
      this.toolMoveBtn = options.toolMoveBtn;
      this.toolDeleteBtn = options.toolDeleteBtn;
      this.playBtn = options.playBtn;
      this.exportBtn = options.exportBtn;
      this.exportFormatSelect = options.exportFormatSelect;
      this.durationInput = options.durationInput;
      this.workspaceWInput = options.workspaceWInput;
      this.workspaceHInput = options.workspaceHInput;
      this.outputWInput = options.outputWInput;
      this.outputHInput = options.outputHInput;
      this.outputXInput = options.outputXInput;
      this.outputYInput = options.outputYInput;
      this.addCadreBtn = options.addCadreBtn;
      this.splitCadresBtn = options.splitCadresBtn;
      this.assignCadresBtn = options.assignCadresBtn;
      this.promptPanelEl = options.promptPanelEl;
      this.promptInputEl = options.promptInputEl;
      this.promptLlmCheckEl = options.promptLlmCheckEl;
      this.promptGenerateBtn = options.promptGenerateBtn;
      this.i2vGenerateBtn = options.i2vGenerateBtn;
      this.addKeyframeBtn = options.addKeyframeBtn || null;
      this.playheadInput = options.playheadInput || null;
      this.playheadLabel = options.playheadLabel || null;
      this.keyframeListEl = options.keyframeListEl || null;
      /** 'objects' = flux extract/zones/LTX cadre · 'clip' = générer + keyframes + LTX playhead */
      this.workflow = options.workflow === 'clip' ? 'clip' : 'objects';
      this.panelId = options.panelId || (this.workflow === 'clip' ? 'panel-clip' : 'panel-animate');
      this.onGeneratePrompt = options.onGeneratePrompt || null;
      this.onDeleteAsset = options.onDeleteAsset || null;
      this.onSelectionChange = options.onSelectionChange || null;
      this.msApi = options.msApi || ((p) => p);
      this.parseApiResponse = options.parseApiResponse || ((r) => r.json());
      this.onStatus = options.onStatus || (() => {});

      const dur = DEFAULT_DURATION;
      this.scene = {
        workspace: { ...DEFAULT_WORKSPACE },
        output: { ...DEFAULT_OUTPUT },
        background: DEFAULT_BG,
        cadres: defaultCadres(dur),
        layers: [],
      };
      this.activeLayerId = null;
      this.activeCadreId = this.scene.cadres[0] ? this.scene.cadres[0].id : null;
      this.selectedZoneId = null;
      this.tool = 'move';
      this.playing = false;
      this.rafId = null;
      this.playStart = 0;
      this.playheadSec = 0;
      this.drawDrag = null;
      this.layerTransform = null;
      this.viewZoom = 1;
      this.viewPanX = 0;
      this.viewPanY = 0;
      this.layout = { scale: 1, ox: 0, oy: 0 };
      this.knownAssets = new Set();
      this.scene.camera = { enabled: false, panX: 0, panY: 0, zoom: 0 };

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'ms-animate-canvas';
      this.ctx = this.canvas.getContext('2d', { alpha: true });
      this.exportCanvas = document.createElement('canvas');
      this.exportCtx = this.exportCanvas.getContext('2d', { alpha: true });
      this.overlay = document.createElement('div');
      this.overlay.className = 'ms-animate-overlay';
      this.zoomBadge = document.createElement('div');
      this.zoomBadge.className = 'ms-animate-zoom-badge';
      this.zoomBadge.title = 'Ctrl+molette · Ctrl+0 réinitialiser';
      this.stageInner = null;

      if (this.stageEl) {
        this.stageEl.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'ms-animate-stage-inner';
        this.stageInner = wrap;
        wrap.appendChild(this.canvas);
        wrap.appendChild(this.overlay);
        wrap.appendChild(this.zoomBadge);
        this.stageEl.appendChild(wrap);
      }

      if (this.durationInput) this.durationInput.value = String(dur);
      this.syncInputsFromScene();
      this.bindTools();
      this.bindCanvasEvents();
      this.bindViewControls();
      this.bindSceneInputs();
      this.resizeCanvas();
      this.renderCadreList();
      this.syncPlayheadUi();
      this.renderKeyframeList();
      window.addEventListener('resize', () => this.layoutCanvas());
    }

    syncInputsFromScene() {
      const s = this.scene;
      if (this.workspaceWInput) this.workspaceWInput.value = String(s.workspace.width);
      if (this.workspaceHInput) this.workspaceHInput.value = String(s.workspace.height);
      if (this.outputWInput) this.outputWInput.value = String(s.output.width);
      if (this.outputHInput) this.outputHInput.value = String(s.output.height);
      if (this.outputXInput) this.outputXInput.value = String(s.output.x);
      if (this.outputYInput) this.outputYInput.value = String(s.output.y);
    }

    bindTools() {
      if (this.toolGlowBtn) this.toolGlowBtn.addEventListener('click', () => this.setTool('glow'));
      if (this.toolButtonBtn) this.toolButtonBtn.addEventListener('click', () => this.setTool('button'));
      if (this.toolMoveBtn) this.toolMoveBtn.addEventListener('click', () => this.setTool('move'));
      if (this.toolDeleteBtn) this.toolDeleteBtn.addEventListener('click', () => this.deleteSelectedZone());
      if (this.playBtn) this.playBtn.addEventListener('click', () => this.togglePlay());
      if (this.exportBtn) this.exportBtn.addEventListener('click', () => this.exportAnimation());
      if (this.addCadreBtn) this.addCadreBtn.addEventListener('click', () => this.addCadre());
      if (this.splitCadresBtn) this.splitCadresBtn.addEventListener('click', () => this.resplitCadres());
      if (this.assignCadresBtn) this.assignCadresBtn.addEventListener('click', () => {
        assignLayersToCadres(this.scene);
        this.renderLayerList();
        this.onStatus('Chaque calque est assigné à un cadre (1→cadre1, 2→cadre2…).');
      });
      if (this.promptGenerateBtn) {
        this.promptGenerateBtn.addEventListener('click', () => this.generateActiveLayerPrompt());
      }
      if (this.i2vGenerateBtn) {
        this.i2vGenerateBtn.addEventListener('click', () => this.generateActiveLayerI2v());
      }
      if (this.addKeyframeBtn) {
        this.addKeyframeBtn.addEventListener('click', () => this.addKeyframeAtPlayhead());
      }
      if (this.playheadInput) {
        this.playheadInput.addEventListener('input', () => {
          this.setPlayhead(Number(this.playheadInput.value) || 0, { paint: true });
        });
      }
    }

    bindSceneInputs() {
      const apply = () => {
        const dur = this.getDurationSec();
        this.scene.workspace.width = clamp(Number(this.workspaceWInput?.value) || DEFAULT_WORKSPACE.width, 400, 5000);
        this.scene.workspace.height = clamp(Number(this.workspaceHInput?.value) || DEFAULT_WORKSPACE.height, 300, 5000);
        this.scene.output.width = clamp(Number(this.outputWInput?.value) || DEFAULT_OUTPUT.width, 160, 3840);
        this.scene.output.height = clamp(Number(this.outputHInput?.value) || DEFAULT_OUTPUT.height, 120, 2160);
        this.scene.output.x = Number(this.outputXInput?.value) || 0;
        this.scene.output.y = Number(this.outputYInput?.value) || 0;
        splitCadresEvenly(this.scene, dur);
        this.syncInputsFromScene();
        this.resizeCanvas();
        this.layoutCanvas();
        this.renderCadreList();
        this.paintFrame(0);
      };
      [this.workspaceWInput, this.workspaceHInput, this.outputWInput, this.outputHInput,
        this.outputXInput, this.outputYInput].forEach((el) => {
        if (el) el.addEventListener('change', apply);
      });
      if (this.durationInput) {
        this.durationInput.addEventListener('change', () => {
          const dur = this.getDurationSec();
          splitCadresEvenly(this.scene, dur);
          if (this.playheadInput) {
            this.playheadInput.max = String(dur);
          }
          this.setPlayhead(Math.min(this.playheadSec, dur), { paint: true });
          this.renderCadreList();
          this.renderLayerList();
          this.renderKeyframeList();
        });
      }
    }

    bindCanvasEvents() {
      this.overlay.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      this.overlay.addEventListener('pointermove', (e) => this.onPointerMove(e));
      this.overlay.addEventListener('pointerup', (e) => this.onPointerUp(e));
      this.overlay.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    }

    bindViewControls() {
      const target = this.stageEl || this.stageInner;
      if (!target) return;
      target.addEventListener('wheel', (e) => this.onViewWheel(e), { passive: false });
      window.addEventListener('keydown', (e) => {
        if (!this.isViewActive()) return;
        if (e.ctrlKey && (e.key === '0' || e.code === 'Numpad0')) {
          e.preventDefault();
          this.resetView();
        }
      });
      this.updateZoomBadge();
    }

    isViewActive() {
      const panel = document.getElementById(this.panelId || 'panel-animate');
      return panel && panel.classList.contains('active');
    }

    resetView() {
      this.viewZoom = 1;
      this.viewPanX = 0;
      this.viewPanY = 0;
      this.layoutCanvas();
      this.onStatus('Zoom réinitialisé.');
    }

    onViewWheel(e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = this.stageEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { ox, oy, scale, baseScale, stageW, stageH } = this.layout;
      const wx = (mx - ox) / scale;
      const wy = (my - oy) / scale;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = clamp(this.viewZoom * factor, 0.15, 8);
      const w = this.scene.workspace.width;
      const h = this.scene.workspace.height;
      const newScale = baseScale * newZoom;
      const dw = w * newScale;
      const dh = h * newScale;
      const newOx = mx - wx * newScale;
      const newOy = my - wy * newScale;
      this.viewZoom = newZoom;
      this.viewPanX = newOx - (stageW - dw) / 2;
      this.viewPanY = newOy - (stageH - dh) / 2;
      this.layoutCanvas();
    }

    updateZoomBadge() {
      if (!this.zoomBadge) return;
      const pct = Math.round(this.viewZoom * 100);
      this.zoomBadge.textContent = `${pct}%`;
      this.zoomBadge.hidden = Math.abs(this.viewZoom - 1) < 0.02
        && Math.abs(this.viewPanX) < 2
        && Math.abs(this.viewPanY) < 2;
    }

    getDurationSec() {
      const v = this.durationInput ? Number(this.durationInput.value) : DEFAULT_DURATION;
      return clamp(Number.isFinite(v) ? v : DEFAULT_DURATION, 3, MAX_DURATION);
    }

    getActiveLayer() {
      return this.scene.layers.find((l) => l.id === this.activeLayerId) || null;
    }

    getActiveCadre() {
      return (this.scene.cadres || []).find((c) => c.id === this.activeCadreId) || this.scene.cadres[0];
    }

    setTool(tool) {
      this.tool = tool;
      if (this.toolGlowBtn) this.toolGlowBtn.classList.toggle('active', tool === 'glow');
      if (this.toolButtonBtn) this.toolButtonBtn.classList.toggle('active', tool === 'button');
      if (this.toolMoveBtn) this.toolMoveBtn.classList.toggle('active', tool === 'move');
    }

    addCadre() {
      const dur = this.getDurationSec();
      const last = this.scene.cadres[this.scene.cadres.length - 1];
      const start = last ? last.end : 0;
      if (start >= dur - 0.5) {
        this.onStatus('Durée totale insuffisante pour un cadre supplémentaire.');
        return;
      }
      const c = { id: uid('cadre'), label: `Cadre ${this.scene.cadres.length + 1}`, start, end: dur };
      this.scene.cadres.push(c);
      this.activeCadreId = c.id;
      this.renderCadreList();
      this.onStatus(`${c.label} ajouté (${start}–${dur} s).`);
    }

    resplitCadres() {
      splitCadresEvenly(this.scene, this.getDurationSec());
      this.renderCadreList();
      this.onStatus('Cadres répartis uniformément sur la durée totale.');
    }

    removeCadre(cadreId) {
      if (this.scene.cadres.length <= 1) return;
      this.scene.cadres = this.scene.cadres.filter((c) => c.id !== cadreId);
      this.scene.layers.forEach((layer) => {
        if (layer.cadreId === cadreId) layer.cadreId = this.scene.cadres[0].id;
        if (layer.zonesByCadre) delete layer.zonesByCadre[cadreId];
      });
      if (this.activeCadreId === cadreId) this.activeCadreId = this.scene.cadres[0].id;
      splitCadresEvenly(this.scene, this.getDurationSec());
      this.renderCadreList();
      this.renderLayerList();
      this.renderZoneList();
    }

    renderCadreList() {
      if (!this.cadreListEl) return;
      const dur = this.getDurationSec();
      this.cadreListEl.innerHTML = '';
      this.scene.cadres.forEach((c, i) => {
        const li = document.createElement('li');
        li.className = 'ms-animate-cadre-item';
        if (c.id === this.activeCadreId) li.classList.add('selected');
        li.innerHTML = `
          <div class="ms-animate-cadre-head">
            <strong>${c.label || `Cadre ${i + 1}`}</strong>
            <button type="button" class="ms-btn ms-btn-ghost ms-animate-cadre-remove" title="Supprimer">×</button>
          </div>
          <div class="ms-animate-cadre-timing">
            <label>Début <input type="number" class="ms-cadre-start" min="0" max="${dur}" step="0.5" value="${c.start}"></label>
            <label>Fin <input type="number" class="ms-cadre-end" min="0.5" max="${dur}" step="0.5" value="${c.end}"></label>
          </div>`;
        li.addEventListener('click', (e) => {
          if (e.target.closest('input') || e.target.closest('.ms-animate-cadre-remove')) return;
          this.activeCadreId = c.id;
          this.renderCadreList();
          this.renderZoneList();
          this.renderZonesOverlay();
          this.updatePromptPanel();
        });
        li.querySelector('.ms-animate-cadre-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeCadre(c.id);
        });
        const sync = () => {
          c.start = clamp(Number(li.querySelector('.ms-cadre-start').value) || 0, 0, dur);
          c.end = clamp(Number(li.querySelector('.ms-cadre-end').value) || dur, c.start + 0.5, dur);
          li.querySelector('.ms-cadre-start').value = String(c.start);
          li.querySelector('.ms-cadre-end').value = String(c.end);
          this.paintFrame(this.getEditTimeSec());
        };
        li.querySelector('.ms-cadre-start').addEventListener('change', sync);
        li.querySelector('.ms-cadre-end').addEventListener('change', sync);
        this.cadreListEl.appendChild(li);
      });
    }

    async loadAsset(data) {
      this.stopPlay();
      const dur = this.getDurationSec();
      this.scene.layers = [];
      this.scene.cadres = defaultCadres(dur);
      this.activeCadreId = this.scene.cadres[0].id;
      this.activeLayerId = null;
      this.selectedZoneId = null;
      await this.addLayerToScene(data, { replace: true });
      this.onStatus(`Scène : ${data.title}. Ajoutez d'autres calques ou cadres.`);
    }

    async addLayerToScene(data, options = {}) {
      this.stopPlay();
      const imgW = data.width || 400;
      const imgH = data.height || 400;
      const out = this.scene.output;
      const maxW = out.width * 0.55;
      const maxH = out.height * 0.55;
      const scale = Math.min(1, maxW / imgW, maxH / imgH);
      const w = Math.round(imgW * scale);
      const h = Math.round(imgH * scale);
      const n = this.scene.layers.length;

      const cadre = this.scene.cadres[n % this.scene.cadres.length] || this.scene.cadres[0];

      const layer = {
        id: uid('layer'),
        asset: { filename: data.filename, url: data.url, title: data.title || data.filename, width: imgW, height: imgH },
        x: Math.round(out.x + (out.width - w) / 2 + n * 40),
        y: Math.round(out.y + (out.height - h) / 2 + n * 24),
        width: w,
        height: h,
        rotation: 0,
        cadreId: cadre ? cadre.id : null,
        zonesByCadre: {},
        videoClipsByCadre: {},
        ltxEffects: [],
        keyframes: [],
        img: null,
      };

      try {
        layer.img = await loadImage(data.url, data.filename);
        layer.asset.width = layer.img.naturalWidth;
        layer.asset.height = layer.img.naturalHeight;
      } catch (err) {
        this.onStatus(err.message);
        return null;
      }

      const K = KF();
      if (K) K.ensureKeyframes(layer);

      this.scene.layers.push(layer);
      this.activeLayerId = layer.id;
      if (cadre) this.activeCadreId = cadre.id;

      this.resizeCanvas();
      this.layoutCanvas();
      this.renderLayerList();
      this.renderCadreList();
      this.renderZoneList();
      this.renderKeyframeList();
      this.renderZonesOverlay();
      this.syncPlayheadUi();
      this.paintFrame(this.getEditTimeSec());

      if (!options.replace) {
        this.onStatus(`${layer.asset.title} ajouté — posez des keyframes puis LTX effet si besoin.`);
      }
      return layer;
    }

    removeLayer(layerId) {
      this.scene.layers = this.scene.layers.filter((l) => l.id !== layerId);
      if (this.activeLayerId === layerId) {
        this.activeLayerId = this.scene.layers[0] ? this.scene.layers[0].id : null;
      }
      this.selectedZoneId = null;
      this.renderLayerList();
      this.renderZoneList();
      this.renderZonesOverlay();
      this.paintFrame(0);
    }

    resizeCanvas() {
      this.canvas.width = this.scene.workspace.width;
      this.canvas.height = this.scene.workspace.height;
      this.exportCanvas.width = this.scene.output.width;
      this.exportCanvas.height = this.scene.output.height;
    }

    layoutCanvas() {
      if (!this.stageEl) return;
      const rect = this.stageEl.getBoundingClientRect();
      const w = this.scene.workspace.width;
      const h = this.scene.workspace.height;
      const baseScale = Math.min(
        Math.max(rect.width - 24, 120) / w,
        Math.max(rect.height - 24, 120) / h
      );
      const scale = baseScale * this.viewZoom;
      const dw = w * scale;
      const dh = h * scale;
      const ox = (rect.width - dw) / 2 + this.viewPanX;
      const oy = (rect.height - dh) / 2 + this.viewPanY;
      this.layout = {
        scale,
        baseScale,
        ox,
        oy,
        dw,
        dh,
        stageW: rect.width,
        stageH: rect.height,
      };
      this.canvas.style.width = `${dw}px`;
      this.canvas.style.height = `${dh}px`;
      this.canvas.style.left = `${ox}px`;
      this.canvas.style.top = `${oy}px`;
      if (this.overlay) {
        this.overlay.style.width = `${rect.width}px`;
        this.overlay.style.height = `${rect.height}px`;
      }
      this.updateZoomBadge();
      this.renderZonesOverlay();
    }

    canvasPoint(e) {
      const rect = this.stageEl.getBoundingClientRect();
      const px = e.clientX - rect.left - this.layout.ox;
      const py = e.clientY - rect.top - this.layout.oy;
      return {
        x: px / this.layout.scale,
        y: py / this.layout.scale,
      };
    }

    globalToLayer(pt, layer) {
      const iw = layer.img.naturalWidth;
      const ih = layer.img.naturalHeight;
      const local = globalToLocal(layer, pt.x, pt.y);
      return {
        x: (local.x / layer.width) * iw,
        y: (local.y / layer.height) * ih,
      };
    }

    hitLayerAt(pt) {
      return hitLayerAtPoint(this.scene.layers, pt);
    }

    startLayerTransform(layer, handleId, pt, pointerId) {
      const orig = {
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        rotation: getLayerRotation(layer),
      };
      if (handleId === 'rotate') {
        const cx = layer.x + layer.width / 2;
        const cy = layer.y + layer.height / 2;
        this.layerTransform = {
          pointerId,
          layerId: layer.id,
          mode: 'rotate',
          orig,
          center: { x: cx, y: cy },
          startAngle: Math.atan2(pt.y - cy, pt.x - cx),
          origRotation: orig.rotation,
        };
        return;
      }
      const spec = HANDLE_ANCHORS[handleId];
      if (!spec) return;
      const anchorLocal = { x: spec.x * orig.width, y: spec.y * orig.height };
      const anchorGlobal = localToGlobal(
        { ...layer, x: orig.x, y: orig.y, width: orig.width, height: orig.height, rotation: orig.rotation },
        anchorLocal.x,
        anchorLocal.y
      );
      this.layerTransform = {
        pointerId,
        layerId: layer.id,
        mode: 'resize',
        handle: handleId,
        orig,
        anchorGlobal,
      };
    }

    onPointerDown(e) {
      if (!this.scene.layers.length) return;
      const pt = this.canvasPoint(e);
      const handleEl = e.target.closest('[data-transform-handle]');

      if (handleEl && this.tool === 'move') {
        const handleId = handleEl.dataset.transformHandle;
        const layer = this.getActiveLayer();
        if (!layer) return;
        this.startLayerTransform(layer, handleId, pt, e.pointerId);
        this.overlay.setPointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (this.tool === 'move') {
        const layer = this.hitLayerAt(pt);
        if (!layer) return;
        this.activeLayerId = layer.id;
        this.layerTransform = {
          pointerId: e.pointerId,
          layerId: layer.id,
          mode: 'move',
          start: pt,
          orig: { x: layer.x, y: layer.y },
        };
        this.renderLayerList();
        this.renderZonesOverlay();
        this.overlay.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }

      const layer = this.hitLayerAt(pt) || this.getActiveLayer();
      if (!layer || !layer.img) return;
      this.activeLayerId = layer.id;
      const cadre = this.getActiveCadre();
      const local = this.globalToLayer(pt, layer);
      const hitZone = this.hitZoneInLayer(layer, cadre.id, local.x, local.y);
      if (hitZone) {
        this.selectedZoneId = hitZone.id;
        this.renderZoneList();
        this.renderZonesOverlay();
        return;
      }

      this.drawDrag = { pointerId: e.pointerId, layerId: layer.id, cadreId: cadre.id, start: local, current: local };
      this.overlay.setPointerCapture(e.pointerId);
      e.preventDefault();
    }

    hitZoneInLayer(layer, cadreId, lx, ly) {
      const zones = getLayerZones(layer, cadreId);
      for (let i = zones.length - 1; i >= 0; i -= 1) {
        const z = zones[i];
        if (lx >= z.x && lx <= z.x + z.width && ly >= z.y && ly <= z.y + z.height) return z;
      }
      return null;
    }

    ensureLayerZones(layer, cadreId) {
      if (!layer.zonesByCadre) layer.zonesByCadre = {};
      if (!layer.zonesByCadre[cadreId]) layer.zonesByCadre[cadreId] = [];
      return layer.zonesByCadre[cadreId];
    }

    onPointerMove(e) {
      if (this.layerTransform && e.pointerId === this.layerTransform.pointerId) {
        const pt = this.canvasPoint(e);
        const layer = this.scene.layers.find((l) => l.id === this.layerTransform.layerId);
        if (!layer) return;
        const t = this.layerTransform;
        if (t.mode === 'move') {
          layer.x = Math.round(t.orig.x + (pt.x - t.start.x));
          layer.y = Math.round(t.orig.y + (pt.y - t.start.y));
        } else if (t.mode === 'resize') {
          applyResizeFromPointer(layer, t.handle, pt, t);
        } else if (t.mode === 'rotate') {
          const angle = Math.atan2(pt.y - t.center.y, pt.x - t.center.x);
          layer.rotation = Math.round((t.origRotation + (angle - t.startAngle) * (180 / Math.PI)) * 10) / 10;
        }
        this.renderLayerList();
        this.renderZonesOverlay();
        this.paintFrame(this.getEditTimeSec());
        return;
      }
      if (!this.drawDrag || e.pointerId !== this.drawDrag.pointerId) return;
      const pt = this.canvasPoint(e);
      const layer = this.scene.layers.find((l) => l.id === this.drawDrag.layerId);
      if (!layer) return;
      this.drawDrag.current = this.globalToLayer(pt, layer);
      this.renderZonesOverlay(this.drawDrag);
    }

    onPointerUp(e) {
      if (this.layerTransform && e.pointerId === this.layerTransform.pointerId) {
        const layer = this.scene.layers.find((l) => l.id === this.layerTransform.layerId);
        this.layerTransform = null;
        if (layer && this.workflow === 'clip') {
          const K = KF();
          if (K) K.upsertKeyframe(layer, this.getEditTimeSec());
          this.renderKeyframeList();
          this.onStatus(`Keyframe @ ${this.getEditTimeSec().toFixed(1)} s`);
        }
        this.renderLayerList();
        this.paintFrame(this.getEditTimeSec());
        return;
      }
      if (!this.drawDrag || e.pointerId !== this.drawDrag.pointerId) return;
      const layer = this.scene.layers.find((l) => l.id === this.drawDrag.layerId);
      const { start, current, cadreId } = this.drawDrag;
      this.drawDrag = null;
      if (!layer || this.tool === 'move') return;

      const x = Math.min(start.x, current.x);
      const y = Math.min(start.y, current.y);
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);
      if (width < 6 || height < 6) return;

      const iw = layer.img.naturalWidth;
      const ih = layer.img.naturalHeight;
      const zones = this.ensureLayerZones(layer, cadreId);
      const zone = {
        id: uid('z'),
        type: this.tool,
        x: clamp(Math.round(x), 0, iw - 1),
        y: clamp(Math.round(y), 0, ih - 1),
        width: clamp(Math.round(width), 4, iw),
        height: clamp(Math.round(height), 4, ih),
        phase: Math.random() * Math.PI * 2,
      };
      zones.push(zone);
      layer.cadreId = cadreId;
      this.selectedZoneId = zone.id;
      this.renderLayerList();
      this.renderZoneList();
      this.renderZonesOverlay();
      this.paintFrame(this.getEditTimeSec());
    }

    deleteSelectedZone() {
      const layer = this.getActiveLayer();
      const cadre = this.getActiveCadre();
      if (!layer || !this.selectedZoneId || !cadre) return;
      const zones = this.ensureLayerZones(layer, cadre.id);
      layer.zonesByCadre[cadre.id] = zones.filter((z) => z.id !== this.selectedZoneId);
      this.selectedZoneId = null;
      this.renderZoneList();
      this.renderZonesOverlay();
      this.paintFrame(this.getEditTimeSec());
    }

    updatePromptPanel() {
      const layer = this.getActiveLayer();
      const cadre = this.getActiveCadre();
      if (this.promptPanelEl) {
        this.promptPanelEl.hidden = !layer;
      }
      if (!layer || !this.promptInputEl) return;
      if (!layer.promptByCadre) layer.promptByCadre = {};
      const key = cadre ? cadre.id : '_';
      if (this.promptInputEl.value !== (layer.promptByCadre[key] || '')) {
        this.promptInputEl.value = layer.promptByCadre[key] || '';
      }
      if (layer.animationSummary && cadre) {
        const hint = this.promptPanelEl && this.promptPanelEl.querySelector('.ms-animate-prompt-summary');
        if (hint) hint.textContent = layer.animationSummary;
      }
    }

    applyPromptResult(layer, cadreId, data) {
      if (!layer.zonesByCadre) layer.zonesByCadre = {};
      if (!layer.fullEffectsByCadre) layer.fullEffectsByCadre = {};
      layer.zonesByCadre[cadreId] = (data.pixelZones || []).map((z, i) => ({
        id: z.id || uid('z'),
        type: z.type,
        x: z.x,
        y: z.y,
        width: z.width,
        height: z.height,
        speed: z.speed,
        depth: z.depth,
        intensity: z.intensity,
        phase: z.phase != null ? z.phase : i * 0.8,
      }));
      layer.fullEffectsByCadre[cadreId] = data.fullEffects || [];
      layer.cadreId = cadreId;
      layer.animationSummary = data.summary || null;
      this.renderLayerList();
      this.renderZoneList();
      this.renderZonesOverlay();
      this.paintFrame(this.getEditTimeSec());
    }

    async applyI2vResult(layer, cadreId, data) {
      if (!layer.videoClipsByCadre) layer.videoClipsByCadre = {};
      const clipUrl = data.url && /^https?:\/\//i.test(data.url)
        ? data.url
        : this.msApi(data.url || `/clip/${encodeURIComponent(data.filename)}`);
      const video = await loadVideoClip(`${clipUrl}?v=${encodeURIComponent(data.filename || Date.now())}`);
      layer.videoClipsByCadre[cadreId] = {
        url: clipUrl,
        filename: data.filename,
        duration: data.duration || video.duration || 2,
        fps: data.fps || 24,
        background_color: data.background_color || null,
        prompt: data.prompt,
        video,
      };
      if (layer.zonesByCadre) layer.zonesByCadre[cadreId] = [];
      if (layer.fullEffectsByCadre) layer.fullEffectsByCadre[cadreId] = [];
      layer.cadreId = cadreId;
      layer.i2vSummary = data.prompt || null;
      this.renderLayerList();
      this.renderZoneList();
      this.renderZonesOverlay();
      this.paintFrame(this.getEditTimeSec());
    }

    getEditTimeSec() {
      if (this.playing) return this.getPlayTimeSec();
      return this.playheadSec;
    }

    syncPlayheadUi() {
      const dur = this.getDurationSec();
      if (this.playheadInput) {
        this.playheadInput.max = String(dur);
        this.playheadInput.value = String(Math.round(this.playheadSec * 10) / 10);
      }
      if (this.playheadLabel) {
        this.playheadLabel.textContent = `${this.playheadSec.toFixed(1)} s / ${dur.toFixed(0)} s`;
      }
    }

    syncLayersToTime(tSec) {
      const K = KF();
      if (!K) return;
      (this.scene.layers || []).forEach((layer) => {
        K.applyPoseToLayer(layer, K.getLayerPoseAt(layer, tSec));
      });
    }

    setPlayhead(tSec, options = {}) {
      const dur = this.getDurationSec();
      this.playheadSec = clamp(Number(tSec) || 0, 0, dur);
      this.syncPlayheadUi();
      this.syncLayersToTime(this.playheadSec);
      this.renderKeyframeList();
      this.renderZonesOverlay();
      if (options.paint !== false) this.paintFrame(this.playheadSec);
    }

    addKeyframeAtPlayhead() {
      const layer = this.getActiveLayer();
      const K = KF();
      if (!layer || !K) {
        this.onStatus('Sélectionnez un calque.');
        return;
      }
      K.upsertKeyframe(layer, this.playheadSec);
      this.renderKeyframeList();
      this.renderLayerList();
      this.onStatus(`Keyframe ajoutée @ ${this.playheadSec.toFixed(1)} s — déplacez le calque pour animer.`);
      this.paintFrame(this.playheadSec);
    }

    removeKeyframeById(keyframeId) {
      const layer = this.getActiveLayer();
      const K = KF();
      if (!layer || !K) return;
      K.removeKeyframe(layer, keyframeId);
      this.syncLayersToTime(this.playheadSec);
      this.renderKeyframeList();
      this.renderLayerList();
      this.paintFrame(this.playheadSec);
    }

    renderKeyframeList() {
      if (!this.keyframeListEl) return;
      const layer = this.getActiveLayer();
      const K = KF();
      if (!layer || !K) {
        this.keyframeListEl.innerHTML = '<li class="ms-animate-empty">Sélectionnez un calque.</li>';
        return;
      }
      const kfs = K.ensureKeyframes(layer);
      this.keyframeListEl.innerHTML = '';
      kfs.forEach((kf, i) => {
        const li = document.createElement('li');
        li.className = 'ms-animate-zone-item';
        if (Math.abs(kf.t - this.playheadSec) < 0.05) li.classList.add('selected');
        li.innerHTML = `
          <span>KF ${i + 1} · ${kf.t.toFixed(1)} s</span>
          <small>${Math.round(kf.x)},${Math.round(kf.y)} · ${Math.round(kf.rotation)}°</small>
          <button type="button" class="ms-btn ms-btn-ghost ms-kf-goto" title="Aller">↗</button>
          <button type="button" class="ms-btn ms-btn-ghost ms-kf-del" title="Supprimer">×</button>`;
        li.querySelector('.ms-kf-goto').addEventListener('click', (e) => {
          e.stopPropagation();
          this.setPlayhead(kf.t, { paint: true });
        });
        li.querySelector('.ms-kf-del').addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeKeyframeById(kf.id);
        });
        li.addEventListener('click', () => this.setPlayhead(kf.t, { paint: true }));
        this.keyframeListEl.appendChild(li);
      });
      (layer.ltxEffects || []).forEach((fx) => {
        const li = document.createElement('li');
        li.className = 'ms-animate-zone-item ms-animate-clip-item';
        const end = (Number(fx.start) || 0) + (Number(fx.duration) || 2);
        li.innerHTML = `<span>Effet LTX</span><small>${(Number(fx.start) || 0).toFixed(1)}→${end.toFixed(1)} s</small>
          <button type="button" class="ms-btn ms-btn-ghost ms-ltx-del" title="Supprimer">×</button>`;
        li.querySelector('.ms-ltx-del').addEventListener('click', (e) => {
          e.stopPropagation();
          layer.ltxEffects = (layer.ltxEffects || []).filter((x) => x.id !== fx.id);
          this.renderKeyframeList();
          this.paintFrame(this.getEditTimeSec());
        });
        this.keyframeListEl.appendChild(li);
      });
    }

    /** Capture le calque à la pose courante (frame du plan) → PNG data URL. */
    async captureLayerFrameDataUrl(layer, tSec) {
      const K = KF();
      const pose = K ? K.getLayerPoseAt(layer, tSec) : {
        x: layer.x, y: layer.y, width: layer.width, height: layer.height, rotation: 0,
      };
      const iw = layer.img.naturalWidth;
      const ih = layer.img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = iw;
      canvas.height = ih;
      const ctx = canvas.getContext('2d', { alpha: true });
      ctx.clearRect(0, 0, iw, ih);
      ctx.drawImage(layer.img, 0, 0, iw, ih);
      void pose;
      return canvas.toDataURL('image/png');
    }

    async applyLtxEffect(layer, data, startSec) {
      if (!layer.ltxEffects) layer.ltxEffects = [];
      const clipUrl = data.url && /^https?:\/\//i.test(data.url)
        ? data.url
        : this.msApi(data.url || `/clip/${encodeURIComponent(data.filename)}`);
      const video = await loadVideoClip(`${clipUrl}?v=${encodeURIComponent(data.filename || Date.now())}`);
      const duration = data.duration || video.duration || 2;
      layer.ltxEffects.push({
        id: uid('ltx'),
        start: Math.round((Number(startSec) || 0) * 100) / 100,
        duration,
        url: clipUrl,
        filename: data.filename,
        fps: data.fps || 24,
        background_color: data.background_color || null,
        prompt: data.prompt,
        sourceFrameT: startSec,
        video,
      });
      this.renderKeyframeList();
      this.renderZoneList();
      this.paintFrame(this.getEditTimeSec());
    }

    async generateActiveLayerI2v() {
      const layer = this.getActiveLayer();
      const cadre = this.getActiveCadre();
      if (!layer || !layer.img || !layer.asset.filename) {
        this.onStatus('Sélectionnez un calque avec PNG source.');
        return;
      }
      const prompt = (this.promptInputEl && this.promptInputEl.value.trim()) || '';
      if (!prompt) {
        this.onStatus(this.workflow === 'clip'
          ? 'Décrivez l\'effet LTX (ex. runes qui s\'illuminent).'
          : 'Décrivez le mouvement (ex. runes qui s\'illuminent).');
        return;
      }

      if (isMechanicalMotionPrompt(prompt)) {
        this.onStatus('Tir/chargeur/boutons : LTX = flou. Animation par zones à la place…');
        await this.generateActiveLayerPrompt();
        return;
      }

      if (this.i2vGenerateBtn) this.i2vGenerateBtn.disabled = true;
      if (this.promptGenerateBtn) this.promptGenerateBtn.disabled = true;

      const isClip = this.workflow === 'clip';
      const startSec = isClip ? this.getEditTimeSec() : (cadre ? cadre.start : 0);
      this.onStatus(isClip
        ? `Effet LTX depuis frame @ ${startSec.toFixed(1)} s… 2 à 8 min.`
        : 'Génération clip IA (LTX, fond uni)… 2 à 8 min, patientez.');

      try {
        const body = {
          sourceFilename: layer.asset.filename,
          prompt,
          layerTitle: layer.asset.title,
          engine: 'ltx',
        };
        if (isClip) {
          body.imageDataUrl = await this.captureLayerFrameDataUrl(layer, startSec);
          body.effectStart = startSec;
        }
        const res = await fetch(this.msApi('/animate-i2v'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await this.parseApiResponse(res);
        if (!json.success) throw new Error(json.message || 'Erreur clip IA');
        if (isClip) {
          await this.applyLtxEffect(layer, json.data, startSec);
          const dur = json.data.duration ? `${json.data.duration.toFixed(1)} s` : '~2 s';
          this.onStatus(`Effet LTX collé @ ${startSec.toFixed(1)} s (${dur}).`);
        } else {
          await this.applyI2vResult(layer, cadre.id, json.data);
          const dur = json.data.duration ? `${json.data.duration.toFixed(1)} s` : '~2 s';
          this.onStatus(`Clip IA prêt (${dur}) sur cadre « ${cadre.label} ».`);
        }
      } catch (err) {
        this.onStatus('Erreur clip IA : ' + err.message);
      } finally {
        if (this.i2vGenerateBtn) this.i2vGenerateBtn.disabled = false;
        if (this.promptGenerateBtn) this.promptGenerateBtn.disabled = false;
      }
    }

    async generateActiveLayerPrompt() {
      const layer = this.getActiveLayer();
      const cadre = this.getActiveCadre();
      if (!layer || !layer.img) {
        this.onStatus('Sélectionnez un calque.');
        return;
      }
      const prompt = (this.promptInputEl && this.promptInputEl.value.trim()) || '';
      if (!prompt) {
        this.onStatus('Décrivez l\'animation en français (ex. runes qui s\'illuminent).');
        return;
      }
      if (!layer.promptByCadre) layer.promptByCadre = {};
      layer.promptByCadre[cadre.id] = prompt;

      const useLlm = this.promptLlmCheckEl && this.promptLlmCheckEl.checked;
      if (this.promptGenerateBtn) this.promptGenerateBtn.disabled = true;
      this.onStatus(useLlm ? 'IA + règles…' : 'Génération animation…');

      try {
        let llmText = null;
        if (useLlm && this.onGeneratePrompt) {
          llmText = await this.onGeneratePrompt(layer, prompt, cadre);
        }
        const res = await fetch(this.msApi('/animate-prompt'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            llmText,
            width: layer.img.naturalWidth,
            height: layer.img.naturalHeight,
            layerTitle: layer.asset.title,
          }),
        });
        const json = await this.parseApiResponse(res);
        if (!json.success) throw new Error(json.message || 'Erreur prompt animation');
        this.applyPromptResult(layer, cadre.id, json.data);
        this.onStatus(`Animation : ${json.data.zoneCount} zone(s), ${json.data.fullEffectCount} effet(s) calque.`);
      } catch (err) {
        this.onStatus('Erreur : ' + err.message);
      } finally {
        if (this.promptGenerateBtn) this.promptGenerateBtn.disabled = false;
      }
    }

    getAssetItems() {
      if (!this.assetListEl) return [];
      return Array.from(this.assetListEl.querySelectorAll('.ms-animate-asset-item[data-filename]'));
    }

    getSelectedAssets() {
      return this.getAssetItems()
        .filter((li) => li.classList.contains('is-selected'))
        .map((li) => ({
          id: li.dataset.id || '',
          filename: li.dataset.filename || '',
        }))
        .filter((a) => a.filename || a.id);
    }

    notifySelectionChange() {
      if (this.onSelectionChange) this.onSelectionChange(this.getSelectedAssets(), this.getAssetItems().length);
    }

    setItemSelected(li, selected) {
      if (!li) return;
      li.classList.toggle('is-selected', !!selected);
      li.setAttribute('aria-selected', selected ? 'true' : 'false');
    }

    selectAllAssets(select) {
      this.getAssetItems().forEach((li) => this.setItemSelected(li, select));
      this.notifySelectionChange();
    }

    ensureAssetEmptyState() {
      if (!this.assetListEl) return;
      if (this.getAssetItems().length === 0 && !this.assetListEl.querySelector('.ms-animate-empty')) {
        const empty = document.createElement('li');
        empty.className = 'ms-animate-empty';
        empty.textContent = 'Extrayez un objet ou importez un PNG.';
        this.assetListEl.appendChild(empty);
      }
      this.notifySelectionChange();
    }

    removeLayersByFilename(filename) {
      if (!filename) return;
      const toRemove = this.scene.layers
        .filter((l) => l.asset && l.asset.filename === filename)
        .map((l) => l.id);
      toRemove.forEach((id) => this.removeLayer(id));
    }

    removeAssetItem(ref) {
      if (!this.assetListEl || !ref) return false;
      const id = ref.id ? String(ref.id) : '';
      const filename = ref.filename ? String(ref.filename) : '';
      let removed = false;
      this.getAssetItems().forEach((li) => {
        const match = (id && li.dataset.id === id) || (filename && li.dataset.filename === filename);
        if (!match) return;
        if (li.dataset.filename) this.knownAssets.delete(li.dataset.filename);
        li.remove();
        removed = true;
      });
      if (filename) this.removeLayersByFilename(filename);
      if (removed) this.ensureAssetEmptyState();
      return removed;
    }

    addAssetItem(data) {
      if (!this.assetListEl || !data || !data.filename || this.knownAssets.has(data.filename)) return;
      this.knownAssets.add(data.filename);
      const empty = this.assetListEl.querySelector('.ms-animate-empty');
      if (empty) empty.remove();
      const id = data.id != null && data.id !== ''
        ? String(data.id)
        : (data._id != null ? String(data._id) : '');
      const li = document.createElement('li');
      li.className = 'ms-animate-asset-item';
      li.dataset.filename = data.filename;
      if (id) li.dataset.id = id;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.innerHTML = `
        <span class="ms-list-check" aria-hidden="true"></span>
        <img src="${data.url}?v=${encodeURIComponent(data.filename)}" alt="">
        <div class="ms-animate-asset-info">
          <span>${data.title || data.filename}</span>
          <small>${data.width || '?'}×${data.height || '?'}</small>
        </div>
        <div class="ms-animate-asset-btns">
          <button type="button" class="ms-btn ms-btn-ghost ms-animate-open-btn">Nouvelle scène</button>
          <button type="button" class="ms-btn ms-btn-ghost ms-animate-add-btn">+ Calque</button>
          <button type="button" class="ms-btn ms-btn-ghost ms-list-delete-btn" title="Supprimer">×</button>
        </div>`;
      li.querySelector('.ms-animate-open-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.loadAsset(data);
      });
      li.querySelector('.ms-animate-add-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.addLayerToScene(data);
      });
      const delBtn = li.querySelector('.ms-list-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!confirm('Supprimer cet objet ?')) return;
          delBtn.disabled = true;
          try {
            if (this.onDeleteAsset) await this.onDeleteAsset({ id, filename: data.filename });
            else this.removeAssetItem({ id, filename: data.filename });
          } catch (err) {
            delBtn.disabled = false;
            this.onStatus('Suppression: ' + err.message);
          }
        });
      }
      li.addEventListener('click', (e) => {
        if (e.target.closest('a, button')) return;
        this.setItemSelected(li, !li.classList.contains('is-selected'));
        this.notifySelectionChange();
      });
      this.assetListEl.prepend(li);
      this.notifySelectionChange();
    }

    renderLayerList() {
      if (!this.layerListEl) return;
      if (!this.scene.layers.length) {
        this.layerListEl.innerHTML = this.workflow === 'clip'
          ? '<li class="ms-animate-empty">Générez un sujet, puis animez-le.</li>'
          : '<li class="ms-animate-empty">Importez des objets via la liste ci-dessous.</li>';
        return;
      }
      this.layerListEl.innerHTML = '';
      this.scene.layers.forEach((layer, i) => {
        const li = document.createElement('li');
        li.className = 'ms-animate-layer-item';
        if (layer.id === this.activeLayerId) li.classList.add('selected');
        const cadreOpts = this.scene.cadres.map((c) =>
          `<option value="${c.id}"${layer.cadreId === c.id ? ' selected' : ''}>${c.label}</option>`
        ).join('');
        const zoneCount = Object.values(layer.zonesByCadre || {}).reduce((n, z) => n + z.length, 0);
        const kfCount = (layer.keyframes || []).length;
        const ltxCount = (layer.ltxEffects || []).length;
        li.innerHTML = `
          <div class="ms-animate-layer-head">
            <strong>${i + 1}. ${layer.asset.title}</strong>
            <button type="button" class="ms-btn ms-btn-ghost ms-animate-layer-remove">×</button>
          </div>
          <label class="ms-animate-layer-cadre">Animation cadre
            <select class="ms-layer-cadre-select">${cadreOpts}</select>
          </label>
          <small>${kfCount} KF · ${ltxCount} LTX · ${zoneCount} zone(s) · ${Math.round(getLayerRotation(layer))}°</small>`;
        li.addEventListener('click', (e) => {
          if (e.target.closest('button') || e.target.closest('select')) return;
          this.activeLayerId = layer.id;
          this.renderLayerList();
          this.renderZoneList();
          this.renderKeyframeList();
          this.renderZonesOverlay();
          this.updatePromptPanel();
        });
        li.querySelector('.ms-animate-layer-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeLayer(layer.id);
        });
        li.querySelector('.ms-layer-cadre-select').addEventListener('change', (e) => {
          layer.cadreId = e.target.value;
          this.activeCadreId = e.target.value;
          this.renderCadreList();
          this.updatePromptPanel();
        });
        this.layerListEl.appendChild(li);
      });
      this.updatePromptPanel();
    }

    renderZoneList() {
      if (!this.zoneListEl) return;
      const layer = this.getActiveLayer();
      const cadre = this.getActiveCadre();
      const K = KF();
      const zones = layer ? getLayerZones(layer, cadre?.id) : [];
      const clip = layer && cadre ? getLayerVideoClip(layer, cadre.id) : null;
      const ltxCount = layer && layer.ltxEffects ? layer.ltxEffects.length : 0;
      const kfCount = layer && layer.keyframes ? layer.keyframes.length : 0;
      const kfMotion = layer && K ? K.hasKeyframeMotion(layer) : false;
      if (!layer || (!zones.length && !clip && !ltxCount && !kfMotion)) {
        const hint = layer
          ? `Keyframes (${kfCount}) — scrub + déplacer, ou effet LTX @ playhead.`
          : 'Sélectionnez un calque.';
        this.zoneListEl.innerHTML = `<li class="ms-animate-empty">${hint}</li>`;
        return;
      }
      this.zoneListEl.innerHTML = '';
      if (kfMotion) {
        const li = document.createElement('li');
        li.className = 'ms-animate-zone-item ms-animate-clip-item';
        li.innerHTML = `<span>Keyframes</span><small>${kfCount} poses</small>`;
        this.zoneListEl.appendChild(li);
      }
      if (ltxCount) {
        const li = document.createElement('li');
        li.className = 'ms-animate-zone-item ms-animate-clip-item';
        li.innerHTML = `<span>Effets LTX</span><small>${ltxCount}</small>`;
        this.zoneListEl.appendChild(li);
      }
      if (clip) {
        const li = document.createElement('li');
        li.className = 'ms-animate-zone-item ms-animate-clip-item';
        const dur = clip.duration ? `${clip.duration.toFixed(1)} s` : 'clip';
        li.innerHTML = `<span>Clip cadre (legacy)</span><small>${dur}</small>`;
        this.zoneListEl.appendChild(li);
      }
      zones.forEach((z, i) => {
        const li = document.createElement('li');
        li.className = 'ms-animate-zone-item';
        if (z.id === this.selectedZoneId) li.classList.add('selected');
        li.innerHTML = `<span>${i + 1}. ${z.type === 'glow' ? 'Rune' : 'Bouton'}</span><small>${z.width}×${z.height}</small>`;
        li.addEventListener('click', () => {
          this.selectedZoneId = z.id;
          this.renderZoneList();
          this.renderZonesOverlay();
        });
        this.zoneListEl.appendChild(li);
      });
    }

    renderZonesOverlay(previewDrag) {
      if (!this.overlay) return;
      this.overlay.innerHTML = '';
      const out = this.scene.output;

      const showRect = (x, y, w, h, cls, selected, label) => {
        const el = document.createElement('div');
        el.className = `ms-animate-zone-rect ${cls}${selected ? ' selected' : ''}`;
        el.style.left = `${this.layout.ox + x * this.layout.scale}px`;
        el.style.top = `${this.layout.oy + y * this.layout.scale}px`;
        el.style.width = `${Math.max(w * this.layout.scale, 2)}px`;
        el.style.height = `${Math.max(h * this.layout.scale, 2)}px`;
        if (label) {
          const tag = document.createElement('span');
          tag.className = 'ms-animate-output-label';
          tag.textContent = label;
          el.appendChild(tag);
        }
        this.overlay.appendChild(el);
      };

      showRect(out.x, out.y, out.width, out.height, 'ms-animate-output-zone', false, 'Zone de sortie');

      const appendTransformBox = (layer) => {
        const s = this.layout.scale;
        const box = document.createElement('div');
        box.className = 'ms-animate-transform-box';
        box.style.left = `${this.layout.ox + layer.x * s}px`;
        box.style.top = `${this.layout.oy + layer.y * s}px`;
        box.style.width = `${Math.max(layer.width * s, 8)}px`;
        box.style.height = `${Math.max(layer.height * s, 8)}px`;
        box.style.transform = `rotate(${getLayerRotation(layer)}deg)`;

        const border = document.createElement('div');
        border.className = 'ms-animate-transform-border';
        box.appendChild(border);

        const stem = document.createElement('div');
        stem.className = 'ms-animate-rotate-stem';
        box.appendChild(stem);

        TRANSFORM_HANDLES.forEach((id) => {
          const h = document.createElement('div');
          h.className = `ms-animate-handle ms-animate-handle--${id}`;
          h.dataset.transformHandle = id;
          box.appendChild(h);
        });

        this.overlay.appendChild(box);
      };

      const cadre = this.getActiveCadre();
      this.scene.layers.forEach((layer) => {
        if (!layer.img) return;
        const isActive = layer.id === this.activeLayerId;
        if (isActive && this.tool === 'move') {
          appendTransformBox(layer);
        } else {
          showRect(layer.x, layer.y, layer.width, layer.height, 'ms-animate-layer-bounds', isActive);
        }
        if (!isActive || !cadre) return;
        const rot = getLayerRotation(layer);
        const sx = layer.width / layer.img.naturalWidth;
        const sy = layer.height / layer.img.naturalHeight;
        if (Math.abs(rot) < 0.5) {
          getLayerZones(layer, cadre.id).forEach((z) => {
            showRect(
              layer.x + z.x * sx, layer.y + z.y * sy, z.width * sx, z.height * sy,
              z.type === 'glow' ? 'ms-animate-zone-rect--glow' : 'ms-animate-zone-rect--button',
              z.id === this.selectedZoneId
            );
          });
        }
        if (previewDrag && previewDrag.layerId === layer.id && previewDrag.cadreId === cadre.id) {
          const x = Math.min(previewDrag.start.x, previewDrag.current.x);
          const y = Math.min(previewDrag.start.y, previewDrag.current.y);
          const w = Math.abs(previewDrag.current.x - previewDrag.start.x);
          const h = Math.abs(previewDrag.current.y - previewDrag.start.y);
          showRect(
            layer.x + x * sx, layer.y + y * sy, w * sx, h * sy,
            this.tool === 'glow' ? 'ms-animate-zone-rect--glow' : 'ms-animate-zone-rect--button',
            false
          );
          this.overlay.lastElementChild.classList.add('draft');
        }
      });
    }

    getPlayTimeSec() {
      return (performance.now() - this.playStart) / 1000;
    }

    tick = () => {
      if (!this.playing) return;
      const t = this.getPlayTimeSec();
      if (t >= this.getDurationSec()) {
        this.stopPlay();
        return;
      }
      this.playheadSec = t;
      this.syncPlayheadUi();
      this.syncLayersToTime(t);
      this.paintFrame(t);
      this.rafId = requestAnimationFrame(this.tick);
    };

    togglePlay() {
      if (this.playing) this.stopPlay();
      else this.startPlay();
    }

    startPlay() {
      if (!this.scene.layers.length) return;
      this.playing = true;
      this.playStart = performance.now() - this.playheadSec * 1000;
      if (this.playBtn) this.playBtn.textContent = 'Pause';
      this.tick();
    }

    stopPlay() {
      this.playing = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;
      const dur = this.getDurationSec();
      if (this.playBtn) this.playBtn.textContent = `▶ Aperçu ${dur} s`;
      this.setPlayhead(this.playheadSec, { paint: true });
    }

    paintFrame(tSec) {
      if (!this.ctx) return;
      const t = tSec == null ? this.getEditTimeSec() : tSec;
      renderComposedFrame(this.ctx, this.scene, t, this.getDurationSec(), {
        transparent: false,
        cropOutput: false,
        liveLayerId: this.layerTransform ? this.layerTransform.layerId : null,
      });
    }

    async paintExportFrame(tSec, transparent) {
      await syncSceneVideos(this.scene, tSec);
      renderComposedFrame(this.exportCtx, this.scene, tSec, this.getDurationSec(), { transparent, cropOutput: true });
    }

    getExportFormat() {
      return (this.exportFormatSelect && this.exportFormatSelect.value) || 'obs-webm';
    }

    buildExportBasename() {
      const titles = this.scene.layers.map((l) => l.asset.title).join('-');
      return (titles.replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').slice(0, 50) || 'scene');
    }

    hasAnyZones() {
      return this.scene.layers.some((l) => {
        const z = Object.values(l.zonesByCadre || {}).some((arr) => arr.length);
        const v = Object.values(l.videoClipsByCadre || {}).some((clip) => clip && clip.url);
        const f = Object.values(l.fullEffectsByCadre || {}).some((arr) => arr.length);
        const ltx = (l.ltxEffects || []).length > 0;
        return z || v || f || ltx || (Array.isArray(l.zones) && l.zones.length);
      });
    }

    hasKeyframeMotion() {
      const K = KF();
      if (!K) return false;
      return this.scene.layers.some((l) => K.hasKeyframeMotion(l));
    }

    async exportAnimation() {
      const format = this.getExportFormat();
      if (format === 'obs-pngzip') await this.exportPngZip();
      else await this.exportWebM({ transparent: format === 'obs-webm', obs: format === 'obs-webm' });
    }

    validateExport() {
      if (!this.scene.layers.length) {
        this.onStatus('Ajoutez au moins un calque.');
        return false;
      }
      if (this.workflow === 'clip') {
        if (!this.hasAnyZones() && !this.hasKeyframeMotion()) {
          this.onStatus('Ajoutez ≥2 keyframes ou un effet LTX avant export.');
          return false;
        }
        return true;
      }
      if (!this.hasAnyZones()) {
        this.onStatus('Générez un clip IA ou ajoutez des zones sur au moins un cadre.');
        return false;
      }
      return true;
    }

    async exportPngZip() {
      if (!this.validateExport()) return;
      const durationSec = this.getDurationSec();
      const fps = 30;
      this.stopPlay();
      if (this.exportBtn) this.exportBtn.disabled = true;
      this.exportCanvas.width = this.scene.output.width;
      this.exportCanvas.height = this.scene.output.height;
      const enc = new TextEncoder();
      const entries = [{
        name: 'OBS-LISEZMOI.txt',
        data: enc.encode(
          `Export zone ${this.scene.output.width}×${this.scene.output.height}px · ${durationSec}s\n`
          + 'OBS : Source Média → WebM transparent recommandé.\n'
          + `ffmpeg -framerate ${fps} -i frames/frame_%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p overlay.webm`
        ),
      }];
      const totalFrames = Math.round(durationSec * fps);
      for (let f = 0; f <= totalFrames; f += 1) {
        const tSec = (f / totalFrames) * durationSec;
        await this.paintExportFrame(tSec, true);
        const blob = await new Promise((r) => { this.exportCanvas.toBlob(r, 'image/png'); });
        if (blob) entries.push({ name: `frames/frame_${String(f).padStart(4, '0')}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
        if (f % 20 === 0) this.onStatus(`Export PNG… ${Math.round((f / totalFrames) * 100)} %`);
      }
      downloadBlob(buildZipStore(entries), `obs-${this.buildExportBasename()}-${durationSec}s.zip`);
      if (this.exportBtn) this.exportBtn.disabled = false;
      this.onStatus('ZIP PNG exporté (zone de sortie).');
      this.paintFrame(0);
    }

    async exportWebM(options = {}) {
      if (!this.validateExport()) return;
      if (typeof MediaRecorder === 'undefined') {
        this.onStatus('Export vidéo non supporté.');
        return;
      }
      const durationSec = this.getDurationSec();
      const transparent = options.transparent === true;
      this.stopPlay();
      if (this.exportBtn) this.exportBtn.disabled = true;
      this.exportCanvas.width = this.scene.output.width;
      this.exportCanvas.height = this.scene.output.height;
      this.onStatus(`Export ${this.scene.output.width}×${this.scene.output.height} · ${durationSec} s…`);

      const mimeType = pickMimeType(options.obs);
      const fps = 30;
      const stream = this.exportCanvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
      const chunks = [];
      const done = new Promise((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(';')[0] }));
        recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
      });
      recorder.start(200);
      const totalFrames = Math.round(durationSec * fps);
      for (let f = 0; f <= totalFrames; f += 1) {
        await this.paintExportFrame((f / totalFrames) * durationSec, transparent);
        await new Promise((r) => setTimeout(r, 1000 / fps));
      }
      recorder.stop();
      const blob = await done;
      const prefix = options.obs ? 'obs-scene' : 'scene';
      downloadBlob(blob, `${prefix}-${this.buildExportBasename()}-${durationSec}s.webm`);
      if (this.exportBtn) this.exportBtn.disabled = false;
      this.onStatus(`Export OBS ${this.scene.output.width}×${this.scene.output.height} prêt.`);
      this.paintFrame(0);
    }
  }

  global.MediaStudioAnimate = {
    AnimationEditor,
    MAX_DURATION,
    DEFAULT_DURATION,
    renderComposedFrame,
    splitCadresEvenly,
  };
})(window);
