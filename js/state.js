/**
 * js/state.js
 * Single app state tree plus command history.
 */

const AppState = {
  mode: 'LEARN',
  activePattern: null,
  targetStitches: [],

  grid: {
    cellPx: 20,
    cols: 40,
    rows: 40,
    originW: 20,
    originF: 20
  },

  cursor: {
    w: 0,
    f: 0,
    color: '#C0392B',
    visible: true
  },

  stitches: [],

  overlay: {
    activeCountStep: 0,
    message: ''
  },

  // Two-click + post-hoc count verification — shared across LEARN, PRACTICE, FREE
  pendingThreadAnchor: null,      // [w, f] of the first click (needle set-down)
  pendingDrawnStitch: null,       // Stitch object placed tentatively after second click
  pendingCountAxis: 'warp',       // Which axis the radial popover is currently asking about
  pendingExpectedWarp: 0,         // |warpDelta| the learner should count
  pendingExpectedWeft: 0,         // |weftDelta| the learner should count
  pendingAnswerWarp: null,        // What the learner actually answered for warp

  learn: {
    currentStitchIndex: 0,
    pendingStitch: null,
    countAxis: 'warp'
  },

  practice: {
    difficulty: 'NORMAL',
    currentStitchIndex: 0
  },

  free: {
    anchor: null
  },

  // Auto Satin Fill tool state
  fill: {
    active: false,       // is the fill tool currently engaged?
    vertices: [],        // [[w,f], ...] — polygon vertices being built
    previewEdge: null,   // [w,f] — current mouse position for rubber-band preview
    density: 1,          // Step for weft rows (1 = every thread, 2 = every other thread)
    outline: true        // Whether to draw a perimeter outline stitch
  },

  settings: {
    handedness: 'RIGHT'
  },

  // Feature 1: which face of the fabric is shown
  view: 'REVERSE', // 'REVERSE' = working side (grid + needle), 'FRONT' = finished face

  history: [],
  redoStack: []
};

class Command {
  execute() {}
  undo() {}
}

class PlaceStitchCommand extends Command {
  constructor(stitch) {
    super();
    this.stitch = stitch;
  }

  execute() {
    this.stitch._isNew = true;
    AppState.stitches.push(this.stitch);
  }

  undo() {
    AppState.stitches = AppState.stitches.filter(stitch => stitch.id !== this.stitch.id);
  }
}

class RemoveStitchCommand extends Command {
  constructor(stitchId) {
    super();
    this.stitchId = stitchId;
    this.removed = null;
  }

  execute() {
    this.removed = AppState.stitches.find(stitch => stitch.id === this.stitchId) || this.removed;
    AppState.stitches = AppState.stitches.filter(stitch => stitch.id !== this.stitchId);
  }

  undo() {
    if (this.removed) AppState.stitches.push(this.removed);
  }
}

class ClearStitchesCommand extends Command {
  constructor() {
    super();
    this.previousStitches = [...AppState.stitches];
  }

  execute() {
    AppState.stitches = [];
  }

  undo() {
    AppState.stitches = [...this.previousStitches];
  }
}

class BatchFillCommand extends Command {
  constructor(stitches) {
    super();
    this.stitches = stitches;
    this._ids = new Set(stitches.map(s => s.id));
  }

  execute() {
    this.stitches.forEach((s, idx) => {
      s._isNew = true;
      s._animOrder = idx;
    });
    AppState.stitches.push(...this.stitches);
  }

  undo() {
    AppState.stitches = AppState.stitches.filter(s => !this._ids.has(s.id));
  }
}

function executeCommand(command) {
  command.execute();
  AppState.history.push(command);
  AppState.redoStack = [];
  emitStateUpdated();
}

function undoCommand() {
  const command = AppState.history.pop();
  if (!command) return;

  command.undo();
  AppState.redoStack.push(command);
  emitStateUpdated();
}

function redoCommand() {
  const command = AppState.redoStack.pop();
  if (!command) return;

  command.execute();
  AppState.history.push(command);
  emitStateUpdated();
}

function clearHistory() {
  AppState.history = [];
  AppState.redoStack = [];
}

function emitStateUpdated() {
  window.dispatchEvent(new CustomEvent('state:updated'));
}
