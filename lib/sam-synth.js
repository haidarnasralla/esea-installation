/**
 * SAM (Software Automatic Mouth) TTS Wrapper
 * 
 * Wraps the sam-js library for use with Web Audio API.
 * SAM is a 1982 C64 speech synthesizer - perfect retro aesthetic.
 * 
 * Supports voice degradation: human-like → robotic → glitchy
 */

// Import SAM.js (UMD module, attaches to window.SamJs)
import './vendor/sam.js';

let audioContext = null;
let gainNode = null;
let limiter = null;
let volume = 1.0;

// Default SAM voice (will be overridden by degradation cycle)
let defaultVoice = { speed: 72, pitch: 64, throat: 128, mouth: 128 };

/**
 * Initialize audio context (call on user interaction)
 */
function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create limiter (DynamicsCompressor configured as limiter)
    limiter = audioContext.createDynamicsCompressor();
    limiter.threshold.value = -6;    // Start limiting at -6dB
    limiter.knee.value = 3;          // Soft knee for smoother limiting
    limiter.ratio.value = 20;        // High ratio = hard limiting
    limiter.attack.value = 0.001;    // Fast attack (1ms)
    limiter.release.value = 0.1;     // Moderate release (100ms)
    
    // Create gain node for volume control
    gainNode = audioContext.createGain();
    gainNode.gain.value = volume;
    
    // Chain: source → gainNode → limiter → destination
    gainNode.connect(limiter);
    limiter.connect(audioContext.destination);
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * Create a SAM instance with given voice settings
 * @param {object} voice - { speed, pitch, throat, mouth }
 */
function createSam(voice = defaultVoice) {
  return new window.SamJs({
    speed: voice.speed || 72,
    pitch: voice.pitch || 64,
    throat: voice.throat || 128,
    mouth: voice.mouth || 128,
  });
}

/**
 * Generate raw audio samples from text
 * @param {string} text - Text to synthesize
 * @param {object} voice - Voice parameters
 * @returns {Float32Array|null} - Audio samples or null if failed
 */
function generateSamples(text, voice = defaultVoice) {
  try {
    const sam = createSam(voice);
    // buf32 returns Float32Array of audio samples at 22050 Hz
    const samples = sam.buf32(text);
    return samples;
  } catch (e) {
    console.warn('SAM synthesis failed:', e);
    return null;
  }
}

/**
 * Apply glitch effects to audio samples
 * @param {Float32Array} samples - Original samples
 * @param {object} glitch - { stutterChance, pitchDriftChance, noiseLevel }
 * @returns {Float32Array} - Processed samples
 */
function applyGlitchEffects(samples, glitch) {
  if (!glitch || (!glitch.stutterChance && !glitch.noiseLevel)) {
    return samples;
  }

  const output = new Float32Array(samples.length);
  
  // Copy with noise
  for (let i = 0; i < samples.length; i++) {
    let sample = samples[i];
    
    // Add noise
    if (glitch.noiseLevel > 0) {
      const noise = (Math.random() * 2 - 1) * glitch.noiseLevel;
      sample = sample * (1 - glitch.noiseLevel * 0.5) + noise;
    }
    
    output[i] = Math.max(-1, Math.min(1, sample));
  }

  // Apply stutter effect (repeat random chunks)
  if (glitch.stutterChance > 0 && Math.random() < glitch.stutterChance) {
    const chunkSize = Math.floor(Math.random() * 2000) + 500; // 500-2500 samples
    const startPos = Math.floor(Math.random() * (samples.length - chunkSize * 2));
    const repeats = Math.floor(Math.random() * 3) + 1; // 1-3 repeats
    
    // Copy the chunk over subsequent audio
    for (let r = 0; r < repeats; r++) {
      const destPos = startPos + chunkSize * (r + 1);
      if (destPos + chunkSize < output.length) {
        for (let i = 0; i < chunkSize; i++) {
          output[destPos + i] = output[startPos + i];
        }
      }
    }
  }

  return output;
}

