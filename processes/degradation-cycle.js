/**
 * DegradationCycle - State machine for the text entropy installation
 * 
 * Phases:
 * 1. VERBATIM - exact lines from corpus
 * 2. WORD_MARKOV - word-level Markov, order 10 → 6
 * 3. MIXED - word (order 5 → 1) AND char (order 10 → 1), random selection
 * 4. CHAR_ONLY - character-level only, order continues → 1
 * 5. FINAL - character-level order 1, stays forever
 */

const PHASES = {
  VERBATIM: 'verbatim',
  WORD_MARKOV: 'word_markov',
  MIXED: 'mixed',
  CHAR_ONLY: 'char_only',
  FINAL: 'final',
};

class DegradationCycle {
  constructor() {
    this.phase = PHASES.VERBATIM;
    this.wordOrder = 10;
    this.charOrder = 10;
    this.charModeActive = false; // becomes true when entering mixed mode
  }

  /**
   * Get current state for display
   */
  getState() {
    return {
      phase: this.phase,
      wordOrder: this.wordOrder,
      charOrder: this.charOrder,
      charModeActive: this.charModeActive,
      description: this._getDescription(),
    };
  }

  /**
   * Human-readable description of current state
   */
  _getDescription() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 'Verbatim (exact corpus lines)';
      case PHASES.WORD_MARKOV:
        return `Word Markov (order ${this.wordOrder})`;
      case PHASES.MIXED:
        return `Mixed: Word(${this.wordOrder}) + Char(${this.charOrder})`;
      case PHASES.CHAR_ONLY:
        return `Character only (order ${this.charOrder})`;
      case PHASES.FINAL:
        return 'Final state: Character order 1 (maximum entropy)';
    }
  }

  /**
   * Step forward in the degradation cycle
   * @returns {object} New state after stepping
   */
  step() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        // Move to word markov at order 10
        this.phase = PHASES.WORD_MARKOV;
        this.wordOrder = 10;
        break;

      case PHASES.WORD_MARKOV:
        // Decrease word order by 1
        this.wordOrder--;
        if (this.wordOrder === 5) {
          // Enter mixed mode - char becomes available
          this.phase = PHASES.MIXED;
          this.charModeActive = true;
          this.charOrder = 10;
        }
        break;

      case PHASES.MIXED:
        // Decrease both orders by 1 each step
        // Word goes 5 → 4 → 3 → 2 → 1 → done
        // Char goes 10 → 9 → 8 → ... → 1
        if (this.wordOrder > 0) {
          this.wordOrder--;
        }
        if (this.charOrder > 1) {
          this.charOrder--;
        }
        
        // When word hits 0, switch to char only
        if (this.wordOrder === 0) {
          this.phase = PHASES.CHAR_ONLY;
        }
        break;

      case PHASES.CHAR_ONLY:
        // Decrease char order until we hit 1
        if (this.charOrder > 1) {
          this.charOrder--;
        } else {
          this.phase = PHASES.FINAL;
        }
        break;

      case PHASES.FINAL:
        // Stay here forever
        break;
    }

    return this.getState();
  }

  /**
   * Get generation parameters for current state
   * @returns {object} { mode: 'verbatim'|'word'|'char'|'mixed', wordOrder, charOrder }
   */
  getGenerationParams() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return { mode: 'verbatim' };

      case PHASES.WORD_MARKOV:
        return { mode: 'word', wordOrder: this.wordOrder };

      case PHASES.MIXED:
        // Randomly select between word and char
        const useChar = Math.random() < 0.5;
        if (useChar) {
          return { mode: 'char', charOrder: this.charOrder };
        } else {
          return { mode: 'word', wordOrder: this.wordOrder };
        }

      case PHASES.CHAR_ONLY:
      case PHASES.FINAL:
        return { mode: 'char', charOrder: this.charOrder };
    }
  }

  /**
   * Reset to initial state
   */
  reset() {
    this.phase = PHASES.VERBATIM;
    this.wordOrder = 10;
    this.charOrder = 10;
    this.charModeActive = false;
  }

  /**
   * Check if we've reached the final state
   */
  isFinal() {
    return this.phase === PHASES.FINAL;
  }

  /**
   * Get overlap tolerance (0 = no overlap allowed, 0.6 = max overlap allowed)
   * Scales with degradation progress, capped at 60%
   */
  getOverlapTolerance() {
    let tolerance;
    
    switch (this.phase) {
      case PHASES.VERBATIM:
        tolerance = 0;
        break;
      case PHASES.WORD_MARKOV:
        // 0 at order 10, gradually increase to 0.12 at order 6
        tolerance = (10 - this.wordOrder) * 0.03;
        break;
      case PHASES.MIXED:
        // 0.15 at start, increase as word order drops
        tolerance = 0.15 + (5 - this.wordOrder) * 0.06;
        break;
      case PHASES.CHAR_ONLY:
        // 0.45 at order 10, increase toward 0.6 as it drops
        tolerance = 0.45 + (10 - this.charOrder) * 0.015;
        break;
      case PHASES.FINAL:
        tolerance = 0.6;
        break;
      default:
        tolerance = 0;
    }
    
    return Math.min(tolerance, 0.6);
  }

  /**
   * Get minimum spawn distance in pixels (base value before tolerance applied)
   */
  getMinSpawnDistance() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 150;
      case PHASES.WORD_MARKOV:
        return 120;
      case PHASES.MIXED:
        return 80;
      case PHASES.CHAR_ONLY:
        return 40;
      case PHASES.FINAL:
        return 0;
      default:
        return 150;
    }
  }

  // --- LFO Spawn Rate ---

  /**
   * Get base lambda (spawn rate) for current phase
   */
  getBaseLambda() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0.3;
      case PHASES.WORD_MARKOV:
        // 0.4 at order 10, up to 0.6 at order 6
        return 0.4 + (10 - this.wordOrder) * 0.05;
      case PHASES.MIXED:
        // 0.7 at word order 5, up to 1.0 at word order 1
        return 0.7 + (5 - this.wordOrder) * 0.075;
      case PHASES.CHAR_ONLY:
        // 1.0 at order 10, up to 1.5 at order 1
        return 1.0 + (10 - this.charOrder) * 0.055;
      case PHASES.FINAL:
        return 1.5;
      default:
        return 0.3;
    }
  }

  /**
   * Get LFO amplitude (how much lambda varies)
   */
  getLfoAmplitude() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0.1;
      case PHASES.WORD_MARKOV:
        return 0.15 + (10 - this.wordOrder) * 0.02;
      case PHASES.MIXED:
        return 0.25 + (5 - this.wordOrder) * 0.05;
      case PHASES.CHAR_ONLY:
        return 0.4 + (10 - this.charOrder) * 0.01;
      case PHASES.FINAL:
        return 0.5;
      default:
        return 0.1;
    }
  }

  /**
   * Get LFO frequency in Hz (cycles per second)
   */
  getLfoFrequency() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0.02; // ~50s cycle
      case PHASES.WORD_MARKOV:
        return 0.025 + (10 - this.wordOrder) * 0.005;
      case PHASES.MIXED:
        return 0.05 + (5 - this.wordOrder) * 0.01;
      case PHASES.CHAR_ONLY:
        return 0.08 + (10 - this.charOrder) * 0.002;
      case PHASES.FINAL:
        return 0.1; // ~10s cycle
      default:
        return 0.02;
    }
  }

  /**
   * Get current lambda with LFO modulation applied
   * @param {number} time - Current time in seconds
   */
  getLambda(time) {
    const base = this.getBaseLambda();
    const amplitude = this.getLfoAmplitude();
    const frequency = this.getLfoFrequency();
    
    const lfo = Math.sin(time * frequency * Math.PI * 2);
    // Ensure lambda never goes below 0.1
    return Math.max(0.1, base + lfo * amplitude);
  }

  // --- Visual Entropy Effects ---

  /**
   * Get flicker probability (chance of momentary disappearance per frame)
   * Returns 0-1, where 0 = no flicker, higher = more flicker
   */
  getFlicker() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0;
      case PHASES.WORD_MARKOV:
        return (10 - this.wordOrder) * 0.005;
      case PHASES.MIXED:
        return 0.02 + (5 - this.wordOrder) * 0.015;
      case PHASES.CHAR_ONLY:
        return 0.08 + (10 - this.charOrder) * 0.008;
      case PHASES.FINAL:
        return 0.15;
      default:
        return 0;
    }
  }

  /**
   * Get fade flicker probability (chance of partial opacity drop per frame)
   */
  getFadeFlicker() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0;
      case PHASES.WORD_MARKOV:
        return (10 - this.wordOrder) * 0.01;
      case PHASES.MIXED:
        return 0.05 + (5 - this.wordOrder) * 0.02;
      case PHASES.CHAR_ONLY:
        return 0.12 + (10 - this.charOrder) * 0.01;
      case PHASES.FINAL:
        return 0.2;
      default:
        return 0;
    }
  }

  /**
   * Get inverse flicker probability (chance of inverted colors per frame)
   */
  getInverseFlicker() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0;
      case PHASES.WORD_MARKOV:
        return 0;
      case PHASES.MIXED:
        return (5 - this.wordOrder) * 0.005;
      case PHASES.CHAR_ONLY:
        return 0.03 + (10 - this.charOrder) * 0.005;
      case PHASES.FINAL:
        return 0.08;
      default:
        return 0;
    }
  }

  /**
   * Get chromatic aberration amount in pixels (RGB channel offset)
   */
  getChromaticAberration() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0;
      case PHASES.WORD_MARKOV:
        return (10 - this.wordOrder) * 0.3;
      case PHASES.MIXED:
        return 1.5 + (5 - this.wordOrder) * 0.4;
      case PHASES.CHAR_ONLY:
        return 3 + (10 - this.charOrder) * 0.2;
      case PHASES.FINAL:
        return 5;
      default:
        return 0;
    }
  }

  /**
   * Get color shift probability (chance of wrong color per frame)
   */
  getColorShift() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0;
      case PHASES.WORD_MARKOV:
        return (10 - this.wordOrder) * 0.008;
      case PHASES.MIXED:
        return 0.04 + (5 - this.wordOrder) * 0.015;
      case PHASES.CHAR_ONLY:
        return 0.1 + (10 - this.charOrder) * 0.01;
      case PHASES.FINAL:
        return 0.18;
      default:
        return 0;
    }
  }

  /**
   * Get noise overlay intensity (0-1)
   */
  getNoiseOverlay() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0;
      case PHASES.WORD_MARKOV:
        return (10 - this.wordOrder) * 0.02;
      case PHASES.MIXED:
        return 0.1 + (5 - this.wordOrder) * 0.04;
      case PHASES.CHAR_ONLY:
        return 0.25 + (10 - this.charOrder) * 0.03;
      case PHASES.FINAL:
        return 0.5;
      default:
        return 0;
    }
  }

  /**
   * Get character dropout probability (chance each character doesn't render)
   */
  getCharDropout() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0;
      case PHASES.WORD_MARKOV:
        return 0;
      case PHASES.MIXED:
        return (5 - this.wordOrder) * 0.02;
      case PHASES.CHAR_ONLY:
        return 0.1 + (10 - this.charOrder) * 0.015;
      case PHASES.FINAL:
        return 0.25;
      default:
        return 0;
    }
  }

  /**
   * Get duplicate ghost probability and intensity
   * Returns { probability, opacity, offset }
   */
  getDuplicateGhost() {
    let prob, opacity, offset;
    switch (this.phase) {
      case PHASES.VERBATIM:
        return { probability: 0, opacity: 0, offset: 0 };
      case PHASES.WORD_MARKOV:
        prob = (10 - this.wordOrder) * 0.02;
        opacity = 0.2;
        offset = 2;
        break;
      case PHASES.MIXED:
        prob = 0.1 + (5 - this.wordOrder) * 0.03;
        opacity = 0.25;
        offset = 3;
        break;
      case PHASES.CHAR_ONLY:
        prob = 0.2 + (10 - this.charOrder) * 0.02;
        opacity = 0.3;
        offset = 4;
        break;
      case PHASES.FINAL:
        prob = 0.35;
        opacity = 0.35;
        offset = 5;
        break;
      default:
        return { probability: 0, opacity: 0, offset: 0 };
    }
    return { probability: prob, opacity, offset };
  }

  /**
   * Get slice displacement settings
   * Returns { probability, maxSlices, maxOffset }
   */
  getSliceDisplacement() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return { probability: 0, maxSlices: 0, maxOffset: 0 };
      case PHASES.WORD_MARKOV:
        return { 
          probability: (10 - this.wordOrder) * 0.01, 
          maxSlices: 1, 
          maxOffset: 3 
        };
      case PHASES.MIXED:
        return { 
          probability: 0.05 + (5 - this.wordOrder) * 0.02, 
          maxSlices: 2, 
          maxOffset: 6 
        };
      case PHASES.CHAR_ONLY:
        return { 
          probability: 0.12 + (10 - this.charOrder) * 0.01, 
          maxSlices: 3, 
          maxOffset: 10 
        };
      case PHASES.FINAL:
        return { probability: 0.2, maxSlices: 4, maxOffset: 15 };
      default:
        return { probability: 0, maxSlices: 0, maxOffset: 0 };
    }
  }

  /**
   * Get bit crush probability (reduced color depth flash)
   */
  getBitCrush() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0;
      case PHASES.WORD_MARKOV:
        return (10 - this.wordOrder) * 0.005;
      case PHASES.MIXED:
        return 0.03 + (5 - this.wordOrder) * 0.01;
      case PHASES.CHAR_ONLY:
        return 0.07 + (10 - this.charOrder) * 0.008;
      case PHASES.FINAL:
        return 0.12;
      default:
        return 0;
    }
  }

  /**
   * Get step count (how many steps from start)
   */
  getStepCount() {
    // verbatim = 0
    // word 10 = 1, word 9 = 2, ..., word 6 = 5
    // mixed starts at step 6 (word 5, char 10)
    // mixed continues: step 7 (word 4, char 9), step 8 (word 3, char 8), etc.
    // char only starts when word = 0
    // final when char = 1
    
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0;
      case PHASES.WORD_MARKOV:
        return 10 - this.wordOrder + 1;
      case PHASES.MIXED:
        return 5 + (5 - this.wordOrder) + 1;
      case PHASES.CHAR_ONLY:
        return 11 + (10 - this.charOrder);
      case PHASES.FINAL:
        return 20; // Total steps to reach final
    }
  }
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DegradationCycle, PHASES };
}
export { DegradationCycle, PHASES };
export default DegradationCycle;
