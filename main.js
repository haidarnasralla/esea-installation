/**
 * Text Stream Installation - Canvas Prototype
 * 
 * Snippets of text appear at random positions and type out character by character,
 * scheduled via a Poisson process.
 * 
 * Degradation cycle: verbatim → word markov → mixed → char only → final
 */

import MarkovGenerator from './processes/markov-generator.js';
import { DegradationCycle } from './processes/degradation-cycle.js';

// --- Font Pool ---
const FONTS = [
  // Monospace (machine/terminal)
  'Courier New, monospace',
  'Monaco, monospace',
  'SF Mono, monospace',
  // Sans-serif (clinical/neutral)
  'Helvetica, Arial, sans-serif',
  'SF Pro, system-ui, sans-serif',
  'Inter, sans-serif',
  'Roboto, sans-serif',
  // Serif (human/literary)
  'Georgia, serif',
  'Times New Roman, serif',
  'Palatino, serif',
];

// --- Configuration ---
const CONFIG = {
  // Poisson process: average snippets per second
  lambda: 0.5,
  
  // Snippet appearance
  minFontSize: 16,
  maxFontSize: 48,
  color: 'rgba(255, 255, 255, 0.9)',
  
  // Typewriter timing
  minCharDelay: 30,   // ms between characters
  maxCharDelay: 80,
  
  // Lifespan (after fully typed)
  holdDuration: 3,      // seconds to stay visible after typing completes
  fadeOutDuration: 2,   // seconds
  
  // Snippet length (for Markov generation)
  minSnippetWords: 6,
  maxSnippetWords: 11,
  minSnippetChars: 20,
  maxSnippetChars: 60,
};

// --- State ---
let canvas, ctx;
let snippets = [];       // active text fragments on screen
let corpusLines = [];    // raw lines from corpus (for verbatim mode)
let lastTime = 0;
let nextSpawnTime = 0;
let voices = [];         // available TTS voices

// Degradation system
const markov = new MarkovGenerator();
const cycle = new DegradationCycle();

// --- TTS Setup ---
function loadVoices() {
  const allVoices = speechSynthesis.getVoices();
  // Filter to English voices only
  voices = allVoices.filter(v => v.lang.startsWith('en'));
  console.log(`Loaded ${voices.length} English TTS voices (of ${allVoices.length} total)`);
}

// Voices load asynchronously in some browsers
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function speak(text) {
  if (voices.length === 0) return;
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voices[Math.floor(Math.random() * voices.length)];
  utterance.rate = 0.8 + Math.random() * 0.4; // 0.8 - 1.2
  utterance.pitch = 0.8 + Math.random() * 0.4;
  
  speechSynthesis.speak(utterance);
}

// --- Corpus Loading ---
async function loadCorpus() {
  try {
    const response = await fetch('./corpus/corpus.txt');
    const text = await response.text();
    
    // Store raw lines for verbatim mode
    corpusLines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Train Markov generator on full corpus
    markov.train(text);
    
    console.log(`Loaded ${corpusLines.length} lines from corpus`);
  } catch (err) {
    console.error('Failed to load corpus:', err);
    // Fallback snippets for testing
    corpusLines = [
      'the machine remembers everything',
      'what remains of human intent',
      'digital persistence',
      'slowly decays into noise',
      'processed by a machine',
    ];
    markov.train(corpusLines.join('\n'));
  }
}

// --- Text Generation ---
function generateText() {
  const params = cycle.getGenerationParams();
  
  switch (params.mode) {
    case 'verbatim':
      // Return a random line from the corpus
      return corpusLines[Math.floor(Math.random() * corpusLines.length)];
    
    case 'word': {
      // Generate word-level Markov text
      const length = CONFIG.minSnippetWords + 
        Math.floor(Math.random() * (CONFIG.maxSnippetWords - CONFIG.minSnippetWords + 1));
      return markov.generate({
        length,
        mode: 'word',
        order: params.wordOrder,
      });
    }
    
    case 'char': {
      // Generate character-level Markov text
      const length = CONFIG.minSnippetChars + 
        Math.floor(Math.random() * (CONFIG.maxSnippetChars - CONFIG.minSnippetChars + 1));
      return markov.generate({
        length,
        mode: 'char',
        order: params.charOrder,
      });
    }
    
    default:
      return 'ERROR: unknown mode';
  }
}