/**
 * Play audio samples through Web Audio API
 * @param {Float32Array} samples - Audio samples
 * @param {number} playbackRate - Speed multiplier (default 1.0)
 * @param {number} pan - Stereo position: -1 (left) to 1 (right), 0 = center
 */
function playSamples(samples, playbackRate = 1.0, pan = 0) {
  const ctx = ensureAudioContext();
  
  // SAM outputs at 22050 Hz
  const sampleRate = 22050;
  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
  buffer.getChannelData(0).set(samples);
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;
  
  // Create stereo panner
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  
  // Chain: source → panner → gainNode (→ limiter → destination)
  source.connect(panner);
  panner.connect(gainNode);
  
  source.start();
  
  return source;
}

/**
 * Speak text immediately
 * @param {string} text - Text to speak
 * @param {object} voiceParams - Optional { speed, pitch, throat, mouth, glitch }
 */
export function speak(text, voiceParams = null) {
  const voice = voiceParams || defaultVoice;
  let samples = generateSamples(text, voice);
  if (!samples) return;
  
  // Apply glitch effects if specified
  if (voice.glitch) {
    samples = applyGlitchEffects(samples, voice.glitch);
  }
  
  playSamples(samples);
}

/**
 * Speak text over a specified duration (synced to typing)
 * @param {string} text - Text to speak
 * @param {number} duration - Target duration in seconds
 * @param {object} voiceParams - Optional { speed, pitch, throat, mouth, glitch }
 */
export function speakOverDuration(text, duration, voiceParams = null) {
  const voice = voiceParams || defaultVoice;
  let samples = generateSamples(text, voice);
  if (!samples) return;
  
  // Apply glitch effects if specified
  if (voice.glitch) {
    samples = applyGlitchEffects(samples, voice.glitch);
  }
  
  // Calculate natural duration at 22050 Hz
  const naturalDuration = samples.length / 22050;
  
  // Calculate playback rate to match target duration
  // Clamp to reasonable range (0.5x to 2x)
  let playbackRate = naturalDuration / duration;
  playbackRate = Math.max(0.5, Math.min(2.0, playbackRate));
  
  playSamples(samples, playbackRate);
}

/**
 * Set output volume
 * @param {number} value - Volume 0-1
 */
export function setVolume(value) {
  volume = Math.max(0, Math.min(1, value));
  if (gainNode) {
    gainNode.gain.value = volume;
  }
}

/**
 * Configure the limiter
 * @param {object} settings - { threshold, knee, ratio, attack, release }
 *   threshold: dB level where limiting starts (default -6)
 *   knee: dB width of soft knee (default 3)
 *   ratio: compression ratio (default 20, higher = harder limit)
 *   attack: seconds (default 0.001)
 *   release: seconds (default 0.1)
 */
export function setLimiter(settings = {}) {
  ensureAudioContext();
  if (limiter) {
    if (settings.threshold !== undefined) limiter.threshold.value = settings.threshold;
    if (settings.knee !== undefined) limiter.knee.value = settings.knee;
    if (settings.ratio !== undefined) limiter.ratio.value = settings.ratio;
    if (settings.attack !== undefined) limiter.attack.value = settings.attack;
    if (settings.release !== undefined) limiter.release.value = settings.release;
  }
}

/**
 * Set default voice parameters
 * @param {object} voice - { speed, pitch, throat, mouth }
 */
export function setVoice(voice) {
  if (typeof voice === 'object') {
    defaultVoice = { ...defaultVoice, ...voice };
  }
}

/**
 * Initialize SAM TTS
 */
export function init() {
  console.log('SAM TTS ready (Software Automatic Mouth, 1982)');
}

export default {
  speak,
  speakOverDuration,
  setVolume,
  setLimiter,
  setVoice,
  init,
};
