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
import { renderSnippet, applyNoiseOverlay, generateNoiseTextures } from './lib/renderer.js';
import { findValidPosition } from './lib/collision.js';
import { initTTS, speak } from './lib/tts.js';

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
  fadeOutDuration: 2,   // seconds to fade out
  
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
  console.log(`Loaded ${corpusLines.length} lines from corpus`);
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
      console.error('Unknown generation mode:', params.mode);
      return corpusLines[Math.floor(Math.random() * corpusLines.length)];
  }
}

// --- Poisson Scheduling ---
function getNextPoissonDelay() {
  const lambda = cycle.getLambda();
  return -Math.log(Math.random()) / lambda * 1000;
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
    opacity: initialOpacity,
    state: 'typing',
  });

  speak(text);
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

  const stepBtn = document.getElementById('step-btn');
  if (cycle.isFinal()) {
    stepBtn.disabled = true;
    stepBtn.textContent = 'Final State Reached';
  }
}

function updateLiveUI() {
  document.getElementById('lambda').textContent = cycle.getLambda().toFixed(2);
}

function handleStep() {
  cycle.step();
  updateUI();
  console.log('Stepped to:', cycle.getState());
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
  if (timestamp >= nextSpawnTime) {
    spawnSnippet();
    nextSpawnTime = timestamp + getNextPoissonDelay();
  }

  updateLiveUI();

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
        s.state = 'fading';
      }
    } else if (s.state === 'fading') {
      s.opacity -= deltaTime / CONFIG.fadeOutDuration;
      if (s.opacity <= 0) {
        snippets.splice(i, 1);
        continue;
      }
    }

    // Render with effects
    renderSnippet(ctx, s, effects, CONFIG);
  }

  // Apply noise
  noiseIndex = applyNoiseOverlay(ctx, canvas, noiseTextures, noiseIndex, noiseIntensity);

  requestAnimationFrame(updateAndRender);
}

// --- Initialization ---
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  if (noiseTextures.length > 0) {
    noiseTextures = generateNoiseTextures(canvas.width, canvas.height, 5);
  }
}

function getElapsedGalleryHours(now) {
  const { startDate, endDate, openHour, closeHour } = ENV.INSTALLATION;
  const hoursPerDay = closeHour - openHour;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(now);
  
  // Set to start of day for date comparisons
  const currentDateOnly = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  // Before installation starts
  if (currentDateOnly < startDateOnly) return 0;
  
  // After installation ends
  if (currentDateOnly > endDateOnly) {
    const totalDays = Math.round((endDateOnly - startDateOnly) / (1000 * 60 * 60 * 24)) + 1;
    return totalDays * hoursPerDay;
  }
  
  // Count full days elapsed
  const fullDaysElapsed = Math.round((currentDateOnly - startDateOnly) / (1000 * 60 * 60 * 24));
  let elapsed = fullDaysElapsed * hoursPerDay;
  
  // Add hours from today
  const currentHour = current.getHours() + current.getMinutes() / 60;
  
  if (currentHour < openHour) {
    // Before gallery opens today — no additional hours
  } else if (currentHour >= closeHour) {
    // After gallery closes today — add full day
    elapsed += hoursPerDay;
  } else {
    // During gallery hours — add partial day
    elapsed += currentHour - openHour;
  }
  
  return elapsed;
}

function getStepAtTime(now) {
  const { openHour, closeHour, startDate, endDate, totalSteps } = ENV.INSTALLATION;
  const hoursPerDay = closeHour - openHour;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;
  const totalHours = totalDays * hoursPerDay;
  
  const elapsed = getElapsedGalleryHours(now);
  
  if (elapsed <= 0) return 0;
  if (elapsed >= totalHours) return totalSteps;

  const progress = elapsed / totalHours;
  const easedProgress = progress * progress; // quadratic ease-in
  return Math.floor(easedProgress * totalSteps);
}

function syncStep() {
  const targetStep = getStepAtTime(Date.now());
  const currentStep = cycle.getStepCount();

  if (targetStep !== currentStep) {
    cycle.jumpToStep(targetStep);
    console.log(`Synced to step ${targetStep}`);
  }
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
