/**
 * Prompt Flux pour calques personnage (mesh + orientation).
 */

const FACING_HINTS = {
  front: 'facing camera, front view, full body',
  back: 'back view, facing away from camera, full body',
  right: 'right side profile view, full body',
  left: 'left side profile view, full body',
  three_quarter_right: 'three-quarter view from the right, full body',
  three_quarter_left: 'three-quarter view from the left, full body',
};

const VIEW_HINTS = {
  eye_level: 'eye-level camera',
  high: 'slight high angle shot',
  top_down: 'top-down bird eye view, seen from above',
  low: 'low angle shot from below',
};

function normalizeOrientation(orientation = {}) {
  const facing = FACING_HINTS[orientation.facing] ? orientation.facing : 'front';
  const view = VIEW_HINTS[orientation.view] ? orientation.view : 'eye_level';
  return { facing, view };
}

function buildCharacterPrompt(userPrompt, orientation = {}, options = {}) {
  const base = String(userPrompt || '').trim() || 'person, full body';
  const o = normalizeOrientation(orientation);
  const parts = [
    base,
    'single human character',
    'full body visible, not cropped',
    FACING_HINTS[o.facing],
    VIEW_HINTS[o.view],
    'clean silhouette, no background scene',
  ];
  if (options.hasReference) {
    parts.push('match the appearance and style of the reference photo');
  }
  return parts.join(', ');
}

module.exports = {
  buildCharacterPrompt,
  normalizeOrientation,
  fluxOrientationHint: (orientation) => {
    const o = normalizeOrientation(orientation);
    return `${FACING_HINTS[o.facing]}, ${VIEW_HINTS[o.view]}`;
  },
};
