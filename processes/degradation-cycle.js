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
        // Guard: if word order has reached 0, always use char mode
        const useChar = Math.random() < 0.5;
        if (useChar || this.wordOrder <= 0) {
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
   * Jump to a specific step number (for time-based auto-stepping)
   * @param {number} targetStep - Step to jump to (0-20)
   */
  jumpToStep(targetStep) {
    this.reset();
    const steps = Math.min(targetStep, 20);
    for (let i = 0; i < steps; i++) {
      this.step();
    }
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

  // --- Spawn Rate & Scheduling ---

  /**
   * Get spawn mode for current phase
   * @returns {'serial'|'overlap'|'poisson'}
   *   - serial: one snippet at a time, wait for death + pause
   *   - overlap: allow multiple, but capped, with minimum inter-spawn delay
   *   - poisson: stochastic arrivals, capped by maxConcurrent
   */
  getSpawnMode() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 'serial';
      case PHASES.WORD_MARKOV:
        // Orders 10-9: serial. Orders 8-6: overlap.
        return this.wordOrder >= 9 ? 'serial' : 'overlap';
      case PHASES.MIXED:
      case PHASES.CHAR_ONLY:
      case PHASES.FINAL:
        return 'poisson';
      default:
        return 'serial';
    }
  }

  /**
   * Get maximum concurrent snippets allowed on screen
   */
  getMaxConcurrent() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 1;
      case PHASES.WORD_MARKOV:
        if (this.wordOrder >= 9) return 1;  // serial
        if (this.wordOrder === 8) return 2;
        if (this.wordOrder === 7) return 2;
        return 3; // order 6
      case PHASES.MIXED:
        // 5 at word order 5, up to 12 at word order 1
        return 5 + Math.round((5 - this.wordOrder) * 1.75);
      case PHASES.CHAR_ONLY:
        return 15;
      case PHASES.FINAL:
        return 20;
      default:
        return 1;
    }
  }

  /**
   * Get pause duration (seconds) between spawns in serial/overlap modes.
   * In serial mode: pause after previous snippet dies.
   * In overlap mode: minimum inter-spawn delay.
   */
  getSerialPause() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0.8;
      case PHASES.WORD_MARKOV:
        if (this.wordOrder === 10) return 0.3;
        if (this.wordOrder === 9) return 0.2;
        if (this.wordOrder === 8) return 0.1;
        return 0; // orders 7-6
      default:
        return 0;
    }
  }

  /**
   * Get lambda (spawn rate) for Poisson mode.
   * Only meaningful when getSpawnMode() === 'poisson'.
   * Peaks in late mixed, slight pullback toward final.
   */
  getLambda() {
    switch (this.phase) {
      case PHASES.MIXED:
        // 0.4 at word order 5, up to 1.0 at word order 1
        return 0.4 + (5 - this.wordOrder) * 0.15;
      case PHASES.CHAR_ONLY:
        // 0.95 at order 10, drifts down slightly to 0.85 at order 1
        return 0.95 - (10 - this.charOrder) * 0.011;
      case PHASES.FINAL:
        return 0.85;
      default:
        // Shouldn't be called in serial/overlap modes, but fallback
        return 0.3;
    }
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

  // --- Flicker-Out Effect (text disappearance) ---

  /**
   * Get flicker-out duration in seconds
   * Early phases: quick, clean exit. Later phases: prolonged death throes.
   */
  getFlickerOutDuration() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0.4;
      case PHASES.WORD_MARKOV:
        return 0.5 + (10 - this.wordOrder) * 0.08;
      case PHASES.MIXED:
        return 0.9 + (5 - this.wordOrder) * 0.15;
      case PHASES.CHAR_ONLY:
        return 1.5 + (10 - this.charOrder) * 0.05;
      case PHASES.FINAL:
        return 2.0;
      default:
        return 0.5;
    }
  }

  /**
   * Get flicker-out intensity (0-1)
   * Controls how chaotic the flicker effect is.
   */
  getFlickerOutIntensity() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0.2; // subtle, clean
      case PHASES.WORD_MARKOV:
        return 0.25 + (10 - this.wordOrder) * 0.05;
      case PHASES.MIXED:
        return 0.5 + (5 - this.wordOrder) * 0.08;
      case PHASES.CHAR_ONLY:
        return 0.8 + (10 - this.charOrder) * 0.02;
      case PHASES.FINAL:
        return 1.0;
      default:
        return 0.3;
    }
  }

  /**
   * Get character scatter probability during flicker-out
   * Higher = more characters disappear independently
   */
  getCharacterScatter() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0;
      case PHASES.WORD_MARKOV:
        return (10 - this.wordOrder) * 0.03;
      case PHASES.MIXED:
        return 0.15 + (5 - this.wordOrder) * 0.08;
      case PHASES.CHAR_ONLY:
        return 0.5 + (10 - this.charOrder) * 0.05;
      case PHASES.FINAL:
        return 0.9;
      default:
        return 0;
    }
  }

  /**
   * Get position jitter amount during flicker-out (in pixels)
   */
  getFlickerJitter() {
    switch (this.phase) {
      case PHASES.VERBATIM:
        return 0;
      case PHASES.WORD_MARKOV:
        return (10 - this.wordOrder) * 0.5;
      case PHASES.MIXED:
        return 3 + (5 - this.wordOrder) * 1;
      case PHASES.CHAR_ONLY:
        return 8 + (10 - this.charOrder) * 0.5;
      case PHASES.FINAL:
        return 12;
      default:
        return 0;
    }
  }

  // --- Voice Degradation (SAM TTS) ---

  /**
   * Get voice mix for hybrid TTS.
   * Controls the balance between LPC (human) and SAM (synthetic) voices.
   * 
   * @returns {object} { lpcProbability, primaryVoice }
   *   lpcProbability: 0-1, chance of using LPC for this phrase
   *   primaryVoice: null (random) or specific voice name
   */
  getVoiceMix() {
    const step = this.getStepCount();
    const progress = step / 20;

    // Early: 100% LPC
    // Mid: Gradually introduce SAM
    // Late: 100% SAM
    let lpcProbability;
    
    if (progress < 0.2) {
      // Verbatim and early word markov: pure LPC
      lpcProbability = 1.0;
    } else if (progress < 0.5) {
      // Word markov mid: LPC dominant, occasional SAM
      lpcProbability = 1.0 - (progress - 0.2) * 1.0; // 1.0 → 0.7
    } else if (progress < 0.8) {
      // Mixed mode: SAM taking over
      lpcProbability = 0.7 - (progress - 0.5) * 2.0; // 0.7 → 0.1
    } else {
      // Char only / final: pure SAM
      lpcProbability = Math.max(0, 0.1 - (progress - 0.8) * 0.5);
    }

    return {
      lpcProbability,
      primaryVoice: null, // Let hybrid-tts pick randomly
    };
  }

  /**
   * Get voice parameters for SAM TTS.
   * 
   * Early: Natural-ish, varied male/female voices (random per snippet)
   * Mid: Converging toward robotic monotone
   * Late: Extreme/glitchy parameters
   * 
   * @returns {object} { speed, pitch, throat, mouth, glitch }
   */
  getVoiceParams() {
    // Calculate degradation progress (0 = verbatim, 1 = final)
    const step = this.getStepCount();
    const progress = step / 20;

    // --- Base voice ranges ---
    // Natural human-like range (early)
    // SAM pitch: higher = higher voice. Speed: lower = slower/more deliberate
    const humanVoices = {
      // Female-ish: higher pitch, tighter throat/mouth, varied speed
      female: { speed: [58, 75], pitch: [100, 150], throat: [120, 145], mouth: [128, 155] },
      // Male-ish: medium pitch, more open throat/mouth
      male: { speed: [62, 82], pitch: [70, 100], throat: [115, 140], mouth: [110, 135] },
      // Child-ish: highest pitch, small mouth
      child: { speed: [55, 70], pitch: [140, 180], throat: [130, 155], mouth: [140, 170] },
    };
    
    // Robotic target (mid-late)
    const robotVoice = { speed: 92, pitch: 64, throat: 180, mouth: 180 };
    
    // Glitchy extremes (final)
    const glitchRange = {
      speed: [40, 150],
      pitch: [20, 200],
      throat: [80, 255],
      mouth: [80, 255],
    };

    let params;

    if (progress < 0.3) {
      // Early: Random human voice (female, male, or child - weighted toward higher pitches)
      const roll = Math.random();
      let voice;
      if (roll < 0.4) {
        voice = humanVoices.female;
      } else if (roll < 0.7) {
        voice = humanVoices.male;
      } else {
        voice = humanVoices.child;
      }
      params = {
        speed: this._randomInRange(voice.speed),
        pitch: this._randomInRange(voice.pitch),
        throat: this._randomInRange(voice.throat),
        mouth: this._randomInRange(voice.mouth),
      };
    } else if (progress < 0.7) {
      // Mid: Blend toward robot voice
      const blendFactor = (progress - 0.3) / 0.4; // 0 at 0.3, 1 at 0.7
      const roll = Math.random();
      let voice;
      if (roll < 0.4) {
        voice = humanVoices.female;
      } else if (roll < 0.7) {
        voice = humanVoices.male;
      } else {
        voice = humanVoices.child;
      }
      
      // Start with human, blend toward robot
      const humanParams = {
        speed: this._randomInRange(voice.speed),
        pitch: this._randomInRange(voice.pitch),
        throat: this._randomInRange(voice.throat),
        mouth: this._randomInRange(voice.mouth),
      };
      
      params = {
        speed: Math.round(this._lerp(humanParams.speed, robotVoice.speed, blendFactor)),
        pitch: Math.round(this._lerp(humanParams.pitch, robotVoice.pitch, blendFactor)),
        throat: Math.round(this._lerp(humanParams.throat, robotVoice.throat, blendFactor)),
        mouth: Math.round(this._lerp(humanParams.mouth, robotVoice.mouth, blendFactor)),
      };
    } else {
      // Late: Robot with increasing glitch randomness
      const glitchFactor = (progress - 0.7) / 0.3; // 0 at 0.7, 1 at 1.0
      
      // Base is robot, add random glitch deviation
      params = {
        speed: Math.round(this._lerp(robotVoice.speed, this._randomInRange(glitchRange.speed), glitchFactor)),
        pitch: Math.round(this._lerp(robotVoice.pitch, this._randomInRange(glitchRange.pitch), glitchFactor)),
        throat: Math.round(this._lerp(robotVoice.throat, this._randomInRange(glitchRange.throat), glitchFactor)),
        mouth: Math.round(this._lerp(robotVoice.mouth, this._randomInRange(glitchRange.mouth), glitchFactor)),
      };
    }

    // Clamp to valid SAM ranges
    params.speed = Math.max(1, Math.min(255, params.speed));
    params.pitch = Math.max(1, Math.min(255, params.pitch));
    params.throat = Math.max(1, Math.min(255, params.throat));
    params.mouth = Math.max(1, Math.min(255, params.mouth));

    // Add glitch metadata for audio effects
    params.glitch = {
      // Probability of audio stutter/repeat
      stutterChance: progress > 0.5 ? (progress - 0.5) * 0.4 : 0,
      // Probability of pitch drift mid-word
      pitchDriftChance: progress > 0.6 ? (progress - 0.6) * 0.5 : 0,
      // Amount of noise to mix in (0-1)
      noiseLevel: progress > 0.4 ? (progress - 0.4) * 0.3 : 0,
    };

    return params;
  }

  /**
   * Linear interpolation helper
   */
  _lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Random value in range [min, max]
   */
  _randomInRange([min, max]) {
    return min + Math.random() * (max - min);
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