// --- Poisson Scheduling ---
function getNextPoissonDelay() {
  // Exponential distribution: -ln(U) / λ
  return -Math.log(Math.random()) / CONFIG.lambda * 1000; // ms
}

// --- Snippet Factory ---
function spawnSnippet() {
  if (corpusLines.length === 0) return;
  
  const text = generateText();
  const fontSize = CONFIG.minFontSize + 
    Math.random() * (CONFIG.maxFontSize - CONFIG.minFontSize);
  const fontFamily = FONTS[Math.floor(Math.random() * FONTS.length)];
  
  // Measure text width to avoid spawning too close to right edge
  ctx.font = `${fontSize}px ${fontFamily}`;
  const textWidth = ctx.measureText(text).width;
  
  // Random position (avoid edges, account for text width)
  const padding = 50;
  const maxX = Math.max(padding, canvas.width - textWidth - padding);
  const x = padding + Math.random() * (maxX - padding);
  const y = padding + Math.random() * (canvas.height - padding * 2);
  
  // Character delay for typewriter effect
  const charDelay = CONFIG.minCharDelay + 
    Math.random() * (CONFIG.maxCharDelay - CONFIG.minCharDelay);
  
  snippets.push({
    text,
    x,
    y,
    fontSize,
    fontFamily,
    charDelay,
    visibleChars: 0,
    timeSinceLastChar: 0,
    typingComplete: false,
    holdTimer: 0,
    opacity: 1,
    state: 'typing', // 'typing', 'holding', 'fading'
  });
  
  // Speak the snippet
  speak(text);
}

// --- UI Update ---
function updateUI() {
  const state = cycle.getState();
  
  document.getElementById('phase').textContent = state.phase;
  document.getElementById('description').textContent = state.description;
  document.getElementById('word-order').textContent = state.wordOrder;
  document.getElementById('char-order').textContent = state.charOrder;
  document.getElementById('char-active').textContent = state.charModeActive ? 'Yes' : 'No';
  
  // Disable button at final state
  const stepBtn = document.getElementById('step-btn');
  if (cycle.isFinal()) {
    stepBtn.disabled = true;
    stepBtn.textContent = 'Final State Reached';
  }
}

// --- Step Handler ---
function handleStep() {
  cycle.step();
  updateUI();
  console.log('Stepped to:', cycle.getState());
}

// --- Rendering ---
function updateAndRender(timestamp) {
  const deltaTime = lastTime ? (timestamp - lastTime) / 1000 : 0;
  const deltaTimeMs = deltaTime * 1000;
  lastTime = timestamp;
  
  // Clear canvas
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Spawn new snippets via Poisson process
  if (timestamp >= nextSpawnTime) {
    spawnSnippet();
    nextSpawnTime = timestamp + getNextPoissonDelay();
  }
  
  // Update and render snippets
  for (let i = snippets.length - 1; i >= 0; i--) {
    const s = snippets[i];
    
    if (s.state === 'typing') {
      // Typewriter effect
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
    
    // Render visible portion of text
    const visibleText = s.text.slice(0, s.visibleChars);
    ctx.font = `${s.fontSize}px ${s.fontFamily}`;
    ctx.fillStyle = CONFIG.color.replace(/[\d.]+\)$/, `${s.opacity})`);
    ctx.fillText(visibleText, s.x, s.y);
  }
  
  requestAnimationFrame(updateAndRender);
}

// --- Initialization ---
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

async function init() {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Setup step button
  document.getElementById('step-btn').addEventListener('click', handleStep);
  
  await loadCorpus();
  
  // Initial UI state
  updateUI();
  
  // Start the render loop
  nextSpawnTime = performance.now() + getNextPoissonDelay();
  requestAnimationFrame(updateAndRender);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
