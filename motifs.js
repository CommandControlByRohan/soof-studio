/**
 * motifs.js — Soof Embroidery Motif Library
 *
 * Each motif is defined as:
 * - A list of guided steps (for LEARN mode) with narrated instructions
 * - A list of stitches (for PRACTICE / FREE rendering)
 *
 * Coordinate system: [warpCol, weftRow] — warp counts right, weft counts down.
 * Origin (0,0) is the center of the grid.
 *
 * Each stitch: { from: [w, f], to: [w, f], color: hex, type: 'fill'|'outline' }
 */

const SOOF_COLORS = {
  crimson:   '#C0392B',
  emerald:   '#1A7A4A',
  blue:      '#1B4F9E',
  saffron:   '#D4A017',
  charcoal:  '#2C2C2C',
  ivory:     '#F5EDD6',
};

// ─── Helper: generate parallel satin fill stitches ──────────────────────
// Fills a polygon region with parallel lines at 1-thread spacing

function generateSatinFill(vertices, color, direction = 'vertical') {
  const stitches = [];
  // Get bounding box
  const xs = vertices.map(v => v[0]);
  const ys = vertices.map(v => v[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  if (direction === 'vertical') {
    // Parallel vertical fill lines, stepping 1 warp thread at a time
    for (let w = minX; w <= maxX; w += 1) {
      // Find weft intersections with polygon edges at this warp column
      const intersections = [];
      for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        // Check if edge crosses this warp column
        if ((a[0] <= w && b[0] >= w) || (b[0] <= w && a[0] >= w)) {
          if (a[0] === b[0]) {
            // Vertical edge — add both endpoints
            intersections.push(a[1], b[1]);
          } else {
            const t = (w - a[0]) / (b[0] - a[0]);
            const f = a[1] + t * (b[1] - a[1]);
            intersections.push(f);
          }
        }
      }
      intersections.sort((a, b) => a - b);
      // Pair up intersections for fill
      for (let j = 0; j + 1 < intersections.length; j += 2) {
        const fStart = Math.round(intersections[j]);
        const fEnd = Math.round(intersections[j + 1]);
        if (fEnd > fStart) {
          stitches.push({
            from: [w, fStart], to: [w, fEnd],
            color, type: 'fill'
          });
        }
      }
    }
  } else {
    // Horizontal fill
    for (let f = minY; f <= maxY; f += 1) {
      const intersections = [];
      for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        if ((a[1] <= f && b[1] >= f) || (b[1] <= f && a[1] >= f)) {
          if (a[1] === b[1]) {
            intersections.push(a[0], b[0]);
          } else {
            const t = (f - a[1]) / (b[1] - a[1]);
            const w = a[0] + t * (b[0] - a[0]);
            intersections.push(w);
          }
        }
      }
      intersections.sort((a, b) => a - b);
      for (let j = 0; j + 1 < intersections.length; j += 2) {
        const wStart = Math.round(intersections[j]);
        const wEnd = Math.round(intersections[j + 1]);
        if (wEnd > wStart) {
          stitches.push({
            from: [wStart, f], to: [wEnd, f],
            color, type: 'fill'
          });
        }
      }
    }
  }
  return stitches;
}

// Generate outline stitches from a polygon
function generateOutline(vertices, color) {
  const stitches = [];
  for (let i = 0; i < vertices.length; i++) {
    const from = vertices[i];
    const to = vertices[(i + 1) % vertices.length];
    stitches.push({ from, to, color, type: 'outline' });
  }
  return stitches;
}


// ═══════════════════════════════════════════════════════════════════════
// MOTIF 1: THE TRIANGLE (Mihrab)
// ═══════════════════════════════════════════════════════════════════════

const TRIANGLE_VERTS = [[0, 0], [8, 0], [4, -8]];
const TRIANGLE_FILL = generateSatinFill(TRIANGLE_VERTS, SOOF_COLORS.crimson, 'horizontal');
const TRIANGLE_OUTLINE = generateOutline(TRIANGLE_VERTS, SOOF_COLORS.charcoal);

