/**
 * js/tour.js
 * Interactive onboarding tour for first-time users.
 */

const Tour = {
  currentStep: 0,
  isActive: false,

  steps: [
    {
      target: null, // Centered
      title: "Welcome to Soof Studio",
      text: "Let's take a quick look around your digital embroidery workspace."
    },
    {
      target: "#mode-nav",
      title: "Learning Modes",
      text: "Switch between Learn (step-by-step), Practice (tracing), and Sandbox (freeform) modes depending on your skill level."
    },
    {
      target: "#left-panel",
      title: "Motif Library",
      text: "Browse and select traditional Soof embroidery patterns to learn their geometries."
    },
    {
      target: "#right-panel",
      title: "Stitch Guide",
      text: "Follow the step-by-step counting instructions here to master the sequence of each motif."
    },
    {
      target: "#workspace",
      title: "Embroidery Canvas",
      text: "Lay stitches on the pixel-perfect digital fabric. Count your warp and weft threads carefully!"
    }
  ],

  init() {
    if (localStorage.getItem('soof_tour_seen')) return;

    this.overlay = document.getElementById('tour-overlay');
    this.tooltip = document.getElementById('tour-tooltip');
    this.titleEl = document.getElementById('tour-title');
    this.textEl = document.getElementById('tour-text');
    this.btnNext = document.getElementById('tour-next');
    this.btnSkip = document.getElementById('tour-skip');

    this.btnNext.addEventListener('click', () => this.next());
    this.btnSkip.addEventListener('click', () => this.end());

    // Small delay to ensure UI has rendered
    setTimeout(() => this.start(), 500);
  },

  start() {
    this.isActive = true;
    this.currentStep = 0;
    this.overlay.classList.remove('hidden');
    this.tooltip.classList.remove('hidden');
    
    // Ensure we start in LEARN mode so panels exist in the right state
    if (window.setMode && window.SoofState && window.SoofState.mode !== 'LEARN') {
      window.setMode('LEARN');
    }

    this.renderStep();
  },

  next() {
    this.currentStep++;
    if (this.currentStep >= this.steps.length) {
      this.end();
    } else {
      this.renderStep();
    }
  },

  end() {
    this.isActive = false;
    this.overlay.classList.add('hidden');
    this.tooltip.classList.add('hidden');
    this.clearHighlight();
    localStorage.setItem('soof_tour_seen', 'true');
  },

  clearHighlight() {
    document.querySelectorAll('.tour-highlight').forEach(el => {
      el.classList.remove('tour-highlight');
    });
  },

  renderStep() {
    this.clearHighlight();
    const step = this.steps[this.currentStep];

    this.titleEl.textContent = step.title;
    this.textEl.textContent = step.text;
    this.btnNext.textContent = this.currentStep === this.steps.length - 1 ? "Finish" : "Next";

    if (step.target) {
      const targetEl = document.querySelector(step.target);
      if (targetEl) {
        targetEl.classList.add('tour-highlight');
        this.positionTooltip(targetEl);
      } else {
        this.centerTooltip();
      }
    } else {
      this.centerTooltip();
    }
  },

  centerTooltip() {
    this.tooltip.style.top = '50%';
    this.tooltip.style.left = '50%';
    this.tooltip.style.transform = 'translate(-50%, -50%)';
  },

  positionTooltip(targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const padding = 16;
    
    let top = 0;
    let left = 0;
    let transform = '';

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Check if the target is extremely large (e.g. the main workspace container)
    const isTargetHuge = rect.width > viewportW * 0.6 && rect.height > viewportH * 0.6;

    if (isTargetHuge) {
      // Place it floating in a fixed safe area (e.g. bottom center, above the bulk meter)
      top = viewportH - 220; 
      left = viewportW / 2;
      transform = 'translate(-50%, 0)';
    } else if (rect.bottom + padding + 220 < viewportH) {
      top = rect.bottom + padding;
      left = rect.left + (rect.width / 2);
      transform = 'translate(-50%, 0)';
    } else if (rect.right + padding + 340 < viewportW) {
      top = rect.top + (rect.height / 2);
      left = rect.right + padding;
      transform = 'translate(0, -50%)';
    } else if (rect.left - padding - 340 > 0) {
      top = rect.top + (rect.height / 2);
      left = rect.left - padding;
      transform = 'translate(-100%, -50%)';
    } else {
      top = Math.max(padding, rect.top - padding);
      left = rect.left + (rect.width / 2);
      transform = 'translate(-50%, -100%)';
    }

    // Apply initial positioning
    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.transform = transform;

    // Clamp to viewport boundaries on next frame when size is computed
    requestAnimationFrame(() => {
      const toolRect = this.tooltip.getBoundingClientRect();
      let adjustedTop = parseFloat(this.tooltip.style.top);
      let adjustedLeft = parseFloat(this.tooltip.style.left);
      let tX = 0;
      let tY = 0;

      // Extract translation values if centering is active
      if (transform.includes('-50%')) tX = -50;
      if (transform.includes('-100%')) tY = -100;

      // Handle horizontal boundary overflow
      if (toolRect.left < padding) {
        adjustedLeft = padding;
        tX = 0; // Clear translation
      } else if (toolRect.right > viewportW - padding) {
        adjustedLeft = viewportW - toolRect.width - padding;
        tX = 0; // Clear translation
      }

      // Handle vertical boundary overflow
      if (toolRect.top < padding) {
        if (tY === -100 && !isTargetHuge) {
          // If it was above the target, push it below instead
          adjustedTop = rect.bottom + padding;
          tY = 0;
        } else {
          adjustedTop = padding;
          tY = 0;
        }
      } else if (toolRect.bottom > viewportH - padding) {
        adjustedTop = viewportH - toolRect.height - padding;
        tY = 0;
      }

      this.tooltip.style.top = `${adjustedTop}px`;
      this.tooltip.style.left = `${adjustedLeft}px`;
      this.tooltip.style.transform = `translate(${tX}%, ${tY}%)`;
    });
  }
};
