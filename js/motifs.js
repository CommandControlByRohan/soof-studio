/**
 * js/motifs.js
 * The Motif Library encoded as Engine Instructions
 */

const MihrabMotif = {
  metadata: {
    id: 'motif_mihrab',
    name: 'Mihrab Triangle',
    icon: '△',
    desc: 'The foundational motif. Teaches diagonal counting.'
  },
  instructions: [
    { type: 'START', pos: [-4, 4] }, // Start at bottom left
    { type: 'COLOR', color: 'var(--text-dark)' }, // Outline
    { type: 'LAYER', layer: 'outline' },
    
    // The Outline
    { type: 'STITCH_TO', warp: 8, weft: 0, narration: 'Count 8 warp threads right to form the base.' },
    { type: 'STITCH_TO', warp: -4, weft: -8, narration: 'Count 4 warp left and 8 weft up. This is the Soof diagonal.' },
    { type: 'STITCH_TO', warp: -4, weft: 8, narration: 'Return to start to close the outline.' },
    
    // The Satin Fill (explicitly counted for pedagogical value)
    { type: 'COLOR', color: 'var(--crimson)' },
    { type: 'LAYER', layer: 'fill' },
    { type: 'START', pos: [-3, 3] },
    { type: 'STITCH_TO', warp: 6, weft: 0, narration: 'Fill row -1. Count 6 warp threads inside the outline.' },
    { type: 'START', pos: [-2, 2] },
    { type: 'STITCH_TO', warp: 4, weft: 0, narration: 'Fill row -2. Count 4 warp threads.' },
    { type: 'START', pos: [-1, 1] },
    { type: 'STITCH_TO', warp: 2, weft: 0, narration: 'Fill row -3. Count 2 warp threads.' },
    { type: 'START', pos: [0, 0] },
    { type: 'STITCH_TO', warp: 0, weft: -1, narration: 'Final vertical anchor stitch at the apex.' } // Slight abstraction for the tip
  ]
};

const ChaukorMotif = {
  metadata: {
    id: 'motif_chaukor',
    name: 'Chaukor Diamond',
    icon: '◇',
    desc: 'Teaches symmetry and reflection.'
  },
  instructions: [
    { type: 'START', pos: [0, -6] },
    { type: 'COLOR', color: 'var(--text-dark)' },
    { type: 'LAYER', layer: 'outline' },
    
    // Outline
    { type: 'STITCH_TO', warp: 6, weft: 6, narration: 'Count 6 warp right and 6 weft down.' },
    { type: 'STITCH_TO', warp: -6, weft: 6, narration: 'Mirror downward: 6 left, 6 down.' },
    { type: 'STITCH_TO', warp: -6, weft: -6, narration: '6 left, 6 up.' },
    { type: 'STITCH_TO', warp: 6, weft: -6, narration: 'Close back to the top.' },
    
    // Satin Fill (Emerald)
    { type: 'COLOR', color: 'var(--emerald)' },
    { type: 'LAYER', layer: 'fill' },
    { type: 'START', pos: [-1, -5] }, { type: 'STITCH_TO', warp: 2, weft: 0 },
    { type: 'START', pos: [-2, -4] }, { type: 'STITCH_TO', warp: 4, weft: 0 },
    { type: 'START', pos: [-3, -3] }, { type: 'STITCH_TO', warp: 6, weft: 0 },
    { type: 'START', pos: [-4, -2] }, { type: 'STITCH_TO', warp: 8, weft: 0 },
    { type: 'START', pos: [-5, -1] }, { type: 'STITCH_TO', warp: 10, weft: 0 },
    
    { type: 'START', pos: [-5, 0] }, { type: 'STITCH_TO', warp: 10, weft: 0, narration: 'The center row is the widest.' },
    
    { type: 'START', pos: [-5, 1] }, { type: 'STITCH_TO', warp: 10, weft: 0 },
    { type: 'START', pos: [-4, 2] }, { type: 'STITCH_TO', warp: 8, weft: 0 },
    { type: 'START', pos: [-3, 3] }, { type: 'STITCH_TO', warp: 6, weft: 0 },
    { type: 'START', pos: [-2, 4] }, { type: 'STITCH_TO', warp: 4, weft: 0 },
    { type: 'START', pos: [-1, 5] }, { type: 'STITCH_TO', warp: 2, weft: 0 }
  ]
};