const TRIANGLE_MOTIF = {
  name: 'Mihrab Triangle',
  nameHindi: 'मेहराब',
  icon: '△',
  description: 'The foundational Soof motif. Teaches diagonal counting on warp and weft.',
  vertices: TRIANGLE_VERTS,
  stitches: [...TRIANGLE_FILL, ...TRIANGLE_OUTLINE],
  steps: [
    { instruction: 'Start at the base-left corner. This is your anchor point.', from: null, to: [0, 0] },
    { instruction: 'Count 8 warp threads to the right along the base.', from: [0, 0], to: [8, 0] },
    { instruction: 'Now count 4 warp right and 8 weft up to find the apex. This diagonal is the heart of Soof geometry.', from: [8, 0], to: [4, -8] },
    { instruction: 'Close the triangle — return diagonally to the start.', from: [4, -8], to: [0, 0] },
    // Fill steps
    { instruction: 'Begin filling. Lay a horizontal stitch at row -1 between the two sloped edges.', from: [1, -1], to: [7, -1] },
    { instruction: 'Continue filling at row -2. Count the edges narrowing.', from: [1, -2], to: [7, -2] },
    { instruction: 'Row -3: notice how each row is 1 thread narrower on each side.', from: [2, -3], to: [6, -3] },
    { instruction: 'Row -4: the midpoint of the triangle.', from: [2, -4], to: [6, -4] },
    { instruction: 'Row -5: the fill is converging toward the apex.', from: [3, -5], to: [5, -5] },
    { instruction: 'Row -6: almost at the top.', from: [3, -6], to: [5, -6] },
    { instruction: 'Row -7: the final fill stitch, just one thread below the apex.', from: [4, -7], to: [4, -7] },
  ]
};


// ═══════════════════════════════════════════════════════════════════════
// MOTIF 2: THE DIAMOND (Chaukor)
// ═══════════════════════════════════════════════════════════════════════

const DIAMOND_VERTS = [[0, -6], [6, 0], [0, 6], [-6, 0]];
const DIAMOND_FILL = generateSatinFill(DIAMOND_VERTS, SOOF_COLORS.emerald, 'horizontal');
const DIAMOND_OUTLINE = generateOutline(DIAMOND_VERTS, SOOF_COLORS.charcoal);

const DIAMOND_MOTIF = {
  name: 'Chaukor Diamond',
  nameHindi: 'चौकोर',
  icon: '◇',
  description: 'Two mirrored triangles. Teaches symmetry and reflection across the central weft axis.',
  vertices: DIAMOND_VERTS,
  stitches: [...DIAMOND_FILL, ...DIAMOND_OUTLINE],
  steps: [
    { instruction: 'Start at the top vertex. Count to the center, then 6 weft threads straight up.', from: null, to: [0, -6] },
    { instruction: 'Count 6 warp right and 6 weft down to the right vertex.', from: [0, -6], to: [6, 0] },
    { instruction: 'Mirror downward: 6 warp left and 6 weft down to the bottom.', from: [6, 0], to: [0, 6] },
    { instruction: 'Complete the diamond: 6 warp left and 6 weft up back to start.', from: [0, 6], to: [-6, 0] },
    { instruction: 'Close back to the top vertex.', from: [-6, 0], to: [0, -6] },
    // Fill
    { instruction: 'Fill row -5: the first horizontal stitch inside the top angle.', from: [-1, -5], to: [1, -5] },
    { instruction: 'Fill row -4: the shape widens.', from: [-2, -4], to: [2, -4] },
    { instruction: 'Fill row -3: count the symmetry — equal threads on both sides.', from: [-3, -3], to: [3, -3] },
    { instruction: 'Fill row -2.', from: [-4, -2], to: [4, -2] },
    { instruction: 'Fill row -1.', from: [-5, -1], to: [5, -1] },
    { instruction: 'Fill the center row — the widest stitch in the diamond.', from: [-5, 0], to: [5, 0] },
    { instruction: 'Fill row +1: now mirroring downward.', from: [-5, 1], to: [5, 1] },
    { instruction: 'Fill row +2.', from: [-4, 2], to: [4, 2] },
    { instruction: 'Fill row +3.', from: [-3, 3], to: [3, 3] },
    { instruction: 'Fill row +4.', from: [-2, 4], to: [2, 4] },
    { instruction: 'Fill row +5: the last stitch before the bottom vertex.', from: [-1, 5], to: [1, 5] },
  ]
};


