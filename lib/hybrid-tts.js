/**
 * Hybrid TTS Module
 * 
 * Combines LPC (human voices) and SAM (synthetic) with fallback chain:
 * 1. Try primary LPC voice for the phrase
 * 2. Fall back to other LPC voices for missing words
 * 3. Fall back to SAM for words not in any LPC vocab
 * 
 * As degradation progresses, SAM probability increases until it's the only voice.
 */

import './vendor/sam.js';

// Import per-voice LPC vocabularies
import danielVocab from '../build/voices/Daniel.js';
import samanthaVocab from '../build/voices/Samantha.js';
import whisperVocab from '../build/voices/Whisper.js';

// LPC decoder from formant-synth
import lpcSynth from './formant-synth.js';

// --- Audio Context Setup ---
let audioContext = null;
let masterGain = null;
let limiter = null;
let volume = 1.0;

const LPC_SAMPLE_RATE = 8000;
const SAM_SAMPLE_RATE = 22050;

// Voice registry
const LPC_VOICES = {
  daniel: danielVocab,
  samantha: samanthaVocab,
  whisper: whisperVocab,
};
const LPC_VOICE_NAMES = Object.keys(LPC_VOICES);

/**
 * Initialize audio context with limiter on master output
 */
function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Limiter on master output - catches ALL audio
    limiter = audioContext.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 3;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;
    
    // Master gain before limiter
    masterGain = audioContext.createGain();
    masterGain.gain.value = volume;
    
    // Chain: [per-voice panners] → masterGain → limiter → destination
    masterGain.connect(limiter);
    limiter.connect(audioContext.destination);
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * Check if a word exists in a specific LPC voice
 */
function hasWordInVoice(word, voiceName) {
  const vocab = LPC_VOICES[voiceName];
  return vocab && vocab.hasOwnProperty(word.toLowerCase());
}

/**
 * Check if a word exists in any LPC voice
 */
function hasWordInAnyVoice(word) {
  const w = word.toLowerCase();
  return LPC_VOICE_NAMES.some(name => LPC_VOICES[name].hasOwnProperty(w));
}

/**
 * Get LPC data for a word from a specific voice
 */
function getLPCData(word, voiceName) {
  const vocab = LPC_VOICES[voiceName];
  if (!vocab) return null;
  return vocab[word.toLowerCase()] || null;
}

/**
 * Decode LPC data to audio samples using the LPC synth
 */
function decodeLPC(lpcData) {
  // Use the LPC synth's decoder
  return lpcSynth.decodeLPC(lpcData);
}

/**
 * Generate SAM samples for a word
 */
function generateSAMSamples(word, voiceParams = null) {
  const params = voiceParams || { speed: 72, pitch: 64, throat: 128, mouth: 128 };
  try {
    const sam = new window.SamJs({
      speed: params.speed,
      pitch: params.pitch,
      throat: params.throat,
      mouth: params.mouth,
    });
    return sam.buf32(word);
  } catch (e) {
    return null;
  }
}

/**
 * Resample audio from one sample rate to another
 */
function resample(samples, fromRate, toRate) {
  if (fromRate === toRate) return samples;
  
  const ratio = fromRate / toRate;
  const newLength = Math.floor(samples.length / ratio);
  const output = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, samples.length - 1);
    const t = srcIndex - srcIndexFloor;
    
    // Linear interpolation
    output[i] = samples[srcIndexFloor] * (1 - t) + samples[srcIndexCeil] * t;
  }
  
  return output;
}

/**
 * Generate audio for a phrase using hybrid voice selection
 * 
 * @param {string} text - Text to speak
 * @param {object} options - { voiceMix, samVoiceParams }
 *   voiceMix: { lpcProbability, primaryVoice }
 *   samVoiceParams: SAM voice parameters for fallback/SAM-only
 * @returns {Float32Array} - Audio samples at native audio context rate
 */
