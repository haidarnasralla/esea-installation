/**
 * Text Stream Installation - Main Entry Point
 * 
 * Snippets of text appear at random positions and type out character by character,
 * scheduled via a Poisson process.
 * 
 * Degradation cycle: verbatim → word markov → mixed → char only → final
 */

import ENV from './config.js';
import { CORPUS } from './corpus.js';
import MarkovGenerator from './processes/markov-generator.js';
import { DegradationCycle } from './processes/degradation-cycle.js';
import { renderSnippet, renderFlickerOut, applyNoiseOverlay, generateNoiseTextures } from './lib/renderer.js';
import { findValidPosition } from './lib/collision.js';
import { initTTS, speakOverDuration } from './lib/tts.js';

// --- Font Pool ---
const FONTS = [
  'Courier New, monospace',
  'Monaco, monospace',
  'SF Mono, monospace',
  'Helvetica, Arial, sans-serif',
  'SF Pro, system-ui, sans-serif',
  'Inter, sans-serif',
  'Roboto, sans-serif',
  'Georgia, serif',
  'Times New Roman, serif',
  'Palatino, serif',
];

// --- Configuration ---
const CONFIG = {
  // Snippet appearance
  minFontSize: 16,
  maxFontSize: 48,
  color: 'rgba(240, 238, 235, 1)', // off-white
  minOpacity: 0.6,
  maxOpacity: 1.0,
  
  // Layout
  lineHeightMultiplier: 1.2,  // text height = fontSize * this
  edgePadding: 20,            // min distance from canvas edge
  
  // Typewriter timing
  minCharDelay: 80,   // ms between characters
  maxCharDelay: 150,
  
  // Lifespan
  holdDuration: 3,      // seconds to stay visible after typing
  // flickerOutDuration is now controlled by DegradationCycle.getFlickerOutDuration()
  
  // Markov snippet length
  minSnippetWords: 6,
  maxSnippetWords: 11,
  minSnippetChars: 20,
  maxSnippetChars: 60,
};

// --- State ---
let canvas, ctx;
let snippets = [];
let corpusLines = [];
let lastTime = 0;
let nextSpawnTime = 0;
let noiseTextures = [];
let noiseIndex = 0;

// Degradation system
const markov = new MarkovGenerator();
const cycle = new DegradationCycle();

// --- Corpus Loading ---
function loadCorpus() {
  corpusLines = CORPUS;
  markov.train(CORPUS.join(' '));
}

// --- Text Generation ---
function generateText() {
  const params = cycle.getGenerationParams();

  switch (params.mode) {
    case 'verbatim':
      return corpusLines[Math.floor(Math.random() * corpusLines.length)];

    case 'word': {
      const length = CONFIG.minSnippetWords +
        Math.floor(Math.random() * (CONFIG.maxSnippetWords - CONFIG.minSnippetWords + 1));
      return markov.generate({ length, mode: 'word', order: params.wordOrder });
    }

    case 'char': {
      const length = CONFIG.minSnippetChars +
        Math.floor(Math.random() * (CONFIG.maxSnippetChars - CONFIG.minSnippetChars + 1));
      return markov.generate({ length, mode: 'char', order: params.charOrder });
    }

    default:
      return corpusLines[Math.floor(Math.random() * corpusLines.length)];
  }
}

// --- Spawn Scheduling ---
let lastSnippetDiedAt = 0;  // timestamp when last snippet was removed
let lastSpawnTime = 0;      // timestamp of most recent spawn

function getNextPoissonDelay() {
  const lambda = cycle.getLambda();
  return -Math.log(Math.random()) / lambda * 1000;
}

/**
 * Determine whether we should spawn a snippet this frame.
 * Replaces the old "if timestamp >= nextSpawnTime" check.
 */
