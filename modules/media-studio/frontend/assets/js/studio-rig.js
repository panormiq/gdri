/**
 * Rigs 2D — squelette personnage, orientation (face/dos/3/4) et vue caméra.
 */
(function (global) {
  const FACING_OPTIONS = [
    { id: 'front', label: 'Face' },
    { id: 'three_quarter_right', label: '3/4 droite' },
    { id: 'right', label: 'Profil droit' },
    { id: 'back', label: 'Dos' },
    { id: 'three_quarter_left', label: '3/4 gauche' },
    { id: 'left', label: 'Profil gauche' },
  ];

  const VIEW_OPTIONS = [
    { id: 'eye_level', label: 'Niveau des yeux' },
    { id: 'high', label: 'Plongée légère' },
    { id: 'top_down', label: 'Vue du dessus' },
    { id: 'low', label: 'Contre-plongée' },
  ];

  const FACING_IDS = FACING_OPTIONS.map((o) => o.id);
  const VIEW_IDS = VIEW_OPTIONS.map((o) => o.id);

  const HUMANOID_SIMPLE = {
    id: 'humanoid-simple',
    label: 'Debout — niveau yeux',
    bones: [
      ['head', 'neck'],
      ['neck', 'spine'],
      ['neck', 'l_shoulder'],
      ['neck', 'r_shoulder'],
      ['l_shoulder', 'l_elbow'],
      ['l_elbow', 'l_hand'],
      ['r_shoulder', 'r_elbow'],
      ['r_elbow', 'r_hand'],
      ['spine', 'pelvis'],
      ['pelvis', 'l_hip'],
      ['pelvis', 'r_hip'],
      ['l_hip', 'l_knee'],
      ['l_knee', 'l_foot'],
      ['r_hip', 'r_knee'],
      ['r_knee', 'r_foot'],
    ],
    defaultPose: {
      head: { x: 0.5, y: 0.06 },
      neck: { x: 0.5, y: 0.12 },
      spine: { x: 0.5, y: 0.28 },
      pelvis: { x: 0.5, y: 0.42 },
      l_shoulder: { x: 0.38, y: 0.16 },
      r_shoulder: { x: 0.62, y: 0.16 },
      l_elbow: { x: 0.32, y: 0.3 },
      r_elbow: { x: 0.68, y: 0.3 },
      l_hand: { x: 0.26, y: 0.44 },
      r_hand: { x: 0.74, y: 0.44 },
      l_hip: { x: 0.44, y: 0.44 },
      r_hip: { x: 0.56, y: 0.44 },
      l_knee: { x: 0.42, y: 0.62 },
      r_knee: { x: 0.58, y: 0.62 },
      l_foot: { x: 0.4, y: 0.88 },
      r_foot: { x: 0.6, y: 0.88 },
    },
    jointLabels: {
      head: 'Tête',
      l_hand: 'Main G',
      r_hand: 'Main D',
      l_foot: 'Pied G',
      r_foot: 'Pied D',
    },
  };

  const HUMANOID_TOPDOWN = {
    id: 'humanoid-topdown',
    label: 'Vue du dessus',
    bones: [
      ['head', 'neck'],
      ['neck', 'spine'],
      ['spine', 'pelvis'],
      ['neck', 'l_shoulder'],
      ['neck', 'r_shoulder'],
      ['l_shoulder', 'l_elbow'],
      ['l_elbow', 'l_hand'],
      ['r_shoulder', 'r_elbow'],
      ['r_elbow', 'r_hand'],
      ['pelvis', 'l_hip'],
      ['pelvis', 'r_hip'],
      ['l_hip', 'l_foot'],
      ['r_hip', 'r_foot'],
    ],
    defaultPose: {
      head: { x: 0.5, y: 0.16 },
      neck: { x: 0.5, y: 0.24 },
      spine: { x: 0.5, y: 0.36 },
      pelvis: { x: 0.5, y: 0.46 },
      l_shoulder: { x: 0.24, y: 0.3 },
      r_shoulder: { x: 0.76, y: 0.3 },
      l_elbow: { x: 0.14, y: 0.36 },
      r_elbow: { x: 0.86, y: 0.36 },
      l_hand: { x: 0.08, y: 0.42 },
      r_hand: { x: 0.92, y: 0.42 },
      l_hip: { x: 0.4, y: 0.5 },
      r_hip: { x: 0.6, y: 0.5 },
      l_foot: { x: 0.34, y: 0.76 },
      r_foot: { x: 0.66, y: 0.76 },
    },
    jointLabels: {
      head: 'Tête',
      l_hand: 'Main G',
      r_hand: 'Main D',
      l_foot: 'Pied G',
      r_foot: 'Pied D',
    },
  };

  const POSE_PROFILE_RIGHT = {
    head: { x: 0.72, y: 0.08 },
    neck: { x: 0.68, y: 0.14 },
    spine: { x: 0.62, y: 0.32 },
    pelvis: { x: 0.58, y: 0.46 },
    l_shoulder: { x: 0.58, y: 0.18 },
    r_shoulder: { x: 0.68, y: 0.18 },
    l_elbow: { x: 0.52, y: 0.32 },
    r_elbow: { x: 0.72, y: 0.34 },
    l_hand: { x: 0.48, y: 0.44 },
    r_hand: { x: 0.76, y: 0.46 },
    l_hip: { x: 0.56, y: 0.48 },
    r_hip: { x: 0.6, y: 0.48 },
    l_knee: { x: 0.54, y: 0.66 },
    r_knee: { x: 0.62, y: 0.66 },
    l_foot: { x: 0.52, y: 0.88 },
    r_foot: { x: 0.64, y: 0.88 },
  };

  const POSE_THREE_QUARTER_RIGHT = {
    head: { x: 0.58, y: 0.06 },
    neck: { x: 0.54, y: 0.12 },
    spine: { x: 0.48, y: 0.28 },
    pelvis: { x: 0.46, y: 0.42 },
    l_shoulder: { x: 0.4, y: 0.16 },
    r_shoulder: { x: 0.58, y: 0.15 },
    l_elbow: { x: 0.34, y: 0.3 },
    r_elbow: { x: 0.62, y: 0.28 },
    l_hand: { x: 0.3, y: 0.42 },
    r_hand: { x: 0.66, y: 0.4 },
    l_hip: { x: 0.44, y: 0.44 },
    r_hip: { x: 0.52, y: 0.44 },
    l_knee: { x: 0.42, y: 0.62 },
    r_knee: { x: 0.54, y: 0.62 },
    l_foot: { x: 0.4, y: 0.88 },
    r_foot: { x: 0.56, y: 0.88 },
  };

  const TEMPLATES = {
    'humanoid-simple': HUMANOID_SIMPLE,
    'humanoid-topdown': HUMANOID_TOPDOWN,
  };

  function clamp01(n) {
    return Math.max(0, Math.min(1, n));
  }

  function getTemplate(templateId) {
    return TEMPLATES[templateId] || HUMANOID_SIMPLE;
  }

  function clonePose(pose) {
    const out = {};
    Object.keys(pose).forEach((key) => {
      out[key] = { x: pose[key].x, y: pose[key].y };
    });
    return out;
  }

  function swapLeftRightJointId(jointId) {
    if (jointId.startsWith('l_')) return `r_${jointId.slice(2)}`;
    if (jointId.startsWith('r_')) return `l_${jointId.slice(2)}`;
    return jointId;
  }

  function mirrorPoseX(pose) {
    const out = {};
    Object.keys(pose).forEach((jointId) => {
      const mirroredId = swapLeftRightJointId(jointId);
      out[mirroredId] = { x: clamp01(1 - pose[jointId].x), y: pose[jointId].y };
    });
    return out;
  }

  function applyViewForeshorten(pose, factor) {
    const out = clonePose(pose);
    Object.keys(out).forEach((jointId) => {
      out[jointId].y = clamp01(0.5 + (out[jointId].y - 0.5) * factor);
    });
    return out;
  }

  function templateForView(view) {
    return view === 'top_down' ? 'humanoid-topdown' : 'humanoid-simple';
  }

  function getFacingBasePose(facing, templateId) {
    const template = getTemplate(templateId);
    if (templateId === 'humanoid-topdown') {
      return clonePose(template.defaultPose);
    }
    if (facing === 'front') return clonePose(template.defaultPose);
    if (facing === 'back') return mirrorPoseX(template.defaultPose);
    if (facing === 'right') return clonePose(POSE_PROFILE_RIGHT);
    if (facing === 'left') return mirrorPoseX(POSE_PROFILE_RIGHT);
    if (facing === 'three_quarter_right') return clonePose(POSE_THREE_QUARTER_RIGHT);
    if (facing === 'three_quarter_left') return mirrorPoseX(POSE_THREE_QUARTER_RIGHT);
    return clonePose(template.defaultPose);
  }

  function buildPoseForOrientation(facing, view) {
    const templateId = templateForView(view);
    let pose = getFacingBasePose(facing, templateId);
    if (view === 'high') pose = applyViewForeshorten(pose, 0.86);
    if (view === 'low') pose = applyViewForeshorten(pose, 1.1);
    return { templateId, pose };
  }

  function normalizeOrientation(orientation) {
    const facing = FACING_IDS.includes(orientation?.facing) ? orientation.facing : 'front';
    const view = VIEW_IDS.includes(orientation?.view) ? orientation.view : 'eye_level';
    return { facing, view };
  }

  function defaultOrientation() {
    return { facing: 'front', view: 'eye_level' };
  }

  function orientationLabel(orientation) {
    const o = normalizeOrientation(orientation);
    const f = FACING_OPTIONS.find((x) => x.id === o.facing);
    const v = VIEW_OPTIONS.find((x) => x.id === o.view);
    return `${f ? f.label : o.facing} · ${v ? v.label : o.view}`;
  }

  function fluxOrientationHint(orientation) {
    const o = normalizeOrientation(orientation);
    const hints = {
      front: 'facing camera, front view',
      back: 'back view, facing away from camera',
      right: 'right side profile view',
      left: 'left side profile view',
      three_quarter_right: 'three-quarter view from the right',
      three_quarter_left: 'three-quarter view from the left',
    };
    const views = {
      eye_level: 'eye-level camera',
      high: 'slight high angle shot',
      top_down: 'top-down bird eye view',
      low: 'low angle shot from below',
    };
    return `${hints[o.facing] || 'front view'}, ${views[o.view] || 'eye-level camera'}`;
  }

  function normalizeRig(rig) {
    const templateId = (rig && rig.template) || 'humanoid-simple';
    const template = getTemplate(templateId);
    const poseIn = (rig && rig.pose) || {};
    const pose = clonePose(template.defaultPose);
    Object.keys(pose).forEach((jointId) => {
      const p = poseIn[jointId];
      if (p && typeof p === 'object') {
        pose[jointId] = {
          x: clamp01(Number(p.x) ?? pose[jointId].x),
          y: clamp01(Number(p.y) ?? pose[jointId].y),
        };
      }
    });
    Object.keys(poseIn).forEach((jointId) => {
      if (!pose[jointId] && poseIn[jointId]) {
        pose[jointId] = {
          x: clamp01(Number(poseIn[jointId].x) || 0.5),
          y: clamp01(Number(poseIn[jointId].y) || 0.5),
        };
      }
    });
    return {
      template: template.id,
      pose,
      showRig: rig?.showRig !== false,
    };
  }

  function defaultCharacterRig() {
    return normalizeRig({ template: 'humanoid-simple' });
  }

  function applyOrientation(layer, orientationPatch) {
    if (!layer) return null;
    layer.orientation = normalizeOrientation({
      ...layer.orientation,
      ...(orientationPatch || {}),
    });
    const { templateId, pose } = buildPoseForOrientation(
      layer.orientation.facing,
      layer.orientation.view
    );
    layer.rig = normalizeRig({
      template: templateId,
      pose,
      showRig: layer.rig?.showRig,
    });
    return layer.orientation;
  }

  function getBboxCenter(layer) {
    const { x, y, width, height } = layer.bbox || { x: 0, y: 0, width: 1, height: 1 };
    return { x: x + width / 2, y: y + height / 2 };
  }

  function normalizeRotation(deg) {
    let d = Number(deg) || 0;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return Math.round(d * 10) / 10;
  }

  function unrotateCanvasPoint(layer, canvasX, canvasY) {
    const { x, y, width, height } = layer.bbox;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const deg = layer.rotation || 0;
    if (!deg) return { x: canvasX, y: canvasY };
    const rad = -deg * (Math.PI / 180);
    const dx = canvasX - cx;
    const dy = canvasY - cy;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
  }

  function characterRotateTransform(layer) {
    const rot = layer.rotation || 0;
    if (!rot) return '';
    const c = getBboxCenter(layer);
    return `rotate(${rot} ${c.x} ${c.y})`;
  }

  function jointToCanvas(layer, jointId) {
    const rig = normalizeRig(layer.rig);
    const p = rig.pose[jointId];
    if (!p || !layer.bbox) return { x: 0, y: 0 };
    const { x, y, width, height } = layer.bbox;
    return {
      x: x + p.x * width,
      y: y + p.y * height,
    };
  }

  function canvasToJoint(layer, canvasX, canvasY) {
    const local = unrotateCanvasPoint(layer, canvasX, canvasY);
    const { x, y, width, height } = layer.bbox;
    const w = Math.max(width, 1);
    const h = Math.max(height, 1);
    return {
      x: clamp01((local.x - x) / w),
      y: clamp01((local.y - y) / h),
    };
  }

  function listJointIds(layer) {
    const rig = normalizeRig(layer.rig);
    const template = getTemplate(rig.template);
    const ids = new Set();
    template.bones.forEach(([a, b]) => {
      ids.add(a);
      ids.add(b);
    });
    return [...ids];
  }

  function resetPose(layer) {
    return applyOrientation(layer, layer.orientation || defaultOrientation());
  }

  const TWO_BONE_LIMBS = [
    { root: 'l_shoulder', mid: 'l_elbow', end: 'l_hand' },
    { root: 'r_shoulder', mid: 'r_elbow', end: 'r_hand' },
    { root: 'l_hip', mid: 'l_knee', end: 'l_foot' },
    { root: 'r_hip', mid: 'r_knee', end: 'r_foot' },
  ];

  function getJointCanvas(layer, pose, jointId) {
    const p = pose[jointId];
    if (!p) return { x: 0, y: 0 };
    const { x, y, width, height } = layer.bbox;
    return { x: x + p.x * width, y: y + p.y * height };
  }

  function setJointCanvas(layer, pose, jointId, canvasPt) {
    pose[jointId] = canvasToJoint(layer, canvasPt.x, canvasPt.y);
  }

  function boneLengthCanvas(layer, pose, jointA, jointB) {
    const pa = getJointCanvas(layer, pose, jointA);
    const pb = getJointCanvas(layer, pose, jointB);
    return Math.hypot(pb.x - pa.x, pb.y - pa.y);
  }

  function captureBoneLengths(layer) {
    const pose = normalizeRig(layer.rig).pose;
    const template = getTemplate(layer.rig.template);
    const lengths = {};
    template.bones.forEach(([a, b]) => {
      lengths[`${a}-${b}`] = boneLengthCanvas(layer, pose, a, b);
    });
    return lengths;
  }

  function captureDragSnapshot(layer) {
    const pose = normalizeRig(layer.rig).pose;
    const jointCanvas = {};
    listJointIds(layer).forEach((jointId) => {
      jointCanvas[jointId] = getJointCanvas(layer, pose, jointId);
    });
    return {
      boneLengths: captureBoneLengths(layer),
      jointCanvas,
    };
  }

  function projectOnCircle(center, radius, point) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.001) return { x: center.x + radius, y: center.y };
    return { x: center.x + (radius * dx) / d, y: center.y + (radius * dy) / d };
  }

  function solveTwoBoneIK(root, target, len1, len2, bendRef) {
    let dx = target.x - root.x;
    let dy = target.y - root.y;
    let dist = Math.hypot(dx, dy);
    const minDist = Math.abs(len1 - len2) + 0.5;
    const maxDist = len1 + len2 - 0.5;
    dist = Math.max(minDist, Math.min(maxDist, dist));
    if (dist < 0.001) {
      dist = 0.001;
      dx = len1;
      dy = 0;
    }

    const cosMid = (len1 * len1 + dist * dist - len2 * len2) / (2 * len1 * dist);
    const angle1 = Math.acos(Math.max(-1, Math.min(1, cosMid)));
    const base = Math.atan2(dy, dx);
    const cross = (bendRef.x - root.x) * dy - (bendRef.y - root.y) * dx;
    const dir = cross >= 0 ? 1 : -1;
    const midAngle = base + dir * angle1;
    const mid = {
      x: root.x + len1 * Math.cos(midAngle),
      y: root.y + len1 * Math.sin(midAngle),
    };
    const end = projectOnCircle(mid, len2, target);
    return { mid, end };
  }

  function limbBoneKeys(limb) {
    return {
      upper: `${limb.root}-${limb.mid}`,
      lower: `${limb.mid}-${limb.end}`,
    };
  }

  function applyLimbIK(layer, pose, limb, endTarget, lengths, snapshot) {
    const keys = limbBoneKeys(limb);
    const len1 = lengths[keys.upper];
    const len2 = lengths[keys.lower];
    if (!len1 || !len2) return;
    const root = getJointCanvas(layer, pose, limb.root);
    const bendRef = snapshot.jointCanvas[limb.mid];
    const { mid, end } = solveTwoBoneIK(root, endTarget, len1, len2, bendRef);
    setJointCanvas(layer, pose, limb.mid, mid);
    setJointCanvas(layer, pose, limb.end, end);
  }

  function applyLimbMidDrag(layer, pose, limb, target, lengths, snapshot) {
    const keys = limbBoneKeys(limb);
    const len1 = lengths[keys.upper];
    const len2 = lengths[keys.lower];
    if (!len1 || !len2) return;
    const root = getJointCanvas(layer, pose, limb.root);
    const mid = projectOnCircle(root, len1, target);
    const end = projectOnCircle(mid, len2, snapshot.jointCanvas[limb.end]);
    setJointCanvas(layer, pose, limb.mid, mid);
    setJointCanvas(layer, pose, limb.end, end);
  }

  function applyLimbRootDrag(layer, pose, limb, target, lengths, snapshot) {
    const parentBone = findParentBone(layer, limb.root);
    let root = target;
    if (parentBone) {
      const parentPt = getJointCanvas(layer, pose, parentBone.parent);
      const len = lengths[`${parentBone.parent}-${limb.root}`];
      if (len) root = projectOnCircle(parentPt, len, target);
    }
    setJointCanvas(layer, pose, limb.root, root);
    applyLimbIK(layer, pose, limb, snapshot.jointCanvas[limb.end], lengths, snapshot);
  }

  function findParentBone(layer, jointId) {
    const template = getTemplate(layer.rig.template);
    for (const [parent, child] of template.bones) {
      if (child === jointId) return { parent, child };
    }
    return null;
  }

  function findChildBones(layer, jointId) {
    const template = getTemplate(layer.rig.template);
    return template.bones.filter(([parent]) => parent === jointId).map(([, child]) => child);
  }

  function repositionChildrenSingleBone(layer, pose, jointId, lengths, snapshot) {
    findChildBones(layer, jointId).forEach((childId) => {
      const key = `${jointId}-${childId}`;
      const len = lengths[key];
      if (!len) return;
      const parentPt = getJointCanvas(layer, pose, jointId);
      const hint = snapshot.jointCanvas[childId];
      const childPt = projectOnCircle(parentPt, len, hint);
      setJointCanvas(layer, pose, childId, childPt);
      const limb = TWO_BONE_LIMBS.find((l) => l.root === childId);
      if (limb) {
        applyLimbIK(layer, pose, limb, snapshot.jointCanvas[limb.end], lengths, snapshot);
      }
      const midLimb = TWO_BONE_LIMBS.find((l) => l.mid === childId);
      if (midLimb) {
        applyLimbIK(layer, pose, midLimb, snapshot.jointCanvas[midLimb.end], lengths, snapshot);
      }
    });
  }

  function applyTorsoJointDrag(layer, pose, jointId, target, lengths, snapshot) {
    const parentBone = findParentBone(layer, jointId);
    let placed = target;
    if (parentBone) {
      const len = lengths[`${parentBone.parent}-${jointId}`];
      if (len) {
        const parentPt = getJointCanvas(layer, pose, parentBone.parent);
        placed = projectOnCircle(parentPt, len, target);
      }
    }
    setJointCanvas(layer, pose, jointId, placed);
    repositionChildrenSingleBone(layer, pose, jointId, lengths, snapshot);
    TWO_BONE_LIMBS.forEach((limb) => {
      if (limb.root === jointId) {
        applyLimbIK(layer, pose, limb, snapshot.jointCanvas[limb.end], lengths, snapshot);
      }
    });
  }

  function applyJointDrag(layer, jointId, canvasX, canvasY, snapshot) {
    if (!layer?.rig?.pose || !snapshot) return;
    const pose = clonePose(normalizeRig(layer.rig).pose);
    const local = unrotateCanvasPoint(layer, canvasX, canvasY);
    const target = { x: local.x, y: local.y };
    const lengths = snapshot.boneLengths;

    const limb = TWO_BONE_LIMBS.find(
      (l) => (l.end === jointId || l.mid === jointId || l.root === jointId)
        && pose[l.root] && pose[l.mid] && pose[l.end]
    );

    if (limb) {
      if (jointId === limb.end) {
        applyLimbIK(layer, pose, limb, target, lengths, snapshot);
      } else if (jointId === limb.mid) {
        applyLimbMidDrag(layer, pose, limb, target, lengths, snapshot);
      } else {
        applyLimbRootDrag(layer, pose, limb, target, lengths, snapshot);
      }
    } else {
      applyTorsoJointDrag(layer, pose, jointId, target, lengths, snapshot);
    }

    layer.rig.pose = pose;
  }

  global.MediaStudioRig = {
    HUMANOID_SIMPLE,
    HUMANOID_TOPDOWN,
    TEMPLATES,
    FACING_OPTIONS,
    VIEW_OPTIONS,
    getTemplate,
    normalizeRig,
    normalizeOrientation,
    defaultOrientation,
    defaultCharacterRig,
    applyOrientation,
    orientationLabel,
    fluxOrientationHint,
    jointToCanvas,
    canvasToJoint,
    listJointIds,
    resetPose,
    clonePose,
    captureDragSnapshot,
    applyJointDrag,
    captureBoneLengths,
    getBboxCenter,
    normalizeRotation,
    characterRotateTransform,
    unrotateCanvasPoint,
  };
})(window);