export function generatePhraseSamples(text, options = {}) {
  const ctx = ensureAudioContext();
  const targetRate = ctx.sampleRate;
  
  const {
    voiceMix = { lpcProbability: 1.0, primaryVoice: null },
    samVoiceParams = { speed: 72, pitch: 64, throat: 128, mouth: 128 },
  } = options;

  const words = text.toLowerCase().replace(/[^a-z\s'-]/g, '').split(/\s+/).filter(w => w.length > 0);
  
  // Track audio segments for efficient concatenation
  const segments = [];
  let totalLength = 0;
  
  // Decide primary voice for this phrase
  let primaryVoice = voiceMix.primaryVoice;
  if (!primaryVoice) {
    // Random LPC voice
    primaryVoice = LPC_VOICE_NAMES[Math.floor(Math.random() * LPC_VOICE_NAMES.length)];
  }
  
  // Should this phrase use LPC at all?
  const useLPC = Math.random() < voiceMix.lpcProbability;
  
  for (const word of words) {
    let samples = null;
    let sampleRate = targetRate;
    
    if (useLPC) {
      // Try primary voice first
      let lpcData = getLPCData(word, primaryVoice);
      
      // Fallback to other LPC voices
      if (!lpcData) {
        for (const voiceName of LPC_VOICE_NAMES) {
          if (voiceName !== primaryVoice) {
            lpcData = getLPCData(word, voiceName);
            if (lpcData) break;
          }
        }
      }
      
      if (lpcData) {
        samples = decodeLPC(lpcData);
        sampleRate = LPC_SAMPLE_RATE;
      }
    }
    
    // Fallback to SAM if no LPC data or not using LPC
    if (!samples) {
      samples = generateSAMSamples(word, samVoiceParams);
      sampleRate = SAM_SAMPLE_RATE;
    }
    
    if (samples) {
      // Resample to target rate
      const resampled = resample(samples, sampleRate, targetRate);
      
      // Add small gap between words (50ms)
      const gapSamples = Math.floor(targetRate * 0.05);
      
      // Collect segment info for later concatenation (avoid per-sample push)
      segments.push({ samples: resampled, gap: gapSamples });
      totalLength += resampled.length + gapSamples;
    }
  }
  
  // Pre-allocate output buffer and copy all segments
  const output = new Float32Array(totalLength);
  let offset = 0;
  for (const seg of segments) {
    output.set(seg.samples, offset);
    offset += seg.samples.length;
    // Gap is already zeros from Float32Array initialization
    offset += seg.gap;
  }
  
  return output;
}

/**
 * Play audio samples with stereo panning and volume
 * @param {Float32Array} samples - Audio samples
 * @param {number} playbackRate - Speed multiplier (default 1.0)
 * @param {number} pan - Stereo position: -1 (left) to 1 (right), 0 = center
 * @param {number} snippetVolume - Per-snippet volume multiplier (0-1)
 */
function playSamples(samples, playbackRate = 1.0, pan = 0, snippetVolume = 1.0) {
  const ctx = ensureAudioContext();
  
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.getChannelData(0).set(samples);
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;
  
  // Per-snippet gain (for font size → volume mapping)
  const snippetGain = ctx.createGain();
  snippetGain.gain.value = snippetVolume;
  
  // Create stereo panner
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  
  // Chain: source → snippetGain → panner → masterGain (→ limiter → destination)
  source.connect(snippetGain);
  snippetGain.connect(panner);
  panner.connect(masterGain);
  
  source.start();
  
  return source;
}

/**
 * Speak text immediately
 * @param {string} text - Text to speak
 * @param {object} options - { voiceMix, samVoiceParams, pan, volume }
 */
export function speak(text, options = {}) {
  const { pan = 0, volume: snippetVolume = 1.0 } = options;
  const samples = generatePhraseSamples(text, options);
  if (samples.length > 0) {
    playSamples(samples, 1.0, pan, snippetVolume);
  }
}

/**
 * Speak text over a specified duration
 * @param {string} text - Text to speak
 * @param {number} duration - Target duration in seconds
 * @param {object} options - { voiceMix, samVoiceParams, pan, volume }
 */
export function speakOverDuration(text, duration, options = {}) {
  const { pan = 0, volume: snippetVolume = 1.0 } = options;
  const samples = generatePhraseSamples(text, options);
  if (samples.length === 0) return;
  
  const ctx = ensureAudioContext();
  const naturalDuration = samples.length / ctx.sampleRate;
  
  let playbackRate = naturalDuration / duration;
  playbackRate = Math.max(0.5, Math.min(2.0, playbackRate));
  
  playSamples(samples, playbackRate, pan, snippetVolume);
}

/**
 * Set volume
 */
export function setVolume(value) {
  volume = Math.max(0, Math.min(1, value));
  if (masterGain) {
    masterGain.gain.value = volume;
  }
}

/**
 * Initialize hybrid TTS
 */
export function init() {
  // Audio context created on first speak() call
}

/**
 * Get list of available LPC voices
 */
export function getVoices() {
  return [...LPC_VOICE_NAMES];
}

export default {
  speak,
  speakOverDuration,
  setVolume,
  init,
  getVoices,
  generatePhraseSamples,
};
