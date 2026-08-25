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
