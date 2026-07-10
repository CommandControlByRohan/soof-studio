/**
 * js/thread-renderer.js
 * Pixel-level embroidery thread renderer using Canvas 2D.
 *
 * Each stitch is rendered as N parallel micro-fibers with:
 *   – Noise-displaced paths for organic fiber texture
 *   – Cylindrical cross-section shading (darker edges, brighter centre)
 *   – Specular highlight band simulating twisted silk sheen
 *   – Per-fiber alpha variation for depth
 *
 * Architecture: sits behind the SVG layer.
 *   SVG  → grid, ghosts, overlays, cursor, counting HUD
 *   Canvas → permanent stitch rendering at pixel fidelity
 */

const ThreadRenderer = {

  canvas: null,
  ctx: null,
  dpr: window.devicePixelRatio || 1,

  // Pre-computed deterministic noise table
  _noiseTable: null,
  _colorCache: {},
  _repaintScheduled: false,

  // ─── Configurable parameters ──────────────────────────────

  /** Light direction in radians (225° = upper-left, matching the SVG filter) */
  LIGHT_AZIMUTH: Math.PI * 1.25,

  /** Number of parallel micro-fibers per stitch */
  FILL_FIBER_COUNT: 16,
  OUTLINE_FIBER_COUNT: 10,

  /** Total thread bundle width in SVG coordinate units */
  FILL_WIDTH_SVG: 7.5,
  OUTLINE_WIDTH_SVG: 4,

  /** Stitch animation duration in milliseconds */
  ANIM_DURATION: 2500,

  // ─── Initialisation ───────────────────────────────────────

  init() {
    this.canvas = document.getElementById('stitch-canvas');
    if (!this.canvas) {
      console.warn('ThreadRenderer: #stitch-canvas not found');
      return;
    }
    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this._buildNoiseTable();
    this.resize();
  },

  // ─── Deterministic Noise ──────────────────────────────────

  _buildNoiseTable() {
    const LEN = 512;
    this._noiseTable = new Float32Array(LEN);
    // Seeded LCG so fibers are stable across repaints
    let s = 42;
    for (let i = 0; i < LEN; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      this._noiseTable[i] = (s / 2147483648) - 1.0;   // [-1, 1]
    }
  },

  /**
   * Smooth 1D noise with per-fiber seed.
   * @param {number} x  – position along fiber (0 – ~10 typically)
   * @param {number} seed – unique per fiber (stitchOrder*31 + fiberIndex)
   */
  _noise(x, seed) {
    const LEN = this._noiseTable.length;
    const offset = (((seed * 127 + 53) % LEN) + LEN) % LEN;
    const xi = Math.floor(x);
    const xf = x - xi;
    const i = (((xi + offset) % LEN) + LEN) % LEN;
    const a = this._noiseTable[i];
    const b = this._noiseTable[(i + 1) % LEN];
    const t = xf * xf * (3 - 2 * xf);               // smoothstep
    return a + (b - a) * t;
  },

  // ─── Color Parsing (cached) ───────────────────────────────

  _parseColor(colorStr) {
    if (this._colorCache[colorStr]) return this._colorCache[colorStr];

    let resolved = colorStr;
    if (colorStr.startsWith('var(')) {
      const varName = colorStr.match(/var\(([^)]+)\)/)?.[1];
      if (varName) {
        resolved = getComputedStyle(document.documentElement)
          .getPropertyValue(varName).trim();
      }
    }

    // Resolve any CSS colour string to RGBA via 1×1 canvas
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = 1;
    const tc = tmp.getContext('2d');
    tc.fillStyle = resolved;
    tc.fillRect(0, 0, 1, 1);
    const [r, g, b] = tc.getImageData(0, 0, 1, 1).data;
    const result = { r, g, b };
    this._colorCache[colorStr] = result;
    return result;
  },

  // ─── Coordinate Transform ─────────────────────────────────

  /** Map SVG-viewBox coordinates → canvas pixel coordinates */
  _svgToCanvas(svgX, svgY) {
    const vb = UI.svg.viewBox.baseVal;
    return {
      x: (svgX - vb.x) * (this.canvas.width / vb.width),
      y: (svgY - vb.y) * (this.canvas.height / vb.height)
    };
  },

  /** Map grid (warp, weft) → canvas pixel coordinates */
  _gridToCanvas(w, f) {
    const svgPt = UI.gridToPx(w, f);
    return this._svgToCanvas(svgPt.x, svgPt.y);
  },

  // ─── Canvas Sizing ────────────────────────────────────────

  resize() {
    if (!this.canvas) return;
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.style.width  = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.canvas.width  = Math.floor(rect.width  * this.dpr);
    this.canvas.height = Math.floor(rect.height * this.dpr);
  },

  // ─── Single-Stitch Rendering ──────────────────────────────

  /**
   * Render one stitch as a bundle of N micro-fibers.
   * Each fiber follows the stitch direction with slight noise displacement,
   * cylindrical shading, and a specular highlight band.
   */
  drawStitch(stitch, drawProgress = 1.0) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    const p1 = this._gridToCanvas(stitch.from[0], stitch.from[1]);
    const p2 = this._gridToCanvas(stitch.to[0], stitch.to[1]);

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;

    // Unit vectors: along stitch and perpendicular
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;                                    // perpendicular x
    const ny =  ux;                                    // perpendicular y

    // Thread parameters
    const isOutline = stitch.layer === 'outline';
    const fiberCount = isOutline ? this.OUTLINE_FIBER_COUNT : this.FILL_FIBER_COUNT;
    const threadWidthSVG = isOutline ? this.OUTLINE_WIDTH_SVG : this.FILL_WIDTH_SVG;

    // Scale thread width to canvas pixels using the viewBox→canvas ratio
    const vb = UI.svg.viewBox.baseVal;
    const pixelsPerSVGUnit = this.canvas.width / vb.width;
    const threadWidthPx = threadWidthSVG * pixelsPerSVGUnit;

    const color = this._parseColor(stitch.color);

    // ── Light / specular geometry ──
    const threadPerp = Math.atan2(ny, nx);
    const lightDot = Math.cos(threadPerp - this.LIGHT_AZIMUTH);
    const specularCenter = 0.5 + lightDot * 0.25;     // where highlight sits (0–1)

    // Segments per fiber (more = smoother wavy path)
    const segmentCount = Math.max(10, Math.ceil(len / 3));

    // Noise amplitude (perpendicular wiggle in canvas px)
    const noiseAmp = (threadWidthPx / fiberCount) * 0.55;

    // Deterministic seed for this stitch
    const stitchSeed = (stitch.order || 0) * 31;

    // ── Puncture Holes (where needle enters fabric) ──
    const drawPuncture = (p) => {
      ctx.beginPath();
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, threadWidthPx * 0.6);
      grad.addColorStop(0, 'rgba(0,0,0,0.5)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.arc(p.x, p.y, threadWidthPx * 0.6, 0, Math.PI * 2);
      ctx.fill();
    };
    ctx.globalCompositeOperation = 'source-over';
    drawPuncture(p1);
    if (drawProgress > 0.99) drawPuncture(p2);

    // ── Axis Snaking / Slack Physics ──
    const slack = Math.pow(1 - drawProgress, 2);
    const getAxisPoint = (t) => {
      const bx = p1.x + dx * t;
      const by = p1.y + dy * t;
      if (slack === 0) return { x: bx, y: by };
      
      const macroWobble = Math.sin(t * Math.PI * 3) * (threadWidthPx * 1.5);
      const macroBow = Math.sin(t * Math.PI) * (threadWidthPx * 2.5);
      const snakeNoise = (this._noise(t * 3, stitchSeed) - 0.5) * threadWidthPx * 3;
      
      const offset = (macroWobble + macroBow + snakeNoise) * slack;
      return { x: bx + nx * offset, y: by + ny * offset };
    };

    // ── Opaque Core (fills gaps between fibers, shortened to prevent edge leak) ──
    const coreShortenT = (threadWidthPx * 0.3) / len;
    if (drawProgress > coreShortenT * 2) {
      const coreStartT = coreShortenT;
      const coreEndT = Math.max(coreStartT, drawProgress - coreShortenT);
      
      ctx.beginPath();
      const coreSegments = Math.max(1, Math.floor(segmentCount * (coreEndT - coreStartT)));
      for (let s = 0; s <= coreSegments; s++) {
        const t = coreStartT + (s / coreSegments) * (coreEndT - coreStartT);
        const pt = getAxisPoint(t);
        if (s === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      const coreBrightness = 0.55;
      const cr = Math.round(color.r * coreBrightness);
      const cg = Math.round(color.g * coreBrightness);
      const cb = Math.round(color.b * coreBrightness);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.95)`;
      ctx.lineWidth = threadWidthPx * 0.50; // Narrower core hides in the center
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // ── Twist configuration ──
    const numPlies = 2; // Two main strands twisted together
    // One full twist (360 degrees) every 4.5 times the thread width
    const twistWavelength = threadWidthPx * 4.5;
    const totalTwists = len / twistWavelength;

    // ── Draw each fiber ──
    for (let fi = 0; fi < fiberCount; fi++) {
      const normalPos = fiberCount > 1
        ? fi / (fiberCount - 1)
        : 0.5;
      // Wider spread allows outer fibers to create a soft, textured border
      // Introduce looseness that tightens as drawProgress approaches 1.0
      const looseness = 1 + Math.pow(1 - drawProgress, 2) * 2.5;
      const baseOffset = (normalPos - 0.5) * (threadWidthPx * 0.80) * looseness;
      
      const plyIndex = fi % numPlies;
      const plyPhaseOffset = (plyIndex / numPlies) * Math.PI * 2;

      // Cylindrical cross-section shading: bright at centre, dark at edges
      const cylinder = Math.cos((normalPos - 0.5) * Math.PI);

      // Specular highlight: narrow Gaussian-like peak
      const specDist = Math.abs(normalPos - specularCenter);
      const specular = Math.max(0, 1 - specDist * 5) * 0.4;

      // Final per-pixel colour
      const brightness = 0.30 + cylinder * 0.70;
      const r = Math.min(255, Math.round(color.r * brightness + 255 * specular));
      const g = Math.min(255, Math.round(color.g * brightness + 255 * specular));
      const b = Math.min(255, Math.round(color.b * brightness + 255 * specular));
      const alpha = 0.60 + cylinder * 0.40;

      const fiberSeed = stitchSeed + fi;

      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
      ctx.lineWidth = Math.max(0.5, (threadWidthPx / fiberCount) * 0.95); // Thinner fibers keep plies distinct
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const drawnSegments = Math.max(1, Math.floor(segmentCount * drawProgress));
      for (let s = 0; s <= drawnSegments; s++) {
        const t = s / segmentCount;
        const pt = getAxisPoint(t);
        const bx = pt.x;
        const by = pt.y;

        // Twist angle based on actual distance traveled
        const twistAngle = totalTwists * t * Math.PI * 2 + plyPhaseOffset;
        
        // Damp the twist offset to 0 at endpoints using a sine envelope so fibers converge in the puncture hole
        const envelope = Math.sin(t * Math.PI);
        const twistWiggle = Math.sin(twistAngle) * (threadWidthPx * 0.12) * envelope;
        
        const fiberOffset = baseOffset * envelope + twistWiggle;

        // Noise displacement perpendicular to stitch direction (amplified when loose)
        const nv = this._noise(t * 8, fiberSeed) * noiseAmp * envelope * looseness;

        const fx = bx + nx * (fiberOffset + nv);
        const fy = by + ny * (fiberOffset + nv);

        if (s === 0) ctx.moveTo(fx, fy);
        else ctx.lineTo(fx, fy);
      }
      ctx.stroke();
    }

    // ── Silk sheen overlay — thin white line along specular band ──
    const sheenOffset = (specularCenter - 0.5) * threadWidthPx;
    ctx.beginPath();
    const drawnSheenSegments = Math.max(1, Math.floor(segmentCount * drawProgress));
    for (let s = 0; s <= drawnSheenSegments; s++) {
      const t = s / segmentCount;
      const pt = getAxisPoint(t);
      const bx = pt.x;
      const by = pt.y;
      
      const envelope = Math.sin(t * Math.PI);
      const twistAngle = totalTwists * t * Math.PI * 2;
      const twistWiggle = Math.sin(twistAngle) * (threadWidthPx * 0.12) * envelope;
      
      const fx = bx + nx * (sheenOffset * envelope + twistWiggle);
      const fy = by + ny * (sheenOffset * envelope + twistWiggle);
      
      if (s === 0) ctx.moveTo(fx, fy);
      else ctx.lineTo(fx, fy);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = Math.max(0.8, threadWidthPx * 0.07);
    ctx.lineCap = 'round';
    ctx.stroke();

    // ── Subtle drop-shadow beneath the thread bundle ──
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.beginPath();
    const drawnShadowSegments = Math.max(1, Math.floor(segmentCount * drawProgress));
    for (let s = 0; s <= drawnShadowSegments; s++) {
      const t = s / segmentCount;
      const pt = getAxisPoint(t);
      const sx = pt.x + 1.2 * pixelsPerSVGUnit;
      const sy = pt.y + 1.8 * pixelsPerSVGUnit;
      if (s === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = threadWidthPx * 0.9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.filter = 'blur(2px)';
    ctx.stroke();
    ctx.restore();
  },

  // ─── Full Repaint ─────────────────────────────────────────

  /**
   * Clear canvas and redraw all stitches.
   * Called on state changes, undo/redo, pan, zoom, resize, and view flip.
   */
  fullRepaint(stitches) {
    if (!this.ctx) return;
    this.resize();
    this.clear();

    if (!stitches || stitches.length === 0) return;

    // In FRONT view, hide outline stitches (show only the finished satin)
    const visible = AppState.view === 'FRONT'
      ? stitches.filter(s => s.layer === 'fill')
      : stitches;

    const now = performance.now();
    let needsAnimation = false;

    visible
      .slice()
      .sort((a, b) => a.order - b.order)
      .forEach(s => {
         if (s._isNew) {
            s._animStart = now + ((s._animOrder || 0) * this.ANIM_DURATION);
            s._animProgress = 0;
            s._isNew = false;
         }

         if (s._animProgress !== undefined && s._animProgress < 1.0) {
            if (now >= s._animStart) {
               s._animProgress = Math.max(0, Math.min(1.0, (now - s._animStart) / this.ANIM_DURATION));
            } else {
               s._animProgress = 0;
            }
            if (s._animProgress < 1.0) needsAnimation = true;
         }

         if (s._animProgress === undefined || s._animProgress > 0) {
            this.drawStitch(s, s._animProgress !== undefined ? s._animProgress : 1.0);
         }
      });

    if (needsAnimation) {
       requestAnimationFrame(() => this.fullRepaint(stitches));
    }
  },

  clear() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  },

  // ─── Throttled Repaint (for pan / zoom) ───────────────────

  /**
   * Schedule a repaint on the next animation frame.
   * Coalesces rapid calls from mousemove/wheel into one repaint per frame.
   */
  scheduleRepaint() {
    if (this._repaintScheduled) return;
    this._repaintScheduled = true;
    requestAnimationFrame(() => {
      this._repaintScheduled = false;
      this.fullRepaint(AppState.stitches);
    });
  }
};