function shouldSpawn(timestamp) {
  const mode = cycle.getSpawnMode();
  const maxConcurrent = cycle.getMaxConcurrent();
  const activeCount = snippets.length;

  switch (mode) {
    case 'serial': {
      // Only spawn when 0 active snippets and pause has elapsed
      if (activeCount > 0) return false;
      const pause = cycle.getSerialPause() * 1000; // ms
      return (timestamp - lastSnippetDiedAt) >= pause;
    }

    case 'overlap': {
      // Spawn if under cap and minimum inter-spawn delay has passed
      if (activeCount >= maxConcurrent) return false;
      const pause = cycle.getSerialPause() * 1000;
      return (timestamp - lastSpawnTime) >= pause;
    }

    case 'poisson': {
      // Stochastic arrivals, but respect concurrent cap
      if (activeCount >= maxConcurrent) return false;
      return timestamp >= nextSpawnTime;
    }

    default:
      return false;
  }
}

// --- Snippet Factory ---
function spawnSnippet() {
  if (corpusLines.length === 0) return;

  const text = generateText();
  const fontSize = CONFIG.minFontSize +
    Math.random() * (CONFIG.maxFontSize - CONFIG.minFontSize);
  const fontFamily = FONTS[Math.floor(Math.random() * FONTS.length)];

  const position = findValidPosition(ctx, canvas, text, fontSize, fontFamily, snippets, cycle, CONFIG);

  if (!position.valid) return;

  const { x, y } = position;
  const charDelay = CONFIG.minCharDelay +
    Math.random() * (CONFIG.maxCharDelay - CONFIG.minCharDelay);
  const initialOpacity = CONFIG.minOpacity +
    Math.random() * (CONFIG.maxOpacity - CONFIG.minOpacity);

  // Pre-calculate bounds for collision detection (avoids repeated measureText calls)
  ctx.font = `${fontSize}px ${fontFamily}`;
  const textWidth = ctx.measureText(text).width;
  const textHeight = fontSize * CONFIG.lineHeightMultiplier;
  const cachedBounds = {
    x,
    y: y - textHeight,
    width: textWidth,
    height: textHeight,
    centerX: x + textWidth / 2,
    centerY: y - textHeight / 2,
  };

  snippets.push({
    text,
    x,
    y,
    fontSize,
    fontFamily,
    charDelay,
    visibleChars: 0,
    timeSinceLastChar: 0,
    holdTimer: 0,
    flickerTimer: 0,        // tracks time spent flickering
    flickerDuration: cycle.getFlickerOutDuration(),  // captured at spawn time for consistency
    opacity: initialOpacity,
    state: 'typing',
    cachedBounds,  // for efficient collision detection
  });

  // Calculate typing duration and speak synced to it
  const typingDuration = (text.length * charDelay) / 1000; // convert ms to seconds
  
  // Get voice parameters from degradation cycle
  const voiceMix = cycle.getVoiceMix();
  const samVoiceParams = cycle.getVoiceParams();
  
  // Calculate stereo pan from text center (-1 = left, 1 = right)
  // textWidth already calculated above for cachedBounds
  const textCenterX = x + textWidth / 2;
  const panRaw = (textCenterX / canvas.width) * 2 - 1;
  const pan = Math.max(-1, Math.min(1, panRaw));
  
  // Calculate volume from font size (larger text = louder)
  // Map fontSize 16-48 to volume 0.4-1.0
  const volumeScale = 0.4 + ((fontSize - CONFIG.minFontSize) / (CONFIG.maxFontSize - CONFIG.minFontSize)) * 0.6;
  
  speakOverDuration(text, typingDuration, { voiceMix, samVoiceParams, pan, volume: volumeScale });
}