const TikudiMotif = {
  metadata: { id: 'motif_tikudi', name: 'Tikudi (Dot)', icon: '◆', desc: 'The smallest traditional element, often used as a filler.' },
  instructions: [
    { type: 'START', pos: [0, -2] },
    { type: 'COLOR', color: 'var(--text-dark)' },
    { type: 'LAYER', layer: 'outline' },
    { type: 'STITCH_TO', warp: 2, weft: 2, narration: 'Count 2 right, 2 down.' },
    { type: 'STITCH_TO', warp: -2, weft: 2, narration: 'Count 2 left, 2 down.' },
    { type: 'STITCH_TO', warp: -2, weft: -2, narration: 'Count 2 left, 2 up.' },
    { type: 'STITCH_TO', warp: 2, weft: -2, narration: 'Return to start.' },
    { type: 'COLOR', color: 'var(--saffron)' },
    { type: 'LAYER', layer: 'fill' },
    { type: 'START', pos: [-1, -1] }, { type: 'STITCH_TO', warp: 2, weft: 0 },
    { type: 'START', pos: [-2, 0] }, { type: 'STITCH_TO', warp: 4, weft: 0 },
    { type: 'START', pos: [-1, 1] }, { type: 'STITCH_TO', warp: 2, weft: 0 }
  ]
};

const LeherMotif = {
  metadata: { id: 'motif_leher', name: 'Leher (Wave)', icon: '〰', desc: 'A continuous zig-zag wave pattern used for borders.' },
  instructions: [
    { type: 'START', pos: [-8, 0] },
    { type: 'COLOR', color: 'var(--royal-blue)' },
    { type: 'LAYER', layer: 'outline' },
    { type: 'STITCH_TO', warp: 4, weft: -4, narration: 'Up the wave.' },
    { type: 'STITCH_TO', warp: 4, weft: 4, narration: 'Down the wave.' },
    { type: 'STITCH_TO', warp: 4, weft: -4, narration: 'Up the wave.' },
    { type: 'STITCH_TO', warp: 4, weft: 4, narration: 'Down the wave.' }
  ]
};

const PhoolMotif = {
  metadata: { id: 'motif_phool', name: 'Phool (Flower)', icon: '❀', desc: 'A geometric floral motif composed of four petals.' },
  instructions: [
    { type: 'COLOR', color: 'var(--text-dark)' },
    { type: 'LAYER', layer: 'outline' },
    { type: 'START', pos: [0, -4] }, { type: 'STITCH_TO', warp: 2, weft: 2 }, { type: 'STITCH_TO', warp: -2, weft: 2 }, { type: 'STITCH_TO', warp: -2, weft: -2 }, { type: 'STITCH_TO', warp: 2, weft: -2 },
    { type: 'START', pos: [4, 0] }, { type: 'STITCH_TO', warp: -2, weft: 2 }, { type: 'STITCH_TO', warp: -2, weft: -2 }, { type: 'STITCH_TO', warp: 2, weft: -2 }, { type: 'STITCH_TO', warp: 2, weft: 2 },
    { type: 'START', pos: [0, 4] }, { type: 'STITCH_TO', warp: -2, weft: -2 }, { type: 'STITCH_TO', warp: 2, weft: -2 }, { type: 'STITCH_TO', warp: 2, weft: 2 }, { type: 'STITCH_TO', warp: -2, weft: 2 },
    { type: 'START', pos: [-4, 0] }, { type: 'STITCH_TO', warp: 2, weft: -2 }, { type: 'STITCH_TO', warp: 2, weft: 2 }, { type: 'STITCH_TO', warp: -2, weft: 2 }, { type: 'STITCH_TO', warp: -2, weft: -2 },
  ]
};

