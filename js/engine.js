/**
 * js/engine.js
 * Turtle-style instruction engine for counted Soof geometry.
 */

function generateUUID() {
  return Math.random().toString(36).slice(2, 10);
}

class Stitch {
  constructor({ from, to, color, order = 0, motifId = 'free', layer = 'fill', generated = true, narration = '' }) {
    this.id = generateUUID();
    this.from = [...from];
    this.to = [...to];
    this.color = color;
    this.order = order;
    this.motifId = motifId;
    this.layer = layer;
    this.generated = generated;
    this.narration = narration;
    this.locked = false;
    this.selected = false;
  }

  get warpDelta() {
    return this.to[0] - this.from[0];
  }

  get weftDelta() {
    return this.to[1] - this.from[1];
  }
}

class SoofInterpreter {
  constructor() {
    this.reset();
  }

  reset() {
    this.cursor = [0, 0];
    this.currentColor = 'var(--crimson)';
    this.currentLayer = 'fill';
    this.stitches = [];
    this.stitchCount = 0;
  }

  run(pattern, transform = {}) {
    this.reset();
    const motifId = pattern.metadata.id || generateUUID();

    for (const inst of pattern.instructions) {
      this.executeInstruction(inst, motifId, transform);
    }

    return [...this.stitches];
  }

  executeInstruction(inst, motifId = 'motif', transform = {}) {
    switch (inst.type) {
      case 'START':
        this.cursor = this.transformPoint(inst.pos, transform);
        return null;

      case 'COLOR':
        this.currentColor = inst.color;
        return null;

      case 'LAYER':
        this.currentLayer = inst.layer || 'fill';
        return null;

      case 'MOVE': {
        const delta = this.transformDelta([inst.warp, inst.weft], transform);
        this.cursor = [this.cursor[0] + delta[0], this.cursor[1] + delta[1]];
        return null;
      }

      case 'STITCH':
      case 'STITCH_TO': {
        const delta = this.transformDelta([inst.warp, inst.weft], transform);
        const target = [this.cursor[0] + delta[0], this.cursor[1] + delta[1]];
        const stitch = new Stitch({
          from: this.cursor,
          to: target,
          color: this.currentColor,
          order: this.stitchCount++,
          motifId,
          layer: inst.layer || this.currentLayer,
          generated: true,
          narration: inst.narration || ''
        });

        this.stitches.push(stitch);
        this.cursor = target;
        return stitch;
      }

      default:
        return null;
    }
  }

  transformPoint(point, transform = {}) {
    const scale = transform.scale || 1;
    const mirrorW = transform.mirrorW ? -1 : 1;
    const mirrorF = transform.mirrorF ? -1 : 1;
    const rotate = ((transform.rotate || 0) % 360 + 360) % 360;
    let w = point[0] * scale * mirrorW;
    let f = point[1] * scale * mirrorF;

    if (rotate === 90) [w, f] = [-f, w];
    if (rotate === 180) [w, f] = [-w, -f];
    if (rotate === 270) [w, f] = [f, -w];

    return [w, f];
  }

  transformDelta(delta, transform = {}) {
    return this.transformPoint(delta, transform);
  }
}

const Engine = new SoofInterpreter();

/**
 * computeSatinFill(vertices, color, layer, orderOffset)
 *
 * Pure scanline polygon fill solver for Soof satin stitches.
 * Shoots a horizontal ray at every integer weft row within the bounding
 * box of the polygon, collects edge intersections (even-odd rule), and
 * generates one Stitch per interior segment — mirroring how a Soof
 * artisan lays parallel horizontal satin rows inside a counted boundary.
 *
 * @param {Array<[number,number]>} vertices  – [[w,f], ...] polygon corners (grid coords)
 * @param {string}                 color     – CSS colour / var() string
 * @param {string}                 layer     – 'fill' | 'outline'
 * @param {number}                 orderOffset – base order index for stitches
 * @returns {Stitch[]}
 */
function computeSatinFill(vertices, color, layer = 'fill', orderOffset = 0, density = 1, outline = true) {
  if (!vertices || vertices.length < 3) return [];

  const n = vertices.length;

  // ── 1. Weft bounding box ──────────────────────────────────────────────────
  let minF = Infinity, maxF = -Infinity;
  for (const [, f] of vertices) {
    if (f < minF) minF = f;
    if (f > maxF) maxF = f;
  }

  const stitches = [];
  let stitchOrder = orderOffset;

  // ── 1.5 Outline Generation ────────────────────────────────────────────────
  if (outline) {
    for (let i = 0; i < n; i++) {
      const v1 = vertices[i];
      const v2 = vertices[(i + 1) % n];
      stitches.push(new Stitch({
        from: [...v1],
        to: [...v2],
        color,
        order: stitchOrder++,
        motifId: 'satin-outline',
        layer: 'outline',
        generated: true,
        narration: 'Outline boundary'
      }));
    }
  }

  // ── 2. Scanline loop — one weft row at a time ─────────────────────────────
  for (let rowF = minF; rowF <= maxF; rowF += density) {
    const intersections = [];

    // ── 3. Edge intersection test (even-odd) ────────────────────────────────
    for (let i = 0; i < n; i++) {
      const [w1, f1] = vertices[i];
      const [w2, f2] = vertices[(i + 1) % n];

      // Skip horizontal edges (they lie on the scanline, not crossing it)
      if (f1 === f2) continue;

      // Does this edge span the current row?
      const fMin = Math.min(f1, f2);
      const fMax = Math.max(f1, f2);

      // Use half-open interval [fMin, fMax) to avoid counting shared vertices twice
      if (rowF < fMin || rowF >= fMax) continue;

      // Linear interpolation for the warp (x) coordinate of the intersection
      const wIntersect = w1 + (rowF - f1) * (w2 - w1) / (f2 - f1);
      intersections.push(wIntersect);
    }

    // ── 4. Sort intersections and pair them into stitches ────────────────────
    intersections.sort((a, b) => a - b);

    for (let k = 0; k + 1 < intersections.length; k += 2) {
      const wFrom = Math.round(intersections[k]);
      const wTo   = Math.round(intersections[k + 1]);

      // Skip zero-length or degenerate segments
      if (wFrom === wTo) continue;

      stitches.push(new Stitch({
        from:      [wFrom, rowF],
        to:        [wTo,   rowF],
        color,
        order:     stitchOrder++,
        motifId:   'satin-fill',
        layer,
        generated: true,
        narration: `Satin fill row ${rowF}`
      }));
    }
  }

  return stitches;
}

