/**
 * sketch.js — Soof Studio p5.js Canvas
 *
 * Thread-count grid where each point is a warp/weft intersection.
 * Stitches are rendered as individual parallel lines for satin fill authenticity.
 */

const THREAD_PX = 18;      // pixels per thread crossing
const GRID_COLS = 40;       // warp threads visible
const GRID_ROWS = 36;       // weft threads visible
const GRID_ORIGIN_COL = 20; // center column (0 in motif coords)
const GRID_ORIGIN_ROW = 22; // center row (0 in motif coords)

// Canvas pixel from grid coordinates
function gridToPixel(col, row) {
  return {
    x: (col + GRID_ORIGIN_COL) * THREAD_PX,
    y: (row + GRID_ORIGIN_ROW) * THREAD_PX
  };
}

// Grid coordinates from mouse pixel
function pixelToGrid(px, py) {
  const col = Math.round(px / THREAD_PX) - GRID_ORIGIN_COL;
  const row = Math.round(py / THREAD_PX) - GRID_ORIGIN_ROW;
  return { col, row };
}

function setup() {
  const canvas = createCanvas(GRID_COLS * THREAD_PX, GRID_ROWS * THREAD_PX);
  canvas.parent('canvas-container');
  textFont('Inter');
}

function draw() {
  drawGroundCloth();
  drawThreadHighlights();

  const motif = SoofState.activeMotif;

  if (motif) {
    if (SoofState.mode === 'LEARN') {
      drawLearnMode(motif);
    } else if (SoofState.mode === 'PRACTICE') {
      drawPracticeMode(motif);
    }
  }

  // Always draw user-placed stitches (all modes)
  for (const s of SoofState.placedStitches) {
    drawStitch(s.from, s.to, s.color, s.type, 1.0);
  }

  // Stitch-start indicator
  if (SoofState.isStitching && SoofState.stitchStart) {
    const sp = gridToPixel(SoofState.stitchStart[0], SoofState.stitchStart[1]);
    noFill();
    stroke(SoofState.selectedColor);
    strokeWeight(2);
    ellipse(sp.x, sp.y, 12, 12);

    // Preview line to current hover
    const hover = pixelToGrid(mouseX, mouseY);
    const hp = gridToPixel(hover.col, hover.row);
    stroke(SoofState.selectedColor + '80');
    strokeWeight(1.5);
    drawingContext.setLineDash([4, 3]);
    line(sp.x, sp.y, hp.x, hp.y);
    drawingContext.setLineDash([]);
  }

  updateCursorDisplay();
}

// ═══════════════════════════════════════════════════════════════════════
// GROUND CLOTH & GRID
// ═══════════════════════════════════════════════════════════════════════

function drawGroundCloth() {
  // Ivory ground cloth background
  background('#F5EDD6');

  // Woven texture: subtle warp lines
  stroke(230, 225, 210);
  strokeWeight(0.5);
  for (let c = 0; c < GRID_COLS; c++) {
    const x = c * THREAD_PX;
    line(x, 0, x, height);
  }
  // Subtle weft lines
  for (let r = 0; r < GRID_ROWS; r++) {
    const y = r * THREAD_PX;
    line(0, y, width, y);
  }

  // Thread crossing dots
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      const x = c * THREAD_PX;
      const y = r * THREAD_PX;
      // Origin cross is larger
      const isOrigin = c === GRID_ORIGIN_COL && r === GRID_ORIGIN_ROW;
      if (isOrigin) {
        fill(180, 100, 60);
        noStroke();
        ellipse(x, y, 6, 6);
      } else {
        fill(200, 190, 170);
        noStroke();
        ellipse(x, y, 2.5, 2.5);
      }
    }
  }

  // Origin axis labels
  fill(160, 130, 100);
  noStroke();
  textSize(8);
  textAlign(CENTER, BOTTOM);
  const ox = GRID_ORIGIN_COL * THREAD_PX;
  const oy = GRID_ORIGIN_ROW * THREAD_PX;
  text('W →', ox + 30, oy - 6);
  textAlign(RIGHT, CENTER);
  text('F ↓', ox - 8, oy + 20);
}

// ═══════════════════════════════════════════════════════════════════════
// THREAD HIGHLIGHTS (hover crosshairs)
// ═══════════════════════════════════════════════════════════════════════