// ═══════════════════════════════════════════════════════════════════════
// MOTIF 3: THE LEHER WAVE (लहर)
// ═══════════════════════════════════════════════════════════════════════

// A V-wave border pattern: repeated V shapes along the horizontal
const LEHER_VERTS_1 = [[0, 0], [3, -4], [6, 0]]; // first V
const LEHER_VERTS_2 = [[6, 0], [9, -4], [12, 0]]; // second V
const LEHER_VERTS_3 = [[12, 0], [15, -4], [18, 0]]; // third V

const LEHER_FILL_1 = generateSatinFill(LEHER_VERTS_1, SOOF_COLORS.blue, 'horizontal');
const LEHER_FILL_2 = generateSatinFill(LEHER_VERTS_2, SOOF_COLORS.saffron, 'horizontal');
const LEHER_FILL_3 = generateSatinFill(LEHER_VERTS_3, SOOF_COLORS.blue, 'horizontal');
const LEHER_OUTLINE = [
  ...generateOutline(LEHER_VERTS_1, SOOF_COLORS.charcoal),
  ...generateOutline(LEHER_VERTS_2, SOOF_COLORS.charcoal),
  ...generateOutline(LEHER_VERTS_3, SOOF_COLORS.charcoal),
];

const LEHER_MOTIF = {
  name: 'Leher Wave',
  nameHindi: 'लहर',
  icon: '〰',
  description: 'Repeating V-shaped wave border. Teaches rhythmic repetition and alternating color.',
  vertices: [...LEHER_VERTS_1, ...LEHER_VERTS_2.slice(1), ...LEHER_VERTS_3.slice(1)],
  stitches: [...LEHER_FILL_1, ...LEHER_FILL_2, ...LEHER_FILL_3, ...LEHER_OUTLINE],
  steps: [
    { instruction: 'Anchor at the left base of the first wave.', from: null, to: [0, 0] },
    { instruction: 'Count 3 warp right and 4 weft up to the peak. This is the signature Leher angle.', from: [0, 0], to: [3, -4] },
    { instruction: 'Mirror down: 3 warp right and 4 weft down. First V complete!', from: [3, -4], to: [6, 0] },
    { instruction: 'Second wave peak: 3 warp right, 4 weft up. Same rhythm.', from: [6, 0], to: [9, -4] },
    { instruction: 'Mirror down again: 3 right, 4 down.', from: [9, -4], to: [12, 0] },
    { instruction: 'Third wave peak: 3 right, 4 up. Feel the repetition.', from: [12, 0], to: [15, -4] },
    { instruction: 'Final descent: 3 right, 4 down. The wave border is complete.', from: [15, -4], to: [18, 0] },
    // Fill the first V
    { instruction: 'Fill first wave, row -1.', from: [1, -1], to: [5, -1] },
    { instruction: 'Fill first wave, row -2.', from: [1, -2], to: [5, -2] },
    { instruction: 'Fill first wave, row -3.', from: [2, -3], to: [4, -3] },
    // Fill the second V
    { instruction: 'Fill second wave (saffron), row -1.', from: [7, -1], to: [11, -1] },
    { instruction: 'Fill second wave, row -2.', from: [7, -2], to: [11, -2] },
    { instruction: 'Fill second wave, row -3.', from: [8, -3], to: [10, -3] },
    // Fill the third V
    { instruction: 'Fill third wave (blue), row -1.', from: [13, -1], to: [17, -1] },
    { instruction: 'Fill third wave, row -2.', from: [13, -2], to: [17, -2] },
    { instruction: 'Fill third wave, row -3.', from: [14, -3], to: [16, -3] },
  ]
};


// ═══════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════

const SOOF_MOTIFS = [TRIANGLE_MOTIF, DIAMOND_MOTIF, LEHER_MOTIF];