const KeriMotif = {
  metadata: { id: 'motif_keri', name: 'Keri (Mango)', icon: '❦', desc: 'The classic paisley or mango motif, a staple of Soof.' },
  instructions: [
    { type: 'START', pos: [0, 6] },
    { type: 'COLOR', color: 'var(--text-dark)' },
    { type: 'LAYER', layer: 'outline' },
    { type: 'STITCH_TO', warp: 6, weft: -6 }, { type: 'STITCH_TO', warp: 0, weft: -4 }, { type: 'STITCH_TO', warp: -4, weft: -4 }, { type: 'STITCH_TO', warp: -4, weft: 4 }, { type: 'STITCH_TO', warp: 2, weft: 2 }, { type: 'STITCH_TO', warp: -2, weft: 2 }, { type: 'STITCH_TO', warp: 2, weft: 6 }
  ]
};

const JaliMotif = {
  metadata: { id: 'motif_jali', name: 'Jali (Trellis)', icon: '▦', desc: 'A geometric mesh or trellis pattern used to fill large spaces.' },
  instructions: [
    { type: 'COLOR', color: 'var(--text-dark)' },
    { type: 'LAYER', layer: 'outline' },
    { type: 'START', pos: [-4, -4] }, { type: 'STITCH_TO', warp: 8, weft: 8 },
    { type: 'START', pos: [-4, 0] }, { type: 'STITCH_TO', warp: 8, weft: 8 },
    { type: 'START', pos: [4, -4] }, { type: 'STITCH_TO', warp: -8, weft: 8 },
    { type: 'START', pos: [4, 0] }, { type: 'STITCH_TO', warp: -8, weft: 8 }
  ]
};

const MorMotif = {
  metadata: { id: 'motif_mor', name: 'Mor (Peacock)', icon: '🦚', desc: 'An abstract geometric representation of a peacock.' },
  instructions: [
    { type: 'START', pos: [-2, -6] },
    { type: 'COLOR', color: 'var(--text-dark)' },
    { type: 'LAYER', layer: 'outline' },
    
    { type: 'STITCH_TO', warp: 2, weft: 0, narration: 'Count 2 right to start the beak.' },
    { type: 'STITCH_TO', warp: -1, weft: 1, narration: 'Count 1 left, 1 down for the top-left head.' },
    { type: 'STITCH_TO', warp: 1, weft: 1, narration: 'Count 1 right, 1 down to the throat.' },
    { type: 'STITCH_TO', warp: 1, weft: -1, narration: 'Count 1 right, 1 up for the back of the head.' },
    { type: 'STITCH_TO', warp: -1, weft: -1, narration: 'Count 1 left, 1 up to complete the head.' },
    { type: 'STITCH_TO', warp: 1, weft: 1, narration: 'Retrace down the head to the back-neck.' },
    { type: 'STITCH_TO', warp: 2, weft: 2, narration: 'Count 2 right, 2 down for the neck.' },
    { type: 'STITCH_TO', warp: 3, weft: 3, narration: 'Count 3 right, 3 down for the front of the body.' },
    { type: 'STITCH_TO', warp: -6, weft: 0, narration: 'Count 6 left for the flat bottom of the body.' },
    
    // Tail Feathers fanning out
    { type: 'STITCH_TO', warp: -2, weft: 2, narration: 'Count 2 left, 2 down for the lower feather.' },
    { type: 'STITCH_TO', warp: 2, weft: -2, narration: 'Return to the body base.' },
    { type: 'STITCH_TO', warp: -3, weft: 0, narration: 'Count 3 left for the middle feather.' },
    { type: 'STITCH_TO', warp: 3, weft: 0, narration: 'Return to the body base.' },
    { type: 'STITCH_TO', warp: -2, weft: -2, narration: 'Count 2 left, 2 up for the upper feather.' },
    { type: 'STITCH_TO', warp: 2, weft: 2, narration: 'Return to the body base.' },
    
    // Back of body
    { type: 'STITCH_TO', warp: 3, weft: -3, narration: 'Count 3 right, 3 up to close the body triangle.' }
  ]
};

const MOTIFS = [MihrabMotif, ChaukorMotif, TikudiMotif, LeherMotif, PhoolMotif, KeriMotif, JaliMotif, MorMotif];
