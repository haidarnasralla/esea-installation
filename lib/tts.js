/**
 * Text-to-Speech module
 * 
 * Uses formant synthesis via Web Audio API for vocal-like sounds.
 */

import lpcSynth from './formant-synth.js';

/**
 * Initialize TTS (sets up audio context on first user interaction)
 */
export function initTTS() {
  console.log('TTS ready (LPC synthesis - TMS5100 style)');
}

/**
 * Speak text using LPC synthesis
 * @param {string} text - Text to vocalize
 */
export function speak(text) {
  lpcSynth.speak(text);
}

/**
 * Set volume (0-1)
 * @param {number} value
 */
export function setVolume(value) {
  lpcSynth.setVolume(value);
}