// --- UI ---
function updateUI() {
  const state = cycle.getState();
  const tolerance = cycle.getOverlapTolerance();

  document.getElementById('phase').textContent = state.phase;
  document.getElementById('description').textContent = state.description;
  document.getElementById('word-order').textContent = state.wordOrder;
  document.getElementById('char-order').textContent = state.charOrder;
  document.getElementById('char-active').textContent = state.charModeActive ? 'Yes' : 'No';
  document.getElementById('overlap-tolerance').textContent = `${Math.round(tolerance * 100)}%`;

  document.getElementById('flicker').textContent = `${Math.round(cycle.getFlicker() * 100)}%`;
  document.getElementById('fade-flicker').textContent = `${Math.round(cycle.getFadeFlicker() * 100)}%`;
  document.getElementById('inverse-flicker').textContent = `${Math.round(cycle.getInverseFlicker() * 100)}%`;
  document.getElementById('chromatic').textContent = `${cycle.getChromaticAberration().toFixed(1)}px`;
  document.getElementById('color-shift').textContent = `${Math.round(cycle.getColorShift() * 100)}%`;
  document.getElementById('noise').textContent = `${Math.round(cycle.getNoiseOverlay() * 100)}%`;
  document.getElementById('char-dropout').textContent = `${Math.round(cycle.getCharDropout() * 100)}%`;
  document.getElementById('ghost').textContent = `${Math.round(cycle.getDuplicateGhost().probability * 100)}%`;
  document.getElementById('slice').textContent = `${Math.round(cycle.getSliceDisplacement().probability * 100)}%`;
  document.getElementById('bit-crush').textContent = `${Math.round(cycle.getBitCrush() * 100)}%`;

  // Flicker-out effect parameters
  document.getElementById('flicker-out-duration').textContent = `${cycle.getFlickerOutDuration().toFixed(1)}s`;
  document.getElementById('flicker-out-intensity').textContent = `${Math.round(cycle.getFlickerOutIntensity() * 100)}%`;
  document.getElementById('char-scatter').textContent = `${Math.round(cycle.getCharacterScatter() * 100)}%`;
  document.getElementById('flicker-jitter').textContent = `${cycle.getFlickerJitter().toFixed(1)}px`;

  const stepBtn = document.getElementById('step-btn');
  if (cycle.isFinal()) {
    stepBtn.disabled = true;
    stepBtn.textContent = 'Final State Reached';
  }
}

function updateLiveUI() {
  const spawnMode = cycle.getSpawnMode();
  document.getElementById('spawn-mode').textContent = spawnMode;
  document.getElementById('max-concurrent').textContent = cycle.getMaxConcurrent();
  
  if (spawnMode === 'poisson') {
    document.getElementById('lambda').textContent = cycle.getLambda().toFixed(2);
  } else {
    document.getElementById('lambda').textContent = `pause ${cycle.getSerialPause().toFixed(1)}s`;
  }
}

function handleStep() {
  cycle.step();
  updateUI();
}