function drawThreadHighlights() {
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;

  const { col, row } = pixelToGrid(mouseX, mouseY);
  const snappedX = (col + GRID_ORIGIN_COL) * THREAD_PX;
  const snappedY = (row + GRID_ORIGIN_ROW) * THREAD_PX;

  // Warp thread highlight (vertical)
  stroke(200, 130, 50, 60);
  strokeWeight(THREAD_PX * 0.6);
  line(snappedX, 0, snappedX, height);

  // Weft thread highlight (horizontal)
  stroke(50, 130, 160, 60);
  strokeWeight(THREAD_PX * 0.6);
  line(0, snappedY, width, snappedY);

  // Crosshair snap dot
  fill(80, 60, 40);
  noStroke();
  ellipse(snappedX, snappedY, 8, 8);
}

// ═══════════════════════════════════════════════════════════════════════
// STITCH RENDERING — Individual parallel lines (satin stitch authenticity)
// ═══════════════════════════════════════════════════════════════════════

function drawStitch(from, to, color, type, alpha) {
  const p1 = gridToPixel(from[0], from[1]);
  const p2 = gridToPixel(to[0], to[1]);

  push();
  if (type === 'outline') {
    // Outline stitches: thicker, solid
    stroke(color);
    strokeWeight(3);
    drawingContext.globalAlpha = alpha;
    line(p1.x, p1.y, p2.x, p2.y);
  } else {
    // Fill stitches: render as individual parallel thread lines
    drawingContext.globalAlpha = alpha;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) { pop(); return; }

    // Perpendicular direction for parallel offset
    const nx = -dy / len;
    const ny = dx / len;

    // Each satin stitch line is 2px apart, filling the thread width
    const threadWidth = THREAD_PX * 0.7;
    const lineSpacing = 2;
    const numLines = Math.max(1, Math.floor(threadWidth / lineSpacing));

    stroke(color);
    strokeWeight(1.5);
    for (let i = 0; i < numLines; i++) {
      const offset = (i - (numLines - 1) / 2) * lineSpacing;
      const ox = nx * offset;
      const oy = ny * offset;
      line(p1.x + ox, p1.y + oy, p2.x + ox, p2.y + oy);
    }
  }
  pop();
}

// ═══════════════════════════════════════════════════════════════════════
// LEARN MODE
// ═══════════════════════════════════════════════════════════════════════

function drawLearnMode(motif) {
  const stepIdx = SoofState.currentStep;

  // Draw completed stitches from previous steps
  for (let i = 0; i < stepIdx; i++) {
    const step = motif.steps[i];
    if (step.from) {
      // Determine color: outline steps vs fill steps
      const isOutline = i < motif.vertices.length;
      const col = isOutline ? SOOF_COLORS.charcoal :
        (motif === LEHER_MOTIF ? determinLeherColor(step) : motif.stitches[0]?.color || SOOF_COLORS.crimson);
      drawStitch(step.from, step.to, col, isOutline ? 'outline' : 'fill', 1.0);
    }
  }

  // Draw current target highlight
  if (stepIdx < motif.steps.length) {
    const step = motif.steps[stepIdx];
    // Pulse the target point
    const t = (sin(frameCount * 3) + 1) / 2; // 0..1 oscillation
    const targetPt = gridToPixel(step.to[0], step.to[1]);

    // Pulsing ring
    noFill();
    stroke(lerpColor(color('#D4A017'), color('#C0392B'), t));
    strokeWeight(2);
    ellipse(targetPt.x, targetPt.y, 16 + t * 8, 16 + t * 8);

    // If step has a from point, draw a dashed preview line
    if (step.from) {
      const fromPt = gridToPixel(step.from[0], step.from[1]);
      stroke(200, 130, 50, 120);
      strokeWeight(1);
      drawingContext.setLineDash([4, 4]);
      line(fromPt.x, fromPt.y, targetPt.x, targetPt.y);
      drawingContext.setLineDash([]);
    }

    // Label the target coordinate
    fill(80, 50, 20);
    noStroke();
    textSize(9);
    textAlign(CENTER, BOTTOM);
    text(`(W:${step.to[0]}, F:${step.to[1]})`, targetPt.x, targetPt.y - 14);
  }
}

function determinLeherColor(step) {
  // Leher alternates blue/saffron by wave position
  const w = step.from ? step.from[0] : step.to[0];
  if (w < 6) return SOOF_COLORS.blue;
  if (w < 12) return SOOF_COLORS.saffron;
  return SOOF_COLORS.blue;
}

