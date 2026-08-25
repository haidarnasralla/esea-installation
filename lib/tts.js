/**
 * Text-to-Speech module
 * 
 * Routes to:
 * - hybrid: LPC voices with SAM fallback (default)
 * - sam: SAM only (Software Automatic Mouth)
 * - lpc: LPC only (TMS5100/Speak&Spell)
 */

import config from '../config.js';
import hybridSynth from './hybrid-tts.js';
import samSynth from './sam-synth.js';
import lpcSynth from './formant-synth.js';

// Active engine reference
let activeEngine = null;
let engineName = null;

/**
 * Initialize TTS (sets up audio context on first user interaction)
 */
export function initTTS() {
  engineName = config.TTS_ENGINE || 'hybrid';
  
  switch (engineName) {
    case 'hybrid':
      hybridSynth.init();
      activeEngine = hybridSynth;
      console.log('TTS initialized: Hybrid (LPC + SAM fallback)');
      break;
    case 'sam':
      samSynth.init();
      activeEngine = samSynth;
      console.log('TTS initialized: SAM (Software Automatic Mouth)');
      break;
    case 'lpc':
      activeEngine = lpcSynth;
      console.log('TTS initialized: LPC (TMS5100/Speak & Spell)');
      break;
    default:
      hybridSynth.init();
      activeEngine = hybridSynth;
      engineName = 'hybrid';
  }
}

/**
 * Speak text using selected engine
 * @param {string} text - Text to vocalize
 * @param {object} options - Engine-specific options
 *   For hybrid: { voiceMix, samVoiceParams }
 *   For sam: { speed, pitch, throat, mouth, glitch }
 */
export function speak(text, options = null) {
  if (!activeEngine) initTTS();
  
  if (options) {
    activeEngine.speak(text, options);
  } else {
    activeEngine.speak(text);
  }
}

/**
 * Pre-render and speak text over a specified duration (synced to typing)
 * @param {string} text - Text to vocalize
 * @param {number} duration - Duration in seconds
 * @param {object} options - Engine-specific options
 */
export function speakOverDuration(text, duration, options = null) {
  if (!activeEngine) initTTS();
  
  if (engineName === 'hybrid' && options) {
    activeEngine.speakOverDuration(text, duration, options);
  } else if (engineName === 'sam' && options) {
    activeEngine.speakOverDuration(text, duration, options);
  } else {
    activeEngine.speakOverDuration(text, duration);
  }
}

/**
 * Set volume (0-1)
 * @param {number} value
 */
export function setVolume(value) {
  if (!activeEngine) initTTS();
  activeEngine.setVolume(value);
}

/**
 * Get the name of the current TTS engine
 * @returns {string} - 'hybrid', 'sam', or 'lpc'
 */
export function getEngineName() {
  return engineName || config.TTS_ENGINE || 'hybrid';
}
