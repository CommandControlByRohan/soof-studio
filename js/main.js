/**
 * js/main.js
 * App bootstrap and interaction workflows.
 */

function init() {
  AppState.activePattern = MOTIFS[0];
  rebuildTargetStitches();
  UI.renderGrid();
  ThreadRenderer.init();
  setupEventListeners();
  renderMotifLibrary();
  enterMode('LEARN');
}

function rebuildTargetStitches() {
  AppState.targetStitches = AppState.activePattern ? Engine.run(AppState.activePattern) : [];
  Engine.reset();
}

function resetWorkspace({ keepStitches = false } = {}) {
  if (!keepStitches) AppState.stitches = [];
  AppState.learn.currentStitchIndex = 0;
  AppState.learn.pendingStitch = null;
  AppState.practice.currentStitchIndex = 0;
  AppState.free.anchor = null;
  // Clear two-click pending state
  AppState.pendingThreadAnchor = null;
  AppState.pendingDrawnStitch = null;
  AppState.pendingAnswerWarp = null;
  // Clear fill tool state
  AppState.fill.active = false;
  AppState.fill.vertices = [];
  AppState.fill.previewEdge = null;
  UI.layerOverlay.innerHTML = '';
  UI.layerGhost.innerHTML = '';
  clearHistory();
  emitStateUpdated();
}