// ═══════════════════════════════════════════════════════════════════════
// PRACTICE MODE
// ═══════════════════════════════════════════════════════════════════════

function drawPracticeMode(motif) {
  // Draw ghost motif at low opacity
  if (SoofState.ghostVisible) {
    for (const s of motif.stitches) {
      drawStitch(s.from, s.to, s.color, s.type, 0.15);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MOUSE INTERACTION
// ═══════════════════════════════════════════════════════════════════════

function mousePressed() {
  // Guard: only on canvas
  const canvasEl = document.querySelector('#canvas-container canvas');
  if (!canvasEl) return;
  const rect = canvasEl.getBoundingClientRect();
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;

  const { col, row } = pixelToGrid(mouseX, mouseY);

  if (SoofState.mode === 'LEARN') {
    handleLearnClick(col, row);
  } else if (SoofState.mode === 'PRACTICE' || SoofState.mode === 'FREE') {
    handleFreeClick(col, row);
  }
}

function handleLearnClick(col, row) {
  const motif = SoofState.activeMotif;
  if (!motif) return;
  if (SoofState.currentStep >= motif.steps.length) return;

  const step = motif.steps[SoofState.currentStep];
  const target = step.to;

  // Check if click matches target (within 1 thread tolerance)
  if (Math.abs(col - target[0]) <= 1 && Math.abs(row - target[1]) <= 1) {
    // Correct!
    SoofState.currentStep++;
    renderInstructionPanel();
  } else {
    // Wrong — visual feedback
    const clicked = pixelToGrid(mouseX, mouseY);
    showWrongClickFeedback(clicked, target);
  }
}

function handleFreeClick(col, row) {
  if (!SoofState.isStitching) {
    // First click — set start point
    SoofState.isStitching = true;
    SoofState.stitchStart = [col, row];
  } else {
    // Second click — lay stitch
    const from = SoofState.stitchStart;
    const to = [col, row];
    SoofState.placedStitches.push({
      from, to,
      color: SoofState.selectedColor,
      type: 'fill'
    });
    SoofState.isStitching = false;
    SoofState.stitchStart = null;

    // In practice mode, check if it matches a ghost stitch
    if (SoofState.mode === 'PRACTICE') {
      renderInstructionPanel();
    }
    if (SoofState.mode === 'FREE') {
      renderLeftPanel(); // update stitch count
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// WRONG CLICK FEEDBACK
// ═══════════════════════════════════════════════════════════════════════

let wrongClickAnim = null;

function showWrongClickFeedback(clicked, target) {
  wrongClickAnim = {
    x: (clicked.col + GRID_ORIGIN_COL) * THREAD_PX,
    y: (clicked.row + GRID_ORIGIN_ROW) * THREAD_PX,
    frame: 0,
    maxFrames: 30,
    message: `Counted W:${clicked.col}, F:${clicked.row} — need W:${target[0]}, F:${target[1]}`
  };

  // Subtle canvas shake
  const container = document.getElementById('canvas-container');
  container.classList.add('shake');
  setTimeout(() => container.classList.remove('shake'), 300);
}

// Override draw to include wrong-click animation
const _originalDraw = draw;
// We'll handle it inline instead — check in the draw loop:
function drawWrongClickFeedback() {
  if (!wrongClickAnim) return;
  const a = wrongClickAnim;
  a.frame++;

  const alpha = map(a.frame, 0, a.maxFrames, 255, 0);
  fill(220, 50, 50, alpha);
  noStroke();
  textSize(10);
  textAlign(CENTER, TOP);
  text(a.message, a.x, a.y + 12);

  // Red X
  stroke(220, 50, 50, alpha);
  strokeWeight(2);
  line(a.x - 5, a.y - 5, a.x + 5, a.y + 5);
  line(a.x + 5, a.y - 5, a.x - 5, a.y + 5);

  if (a.frame >= a.maxFrames) wrongClickAnim = null;
}

// ═══════════════════════════════════════════════════════════════════════
// CURSOR DISPLAY
// ═══════════════════════════════════════════════════════════════════════

function updateCursorDisplay() {
  drawWrongClickFeedback();

  if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
    const { col, row } = pixelToGrid(mouseX, mouseY);
    const warpEl = document.getElementById('warp-count');
    const weftEl = document.getElementById('weft-count');
    if (warpEl) warpEl.textContent = `W: ${col}`;
    if (weftEl) weftEl.textContent = `F: ${row}`;
  }
}
