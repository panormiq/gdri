/**
 * Keyframes calque — interpolation x/y/width/height/rotation + easing.
 */
(function (global) {
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function easeInOut(u) {
    const t = clamp(u, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  }

  function poseFromLayer(layer) {
    return {
      x: Number(layer.x) || 0,
      y: Number(layer.y) || 0,
      width: Math.max(24, Number(layer.width) || 24),
      height: Math.max(24, Number(layer.height) || 24),
      rotation: Number(layer.rotation) || 0,
    };
  }

  function applyPoseToLayer(layer, pose) {
    if (!layer || !pose) return;
    layer.x = Math.round(pose.x);
    layer.y = Math.round(pose.y);
    layer.width = Math.max(24, Math.round(pose.width));
    layer.height = Math.max(24, Math.round(pose.height));
    layer.rotation = Math.round((Number(pose.rotation) || 0) * 10) / 10;
  }

  function normalizeKeyframe(kf, fallbackPose) {
    const pose = fallbackPose || { x: 0, y: 0, width: 100, height: 100, rotation: 0 };
    return {
      id: kf.id || uid('kf'),
      t: clamp(Number(kf.t) || 0, 0, 10000),
      x: Number.isFinite(Number(kf.x)) ? Number(kf.x) : pose.x,
      y: Number.isFinite(Number(kf.y)) ? Number(kf.y) : pose.y,
      width: Math.max(24, Number.isFinite(Number(kf.width)) ? Number(kf.width) : pose.width),
      height: Math.max(24, Number.isFinite(Number(kf.height)) ? Number(kf.height) : pose.height),
      rotation: Number.isFinite(Number(kf.rotation)) ? Number(kf.rotation) : pose.rotation,
    };
  }

  function sortKeyframes(list) {
    return (list || []).slice().sort((a, b) => a.t - b.t);
  }

  function ensureKeyframes(layer) {
    if (!layer.keyframes || !Array.isArray(layer.keyframes)) {
      layer.keyframes = [];
    }
    if (!layer.keyframes.length) {
      layer.keyframes.push(normalizeKeyframe({ t: 0 }, poseFromLayer(layer)));
    }
    layer.keyframes = sortKeyframes(layer.keyframes.map((kf) => normalizeKeyframe(kf, poseFromLayer(layer))));
    return layer.keyframes;
  }

  function lerp(a, b, u) {
    return a + (b - a) * u;
  }

  function lerpAngleDeg(a, b, u) {
    let d = ((b - a + 540) % 360) - 180;
    return a + d * u;
  }

  function getLayerPoseAt(layer, tSec) {
    const pose0 = poseFromLayer(layer);
    const kfs = ensureKeyframes(layer);
    if (kfs.length === 1) {
      return {
        x: kfs[0].x,
        y: kfs[0].y,
        width: kfs[0].width,
        height: kfs[0].height,
        rotation: kfs[0].rotation,
      };
    }
    const t = Math.max(0, Number(tSec) || 0);
    if (t <= kfs[0].t) {
      return {
        x: kfs[0].x, y: kfs[0].y, width: kfs[0].width,
        height: kfs[0].height, rotation: kfs[0].rotation,
      };
    }
    const last = kfs[kfs.length - 1];
    if (t >= last.t) {
      return {
        x: last.x, y: last.y, width: last.width,
        height: last.height, rotation: last.rotation,
      };
    }
    let a = kfs[0];
    let b = kfs[1];
    for (let i = 0; i < kfs.length - 1; i += 1) {
      if (t >= kfs[i].t && t <= kfs[i + 1].t) {
        a = kfs[i];
        b = kfs[i + 1];
        break;
      }
    }
    const span = Math.max(0.001, b.t - a.t);
    const u = easeInOut((t - a.t) / span);
    return {
      x: lerp(a.x, b.x, u),
      y: lerp(a.y, b.y, u),
      width: lerp(a.width, b.width, u),
      height: lerp(a.height, b.height, u),
      rotation: lerpAngleDeg(a.rotation, b.rotation, u),
    };
  }

  /** Upsert keyframe at time t from current layer pose (or explicit pose). */
  function upsertKeyframe(layer, tSec, pose) {
    const kfs = ensureKeyframes(layer);
    const t = Math.round((Number(tSec) || 0) * 100) / 100;
    const p = pose || poseFromLayer(layer);
    const existing = kfs.find((kf) => Math.abs(kf.t - t) < 0.05);
    if (existing) {
      existing.x = p.x;
      existing.y = p.y;
      existing.width = p.width;
      existing.height = p.height;
      existing.rotation = p.rotation;
      existing.t = t;
    } else {
      kfs.push(normalizeKeyframe({ t, ...p }, p));
    }
    layer.keyframes = sortKeyframes(kfs);
    return layer.keyframes;
  }

  function removeKeyframe(layer, keyframeId) {
    if (!layer.keyframes) return [];
    layer.keyframes = layer.keyframes.filter((kf) => kf.id !== keyframeId);
    if (!layer.keyframes.length) {
      layer.keyframes.push(normalizeKeyframe({ t: 0 }, poseFromLayer(layer)));
    }
    return layer.keyframes;
  }

  function getLtxEffectAt(layer, tSec) {
    const list = layer.ltxEffects || [];
    return list.find((fx) => {
      const start = Number(fx.start) || 0;
      const dur = Math.max(0.1, Number(fx.duration) || 2);
      return tSec >= start && tSec < start + dur;
    }) || null;
  }

  function hasKeyframeMotion(layer) {
    const kfs = layer.keyframes || [];
    if (kfs.length < 2) return false;
    const a = kfs[0];
    return kfs.some((kf) => (
      Math.abs(kf.x - a.x) > 1
      || Math.abs(kf.y - a.y) > 1
      || Math.abs(kf.width - a.width) > 1
      || Math.abs(kf.height - a.height) > 1
      || Math.abs(kf.rotation - a.rotation) > 0.5
    ));
  }

  global.MediaStudioKeyframes = {
    poseFromLayer,
    applyPoseToLayer,
    ensureKeyframes,
    getLayerPoseAt,
    upsertKeyframe,
    removeKeyframe,
    getLtxEffectAt,
    hasKeyframeMotion,
    sortKeyframes,
    easeInOut,
  };
})(window);