function renderMotifLibrary() {
  UI.leftPanel.innerHTML = `
    <div class="panel-section">
      <div class="panel-heading">Motif Library</div>
      <p class="panel-hint">Motifs are stored as counted instructions. The visible geometry is generated from the sequence.</p>
      ${MOTIFS.map((motif, index) => `
        <button class="motif-chip ${AppState.activePattern === motif ? 'active' : ''}" data-motif="${index}">
          <div class="motif-name"><span>${motif.metadata.icon}</span> ${motif.metadata.name}</div>
          <div class="motif-desc">${motif.metadata.desc}</div>
        </button>
      `).join('')}
    </div>

    <div class="panel-section">
      <div class="panel-heading">Thread</div>
      <div class="swatch-row">
        ${[
          ['#C0392B', 'Crimson'],
          ['#1A7A4A', 'Emerald'],
          ['#D4A017', 'Saffron'],
          ['#1B4F9E', 'Indigo'],
          ['#2C2C2C', 'Charcoal']
        ].map(([color, label]) => `
          <button class="swatch ${AppState.cursor.color === color ? 'active' : ''}" style="--swatch:${color}" title="${label}" data-color="${color}"></button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderModePanel() {
  if (AppState.mode === 'LEARN') renderLearnPanel();
  if (AppState.mode === 'PRACTICE') renderPracticePanel();
  if (AppState.mode === 'FREE') renderFreePanel();
}

function renderLearnPanel() {
  const stitch = AppState.targetStitches[AppState.learn.currentStitchIndex];
  const total = AppState.targetStitches.length;

  if (!stitch) {
    UI.rightPanel.innerHTML = `
      <div class="panel-heading">Pattern Complete</div>
      <p class="panel-hint">The counted sequence is complete. Undo remains available because each laid stitch is a command.</p>
      ${historyButtons()}
    `;
    UI.layerOverlay.innerHTML = '';
    return;
  }

  UI.renderGhost(AppState.targetStitches, 'subtle');
  UI.drawCountingOverlay(stitch);

  // Show the thread anchor marker if Phase 1 is active
  if (AppState.pendingThreadAnchor) {
    UI.drawThreadAnchor(AppState.pendingThreadAnchor);
  }

  UI.rightPanel.innerHTML = `
    <div class="panel-heading">Learn Mode</div>
    <div class="progress-meter"><span style="width:${(AppState.learn.currentStitchIndex / total) * 100}%"></span></div>
    <p class="panel-hint">${stitch.narration || 'Count the next movement.'}</p>
    <div class="count-card">
      <div>
        <span>Start</span>
        <strong>Warp ${stitch.from[0]} / Weft ${stitch.from[1]}</strong>
      </div>
      <div>
        <span>Destination</span>
        <strong>Warp ${stitch.to[0]} / Weft ${stitch.to[1]}</strong>
      </div>
      <div>
        <span>Internal count</span>
        <strong>${Math.abs(stitch.warpDelta)} warp, ${Math.abs(stitch.weftDelta)} weft</strong>
      </div>
    </div>
    
    <div class="speed-control" style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-light); margin-bottom: 4px;">
        <span>Stitch Speed</span>
        <span id="speed-label">${(ThreadRenderer.ANIM_DURATION / 1000).toFixed(1)}s</span>
      </div>
      <input type="range" id="speed-slider" min="200" max="3000" step="100" value="${ThreadRenderer.ANIM_DURATION}" style="width: 100%;">
    </div>

    <div class="two-click-guide">
      ${!AppState.pendingThreadAnchor
        ? '<span class="step-badge">1</span> Click to set needle down at the start point.'
        : '<span class="step-badge active">2</span> Click your destination. Then verify your count.'}
    </div>
    ${historyButtons()}
  `;
  
  bindSpeedSlider();
}

function renderPracticePanel() {
  const total = AppState.targetStitches.length;
  const current = AppState.practice.currentStitchIndex;
  const done = current >= total;
  const ghostMode = AppState.practice.difficulty === 'MASTER' ? 'hidden' : AppState.practice.difficulty === 'NORMAL' ? 'subtle' : 'normal';
  UI.renderGhost(AppState.targetStitches, ghostMode);
  UI.layerOverlay.innerHTML = '';

  UI.rightPanel.innerHTML = `
    <div class="panel-heading">Practice Mode</div>
    <div class="segmented" role="group" aria-label="Difficulty">
      ${['EASY', 'NORMAL', 'MASTER'].map(level => `
        <button class="${AppState.practice.difficulty === level ? 'active' : ''}" data-difficulty="${level}">${level.toLowerCase()}</button>
      `).join('')}
    </div>
    <div class="progress-meter"><span style="width:${(Math.min(current, total) / total) * 100}%"></span></div>
    <p class="panel-hint">${done ? 'The motif is complete.' : 'Trace the generated motif from memory and counting.'}</p>
    <div class="count-card">
      <div><span>Placed</span><strong>${Math.min(current, total)} / ${total}</strong></div>
      <div><span>Rule</span><strong>${practiceRuleText()}</strong></div>
    </div>

    <div class="speed-control" style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-light); margin-bottom: 4px;">
        <span>Stitch Speed</span>
        <span id="speed-label">${(ThreadRenderer.ANIM_DURATION / 1000).toFixed(1)}s</span>
      </div>
      <input type="range" id="speed-slider" min="200" max="3000" step="100" value="${ThreadRenderer.ANIM_DURATION}" style="width: 100%;">
    </div>

    ${historyButtons()}
  `;
  
  bindSpeedSlider();
}

function bindSpeedSlider() {
  const slider = document.getElementById('speed-slider');
  const label = document.getElementById('speed-label');
  if (slider) {
    slider.addEventListener('input', (e) => {
      const ms = parseInt(e.target.value, 10);
      ThreadRenderer.ANIM_DURATION = ms;
      if (label) label.innerText = (ms / 1000).toFixed(1) + 's';
    });
  }
}

function renderFreePanel() {
  UI.renderGhost([], 'hidden');

  const isFill   = AppState.fill.active;
  const verts    = AppState.fill.vertices;
  const canFill  = verts.length >= 3;

  if (!isFill) UI.drawThreadAnchor(AppState.pendingThreadAnchor);

  UI.rightPanel.innerHTML = `
    <div class="panel-heading">Sandbox</div>

    <div class="segmented" role="group" aria-label="Tool">
      <button id="tool-stitch" ${!isFill ? 'class="active"' : ''}>✦ Stitch</button>
      <button id="tool-fill"   ${isFill  ? 'class="active fill-active"' : ''}>◈ Fill</button>
    </div>

    ${isFill ? `
      <p class="panel-hint">Click vertices on the grid to define your shape.
        Click the <strong>first vertex</strong> (or press Enter) to fill it,
        or <strong>Escape</strong> to cancel.</p>
      <div class="count-card">
        <div><span>Vertices</span><strong>${verts.length} placed</strong></div>
        <div><span>Color</span><strong>${colorName(AppState.cursor.color)}</strong></div>
        <div><span>Density</span>
          <select id="fill-density-select" style="background: none; border: 1px solid var(--border); border-radius: 4px; padding: 2px 4px; font-family: inherit;">
            <option value="1" ${AppState.fill.density === 1 ? 'selected' : ''}>1 Thread</option>
            <option value="2" ${AppState.fill.density === 2 ? 'selected' : ''}>2 Threads</option>
            <option value="3" ${AppState.fill.density === 3 ? 'selected' : ''}>3 Threads</option>
          </select>
        </div>
        <div><span>Outline</span>
          <label style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="fill-outline-check" ${AppState.fill.outline ? 'checked' : ''} />
            Include Boundary
          </label>
        </div>
        <div><span>Status</span><strong>${canFill ? 'Ready — close or confirm' : 'Need at least 3 vertices'}</strong></div>
      </div>
      <div class="button-row">
        <button class="tool-btn" id="fill-confirm" ${canFill ? '' : 'disabled'}>Fill Shape</button>
        <button class="tool-btn" id="fill-cancel">Cancel</button>
      </div>
    ` : `
      <p class="panel-hint">Build geometry one counted segment at a time. Every endpoint snaps to warp and weft intersections.</p>
      <div class="count-card">
        <div><span>Step</span><strong>${!AppState.pendingThreadAnchor ? '1 — Click to set start (needle down)' : '2 — Click destination (needle up)'}</strong></div>
        <div><span>Anchor</span><strong>${AppState.pendingThreadAnchor ? `Warp ${AppState.pendingThreadAnchor[0]} / Weft ${AppState.pendingThreadAnchor[1]}` : 'Not set'}</strong></div>
        <div><span>Color</span><strong>${colorName(AppState.cursor.color)}</strong></div>
      </div>
      <div class="button-row">
        <button class="tool-btn" id="clear-anchor">Clear Anchor</button>
        <button class="tool-btn" id="clear-stitches">Clear Stitches</button>
      </div>
    `}
    ${historyButtons()}
  `;
}

function historyButtons() {
  return `
    <div class="button-row">
      <button class="tool-btn" id="undo-btn" ${AppState.history.length ? '' : 'disabled'}>Undo</button>
      <button class="tool-btn" id="redo-btn" ${AppState.redoStack.length ? '' : 'disabled'}>Redo</button>
    </div>
  `;
}

function practiceRuleText() {
  if (AppState.practice.difficulty === 'EASY') return 'within 1 thread';
  if (AppState.practice.difficulty === 'MASTER') return 'exact, no ghost';
  return 'exact placement';
}

function colorName(color) {
  const names = {
    '#C0392B': 'Crimson',
    '#1A7A4A': 'Emerald',
    '#D4A017': 'Saffron',
    '#1B4F9E': 'Indigo',
    '#2C2C2C': 'Charcoal'
  };
  return names[color] || color;
}

function selectPattern(index) {
  AppState.activePattern = MOTIFS[index];
  rebuildTargetStitches();
  resetWorkspace();
  renderMotifLibrary();
  enterMode(AppState.mode);
}

function enterMode(mode) {
  AppState.mode = mode;
  document.querySelectorAll('.mode-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  UI.hideRadialPopover();
  AppState.free.anchor = null;
  
  // Clear any leftover pedagogical overlay indicators when changing modes
  UI.layerOverlay.innerHTML = '';
  
  renderModePanel();
}

// ═══════════════════════════════════════════════════════════
// TWO-CLICK + POST-HOC COUNT VERIFICATION FLOW
//
// Phase 1 (first click):  The learner sets the needle down at
//                         a starting point. A pulsing anchor
//                         appears. No count is asked yet.
//
// Phase 2 (second click): The learner lifts the needle at the
//                         destination. The stitch is drawn
//                         immediately in a tentative (muted)
//                         style — the physical act is done.
//                         NOW the radial popover asks:
//                         "How many warp threads did you count?"
//                         then "How many weft threads?"
//
// This mirrors the traditional practice: the artisan makes the
// stitch first (from memory), then the system verifies the count.
// ═══════════════════════════════════════════════════════════

function handleCanvasClick(event) {
  // If a radial popover is open, ignore
  if (AppState.pendingDrawnStitch) return;

  const point = UI.eventToGrid(event);
  if (!UI.isInBounds(point.w, point.f)) return;

  UI.triggerFabricPulse(point.w, point.f);

  if (AppState.mode === 'LEARN')    handleLearnClick(event, point);
  if (AppState.mode === 'PRACTICE') handlePracticeClick(event, point);
  if (AppState.mode === 'FREE')     handleFreeClick(event, point);
}

// ─── Shared: Phase 1 ── set needle anchor ────────────────────
function setThreadAnchor(point) {
  AppState.pendingThreadAnchor = [point.w, point.f];
  UI.drawThreadAnchor(AppState.pendingThreadAnchor);
}

function commitTentativeStitch(event, stitch, expectedWarp, expectedWeft) {
  AppState.pendingDrawnStitch = stitch;
  AppState.pendingExpectedWarp = expectedWarp;
  AppState.pendingExpectedWeft = expectedWeft;
  AppState.pendingCountAxis = 'warp';
  AppState.pendingAnswerWarp = null;

  // Draw the stitch immediately in muted style — action first, count verification after
  UI.clearPendingOverlay();
  UI.drawPendingStitch(stitch);
  UI.drawPendingTrail(0, 0); // Hide the pending trail
  UI.showRadialPopover(event.clientX, event.clientY, 'warp', expectedWarp);
}

// ─── LEARN handlers ───────────────────────────────────────────
function handleLearnClick(event, point) {
  const expected = AppState.targetStitches[AppState.learn.currentStitchIndex];
  if (!expected) return;

  const destination = [point.w, point.f];

  // Phase 1: Wait for user to click the STARTING point
  if (!AppState.pendingThreadAnchor) {
    const tolerance = 1;
    if (!isNearPoint(destination, expected.from, tolerance)) {
      // Clicked the wrong start point. Flash the correct one.
      UI.drawTargetPulse(expected.from[0], expected.from[1], true);
      return;
    }
    // Clicked the correct start point. Set anchor.
    setThreadAnchor({ w: expected.from[0], f: expected.from[1] });
    UI.drawTargetPulse(expected.to[0], expected.to[1]);
    return;
  }

  // Phase 2: Wait for user to click the ENDING point
  if (samePoint(AppState.pendingThreadAnchor, destination)) {
    // Clicked the anchor itself — ignore and flash destination
    UI.drawTargetPulse(expected.to[0], expected.to[1], true);
    return;
  }

  const tolerance = 1;
  const close = isNearPoint(destination, expected.to, tolerance);

  if (!close) {
    // Clicked wrong destination, flash the right one
    UI.drawTargetPulse(expected.to[0], expected.to[1], true);
    return;
  }

  const tentative = {
    ...expected,
    id: generateUUID(),
    from: [AppState.pendingThreadAnchor[0], AppState.pendingThreadAnchor[1]],
    to: destination,
    warpDelta: destination[0] - AppState.pendingThreadAnchor[0],
    weftDelta: destination[1] - AppState.pendingThreadAnchor[1],
    close
  };

  AppState.pendingThreadAnchor = null;
  commitTentativeStitch(event, tentative,
    Math.abs(expected.warpDelta),
    Math.abs(expected.weftDelta)
  );
}

// ─── PRACTICE handlers ────────────────────────────────────────
function handlePracticeClick(event, point) {
  const expected = AppState.targetStitches[AppState.practice.currentStitchIndex];
  if (!expected) return;

  const destination = [point.w, point.f];
  const tolerance = AppState.practice.difficulty === 'EASY' ? 1 : 0;

  // Phase 1: Wait for user to click the STARTING point
  if (!AppState.pendingThreadAnchor) {
    if (!isNearPoint(destination, expected.from, tolerance)) {
      UI.drawTargetPulse(expected.from[0], expected.from[1], true);
      return;
    }
    setThreadAnchor({ w: expected.from[0], f: expected.from[1] });
    UI.drawTargetPulse(expected.to[0], expected.to[1]);
    return;
  }

  // Phase 2: Wait for user to click the ENDING point
  if (samePoint(AppState.pendingThreadAnchor, destination)) {
    UI.drawTargetPulse(expected.to[0], expected.to[1], true);
    return;
  }

  const close = isNearPoint(destination, expected.to, tolerance);

  if (!close) {
    UI.drawTargetPulse(expected.to[0], expected.to[1], true);
    return;
  }

  const tentative = {
    ...expected,
    id: generateUUID(),
    from: [AppState.pendingThreadAnchor[0], AppState.pendingThreadAnchor[1]],
    to: destination,
    warpDelta: destination[0] - AppState.pendingThreadAnchor[0],
    weftDelta: destination[1] - AppState.pendingThreadAnchor[1],
    close
  };

  AppState.pendingThreadAnchor = null;
  commitTentativeStitch(event, tentative,
    Math.abs(expected.warpDelta),
    Math.abs(expected.weftDelta)
  );
}

// ─── FREE (Sandbox) handlers ──────────────────────────────────
function handleFreeClick(event, point) {
  // Route to fill tool if active
  if (AppState.fill.active) {
    handleFillToolClick(point);
    return;
  }

  if (!AppState.pendingThreadAnchor) {
    // First click: set anchor
    setThreadAnchor(point);
    renderFreePanel();
    return;
  }
  
  const destination = [point.w, point.f];

  if (samePoint(AppState.pendingThreadAnchor, destination)) {
    AppState.pendingThreadAnchor = null;
    UI.clearPendingOverlay();
    renderFreePanel();
    return;
  }

  const stitch = new Stitch({
    from: [...AppState.pendingThreadAnchor],
    to: destination,
    color: AppState.cursor.color,
    order: AppState.stitches.length,
    motifId: 'free',
    generated: false,
    layer: 'fill',
    narration: 'Free sandbox stitch',
    warpDelta: destination[0] - AppState.pendingThreadAnchor[0],
    weftDelta: destination[1] - AppState.pendingThreadAnchor[1],
    close: true
  });

  AppState.pendingThreadAnchor = null;
  commitTentativeStitch(event, stitch,
    Math.abs(stitch.warpDelta),
    Math.abs(stitch.weftDelta)
  );
}

// ─── Fill tool: vertex placement ──────────────────────────────
function handleFillToolClick(point) {
  const verts = AppState.fill.vertices;
  const pt    = [point.w, point.f];

  // If clicking near the first vertex (tolerance 1) with ≥ 3 verts → commit fill
  if (verts.length >= 3 && isNearPoint(pt, verts[0], 1)) {
    commitFill();
    return;
  }

  // Otherwise add the vertex
  verts.push(pt);
  UI.drawFillPolygon(verts, AppState.fill.previewEdge);
  renderFreePanel();
}

/** Run the scanline solver and commit the result as a single undoable command. */
function commitFill() {
  const { vertices } = AppState.fill;
  if (vertices.length < 3) return;

  const orderOffset = AppState.stitches.length;
  const stitches = computeSatinFill(
    vertices,
    AppState.cursor.color,
    'fill',
    orderOffset,
    AppState.fill.density,
    AppState.fill.outline
  );

  if (stitches.length > 0) {
    executeCommand(new BatchFillCommand(stitches));
    UI.renderStitches();
  }

  cancelFill();
}

/** Cancel an in-progress fill polygon without committing anything. */
function cancelFill() {
  AppState.fill.vertices    = [];
  AppState.fill.previewEdge = null;
  // Do not deactivate the tool — stay in fill mode ready for next shape
  UI.clearFillOverlay();
  renderFreePanel();
}

// ─── Post-hoc count verification ─────────────────────────────
function handleCountAnswer(value) {
  const stitch = AppState.pendingDrawnStitch;
  if (!stitch) return;

  if (AppState.pendingCountAxis === 'warp') {
    // Store the warp answer and move to weft
    AppState.pendingAnswerWarp = value;
    AppState.pendingCountAxis = 'weft';
    const rect = UI.radialPopover.getBoundingClientRect();
    UI.showRadialPopover(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      'weft',
      AppState.pendingExpectedWeft
    );
    return;
  }

  // Both axes answered — evaluate
  UI.hideRadialPopover();
  const answeredWarp = AppState.pendingAnswerWarp;
  const answeredWeft = value;
  const warpOk = answeredWarp === AppState.pendingExpectedWarp;
  const weftOk = answeredWeft === AppState.pendingExpectedWeft;
  const wasCorrect = warpOk && weftOk;

  // Commit stitch to the permanent layer regardless of count accuracy.
  // The physical act is done; the count annotation is the pedagogical layer.
  if (AppState.mode === 'LEARN') {
    if (stitch.close) {
      // Landed close enough — commit as a correctly-positioned stitch
      const canonicalStitch = AppState.targetStitches[AppState.learn.currentStitchIndex];
      executeCommand(new PlaceStitchCommand({ ...canonicalStitch, id: stitch.id }));
      AppState.learn.currentStitchIndex++;
    } else {
      // Missed — commit what they placed so the result is visible, then annotate
      executeCommand(new PlaceStitchCommand(stitch));
    }
    UI.renderStitches();
    renderLearnPanel();
  } else if (AppState.mode === 'PRACTICE') {
    if (stitch.close) {
      const canonicalStitch = AppState.targetStitches[AppState.practice.currentStitchIndex];
      executeCommand(new PlaceStitchCommand({ ...canonicalStitch, id: stitch.id }));
      AppState.practice.currentStitchIndex++;
    } else {
      executeCommand(new PlaceStitchCommand(stitch));
    }
    UI.renderStitches();
    renderPracticePanel();
  } else if (AppState.mode === 'FREE') {
    executeCommand(new PlaceStitchCommand(stitch));
    // In FREE mode, anchor chains: next stitch starts where this one ended
    AppState.free.anchor = stitch.to;
    UI.renderStitches();
    renderFreePanel();
  }

  // Show post-hoc count annotation (fades after 2.5s)
  UI.clearPendingOverlay();
  UI.showCountCorrection(stitch, answeredWarp, answeredWeft, wasCorrect);

  // Reset pending state
  AppState.pendingDrawnStitch = null;
  AppState.pendingAnswerWarp = null;
}

function samePoint(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function isNearPoint(a, b, tolerance = 0) {
  return Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance;
}

function setupEventListeners() {
  let isPanning = false;
  let isSpaceDown = false;
  let lastPanPoint = { x: 0, y: 0 };
  const svgContainer = document.getElementById('svg-container');

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isSpaceDown && document.activeElement.tagName !== 'INPUT') {
      isSpaceDown = true;
      svgContainer.style.cursor = 'grab';
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      isSpaceDown = false;
      isPanning = false;
      svgContainer.style.cursor = 'none';
    }
  });

  svgContainer.addEventListener('mousedown', (e) => {
    if (isSpaceDown || e.button === 1) {
      e.preventDefault();
      isPanning = true;
      lastPanPoint = { x: e.clientX, y: e.clientY };
      svgContainer.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      const dx = e.clientX - lastPanPoint.x;
      const dy = e.clientY - lastPanPoint.y;
      lastPanPoint = { x: e.clientX, y: e.clientY };
      
      const viewBox = UI.svg.viewBox.baseVal;
      const scaleX = viewBox.width / svgContainer.clientWidth;
      const scaleY = viewBox.height / svgContainer.clientHeight;
      
      UI.svg.setAttribute('viewBox', `${viewBox.x - dx * scaleX} ${viewBox.y - dy * scaleY} ${viewBox.width} ${viewBox.height}`);
      ThreadRenderer.scheduleRepaint();
      UI.updateCursor(e);
    }
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      svgContainer.style.cursor = isSpaceDown ? 'grab' : 'none';
    }
  });

  svgContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const viewBox = UI.svg.viewBox.baseVal;
    
    if (e.ctrlKey || e.metaKey) {
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      const rect = UI.svg.getBoundingClientRect();
      const scaleX = viewBox.width / rect.width;
      const scaleY = viewBox.height / rect.height;
      
      const pointerX = (e.clientX - rect.left) * scaleX + viewBox.x;
      const pointerY = (e.clientY - rect.top) * scaleY + viewBox.y;
      
      const newWidth = viewBox.width * zoomFactor;
      const newHeight = viewBox.height * zoomFactor;
      const newX = pointerX - (pointerX - viewBox.x) * zoomFactor;
      const newY = pointerY - (pointerY - viewBox.y) * zoomFactor;
      
      UI.svg.setAttribute('viewBox', `${newX} ${newY} ${newWidth} ${newHeight}`);
    } else {
      const scaleX = viewBox.width / svgContainer.clientWidth;
      const scaleY = viewBox.height / svgContainer.clientHeight;
      UI.svg.setAttribute('viewBox', `${viewBox.x + e.deltaX * scaleX} ${viewBox.y + e.deltaY * scaleY} ${viewBox.width} ${viewBox.height}`);
    }
    ThreadRenderer.scheduleRepaint();
    UI.updateCursor(e);
  }, { passive: false });

  UI.svg.addEventListener('mousemove', event => {
    if (!isPanning) {
      UI.updateCursor(event);

      // Rubber-band preview for the fill polygon tool — uses raw SVG pixel
      // coordinates (not snapped) so the line follows the cursor smoothly.
      if (AppState.mode === 'FREE' && AppState.fill.active && AppState.fill.vertices.length > 0) {
        AppState.fill.previewEdge = UI.eventToSvgPx(event);
        UI.drawFillPolygon(AppState.fill.vertices, AppState.fill.previewEdge);
      }
    }
  });
  
  UI.svg.addEventListener('mousedown', (event) => {
    if (isSpaceDown || event.button === 1 || AppState.view === 'FRONT') return;
    UI.cursorEl.classList.add('piercing');
  });

  window.addEventListener('mouseup', () => {
    UI.cursorEl.classList.remove('piercing');
  });

  UI.svg.addEventListener('click', (event) => {
    if (isSpaceDown || event.button === 1) return;
    handleCanvasClick(event);
  });

  document.getElementById('btn-font-dec')?.addEventListener('click', () => {
    let currentScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-scale')) || 1;
    if (currentScale > 0.6) document.documentElement.style.setProperty('--font-scale', (currentScale - 0.1).toFixed(2));
  });
  document.getElementById('btn-font-inc')?.addEventListener('click', () => {
    let currentScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-scale')) || 1;
    if (currentScale < 2.5) document.documentElement.style.setProperty('--font-scale', (currentScale + 0.1).toFixed(2));
  });

  // Feature 1: Flip fabric toggle
  document.getElementById('btn-flip')?.addEventListener('click', () => UI.toggleFabricView());

  document.querySelectorAll('.mode-btn').forEach(button => {
    button.addEventListener('click', () => {
      resetWorkspace({ keepStitches: AppState.mode === 'FREE' && button.dataset.mode === 'FREE' });
      enterMode(button.dataset.mode);
    });
  });

  UI.leftPanel.addEventListener('click', event => {
    const motifButton = event.target.closest('[data-motif]');
    const swatch = event.target.closest('[data-color]');

    if (motifButton) selectPattern(Number(motifButton.dataset.motif));
    if (swatch) {
      AppState.cursor.color = swatch.dataset.color;
      renderMotifLibrary();
      renderModePanel();
    }
  });

  UI.rightPanel.addEventListener('click', event => {
    const difficulty = event.target.closest('[data-difficulty]');
    if (difficulty) {
      AppState.practice.difficulty = difficulty.dataset.difficulty;
      renderPracticePanel();
    }

    if (event.target.closest('#undo-btn')) {
      undoCommand();
      syncModeProgressToCanvas();
    }
    if (event.target.closest('#redo-btn')) {
      redoCommand();
      syncModeProgressToCanvas();
    }
    if (event.target.closest('#clear-anchor')) {
      AppState.free.anchor = null;
      AppState.pendingThreadAnchor = null;
      UI.clearPendingOverlay();
      renderFreePanel();
    }
    if (event.target.closest('#clear-stitches') && AppState.stitches.length) {
      executeCommand(new ClearStitchesCommand());
      renderFreePanel();
    }

    // ─── Fill tool panel buttons ───────────────────────────────
    if (event.target.closest('#tool-stitch')) {
      cancelFill();
      AppState.fill.active = false;
      renderFreePanel();
    }
    if (event.target.closest('#tool-fill')) {
      // Cancel any in-progress stitch
      AppState.pendingThreadAnchor = null;
      UI.clearPendingOverlay();
      AppState.fill.active   = true;
      AppState.fill.vertices = [];
      renderFreePanel();
    }
    if (event.target.closest('#fill-confirm')) {
      commitFill();
    }
    if (event.target.closest('#fill-cancel')) {
      cancelFill();
      AppState.fill.active = false;
      renderFreePanel();
    }
  });

  // Handle fill density and outline changes (delegated via change event)
  document.getElementById('right-panel').addEventListener('change', (event) => {
    const target = event.target;
    if (target.id === 'fill-density-select') {
      AppState.fill.density = parseInt(target.value, 10);
      renderFreePanel();
    }
    if (target.id === 'fill-outline-check') {
      AppState.fill.outline = target.checked;
      renderFreePanel();
    }
  });

  UI.radialPopover.addEventListener('click', event => {
    const button = event.target.closest('[data-count]');
    if (!button) return;

    event.stopPropagation();
    handleCountAnswer(Number(button.dataset.count));
  });

  // ─── Fill tool: rubber-band update now merged into the svg mousemove above ─

  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();

    // Escape — cancel fill polygon in progress
    if (event.key === 'Escape' && AppState.mode === 'FREE' && AppState.fill.active) {
      cancelFill();
      AppState.fill.active = false;
      renderFreePanel();
      return;
    }

    // Enter — commit fill if enough vertices
    if (event.key === 'Enter' && AppState.mode === 'FREE' && AppState.fill.active) {
      commitFill();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      undoCommand();
      syncModeProgressToCanvas();
    }
    if ((event.metaKey || event.ctrlKey) && (key === 'y' || (key === 'z' && event.shiftKey))) {
      event.preventDefault();
      redoCommand();
      syncModeProgressToCanvas();
    }
  });
}

function syncModeProgressToCanvas() {
  // Cancel any in-progress two-click interaction
  AppState.pendingThreadAnchor = null;
  AppState.pendingDrawnStitch = null;
  AppState.pendingAnswerWarp = null;
  UI.clearPendingOverlay();
  UI.hideRadialPopover();

  if (AppState.mode === 'LEARN') {
    AppState.learn.currentStitchIndex = Math.min(AppState.stitches.length, AppState.targetStitches.length);
    AppState.learn.pendingStitch = null;
    renderLearnPanel();
  }

  if (AppState.mode === 'PRACTICE') {
    AppState.practice.currentStitchIndex = Math.min(AppState.stitches.length, AppState.targetStitches.length);
    renderPracticePanel();
  }
}

init();