// --- Render Loop ---
function updateAndRender(timestamp) {
  const deltaTime = lastTime ? (timestamp - lastTime) / 1000 : 0;
  const deltaTimeMs = deltaTime * 1000;
  lastTime = timestamp;

  // Get current effects
  const effects = {
    flicker: cycle.getFlicker(),
    fadeFlicker: cycle.getFadeFlicker(),
    inverseFlicker: cycle.getInverseFlicker(),
    chromatic: cycle.getChromaticAberration(),
    colorShift: cycle.getColorShift(),
    charDropout: cycle.getCharDropout(),
    ghost: cycle.getDuplicateGhost(),
    slice: cycle.getSliceDisplacement(),
    bitCrush: cycle.getBitCrush(),
  };
  const noiseIntensity = cycle.getNoiseOverlay();

  // Clear canvas
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Spawn new snippets
  if (shouldSpawn(timestamp)) {
    spawnSnippet();
    lastSpawnTime = timestamp;
    // Schedule next Poisson arrival (only matters in poisson mode)
    if (cycle.getSpawnMode() === 'poisson') {
      nextSpawnTime = timestamp + getNextPoissonDelay();
    }
  }

  // Only update debug UI in test mode
  if (ENV.MODE !== 'production') {
    updateLiveUI();
  }

  // Update and render snippets
  for (let i = snippets.length - 1; i >= 0; i--) {
    const s = snippets[i];

    // Update state
    if (s.state === 'typing') {
      s.timeSinceLastChar += deltaTimeMs;
      while (s.timeSinceLastChar >= s.charDelay && s.visibleChars < s.text.length) {
        s.visibleChars++;
        s.timeSinceLastChar -= s.charDelay;
      }
      if (s.visibleChars >= s.text.length) {
        s.state = 'holding';
      }
    } else if (s.state === 'holding') {
      s.holdTimer += deltaTime;
      if (s.holdTimer >= CONFIG.holdDuration) {
        s.state = 'flickering';
      }
    } else if (s.state === 'flickering') {
      s.flickerTimer += deltaTime;
      if (s.flickerTimer >= s.flickerDuration) {
        snippets.splice(i, 1);
        lastSnippetDiedAt = timestamp;
        continue;
      }
    }

    // Get flicker-out parameters
    const flickerOutParams = {
      intensity: cycle.getFlickerOutIntensity(),
      characterScatter: cycle.getCharacterScatter(),
      jitter: cycle.getFlickerJitter(),
    };

    // Render with effects
    if (s.state === 'flickering') {
      const progress = s.flickerTimer / s.flickerDuration; // 0 → 1
      renderFlickerOut(ctx, s, progress, flickerOutParams, effects, CONFIG);
    } else {
      renderSnippet(ctx, s, effects, CONFIG);
    }
  }

  // Apply noise
  noiseIndex = applyNoiseOverlay(ctx, canvas, noiseTextures, noiseIndex, noiseIntensity);

  requestAnimationFrame(updateAndRender);
}

// --- Initialization ---
let resizeDebounceTimeout = null;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Debounce noise texture regeneration to avoid GC pressure during resize drag
  if (noiseTextures.length > 0) {
    clearTimeout(resizeDebounceTimeout);
    resizeDebounceTimeout = setTimeout(() => {
      noiseTextures = generateNoiseTextures(canvas.width, canvas.height, 5);
    }, 200);
  }
}

function getElapsedHours(now) {
  const { startTime, endTime } = ENV.INSTALLATION;
  
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const current = typeof now === 'number' ? now : new Date(now).getTime();
  
  const totalDuration = end - start;
  const elapsed = current - start;
  
  // Before installation starts
  if (elapsed <= 0) return 0;
  
  // After installation ends
  if (elapsed >= totalDuration) return totalDuration / (1000 * 60 * 60);
  
  return elapsed / (1000 * 60 * 60);
}

function getStepAtTime(now) {
  const { startTime, endTime, totalSteps } = ENV.INSTALLATION;
  
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const current = typeof now === 'number' ? now : new Date(now).getTime();
  
  // Before installation starts
  if (current <= start) return 0;
  
  // After installation ends
  if (current >= end) return totalSteps;
  
  const totalDuration = end - start;
  const elapsed = current - start;
  const progress = elapsed / totalDuration;
  
  // Less aggressive quadratic ease-in (blend of linear and quadratic)
  const easedProgress = progress * (0.5 + 0.5 * progress);
  return Math.floor(easedProgress * totalSteps);
}

function syncStep() {
  const targetStep = getStepAtTime(Date.now());
  const currentStep = cycle.getStepCount();

  if (targetStep !== currentStep) {
    cycle.jumpToStep(targetStep);
  }
  
  const state = cycle.getState();
  console.log(`[Step ${cycle.getStepCount()}/20] ${state.phase}: ${state.description}`);
}

function init() {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  noiseTextures = generateNoiseTextures(canvas.width, canvas.height, 5);
  
  initTTS();
  loadCorpus();

  if (ENV.MODE === 'production') {
    document.getElementById('controls').style.display = 'none';
    syncStep();
    setInterval(syncStep, ENV.INSTALLATION.syncInterval);
  } else {
    document.getElementById('step-btn').addEventListener('click', handleStep);
  }

  updateUI();

  nextSpawnTime = performance.now() + getNextPoissonDelay();
  requestAnimationFrame(updateAndRender);
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
