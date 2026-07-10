/**
 * js/ui.js
 * SVG rendering, coordinate conversion, overlays, and panel helpers.
 * Realism features: woven fabric grid, satin thread rendering, float visualization, flip toggle.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const UI = {
  svg: document.getElementById('canvas-svg'),
  layerFabric: document.getElementById('layer-fabric'),
  layerGrid: document.getElementById('layer-grid'),
  layerGhost: document.getElementById('layer-ghost'),
  layerStitches: document.getElementById('layer-stitches'),
  layerFloats: document.getElementById('layer-floats'),
  layerOverlay: document.getElementById('layer-overlay'),
  cursorEl: document.getElementById('needle-cursor'),
  coordDisplay: document.getElementById('coord-display'),
  radialPopover: document.getElementById('radial-popover'),
  leftPanel: document.getElementById('left-panel-content'),
  rightPanel: document.getElementById('right-panel-content'),
  bulkMeter: document.getElementById('bulk-meter'),
  bulkBar: document.getElementById('bulk-bar'),
  bulkLabel: document.getElementById('bulk-label'),

  // Feature 3: Woven Fabric Grid
  renderGrid() {
    this.layerGrid.innerHTML = '';
    this.layerFabric.innerHTML = '';

    const { cols, rows, cellPx } = AppState.grid;
    const width = cols * cellPx;
    const height = rows * cellPx;
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Draw weft threads (horizontal)
    for (let row = 0; row <= rows; row++) {
      const isEven = row % 2 === 0;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', 0);
      line.setAttribute('y1', row * cellPx);
      line.setAttribute('x2', width);
      line.setAttribute('y2', row * cellPx);
      line.setAttribute('class', 'fabric-weft');
      line.setAttribute('stroke-width', isEven ? '1.4' : '1.0');
      this.layerFabric.appendChild(line);
    }

    // Draw warp threads (vertical) with over-under alternation
    for (let col = 0; col <= cols; col++) {
      const isEven = col % 2 === 0;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', col * cellPx);
      line.setAttribute('y1', 0);
      line.setAttribute('x2', col * cellPx);
      line.setAttribute('y2', height);
      line.setAttribute('class', isEven ? 'fabric-warp warp-over' : 'fabric-warp warp-under');
      line.setAttribute('stroke-width', isEven ? '1.6' : '1.0');
      this.layerFabric.appendChild(line);
    }

    // Extract motif vertices for highlighting in LEARN/PRACTICE mode
    const motifVertices = new Set();
    if ((AppState.mode === 'LEARN' || AppState.mode === 'PRACTICE') && AppState.targetStitches) {
      for (const s of AppState.targetStitches) {
        motifVertices.add(`${s.from[0]},${s.from[1]}`);
        motifVertices.add(`${s.to[0]},${s.to[1]}`);
      }
    }

    // Interstice dots (needle insertion points) — shown on reverse only
    for (let col = 0; col <= cols; col++) {
      for (let row = 0; row <= rows; row++) {
        const dot = document.createElementNS(SVG_NS, 'circle');
        
        const gridW = col - AppState.grid.originW;
        const gridF = row - AppState.grid.originF;
        const isOrigin = gridW === 0 && gridF === 0;
        const isVertex = motifVertices.has(`${gridW},${gridF}`);
        
        dot.setAttribute('cx', col * cellPx);
        dot.setAttribute('cy', row * cellPx);
        dot.setAttribute('r', isVertex ? 2.5 : isOrigin ? 3.5 : 1.8);
        
        let cls = 'grid-dot';
        if (isOrigin) cls += ' origin';
        if (isVertex) cls += ' highlight-vertex';
        dot.setAttribute('class', cls);
        dot.setAttribute('data-coord', `${col},${row}`);
        
        this.layerGrid.appendChild(dot);
      }
    }
  },

  // Coordinate Conversion
  gridToPx(w, f) {
    const { originW, originF, cellPx } = AppState.grid;
    return {
      x: (w + originW) * cellPx,
      y: (f + originF) * cellPx
    };
  },

  /**
   * Convert a mouse event to raw SVG viewBox coordinates WITHOUT grid snapping.
   * Used for smooth rubber-band preview that follows the cursor pixel-accurately.
   */
  eventToSvgPx(event) {
    const rect = this.svg.getBoundingClientRect();
    const viewBox = this.svg.viewBox.baseVal;
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX + viewBox.x,
      y: (event.clientY - rect.top)  * scaleY + viewBox.y
    };
  },

  pxToGrid(px, py) {
    const { originW, originF, cellPx } = AppState.grid;
    return {
      w: Math.round(px / cellPx) - originW,
      f: Math.round(py / cellPx) - originF
    };
  },

  eventToGrid(event) {
    const rect = this.svg.getBoundingClientRect();
    const viewBox = this.svg.viewBox.baseVal;
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;

    const svgX = (event.clientX - rect.left) * scaleX + viewBox.x;
    const svgY = (event.clientY - rect.top) * scaleY + viewBox.y;

    return this.pxToGrid(svgX, svgY);
  },

  isInBounds(w, f) {
    return (
      w >= -AppState.grid.originW &&
      w <= AppState.grid.cols - AppState.grid.originW &&
      f >= -AppState.grid.originF &&
      f <= AppState.grid.rows - AppState.grid.originF
    );
  },

  updateCursor(event) {
    if (AppState.view === 'FRONT') return;
    const { w, f } = this.eventToGrid(event);
    if (!this.isInBounds(w, f)) return;

    AppState.cursor.w = w;
    AppState.cursor.f = f;

    const snapped = this.gridToPx(w, f);
    const rect = this.svg.getBoundingClientRect();
    const viewBox = this.svg.viewBox.baseVal;
    const left = ((snapped.x - viewBox.x) / viewBox.width) * rect.width;
    const top = ((snapped.y - viewBox.y) / viewBox.height) * rect.height;
    this.cursorEl.style.left = `${left}px`;
    this.cursorEl.style.top = `${top}px`;
    this.coordDisplay.innerText = `Warp ${w}  Weft ${f}`;
    
    this.drawPendingTrail(w, f);
  },

  triggerFabricPulse(w, f) {
    const col = w + AppState.grid.originW;
    const row = f + AppState.grid.originF;
    const dot = this.layerGrid.querySelector(`[data-coord="${col},${row}"]`);
    if (dot) {
      dot.classList.remove('pulse');
      void dot.offsetWidth; // trigger reflow
      dot.classList.add('pulse');
    }
  },

  drawPendingTrail(w, f) {
    let line = document.getElementById('pending-trail');
    if (!AppState.pendingThreadAnchor) {
      if (line) line.remove();
      return;
    }
    if (!line) {
      line = document.createElementNS(SVG_NS, 'line');
      line.id = 'pending-trail';
      line.setAttribute('stroke', AppState.currentColor || 'var(--emerald)');
      line.setAttribute('stroke-width', '4');
      line.setAttribute('stroke-dasharray', '8, 8');
      line.setAttribute('stroke-opacity', '0.65');
      this.layerOverlay.appendChild(line);
    }
    // Only update color if there's a current color, else default
    line.setAttribute('stroke', AppState.currentColor || 'var(--emerald)');
    const p1 = this.gridToPx(AppState.pendingThreadAnchor[0], AppState.pendingThreadAnchor[1]);
    const p2 = this.gridToPx(w, f);
    line.setAttribute('x1', p1.x);
    line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x);
    line.setAttribute('y2', p2.y);
  },

  // Feature 2: Satin Fill rendering — parallel micro-strands simulating embroidery thread ply
  createSatinFill(stitch) {
    const p1 = this.gridToPx(stitch.from[0], stitch.from[1]);
    const p2 = this.gridToPx(stitch.to[0], stitch.to[1]);
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('data-id', stitch.id);
    group.setAttribute('class', 'stitch-satin-group');

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return null;

    // Perpendicular unit vector (offset direction across the thread width)
    const nx = -dy / len;
    const ny = dx / len;

    const STRAND_SPACING = 1.6;  // px between strand centres in SVG units
    const STRAND_COUNT = 5;
    const HALF = (STRAND_COUNT - 1) / 2;

    // Solid backing — ensures the stitch is visible even if CSS var colour is slow to resolve
    const base = document.createElementNS(SVG_NS, 'path');
    base.setAttribute('d', `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`);
    base.style.stroke = stitch.color;   // style property resolves CSS variables reliably
    base.setAttribute('stroke-width', String(STRAND_SPACING * STRAND_COUNT));
    base.setAttribute('fill', 'none');
    base.setAttribute('opacity', '0.9');
    base.setAttribute('stroke-linecap', 'round');
    group.appendChild(base);

    // Individual strand highlights — lighter lines creating a twisted-ply look
    for (let i = 0; i < STRAND_COUNT; i++) {
      const offset = (i - HALF) * STRAND_SPACING;
      const isCenter = i === Math.floor(HALF);
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d',
        `M ${p1.x + nx * offset} ${p1.y + ny * offset}` +
        ` L ${p2.x + nx * offset} ${p2.y + ny * offset}`);
      path.style.stroke = stitch.color;
      path.setAttribute('stroke-width', isCenter ? '2.2' : '1.1');
      path.setAttribute('fill', 'none');
      path.setAttribute('opacity', isCenter ? '1' : '0.55');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('filter', 'url(#thread-texture)');
      group.appendChild(path);
    }

    // Silk sheen — thin white highlight on the centre strand
    const sheen = document.createElementNS(SVG_NS, 'path');
    sheen.setAttribute('d', `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`);
    sheen.setAttribute('stroke', 'rgba(255,255,255,0.3)');
    sheen.setAttribute('stroke-width', '1.0');
    sheen.setAttribute('fill', 'none');
    sheen.setAttribute('stroke-linecap', 'round');
    group.appendChild(sheen);

    return group;
  },

  createStitchSVG(stitch, options = {}) {
    const p1 = this.gridToPx(stitch.from[0], stitch.from[1]);
    const p2 = this.gridToPx(stitch.to[0], stitch.to[1]);

    // Feature 2: Satin for fill-layer in FRONT view
    if (stitch.layer === 'fill' && !options.className?.includes('ghost') && AppState.view === 'FRONT') {
      const satin = this.createSatinFill(stitch);
      if (satin) return satin;
    }

    const path = document.createElementNS(SVG_NS, 'path');
    // Fill stitches are thick and bold; outlines are thinner
    const width = stitch.layer === 'outline' ? 3.0 : 5.5;

    path.setAttribute('d', `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`);
    path.style.stroke = stitch.color;  // style.stroke resolves CSS variables reliably
    path.setAttribute('stroke-width', options.width || width);
    path.setAttribute('fill', 'none');
    path.setAttribute('opacity', options.opacity ?? 1);
    path.setAttribute('class', ['stitch', stitch.layer, options.className || ''].join(' ').trim());
    path.setAttribute('data-id', stitch.id);
    // Apply high-fidelity thread texture filter to active design stitches
    if (!options.className?.includes('ghost')) {
      path.setAttribute('filter', 'url(#thread-texture)');
    }

    if (options.animate) {
      const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      path.style.strokeDasharray = length;
      path.style.strokeDashoffset = length;
      path.classList.add('path-anim');
    }

    return path;
  },

  renderStitches() {
    // SVG stitch layer is now unused — pixel-level canvas handles all stitch rendering
    this.layerStitches.innerHTML = '';

    // Route to the Canvas thread renderer for pixel-level embroidery
    if (typeof ThreadRenderer !== 'undefined' && ThreadRenderer.ctx) {
      ThreadRenderer.fullRepaint(AppState.stitches);
    }

    this.renderFloats();
    this.updateBulkMeter();
  },

  // Feature 4: Float Thread Visualization
  renderFloats() {
    this.layerFloats.innerHTML = '';
    if (AppState.view === 'FRONT') return;

    const stitches = AppState.stitches.slice().sort((a, b) => a.order - b.order);
    for (let i = 0; i < stitches.length - 1; i++) {
      const current = stitches[i];
      const next = stitches[i + 1];
      const endPt = this.gridToPx(current.to[0], current.to[1]);
      const startPt = this.gridToPx(next.from[0], next.from[1]);
      const floatLen = Math.hypot(startPt.x - endPt.x, startPt.y - endPt.y);
      if (floatLen < 1) continue;

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', `M ${endPt.x} ${endPt.y} L ${startPt.x} ${startPt.y}`);
      // Use a muted neutral color for floats, not the stitch color, so they
      // are clearly secondary to the actual stitches
      path.setAttribute('stroke', '#8B7355');
      path.setAttribute('stroke-width', '0.9');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-dasharray', '2.5 5');
      path.setAttribute('opacity', '0.35');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('class', 'float-thread');
      this.layerFloats.appendChild(path);
    }
  },

  updateBulkMeter() {
    if (!this.bulkMeter) return;
    const stitches = AppState.stitches.slice().sort((a, b) => a.order - b.order);
    let frontLength = 0;
    let floatLength = 0;

    stitches.forEach(s => {
      const p1 = this.gridToPx(s.from[0], s.from[1]);
      const p2 = this.gridToPx(s.to[0], s.to[1]);
      frontLength += Math.hypot(p2.x - p1.x, p2.y - p1.y);
    });

    for (let i = 0; i < stitches.length - 1; i++) {
      const ep = this.gridToPx(stitches[i].to[0], stitches[i].to[1]);
      const sp = this.gridToPx(stitches[i + 1].from[0], stitches[i + 1].from[1]);
      floatLength += Math.hypot(sp.x - ep.x, sp.y - ep.y);
    }

    const total = frontLength + floatLength;
    const efficiency = total > 0 ? frontLength / total : 1;
    const pct = Math.round(efficiency * 100);

    this.bulkBar.style.width = `${pct}%`;
    this.bulkBar.style.background = pct >= 70 ? 'var(--emerald)' : pct >= 45 ? 'var(--saffron)' : 'var(--crimson)';
    const frontMm = Math.round(frontLength / 20 * 10);
    const floatMm = Math.round(floatLength / 20 * 10);
    this.bulkLabel.innerText = `Front ${frontMm}mm · Float ${floatMm}mm · ${pct}% efficient`;
  },

  // Ghost & Overlay
  renderGhost(stitches, mode = 'normal') {
    this.layerGhost.innerHTML = '';
    if (!stitches.length || mode === 'hidden' || AppState.view === 'FRONT') return;

    stitches.forEach((stitch, index) => {
      const isNext = index === this.getActiveIndex();
      const ghost = this.createStitchSVG(stitch, {
        opacity: mode === 'subtle' ? 0.16 : isNext ? 0.34 : 0.12,
        width: isNext ? 5.5 : 3,
        className: isNext ? 'ghost next' : 'ghost'
      });
      this.layerGhost.appendChild(ghost);
    });
  },

  getActiveIndex() {
    return AppState.mode === 'PRACTICE'
      ? AppState.practice.currentStitchIndex
      : AppState.learn.currentStitchIndex;
  },

  drawCountingOverlay(stitch) {
    this.layerOverlay.innerHTML = '';
    if (!stitch || AppState.view === 'FRONT') return;

    const totalWarp = Math.abs(stitch.warpDelta);
    const totalWeft = Math.abs(stitch.weftDelta);
    const steps = Math.max(totalWarp, totalWeft, 1);

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const w = stitch.from[0] + stitch.warpDelta * t;
      const f = stitch.from[1] + stitch.weftDelta * t;
      const point = this.gridToPx(w, f);
      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('class', 'count-step');
      group.style.animationDelay = `${i * 120}ms`;

      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', point.x);
      circle.setAttribute('cy', point.y);
      circle.setAttribute('r', '7');

      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', point.x);
      label.setAttribute('y', point.y + 3.5);
      label.textContent = String(i);

      group.append(circle, label);
      this.layerOverlay.appendChild(group);
    }

    // Step 1: pulse the start point to tell them where to click first
    this.drawTargetPulse(stitch.from[0], stitch.from[1]);
  },

  drawTargetPulse(w, f, flash = false) {
    // Remove existing pulses
    this.layerOverlay.querySelectorAll('.target-pulse').forEach(el => el.remove());
    
    const target = this.gridToPx(w, f);
    const pulse = document.createElementNS(SVG_NS, 'circle');
    pulse.setAttribute('cx', target.x);
    pulse.setAttribute('cy', target.y);
    pulse.setAttribute('r', '8');
    
    // Add a quick animation reset to draw attention if 'flash' is true
    if (flash) {
      pulse.setAttribute('class', 'target-pulse error-flash');
      // trigger reflow
      void pulse.offsetWidth;
    } else {
      pulse.setAttribute('class', 'target-pulse');
    }
    
    this.layerOverlay.appendChild(pulse);
  },

  // Two-click flow — Step 1: show the needle set-down point
  drawThreadAnchor(anchor) {
    // Remove any previous anchor marker specifically (leaves counting overlay intact)
    this.layerOverlay.querySelectorAll('.thread-anchor').forEach(el => el.remove());
    if (!anchor) return;
    const pt = this.gridToPx(anchor[0], anchor[1]);

    const outer = document.createElementNS(SVG_NS, 'circle');
    outer.setAttribute('cx', pt.x);
    outer.setAttribute('cy', pt.y);
    outer.setAttribute('r', '8');
    outer.setAttribute('class', 'thread-anchor anchor-ring');

    const inner = document.createElementNS(SVG_NS, 'circle');
    inner.setAttribute('cx', pt.x);
    inner.setAttribute('cy', pt.y);
    inner.setAttribute('r', '3');
    inner.setAttribute('class', 'thread-anchor anchor-dot');

    this.layerOverlay.append(outer, inner);
  },

  // Two-click flow — Step 2: draw the stitch tentatively (muted) and keep it in the overlay
  // so it appears immediately after the second click, before count is verified.
  drawPendingStitch(stitch) {
    // Remove any previous pending stitch visual
    this.layerOverlay.querySelectorAll('.pending-stitch').forEach(el => el.remove());
    if (!stitch) return;

    const p1 = this.gridToPx(stitch.from[0], stitch.from[1]);
    const p2 = this.gridToPx(stitch.to[0], stitch.to[1]);

    const line = document.createElementNS(SVG_NS, 'path');
    line.setAttribute('d', `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`);
    line.setAttribute('class', 'pending-stitch');
    line.style.stroke = stitch.color;
    this.layerOverlay.appendChild(line);
  },

  // Clear ONLY the pending-stitch and anchor visuals (preserves counting overlay)
  clearPendingOverlay() {
    this.layerOverlay.querySelectorAll('.thread-anchor, .pending-stitch, .count-correction').forEach(el => el.remove());
  },

  // Post-hoc: show the actual count beside the stitch after the learner answers
  showCountCorrection(stitch, actualWarp, actualWeft, wasCorrect) {
    const midPx = this.gridToPx(
      (stitch.from[0] + stitch.to[0]) / 2,
      (stitch.from[1] + stitch.to[1]) / 2
    );

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', midPx.x + 8);
    label.setAttribute('y', midPx.y - 8);
    label.setAttribute('class', `count-correction ${wasCorrect ? 'correct' : 'incorrect'}`);
    label.textContent = `W${Math.abs(stitch.warpDelta)} F${Math.abs(stitch.weftDelta)}`;
    this.layerOverlay.appendChild(label);

    // Fade out after 2.5s
    setTimeout(() => label.remove(), 2500);
  },

  showErrorLine(from, to) {
    const p1 = this.gridToPx(from[0], from[1]);
    const p2 = this.gridToPx(to[0], to[1]);
    const line = document.createElementNS(SVG_NS, 'path');
    line.setAttribute('d', `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`);
    line.setAttribute('class', 'mistake-thread');
    this.layerOverlay.appendChild(line);
    setTimeout(() => line.remove(), 1200);
  },

  // Feature 1: Flip Fabric Toggle
  toggleFabricView() {
    AppState.view = AppState.view === 'REVERSE' ? 'FRONT' : 'REVERSE';
    const container = document.getElementById('svg-container');
    container.classList.toggle('front-view', AppState.view === 'FRONT');

    const flipBtn = document.getElementById('btn-flip');
    if (flipBtn) {
      flipBtn.textContent = AppState.view === 'FRONT' ? '↩ Reverse' : '↪ Finished';
      flipBtn.classList.toggle('active', AppState.view === 'FRONT');
    }

    document.getElementById('needle-cursor').style.display =
      AppState.view === 'FRONT' ? 'none' : 'block';

    this.renderGrid();
    this.renderStitches();
    if (typeof ThreadRenderer !== 'undefined' && ThreadRenderer.ctx) {
      ThreadRenderer.scheduleRepaint();
    }

    if (AppState.view === 'FRONT') {
      this.layerGhost.innerHTML = '';
      this.layerOverlay.innerHTML = '';
    }
  },

  // Radial Popover
  showRadialPopover(clientX, clientY, axis, maxValue = 9) {
    document.getElementById('radial-prompt').innerText = axis === 'warp' ? 'Warp threads?' : 'Weft threads?';
    const containerRect = this.svg.parentElement.getBoundingClientRect();
    const grid = this.radialPopover.querySelector('.radial-grid');
    const highest = Math.max(9, maxValue);

    grid.innerHTML = Array.from({ length: highest }, (_, index) => {
      const value = index + 1;
      return `<button class="num-btn" data-count="${value}">${value}</button>`;
    }).join('');

    this.radialPopover.querySelector('.zero-btn').dataset.count = '0';
    this.radialPopover.style.left = `${clientX - containerRect.left}px`;
    this.radialPopover.style.top = `${clientY - containerRect.top}px`;
    this.radialPopover.classList.remove('hidden');
    requestAnimationFrame(() => this.radialPopover.classList.add('active'));
  },

  hideRadialPopover() {
    this.radialPopover.classList.remove('active');
    setTimeout(() => this.radialPopover.classList.add('hidden'), 180);
  },

  // ─── Auto Satin Fill: polygon builder overlay ────────────────────────────

  /**
   * Draws the in-progress fill polygon into layerOverlay.
   *
   * @param {Array<[number,number]>} vertices  – placed polygon corners in grid coords
   * @param {{x:number,y:number}|null} preview – raw SVG-space coords of the mouse
   *                                             (NOT snapped to grid — for smooth preview)
   */
  drawFillPolygon(vertices, preview = null) {
    this.clearFillOverlay();
    if (!vertices || vertices.length === 0) return;

    // ── Draw edges between consecutive vertices ────────────────────────────
    if (vertices.length > 1) {
      for (let i = 0; i < vertices.length - 1; i++) {
        const p1 = this.gridToPx(vertices[i][0],     vertices[i][1]);
        const p2 = this.gridToPx(vertices[i + 1][0], vertices[i + 1][1]);
        const edge = document.createElementNS(SVG_NS, 'path');
        edge.setAttribute('d', `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`);
        edge.setAttribute('class', 'fill-edge');
        this.layerOverlay.appendChild(edge);
      }
    }

    // ── Rubber-band: last vertex → mouse (raw SVG px) → back to first vertex ──
    if (preview && vertices.length >= 1) {
      const last  = this.gridToPx(vertices[vertices.length - 1][0], vertices[vertices.length - 1][1]);
      // preview is already in SVG coordinate space — no gridToPx needed
      const prev  = preview;
      const first = this.gridToPx(vertices[0][0], vertices[0][1]);

      // last vertex → cursor
      const rubberA = document.createElementNS(SVG_NS, 'path');
      rubberA.setAttribute('d', `M ${last.x} ${last.y} L ${prev.x} ${prev.y}`);
      rubberA.setAttribute('class', 'fill-preview-edge');
      this.layerOverlay.appendChild(rubberA);

      // cursor → first vertex (closing preview, only shown when ≥ 2 vertices)
      if (vertices.length >= 2) {
        const rubberB = document.createElementNS(SVG_NS, 'path');
        rubberB.setAttribute('d', `M ${prev.x} ${prev.y} L ${first.x} ${first.y}`);
        rubberB.setAttribute('class', 'fill-preview-edge fill-close-preview');
        this.layerOverlay.appendChild(rubberB);
      }
    }

    // ── Vertex circles (drawn on top of edges) ────────────────────────────
    vertices.forEach((v, i) => {
      const pt = this.gridToPx(v[0], v[1]);
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', pt.x);
      circle.setAttribute('cy', pt.y);
      circle.setAttribute('r', i === 0 ? 7 : 5);
      circle.setAttribute('class', i === 0 ? 'fill-vertex fill-vertex-first' : 'fill-vertex');
      this.layerOverlay.appendChild(circle);
    });
  },

  /** Remove only the fill-polygon overlay elements, leave other overlays intact. */
  clearFillOverlay() {
    this.layerOverlay
      .querySelectorAll('.fill-vertex, .fill-edge, .fill-preview-edge')
      .forEach(el => el.remove());
  }
};

window.addEventListener('state:updated', () => {
  UI.renderStitches();
  renderModePanel();
});
